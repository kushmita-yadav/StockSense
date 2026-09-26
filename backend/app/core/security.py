import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List
from jose import jwt, JWTError
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from app.core.config import settings

# Argon2id password hasher
ph = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

# In-memory rate limiter structures
# failed_logins: {ip_or_email: [(timestamp), ...]}
failed_logins: Dict[str, List[float]] = {}
# otp_requests: {email: [(timestamp), ...]}
otp_requests: Dict[str, List[float]] = {}

def hash_password(password: str) -> str:
    """Hashes a password using Argon2id."""
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against an Argon2id hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Encodes JWT token with payload and expiration."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes JWT token and validates payload."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

def generate_otp() -> str:
    """Generates a secure 6-digit numeric OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(6))

def hash_otp(otp: str) -> str:
    """Hashes the OTP code using Argon2id."""
    return ph.hash(otp)

def verify_otp(otp: str, hashed_otp: str) -> bool:
    """Verifies user-provided OTP against hash."""
    try:
        return ph.verify(hashed_otp, otp)
    except (VerifyMismatchError, InvalidHashError):
        return False

# Rate Limiting Utilities
def check_login_rate_limit(identifier: str) -> bool:
    """Returns True if identifier (IP/email) is allowed, False if rate-limited (>10 failed attempts in 15 min)."""
    now = time.time()
    cutoff = now - 900  # 15 minutes
    attempts = [t for t in failed_logins.get(identifier, []) if t > cutoff]
    failed_logins[identifier] = attempts
    return len(attempts) < settings.LOGIN_MAX_FAILED_ATTEMPTS

def record_login_failure(identifier: str):
    now = time.time()
    if identifier not in failed_logins:
        failed_logins[identifier] = []
    failed_logins[identifier].append(now)

def clear_login_failures(identifier: str):
    if identifier in failed_logins:
        del failed_logins[identifier]

def check_otp_rate_limit(email: str) -> bool:
    """Returns True if email is allowed (max 5 requests per hour), False if rate-limited."""
    now = time.time()
    cutoff = now - 3600  # 1 hour
    requests = [t for t in otp_requests.get(email, []) if t > cutoff]
    otp_requests[email] = requests
    return len(requests) < settings.OTP_MAX_PER_HOUR

def record_otp_request(email: str):
    now = time.time()
    if email not in otp_requests:
        otp_requests[email] = []
    otp_requests[email].append(now)
