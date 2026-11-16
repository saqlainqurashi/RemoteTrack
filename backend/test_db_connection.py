
from sqlalchemy import text
from app.core.database import engine

print("Connecting to PostgreSQL...")

with engine.connect() as connection:
    result = connection.execute(
        text("SELECT current_database()")
    )

    print("Database connected successfully!")
    print("Database name:", result.scalar())
