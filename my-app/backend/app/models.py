from datetime import date as Date, datetime
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import String, ForeignKey, Numeric, JSON, UniqueConstraint
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
