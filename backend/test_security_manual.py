
from app.core.security import hash_password, verify_password

password = "TestPassword123!"

# Generate password hash
hashed = hash_password(password)

# Test hashing
print("Hash generated:", hashed.startswith("$argon2"))

# Test correct password
print("Password valid:", verify_password(password, hashed))

# Test incorrect password
print(
    "Wrong password rejected:",
    not verify_password("WrongPassword", hashed)
)
