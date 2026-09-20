import io
import json
import re
import asyncio
from datetime import timedelta
from zipfile import ZipFile, ZIP_DEFLATED
import pyotp
from sqlalchemy import select, update
from app.models import User, ActionToken
from app.db import get_db
from app.main import app
from app.config import settings
from app.account_security import now
from test_app import client, register, transaction

PASSWORD = 'correct-horse-42'

def session_header(response):
    assert response.status_code == 200, response.text
    return {'Authorization': 'Bearer ' + response.json()['access_token']}

def login(client, email='first@example.com', password=PASSWORD, code=''):
    return client.post('/api/auth/login', json={'email': email, 'password': password, 'code': code})

def test_change_password_revokes_sessions(client):
    auth = register(client)
    second_session = session_header(login(client))
    assert client.post('/api/account/password', headers=auth, json={'password': 'incorrect-pass', 'new_password': 'new-password-42'}).status_code == 401
    response = client.post('/api/account/password', headers=auth, json={'password': PASSWORD, 'new_password': 'new-password-42'})
    new_auth = session_header(response)
    assert client.get('/api/auth/me', headers=auth).status_code == 401
    assert client.get('/api/auth/me', headers=second_session).status_code == 401
    assert client.get('/api/auth/me', headers=new_auth).status_code == 200
    assert login(client).status_code == 401
    assert login(client, password='new-password-42').status_code == 200

def mock_mail(monkeypatch):
    sent = []
    monkeypatch.setattr(settings, 'smtp_host', 'test.local')
    monkeypatch.setattr(settings, 'smtp_from', 'test@example.com')
    monkeypatch.setattr('app.account_security.send_mail', lambda *args: sent.append(args))
    return sent

def token_from(sent, purpose):
    return re.search(r'#' + purpose + r'=([A-Za-z0-9_-]+)', sent[-1][2])[1]

def test_email_links_single_use_expiry_and_no_enumeration(client, monkeypatch):
    auth = register(client)
    sent = mock_mail(monkeypatch)
    result = client.post('/api/auth/forgot-password', json={'email': 'first@example.com'})
    missing = client.post('/api/auth/forgot-password', json={'email': 'missing@example.com'})
    assert result.json() == missing.json()
    assert len(sent) == 1
    token = token_from(sent, 'reset')
    assert client.post('/api/auth/reset-password', json={'token': token, 'new_password': 'reset-password-42'}).status_code == 200
    assert client.post('/api/auth/reset-password', json={'token': token, 'new_password': 'reset-password-43'}).status_code == 400
    assert client.get('/api/auth/me', headers=auth).status_code == 401
    auth = session_header(login(client, password='reset-password-42'))
    client.post('/api/auth/request-verification', json={'email': 'first@example.com'})
    verify = token_from(sent, 'verify')
    assert client.post('/api/auth/verify-email', json={'token': verify}).status_code == 200
    assert client.get('/api/account/security', headers=auth).json()['email_verified'] is True
    assert client.post('/api/auth/verify-email', json={'token': verify}).status_code == 400
    client.post('/api/auth/forgot-password', json={'email': 'first@example.com'})
    expired = token_from(sent, 'reset')
    async def expire():
        async for db in app.dependency_overrides[get_db]():
            await db.execute(update(ActionToken).values(expires_at=now() - timedelta(seconds=1)))
            await db.commit()
    asyncio.run(expire())
    assert client.post('/api/auth/reset-password', json={'token': expired, 'new_password': 'reset-password-44'}).status_code == 400

def test_email_configuration_and_verification_gate(client, monkeypatch):
    monkeypatch.setattr(settings, 'smtp_host', '')
    assert client.post('/api/auth/forgot-password', json={'email': 'first@example.com'}).status_code == 503
    monkeypatch.setattr(settings, 'require_verified_email', True)
    response = client.post('/api/auth/register', json={'name': 'Test', 'email': 'gate@example.com', 'password': PASSWORD})
    assert response.status_code == 403
    assert login(client, email='gate@example.com').status_code == 403
    sent = mock_mail(monkeypatch)
    client.post('/api/auth/request-verification', json={'email': 'gate@example.com'})
    client.post('/api/auth/verify-email', json={'token': token_from(sent, 'verify')})
    assert login(client, email='gate@example.com').status_code == 200

def enable_2fa(client, auth):
    setup = client.post('/api/account/2fa/setup', headers=auth, json={'password': PASSWORD})
    assert setup.status_code == 200, setup.text
    secret = setup.json()['secret']
    enabled = client.post('/api/account/2fa/enable', headers=auth, json={'password': PASSWORD, 'code': pyotp.TOTP(secret).now()})
    return secret, session_header(enabled), enabled.json()['recovery_codes']

def test_2fa_recovery_replay_and_reset_protection(client, monkeypatch):
    old_auth = register(client)
    secret, auth, codes = enable_2fa(client, old_auth)
    assert client.get('/api/auth/me', headers=old_auth).status_code == 401
    assert login(client).status_code == 401
    assert login(client, code=codes[0]).status_code == 200
    assert login(client, code=codes[0]).status_code == 401
    # A setup OTP has already been used, and cannot be replayed.
    assert login(client, code=pyotp.TOTP(secret).now()).status_code == 401
    async def stored():
        async for db in app.dependency_overrides[get_db]():
            user = await db.scalar(select(User))
            return user.totp_secret
    assert secret not in asyncio.run(stored())
    sent = mock_mail(monkeypatch)
    client.post('/api/auth/forgot-password', json={'email': 'first@example.com'})
    token = token_from(sent, 'reset')
    assert client.post('/api/auth/reset-password', json={'token': token, 'new_password': 'changed-password'}).status_code == 401
    disabled = client.post('/api/account/2fa/disable', headers=auth, json={'password': PASSWORD, 'code': codes[1]})
    assert disabled.status_code == 200
    assert login(client).status_code == 200

def test_throttling(client):
    register(client)
    for _ in range(10):
        assert login(client, password='wrong-password').status_code == 401
    result = login(client, password='wrong-password')
    assert result.status_code == 429
    assert result.headers['Retry-After']

def test_backup_restore_delete_isolation_and_atomicity(client, monkeypatch):
    first = register(client)
    from PIL import Image
    original = io.BytesIO()
    Image.new('RGB', (30, 30), 'white').save(original, format='PNG')
    monkeypatch.setattr('app.main.read_receipt', lambda *_: {'text': 'Amount 20.00', 'qr_payloads': []})
    slip = client.post('/api/receipts/upload', headers=first, files={'file': ('private.png', original.getvalue(), 'image/png')}).json()
    row = transaction(client, first, receipt_id=slip['receipt_id']).json()
    client.put('/api/budgets/2026-09', headers=first, json={'amount': '1000', 'categories': [{'category_id': row['category_id'], 'amount': '300'}]})
    exported = client.post('/api/account/export', headers=first, json={'password': PASSWORD})
    assert exported.status_code == 200, exported.text
    with ZipFile(io.BytesIO(exported.content)) as archive:
        data = json.loads(archive.read('data.json'))
        assert data['transactions'][0]['amount'] == '210.50'
        assert data['budgets'][0]['amount'] == '1000.00'
        assert archive.read('receipts/' + slip['receipt_id']) == original.getvalue()
        assert 'password' not in json.dumps(data)
    other = register(client, 'other@example.com')
    transaction(client, other, merchant='Other account only')
    assert client.post('/api/account/restore', headers=first, data={'password': PASSWORD, 'confirmation': 'RESTORE'}, files={'file': ('bad.zip', b'bad')}).status_code == 422
    assert len(client.get('/api/transactions', headers=first).json()) == 1
    transaction(client, first, merchant='After backup')
    restored = client.post('/api/account/restore', headers=first, data={'password': PASSWORD, 'confirmation': 'RESTORE'}, files={'file': ('backup.zip', exported.content)})
    assert restored.status_code == 200, restored.text
    rows = client.get('/api/transactions', headers=first).json()
    assert len(rows) == 1
    assert rows[0]['id'] != row['id']
    assert client.get(f'/api/receipts/{rows[0]["receipt_id"]}/file', headers=first).content == original.getvalue()
    assert float(client.get('/api/budgets/2026-09', headers=first).json()['amount']) == 1000
    assert len(client.get('/api/transactions', headers=other).json()) == 1
    assert client.post('/api/account/delete', headers=first, json={'password': PASSWORD, 'confirmation': ''}).status_code == 422
    deleted = client.post('/api/account/delete', headers=first, json={'password': PASSWORD, 'confirmation': 'DELETE'})
    assert deleted.status_code == 200
    assert deleted.json()['files_pending_cleanup'] == 0
    assert client.get('/api/auth/me', headers=first).status_code == 401
    assert login(client).status_code == 401
    assert len(client.get('/api/transactions', headers=other).json()) == 1
    assert list(settings.upload_dir.glob('*.png')) == []

def test_restore_rejects_path_traversal(client):
    auth = register(client)
    exported = client.post('/api/account/export', headers=auth, json={'password': PASSWORD}).content
    stream = io.BytesIO(exported)
    with ZipFile(stream, 'a', ZIP_DEFLATED) as archive:
        archive.writestr('../escape.txt', 'invalid')
    response = client.post('/api/account/restore', headers=auth, data={'password': PASSWORD, 'confirmation': 'RESTORE'}, files={'file': ('bad.zip', stream.getvalue())})
    assert response.status_code == 422
    assert len(client.get('/api/categories', headers=auth).json()) == 8
