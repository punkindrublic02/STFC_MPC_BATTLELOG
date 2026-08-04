from __future__ import annotations
from fastapi import FastAPI, HTTPException, Query
from db import connect

app = FastAPI(title="stfc-bot-api")

def _row_to_dict(row):
    if row is None:
        return None
    return dict(row)

# Pass the connection directly into this helper
def _get_event_row(conn, id: int):
    return conn.execute(
        """
        SELECT id, raw_json, timestamp
        FROM stfc_events
        WHERE id = ?
        """,
        (int(id),),
    ).fetchone()

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/battle/{id}")
def get_battle(id: int):
    # Use 'with' to extract the actual connection from the manager
    with connect() as conn:
        row = _get_event_row(conn, id)
        if not row:
            raise HTTPException(status_code=404, detail="Battle not found")
        return _row_to_dict(row)

@app.get("/recent")
def get_recent(limit: int = 10):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                e.id,
                COALESCE(e.timestamp, e.created_at) AS timestamp,
                json_extract(e.raw_json, '$.journal.target_id') AS target_id,
                json_extract(e.raw_json, '$.journal.attacker.name') AS attacker_name,
                json_extract(e.raw_json, '$.journal.defender.name') AS defender_name,
                p.parse_version,
                p.summary_text
            FROM stfc_events e
            LEFT JOIN stfc_parsed_battles p
              ON p.pk_id = e.id
            ORDER BY e.id DESC
            LIMIT ?
            """,
            (int(limit),),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

@app.get("/recent/{player_name}")
def get_recent_for_player(player_name: str, limit: int = 10):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                e.id,
                COALESCE(e.timestamp, e.created_at) AS timestamp,
                json_extract(e.raw_json, '$.journal.target_id') AS target_id,
                json_extract(e.raw_json, '$.journal.names') AS names_json,
                p.parse_version,
                p.summary_text
            FROM stfc_events e
            LEFT JOIN stfc_parsed_battles p
              ON p.pk_id = e.id
            WHERE e.raw_json LIKE ?
            ORDER BY e.id DESC
            LIMIT ?
            """,
            (f'%"{player_name}"%', int(limit)),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

@app.get("/search")
def search_battles(
    player_name: str | None = Query(default=None),
    hostile: str | None = Query(default=None),
    limit: int = 10,
):
    with connect() as conn:
        sql = """
            SELECT
                e.id,
                COALESCE(e.timestamp, e.created_at) AS timestamp,
                json_extract(e.raw_json, '$.journal.target_id') AS target_id,
                json_extract(e.raw_json, '$.journal.names') AS names_json,
                p.parse_version,
                p.summary_text
            FROM stfc_events e
            LEFT JOIN stfc_parsed_battles p
              ON p.pk_id = e.id
            WHERE 1=1
        """
        params = []
        if player_name:
            sql += " AND e.raw_json LIKE ?"
            params.append(f'%"{player_name}"%')
        if hostile:
            sql += " AND json_extract(e.raw_json, '$.journal.target_id') = ?"
            params.append(hostile)

        sql += " ORDER BY e.id DESC LIMIT ?"
        params.append(int(limit))

        rows = conn.execute(sql, params).fetchall()
        return [_row_to_dict(r) for r in rows]