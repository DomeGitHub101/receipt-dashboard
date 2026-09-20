from datetime import date as Date, datetime
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import String, ForeignKey, Numeric, JSON, UniqueConstraint, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

def uid():
    return str(uuid4())

class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(200))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default='0')
    totp_secret: Mapped[str | None] = mapped_column(String(300), nullable=True)
    totp_pending: Mapped[str | None] = mapped_column(String(300), nullable=True)
    totp_pending_expires: Mapped[datetime | None] = mapped_column(nullable=True)
    totp_last_step: Mapped[int] = mapped_column(Integer, default=-1, server_default='-1')

class ActionToken(Base):
    __tablename__ = 'action_tokens'
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    expires_at: Mapped[datetime]

class RecoveryCode(Base):
    __tablename__ = 'recovery_codes'
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)

class AuthLimit(Base):
    __tablename__ = 'auth_limits'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime]

class RefreshSession(Base):
    __tablename__ = 'refresh_sessions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    expires_at: Mapped[datetime]

class Category(Base):
    __tablename__ = 'categories'
    __table_args__ = (UniqueConstraint('user_id', 'name'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    name: Mapped[str] = mapped_column(String(60))
    color: Mapped[str] = mapped_column(String(7), default='#00704a')

class MonthlyBudget(Base):
    __tablename__ = 'monthly_budgets'
    __table_args__ = (UniqueConstraint('user_id', 'month', name='uq_budget_user_month'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    month: Mapped[str] = mapped_column(String(7), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))

class CategoryBudget(Base):
    __tablename__ = 'category_budgets'
    __table_args__ = (UniqueConstraint('monthly_budget_id', 'category_id', name='uq_budget_category'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    monthly_budget_id: Mapped[str] = mapped_column(ForeignKey('monthly_budgets.id'), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey('categories.id'), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))

class Receipt(Base):
    __tablename__ = 'receipts'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    storage_name: Mapped[str] = mapped_column(String(100))
    content_type: Mapped[str] = mapped_column(String(60))
    raw_text: Mapped[str] = mapped_column(default='')

class Transaction(Base):
    __tablename__ = 'transactions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    merchant: Mapped[str] = mapped_column(String(160))
    date: Mapped[Date] = mapped_column(index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    kind: Mapped[str] = mapped_column(String(10))
    category_id: Mapped[str] = mapped_column(ForeignKey('categories.id'))
    receipt_id: Mapped[str | None] = mapped_column(ForeignKey('receipts.id'), nullable=True)
    notes: Mapped[str] = mapped_column(String(2000), default='')
    line_items: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(20), default='manual', server_default='manual')
    reference_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    __table_args__ = (UniqueConstraint('user_id', 'reference_code', name='uq_transaction_user_reference'),)
