import os

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
APPSCRIPT_FALLBACK_URL = os.environ.get("APPSCRIPT_FALLBACK_URL", "")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

_REST_URL = f"{SUPABASE_URL}/rest/v1/dashboard_cache"

app = FastAPI(title="2SLASH4 Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Must match the `handlers` keys in albacore/Code.js's serveDashboardApi_.
API_NAMES = {"platform", "total", "krProduct", "krProductSales", "krFunnel", "promotion", "jpFunnel"}


async def get_cached(api: str, month: int) -> dict | None:
    """Read the precomputed payload Apps Script last pushed for (api, month)."""
    params = {"api": f"eq.{api}", "month": f"eq.{month}", "select": "data,updated_at", "limit": "1"}
    headers = {"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {SUPABASE_ANON_KEY}"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(_REST_URL, params=params, headers=headers)
        resp.raise_for_status()
        rows = resp.json()
    return rows[0] if rows else None


async def backfill_cache(api: str, month: int, data: dict) -> None:
    """Best-effort write-back after an Apps Script fallback fetch.

    Only runs when a service_role key is configured - it bypasses RLS, so it
    must never be exposed to the browser. Silently no-ops otherwise; a missing
    backfill just means the next request falls back to Apps Script again.
    """
    if not SUPABASE_SERVICE_KEY:
        return
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(_REST_URL, params={"on_conflict": "api,month"}, headers=headers, json={"api": api, "month": month, "data": data})


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/{api}")
async def get_dashboard_data(api: str, month: int = Query(default=9, ge=1, le=12)):
    if api not in API_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown api: {api}")

    row = await get_cached(api, month)
    if row is not None:
        return {"ok": True, "data": row["data"], "cached": True, "updatedAt": row["updated_at"]}

    if not APPSCRIPT_FALLBACK_URL:
        raise HTTPException(
            status_code=404,
            detail=f"No synced data for {api}/{month} yet, and no Apps Script fallback is configured.",
        )

    # Apps Script hasn't pushed this (api, month) yet - fetch it live once,
    # same as the dashboard used to do directly, and cache it for next time.
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(APPSCRIPT_FALLBACK_URL, params={"api": api, "month": month}, follow_redirects=True)
        resp.raise_for_status()
        body = resp.json()

    if body.get("ok") is False:
        raise HTTPException(status_code=502, detail=body.get("error", "Apps Script returned an error"))

    data = body.get("data", body)
    await backfill_cache(api, month, data)
    return {"ok": True, "data": data, "cached": False}
