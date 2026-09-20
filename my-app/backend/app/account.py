from datetime import timedelta
import secrets
import time
import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, Response, BackgroundTasks
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from .config import settings
from .db import get_db
from .models import User, RefreshSession, ActionToken, RecoveryCode
from .schemas import Credentials
from .security import current_user, issue_session
from .account_security import (now, digest, cipher, throttle, reauthenticate, password_hash,
    verify_factor, email_token, consume_token, mail_ready)

router = APIRouter(prefix='/api')

async def deliver_link(engine, email, purpose):
    # Send after the uniform response so delivery latency cannot enumerate accounts.
    async with AsyncSession(engine, expire_on_commit=False) as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user and (purpose == 'reset' or not user.email_verified):
            try:
                await email_token(db, user, purpose)
            except HTTPException:
                pass

class EmailInput(BaseModel):
    email: EmailStr

class Confirmation(BaseModel):
    password: str = Field(min_length=8, max_length=72)
    code: str = Field(default='', max_length=80)
    confirmation: str = Field(default='', max_length=100)

    @field_validator('password')
    @classmethod
    def password_bytes(cls, value):
        return Credentials.password_bytes(value)

class ChangePassword(Confirmation):
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator('new_password')
    @classmethod
    def new_password_bytes(cls, value):
        return Credentials.password_bytes(value)

class TokenInput(BaseModel):
    token: str = Field(min_length=20, max_length=100)

class ResetPassword(TokenInput):
    new_password: str = Field(min_length=8, max_length=72)
    code: str = Field(default='', max_length=80)

    @field_validator('new_password')
    @classmethod
    def new_password_bytes(cls, value):
        return Credentials.password_bytes(value)

@router.get('/account/security')
async def status(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    count = await db.scalar(select(func.count()).select_from(RecoveryCode).where(RecoveryCode.user_id == user.id))
    return {'email': user.email, 'email_verified': user.email_verified, 'two_factor_enabled': bool(user.totp_secret),
        'recovery_codes_remaining': count, 'email_delivery_configured': mail_ready()}

@router.post('/account/password')
async def change_password(data: ChangePassword, response: Response, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await reauthenticate(db, user, data.password, data.code)
    user.password_hash = await password_hash(data.new_password)
    await db.execute(delete(RefreshSession).where(RefreshSession.user_id == user.id))
    await db.execute(delete(ActionToken).where(ActionToken.user_id == user.id, ActionToken.purpose == 'reset'))
    return await issue_session(user, db, response)

@router.post('/auth/forgot-password')
async def forgot(data: EmailInput, request: Request, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    await throttle(db, 'mail-ip:' + request.client.host, 20)
    await throttle(db, 'mail-email:' + str(data.email).lower(), 3)
    if not mail_ready():
        raise HTTPException(503, 'Email delivery is not configured. Contact the site administrator.')
    background.add_task(deliver_link, db.bind, str(data.email).lower(), 'reset')
    return {'message': 'If an account exists, a password reset link will be emailed to you.'}

@router.post('/auth/reset-password')
async def reset(data: ResetPassword, request: Request, db: AsyncSession = Depends(get_db)):
    await throttle(db, 'reset-ip:' + request.client.host)
    user = await consume_token(db, data.token, 'reset')
    await verify_factor(db, user, data.code)
    user.password_hash = await password_hash(data.new_password)
    await db.execute(delete(RefreshSession).where(RefreshSession.user_id == user.id))
    await db.execute(delete(ActionToken).where(ActionToken.user_id == user.id, ActionToken.purpose == 'reset'))
    await db.commit()
    return {'message': 'Password reset. Please sign in with your new password.'}

@router.post('/auth/request-verification')
async def request_verification(data: EmailInput, request: Request, background: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    await throttle(db, 'verify-ip:' + request.client.host, 20)
    await throttle(db, 'verify-email:' + str(data.email).lower(), 3)
    if not mail_ready():
        raise HTTPException(503, 'Email delivery is not configured. Contact the site administrator.')
    background.add_task(deliver_link, db.bind, str(data.email).lower(), 'verify')
    return {'message': 'If the account needs verification, a verification link will be emailed to you.'}

@router.post('/auth/verify-email')
async def verify_email(data: TokenInput, request: Request, db: AsyncSession = Depends(get_db)):
    await throttle(db, 'verify-token:' + request.client.host, 20)
    user = await consume_token(db, data.token, 'verify')
    user.email_verified = True
    await db.commit()
    return {'message': 'Email verified. You can now sign in.'}

@router.post('/account/2fa/setup')
async def setup(data: Confirmation, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await reauthenticate(db, user, data.password, data.code)
    if user.totp_secret:
        raise HTTPException(409, 'Two-factor authentication is already enabled.')
    secret = pyotp.random_base32()
    user.totp_pending = cipher().encrypt(secret.encode()).decode()
    user.totp_pending_expires = now() + timedelta(minutes=10)
    await db.commit()
    return {'secret': secret, 'uri': pyotp.TOTP(secret).provisioning_uri(user.email, issuer_name='SlipSnap')}

@router.post('/account/2fa/enable')
async def enable(data: Confirmation, response: Response, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await reauthenticate(db, user, data.password, '')
    if user.totp_secret or not user.totp_pending or not user.totp_pending_expires or user.totp_pending_expires < now():
        raise HTTPException(400, 'Start two-factor setup again.')
    secret = cipher().decrypt(user.totp_pending.encode()).decode()
    if not pyotp.TOTP(secret).verify(data.code):
        raise HTTPException(400, 'Authenticator code is incorrect.')
    user.totp_secret, user.totp_pending, user.totp_pending_expires = user.totp_pending, None, None
    user.totp_last_step = int(time.time()) // 30
    codes = [secrets.token_hex(8) for _ in range(10)]
    await db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id))
    db.add_all([RecoveryCode(user_id=user.id, digest=digest(code)) for code in codes])
    await db.execute(delete(RefreshSession).where(RefreshSession.user_id == user.id))
    session = await issue_session(user, db, response)
    return {**session, 'recovery_codes': codes}

@router.post('/account/2fa/disable')
async def disable(data: Confirmation, response: Response, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await reauthenticate(db, user, data.password, data.code)
    user.totp_secret, user.totp_pending, user.totp_pending_expires, user.totp_last_step = None, None, None, -1
    await db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id))
    await db.execute(delete(RefreshSession).where(RefreshSession.user_id == user.id))
    return await issue_session(user, db, response)
