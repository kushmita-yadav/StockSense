import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from app.core.config import settings


async def send_otp_email(recipient: str, code: str, purpose: str = "reset your StockSense password") -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP email delivery is not configured.")

    message = EmailMessage()
    message["Subject"] = "StockSense verification code"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = recipient
    message.set_content(
        f"Your code to {purpose} is {code}. "
        f"It expires in {settings.OTP_EXPIRE_MINUTES} minutes. "
        "If you did not request this reset, you can ignore this email."
    )

    def deliver() -> None:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.starttls(context=ssl.create_default_context())
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
            smtp.send_message(message)

    await asyncio.to_thread(deliver)
