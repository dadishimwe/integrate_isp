# IntegrateISP - Starlink Reseller Management Platform

IntegrateISP is a comprehensive web application designed to streamline operations for Starlink reseller businesses. It consolidates client management, financial tracking, task organization, and team collaboration into a single, intuitive platform.

## Features

- **User Management**: Hierarchical roles (Admin, Manager, Employee, Finance Admin) with appropriate permissions
- **Finance Tracker**: Complete expense management workflow with submission, approval, and reimbursement
- **Client Management**: Detailed client profiles with contacts, quotations, service history, and technical documentation
- **Task Management**: Prioritized to-do lists with personal and team task coordination

## Project Structure

```bash
integrate_isp/
├── app/
│   ├── __init__.py
│   ├── main.py              # Main application entry point
│   ├── core/                # Core functionality
│   │   ├── __init__.py
│   │   ├── config.py        # Configuration settings
│   │   ├── security.py      # Authentication & security
│   │   └── deps.py          # Dependency injection
│   ├── api/                 # API endpoints
│   │   ├── __init__.py
│   │   └── routers/         # Route definitions
│   │       ├── __init__.py
│   │       ├── auth.py      # Authentication routes
│   │       ├── users.py     # User management routes
│   │       ├── finance.py   # Finance tracker routes
│   │       ├── clients.py   # Client management routes
│   │       └── tasks.py     # Task management routes
│   ├── db/                  # Database
│   │   ├── __init__.py
│   │   ├── base.py          # Base model definition
│   │   └── session.py       # Database session
│   ├── models/              # Database models
│   │   ├── __init__.py
│   │   ├── user.py          # User model
│   │   ├── expense.py       # Expense model
│   │   ├── client.py        # Client model
│   │   └── task.py          # Task model
│   ├── schemas/             # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py          # User schemas
│   │   ├── expense.py       # Expense schemas
│   │   ├── client.py        # Client schemas
│   │   └── task.py          # Task schemas
│   ├── static/              # Static files
│   │   ├── css/             # CSS files
│   │   ├── js/              # JavaScript files
│   │   └── img/             # Image files
│   └── templates/           # HTML templates
│       ├── index.html       # Main application HTML
│       └── login.html       # Login page
├── alembic/                 # Database migrations
│   └── versions/
├── alembic.ini              # Alembic configuration
├── pyproject.toml           # Project metadata
└── README.md                # Project documentation
```

## Getting Started

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/dadishimwe/integrate_isp.git
   cd integrate_isp
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Initialize the database:

   ```bash
   alembic upgrade head
   ```

5. Run the application:

   ```bash  
   uvicorn app.main:app --reload
   ```

6. Access the application at <http://localhost:8000>

### Demo Credentials

- **Admin**: <admin@integrate.isp> / password
- **Manager**: <manager@integrate.isp> / password
- **Employee**: <employee@integrate.isp> / password
- **Finance Admin**: <finance@integrate.isp> / password

## Development

### Adding Database Migrations

```bash
alembic revision --autogenerate -m "Description of the change"
alembic upgrade head
```

### Running Tests

```bash
pytest
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
