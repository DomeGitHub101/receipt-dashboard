"""Security primitives shared by sign-in and account management."""
import base64
import hashlib
import secrets
import smtplib
import ssl
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import bcrypt
import pyotp
from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy import delete, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from starlette.concurrency import run_in_threadpool
from .config import settings
from .models import User, AuthLimit, RecoveryCode, ActionToken

def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def cipher():
    # Domain-separated encryption key; preserve SECRET_KEY when moving installations.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(('slipsnap:totp:' + settings.secret_key).encode()).digest()))

async def throttle(db, key, limit=10, seconds=900):
    bucket = int(time.time()) // seconds
    token = digest(f'{key}:{bucket}')
    await db.execute(delete(AuthLimit).where(AuthLimit.expires_at < now()))
    insert = pg_insert if db.bind.dialect.name == 'postgresql' else sqlite_insert
    stmt = insert(AuthLimit).values(key=token, count=1, expires_at=now() + timedelta(seconds=seconds))
    count = (await db.execute(stmt.on_conflict_do_update(index_elements=['key'], set_={'count': AuthLimit.count + 1}).returning(AuthLimit.count))).scalar_one()
    await db.commit()
    if count > limit:
        raise HTTPException(429, 'Too many attempts. Please try again in 15 minutes.', headers={'Retry-After': str(seconds)})

async def verify_password(user, password):
    hashed = user.password_hash.encode() if user else b'$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMKuFM6DtdROCe.Wkt/H8W8a8W'
    valid = await run_in_threadpool(bcrypt.checkpw, password.encode(), hashed)
    if not user or not valid:
        raise HTTPException(401, 'Email or password is incorrect.')

async def password_hash(password):
    return (await run_in_threadpool(bcrypt.hashpw, password.encode(), bcrypt.gensalt())).decode()

async def verify_factor(db, user, code):
    if not user.totp_secret:
        return
    secret = cipher().decrypt(user.totp_secret.encode()).decode()
    step = int(time.time()) // 30
    for candidate in [step - 1, step, step + 1]:
        if secrets.compare_digest(pyotp.TOTP(secret).at(candidate * 30), code):
            changed = await db.execute(update(User).where(User.id == user.id, User.totp_last_step < candidate)
                .values(totp_last_step=candidate).execution_options(synchronize_session=False))
            if changed.rowcount:
                return
            break
    recovered = await db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id, RecoveryCode.digest == digest(code)).returning(RecoveryCode.digest))
    if recovered.scalar_one_or_none():
        return
    raise HTTPException(401, 'Enter a valid authenticator code or an unused recovery code. If you just used a code, wait for the next one.')

async def reauthenticate(db, user, password, code):
    await throttle(db, 'reauth:' + user.id)
    await verify_password(user, password)
    await verify_factor(db, user, code)

def mail_ready():
    return bool(settings.smtp_host and settings.smtp_from)

def send_mail(address, subject, body):
    message = EmailMessage()
    message['From'], message['To'], message['Subject'] = settings.smtp_from, address, subject
    message.set_content(body)
    client = smtplib.SMTP_SSL if settings.smtp_ssl else smtplib.SMTP
    kwargs = {'context': ssl.create_default_context()} if settings.smtp_ssl else {}
    with client(settings.smtp_host, settings.smtp_port, timeout=15, **kwargs) as smtp:
        if settings.smtp_starttls and not settings.smtp_ssl:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)

async def email_token(db, user, purpose):
    if not mail_ready():
        raise HTTPException(503, 'Email delivery is not configured. Contact the site administrator.')
    token = secrets.token_urlsafe(32)
    await db.execute(delete(ActionToken).where(ActionToken.user_id == user.id, ActionToken.purpose == purpose))
    db.add(ActionToken(digest=digest(token), user_id=user.id, purpose=purpose,
        expires_at=now() + timedelta(minutes=30 if purpose == 'reset' else 1440)))
    await db.commit()
    link = settings.public_url.rstrip('/') + '/#' + purpose + '=' + token
    try:
        await run_in_threadpool(send_mail, user.email, 'SlipSnap: ' + ('Reset password' if purpose == 'reset' else 'Verify email'),
            f'Open this link to {"reset your password" if purpose == "reset" else "verify your email"}:\n\n{link}\n\nThis link expires in {"30 minutes" if purpose == "reset" else "24 hours"} and can only be used once.\nIf you did not request this, ignore this email.')
    except (OSError, smtplib.SMTPException):
        await db.execute(delete(ActionToken).where(ActionToken.digest == digest(token)))
        await db.commit()
        raise HTTPException(503, 'Email could not be delivered. Please try again later.')

async def consume_token(db, token, purpose):
    row = (await db.execute(delete(ActionToken).where(ActionToken.digest == digest(token), ActionToken.purpose == purpose,
        ActionToken.expires_at > now()).returning(ActionToken.user_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(400, 'This link is invalid, expired, or already used. Request a new link.')
    return await db.get(User, row)
