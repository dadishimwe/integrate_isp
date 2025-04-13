from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class Task(Base):
    """
    Task model for the task management system
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, nullable=False)  # high, medium, low
    due_date = Column(Date, nullable=True)
    status = Column(String, nullable=False, default="pending")  # pending, in_progress, completed
    completion_percentage = Column(Integer, default=0)
    
    # User relationships
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", foreign_keys=[owner_id])
    
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assignee = relationship("User", foreign_keys=[assignee_id])
    
    # Optional client association
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    client = relationship("Client", back_populates="tasks")
    
    # Category
    category = Column(String, nullable=True)  # meeting, call, documentation, development, etc.
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Reminder settings
    reminder_enabled = Column(Boolean, default=False)
    reminder_date = Column(DateTime(timezone=True), nullable=True)