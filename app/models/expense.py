from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class Expense(Base):
    """
    Expense model for the finance tracker
    """
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(DateTime, nullable=False)
    category = Column(String, nullable=False)  # equipment, travel, meals, software, supplies, other
    notes = Column(Text, nullable=True)
    
    # Status flow: submitted -> approved/rejected -> reimbursed
    status = Column(String, nullable=False, default="submitted")  # submitted, approved, rejected, reimbursed
    
    # User relationships
    submitter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    submitter = relationship("User", foreign_keys=[submitter_id])
    
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approver = relationship("User", foreign_keys=[approver_id])
    
    reimburser_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reimburser = relationship("User", foreign_keys=[reimburser_id])
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    reimbursed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Optional client association
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    client = relationship("Client", back_populates="expenses")