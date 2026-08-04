from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, Optional

from db import (
    connect as db_connect,
    create_tables,
    get_parser_state,
    update_parser_state,
)
from ingest import (
    fetch_new_battles,
    get_last_checkpoint,
    stfc_parsed_battles,
    set_last_checkpoint,
    stfc_parsed_battles,
)

LOGGER = logging.getLogger(__name__)


def _safe_update_state(
    conn,
    *,
    status: str,
    last_pk_id: Optional[int] = None,
    last_error: Optional[str] = None,
) -> None:
    update_parser_state(
        conn,
        status=status,
        last_pk_id=last_pk_id,
        last_error=last_error,
    )


def run_incremental_parser(
    poll_seconds: float = 2.0,
    batch_size: int = 100,
    stop_event: Optional[threading.Event] = None,
) -> None:
    LOGGER.info(
        "Starting incremental parser loop (poll_seconds=%s, batch_size=%s)",
        poll_seconds,
        batch_size,
    )

    with db_connect() as conn:
        create_tables(conn)
        checkpoint = get_last_checkpoint(conn)
        _safe_update_state(conn, status="starting", last_pk_id=checkpoint, last_error=None)
        conn.commit()

    while True:
        if stop_event and stop_event.is_set():
            try:
                with db_connect() as conn:
                    checkpoint = get_last_checkpoint(conn)
                    _safe_update_state(conn, status="stopped", last_pk_id=checkpoint, last_error=None)
                    conn.commit()
            except Exception:
                LOGGER.exception("Failed updating parser state during shutdown")
            LOGGER.info("Incremental parser stopped")
            return

        try:
            with db_connect() as conn:
                last_pk = get_last_checkpoint(conn)
                rows = fetch_new_battles(conn, last_pk, batch_size)

                if not rows:
                    _safe_update_state(conn, status="idle", last_pk_id=last_pk, last_error=None)
                    conn.commit()
                else:
                    current_checkpoint = last_pk
                    _safe_update_state(conn, status="running", last_pk_id=current_checkpoint, last_error=None)
                    conn.commit()

                    for row in rows:
                        if stop_event and stop_event.is_set():
                            break

                        raw_pk = row["pk_id"] if "pk_id" in row.keys() else row["id"]
                        pk_id = int(raw_pk)
                        raw_json = row["raw_json"]

                        try:
                            stfc_parsed_battles(conn, pk_id, raw_json)
                            current_checkpoint = pk_id
                            _safe_update_state(
                                conn,
                                status="running",
                                last_pk_id=current_checkpoint,
                                last_error=None,
                            )
                            conn.commit()
                        except Exception as exc:
                            conn.rollback()
                            _safe_update_state(
                                conn,
                                status="error",
                                last_pk_id=current_checkpoint,
                                last_error=str(exc),
                            )
                            conn.commit()
                            LOGGER.exception("Failed parsing pk_id=%s", pk_id)
                            break

                    set_last_checkpoint(conn, current_checkpoint)
                    _safe_update_state(conn, status="idle", last_pk_id=current_checkpoint, last_error=None)
                    conn.commit()

        except Exception as exc:
            LOGGER.exception("Incremental parser loop error")
            try:
                with db_connect() as conn:
                    checkpoint = get_last_checkpoint(conn)
                    _safe_update_state(
                        conn,
                        status="error",
                        last_pk_id=checkpoint,
                        last_error=str(exc),
                    )
                    conn.commit()
            except Exception:
                LOGGER.exception("Unable to persist parser error state")

        if stop_event:
            if stop_event.wait(poll_seconds):
                return
        else:
            time.sleep(poll_seconds)


def parser_health() -> Dict[str, Any]:
    with db_connect(read_only=True) as conn:
        state = get_parser_state(conn)
        source_row = conn.execute("SELECT COUNT(*) AS c FROM stfc_events").fetchone()
        parsed_row = conn.execute("SELECT COUNT(*) AS c FROM stfc_parsed_battles").fetchone()
        s_count = int(source_row["c"]) if source_row else 0
        p_count = int(parsed_row["c"]) if parsed_row else 0
        return {
            "ok": True,
            "parser": state,
            "source_event_count": s_count,
            "parsed_battle_count": p_count,
            "lag": max(0, s_count - p_count),
        }
