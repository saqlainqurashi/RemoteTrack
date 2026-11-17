from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import DBSession, SuperAdmin
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import MemberCreate, UserResponse


router = APIRouter(prefix="/members", tags=["Members"])


@router.get("", response_model=list[UserResponse])
def list_members(db: DBSession, current_user: SuperAdmin):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("", response_model=UserResponse, status_code=201)
def create_member(payload: MemberCreate, db: DBSession, current_user: SuperAdmin):
    full_name = payload.full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(status_code=422, detail="Full name must contain at least two characters")

    email = str(payload.email).strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    member = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(payload.password),
        role="member",
        is_active=True,
    )
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    db.refresh(member)
    return member
