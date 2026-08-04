from __future__ import annotations

import json
import logging
import sqlite3
from typing import Any, Dict, List, Optional


LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Checkpoint helpers (imported by parser_runtime.py)
# ---------------------------------------------------------------------------

def get_last_checkpoint(conn: sqlite3.Connection) -> int:
    """Return the last successfully parsed pk_id, or 0 if none."""
    from db import get_last_checkpoint as _db_get
    return _db_get(conn)


def set_last_checkpoint(conn: sqlite3.Connection, pk_id: int) -> None:
    """Persist the last successfully parsed pk_id."""
    from db import set_last_checkpoint as _db_set
    _db_set(conn, pk_id)


# ---------------------------------------------------------------------------
# Battle fetching
# ---------------------------------------------------------------------------

def fetch_new_battles(
    conn: sqlite3.Connection,
    after_pk: int,
    limit: int = 100,
) -> List[sqlite3.Row]:
    """Return up to *limit* stfc_events rows with id > after_pk."""
    return conn.execute(
        """
        SELECT id AS pk_id, raw_json
        FROM stfc_events
        WHERE id > ?
          AND raw_json IS NOT NULL
          AND TRIM(COALESCE(raw_json, '')) <> ''
        ORDER BY id ASC
        LIMIT ?
        """,
        (int(after_pk), int(limit)),
    ).fetchall()






def stfc_parsed_battles(conn: sqlite3.Connection, pk_id: int, raw_json: str):
    # Just save the raw data and get out of the way
    conn.execute(
        "INSERT OR REPLACE INTO stfc_parsed_battles (pk_id, raw_json) VALUES (?, ?)",
        (pk_id, raw_json)
    )
    return {"ok": True}




def reparse_range(start_pk: int, end_pk: int) -> Dict[str, Any]:
    if end_pk < start_pk:
        raise ValueError("end_pk must be greater than or equal to start_pk")

    from db import connect as db_connect

    parsed = 0
    failed = []

    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT id AS pk_id, raw_json
            FROM stfc_events
            WHERE id BETWEEN ? AND ?
              AND raw_json IS NOT NULL
              AND TRIM(COALESCE(raw_json, '')) <> ''
            ORDER BY id ASC
            """,
            (int(start_pk), int(end_pk)),
        ).fetchall()

        for row in rows:
            pk_id = int(row["pk_id"])
            try:
                stfc_parsed_battles(conn, pk_id, row["raw_json"])
                parsed += 1
            except Exception as exc:
                LOGGER.exception("Failed reparsing pk_id=%s", pk_id)
                failed.append({"pk_id": pk_id, "error": str(exc)})

        if rows:
            set_last_checkpoint(conn, int(rows[-1]["pk_id"]))
        conn.commit()

    return {
        "ok": len(failed) == 0,
        "start_pk": int(start_pk),
        "end_pk": int(end_pk),
        "parsed": parsed,
        "failed": failed,
    }


def backfill_all_battles() -> Dict[str, Any]:
    from db import connect as db_connect

    parsed = 0
    failed = []

    with db_connect() as conn:
        rows = conn.execute(
            """
            SELECT id AS pk_id, raw_json
            FROM stfc_events
            WHERE raw_json IS NOT NULL
              AND TRIM(COALESCE(raw_json, '')) <> ''
            ORDER BY id ASC
            """
        ).fetchall()

        for row in rows:
            pk_id = int(row["pk_id"])
            try:
                stfc_parsed_battles(conn, pk_id, row["raw_json"])
                parsed += 1
            except Exception as exc:
                LOGGER.exception("Failed backfilling pk_id=%s", pk_id)
                failed.append({"pk_id": pk_id, "error": str(exc)})

        if rows:
            set_last_checkpoint(conn, int(rows[-1]["pk_id"]))
        conn.commit()

    return {
        "ok": len(failed) == 0,
        "parsed": parsed,
        "failed": failed,
    }
