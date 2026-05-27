import json
import os
import sys
import sqlite3
import urllib.request
import urllib.error
from typing import List, Dict, Optional


SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

LEAD_FIELDS = [
    "name", "category", "location", "state", "city",
    "address", "phone", "website", "email",
    "facebook", "instagram", "twitter",
    "rating", "reviews_count", "source", "source_url",
    "timestamp",
]
NO_OVERWRITE = {"status", "notes"}


def _rest(path: str, method: str = "GET", body: Optional[dict] = None) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if method == "POST":
        headers["Prefer"] = "resolution=merge-duplicates"

    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return {"ok": True, "data": json.loads(raw) if raw else [], "status": resp.status}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "error": raw, "status": e.code}
    except Exception as e:
        return {"ok": False, "error": str(e), "status": 0}


def fetch_supabase_leads() -> Dict[int, dict]:
    result = _rest("leads?select=id,name,address,phone,status,notes")
    if not result.get("ok"):
        print(f"  Error fetching Supabase leads: {result.get('error', 'unknown')}")
        return {}
    return {r["id"]: r for r in result.get("data", [])}


def sync_leads(db_path: str, batch_size: int = 50):
    print(f"Connecting to SQLite: {db_path}")
    if not os.path.exists(db_path):
        print("  SQLite DB not found, nothing to sync.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM leads ORDER BY id").fetchall()
    conn.close()

    total = len(rows)
    print(f"  Found {total} leads in SQLite")

    if total == 0:
        print("Nothing to sync.")
        return

    print(f"Fetching existing leads from Supabase...")
    supabase_leads = fetch_supabase_leads()
    print(f"  {len(supabase_leads)} leads in Supabase")

    upserted = 0
    skipped = 0
    batches = [rows[i:i + batch_size] for i in range(0, total, batch_size)]

    for batch_idx, batch in enumerate(batches):
        payload = []
        for row in batch:
            row_dict = dict(row)
            entry = {f: row_dict[f] for f in LEAD_FIELDS if f in row_dict}

            existing = supabase_leads.get(row_dict["id"])
            if existing:
                entry["status"] = existing["status"]
                entry["notes"] = existing.get("notes") or ""
                skipped += 1
            else:
                entry["status"] = row_dict.get("status", "frio")
                entry["notes"] = row_dict.get("notes", "")

            entry["id"] = row_dict["id"]
            payload.append(entry)

        result = _rest("leads?on_conflict=id", method="POST", body=payload)
        if result.get("ok"):
            upserted += len(payload)
            print(f"  Batch {batch_idx + 1}/{len(batches)}: upserted {len(payload)} leads")
        else:
            print(f"  Batch {batch_idx + 1}/{len(batches)} FAILED: {result.get('error', '')[:200]}")

    print(f"\nSync complete: {upserted} upserted, {skipped} preserved status from Supabase")


def main():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "leads_data", "leads.db")

    if not SUPABASE_URL or not SERVICE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.")
        sys.exit(1)

    sync_leads(db_path)


if __name__ == "__main__":
    main()
