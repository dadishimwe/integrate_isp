from typing import Optional, List
from datetime import datetime, date
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


# Client status enum
class ClientStatusEnum(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    INACTIVE = "inactive"


# Service plan enum
class ServicePlanEnum(str, Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


# Shared properties for Client
class ClientBase(BaseModel):
    name: str
    location: str
    status: ClientStatusEnum = ClientStatusEnum.PENDING
    service_plan: ServicePlanEnum
    notes: Optional[str] = None


# Properties to receive via API on creation
class ClientCreate(ClientBase):
    pass


# Properties to receive via API on update
class ClientUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    status: Optional[ClientStatusEnum] = None
    service_plan: Optional[ServicePlanEnum] = None
    notes: Optional[str] = None


# Properties to return via API
class Client(ClientBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    onboarded_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Contact schemas
class ContactBase(BaseModel):
    name: str
    role: Optional[str] = None
    department: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    preferred_contact: Optional[str] = "email"
    is_primary: bool = False


class ContactCreate(ContactBase):
    client_id: int


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    preferred_contact: Optional[str] = None
    is_primary: Optional[bool] = None


class Contact(ContactBase):
    id: int
    client_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Quotation schemas
class QuotationStatusEnum(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class QuotationBase(BaseModel):
    html_content: str
    status: QuotationStatusEnum = QuotationStatusEnum.DRAFT


class QuotationCreate(QuotationBase):
    client_id: int


class QuotationUpdate(BaseModel):
    html_content: Optional[str] = None
    status: Optional[QuotationStatusEnum] = None


class Quotation(QuotationBase):
    id: int
    client_id: int
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Service History schemas
class ServiceHistoryBase(BaseModel):
    event_type: str
    event_date: date
    description: str
    communication_channel: Optional[str] = None
    staff_id: Optional[int] = None


class ServiceHistoryCreate(ServiceHistoryBase):
    client_id: int


class ServiceHistory(ServiceHistoryBase):
    id: int
    client_id: int
    created_at: datetime
    staff_name: Optional[str] = None  # Populated in API response

    class Config:
        orm_mode = True


# Technical Doc schemas
class TechnicalDocBase(BaseModel):
    doc_type: str
    content: str


class TechnicalDocCreate(TechnicalDocBase):
    client_id: int


class TechnicalDocUpdate(BaseModel):
    doc_type: Optional[str] = None
    content: Optional[str] = None


class TechnicalDoc(TechnicalDocBase):
    id: int
    client_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# Full client representation with all related entities
class ClientFull(Client):
    contacts: List[Contact] = []
    quotations: List[Quotation] = []
    service_history: List[ServiceHistory] = []
    technical_docs: List[TechnicalDoc] = []

    class Config:
        orm_mode = True