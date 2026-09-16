import asyncio
import io
from datetime import date
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db import Base, get_db
from app.main import app
from app.config import settings
from app.parser import parse_receipt

@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "test.db"}')
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async def init():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    asyncio.run(init())
    async def db():
        async with sessions() as session:
            yield session
    app.dependency_overrides[get_db] = db
    monkeypatch.setattr(settings, 'upload_dir', tmp_path)
    with TestClient(app, headers={'origin': 'http://localhost:5173'}) as c:
        yield c
    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())

def register(client, email='first@example.com'):
    response = client.post('/api/auth/register', json={'name': 'Test Friend', 'email': email, 'password': 'correct-horse-42'})
    assert response.status_code == 201, response.text
    return {'Authorization': f'Bearer {response.json()["access_token"]}'}

def transaction(client, auth, **changes):
    category = client.get('/api/categories', headers=auth).json()[0]
    data = {'merchant': 'Daily Brew', 'date': '2026-09-17', 'amount': '210.50', 'kind': 'expense', 'category_id': category['id']}
    data.update(changes)
    return client.post('/api/transactions', headers=auth, json=data)

def test_auth_rotation_logout_and_validation(client):
    assert client.get('/api/transactions').status_code == 401
    auth = register(client)
    assert client.post('/api/auth/register', json={'name': 'Duplicate', 'email': 'FIRST@example.com', 'password': 'correct-horse-42'}).status_code == 409
    assert client.post('/api/auth/login', json={'email': 'first@example.com', 'password': 'wrong-password'}).status_code == 401
    assert client.post('/api/auth/login', json={'email': 'unknown@example.com', 'password': 'wrong-password'}).status_code == 401
    old_refresh = client.cookies.get('slipsnap_refresh')
    assert client.get('/api/auth/me', headers=auth).json()['name'] == 'Test Friend'
    refreshed = client.post('/api/auth/refresh')
    assert refreshed.status_code == 200
    new_auth = {'Authorization': f'Bearer {refreshed.json()["access_token"]}'}
    assert client.get('/api/auth/me', headers=auth).status_code == 401
    assert client.post('/api/auth/refresh', headers={'origin': 'https://evil.example'}).status_code == 403
    current_cookie = client.cookies.get('slipsnap_refresh')
    client.cookies.clear()
    client.cookies.set('slipsnap_refresh', old_refresh, path='/api/auth')
    assert client.post('/api/auth/refresh').status_code == 401
    client.cookies.clear()
    client.cookies.set('slipsnap_refresh', current_cookie, path='/api/auth')
    assert client.post('/api/auth/logout').status_code == 200
    assert client.get('/api/auth/me', headers=new_auth).status_code == 401
    assert client.post('/api/auth/refresh').status_code == 401

def test_transactions_isolation_filters_totals_exports(client):
    first = register(client)
    created = transaction(client, first)
    assert created.status_code == 201, created.text
    row = created.json()
    assert transaction(client, first, amount='0').status_code == 422
    assert transaction(client, first, merchant='   ').status_code == 422
    assert transaction(client, first, amount='-10').status_code == 422
    assert transaction(client, first, amount='1000', kind='income').status_code == 201
    assert transaction(client, first, date='2026-08-31', amount='99').status_code == 201
    summary = client.get('/api/dashboard/summary?month=2026-09', headers=first).json()
    assert float(summary['expense']) == 210.50
    assert float(summary['income']) == 1000
    assert float(summary['balance']) == 789.50
    assert summary['count'] == 2
    assert len(summary['daily']) == 30
    assert client.get('/api/dashboard/summary?month=2026-13', headers=first).status_code == 422
    filtered = client.get('/api/transactions?merchant=brew&minimum=200&maximum=220&start=2026-09-01&end=2026-09-30&kind=expense', headers=first).json()
    assert len(filtered) == 1
    assert client.get('/api/transactions?merchant=%25', headers=first).json() == []
    second = register(client, 'second@example.com')
    assert client.get('/api/transactions', headers=second).json() == []
    assert client.delete(f'/api/transactions/{row["id"]}', headers=second).status_code == 404
    assert transaction(client, second, category_id=row['category_id']).status_code == 404
    assert client.get('/api/transactions/export/csv', headers=second).text.count('\n') == 1
    assert client.delete(f'/api/categories/{row["category_id"]}', headers=first).status_code == 409
    updated = client.put(f'/api/transactions/{row["id"]}', headers=first, json={**row, 'amount': '220.75'})
    assert updated.status_code == 200
    assert float(updated.json()['amount']) == 220.75
    assert transaction(client, first, merchant='=1+1', notes='@SUM(1)').status_code == 201
    csv = client.get('/api/transactions/export/csv?merchant=%3D1', headers=first)
    assert "'=1+1" in csv.text and "'@SUM(1)" in csv.text
    from openpyxl import load_workbook
    xlsx = client.get('/api/transactions/export/xlsx?merchant=%3D1', headers=first)
    book = load_workbook(io.BytesIO(xlsx.content))
    assert book.active['B2'].value == "'=1+1"
    assert book.active['B2'].data_type == 's'
    assert client.delete(f'/api/transactions/{row["id"]}', headers=first).status_code == 204

def test_categories_and_receipt_access(client, monkeypatch):
    first = register(client)
    cat = client.post('/api/categories', headers=first, json={'name': 'Travel', 'color': '#112233'}).json()
    assert client.post('/api/categories', headers=first, json={'name': 'Travel'}).status_code == 409
    assert client.put(f'/api/categories/{cat["id"]}', headers=first, json={'name': 'Holidays', 'color': '#334455'}).status_code == 200
    assert client.delete(f'/api/categories/{cat["id"]}', headers=first).status_code == 204
    assert client.post('/api/receipts/upload', headers=first, files={'file': ('bad.txt', b'not a receipt', 'text/plain')}).status_code == 415
    assert client.post('/api/receipts/upload', headers=first, files={'file': ('large.png', b'\x89PNG\r\n\x1a\n' + b'0' * (10 * 1024 * 1024), 'image/png')}).status_code == 413
    from PIL import Image
    image = io.BytesIO()
    Image.new('RGB', (100, 100), 'white').save(image, format='PNG')
    monkeypatch.setattr('app.main.read_receipt', lambda *_: 'TEST CAFE\n17/09/2569\nCoffee 80.00\nTOTAL 80.00')
    upload = client.post('/api/receipts/upload', headers=first, files={'file': ('receipt.png', image.getvalue(), 'image/png')})
    assert upload.status_code == 201, upload.text
    receipt = upload.json()
    assert receipt['amount'] == 80
    assert receipt['date'] == '2026-09-17'
    assert client.get(f'/api/receipts/{receipt["receipt_id"]}/file', headers=first).content == image.getvalue()
    second = register(client, 'other@example.com')
    assert client.get(f'/api/receipts/{receipt["receipt_id"]}/file', headers=second).status_code == 404
    assert transaction(client, second, receipt_id=receipt['receipt_id']).status_code == 404

@pytest.mark.parametrize('text,amount,expected_date', [
    ('CAFE\n17/09/2569\nLatte 125.00\nSubtotal 125.00\nVAT 8.75\nGrand Total 133.75\nCash 200.00\nChange 66.25', 133.75, '2026-09-17'),
    ('ร้านกาแฟ\n2026-09-17\nกาแฟ 80.00\nยอดสุทธิ 80.00', 80, '2026-09-17'),
    ('SHOP\n31/02/2026\nPhone 1234567', None, None),
    ('SHOP\n17-09-26\nTOTAL\n1,234.50', 1234.50, '2026-09-17'),
])
def test_parser(text, amount, expected_date):
    result = parse_receipt(text)
    assert result['amount'] == amount
    assert result['date'] == expected_date
