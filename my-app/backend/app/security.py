from datetime import datetime, timedelta, timezone
from uuid import uuid4
import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from .config import settings
from .db import get_db
from .models import User, RefreshSession

bearer = HTTPBearer(auto_error=False)

def encode(user_id, kind, lifetime, session_id):
    now = datetime.now(timezone.utc)
    return jwt.encode({'sub': user_id, 'type': kind, 'sid': session_id,
                       'iat': now, 'exp': now + lifetime}, settings.secret_key, algorithm='HS256')

def decode(token, kind):
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=['HS256'],
                          options={'require': ['exp', 'iat', 'sub', 'sid', 'type']})
        if data['type'] != kind:
            raise ValueError()
        return data
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise HTTPException(401, 'Session expired. Please sign in again.')

async def current_user(auth: HTTPAuthorizationCredentials | None = Depends(bearer), db: AsyncSession = Depends(get_db)):
    if not auth:
        raise HTTPException(401, 'Please sign in')
    claims = decode(auth.credentials, 'access')
    session = await db.get(RefreshSession, claims['sid'])
    user = await db.get(User, claims['sub'])
    if not session or not user or session.user_id != user.id or session.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(401, 'Session expired. Please sign in again.')
    return user

def check_origin(request: Request):
    # Cookie-authenticated endpoints accept only our frontend origin.
    if request.headers.get('origin') not in {settings.allowed_origin, 'http://127.0.0.1:5173', *settings.additional_origins}:
        raise HTTPException(403, 'Untrusted origin')

async def issue_session(user, db, response):
    sid = str(uuid4())
    lifetime = timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshSession(id=sid, user_id=user.id, expires_at=(datetime.now(timezone.utc) + lifetime).replace(tzinfo=None)))
    await db.commit()
    response.set_cookie('slipsnap_refresh', encode(user.id, 'refresh', lifetime, sid),
                        httponly=True, secure=settings.cookie_secure, samesite='strict', path='/api/auth', max_age=int(lifetime.total_seconds()))
    return {'access_token': encode(user.id, 'access', timedelta(minutes=settings.access_token_expire_minutes), sid),
            'user': {'id': user.id, 'name': user.name, 'email': user.email}}
