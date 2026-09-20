from datetime import date as Date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    code: str = Field(default='', max_length=80)

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

class CategoryBudgetInput(BaseModel):
    category_id: str
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)

class BudgetInput(BaseModel):
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    categories: list[CategoryBudgetInput] = Field(default_factory=list, max_length=200)

    @model_validator(mode='after')
    def unique_categories(self):
        ids = [item.category_id for item in self.categories]
        if len(ids) != len(set(ids)):
            raise ValueError('Each category can only have one budget.')
        return self

class TransactionInput(BaseModel):
    merchant: str = Field(min_length=1, max_length=160)
    date: Date
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    kind: Literal['income', 'expense'] = 'expense'
    category_id: str
    receipt_id: str | None = None
    notes: str = Field(default='', max_length=2000)
    line_items: list[LineItem] = Field(default_factory=list, max_length=200)
    source: Literal['manual', 'receipt', 'bank_transfer'] = 'manual'
    reference_code: str | None = Field(default=None, max_length=80)

    @field_validator('reference_code')
    @classmethod
    def clean_reference(cls, value):
        if value is None or not value.strip(): return None
        value = value.strip()
        if not value.isascii() or not value.isalnum() or len(value) < 8:
            raise ValueError('Reference must contain 8–80 letters and digits (case-sensitive).')
        return value

    @model_validator(mode='after')
    def bank_transfer_fields(self):
        if self.source == 'bank_transfer':
            if self.kind != 'expense': raise ValueError('Bank transfer slips must be outgoing expenses.')
            if self.line_items: raise ValueError('Bank transfer slips do not have receipt line items.')
        return self

    @field_validator('merchant')
    @classmethod
    def clean(cls, value):
        if not value.strip():
            raise ValueError('Merchant is required')
        return value.strip()
