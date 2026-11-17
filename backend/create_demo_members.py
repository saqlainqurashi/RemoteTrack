"""Create two demo members in the configured database."""

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User


DEMO_MEMBERS = (
    ("Demo Member One", "demo.member1@example.com",),
    ("Demo Member Two", "demo.member2@example.com"),
    ("Anas Raza", "anas.raza@example.com")
)
DEMO_PASSWORD = "12345678"


def create_demo_members():
    with SessionLocal.begin() as db:
        existing_emails = set(
            db.scalars(
                select(User.email).where(
                    User.email.in_([email for _, email in DEMO_MEMBERS])
                )
            )
        )
        created_emails = []
        for full_name, email in DEMO_MEMBERS:
            if email in existing_emails:
                continue

            db.add(
                User(
                    full_name=full_name,
                    email=email,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role="member",
                    is_active=True,
                )
            )
            created_emails.append(email)

    for email in created_emails:
        print(f"Created demo member {email}")
    print(f"Created {len(created_emails)} demo members.")
    if created_emails:
        print(f"Demo password {DEMO_PASSWORD}")


if __name__ == "__main__":
    create_demo_members()
