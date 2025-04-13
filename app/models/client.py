from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class Client(Base):
    """
    Client model for client management
    """
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    location = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # active, pending, inactive
    service_plan = Column(String, nullable=False)  # basic, standard, premium, enterprise
    
    # Relationships
    contacts = relationship("Contact", back_populates="client", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="client", cascade="all, delete-orphan")
    service_history = relationship("ServiceHistory", back_populates="client", cascade="all, delete-orphan")
    technical_docs = relationship("TechnicalDoc", back_populates="client", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="client")
    expenses = relationship("Expense", back_populates="client")
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    onboarded_at = Column(DateTime(timezone=True), nullable=True)


class Contact(Base):
    """
    Contact model for client contacts
    """
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client = relationship("Client", back_populates="contacts")
    
    name = Column(String, nullable=False)
    role = Column(String, nullable=True)
    department = Column(String, nullable=True)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    preferred_contact = Column(String, nullable=True)  # email, phone, other
    is_primary = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Quotation(Base):
    """
    Quotation model for client quotations
    """
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client = relationship("Client", back_populates="quotations")
    
    version = Column(Integer, nullable=False, default=1)
    html_content = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="draft")  # draft, sent, accepted, rejected
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)


class ServiceHistory(Base):
    """
    Service history model for client service history
    """
    __tablename__ = "service_history"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client = relationship("Client", back_populates="service_history")
    
    event_type = Column(String, nullable=False)  # initial_contact, quotation_sent, installation, activation, etc.
    event_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    staff = relationship("User")
    communication_channel = Column(String, nullable=True)  # phone, email, in-person, other
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TechnicalDoc(Base):
    """
    Technical documentation model for client technical documentation
    """
    __tablename__ = "technical_docs"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client = relationship("Client", back_populates="technical_docs")
    
    doc_type = Column(String, nullable=False)  # network_diagram, device_inventory, etc.
    content = Column(Text, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())