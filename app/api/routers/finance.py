from typing import Any, List
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from app.core.deps import (
    get_db, 
    get_current_active_user, 
    get_current_manager_or_admin_user,
    get_current_finance_admin_or_admin_user
)
from app.models.user import User as UserModel
from app.models.expense import Expense as ExpenseModel
from app.models.client import Client as ClientModel
from app.schemas.expense import (
    Expense, 
    ExpenseCreate, 
    ExpenseUpdate, 
    ExpenseApproval,
    ExpenseWithUser,
    ExpenseStats,
    ExpenseStatusEnum
)

router = APIRouter()


@router.get("/expenses/", response_model=List[ExpenseWithUser])
def get_expenses(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve expenses with filtering.
    """
    query = db.query(
        ExpenseModel,
        UserModel.full_name.label("submitter_name"),
        func.coalesce(
            db.query(UserModel.full_name)
            .filter(UserModel.id == ExpenseModel.approver_id)
            .scalar_subquery(),
            None
        ).label("approver_name"),
        func.coalesce(
            db.query(UserModel.full_name)
            .filter(UserModel.id == ExpenseModel.reimburser_id)
            .scalar_subquery(),
            None
        ).label("reimburser_name"),
        func.coalesce(
            db.query(ClientModel.name)
            .filter(ClientModel.id == ExpenseModel.client_id)
            .scalar_subquery(),
            None
        ).label("client_name")
    ).join(
        UserModel, ExpenseModel.submitter_id == UserModel.id
    )
    
    # Filter by status if provided
    if status:
        query = query.filter(ExpenseModel.status == status)
    
    # Filter by user role
    if current_user.role == "employee":
        # Regular employees can only see their own expenses
        query = query.filter(ExpenseModel.submitter_id == current_user.id)
    elif current_user.role == "manager":
        # Managers can see their team's expenses and their own
        query = query.filter(
            (ExpenseModel.submitter_id == current_user.id) | 
            (ExpenseModel.status == "submitted")  # Managers need to approve submitted expenses
        )
    
    # Get total count for pagination
    total = query.count()
    
    # Apply pagination
    expenses_with_users = query.order_by(ExpenseModel.created_at.desc()).offset(skip).limit(limit).all()
    
    # Convert to Pydantic models
    result = []
    for expense, submitter_name, approver_name, reimburser_name, client_name in expenses_with_users:
        expense_dict = {
            **expense.__dict__,
            "submitter_name": submitter_name,
            "approver_name": approver_name,
            "reimburser_name": reimburser_name,
            "client_name": client_name
        }
        result.append(expense_dict)
    
    return result


@router.post("/expenses/", response_model=Expense)
def create_expense(
    *,
    db: Session = Depends(get_db),
    expense_in: ExpenseCreate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Create new expense.
    """
    # Check if client exists if provided
    if expense_in.client_id:
        client = db.query(ClientModel).filter(ClientModel.id == expense_in.client_id).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )
    
    # Create expense
    expense = ExpenseModel(
        **expense_in.dict(),
        submitter_id=current_user.id,
        status="submitted"
    )
    db.delete(expense)
    db.commit()
    return expense


@router.post("/expenses/{expense_id}/approve", response_model=Expense)
def approve_expense(
    *,
    db: Session = Depends(get_db),
    expense_id: int,
    approval: ExpenseApproval,
    current_user: UserModel = Depends(get_current_manager_or_admin_user),
) -> Any:
    """
    Approve or reject an expense.
    """
    expense = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )
    
    # Can only approve/reject submitted expenses
    if expense.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve/reject expense with status '{expense.status}'",
        )
    
    # Update expense
    expense.status = approval.status
    expense.approver_id = current_user.id
    expense.approved_at = func.now()
    
    # Add notes if provided
    if approval.notes:
        expense.notes = approval.notes if not expense.notes else f"{expense.notes}\n\nApproval notes: {approval.notes}"
    
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.post("/expenses/{expense_id}/reimburse", response_model=Expense)
def reimburse_expense(
    *,
    db: Session = Depends(get_db),
    expense_id: int,
    current_user: UserModel = Depends(get_current_finance_admin_or_admin_user),
) -> Any:
    """
    Mark an expense as reimbursed.
    """
    expense = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )
    
    # Can only reimburse approved expenses
    if expense.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only reimburse approved expenses",
        )
    
    # Update expense
    expense.status = "reimbursed"
    expense.reimburser_id = current_user.id
    expense.reimbursed_at = func.now()
    
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/expenses/stats", response_model=ExpenseStats)
def get_expense_stats(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get expense statistics.
    """
    # Get current month start/end dates
    today = datetime.now()
    start_of_month = datetime(today.year, today.month, 1)
    
    # Total expenses month-to-date
    total_mtd_query = db.query(func.sum(ExpenseModel.amount))
    
    # Pending approval
    pending_query = db.query(func.sum(ExpenseModel.amount)).filter(
        ExpenseModel.status == "submitted"
    )
    
    # Reimbursed month-to-date
    reimbursed_mtd_query = db.query(func.sum(ExpenseModel.amount)).filter(
        ExpenseModel.status == "reimbursed",
        ExpenseModel.reimbursed_at >= start_of_month
    )
    
    # Filter by user role
    if current_user.role == "employee":
        total_mtd_query = total_mtd_query.filter(ExpenseModel.submitter_id == current_user.id)
        pending_query = pending_query.filter(ExpenseModel.submitter_id == current_user.id)
        reimbursed_mtd_query = reimbursed_mtd_query.filter(ExpenseModel.submitter_id == current_user.id)
    
    # Get category breakdown
    category_query = db.query(
        ExpenseModel.category,
        func.sum(ExpenseModel.amount).label("total")
    ).group_by(ExpenseModel.category)
    
    if current_user.role == "employee":
        category_query = category_query.filter(ExpenseModel.submitter_id == current_user.id)
    
    # Execute queries
    total_mtd = total_mtd_query.scalar() or 0
    pending_approval = pending_query.scalar() or 0
    reimbursed_mtd = reimbursed_mtd_query.scalar() or 0
    
    # Calculate budget percentage (using a fixed budget of $7,500 for this example)
    budget = 7500
    budget_percentage = (total_mtd / budget) * 100 if budget > 0 else 0
    
    # Get category breakdown
    categories = {}
    for category, total in category_query.all():
        categories[category] = total
    
    return {
        "total_mtd": total_mtd,
        "pending_approval": pending_approval,
        "reimbursed_mtd": reimbursed_mtd,
        "budget_percentage": budget_percentage,
        "expenses_by_category": categories
    }


@router.get("/expenses/{expense_id}", response_model=ExpenseWithUser)
def get_expense(
    *,
    db: Session = Depends(get_db),
    expense_id: int,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get expense by ID.
    """
    # Query for expense with user information
    expense_with_user = db.query(
        ExpenseModel,
        UserModel.full_name.label("submitter_name"),
        func.coalesce(
            db.query(UserModel.full_name)
            .filter(UserModel.id == ExpenseModel.approver_id)
            .scalar_subquery(),
            None
        ).label("approver_name"),
        func.coalesce(
            db.query(UserModel.full_name)
            .filter(UserModel.id == ExpenseModel.reimburser_id)
            .scalar_subquery(),
            None
        ).label("reimburser_name"),
        func.coalesce(
            db.query(ClientModel.name)
            .filter(ClientModel.id == ExpenseModel.client_id)
            .scalar_subquery(),
            None
        ).label("client_name")
    ).join(
        UserModel, ExpenseModel.submitter_id == UserModel.id
    ).filter(
        ExpenseModel.id == expense_id
    ).first()
    
    if not expense_with_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )
    
    expense, submitter_name, approver_name, reimburser_name, client_name = expense_with_user
    
    # Check permissions
    if current_user.role == "employee" and expense.submitter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this expense",
        )
    
    # Convert to dictionary
    expense_dict = {
        **expense.__dict__,
        "submitter_name": submitter_name,
        "approver_name": approver_name,
        "reimburser_name": reimburser_name,
        "client_name": client_name
    }
    
    return expense_dict


@router.put("/expenses/{expense_id}", response_model=Expense)
def update_expense(
    *,
    db: Session = Depends(get_db),
    expense_id: int,
    expense_in: ExpenseUpdate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Update an expense.
    """
    expense = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )
    
    # Check permissions
    if current_user.role == "employee" and expense.submitter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this expense",
        )
    
    # Employee can only update their own expenses if they're still in 'submitted' status
    if current_user.role == "employee" and expense.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update expenses in 'submitted' status",
        )
    
    # Update expense
    update_data = expense_in.dict(exclude_unset=True)
    
    # Managers and admins can update status
    if "status" in update_data and current_user.role in ["admin", "manager", "finance"]:
        # Finance admin can only change status to reimbursed
        if current_user.role == "finance" and update_data["status"] != "reimbursed":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Finance admin can only change status to 'reimbursed'",
            )
        
        # Managers can only approve/reject
        if current_user.role == "manager" and update_data["status"] not in ["approved", "rejected"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only approve or reject expenses",
            )
        
        # Update approval/reimbursement info
        if update_data["status"] == "approved":
            expense.approver_id = current_user.id
            expense.approved_at = func.now()
        elif update_data["status"] == "reimbursed":
            expense.reimburser_id = current_user.id
            expense.reimbursed_at = func.now()
    
    # Update fields
    for field in update_data:
        setattr(expense, field, update_data[field])
    
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", response_model=Expense)
def delete_expense(
    *,
    db: Session = Depends(get_db),
    expense_id: int,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Delete an expense.
    """
    expense = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )
    
    # Check permissions - employees can only delete their own submitted expenses
    if current_user.role == "employee":
        if expense.submitter_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to delete this expense",
            )
        
        if expense.status != "submitted":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete expenses in 'submitted' status",
            )
    
    # Managers can delete their approved expenses (but only before reimbursement)
    elif current_user.role == "manager":
        if expense.status == "reimbursed":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot delete reimbursed expenses",
            )
    
    # Finance admins can delete expenses that are at least 2 weeks old
    elif current_user.role == "finance":
        two_weeks_ago = datetime.now() - timedelta(days=14)
        if expense.created_at > two_weeks_ago:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete expenses that are at least 2 weeks old",
            )
