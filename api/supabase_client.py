import httpx

from config import settings

_REST_URL = f"{settings.supabase_url}/rest/v1/dashboard_cache"


async def get_cached(api: str, month: int) -> dict | None:
    """Read the precomputed payload Apps Script last pushed for (api, month)."""
    params = {"api": f"eq.{api}", "month": f"eq.{month}", "select": "data,updated_at", "limit": "1"}
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
    }
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
    if not settings.supabase_service_key:
        return
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(_REST_URL, params={"on_conflict": "api,month"}, headers=headers, json={"api": api, "month": month, "data": data})
