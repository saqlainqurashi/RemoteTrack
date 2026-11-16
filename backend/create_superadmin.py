
from getpass import getpass

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User


def create_superadmin():
    print("=== RemoteTrack Super Admin Setup ===")

    name = input("Enter full name: ").strip()
    email = input("Enter email: ").strip().lower()
    password = getpass("Enter password: ")

    if not name or not email:
        print("Name and email are required.")
        return

    if len(password) < 12:
        print("Password must be at least 12 characters.")
        return

    with SessionLocal() as db:
        # Prevent multiple Super Admin accounts
        existing_admin = db.scalar(
            select(User).where(
                User.role == "superadmin"
            )
        )

        if existing_admin:
            print("Super Admin already exists.")
            return

        existing_user = db.scalar(
            select(User).where(
                User.email == email
            )
        )

        if existing_user:
            print("Email already registered.")
            return

        admin = User(
            full_name=name,
            email=email,
            password_hash=hash_password(password),
            role="superadmin",
            is_active=True,
        )

        db.add(admin)
        db.commit()

        print("Super Admin created successfully!")
        print("Email:", email)
        print("Role: superadmin")


if __name__ == "__main__":
    create_superadmin()
