import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import supabase_client
from config import settings

app = FastAPI(title="2SLASH4 Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Must match the `handlers` keys in albacore/Code.js's serveDashboardApi_.
API_NAMES = {"platform", "total", "krProduct", "krProductSales", "krFunnel", "promotion", "jpFunnel"}


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/{api}")
async def get_dashboard_data(api: str, month: int = Query(default=9, ge=1, le=12)):
    if api not in API_NAMES:
        raise HTTPException(status_code=404, detail=f"Unknown api: {api}")

    row = await supabase_client.get_cached(api, month)
    if row is not None:
        return {"ok": True, "data": row["data"], "cached": True, "updatedAt": row["updated_at"]}

    if not settings.appscript_fallback_url:
        raise HTTPException(
            status_code=404,
            detail=f"No synced data for {api}/{month} yet, and no Apps Script fallback is configured.",
        )

    # Apps Script hasn't pushed this (api, month) yet - fetch it live once,
    # same as the dashboard used to do directly, and cache it for next time.
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(settings.appscript_fallback_url, params={"api": api, "month": month}, follow_redirects=True)
        resp.raise_for_status()
        body = resp.json()

    if body.get("ok") is False:
        raise HTTPException(status_code=502, detail=body.get("error", "Apps Script returned an error"))

    data = body.get("data", body)
    await supabase_client.backfill_cache(api, month, data)
    return {"ok": True, "data": data, "cached": False}
