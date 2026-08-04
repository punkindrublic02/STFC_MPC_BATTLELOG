import requests
import json
from datetime import datetime, timezone
from db import connect  # Pulls your local 61-table connection manager
from battlelog_analyzer import TABLE_NAME # Targets "stfc_events" safely

# stfc.space backend api endpoint
STFC_SPACE_API = "https://api.stfc.dev/events"
HEADERS = {
    "User-Agent": "Mozilla/5.0 STFC Data Pipeline Client",
    "Accept": "application/json"
}
PARAMS = {
    "from": "2026-06-25 08:58:18",
    "to": "2026-07-20 08:58:18",
    "level": 0,
    "cat": -1
}

def inject_events_directly():
    print("🛰️ Harvesting event data timeline from stfc.space...")
    try:
        response = requests.get(STFC_SPACE_API, params=PARAMS, headers=HEADERS)
        if response.status_code != 200:
            print(f"❌ Failed to fetch from stfc.space: {response.status_code}")
            return
        
        raw_events = response.json().get("data", [])
        print(f"📦 Intercepted {len(raw_events)} raw entries. Committing to database...")
        
        current_time_iso = datetime.now(timezone.utc).isoformat()
        inserted_count = 0

        # Open connection using your custom context manager
        with connect(read_only=False) as conn:
            for item in raw_events:
                # Structure matching the layout expected by AllianceEvents.tsx
                event_data = {
                    "event_id": str(item.get("id") or item.get("event_id")),
                    "source_news_id": None,
                    "source": "stfc_space",
                    "event_type": "game_event",
                    "title": item.get("name") or item.get("title") or "Unknown Event Track",
                    "description": item.get("description") or item.get("body") or "",
                    "starts_at": item.get("start_time") or item.get("starts_at"),
                    "ends_at": item.get("end_time") or item.get("ends_at"),
                    "published_at": item.get("published_at") or current_time_iso,
                    "url": f"https://stfc.space/events/{item.get('id')}" if item.get("id") else None,
                    "created_at": current_time_iso,
                    "updated_at": current_time_iso
                }

                # Insert or update — external_id is the stfc.space event id (text),
                # the autoincrement 'id' column is left to SQLite.
                conn.execute("""
                    INSERT INTO stfc_events (external_id, raw_json, timestamp, created_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(external_id) DO UPDATE SET
                        raw_json   = excluded.raw_json,
                        timestamp  = excluded.timestamp,
                        created_at = excluded.created_at
                """, (
                    event_data["event_id"],
                    json.dumps(event_data),
                    event_data["starts_at"] or current_time_iso,
                    current_time_iso,
                ))
                inserted_count += 1
                
        print(f"✨ Success! Directly committed {inserted_count} rows into the database stack.")

    except Exception as e:
     print(f"💥 Direct injection thread failure: {str(e)}")

if __name__ == "__main__":
    inject_events_directly()