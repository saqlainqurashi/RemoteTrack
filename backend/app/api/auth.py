
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.core.dependencies import DBSession, CurrentUser
from app.core.security import (
    verify_password,
    create_access_token,
    hash_password,
)
from app.models.user import User
from app.schemas.user import (
    TokenResponse,
    UserResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

# Used to reduce account-enumeration timing differences
DUMMY_HASH = hash_password("dummy-password-for-login")


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    form_data: Annotated[
        OAuth2PasswordRequestForm,
        Depends(),
    ],
    db: DBSession,
):
    email = form_data.username.strip().lower()

    # 1. Find user in PostgreSQL
    user = db.scalar(
        select(User).where(User.email == email)
    )

    # 2. Verify password even if user does not exist
    stored_hash = (
        user.password_hash if user else DUMMY_HASH
    )

    is_valid = verify_password(
        form_data.password,
        stored_hash,
    )

    # 3. Reject invalid or inactive accounts
    if (
        user is None
        or not is_valid
        or not user.is_active
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    # 4. Generate access token
    access_token = create_access_token(user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_profile(
    current_user: CurrentUser,
):
    return current_user
