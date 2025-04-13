from typing import Any, List, Optional
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.core.deps import (
    get_db, 
    get_current_active_user, 
    get_current_manager_or_admin_user
)
from app.models.user import User as UserModel
from app.models.task import Task as TaskModel
from app.models.client import Client as ClientModel
from app.schemas.task import (
    Task,
    TaskCreate,
    TaskUpdate,
    TaskWithUser,
    TaskStats,
    TaskStatusEnum,
    TaskPriorityEnum
)

router = APIRouter()


@router.get("/", response_model=List[TaskWithUser])
def get_tasks(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatusEnum] = None,
    priority: Optional[TaskPriorityEnum] = None,
    due_before: Optional[date] = None,
    due_after: Optional[date] = None,
    assigned_to_me: bool = False,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve tasks with filtering options.
    """
    query = db.query(
        TaskModel,
        UserModel.full_name.label("owner_name"),
        func.coalesce(
            db.query(UserModel.full_name)
            .filter(UserModel.id == TaskModel.assignee_id)
            .scalar_subquery(),
            None
        ).label("assignee_name"),
        func.coalesce(
            db.query(ClientModel.name)
            .filter(ClientModel.id == TaskModel.client_id)
            .scalar_subquery(),
            None
        ).label("client_name")
    ).join(
        UserModel, TaskModel.owner_id == UserModel.id
    )
    
    # Apply filters
    if status:
        query = query.filter(TaskModel.status == status)
    
    if priority:
        query = query.filter(TaskModel.priority == priority)
    
    if due_before:
        query = query.filter(TaskModel.due_date <= due_before)
    
    if due_after:
        query = query.filter(TaskModel.due_date >= due_after)
    
    # Filter by role/permissions
    if current_user.role == "employee":
        if assigned_to_me:
            # Only show tasks assigned to me
            query = query.filter(TaskModel.assignee_id == current_user.id)
        else:
            # Show tasks I own or am assigned to
            query = query.filter(
                or_(
                    TaskModel.owner_id == current_user.id,
                    TaskModel.assignee_id == current_user.id
                )
            )
    elif current_user.role == "manager" and assigned_to_me:
        # Managers can see all tasks but can filter to just their own
        query = query.filter(TaskModel.assignee_id == current_user.id)
    
    # Get total count for pagination
    total = query.count()
    
    # Order by due date (most urgent first) and then by priority
    query = query.order_by(TaskModel.due_date.asc(), TaskModel.priority.asc())
    
    # Apply pagination
    tasks_with_users = query.offset(skip).limit(limit).all()
    
    # Convert to response format
    result = []
    for task, owner_name, assignee_name, client_name in tasks_with_users:
        task_dict = {
            **task.__dict__,
            "owner_name": owner_name,
            "assignee_name": assignee_name,
            "client_name": client_name
        }
        result.append(task_dict)
    
    return result


@router.post("/", response_model=Task)
def create_task(
    *,
    db: Session = Depends(get_db),
    task_in: TaskCreate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Create new task.
    """
    # Check if client exists if provided
    if task_in.client_id:
        client = db.query(ClientModel).filter(ClientModel.id == task_in.client_id).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )
    
    # Check if assignee exists if provided
    if task_in.assignee_id:
        assignee = db.query(UserModel).filter(UserModel.id == task_in.assignee_id).first()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee not found",
            )
        
        # Regular employees can only assign tasks to themselves
        if current_user.role == "employee" and task_in.assignee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only assign tasks to yourself",
            )
    
    # Create task
    task = TaskModel(
        **task_in.dict(),
        owner_id=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskWithUser)
def get_task(
    *,
    db: Session = Depends(get_db),
    task_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get task by ID.
    """
    # Query for task with user information
    task_with_user = db.query(
        TaskModel,
        UserModel.full_name.label("owner_name"),
        func.coalesce(
            db.query(UserModel.full_name)
            .filter(UserModel.id == TaskModel.assignee_id)
            .scalar_subquery(),
            None
        ).label("assignee_name"),
        func.coalesce(
            db.query(ClientModel.name)
            .filter(ClientModel.id == TaskModel.client_id)
            .scalar_subquery(),
            None
        ).label("client_name")
    ).join(
        UserModel, TaskModel.owner_id == UserModel.id
    ).filter(
        TaskModel.id == task_id
    ).first()
    
    if not task_with_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    task, owner_name, assignee_name, client_name = task_with_user
    
    # Check if user has permission to view
    if current_user.role == "employee" and task.owner_id != current_user.id and task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this task",
        )
    
    # Convert to response format
    task_dict = {
        **task.__dict__,
        "owner_name": owner_name,
        "assignee_name": assignee_name,
        "client_name": client_name
    }
    
    return task_dict


@router.put("/{task_id}", response_model=Task)
def update_task(
    *,
    db: Session = Depends(get_db),
    task_id: int = Path(..., gt=0),
    task_in: TaskUpdate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Update a task.
    """
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    # Check permissions
    if current_user.role == "employee" and task.owner_id != current_user.id and task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )
    
    # Regular employees can only assign tasks to themselves
    if task_in.assignee_id is not None and current_user.role == "employee" and task_in.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only assign tasks to yourself",
        )
    
    # Check if client exists if provided
    if task_in.client_id is not None:
        client = db.query(ClientModel).filter(ClientModel.id == task_in.client_id).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found",
            )
    
    # Check if assignee exists if provided
    if task_in.assignee_id is not None:
        assignee = db.query(UserModel).filter(UserModel.id == task_in.assignee_id).first()
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee not found",
            )
    
    # Update task
    update_data = task_in.dict(exclude_unset=True)
    
    # If status is being changed to completed, update completed_at
    if "status" in update_data and update_data["status"] == "completed" and task.status != "completed":
        task.completed_at = func.now()
    
    # Apply updates
    for field in update_data:
        setattr(task, field, update_data[field])
    
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", response_model=Task)
def delete_task(
    *,
    db: Session = Depends(get_db),
    task_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Delete a task.
    """
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    # Check permissions
    if current_user.role == "employee" and task.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this task",
        )
    
    db.delete(task)
    db.commit()
    return task


@router.post("/{task_id}/complete", response_model=Task)
def complete_task(
    *,
    db: Session = Depends(get_db),
    task_id: int = Path(..., gt=0),
    completion_percentage: int = Query(100, ge=0, le=100),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Mark a task as completed or update completion percentage.
    """
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    # Check permissions
    if current_user.role == "employee" and task.owner_id != current_user.id and task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this task",
        )
    
    # Update task
    task.completion_percentage = completion_percentage
    
    # If 100% complete, mark as completed
    if completion_percentage == 100:
        task.status = "completed"
        task.completed_at = func.now()
    elif task.status == "completed" and completion_percentage < 100:
        # If reducing from 100%, change status to in_progress
        task.status = "in_progress"
        task.completed_at = None
    
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/assign", response_model=Task)
def assign_task(
    *,
    db: Session = Depends(get_db),
    task_id: int = Path(..., gt=0),
    assignee_id: int = Query(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Assign a task to a user.
    """
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    # Check permissions
    if current_user.role == "employee" and task.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to assign this task",
        )
    
    # Regular employees can only assign tasks to themselves
    if current_user.role == "employee" and assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only assign tasks to yourself",
        )
    
    # Check if assignee exists
    assignee = db.query(UserModel).filter(UserModel.id == assignee_id).first()
    if not assignee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignee not found",
        )
    
    # Update task
    task.assignee_id = assignee_id
    
    # If task was pending, change to in_progress
    if task.status == "pending":
        task.status = "in_progress"
    
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/stats", response_model=TaskStats)
def get_task_stats(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get task statistics.
    """
    # Base query filters
    filters = []
    
    # Filter by user role/permissions
    if current_user.role == "employee":
        filters.append(
            or_(
                TaskModel.owner_id == current_user.id,
                TaskModel.assignee_id == current_user.id
            )
        )
    
    # Apply filters to base query
    base_query = db.query(TaskModel)
    if filters:
        base_query = base_query.filter(and_(*filters))
    
    # Total tasks
    total_tasks = base_query.count()
    
    # Completed tasks
    completed_tasks = base_query.filter(TaskModel.status == "completed").count()
    
    # Overdue tasks
    today = datetime.now().date()
    overdue_tasks = base_query.filter(
        TaskModel.due_date < today,
        TaskModel.status != "completed"
    ).count()
    
    # Completion rate
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    # Tasks by priority
    priority_query = db.query(
        TaskModel.priority,
        func.count().label("count")
    ).filter(*filters if filters else [True]).group_by(TaskModel.priority)
    
    priority_counts = {
        priority: count for priority, count in priority_query.all()
    }
    
    # Tasks by category
    category_query = db.query(
        TaskModel.category,
        func.count().label("count")
    ).filter(*filters if filters else [True]).group_by(TaskModel.category)
    
    category_counts = {
        category if category else "uncategorized": count 
        for category, count in category_query.all()
    }
    
    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "overdue_tasks": overdue_tasks,
        "completion_rate": completion_rate,
        "tasks_by_priority": priority_counts,
        "tasks_by_category": category_counts
    }