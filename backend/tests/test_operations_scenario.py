import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_steel_rods_full_lifecycle_scenario(client: AsyncClient, seed_data, manager_token, staff_token):
    """
    Authoritative test scenario:
    1. Receipt: +50 units (Vendor -> Stock)
    2. Transfer: 30 units (Stock -> Rack A)
    3. Delivery: -20 units (Rack A -> Customer)
    4. Adjustment: -3 units damaged (Rack A -> Loss Virtual, counted 7)

    Hand-calculated Expected Balances:
    - Stock: 20.00 units
    - Rack A: 7.00 units
    - Total physical inventory: 27.00 units
    - Move history entries: 4
    """
    prod_id = str(seed_data["product"].id)
    loc_stock_id = str(seed_data["loc_stock"].id)
    loc_rack_a_id = str(seed_data["loc_rack_a"].id)
    loc_vendor_id = str(seed_data["loc_vendor"].id)
    loc_customer_id = str(seed_data["loc_customer"].id)

    mgr_headers = {"Authorization": f"Bearer {manager_token}"}
    staff_headers = mgr_headers

    # STEP 1: RECEIPT (+50 units Vendor -> Stock)
    receipt_payload = {
        "operation_type": "RECEIPT",
        "source_location_id": loc_vendor_id,
        "destination_location_id": loc_stock_id,
        "contact_name": "Apex Steel Works",
        "lines": [{"product_id": prod_id, "quantity_demanded": 50.0}]
    }
    rec_res = await client.post("/api/v1/operations", json=receipt_payload, headers=mgr_headers)
    assert rec_res.status_code == 201
    rec_data = rec_res.json()
    rec_id = rec_data["id"]

    # Validate receipt
    rec_val = await client.post(f"/api/v1/operations/{rec_id}/validate", json={}, headers=mgr_headers)
    assert rec_val.status_code == 200
    assert rec_val.json()["status"] == "DONE"

    # STEP 2: TRANSFER (30 units Stock -> Rack A)
    transfer_payload = {
        "product_id": prod_id,
        "from_location_id": loc_stock_id,
        "to_location_id": loc_rack_a_id,
        "quantity": 30.0
    }
    trans_res = await client.post("/api/v1/operations/transfers/quick", json=transfer_payload, headers=staff_headers)
    assert trans_res.status_code == 201
    assert trans_res.json()["status"] == "DONE"

    # STEP 3: DELIVERY (-20 units Rack A -> Customer)
    delivery_payload = {
        "operation_type": "DELIVERY",
        "source_location_id": loc_rack_a_id,
        "destination_location_id": loc_customer_id,
        "contact_name": "BuildCorp Construction",
        "lines": [{"product_id": prod_id, "quantity_demanded": 20.0}]
    }
    del_res = await client.post("/api/v1/operations", json=delivery_payload, headers=staff_headers)
    assert del_res.status_code == 201
    del_id = del_res.json()["id"]

    # Advance Delivery status (DRAFT -> WAITING -> READY)
    adv1 = await client.put(f"/api/v1/operations/{del_id}/advance-status?target_status=WAITING", headers=staff_headers)
    assert adv1.status_code == 200
    assert adv1.json()["status"] == "WAITING"

    adv2 = await client.put(f"/api/v1/operations/{del_id}/advance-status?target_status=READY", headers=staff_headers)
    assert adv2.status_code == 200
    assert adv2.json()["status"] == "READY"

    # Validate Delivery
    del_val = await client.post(f"/api/v1/operations/{del_id}/validate", json={}, headers=staff_headers)
    assert del_val.status_code == 200
    assert del_val.json()["status"] == "DONE"

    # STEP 4: ADJUSTMENT (Count Rack A, physical actual = 7.0, -3 damaged)
    adj_payload = {
        "product_id": prod_id,
        "location_id": loc_rack_a_id,
        "counted_quantity": 7.0,
        "reason_code": "DAMAGED"
    }
    adj_res = await client.post("/api/v1/operations/adjustments/quick", json=adj_payload, headers=staff_headers)
    assert adj_res.status_code == 201
    assert adj_res.json()["status"] == "DONE"

    # FINAL VERIFICATIONS
    # 1. Product details & per-location balances
    prod_res = await client.get(f"/api/v1/products/{prod_id}", headers=mgr_headers)
    assert prod_res.status_code == 200
    prod_data = prod_res.json()
    assert float(prod_data["total_on_hand"]) == 27.0
    assert float(prod_data["total_available"]) == 27.0

    loc_stocks = {item["location_name"]: float(item["on_hand"]) for item in prod_data["stock_by_location"]}
    assert loc_stocks["Stock"] == 20.0
    assert loc_stocks["Rack A"] == 7.0

    # 2. Move History over stock_ledger
    ledger_res = await client.get(f"/api/v1/ledger?product_id={prod_id}", headers=mgr_headers)
    assert ledger_res.status_code == 200
    ledger_data = ledger_res.json()
    assert ledger_data["total"] == 4

    # 3. Quants list
    quants_res = await client.get(f"/api/v1/ledger/quants?product_id={prod_id}", headers=mgr_headers)
    assert quants_res.status_code == 200
    quants = {q["location_name"]: float(q["on_hand"]) for q in quants_res.json()}
    assert quants["Stock"] == 20.0
    assert quants["Rack A"] == 7.0

    # 4. Materialized view rebuild integrity check
    rebuild_res = await client.post(f"/api/v1/ledger/rebuild?product_id={prod_id}", headers=mgr_headers)
    assert rebuild_res.status_code == 200
    assert rebuild_res.json()["status"] == "success"

    # Re-verify after rebuild
    prod_after_rebuild = (await client.get(f"/api/v1/products/{prod_id}", headers=mgr_headers)).json()
    assert float(prod_after_rebuild["total_on_hand"]) == 27.0

@pytest.mark.asyncio
async def test_advance_operation_uses_next_status_by_default(
    client: AsyncClient, seed_data, manager_token
):
    headers = {"Authorization": f"Bearer {manager_token}"}
    created = await client.post(
        "/api/v1/operations",
        json={
            "operation_type": "RECEIPT",
            "destination_location_id": str(seed_data["loc_stock"].id),
            "lines": [{
                "product_id": str(seed_data["product"].id),
                "quantity_demanded": 1,
            }],
        },
        headers=headers,
    )
    assert created.status_code == 201
    operation_id = created.json()["id"]

    waiting = await client.put(
        f"/api/v1/operations/{operation_id}/advance-status", headers=headers
    )
    assert waiting.status_code == 200
    assert waiting.json()["status"] == "WAITING"

    ready = await client.put(
        f"/api/v1/operations/{operation_id}/advance-status", headers=headers
    )
    assert ready.status_code == 200
    assert ready.json()["status"] == "READY"
