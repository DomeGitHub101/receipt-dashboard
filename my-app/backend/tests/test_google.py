import time
import pyotp
from app.config import settings
from test_app import client, register
from test_account import PASSWORD, session_header, login

def mock_google(monkeypatch, issued_at=None):
    # Credentials look like "fake-google-token:<sub>:<email>"; signature checking is Google's library's job.
    def verify(credential, request, audience, clock_skew_in_seconds=0):
        assert audience == 'client-id.apps.googleusercontent.com'
        prefix, sub, email = credential.split(':')
        if prefix != 'fake-google-token':
            raise ValueError('bad token')
        return {'sub': sub, 'email': email, 'email_verified': True, 'name': 'Google Person', 'iat': issued_at or time.time()}
    monkeypatch.setattr(settings, 'google_client_id', 'client-id.apps.googleusercontent.com')
    monkeypatch.setattr('app.account_security.id_token.verify_oauth2_token', verify)

def google(sub='sub-1', email='person@gmail.com'):
    return f'fake-google-token:{sub}:{email}'

def test_google_disabled_without_client_id(client, monkeypatch):
    monkeypatch.setattr(settings, 'google_client_id', '')
    assert client.get('/api/auth/options').json()['google_client_id'] is None
    assert client.post('/api/auth/google', json={'credential': google()}).status_code == 503

def test_google_sign_up_sign_in_and_reauth(client, monkeypatch):
    mock_google(monkeypatch)
    assert client.get('/api/auth/options').json()['google_client_id'] == settings.google_client_id
    assert client.post('/api/auth/google', json={'credential': 'not-a-valid-google-token'}).status_code == 401
    first = client.post('/api/auth/google', json={'credential': google()})
    auth = session_header(first)
    assert first.json()['user']['name'] == 'Google Person'
    assert len(client.get('/api/categories', headers=auth).json()) == 8
    status = client.get('/api/account/security', headers=auth).json()
    assert status['email_verified'] and status['google_linked'] and not status['has_password']
    # Same Google identity signs into the same account; password login explains the method.
    again = session_header(client.post('/api/auth/google', json={'credential': google()}))
    assert client.get('/api/auth/me', headers=again).json()['id'] == first.json()['user']['id']
    assert 'Google' in login(client, email='person@gmail.com').json()['detail']
    # Sensitive actions accept only a fresh credential from the linked Google account.
    assert client.post('/api/account/export', headers=again, json={'google_credential': google('other', 'person@gmail.com')}).status_code == 401
    assert client.post('/api/account/google/unlink', headers=again, json={'google_credential': google()}).status_code == 409
    mock_google(monkeypatch, issued_at=time.time() - 3600)
    assert client.post('/api/account/export', headers=again, json={'google_credential': google()}).status_code == 401
    mock_google(monkeypatch)
    assert client.post('/api/account/export', headers=again, json={'google_credential': google()}).status_code == 200
    # Setting a password enables email login and then allows disconnecting Google.
    new_auth = session_header(client.post('/api/account/password', headers=again, json={'google_credential': google(), 'new_password': 'my-new-password-1'}))
    assert login(client, email='person@gmail.com', password='my-new-password-1').status_code == 200
    assert client.post('/api/account/google/unlink', headers=new_auth, json={'password': 'my-new-password-1'}).status_code == 200
    assert client.get('/api/account/security', headers=new_auth).json()['google_linked'] is False

def test_google_links_existing_account_and_2fa(client, monkeypatch):
    mock_google(monkeypatch)
    auth = register(client)
    link = {'password': PASSWORD, 'link_credential': google('sub-9', 'first@example.com')}
    assert client.post('/api/account/google/link', headers=auth, json={**link, 'password': 'wrong-password'}).status_code == 401
    assert client.post('/api/account/google/link', headers=auth, json=link).status_code == 200
    status = client.get('/api/account/security', headers=auth).json()
    assert status['google_linked'] and status['has_password'] and status['email_verified']
    # A second account cannot claim the same Google identity.
    other = register(client, 'second@example.com')
    assert client.post('/api/account/google/link', headers=other, json={**link, 'password': PASSWORD}).status_code == 409
    secret = client.post('/api/account/2fa/setup', headers=auth, json={'password': PASSWORD}).json()['secret']
    auth = session_header(client.post('/api/account/2fa/enable', headers=auth, json={'password': PASSWORD, 'code': pyotp.TOTP(secret).now()}))
    blocked = client.post('/api/auth/google', json={'credential': google('sub-9', 'first@example.com')})
    assert blocked.status_code == 401 and blocked.headers['x-two-factor'] == 'required'
    assert client.post('/api/auth/google', json={'credential': google('sub-9', 'first@example.com'), 'code': '000000'}).status_code == 401
    # The next time step is still accepted and has not been used by enable.
    code = pyotp.TOTP(secret).at(time.time() + 30)
    session_header(client.post('/api/auth/google', json={'credential': google('sub-9', 'first@example.com'), 'code': code}))

def test_google_takes_over_unverified_password_account(client, monkeypatch):
    mock_google(monkeypatch)
    squatter = register(client, 'victim@gmail.com')
    result = client.post('/api/auth/google', json={'credential': google('victim-sub', 'victim@gmail.com')})
    session_header(result)
    assert client.get('/api/auth/me', headers=squatter).status_code == 401
    assert login(client, email='victim@gmail.com').status_code == 401
