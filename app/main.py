from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.routers import auth, users, finance, clients, tasks
from app.core.config import settings
from app.db.session import engine, Base, SessionLocal
from app.core.deps import get_db
from app.core.security import create_demo_user

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")

# Create initial users on startup
@app.on_event("startup")
async def create_initial_users():
    db = SessionLocal()
    try:
        # Create admin user
        create_demo_user(
            db, 
            email=settings.FIRST_SUPERUSER, 
            password=settings.FIRST_SUPERUSER_PASSWORD,
            role="admin",
            full_name="Administrator"
        )
        
        # Create manager
        create_demo_user(
            db, 
            email=settings.DEMO_MANAGER, 
            password=settings.DEMO_MANAGER_PASSWORD,
            role="manager",
            full_name="Manager User"
        )
        
        # Create employee
        create_demo_user(
            db, 
            email=settings.DEMO_EMPLOYEE, 
            password=settings.DEMO_EMPLOYEE_PASSWORD,
            role="employee",
            full_name="Employee User"
        )
        
        # Create finance admin
        create_demo_user(
            db, 
            email=settings.DEMO_FINANCE, 
            password=settings.DEMO_FINANCE_PASSWORD,
            role="finance",
            full_name="Finance Admin"
        )
        print("Demo users have been created or updated")
    finally:
        db.close()

# Include routers
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])


@app.get("/")
async def root(request: Request):
    """
    Root endpoint that returns the login page
    """
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/app")
async def app_page(request: Request):
    """
    Main application page after login
    """
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    """
    return {"status": "healthy", "database": "connected"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
