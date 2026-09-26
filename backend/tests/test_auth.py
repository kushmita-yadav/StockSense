import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from app.core.config import Settings, settings

@pytest.mark.asyncio
async def test_signup_and_login(client: AsyncClient, test_db):
    # 1. Signup
    signup_payload = {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "password": "Password123!",
        "role": "INVENTORY_MANAGER"
    }
    signup_resp = await client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_resp.status_code == 201
    user_data = signup_resp.json()
    assert user_data["email"] == "jane@example.com"
    assert user_data["role"] == "INVENTORY_MANAGER"

    # 2. Duplicate signup fails
    dup_resp = await client.post("/api/v1/auth/signup", json=signup_payload)
    assert dup_resp.status_code == 400

    # 3. Login
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "jane@example.com",
        "password": "Password123!"
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["user"]["email"] == "jane@example.com"

    # 4. Access /me endpoint
    token = token_data["access_token"]
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["name"] == "Jane Doe"

@pytest.mark.asyncio
async def test_otp_password_reset(client: AsyncClient, seed_data):
    # 1. Request OTP
    otp_resp = await client.post("/api/v1/auth/request-otp", json={"email": "manager@test.com"})
    assert otp_resp.status_code == 200
    otp_data = otp_resp.json()
    assert "otp_debug" in otp_data
    otp_code = otp_data["otp_debug"]

    # 2. Reset Password
    reset_resp = await client.post("/api/v1/auth/reset-password", json={
        "email": "manager@test.com",
        "otp_code": otp_code,
        "new_password": "NewSuperPassword123!"
    })
    assert reset_resp.status_code == 200

    # 3. Login with old password fails
    old_login = await client.post("/api/v1/auth/login", json={
        "email": "manager@test.com",
        "password": "Manager123!"
    })
    assert old_login.status_code == 401

    # 4. Login with new password succeeds
    new_login = await client.post("/api/v1/auth/login", json={
        "email": "manager@test.com",
        "password": "NewSuperPassword123!"
    })
    assert new_login.status_code == 200

@pytest.mark.asyncio
async def test_otp_is_sent_without_debug_code_outside_development(
    client: AsyncClient, seed_data, monkeypatch
):
    sent_email = {}

    async def capture_email(recipient: str, code: str):
        sent_email.update(recipient=recipient, code=code)

    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.test")
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", "stock@example.test")
    monkeypatch.setattr("app.api.v1.auth.send_otp_email", capture_email)

    response = await client.post(
        "/api/v1/auth/request-otp", json={"email": "manager@test.com"}
    )

    assert response.status_code == 200
    assert "otp_debug" not in response.json()
    assert sent_email["recipient"] == "manager@test.com"
    assert len(sent_email["code"]) == 6

def test_production_settings_reject_development_defaults():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, APP_ENV="production")

def test_hardened_production_settings_are_accepted():
    production_settings = Settings(
        _env_file=None,
        APP_ENV="production",
        SECRET_KEY="s" * 48,
        DATABASE_URL="postgresql+asyncpg://user:pass@db.example.test/stocksense",
        COOKIE_SECURE=True,
        CORS_ORIGINS=["https://stocksense.example.test"],
        SMTP_HOST="smtp.example.test",
        SMTP_FROM_EMAIL="no-reply@stocksense.example.test",
    )

    assert production_settings.smtp_configured

@pytest.mark.asyncio
async def test_rbac_guard(client: AsyncClient, seed_data, staff_token, manager_token):
    # Warehouse staff attempting to create a category -> 403 Forbidden
    forbidden_resp = await client.post(
        "/api/v1/products/categories",
        json={"name": "Restricted Category"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert forbidden_resp.status_code == 403

    # Manager creating category -> 201 Created
    allowed_resp = await client.post(
        "/api/v1/products/categories",
        json={"name": "Restricted Category"},
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert allowed_resp.status_code == 201
