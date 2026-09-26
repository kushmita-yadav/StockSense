from datetime import datetime, timedelta, timezone
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.email import send_otp_email
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_otp,
    hash_otp,
    verify_otp,
    check_login_rate_limit,
    record_login_failure,
    clear_login_failures,
    check_otp_rate_limit,
    record_otp_request
)
from app.models.user import User, OTPReset
from app.schemas.auth import (
    SignupRequest,
    LoginRequest,
    UserResponse,
    TokenResponse,
    OTPRequest,
    ResetPasswordRequest
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_in: SignupRequest, db: AsyncSession = Depends(get_db)):
    if user_in.role != "WAREHOUSE_STAFF":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public signup creates warehouse staff accounts only. Contact your system administrator to request manager access."
        )
    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == user_in.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Hash password with Argon2id
    pwd_hash = hash_password(user_in.password)
    new_user = User(
        name=user_in.name.strip(),
        email=user_in.email.lower(),
        password_hash=pwd_hash,
        role="WAREHOUSE_STAFF",
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login", response_model=TokenResponse)
async def login(
    login_in: LoginRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}:{login_in.email.lower()}"

    if not check_login_rate_limit(rate_limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 15 minutes before trying again."
        )

    res = await db.execute(select(User).where(User.email == login_in.email.lower()))
    user = res.scalar_one_or_none()

    if not user or not verify_password(login_in.password, user.password_hash):
        record_login_failure(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated."
        )

    clear_login_failures(rate_limit_key)

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role, "email": user.email}
    )

    # Set HttpOnly, Secure, SameSite Cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path="/"
    )
    return {"message": "Successfully logged out."}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/request-otp")
async def request_otp(otp_in: OTPRequest, db: AsyncSession = Depends(get_db)):
    email_clean = otp_in.email.lower()
    if not check_otp_rate_limit(email_clean):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 5 OTP requests per hour allowed for this email."
        )

    res = await db.execute(select(User).where(User.email == email_clean))
    user = res.scalar_one_or_none()

    if not user:
        # Return generic success to prevent email enumeration
        return {
            "message": "If an account exists with this email, an OTP code has been generated."
        }

    if not settings.smtp_configured and settings.APP_ENV != "development":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email delivery is not configured."
        )

    record_otp_request(email_clean)
    code = generate_otp()
    code_hash = hash_otp(code)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    otp_record = OTPReset(
        user_id=user.id,
        otp_code_hash=code_hash,
        expires_at=expires_at,
        used=False
    )
    db.add(otp_record)
    await db.commit()

    if settings.smtp_configured:
        try:
            await send_otp_email(email_clean, code)
        except Exception as exc:
            otp_record.used = True
            await db.commit()
            logger.exception("Password reset email delivery failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not send the password reset email. Please try again."
            ) from exc

    result = {
        "message": "OTP email sent successfully." if settings.smtp_configured else
            f"OTP generated successfully. Expires in {settings.OTP_EXPIRE_MINUTES} minutes."
    }
    if settings.APP_ENV == "development" and not settings.smtp_configured:
        result["otp_debug"] = code
    return result

@router.post("/reset-password")
async def reset_password(reset_in: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == reset_in.email.lower()))
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Find the latest unused, non-expired OTP for this user
    stmt = (
        select(OTPReset)
        .where(
            OTPReset.user_id == user.id,
            OTPReset.used == False,
            OTPReset.expires_at > datetime.now(timezone.utc)
        )
        .order_by(OTPReset.created_at.desc())
    )
    otp_res = await db.execute(stmt)
    records = otp_res.scalars().all()

    matched_record = None
    for rec in records:
        if verify_otp(reset_in.otp_code, rec.otp_code_hash):
            matched_record = rec
            break

    if not matched_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code."
        )

    # Invalidate OTP and set new password
    matched_record.used = True
    user.password_hash = hash_password(reset_in.new_password)
    await db.commit()

    return {"message": "Password has been successfully updated. You may now log in with your new password."}
