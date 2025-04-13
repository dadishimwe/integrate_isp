from typing import Optional, List
from datetime import datetime, date
from enum import Enum

from pydantic import BaseModel, Field


# Task priority enum
class TaskPriorityEnum(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# Task status enum
class TaskStatusEnum(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


# Task category enum
class TaskCategoryEnum(str, Enum):
    MEETING = "meeting"
    CALL = "call"
    DOCUMENTATION = "documentation"
    DEVELOPMENT = "development"
    OTHER = "other"


# Shared properties
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: TaskPriorityEnum
    due_date: Optional[date] = None
    category: Optional[TaskCategoryEnum] = None
    client_id: Optional[int] = None


# Properties to receive via API on creation
class TaskCreate(TaskBase):
    assignee_id: Optional[int] = None


# Properties to receive via API on update
class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriorityEnum] = None
    due_date: Optional[date] = None
    status: Optional[TaskStatusEnum] = None
    completion_percentage: Optional[int] = None
    assignee_id: Optional[int] = None
    category: Optional[TaskCategoryEnum] = None
    client_id: Optional[int] = None
    reminder_enabled: Optional[bool] = None
    reminder_date: Optional[datetime] = None


# Properties to return via API
class Task(TaskBase):
    id: int
    status: TaskStatusEnum
    completion_percentage: int
    owner_id: int
    assignee_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    reminder_enabled: bool
    reminder_date: Optional[datetime] = None

    class Config:
        orm_mode = True


# Task with user info
class TaskWithUser(Task):
    owner_name: str
    assignee_name: Optional[str] = None
    client_name: Optional[str] = None


# Task statistics
class TaskStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    completion_rate: float
    tasks_by_priority: dict
    tasks_by_category: dict