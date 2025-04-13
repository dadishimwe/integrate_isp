from typing import Any, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.deps import (
    get_db, 
    get_current_active_user, 
    get_current_manager_or_admin_user
)
from app.models.user import User as UserModel
from app.models.client import (
    Client as ClientModel,
    Contact as ContactModel,
    Quotation as QuotationModel,
    ServiceHistory as ServiceHistoryModel,
    TechnicalDoc as TechnicalDocModel
)
from app.schemas.client import (
    Client,
    ClientCreate,
    ClientUpdate,
    ClientFull,
    Contact,
    ContactCreate,
    ContactUpdate,
    Quotation,
    QuotationCreate,
    QuotationUpdate,
    ServiceHistory,
    ServiceHistoryCreate,
    TechnicalDoc,
    TechnicalDocCreate,
    TechnicalDocUpdate,
    ClientStatusEnum
)

router = APIRouter()


@router.get("/", response_model=List[Client])
def get_clients(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: ClientStatusEnum = None,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve clients with optional status filtering.
    """
    query = db.query(ClientModel)
    
    # Filter by status if provided
    if status:
        query = query.filter(ClientModel.status == status)
    
    # Apply pagination
    clients = query.offset(skip).limit(limit).all()
    return clients


@router.post("/", response_model=Client)
def create_client(
    *,
    db: Session = Depends(get_db),
    client_in: ClientCreate,
    current_user: UserModel = Depends(get_current_manager_or_admin_user),
) -> Any:
    """
    Create new client.
    """
    client = ClientModel(**client_in.dict())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientFull)
def get_client(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get client by ID with all related information.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    return client


@router.put("/{client_id}", response_model=Client)
def update_client(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    client_in: ClientUpdate,
    current_user: UserModel = Depends(get_current_manager_or_admin_user),
) -> Any:
    """
    Update a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Update client status if changing to active
    if client_in.status == ClientStatusEnum.ACTIVE and client.status != ClientStatusEnum.ACTIVE:
        client.onboarded_at = func.now()
    
    # Update client fields
    update_data = client_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(client, field, update_data[field])
    
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", response_model=Client)
def delete_client(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_manager_or_admin_user),
) -> Any:
    """
    Delete a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    db.delete(client)
    db.commit()
    return client


# Contact endpoints
@router.get("/{client_id}/contacts", response_model=List[Contact])
def get_client_contacts(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get all contacts for a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    return client.contacts


@router.post("/{client_id}/contacts", response_model=Contact)
def create_client_contact(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    contact_in: ContactCreate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Create a new contact for a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # If setting as primary, unset any existing primary contacts
    if contact_in.is_primary:
        existing_primary = db.query(ContactModel).filter(
            ContactModel.client_id == client_id,
            ContactModel.is_primary == True
        ).first()
        
        if existing_primary:
            existing_primary.is_primary = False
            db.add(existing_primary)
    
    contact = ContactModel(**contact_in.dict())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{client_id}/contacts/{contact_id}", response_model=Contact)
def update_client_contact(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    contact_id: int = Path(..., gt=0),
    contact_in: ContactUpdate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Update a client contact.
    """
    contact = db.query(ContactModel).filter(
        ContactModel.id == contact_id,
        ContactModel.client_id == client_id
    ).first()
    
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )
    
    # If setting as primary, unset any existing primary contacts
    if contact_in.is_primary is True and not contact.is_primary:
        existing_primary = db.query(ContactModel).filter(
            ContactModel.client_id == client_id,
            ContactModel.is_primary == True,
            ContactModel.id != contact_id
        ).first()
        
        if existing_primary:
            existing_primary.is_primary = False
            db.add(existing_primary)
    
    # Update contact fields
    update_data = contact_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(contact, field, update_data[field])
    
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{client_id}/contacts/{contact_id}", response_model=Contact)
def delete_client_contact(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    contact_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Delete a client contact.
    """
    contact = db.query(ContactModel).filter(
        ContactModel.id == contact_id,
        ContactModel.client_id == client_id
    ).first()
    
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )
    
    db.delete(contact)
    db.commit()
    return contact


# Quotation endpoints
@router.get("/{client_id}/quotations", response_model=List[Quotation])
def get_client_quotations(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get all quotations for a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    return client.quotations


@router.post("/{client_id}/quotations", response_model=Quotation)
def create_client_quotation(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    quotation_in: QuotationCreate,
    current_user: UserModel = Depends(get_current_manager_or_admin_user),
) -> Any:
    """
    Create a new quotation for a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Get latest version number
    latest_version = db.query(func.max(QuotationModel.version)).filter(
        QuotationModel.client_id == client_id
    ).scalar() or 0
    
    quotation = QuotationModel(
        **quotation_in.dict(),
        version=latest_version + 1
    )
    
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return quotation


@router.put("/{client_id}/quotations/{quotation_id}", response_model=Quotation)
def update_client_quotation(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    quotation_id: int = Path(..., gt=0),
    quotation_in: QuotationUpdate,
    current_user: UserModel = Depends(get_current_manager_or_admin_user),
) -> Any:
    """
    Update a client quotation.
    """
    quotation = db.query(QuotationModel).filter(
        QuotationModel.id == quotation_id,
        QuotationModel.client_id == client_id
    ).first()
    
    if not quotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quotation not found",
        )
    
    # Update sent_at if status is changing to sent
    if quotation_in.status == "sent" and quotation.status != "sent":
        quotation.sent_at = func.now()
    
    # Update quotation fields
    update_data = quotation_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(quotation, field, update_data[field])
    
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return quotation


# Service History endpoints
@router.get("/{client_id}/service-history", response_model=List[ServiceHistory])
def get_client_service_history(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get service history for a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    service_history_with_staff = db.query(
        ServiceHistoryModel,
        func.coalesce(
            UserModel.full_name, 
            None
        ).label("staff_name")
    ).outerjoin(
        UserModel, ServiceHistoryModel.staff_id == UserModel.id
    ).filter(
        ServiceHistoryModel.client_id == client_id
    ).order_by(
        ServiceHistoryModel.event_date.desc()
    ).all()
    
    result = []
    for history, staff_name in service_history_with_staff:
        history_dict = {
            **history.__dict__,
            "staff_name": staff_name
        }
        result.append(history_dict)
    
    return result


@router.post("/{client_id}/service-history", response_model=ServiceHistory)
def create_service_history_entry(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    history_in: ServiceHistoryCreate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Create a new service history entry.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    # Set staff_id to current user if not provided
    if not history_in.staff_id:
        history_in.staff_id = current_user.id
    
    history = ServiceHistoryModel(**history_in.dict())
    db.add(history)
    db.commit()
    db.refresh(history)
    
    # Get staff name for response
    staff_name = None
    if history.staff_id:
        staff = db.query(UserModel).filter(UserModel.id == history.staff_id).first()
        if staff:
            staff_name = staff.full_name
    
    # Convert to response format
    result = {
        **history.__dict__,
        "staff_name": staff_name
    }
    
    return result


# Technical Documentation endpoints
@router.get("/{client_id}/technical-docs", response_model=List[TechnicalDoc])
def get_client_technical_docs(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Get technical documentation for a client.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    return client.technical_docs


@router.post("/{client_id}/technical-docs", response_model=TechnicalDoc)
def create_technical_doc(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    doc_in: TechnicalDocCreate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Create a new technical document.
    """
    client = db.query(ClientModel).filter(ClientModel.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    doc = TechnicalDocModel(**doc_in.dict())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.put("/{client_id}/technical-docs/{doc_id}", response_model=TechnicalDoc)
def update_technical_doc(
    *,
    db: Session = Depends(get_db),
    client_id: int = Path(..., gt=0),
    doc_id: int = Path(..., gt=0),
    doc_in: TechnicalDocUpdate,
    current_user: UserModel = Depends(get_current_active_user),
) -> Any:
    """
    Update a technical document.
    """
    doc = db.query(TechnicalDocModel).filter(
        TechnicalDocModel.id == doc_id,
        TechnicalDocModel.client_id == client_id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Technical document not found",
        )
    
    # Update fields
    update_data = doc_in.dict(exclude_unset=True)
    for field in update_data:
        setattr(doc, field, update_data[field])
    
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
