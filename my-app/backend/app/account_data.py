"""Portable per-account backups. Never restore identity, sessions or credentials."""
import io
import json
from uuid import uuid4
from zipfile import ZipFile, BadZipFile, ZIP_DEFLATED
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from .config import settings
from .db import get_db
from .models import User, Category, Receipt, Transaction, MonthlyBudget, CategoryBudget, RefreshSession, ActionToken, RecoveryCode
from .schemas import CategoryInput, TransactionInput, BudgetInput
from .security import current_user
from .account import Confirmation
from .account_security import reauthenticate, now

router = APIRouter(prefix='/api/account')
LIMIT = 50 * 1024 * 1024

class SavedCategory(CategoryInput):
    id: str = Field(min_length=1, max_length=36)

class SavedReceipt(BaseModel):
    id: str = Field(min_length=1, max_length=36)
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(pattern=r'^(image/png|image/jpeg|application/pdf)$')
    raw_text: str = Field(max_length=500000)

class SavedTransaction(TransactionInput):
    id: str = Field(min_length=1, max_length=36)

class SavedBudget(BudgetInput):
    month: str = Field(pattern=r'^\d{4}-\d{2}$')

class Backup(BaseModel):
    version: int
    categories: list[SavedCategory] = Field(max_length=500)
    receipts: list[SavedReceipt] = Field(max_length=5000)
    transactions: list[SavedTransaction] = Field(max_length=50000)
    budgets: list[SavedBudget] = Field(max_length=1200)

def receipt_path(storage_name):
    target = (settings.upload_dir / storage_name).resolve()
    if target.parent != settings.upload_dir.resolve():
        raise HTTPException(400, 'Invalid receipt storage name.')
    return target

async def owned_rows(db, model, user):
    return (await db.scalars(select(model).where(model.user_id == user.id))).all()

async def erase_financial_data(db, user):
    receipts = await owned_rows(db, Receipt, user)
    paths = [receipt_path(row.storage_name) for row in receipts]
    budget_ids = select(MonthlyBudget.id).where(MonthlyBudget.user_id == user.id)
    await db.execute(delete(CategoryBudget).where(CategoryBudget.monthly_budget_id.in_(budget_ids)))
    for model in [Transaction, Receipt, MonthlyBudget, Category]:
        await db.execute(delete(model).where(model.user_id == user.id))
    return paths

def remove_files(paths):
    failed = 0
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            failed += 1
    return failed

@router.post('/export')
async def export_all(data: Confirmation, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await reauthenticate(db, user, data.password, data.code)
    categories = await owned_rows(db, Category, user)
    receipts = await owned_rows(db, Receipt, user)
    transactions = await owned_rows(db, Transaction, user)
    budgets = await owned_rows(db, MonthlyBudget, user)
    allocations = (await db.scalars(select(CategoryBudget).where(CategoryBudget.monthly_budget_id.in_([b.id for b in budgets])))).all()
    def fields(row, names):
        return {key: getattr(row, key) for key in names.split()}
    payload = {'version': 1, 'exported_at': now().isoformat(), 'profile': fields(user, 'name email email_verified'),
        'categories': [fields(row, 'id name color') for row in categories],
        'receipts': [fields(row, 'id filename content_type raw_text') for row in receipts],
        'transactions': [fields(row, 'id merchant date amount kind category_id receipt_id notes line_items source reference_code') for row in transactions],
        'budgets': [{'month': b.month, 'amount': b.amount, 'categories': [fields(a, 'category_id amount') for a in allocations if a.monthly_budget_id == b.id]} for b in budgets]}
    manifest = json.dumps(payload, default=str, ensure_ascii=False).encode()
    paths = [(r, receipt_path(r.storage_name)) for r in receipts]
    if any(not p.is_file() for _, p in paths):
        raise HTTPException(409, 'An original receipt is missing. Backup cannot complete; contact the administrator.')
    if len(manifest) + sum(p.stat().st_size for _, p in paths) > LIMIT:
        raise HTTPException(413, 'This account exceeds the 50 MB backup limit. Ask the administrator for a full server backup.')
    output = io.BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('data.json', manifest)
        for receipt, path in paths:
            archive.write(path, 'receipts/' + receipt.id)
    await db.commit()
    return Response(output.getvalue(), media_type='application/zip', headers={'Content-Disposition': 'attachment; filename="slipsnap-backup.zip"', 'Cache-Control': 'no-store'})

def read_backup(content):
    try:
        with ZipFile(io.BytesIO(content)) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if len(names) != len(set(names)) or len(names) > 5001 or sum(e.file_size for e in entries) > LIMIT:
                raise ValueError()
            backup = Backup.model_validate_json(archive.read('data.json'))
            if backup.version != 1:
                raise ValueError()
            cats = {c.id for c in backup.categories}
            receipt_ids = {r.id for r in backup.receipts}
            if len(cats) != len(backup.categories) or len(receipt_ids) != len(backup.receipts):
                raise ValueError()
            if len({c.name for c in backup.categories}) != len(cats) or len({b.month for b in backup.budgets}) != len(backup.budgets):
                raise ValueError()
            refs = [t.reference_code for t in backup.transactions if t.reference_code]
            if len(refs) != len(set(refs)):
                raise ValueError()
            for item in backup.transactions:
                if item.category_id not in cats or (item.receipt_id and item.receipt_id not in receipt_ids):
                    raise ValueError()
            for budget in backup.budgets:
                date.fromisoformat(budget.month + '-01')
                if any(a.category_id not in cats for a in budget.categories):
                    raise ValueError()
            if set(names) != {'data.json', *['receipts/' + r.id for r in backup.receipts]}:
                raise ValueError()
            blobs = {}
            for receipt in backup.receipts:
                data = archive.read('receipts/' + receipt.id)
                signature = {'image/png': b'\x89PNG\r\n\x1a\n', 'image/jpeg': b'\xff\xd8\xff', 'application/pdf': b'%PDF-'}[receipt.content_type]
                if len(data) > 10 * 1024 * 1024 or not data.startswith(signature):
                    raise ValueError()
                blobs[receipt.id] = data
            return backup, blobs
    except (BadZipFile, KeyError, ValueError, ValidationError, RuntimeError, NotImplementedError, OSError):
        raise HTTPException(422, 'Invalid, incomplete, or oversized SlipSnap backup. No data was changed.')

@router.post('/restore')
async def restore(file: UploadFile = File(...), password: str = Form(...), code: str = Form(''), confirmation: str = Form(...),
                  user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    try:
        auth = Confirmation(password=password, code=code, confirmation=confirmation)
    except ValidationError:
        raise HTTPException(422, 'Invalid confirmation details.')
    await reauthenticate(db, user, auth.password, auth.code)
    if confirmation != 'RESTORE':
        raise HTTPException(422, 'Type RESTORE to replace your financial data.')
    content = await file.read(LIMIT + 1)
    if len(content) > LIMIT:
        raise HTTPException(413, 'Backup files must be under 50 MB.')
    backup, blobs = read_backup(content)
    new_paths = []
    try:
        old_paths = await erase_financial_data(db, user)
        cats, receipts = {}, {}
        for item in backup.categories:
            row = Category(id=str(uuid4()), user_id=user.id, name=item.name, color=item.color)
            cats[item.id] = row.id
            db.add(row)
        for item in backup.receipts:
            storage_name = str(uuid4()) + {'image/png': '.png', 'image/jpeg': '.jpg', 'application/pdf': '.pdf'}[item.content_type]
            path = receipt_path(storage_name)
            new_paths.append(path)
            path.write_bytes(blobs[item.id])
            row = Receipt(id=str(uuid4()), user_id=user.id, storage_name=storage_name, filename=item.filename, content_type=item.content_type, raw_text=item.raw_text)
            receipts[item.id] = row.id
            db.add(row)
        await db.flush()
        for item in backup.transactions:
            values = item.model_dump(exclude={'id', 'category_id', 'receipt_id', 'line_items'})
            db.add(Transaction(user_id=user.id, **values, category_id=cats[item.category_id], receipt_id=receipts.get(item.receipt_id),
                line_items=[{'name': line.name, 'amount': str(line.amount)} for line in item.line_items]))
        for item in backup.budgets:
            budget = MonthlyBudget(user_id=user.id, month=item.month, amount=item.amount)
            db.add(budget)
            await db.flush()
            db.add_all([CategoryBudget(monthly_budget_id=budget.id, category_id=cats[a.category_id], amount=a.amount) for a in item.categories])
        await db.commit()
    except Exception:
        await db.rollback()
        remove_files(new_paths)
        raise
    failed = remove_files(old_paths)
    return {'message': 'Financial data restored. Your login and security settings are unchanged.', 'files_pending_cleanup': failed}

@router.post('/delete')
async def delete_account(data: Confirmation, response: Response, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await reauthenticate(db, user, data.password, data.code)
    if data.confirmation != 'DELETE':
        raise HTTPException(422, 'Type DELETE to permanently delete your account.')
    paths = await erase_financial_data(db, user)
    for model in [ActionToken, RecoveryCode, RefreshSession]:
        await db.execute(delete(model).where(model.user_id == user.id))
    await db.delete(user)
    await db.commit()
    failed = remove_files(paths)
    response.delete_cookie('slipsnap_refresh', path='/api/auth', secure=settings.cookie_secure, httponly=True, samesite='strict')
    return {'message': 'Account deleted permanently.', 'files_pending_cleanup': failed}
