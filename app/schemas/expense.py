from typing import Optional, List
from datetime import datetime, date
from enum import Enum

from pydantic import BaseModel, Field


# Expense category enum
class ExpenseCategoryEnum(str, Enum):
    EQUIPMENT = "equipment"
    TRAVEL = "travel"
    MEALS = "meals"
    SOFTWARE = "software"
    SUPPLIES = "supplies"
    OTHER = "other"


# Expense status enum
class ExpenseStatusEnum(str, Enum):
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    REIMBURSED = "reimbursed"


# Shared properties
class ExpenseBase(BaseModel):
    description: str
    amount: float
    date: datetime
    category: ExpenseCategoryEnum
    notes: Optional[str] = None
    client_id: Optional[int] = None


# Properties to receive via API on creation
class ExpenseCreate(ExpenseBase):
    pass


# Properties to receive via API on update
class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[datetime] = None
    category: Optional[ExpenseCategoryEnum] = None
    notes: Optional[str] = None
    status: Optional[ExpenseStatusEnum] = None
    client_id: Optional[int] = None


# Properties to return via API
class Expense(ExpenseBase):
    id: int
    status: ExpenseStatusEnum
    submitter_id: int
    approver_id: Optional[int] = None
    reimburser_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    reimbursed_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


# Expense with user info
class ExpenseWithUser(Expense):
    submitter_name: str
    approver_name: Optional[str] = None
    reimburser_name: Optional[str] = None
    client_name: Optional[str] = None


# Expense approval request
class ExpenseApproval(BaseModel):
    status: ExpenseStatusEnum
    notes: Optional[str] = None


# Expense statistics
class ExpenseStats(BaseModel):
    total_mtd: float
    pending_approval: float
    reimbursed_mtd: float
    budget_percentage: Optional[float] = None
    expenses_by_category: dict