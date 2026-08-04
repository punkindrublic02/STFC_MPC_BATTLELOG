import sqlite3
import os
from contextlib import contextmanager
from pathlib import Path
from config import settings

DB_PATH = settings.db_path
JOURNAL_MODE = os.environ.get("STFC_SQLITE_JOURNAL_MODE", "WAL")
CACHE_KB = max(16000, int(os.environ.get("STFC_SQLITE_CACHE_KB", "131072")))
MMAP_BYTES = max(0, int(os.environ.get("STFC_SQLITE_MMAP_BYTES", "268435456")))

@contextmanager
def connect(read_only: bool = False):
    """
    Simple SQLite connection manager.
    No automatic parsing, no extra logic—just a data pipe.
    """
    path = Path(DB_PATH)
    # Ensure the directory exists if we aren't in read-only mode
    if not read_only:
        path.parent.mkdir(parents=True, exist_ok=True)
    
    # Use URI for better handling of read-only and concurrent access
    uri = f"file:{path}?mode={'ro' if read_only else 'rwc'}"
    conn = sqlite3.connect(uri, uri=True, timeout=30.0)
    
    try:
        conn.row_factory = sqlite3.Row  # Access columns by name: row['raw_json']
        if not read_only:
            conn.execute(f"PRAGMA journal_mode = {JOURNAL_MODE};")
            conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute(f"PRAGMA cache_size = -{CACHE_KB};")
        conn.execute(f"PRAGMA mmap_size = {MMAP_BYTES};")
        conn.execute("PRAGMA temp_store = MEMORY;")
        yield conn
        if not read_only:
            conn.commit()
    finally:
        conn.close()

def create_tables(conn):
    # Primary event storage — raw payloads exactly as the game sent them.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stfc_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            external_id TEXT UNIQUE,          -- stfc.space / API event id
            raw_json    TEXT NOT NULL,
            timestamp   TIMESTAMP,            -- event start time (from source)
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Parsed / summarised battle results written back by the TS bridge or Python.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stfc_parsed_battles (
            pk_id        INTEGER PRIMARY KEY,
            raw_json     TEXT,
            summary_text TEXT,
            parse_version TEXT,
            parsed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Parser runtime state — single-row control table.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stfc_parser_state (
            id           INTEGER PRIMARY KEY CHECK (id = 1),
            status       TEXT    NOT NULL DEFAULT 'idle',
            last_pk_id   INTEGER,
            last_error   TEXT,
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        INSERT OR IGNORE INTO stfc_parser_state (id, status) VALUES (1, 'idle')
    """)


# ---------------------------------------------------------------------------
# Parser-state helpers (used by parser_runtime.py and ingest.py)
# ---------------------------------------------------------------------------

def get_parser_state(conn):
    row = conn.execute("SELECT * FROM stfc_parser_state WHERE id = 1").fetchone()
    return dict(row) if row else {}


def update_parser_state(conn, *, status: str, last_pk_id=None, last_error=None):
    conn.execute("""
        UPDATE stfc_parser_state
        SET status     = ?,
            last_pk_id = COALESCE(?, last_pk_id),
            last_error  = ?,
            updated_at  = CURRENT_TIMESTAMP
        WHERE id = 1
    """, (status, last_pk_id, last_error))


def get_last_checkpoint(conn) -> int:
    row = conn.execute(
        "SELECT COALESCE(last_pk_id, 0) AS cp FROM stfc_parser_state WHERE id = 1"
    ).fetchone()
    return int(row["cp"]) if row else 0


def set_last_checkpoint(conn, pk_id: int) -> None:
    conn.execute(
        "UPDATE stfc_parser_state SET last_pk_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
        (int(pk_id),),
    )
