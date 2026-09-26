from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_new_account_starts_with_private_empty_workspace(client: AsyncClient, seed_data, manager_token):
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    signup = await client.post("/api/v1/auth/signup", json={
        "name": "Separate Owner",
        "email": "separate@example.com",
        "password": "Password123!",
        # Role is forced to manager for the new, isolated workspace.
        "role": "WAREHOUSE_STAFF",
    })
    assert signup.status_code == 201
    signup_data = signup.json()
    verified = await client.post("/api/v1/auth/verify-signup", json={
        "email": "separate@example.com",
        "otp_code": signup_data["otp_debug"],
    })
    assert verified.status_code == 200
    assert verified.json()["user"]["role"] == "INVENTORY_MANAGER"

    new_headers = {"Authorization": f"Bearer {verified.json()['access_token']}"}

    manager_products = await client.get("/api/v1/products", headers=manager_headers)
    new_products = await client.get("/api/v1/products", headers=new_headers)
    assert len(manager_products.json()) == 1
    assert new_products.json() == []

    manager_warehouses = await client.get("/api/v1/warehouses", headers=manager_headers)
    new_warehouses = await client.get("/api/v1/warehouses", headers=new_headers)
    assert len(manager_warehouses.json()) == 1
    assert new_warehouses.json() == []

    foreign_product = manager_products.json()[0]
    detail = await client.get(f"/api/v1/products/{foreign_product['id']}", headers=new_headers)
    assert detail.status_code == 404

    dashboard = await client.get("/api/v1/dashboard/kpis", headers=new_headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["total_products"] == 0
    assert dashboard.json()["recent_activities"] == []

    history = await client.get("/api/v1/ledger", headers=new_headers)
    assert history.status_code == 200
    assert history.json()["total"] == 0


@pytest.mark.asyncio
async def test_invited_staff_shares_manager_workspace(client: AsyncClient, seed_data, manager_token):
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    invite_response = await client.post("/api/v1/auth/workspace-invite", headers=manager_headers)
    assert invite_response.status_code == 200
    invite_code = invite_response.json()["invite_code"]

    signup = await client.post("/api/v1/auth/signup", json={
        "name": "Joined Staff",
        "email": "joined@example.com",
        "password": "Password123!",
        "invite_code": invite_code,
    })
    assert signup.status_code == 201
    verified = await client.post("/api/v1/auth/verify-signup", json={
        "email": "joined@example.com",
        "otp_code": signup.json()["otp_debug"],
    })
    assert verified.status_code == 200
    assert verified.json()["user"]["role"] == "WAREHOUSE_STAFF"

    staff_headers = {"Authorization": f"Bearer {verified.json()['access_token']}"}
    manager_products = await client.get("/api/v1/products", headers=manager_headers)
    staff_products = await client.get("/api/v1/products", headers=staff_headers)
    assert [item["id"] for item in staff_products.json()] == [item["id"] for item in manager_products.json()]

    foreign_product_id = manager_products.json()[0]["id"]
    shared_detail = await client.get(f"/api/v1/products/{foreign_product_id}", headers=staff_headers)
    assert shared_detail.status_code == 200

@pytest.mark.asyncio
async def test_assistant_requires_server_groq_key(client: AsyncClient, manager_token, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    response = await client.post("/api/v1/assistant/chat", json={"question": "What is in stock?"}, headers={"Authorization": f"Bearer {manager_token}"})
    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.json()["detail"]


@pytest.mark.asyncio
async def test_assistant_context_contains_only_signed_in_workspace(client: AsyncClient, test_db, seed_data, manager_token, monkeypatch):
    from app.core.config import settings
    from app.models.product import Product, ProductCategory

    staff = seed_data["staff"]
    staff_category = ProductCategory(owner_id=staff.id, name="Private staff category")
    test_db.add(staff_category)
    await test_db.flush()
    test_db.add(Product(owner_id=staff.id, sku="PRIVATE-STAFF-01", name="Secret staff product", category_id=staff_category.id, uom="unit", min_stock_level=1))
    await test_db.commit()

    captured = {}
    class FakeResponse:
        def raise_for_status(self):
            return None
        def json(self):
            return {"choices": [{"message": {"content": "Your workspace has steel inventory."}}]}

    class FakeClient:
        def __init__(self, timeout):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return None
        async def post(self, url, *, headers, json):
            captured["url"] = url
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr("app.api.v1.assistant.httpx.AsyncClient", FakeClient)
    response = await client.post("/api/v1/assistant/chat", json={"question": "What is in stock?"}, headers={"Authorization": f"Bearer {manager_token}"})
    assert response.status_code == 200
    prompt = captured["payload"]["messages"][0]["content"]
    assert "Steel Rods" in prompt
    assert "Secret staff product" not in prompt
    assert captured["url"] == "https://api.groq.com/openai/v1/chat/completions"
