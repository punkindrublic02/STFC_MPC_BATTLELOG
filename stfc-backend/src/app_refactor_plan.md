# STFC app refactor plan

## Goals

1. Make startup and shutdown reliable.
2. Make config portable across machines.
3. Make schema management predictable.
4. Shrink `services.py` into focused modules.
5. Add health checks and observable parser status.
6. Keep MCP tool wrappers thin and safe.

## Immediate changes

### 1) Replace fire-and-forget parser thread
Current behavior starts a daemon thread and then runs the MCP server. If the parser crashes, the app can continue serving while ingest is dead.

Replace it with:
- `ParserWorker` class with stop event
- logging and restart loop
- parser heartbeat and last exception tracking
- clean shutdown on SIGINT/SIGTERM

### 2) Replace machine-specific defaults
The current DB path default is Windows-specific. Use:
- `STFC_DB_PATH` from env if provided
- otherwise local `data/combatlogs.db`
- validate path on startup

### 3) Introduce schema versioning
Instead of `ensure_column()` growth only, add:
- `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`
- a list of migration functions
- indexes for common analytics queries

### 4) Split `services.py`
Recommended target layout:

- `repositories/db_meta.py`
- `repositories/entities.py`
- `repositories/battles.py`
- `repositories/analytics.py`
- `ingest/parser_runner.py`
- `ingest/battle_ingest.py`
- `domain/summary.py`
- `mcp_tools.py`

Keep `services.py` temporarily as a compatibility facade while moving functions one group at a time.

### 5) Make health visible
Expose a tool that returns:
- parser running/not running
- last parsed pk
- last heartbeat
- last exception
- db connectivity
- table counts for critical parsed tables

## File-by-file patch plan

### `app.py`
Replace top-level thread startup with a real lifecycle manager.

### `config.py`
Use a dataclass-based settings object. Normalize paths and numeric settings.

### `db.py`
Add:
- migration table
- `apply_migrations()`
- indexes
- connection helper using context manager

### `services.py`
First extraction candidates:
- table/query helpers
- entity lookup helpers
- parser checkpoint helpers
- battle classification helpers

### `tools.py`
Add a small wrapper for argument validation and consistent error payloads.

### `smart_parser.py`
Either remove it or move to `experiments/smart_parser.py` because it uses a different event assumption model than `parser.py`.

## Safe rollout order

1. Drop in new config and db helpers.
2. Add parser worker and health state.
3. Move only ingest-related functions out of `services.py`.
4. Move entity/search/query functions.
5. Add tests.

## Tests to add first

- parser survives malformed JSON
- checkpoint read/write
- migration idempotency
- read-only SQL blocks write statements
- health endpoint reports parser failure

