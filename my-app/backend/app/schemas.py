from datetime import date as Date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator('password')
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode()) > 72:
            raise ValueError('Password must be at most 72 UTF-8 bytes')
        return value

class Register(Credentials):
    name: str = Field(min_length=1, max_length=80)

class CategoryInput(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(pattern=r'^#[0-9a-fA-F]{6}$', default='#00704a')

    @field_validator('name')
    @classmethod
    def clean(cls, value):
        if not value.strip():
            raise ValueError('Name is required')
        return value.strip()

class LineItem(BaseModel):
    name: str = Field(max_length=200)
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)

class TransactionInput(BaseModel):
    merchant: str = Field(min_length=1, max_length=160)
    date: Date
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    kind: Literal['income', 'expense'] = 'expense'
    category_id: str
    receipt_id: str | None = None
    notes: str = Field(default='', max_length=2000)
    line_items: list[LineItem] = Field(default_factory=list, max_length=200)

    @field_validator('merchant')
    @classmethod
    def clean(cls, value):
        if not value.strip():
            raise ValueError('Merchant is required')
        return value.strip()
