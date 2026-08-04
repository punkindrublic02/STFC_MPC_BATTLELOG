from __future__ import annotations

import re
import sqlite3
from typing import Any, Dict, List, Optional

from db import connect as db_connect


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None


def _view_exists(conn: sqlite3.Connection, view_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='view' AND name=?",
        (view_name,),
    ).fetchone()
    return row is not None


def _table_or_view_exists(conn: sqlite3.Connection, object_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name=?",
        (object_name,),
    ).fetchone()
    return row is not None



def _get_table_columns(conn: sqlite3.Connection, table_name: str) -> List[str]:
    rows = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    return [str(r["name"]) for r in rows]



def list_tables() -> Dict[str, Any]:
    with db_connect(read_only=True) as conn:
        rows = conn.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY type, name"
        ).fetchall()
    return {
        "ok": True,
        "tables": [r["name"] for r in rows if r["type"] == "table"],
        "views": [r["name"] for r in rows if r["type"] == "view"],
        "objects": [dict(r) for r in rows],
    }



def preview_table(table_name: str, limit: int = 20) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 200))
    with db_connect(read_only=True) as conn:
        if not _table_or_view_exists(conn, table_name):
            return {"ok": False, "error": f"table/view '{table_name}' not found"}
        rows = conn.execute(f'SELECT * FROM "{table_name}" LIMIT ?', (limit,)).fetchall()
    return {"ok": True, "table": table_name, "rows": [dict(r) for r in rows]}



def describe_table(table_name: str) -> Dict[str, Any]:
    with db_connect(read_only=True) as conn:
        if not _table_or_view_exists(conn, table_name):
            return {"ok": False, "error": f"table/view '{table_name}' not found"}
        rows = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    return {"ok": True, "table": table_name, "columns": [dict(r) for r in rows]}


def query_table_advanced(table_name, where, group_by, order_by, limit):
    query = f"SELECT * FROM {table_name}"
    if where:
        query += f" WHERE {where}"
    if group_by:
        query += f" GROUP BY {group_by}"
    if order_by:
        query += f" ORDER BY {order_by}"
    query += f" LIMIT {limit}"
    
    with db_connect(read_only=True) as conn:
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]

def query_table(
    table_name: str,
    limit: int = 50,
    offset: int = 0,
    where: Optional[Dict[str, Any]] = None,
    order_by: Optional[str] = None,
    descending: bool = False,
) -> Dict[str, Any]:
    limit = max(1, min(int(limit), 1000))
    offset = max(0, int(offset))
    where = where or {}

    with db_connect(read_only=True) as conn:
        if not _table_or_view_exists(conn, table_name):
            return {"ok": False, "error": f"table/view '{table_name}' not found"}

        columns = _get_table_columns(conn, table_name)
        if not columns:
            return {"ok": False, "error": f"table '{table_name}' has no columns"}

        sql = f'SELECT * FROM "{table_name}"'
        params: List[Any] = []

        if where:
            bad_cols = [k for k in where.keys() if k not in columns]
            if bad_cols:
                return {
                    "ok": False,
                    "error": f"invalid where columns for '{table_name}': {bad_cols}",
                    "valid_columns": columns,
                }

            clauses = []
            for col, val in where.items():
                if val is None:
                    clauses.append(f'"{col}" IS NULL')
                else:
                    clauses.append(f'"{col}" = ?')
                    params.append(val)

            sql += " WHERE " + " AND ".join(clauses)

        if order_by:
            if order_by not in columns:
                return {
                    "ok": False,
                    "error": f"invalid order_by column '{order_by}' for '{table_name}'",
                    "valid_columns": columns,
                }
            sql += f' ORDER BY "{order_by}" {"DESC" if descending else "ASC"}'

        sql += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = conn.execute(sql, params).fetchall()

    return {
        "ok": True,
        "table": table_name,
        "limit": limit,
        "offset": offset,
        "row_count": len(rows),
        "rows": [dict(r) for r in rows],
    }



def get_row_by(table_name: str, column_name: str, value: Any) -> Dict[str, Any]:
    with db_connect(read_only=True) as conn:
        if not _table_or_view_exists(conn, table_name):
            return {"ok": False, "error": f"table/view '{table_name}' not found"}

        columns = _get_table_columns(conn, table_name)
        if column_name not in columns:
            return {
                "ok": False,
                "error": f"column '{column_name}' not found in '{table_name}'",
                "valid_columns": columns,
            }

        row = conn.execute(
            f'SELECT * FROM "{table_name}" WHERE "{column_name}" = ? LIMIT 1',
            (value,),
        ).fetchone()

    if not row:
        return {
            "ok": False,
            "error": f"no row found in '{table_name}' where {column_name}={value!r}",
        }

    return {
        "ok": True,
        "table": table_name,
        "column": column_name,
        "value": value,
        "row": dict(row),
    }



def run_readonly_sql(sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
    sql = (sql or "").strip()
    params = params or []

    if not sql:
        return {"ok": False, "error": "sql is empty"}

    lowered = sql.lower().lstrip()
    if not lowered.startswith(("select", "with", "pragma")):
        return {"ok": False, "error": "only read-only SELECT/WITH/PRAGMA queries are allowed"}

    blocked_patterns = [
        r"\binsert\b", r"\bupdate\b", r"\bdelete\b", r"\bdrop\b",
        r"\balter\b", r"\bcreate\b", r"\breplace\b", r"\battach\b",
        r"\bdetach\b", r"\bvacuum\b", r"\btruncate\b",
    ]
    for pattern in blocked_patterns:
        if re.search(pattern, lowered):
            return {"ok": False, "error": f"blocked SQL pattern matched: {pattern}"}

    with db_connect(read_only=True) as conn:
        rows = conn.execute(sql, params).fetchall()
    return {"ok": True, "row_count": len(rows), "rows": [dict(r) for r in rows]}
