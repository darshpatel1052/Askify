# Password utility functions with robust bcrypt / hashlib fallback
import hashlib
import os

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

def get_password_hash(password: str) -> str:
    """Hash password securely using bcrypt with fallback to salted pbkdf2_sha256"""
    if HAS_BCRYPT:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    else:
        salt = os.urandom(16).hex()
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return f"pbkdf2${salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored hash"""
    if not hashed_password or not plain_password:
        return False
    try:
        if hashed_password.startswith('$2b$') or hashed_password.startswith('$2a$'):
            if HAS_BCRYPT:
                return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
            return False
        elif hashed_password.startswith('pbkdf2$'):
            parts = hashed_password.split('$')
            if len(parts) == 3:
                salt = parts[1]
                stored_key = parts[2]
                key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
                return key.hex() == stored_key
    except Exception:
        return False
    return False
