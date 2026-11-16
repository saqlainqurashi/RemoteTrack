
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY or len(SECRET_KEY) < 64:
    raise RuntimeError(
        "JWT_SECRET_KEY must be at least "
        "64 characters long"
    )

ALGORITHM = "HS256"

if os.getenv("JWT_ALGORITHM", ALGORITHM) != ALGORITHM:
    raise RuntimeError("Unsupported JWT algorithm")

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError("Token expiry must be positive")
