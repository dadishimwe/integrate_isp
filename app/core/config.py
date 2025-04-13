import secrets
from typing import List, Optional, Union, Dict, Any

from pydantic import AnyHttpUrl, BaseSettings, validator


class Settings(BaseSettings):
    PROJECT_NAME: str = "IntegrateISP"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    # 60 minutes * 24 hours * 8 days = 8 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Database
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./integrate_isp.db"
    
    # JWT settings
    JWT_SECRET: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_DELTA: int = 60 * 24 * 7  # 7 days
    
    # Admin user creation on startup
    FIRST_SUPERUSER: str = "admin@integrate.isp"
    FIRST_SUPERUSER_PASSWORD: str = "password"
    
    # Other users for demo
    DEMO_MANAGER: str = "manager@integrate.isp"
    DEMO_MANAGER_PASSWORD: str = "password"
    
    DEMO_EMPLOYEE: str = "employee@integrate.isp"
    DEMO_EMPLOYEE_PASSWORD: str = "password"
    
    DEMO_FINANCE: str = "finance@integrate.isp"
    DEMO_FINANCE_PASSWORD: str = "password"

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()