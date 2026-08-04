"""
import_all_json.py
-----------------
Reads game-data/all.json and upserts every named entity into
stfc_game_entity_catalog so ability names, FT buffs, weapons, and
ship components resolve correctly in battle logs.

Usage:
    python import_all_json.py
    python import_all_json.py --path D:/STFC/game-data/all.json
    python import_all_json.py --path /path/to/all.json --db /path/to/combatlogs.db
"""

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Path defaults
# ---------------------------------------------------------------------------

_HERE = Path(__file__).resolve().parent
DEFAULT_JSON_CANDIDATES = [
    _HERE.parent.parent / "game-data" / "all.json",
    _HERE.parent / "game-data" / "all.json",
    Path(r"D:\STFC_MPC_BATTLELOG\game-data\all.json"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_tags(text: str) -> str:
    """Remove Unity rich-text color/bold tags."""
    if not text:
        return text
    return re.sub(r"<[^>]+>", "", text).strip()


def _build_loca_map(data: dict) -> dict:
    """Build {loca_id (int): display_text (str)} from translations block."""
    loca_map = {}
    for _cat, entries in data.get("translations", {}).items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            eid = entry.get("id")
            text = entry.get("text", "")
            if eid is not None and text:
                loca_map[int(eid)] = _strip_tags(text)[:500]
    return loca_map


def _r(loca_id, loca_map: dict) -> str | None:
    """Resolve a loca_id to display text, or None."""
    if loca_id is None:
        return None
    return loca_map.get(int(loca_id))


# ---------------------------------------------------------------------------
# Collectors — each returns list of (entity_id, entity_type, loca_id, display_name, human_text)
# ---------------------------------------------------------------------------

def collect_officers(data: dict, loca_map: dict) -> list[tuple]:
    rows = []
    # officer_summary has real playable officers with correct names
    for o in data.get("officer_summary", []):
        oid = o.get("id")
        if oid is None:
            continue
        try:
            oid = int(oid)
        except (ValueError, TypeError):
            continue

        name = _r(o.get("loca_id"), loca_map)
        rows.append((oid, "officer", o.get("loca_id"), name, name))

        for ab_key, ab_type in [
            ("ability",              "officer_ability"),
            ("captain_ability",      "officer_captain_ability"),
            ("below_decks_ability",  "officer_below_decks_ability"),
        ]:
            ab = o.get(ab_key)
            if not isinstance(ab, dict):
                continue
            ab_id  = ab.get("id")
            ab_loca = ab.get("loca_id")
            if ab_id is None:
                continue
            try:
                ab_id = int(ab_id)
            except (ValueError, TypeError):
                continue
            ab_name = _r(ab_loca, loca_map)
            rows.append((ab_id, ab_type, ab_loca, ab_name, ab_name))

    return rows


def collect_forbidden_tech(data: dict, loca_map: dict) -> list[tuple]:
    rows = []
    for ftid, ft in data.get("forbidden_tech", {}).items():
        try:
            eid = int(ftid)
        except (ValueError, TypeError):
            continue
        name = _r(ft.get("loca_id"), loca_map)
        rows.append((eid, "forbidden_tech", ft.get("loca_id"), name, name))

        # Each tier has a list of buff objects
        for tier_entry in ft.get("buffs", []):
            for buff in tier_entry.get("buffs", []):
                bid   = buff.get("id")
                bloca = buff.get("loca_id")
                if bid is None:
                    continue
                try:
                    bid = int(bid)
                except (ValueError, TypeError):
                    continue
                bname = _r(bloca, loca_map)
                rows.append((bid, "ft_buff", bloca, bname, bname))

    return rows


def collect_ships(data: dict, loca_map: dict) -> list[tuple]:
    rows = []
    seen_components: set[int] = set()

    for sid, ship in data.get("ship", {}).items():
        try:
            eid = int(sid)
        except (ValueError, TypeError):
            continue
        name = _r(ship.get("loca_id"), loca_map)
        rows.append((eid, "ship", ship.get("loca_id"), name, name))

        for tier in ship.get("tiers", []):
            for component in tier.get("components", []):
                cid   = component.get("id")
                cloca = component.get("loca_id")
                if cid is None:
                    continue
                try:
                    cid = int(cid)
                except (ValueError, TypeError):
                    continue
                if cid in seen_components:
                    continue
                seen_components.add(cid)
                cname = _r(cloca, loca_map)
                rows.append((cid, "ship_component", cloca, cname, cname))

    return rows


def collect_hostiles(data: dict, loca_map: dict) -> list[tuple]:
    rows = []
    for hid, hostile in data.get("hostile", {}).items():
        try:
            eid = int(hid)
        except (ValueError, TypeError):
            continue
        name = _r(hostile.get("loca_id"), loca_map)
        rows.append((eid, "hostile", hostile.get("loca_id"), name, name))

        for ab in hostile.get("abilities", []):
            ab_id  = ab.get("id")
            ab_loca = ab.get("loca_id")
            if ab_id is None:
                continue
            try:
                ab_id = int(ab_id)
            except (ValueError, TypeError):
                continue
            ab_name = _r(ab_loca, loca_map)
            rows.append((ab_id, "hostile_ability", ab_loca, ab_name, ab_name))

    return rows


def collect_research(data: dict, loca_map: dict) -> list[tuple]:
    rows = []
    for rid, research in data.get("research", {}).items():
        try:
            eid = int(rid)
        except (ValueError, TypeError):
            continue
        name = _r(research.get("loca_id"), loca_map)
        rows.append((eid, "research", research.get("loca_id"), name, name))
    return rows


# ---------------------------------------------------------------------------
# DB upsert
# ---------------------------------------------------------------------------

def upsert_to_db(db_path: str, rows: list[tuple]) -> int:
    # Deduplicate — keep last writer for same (entity_id, entity_type)
    seen: dict[tuple, tuple] = {}
    for row in rows:
        seen[(row[0], row[1])] = row
    deduped = list(seen.values())

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS stfc_game_entity_catalog (
                entity_id    INTEGER NOT NULL,
                entity_type  TEXT    NOT NULL,
                loca_id      INTEGER,
                display_name TEXT,
                human_text   TEXT,
                source_table TEXT DEFAULT 'all_json',
                PRIMARY KEY (entity_id, entity_type)
            )
        """)
        conn.executemany("""
            INSERT INTO stfc_game_entity_catalog
                (entity_id, entity_type, loca_id, display_name, human_text, source_table)
            VALUES (?, ?, ?, ?, ?, 'all_json')
            ON CONFLICT(entity_id, entity_type) DO UPDATE SET
                loca_id      = excluded.loca_id,
                display_name = excluded.display_name,
                human_text   = excluded.human_text,
                source_table = 'all_json'
        """, deduped)
        conn.commit()
        return len(deduped)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Import all.json into stfc_game_entity_catalog")
    parser.add_argument("--path", default="", help="Path to all.json")
    parser.add_argument("--db",   default="", help="Path to combatlogs.db")
    args = parser.parse_args()

    # Resolve JSON path
    if args.path:
        json_path = Path(args.path)
    else:
        json_path = next((p for p in DEFAULT_JSON_CANDIDATES if p.exists()), None)
    if not json_path or not json_path.exists():
        print("❌ Could not find all.json. Pass --path /path/to/all.json")
        sys.exit(1)

    # Resolve DB path
    if args.db:
        db_path = args.db
    else:
        try:
            from config import settings
            db_path = settings.db_path
        except Exception:
            db_path = r"C:\Database\combatlogs.db"

    print(f"📂 {json_path}  ({json_path.stat().st_size // 1_048_576} MB)")
    print(f"💾 {db_path}")
    print()

    print("Loading JSON...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("Building loca map...")
    loca_map = _build_loca_map(data)
    print(f"  {len(loca_map):,} translation entries\n")

    collectors = [
        ("Officers + abilities",        collect_officers),
        ("Forbidden tech + buffs",       collect_forbidden_tech),
        ("Ships + components/weapons",   collect_ships),
        ("Hostiles + abilities",         collect_hostiles),
        ("Research",                     collect_research),
    ]

    all_rows = []
    for label, fn in collectors:
        rows = fn(data, loca_map)
        print(f"  {label}: {len(rows):,}")
        all_rows.extend(rows)

    print(f"\nUpserting {len(all_rows):,} rows...")
    inserted = upsert_to_db(db_path, all_rows)
    print(f"\n✅ Done — {inserted:,} unique entities in stfc_game_entity_catalog")


if __name__ == "__main__":
    main()