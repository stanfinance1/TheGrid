"""Workshop Town Hive - Visualization Server.

Serves the pixel art dashboard and provides API endpoints
for real-time agent state and work item data from Supabase.

Self-contained: no parent directory imports needed (deploys standalone on Railway).
"""

import os
import json
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from supabase import create_client

# ---------------------------------------------------------------------------
# Security: Bearer token auth for API endpoints
# ---------------------------------------------------------------------------
VIZ_AUTH_TOKEN = os.environ.get("VIZ_AUTH_TOKEN", "")


async def _auth_middleware(request: Request, call_next):
    """Require Bearer token for /api/* endpoints (except health)."""
    path = request.url.path
    if path.startswith("/api/") and path != "/api/health" and VIZ_AUTH_TOKEN:
        auth = request.headers.get("Authorization", "")
        # Also allow ?token= query param for browser convenience
        query_token = request.query_params.get("token", "")
        if auth != f"Bearer {VIZ_AUTH_TOKEN}" and query_token != VIZ_AUTH_TOKEN:
            return JSONResponse(status_code=401, content={"error": "unauthorized"})
    return await call_next(request)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("viz")

_client = None

def get_client():
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            logger.warning("SUPABASE_URL or SUPABASE_KEY not set")
            return None
        _client = create_client(url, key)
    return _client

PT = ZoneInfo("America/Los_Angeles")

# ── Cron state ───────────────────────────────────────────
_cron_last_run = None
_cron_next_run = None

def _calc_next_midnight():
    """Return the next midnight PT as a datetime."""
    now = datetime.now(PT)
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return tomorrow

async def _dispatch_daily_backfill():
    """Insert a work item into Supabase so the Hive picks up the backfill."""
    global _cron_last_run
    client = get_client()
    if not client:
        logger.warning("Cron: no Supabase client, skipping backfill dispatch")
        return
    yesterday = (datetime.now(PT) - timedelta(days=1)).strftime("%Y-%m-%d")
    try:
        client.table("work_items").insert({
            "title": f"Daily Metrics Backfill ({yesterday})",
            "description": (
                f"Automated: Use trigger_data_backfill to refresh shopify_dtc "
                f"and meta_ads daily_metrics for {yesterday}. "
                f"Call trigger_data_backfill for each source with date {yesterday}."
            ),
            "assignee": "watchtower",
            "filed_by": "viz-cron",
            "status": "open",
            "priority": "medium",
        }).execute()
        _cron_last_run = datetime.now(PT).isoformat()
        logger.info(f"Cron: dispatched daily backfill for {yesterday}")
    except Exception as e:
        logger.error(f"Cron: failed to dispatch backfill: {e}")

async def _midnight_cron():
    """Sleep until midnight PT, dispatch backfill, repeat."""
    global _cron_next_run
    while True:
        _cron_next_run = _calc_next_midnight().isoformat()
        wait = (_calc_next_midnight() - datetime.now(PT)).total_seconds()
        if wait < 0:
            wait = 0
        await asyncio.sleep(wait)
        await _dispatch_daily_backfill()

@asynccontextmanager
async def lifespan(app):
    global _cron_next_run
    _cron_next_run = _calc_next_midnight().isoformat()
    task = asyncio.create_task(_midnight_cron())
    yield
    task.cancel()

app = FastAPI(title="Workshop Town Viz", lifespan=lifespan)
app.middleware("http")(_auth_middleware)

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/health")
async def health():
    """Lightweight health check - no Supabase calls.
    Used by the dashboard to determine server connectivity
    without being affected by Supabase latency or outages."""
    return {"status": "ok"}


@app.get("/")
async def index():
    return FileResponse(str(static_dir / "index.html"))


@app.get("/api/state")
async def get_state():
    """Single endpoint returning full visualization state.
    Polled every few seconds by the dashboard."""
    client = get_client()
    hooks = []
    items = []

    if client:
        try:
            hooks = client.table("agent_hooks").select("*").execute().data or []
        except Exception as e:
            logger.error(f"get_all_hooks failed: {e}")

        try:
            result = (
                client.table("work_items")
                .select("*")
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            items = result.data or []
        except Exception as e:
            logger.error(f"get_work_items failed: {e}")

    # Active = only items currently being worked on or awaiting human input
    active = [i for i in items if i["status"] in ("claimed", "in_progress", "pending_human")]
    # Queued = open items not yet picked up
    queued = [i for i in items if i["status"] == "open"]
    recent_done = [i for i in items if i["status"] in ("done", "failed")][:10]

    return {
        "agents": hooks,
        "work_items": {
            "active": active,
            "queued": queued,
            "recent": recent_done,
        },
    }


@app.get("/api/acquisition")
async def get_acquisition():
    """Acquisition dashboard: yesterday's metrics + 7-day trailing averages."""
    client = get_client()
    if not client:
        return {"error": "no_db"}

    today = datetime.now(PT).date()
    yesterday = today - timedelta(days=1)
    week_start = today - timedelta(days=7)  # 7 days ending yesterday

    def _query(source, start, end):
        try:
            rows = (
                client.table("daily_metrics")
                .select("date, data")
                .eq("source", source)
                .gte("date", str(start))
                .lte("date", str(end))
                .order("date")
                .execute()
            ).data or []
            return rows
        except Exception as e:
            logger.error(f"acquisition query failed ({source}): {e}")
            return []

    meta_rows = _query("meta_ads", week_start, yesterday)
    shop_rows = _query("shopify_dtc", week_start, yesterday)
    skio_rows = _query("skio", week_start, yesterday)

    def _parse_data(raw):
        """Parse data field - may be dict or JSON string."""
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                return {}
        return {}

    def _find_day(rows, date_str):
        for r in rows:
            if r["date"] == date_str:
                return _parse_data(r["data"])
        return None

    def _avg(rows, keys):
        if not rows:
            return None
        result = {}
        for k in keys:
            vals = []
            for r in rows:
                data = _parse_data(r.get("data"))
                if k in data:
                    vals.append(data[k])
            result[k] = round(sum(vals) / len(vals), 2) if vals else 0
        return result

    def _sum(rows, key):
        """Sum a single key across all rows."""
        total = 0
        for r in rows:
            data = _parse_data(r.get("data"))
            total += data.get(key, 0)
        return total

    meta_keys = ["spend", "cpa", "conversions", "impressions", "clicks", "ctr", "cpm"]
    shop_keys = ["total_sales", "orders", "aov", "net_sales", "gross_sales",
                 "new_customers"]

    # Stan's Corner: bCAC = total spend / total new customers
    yd_meta = _find_day(meta_rows, str(yesterday))
    yd_shop = _find_day(shop_rows, str(yesterday))
    yd_skio = _find_day(skio_rows, str(yesterday))

    yd_new_cust = (yd_shop or {}).get("new_customers", 0)
    yd_spend = (yd_meta or {}).get("spend", 0)
    yd_bcac = round(yd_spend / yd_new_cust, 2) if yd_new_cust else None
    yd_new_subs = (yd_skio or {}).get("new_subscriptions", 0)

    # 7-day totals for bCAC (sum, not avg)
    t7_spend = _sum(meta_rows, "spend")
    t7_new_cust = _sum(shop_rows, "new_customers")
    t7_bcac = round(t7_spend / t7_new_cust, 2) if t7_new_cust else None
    t7_new_subs = _sum(skio_rows, "new_subscriptions")

    return {
        "yesterday": {
            "date": str(yesterday),
            "meta": yd_meta,
            "shopify": yd_shop,
        },
        "trailing_7d_avg": {
            "start": str(week_start),
            "end": str(yesterday),
            "days_with_data": {
                "meta": len(meta_rows),
                "shopify": len(shop_rows),
            },
            "meta": _avg(meta_rows, meta_keys),
            "shopify": _avg(shop_rows, shop_keys),
        },
        "stans_corner": {
            "yesterday": {
                "new_customers": yd_new_cust,
                "bcac": yd_bcac,
                "new_subscribers": yd_new_subs,
            },
            "trailing_7d": {
                "new_customers": t7_new_cust,
                "bcac": t7_bcac,
                "new_subscribers": t7_new_subs,
                "days": len(shop_rows),
            },
        },
        "as_of": datetime.now(PT).isoformat(),
    }


@app.get("/api/overseer-log")
async def overseer_log():
    """Return the Overseer's audit trail (agent_improvements table)."""
    client = get_client()
    if not client:
        return {"improvements": []}
    try:
        result = (
            client.table("agent_improvements")
            .select("*")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return {"improvements": result.data or []}
    except Exception as e:
        logger.error(f"overseer_log query failed: {e}")
        return {"improvements": []}


@app.post("/api/demo")
async def demo_fireworks():
    """Trigger a demo: briefly set all agents to 'working' then back to 'idle'.
    The frontend will detect the state changes and play fireworks animations."""
    client = get_client()
    if not client:
        return {"error": "no_db"}

    agent_names = ["ledger", "scout", "scribe", "advisor", "watchtower"]
    try:
        # Set all to working (Foreman/Overseer stay as-is since they have special behavior)
        for name in agent_names:
            client.table("agent_hooks").update({"status": "working"}).eq("agent_name", name).execute()
        logger.info("Demo: all agents set to working")

        # Wait 12 seconds for the frontend to show the walking + working animations
        await asyncio.sleep(12)

        # Set back to idle (triggers celebrating/fireworks on the frontend)
        for name in agent_names:
            client.table("agent_hooks").update({"status": "idle"}).eq("agent_name", name).execute()
        logger.info("Demo: all agents set to idle - fireworks!")

        return {"status": "ok", "message": "Demo complete - fireworks triggered!"}
    except Exception as e:
        logger.error(f"Demo failed: {e}")
        return {"error": str(e)}


@app.get("/api/cron-status")
async def cron_status():
    """Return scheduled recurring tasks and their status."""
    return {
        "tasks": [
            {
                "name": "Daily Metrics Backfill",
                "schedule": "12:00 AM PT",
                "next_run": _cron_next_run,
                "last_run": _cron_last_run,
                "description": "Refresh Meta Ads + Shopify DTC metrics",
            },
        ],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
