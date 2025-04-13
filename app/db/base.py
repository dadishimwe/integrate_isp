# Import all models here so that Alembic can detect them
from app.db.session import Base  # noqa
from app.models.user import User  # noqa
from app.models.expense import Expense  # noqa
from app.models.client import Client, Contact, Quotation, ServiceHistory, TechnicalDoc  # noqa
from app.models.task import Task  # noqa