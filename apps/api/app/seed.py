import bcrypt

def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# Example when creating users:
u = User(
    username="bcba1",
    role="BCBA",
    hashed_password=hash_pw("1234"),  # store bcrypt hash, not plaintext
)
