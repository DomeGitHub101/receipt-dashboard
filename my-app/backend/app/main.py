import calendar
import csv
import io
import re
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4
import bcrypt
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select, delete, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from openpyxl import Workbook
from .config import settings
from .db import get_db
from .models import User, Category, Transaction, Receipt, RefreshSession, MonthlyBudget, CategoryBudget
from .schemas import Register, Credentials, CategoryInput, TransactionInput, BudgetInput
from .security import current_user, issue_session, decode, check_origin
from .ocr import read_receipt
from .parser import parse_receipt
from .account_security import throttle, verify_password, verify_factor
from .account import router as account_router
from .account_data import router as account_data_router

app = FastAPI(title='SlipSnap API', version='1.0.0')
app.include_router(account_router)
app.include_router(account_data_router)

@app.middleware('http')
async def privacy_headers(request, call_next):
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
app.add_middleware(CORSMiddleware, allow_origins=[settings.allowed_origin, 'http://127.0.0.1:5173', *settings.additional_origins],
                   allow_credentials=True, allow_methods=['GET', 'POST', 'PUT', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])
DEFAULTS = [('Food & drinks', '#00704a'), ('Transport', '#c79254'), ('Shopping', '#8ba99a'),
            ('Bills & utilities', '#90735c'), ('Health', '#b1bf84'), ('Entertainment', '#dbb6a0'), ('Salary', '#466c67'), ('Other', '#a5a59a')]

@app.get('/api/health')
async def health():
    return {'status': 'ok'}

@app.post('/api/auth/register', status_code=201)
async def register(data: Register, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    await throttle(db, 'register:' + request.client.host, 20)
    user = User(email=str(data.email).lower(), name=data.name.strip() or 'Friend',
                password_hash=(await run_in_threadpool(bcrypt.hashpw, data.password.encode(), bcrypt.gensalt())).decode())
    db.add(user)
    try:
        await db.flush()
        db.add_all([Category(user_id=user.id, name=name, color=color) for name, color in DEFAULTS])
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, 'An account with this email already exists.')
    if settings.require_verified_email:
        raise HTTPException(403, 'Account created. Request a verification link below before signing in.')
    return await issue_session(user, db, response)

@app.post('/api/auth/login')
async def login(data: Credentials, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    await throttle(db, 'login-ip:' + request.client.host, 50)
    await throttle(db, 'login-email:' + str(data.email).lower(), 10)
    user = await db.scalar(select(User).where(User.email == str(data.email).lower()))
    await verify_password(user, data.password)
    await verify_factor(db, user, data.code)
    if settings.require_verified_email and not user.email_verified:
        raise HTTPException(403, 'Verify your email before signing in. Use the verification link option on this page.')
    return await issue_session(user, db, response)

@app.post('/api/auth/refresh', dependencies=[Depends(check_origin)])
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    claims = decode(request.cookies.get('slipsnap_refresh', ''), 'refresh')
    # Atomic consumption prevents two requests from reusing one refresh token.
    result = await db.execute(delete(RefreshSession).where(RefreshSession.id == claims['sid'],
                             RefreshSession.user_id == claims['sub'], RefreshSession.expires_at > datetime.now(timezone.utc).replace(tzinfo=None)).returning(RefreshSession.user_id))
    user_id = result.scalar_one_or_none()
    if not user_id:
        raise HTTPException(401, 'Session expired. Please sign in again.')
    user = await db.get(User, user_id)
    return await issue_session(user, db, response)

@app.post('/api/auth/logout', dependencies=[Depends(check_origin)])
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        claims = decode(request.cookies.get('slipsnap_refresh', ''), 'refresh')
        await db.execute(delete(RefreshSession).where(RefreshSession.id == claims['sid']))
        await db.commit()
    except HTTPException:
        pass
    response.delete_cookie('slipsnap_refresh', path='/api/auth', secure=settings.cookie_secure, httponly=True, samesite='strict')
    return {'ok': True}

@app.get('/api/auth/me')
async def me(user: User = Depends(current_user)):
    return {'id': user.id, 'name': user.name, 'email': user.email}

async def owned(db, model, row_id, user):
    row = await db.get(model, row_id)
    if not row or row.user_id != user.id:
        raise HTTPException(404, 'Record not found.')
    return row

@app.get('/api/categories')
async def categories(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return (await db.scalars(select(Category).where(Category.user_id == user.id).order_by(Category.name))).all()

@app.post('/api/categories', status_code=201)
async def add_category(data: CategoryInput, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    category = Category(user_id=user.id, **data.model_dump())
    db.add(category)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, 'This category already exists.')
    return category

@app.put('/api/categories/{category_id}')
async def edit_category(category_id: str, data: CategoryInput, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    category = await owned(db, Category, category_id, user)
    category.name, category.color = data.name, data.color
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, 'This category already exists.')
    return category

@app.delete('/api/categories/{category_id}', status_code=204)
async def remove_category(category_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    category = await owned(db, Category, category_id, user)
    if await db.scalar(select(func.count()).select_from(Transaction).where(Transaction.category_id == category_id)):
        raise HTTPException(409, 'Move transactions to another category before deleting this one.')
    if await db.scalar(select(func.count()).select_from(CategoryBudget).where(CategoryBudget.category_id == category_id)):
        raise HTTPException(409, 'Remove this category from your budgets before deleting it.')
    await db.delete(category)
    await db.commit()

def month_range(month: str):
    try:
        first = date.fromisoformat(month + '-01')
    except ValueError:
        raise HTTPException(422, 'Invalid month.')
    return first, first.replace(day=calendar.monthrange(first.year, first.month)[1])

async def budget_response(month, user, db):
    first, end = month_range(month)
    budget = await db.scalar(select(MonthlyBudget).where(MonthlyBudget.user_id == user.id, MonthlyBudget.month == month))
    categories = (await db.scalars(select(Category).where(Category.user_id == user.id).order_by(Category.name))).all()
    spent_rows = (await db.execute(
        select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.user_id == user.id, Transaction.kind == 'expense', Transaction.date >= first, Transaction.date <= end)
        .group_by(Transaction.category_id)
    )).all()
    spent = {category_id: amount for category_id, amount in spent_rows}
    allocations = {}
    if budget:
        allocations = {row.category_id: row.amount for row in (await db.scalars(
            select(CategoryBudget).where(CategoryBudget.monthly_budget_id == budget.id)
        )).all()}
    total_spent = sum(spent.values(), Decimal(0))
    amount = budget.amount if budget else Decimal(0)
    return {
        'month': month, 'amount': amount, 'spent': total_spent, 'remaining': amount - total_spent,
        'categories': [
            {'category_id': category.id, 'name': category.name, 'color': category.color,
             'amount': allocations.get(category.id, Decimal(0)), 'spent': spent.get(category.id, Decimal(0)),
             'remaining': allocations.get(category.id, Decimal(0)) - spent.get(category.id, Decimal(0))}
            for category in categories
        ],
    }

@app.get('/api/budgets/{month}')
async def get_budget(month: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await budget_response(month, user, db)

@app.put('/api/budgets/{month}')
async def save_budget(month: str, data: BudgetInput, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    month_range(month)
    owned_categories = set((await db.scalars(select(Category.id).where(Category.user_id == user.id))).all())
    if any(item.category_id not in owned_categories for item in data.categories):
        raise HTTPException(404, 'Category not found.')
    budget = await db.scalar(select(MonthlyBudget).where(MonthlyBudget.user_id == user.id, MonthlyBudget.month == month))
    if not budget:
        budget = MonthlyBudget(user_id=user.id, month=month, amount=data.amount)
        db.add(budget)
        await db.flush()
    else:
        budget.amount = data.amount
        await db.execute(delete(CategoryBudget).where(CategoryBudget.monthly_budget_id == budget.id))
    db.add_all([CategoryBudget(monthly_budget_id=budget.id, category_id=item.category_id, amount=item.amount) for item in data.categories])
    await db.commit()
    return await budget_response(month, user, db)

def filters(query, user, start=None, end=None, category_id=None, merchant=None, minimum=None, maximum=None, kind=None):
    query = query.where(Transaction.user_id == user.id)
    if start: query = query.where(Transaction.date >= start)
    if end: query = query.where(Transaction.date <= end)
    if category_id: query = query.where(Transaction.category_id == category_id)
    if merchant: query = query.where(or_(Transaction.merchant.icontains(merchant, autoescape=True), Transaction.reference_code.icontains(merchant, autoescape=True)))
    if minimum is not None: query = query.where(Transaction.amount >= minimum)
    if maximum is not None: query = query.where(Transaction.amount <= maximum)
    if kind: query = query.where(Transaction.kind == kind)
    return query

@app.get('/api/transactions')
async def transactions(start: date | None = None, end: date | None = None, category_id: str | None = None,
                       merchant: str | None = None, minimum: Decimal | None = Query(None, ge=0), maximum: Decimal | None = Query(None, ge=0),
                       kind: str | None = Query(None, pattern='^(income|expense)$'),
                       user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    query = filters(select(Transaction), user, start, end, category_id, merchant, minimum, maximum, kind)
    return (await db.scalars(query.order_by(Transaction.date.desc(), Transaction.id))).all()

async def validate_transaction(data, user, db):
    await owned(db, Category, data.category_id, user)
    if data.receipt_id:
        await owned(db, Receipt, data.receipt_id, user)
    values = data.model_dump()
    values['line_items'] = [{'name': item.name, 'amount': str(item.amount)} for item in data.line_items]
    return values

@app.post('/api/transactions', status_code=201)
async def add_transaction(data: TransactionInput, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    row = Transaction(user_id=user.id, **await validate_transaction(data, user, db))
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, 'รหัสอ้างอิงนี้ถูกบันทึกแล้ว กรุณาตรวจรายการเดิมก่อนบันทึกซ้ำ')
    return row

@app.put('/api/transactions/{transaction_id}')
async def edit_transaction(transaction_id: str, data: TransactionInput, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    row = await owned(db, Transaction, transaction_id, user)
    for key, value in (await validate_transaction(data, user, db)).items():
        setattr(row, key, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, 'รหัสอ้างอิงนี้ถูกบันทึกแล้ว กรุณาตรวจรายการเดิมก่อนบันทึกซ้ำ')
    return row

@app.delete('/api/transactions/{transaction_id}', status_code=204)
async def remove_transaction(transaction_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    row = await owned(db, Transaction, transaction_id, user)
    await db.delete(row)
    await db.commit()

@app.post('/api/receipts/upload', status_code=201)
async def upload(file: UploadFile = File(...), user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    data = await file.read(10 * 1024 * 1024 + 1)
    await file.close()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, 'Maximum file size is 10 MB.')
    if data.startswith(b'%PDF-'): suffix, mime = '.pdf', 'application/pdf'
    elif data.startswith(b'\x89PNG\r\n\x1a\n'): suffix, mime = '.png', 'image/png'
    elif data.startswith(b'\xff\xd8\xff'): suffix, mime = '.jpg', 'image/jpeg'
    else: raise HTTPException(415, 'Please choose a JPG, PNG or PDF file.')
    storage_name = str(uuid4()) + suffix
    path = settings.upload_dir / storage_name
    path.write_bytes(data)
    try:
        result = await run_in_threadpool(read_receipt, path, suffix == '.pdf')
    except ValueError as error:
        path.unlink(missing_ok=True)
        raise HTTPException(422, str(error))
    except Exception:
        path.unlink(missing_ok=True)
        raise HTTPException(503, 'OCR could not finish. Try a clearer image or add this transaction manually.')
    text = result['text']
    row = Receipt(user_id=user.id, filename=(file.filename or 'bank-slip')[:255], storage_name=storage_name, content_type=mime, raw_text=text)
    db.add(row)
    await db.commit()
    return {'receipt_id': row.id, **parse_receipt(text, result['qr_payloads'])}

@app.get('/api/receipts/{receipt_id}/file')
async def receipt_file(receipt_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    row = await owned(db, Receipt, receipt_id, user)
    return FileResponse(settings.upload_dir / row.storage_name, media_type=row.content_type, filename=row.filename,
                        headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})

@app.get('/api/dashboard/summary')
async def summary(month: str = Query(pattern=r'^\d{4}-\d{2}$'), user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    first, end = month_range(month)
    rows = (await db.scalars(filters(select(Transaction), user, first, end))).all()
    income = sum((r.amount for r in rows if r.kind == 'income'), Decimal(0))
    expense = sum((r.amount for r in rows if r.kind == 'expense'), Decimal(0))
    cats = {c.id: c for c in (await db.scalars(select(Category).where(Category.user_id == user.id))).all()}
    breakdown = []
    for cid, cat in cats.items():
        total = sum((r.amount for r in rows if r.category_id == cid and r.kind == 'expense'), Decimal(0))
        if total:
            breakdown.append({'name': cat.name, 'color': cat.color, 'amount': total})
    daily = [{'day': d, 'income': sum((r.amount for r in rows if r.date.day == d and r.kind == 'income'), Decimal(0)),
              'expense': sum((r.amount for r in rows if r.date.day == d and r.kind == 'expense'), Decimal(0))} for d in range(1, end.day + 1)]
    return {'income': income, 'expense': expense, 'balance': income - expense, 'count': len(rows),
            'receipts': sum(1 for r in rows if r.receipt_id), 'categories': sorted(breakdown, key=lambda b: b['amount'], reverse=True), 'daily': daily}

@app.get('/api/transactions/export/{format}')
async def export(format: str, start: date | None = None, end: date | None = None, category_id: str | None = None,
                 merchant: str | None = None, minimum: Decimal | None = None, maximum: Decimal | None = None, kind: str | None = None,
                 user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if format not in {'csv', 'xlsx'}:
        raise HTTPException(404, 'Use csv or xlsx.')
    rows = (await db.scalars(filters(select(Transaction), user, start, end, category_id, merchant, minimum, maximum, kind).order_by(Transaction.date.desc()))).all()
    cats = {c.id: c.name for c in (await db.scalars(select(Category).where(Category.user_id == user.id))).all()}
    def safe(value):
        return "'" + value if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')) else value
    data = [['Date', 'Description', 'Type', 'Category', 'Amount (THB)', 'Notes', 'Reference code']]
    data.extend([[r.date.isoformat(), safe(r.merchant), r.kind, safe(cats[r.category_id]), float(r.amount), safe(r.notes), safe(r.reference_code or '')] for r in rows])
    if format == 'csv':
        stream = io.StringIO(newline='')
        csv.writer(stream).writerows(data)
        content, mime = stream.getvalue().encode('utf-8-sig'), 'text/csv; charset=utf-8'
    else:
        book = Workbook()
        sheet = book.active
        sheet.title = 'Transactions'
        for row in data: sheet.append(row)
        sheet.freeze_panes = 'A2'
        sheet.auto_filter.ref = sheet.dimensions
        for column in ['A', 'B', 'C', 'D', 'E', 'F', 'G']: sheet.column_dimensions[column].width = 25
        sheet.column_dimensions['G'].width = 38
        for cell in sheet['E'][1:]: cell.number_format = '#,##0.00'
        stream = io.BytesIO()
        book.save(stream)
        content, mime = stream.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    return Response(content, media_type=mime, headers={'Content-Disposition': f'attachment; filename="slipsnap-transactions.{format}"'})
