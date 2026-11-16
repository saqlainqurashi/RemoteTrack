
from typing import Annotated

import jwt
from jwt.exceptions import InvalidTokenError

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.orm import Session

from app.core.config import SECRET_KEY, ALGORITHM
from app.core.database import get_db
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)

DBSession = Annotated[
    Session,
    Depends(get_db),
]


def get_current_user(
    token: Annotated[
        str,
        Depends(oauth2_scheme),
    ],
    db: DBSession,
) -> User:

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "require": ["sub", "exp", "iat"]
            },
        )

        user_id = int(payload["sub"])

        if user_id <= 0:
            raise ValueError("Invalid user ID")

    except (InvalidTokenError, ValueError, TypeError):
        raise credentials_error

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise credentials_error

    return user


CurrentUser = Annotated[
    User,
    Depends(get_current_user),
]


def require_superadmin(
    current_user: CurrentUser,
) -> User:

    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=403,
            detail="Super Admin access required",
        )

    return current_user


SuperAdmin = Annotated[
    User,
    Depends(require_superadmin),
]
