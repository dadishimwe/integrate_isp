from app.db.session import SessionLocal
from app.models.user import User

def main():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"\nFound {len(users)} users in the database:")
        for user in users:
            print(f"- {user.email} (role: {user.role})")
        print("\n")
    finally:
        db.close()

if __name__ == "__main__":
    main()
