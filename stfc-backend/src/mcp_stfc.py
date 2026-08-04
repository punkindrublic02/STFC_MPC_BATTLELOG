from fastmcp import FastMCP
from db import connect
import json
import os
import re
from config import settings
from pathlib import Path
from repository import describe_table, list_tables, preview_table

mcp = FastMCP("stfc-tools")

PROJECT_ROOT = settings.project_root

def _python_write_tools_enabled():
    return os.environ.get("STFC_MCP_ENABLE_PYTHON_WRITE_TOOLS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

def _require_python_write_tools():
    if not _python_write_tools_enabled():
        return {
            "error": (
                "Python MCP write tools are disabled. Use the owner-only TS bridge/admin path "
                "or set STFC_MCP_ENABLE_PYTHON_WRITE_TOOLS=true only for a trusted local session."
            )
        }
    return None

def _safe_path(rel_path: str) -> Path:
    p = (PROJECT_ROOT / rel_path).resolve()
    if PROJECT_ROOT not in p.parents and p != PROJECT_ROOT:
        raise ValueError("Path escapes project root")
    return p

@mcp.tool()
def list_project_dir(path: str = ""):
    """List files under the STFC project root."""
    try:
        p = _safe_path(path)
        if not p.exists():
            return {"error": "Path not found"}
        if not p.is_dir():
            return {"error": "Path is not a directory"}

        items = []
        for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            items.append({
                "name": child.name,
                "path": str(child.relative_to(PROJECT_ROOT)),
                "is_dir": child.is_dir(),
            })
        return items
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
def read_project_file(path: str):
    """Read a text file from the STFC project root."""
    try:
        p = _safe_path(path)
        if not p.exists():
            return {"error": "File not found"}
        if not p.is_file():
            return {"error": "Path is not a file"}

        return {
            "path": str(p.relative_to(PROJECT_ROOT)),
            "content": p.read_text(encoding="utf-8", errors="replace"),
        }
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
def search_project_text(query: str, path: str = ""):
    """Search text in project files under the STFC project root."""
    try:
        base = _safe_path(path)
        if not base.exists():
            return {"error": "Path not found"}

        results = []
        files = [base] if base.is_file() else [p for p in base.rglob("*") if p.is_file()]

        for file in files:
            try:
                text = file.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            lines = text.splitlines()
            for i, line in enumerate(lines, start=1):
                if query.lower() in line.lower():
                    results.append({
                        "path": str(file.relative_to(PROJECT_ROOT)),
                        "line": i,
                        "text": line.strip(),
                    })

        return results[:200]
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
def run_query(sql: str, limit: int = 200):
    """Execute a read-only SQL query for data analysis. Max 500 rows returned."""
    import re as _re
    sql = (sql or "").strip()
    if not sql:
        return {"error": "sql is empty"}

    lowered = sql.lower().lstrip()
    if not lowered.startswith(("select", "with", "pragma")):
        return {"error": "only read-only SELECT/WITH/PRAGMA queries are allowed"}

    _blocked = [
        r"\binsert\b", r"\bupdate\b", r"\bdelete\b", r"\bdrop\b",
        r"\balter\b", r"\bcreate\b", r"\breplace\b", r"\battach\b",
        r"\bdetach\b", r"\bvacuum\b", r"\btruncate\b",
    ]
    for pattern in _blocked:
        if _re.search(pattern, lowered):
            return {"error": f"blocked SQL keyword: {pattern}"}

    limit = max(1, min(int(limit), 500))
    normalized_sql = _normalize_sql(sql)

    # Inject a LIMIT if the query doesn't already have one
    if not _re.search(r"(?i)\blimit\s+\d+", normalized_sql):
        normalized_sql = f"{normalized_sql.rstrip(';')} LIMIT {limit}"

    with connect(read_only=True) as conn:
        try:
            rows = conn.execute(normalized_sql).fetchall()
            return {
                "row_count": len(rows),
                "limit_applied": limit,
                "rows": [dict(r) for r in rows],
            }
        except Exception as e:
            return {"error": str(e)}

def _normalize_sql(sql: str) -> str:
    """Accept a couple common ChatGPT SQL Server habits against SQLite."""
    cleaned = sql.strip().rstrip(";")
    top_match = re.match(r"(?is)^select\s+top\s+(\d+)\s+(.+)$", cleaned)
    limit = None
    if top_match:
        limit = max(1, min(int(top_match.group(1)), 500))
        cleaned = f"SELECT {top_match.group(2).strip()}"

    cleaned = re.sub(
        r"(?i)\bstfc_battle_evidence\b",
        "stfc_battle_quality",
        cleaned,
    )

    if limit is not None and not re.search(r"(?i)\blimit\s+\d+\b", cleaned):
        cleaned = f"{cleaned} LIMIT {limit}"

    return cleaned

@mcp.tool()
def list_database_objects():
    """List available STFC database tables and views, including hull repair views."""
    return list_tables()

@mcp.tool()
def describe_database_object(name: str):
    """Describe a STFC database table or view by name."""
    return describe_table(name)

@mcp.tool()
def preview_database_object(name: str, limit: int = 20):
    """Preview rows from a STFC database table or view."""
    return preview_table(name, limit)

@mcp.tool()
def hull_repair_summary(event_id: int | None = None, limit: int = 25):
    """Return hull repair totals and average repair per round from stfc_battle_repair_summary."""
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        if event_id is None:
            rows = conn.execute("""
                SELECT *
                FROM stfc_battle_repair_summary
                ORDER BY event_id DESC
                LIMIT ?
            """, (limit,)).fetchall()
        else:
            rows = conn.execute("""
                SELECT *
                FROM stfc_battle_repair_summary
                WHERE event_id = ?
            """, (event_id,)).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def hull_repair_events(event_id: int, limit: int = 100):
    """Return individual hull repair events from the stfc_hull_repair view for one battle."""
    limit = max(1, min(int(limit), 500))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_hull_repair
            WHERE event_id = ?
            ORDER BY round_num, event_index
            LIMIT ?
        """, (event_id, limit)).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def stfc_data_catalog():
    """Explain the MCP-friendly STFC database views and when to use each one."""
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_mcp_data_catalog
            ORDER BY object_name
        """).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def game_entity_search(query: str | None = None, entity_type: str | None = None, limit: int = 25):
    """Search STFC game-data entities from entities/all.json/stfc.space with localized human text."""
    query = _text_or_none(query)
    entity_type = _text_or_none(entity_type)
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT
              entity_id,
              entity_type,
              loca_id,
              display_name,
              human_text,
              source_table
            FROM stfc_game_entity_catalog
            WHERE (? IS NULL OR entity_type = ?)
              AND (? IS NULL OR COALESCE(display_name, human_text, entity_id, '') LIKE ?)
            ORDER BY
              CASE WHEN lower(COALESCE(display_name, '')) = lower(?) THEN 0 ELSE 1 END,
              entity_type,
              display_name
            LIMIT ?
        """, (entity_type, entity_type, query, _like(query), query, limit)).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def alias_lookup(query: str | None = None, canonical_type: str | None = None, limit: int = 25):
    """Resolve shorthand, raw target families, nicknames, and common user wording to canonical terms."""
    query = _text_or_none(query)
    canonical_type = _text_or_none(canonical_type)
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_entity_alias_catalog
            WHERE (? IS NULL OR canonical_type = ?)
              AND (? IS NULL OR alias LIKE ? OR canonical_name LIKE ?)
            ORDER BY
              CASE WHEN lower(alias) = lower(?) THEN 0 ELSE 1 END,
              confidence DESC,
              alias
            LIMIT ?
        """, (
            canonical_type, canonical_type,
            query, _like(query), _like(query),
            query,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def hostile_profile(
    hostile: str | None = None,
    target_family: str | None = None,
    level: int | None = None,
    limit: int = 10,
):
    """Return hostile game-data profile, components/weapons, and abilities/buffs by name/family/level."""
    hostile = _text_or_none(hostile)
    target_family = _text_or_none(target_family)
    limit = max(1, min(int(limit), 50))
    with connect(read_only=True) as conn:
        hostile_rows = conn.execute("""
            SELECT *
            FROM stfc_hostile_catalog
            WHERE (? IS NULL OR hostile_name LIKE ?)
              AND (? IS NULL OR hostile_family LIKE ?)
              AND (? IS NULL OR level = ?)
            ORDER BY
              CASE WHEN lower(hostile_name) = lower(?) THEN 0 ELSE 1 END,
              level,
              strength DESC
            LIMIT ?
        """, (
            hostile, _like(hostile),
            target_family, _like(target_family),
            level, level,
            hostile,
            limit,
        )).fetchall()
        hostiles = [dict(r) for r in hostile_rows]
        if not hostiles:
            return {"hostiles": [], "components": [], "abilities": []}

        ids = [r["hostile_id"] for r in hostiles]
        placeholders = ",".join("?" for _ in ids)
        components = conn.execute(f"""
            SELECT *
            FROM stfc_hostile_component_catalog
            WHERE hostile_id IN ({placeholders})
            ORDER BY hostile_id, component_index
        """, ids).fetchall()
        abilities = conn.execute(f"""
            SELECT *
            FROM stfc_hostile_ability_catalog
            WHERE hostile_id IN ({placeholders})
            ORDER BY hostile_id, component_id, ability_index
        """, ids).fetchall()

        return {
            "hostiles": hostiles,
            "components": [dict(r) for r in components],
            "abilities": [dict(r) for r in abilities],
        }

@mcp.tool()
def battle_facts(event_id: int):
    """Return the compact MCP fact packet for one battle: summary, ships, repairs, and officer triggers."""
    with connect(read_only=True) as conn:
        base_battle = conn.execute("""
            SELECT
                pb.event_id,
                pb.battle_id,
                pb.battle_time,
                pb.initiator_id,
                pb.target_id,
                COALESCE(bps.analytics_initiator_wins, pb.initiator_wins) AS initiator_wins,
                pb.initiator_wins AS reported_initiator_wins,
                bps.inferred_initiator_wins,
                CAST(pb.rounds AS REAL) AS rounds,
                CAST(pb.sub_rounds AS REAL) AS sub_rounds,
                CAST(pb.attacks AS REAL) AS attacks_reported
            FROM stfc_parsed_battles pb
            LEFT JOIN stfc_battle_mcp_summary bps ON bps.event_id = pb.event_id
            WHERE pb.event_id = ?
        """, (event_id,)).fetchone()
        ships = conn.execute("""
            SELECT *
            FROM stfc_ship_battle_summary
            WHERE event_id = ?
            ORDER BY damage_dealt_actual DESC, damage_taken_actual DESC
        """, (event_id,)).fetchall()
        repairs = conn.execute("""
            SELECT *
            FROM stfc_hull_repair
            WHERE event_id = ?
            ORDER BY round_num, event_index
            LIMIT 100
        """, (event_id,)).fetchall()
        officer_triggers = conn.execute("""
            SELECT *
            FROM stfc_officer_trigger_summary
            WHERE event_id = ?
            ORDER BY trigger_count DESC, first_trigger_round ASC
            LIMIT 100
        """, (event_id,)).fetchall()
        attack_summary = conn.execute("""
            SELECT
                COUNT(*) AS attack_events,
                SUM(actual_damage_taken) AS actual_damage_taken,
                SUM(actual_damage_taken) AS battle_actual_damage_taken,
                SUM(shield_damage_taken) AS shield_damage_taken,
                SUM(hull_damage_taken) AS hull_damage_taken,
                SUM(total_damage_before_mitigation) AS damage_before_mitigation,
                AVG(overall_mitigation_pct) AS avg_overall_mitigation_pct,
                AVG(std_mitigation_pct) AS avg_std_mitigation_pct,
                AVG(iso_mitigation_pct) AS avg_iso_mitigation_pct,
                AVG(apex_mitigation_pct) AS avg_apex_mitigation_pct,
                SUM(CASE WHEN crit = 1 THEN 1 ELSE 0 END) AS crit_events,
                SUM(CASE WHEN crit = 1 THEN 1 ELSE 0 END) / NULLIF(CAST(COUNT(*) AS REAL), 0) AS crit_rate
            FROM stfc_attack_mitigation
            WHERE event_id = ?
        """, (event_id,)).fetchone()
        repair_summary = conn.execute("""
            SELECT
                total_repair,
                repair_events,
                repair_rounds,
                avg_repair_per_round,
                avg_repair_per_repair_round
            FROM stfc_battle_repair_summary
            WHERE event_id = ?
        """, (event_id,)).fetchone()
        player_summary = conn.execute("""
            SELECT *
            FROM stfc_battle_player_summary
            WHERE event_id = ?
        """, (event_id,)).fetchone()
        ship_rows = [dict(r) for r in ships]
        top_ship = max(ship_rows, key=lambda r: r.get("damage_dealt_actual") or 0) if ship_rows else None
        battle = None
        if base_battle:
            battle = {
                **dict(base_battle),
                **(dict(attack_summary) if attack_summary else {}),
                **(dict(repair_summary) if repair_summary else {}),
                **(dict(player_summary) if player_summary else {}),
                "ship_count": len(ship_rows),
                "top_damage_dealer": top_ship.get("display_name") if top_ship else None,
                "top_damage_dealt": top_ship.get("damage_dealt_actual") if top_ship else 0,
            }

        return {
            "battle": battle,
            "ships": ship_rows,
            "repairs": [dict(r) for r in repairs],
            "officer_triggers": [dict(r) for r in officer_triggers],
        }

@mcp.tool()
def ship_battle_summary(event_id: int):
    """Return per-ship damage, mitigation, repair, crit, and HP summary for one battle."""
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_ship_battle_summary
            WHERE event_id = ?
            ORDER BY damage_dealt_actual DESC, damage_taken_actual DESC
        """, (event_id,)).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def attack_mitigation(event_id: int, limit: int = 100):
    """Return attack-level standard, isolytic, apex, shield, hull, and mitigation percentages."""
    limit = max(1, min(int(limit), 500))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_attack_mitigation
            WHERE event_id = ?
            ORDER BY round_num, subround_num, event_index
            LIMIT ?
        """, (event_id, limit)).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def officer_trigger_summary(event_id: int):
    """Return officer ability trigger counts and first/last trigger rounds for one battle."""
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_officer_trigger_summary
            WHERE event_id = ?
            ORDER BY trigger_count DESC, first_trigger_round ASC
        """, (event_id,)).fetchall()
        return [dict(r) for r in rows]

def _text_or_none(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None

def _like(value):
    return f"%{value}%" if value else None

def _is_vger_text(value):
    text = "".join(ch for ch in str(value or "").lower() if ch.isalnum())
    return "vger" in text or "solomada" in text

def _normalize_encounter_filters(encounter_family, target_family, opponent=None):
    return encounter_family, target_family, opponent

@mcp.tool()
def observed_crew_performance(
    ship: str | None = None,
    opponent: str | None = None,
    captain: str | None = None,
    bridge_contains: str | None = None,
    battle_type: str | None = None,
    encounter_family: str | None = None,
    target_family: str | None = None,
    solo_or_group: str | None = None,
    min_sample: int = 1,
    limit: int = 25,
):
    """Compare observed crew performance across comparable battles."""
    ship = _text_or_none(ship)
    opponent = _text_or_none(opponent)
    captain = _text_or_none(captain)
    bridge_contains = _text_or_none(bridge_contains)
    battle_type = _text_or_none(battle_type)
    encounter_family = _text_or_none(encounter_family)
    target_family = _text_or_none(target_family)
    solo_or_group = _text_or_none(solo_or_group)
    encounter_family, target_family, opponent = _normalize_encounter_filters(encounter_family, target_family, opponent)
    min_sample = max(1, int(min_sample))
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_observed_crew_performance
            WHERE (? IS NULL OR ship_name LIKE ?)
              AND (? IS NULL OR COALESCE(opponent_ship_name, opponent_name, '') LIKE ?)
              AND (? IS NULL OR captain_name LIKE ?)
              AND (? IS NULL OR bridge_crew LIKE ?)
              AND (? IS NULL OR battle_type = ?)
              AND (? IS NULL OR encounter_family = ?)
              AND (? IS NULL OR target_family LIKE ?)
              AND (? IS NULL OR solo_or_group = ?)
              AND sample_size >= ?
            ORDER BY
              sample_size DESC,
              avg_damage_exchange_ratio DESC,
              avg_damage_dealt_per_round DESC
            LIMIT ?
        """, (
            ship, _like(ship),
            opponent, _like(opponent),
            captain, _like(captain),
            bridge_contains, _like(bridge_contains),
            battle_type, battle_type,
            encounter_family, encounter_family,
            target_family, _like(target_family),
            solo_or_group, solo_or_group,
            min_sample,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def officer_observed_impact(
    officer: str | None = None,
    ship: str | None = None,
    opponent: str | None = None,
    role: str | None = None,
    battle_type: str | None = None,
    encounter_family: str | None = None,
    target_family: str | None = None,
    solo_or_group: str | None = None,
    min_sample: int = 1,
    limit: int = 25,
):
    """Compare observed officer impact across comparable battles."""
    officer = _text_or_none(officer)
    ship = _text_or_none(ship)
    opponent = _text_or_none(opponent)
    role = _text_or_none(role)
    battle_type = _text_or_none(battle_type)
    encounter_family = _text_or_none(encounter_family)
    target_family = _text_or_none(target_family)
    solo_or_group = _text_or_none(solo_or_group)
    encounter_family, target_family, opponent = _normalize_encounter_filters(encounter_family, target_family, opponent)
    min_sample = max(1, int(min_sample))
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_officer_observed_impact
            WHERE (? IS NULL OR officer_name LIKE ?)
              AND (? IS NULL OR ship_name LIKE ?)
              AND (? IS NULL OR COALESCE(opponent_ship_name, opponent_name, '') LIKE ?)
              AND (? IS NULL OR officer_role = ?)
              AND (? IS NULL OR battle_type = ?)
              AND (? IS NULL OR encounter_family = ?)
              AND (? IS NULL OR target_family LIKE ?)
              AND (? IS NULL OR solo_or_group = ?)
              AND sample_size >= ?
            ORDER BY
              sample_size DESC,
              avg_damage_exchange_ratio DESC,
              avg_trigger_count DESC
            LIMIT ?
        """, (
            officer, _like(officer),
            ship, _like(ship),
            opponent, _like(opponent),
            role, role,
            battle_type, battle_type,
            encounter_family, encounter_family,
            target_family, _like(target_family),
            solo_or_group, solo_or_group,
            min_sample,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def crew_change_comparison(
    player: str,
    ship: str | None = None,
    target_family: str | None = None,
    encounter_family: str | None = None,
    changed_role: str | None = None,
    officer: str | None = None,
    days: int = 90,
    min_sample: int = 2,
    limit: int = 25,
):
    """Compare same-player battle cohorts where exactly one officer slot changed."""
    player = _text_or_none(player)
    if not player:
        raise ValueError("crew_change_comparison requires player.")
    ship = _text_or_none(ship)
    target_family = _text_or_none(target_family)
    encounter_family = _text_or_none(encounter_family)
    changed_role = _text_or_none(changed_role)
    officer = _text_or_none(officer)
    encounter_family, target_family, _ = _normalize_encounter_filters(encounter_family, target_family)
    days = max(1, min(int(days), 3650))
    min_sample = max(1, min(int(min_sample), 1000))
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT
              event_id, battle_time, player_id,
              COALESCE(player_name, display_name, player_id) AS player_name,
              comparison_key, battle_type, encounter_family, target_family, solo_or_group,
              ship_name, ship_level, fleet_grade, opponent_name, opponent_ship_name, opponent_ship_level,
              captain_id, slot_captain_name,
              bridge_left_id, bridge_left_name, bridge_right_id, bridge_right_name,
              below_deck_1_id, below_deck_1_name, below_deck_2_id, below_deck_2_name,
              below_deck_3_id, below_deck_3_name, below_deck_4_id, below_deck_4_name,
              below_deck_5_id, below_deck_5_name, below_deck_6_id, below_deck_6_name,
              below_deck_7_id, below_deck_7_name, crew_signature,
              rounds, damage_dealt_per_round, damage_taken_per_round, damage_exchange_ratio,
              avg_overall_mitigation_pct, crit_rate_dealt, hull_repair_per_round,
              net_hull_damage_after_repairs, quality_bucket, quality_score
            FROM stfc_positional_crew_loadouts
            WHERE COALESCE(player_name, display_name, player_id, '') LIKE ?
              AND (? IS NULL OR ship_name LIKE ?)
              AND (? IS NULL OR target_family LIKE ?)
              AND (? IS NULL OR encounter_family = ?)
              AND datetime(battle_time) >= datetime('now', '-' || ? || ' days')
              AND quality_bucket IN ('good', 'partial')
              AND crew_slot_count >= 3
            ORDER BY battle_time DESC, event_id DESC
            LIMIT 5000
        """, (
            _like(player),
            ship, _like(ship),
            target_family, _like(target_family),
            encounter_family, encounter_family,
            days,
        )).fetchall()

    row_dicts = [dict(row) for row in rows]
    slot_defs = (
        ("captain", "captain_id", "slot_captain_name", "captain"),
        ("bridge_left", "bridge_left_id", "bridge_left_name", "bridge"),
        ("bridge_right", "bridge_right_id", "bridge_right_name", "bridge"),
        ("below_deck_1", "below_deck_1_id", "below_deck_1_name", "below_deck"),
        ("below_deck_2", "below_deck_2_id", "below_deck_2_name", "below_deck"),
        ("below_deck_3", "below_deck_3_id", "below_deck_3_name", "below_deck"),
        ("below_deck_4", "below_deck_4_id", "below_deck_4_name", "below_deck"),
        ("below_deck_5", "below_deck_5_id", "below_deck_5_name", "below_deck"),
        ("below_deck_6", "below_deck_6_id", "below_deck_6_name", "below_deck"),
        ("below_deck_7", "below_deck_7_id", "below_deck_7_name", "below_deck"),
    )
    metric_fields = (
        "rounds",
        "damage_dealt_per_round",
        "damage_taken_per_round",
        "damage_exchange_ratio",
        "avg_overall_mitigation_pct",
        "crit_rate_dealt",
        "hull_repair_per_round",
        "net_hull_damage_after_repairs",
        "quality_score",
    )
    grouped = {}
    for row in row_dicts:
        key = (row.get("comparison_key"), row.get("player_id") or row.get("player_name"), row.get("crew_signature"))
        grouped.setdefault(key, []).append(row)

    cohorts = []
    for group_rows in grouped.values():
        if len(group_rows) < min_sample:
            continue
        averages = {}
        for field in metric_fields:
            values = [float(row[field]) for row in group_rows if row.get(field) is not None]
            averages[field] = sum(values) / len(values) if values else None
        times = [str(row.get("battle_time") or "") for row in group_rows]
        cohorts.append({
            "sample": group_rows[0],
            "rows": group_rows,
            "averages": averages,
            "first_seen": min(times),
            "last_seen": max(times),
        })

    comparisons = []
    for left_index, left in enumerate(cohorts):
        for right in cohorts[left_index + 1:]:
            if left["sample"].get("comparison_key") != right["sample"].get("comparison_key"):
                continue
            left_player = left["sample"].get("player_id") or left["sample"].get("player_name")
            right_player = right["sample"].get("player_id") or right["sample"].get("player_name")
            if left_player != right_player:
                continue
            changes = [
                definition for definition in slot_defs
                if str(left["sample"].get(definition[1]) or "") != str(right["sample"].get(definition[1]) or "")
            ]
            if len(changes) != 1:
                continue
            slot, id_field, name_field, role = changes[0]
            if changed_role and changed_role not in (role, slot):
                continue
            left_officer = str(left["sample"].get(name_field) or left["sample"].get(id_field) or "empty")
            right_officer = str(right["sample"].get(name_field) or right["sample"].get(id_field) or "empty")
            if officer and officer.lower() not in left_officer.lower() and officer.lower() not in right_officer.lower():
                continue
            baseline, variant = (left, right) if left["last_seen"] <= right["last_seen"] else (right, left)
            deltas = {}
            delta_percent = {}
            for field in metric_fields:
                before = baseline["averages"][field]
                after = variant["averages"][field]
                deltas[field] = None if before is None or after is None else after - before
                delta_percent[field] = None if before in (None, 0) or after is None else ((after - before) / abs(before)) * 100
            sample = baseline["sample"]
            comparisons.append({
                "comparison_key": sample.get("comparison_key"),
                "player_name": sample.get("player_name"),
                "encounter_family": sample.get("encounter_family"),
                "target_family": sample.get("target_family"),
                "solo_or_group": sample.get("solo_or_group"),
                "ship_name": sample.get("ship_name"),
                "ship_level": sample.get("ship_level"),
                "fleet_grade": sample.get("fleet_grade"),
                "opponent_name": sample.get("opponent_ship_name") or sample.get("opponent_name"),
                "opponent_level": sample.get("opponent_ship_level"),
                "changed_slot": slot,
                "changed_role": role,
                "baseline_officer": baseline["sample"].get(name_field) or baseline["sample"].get(id_field) or "empty",
                "variant_officer": variant["sample"].get(name_field) or variant["sample"].get(id_field) or "empty",
                "baseline_sample_size": len(baseline["rows"]),
                "variant_sample_size": len(variant["rows"]),
                "baseline_first_seen": baseline["first_seen"],
                "baseline_last_seen": baseline["last_seen"],
                "variant_first_seen": variant["first_seen"],
                "variant_last_seen": variant["last_seen"],
                "baseline_event_ids": [row.get("event_id") for row in baseline["rows"][:20]],
                "variant_event_ids": [row.get("event_id") for row in variant["rows"][:20]],
                "baseline_averages": baseline["averages"],
                "variant_averages": variant["averages"],
                "deltas": deltas,
                "delta_percent": delta_percent,
            })
    comparisons.sort(
        key=lambda item: (
            -(item["baseline_sample_size"] + item["variant_sample_size"]),
            str(item["variant_last_seen"]),
        )
    )
    return {
        "filters": {
            "player": player,
            "ship": ship,
            "target_family": target_family,
            "encounter_family": encounter_family,
            "changed_role": changed_role,
            "officer": officer,
            "days": days,
            "min_sample": min_sample,
        },
        "source_rows": len(row_dicts),
        "qualifying_loadout_cohorts": len(cohorts),
        "comparison_count": len(comparisons),
        "comparisons": comparisons[:limit],
        "interpretation": "Each result holds player, ship, level/grade, encounter, target family/level, solo/group mode, and every other officer slot constant. Deltas are variant minus baseline. This is observational evidence, not proof of causation.",
    }

@mcp.tool()
def build_differences(
    event_id: int | None = None,
    player: str | None = None,
    ship: str | None = None,
    opponent: str | None = None,
    comparison_key: str | None = None,
    min_sample: int = 2,
    limit: int = 25,
):
    """Return ship rating and performance deltas versus comparable battle cohorts."""
    player = _text_or_none(player)
    ship = _text_or_none(ship)
    opponent = _text_or_none(opponent)
    comparison_key = _text_or_none(comparison_key)
    min_sample = max(1, int(min_sample))
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT
              event_id,
              battle_id,
              battle_time,
              side,
              display_name,
              player_id,
              player_name,
              ship_name,
              ship_level,
              fleet_grade,
              opponent_name,
              opponent_ship_name,
              opponent_ship_level,
              captain_name,
              bridge_crew,
              comparable_sample_size,
              offense_rating,
              defense_rating,
              health_rating,
              officer_rating,
              deflector_rating,
              forbidden_tech_rating,
              offense_rating_delta,
              defense_rating_delta,
              health_rating_delta,
              officer_rating_delta,
              deflector_rating_delta,
              forbidden_tech_rating_delta,
              damage_dealt_per_round,
              damage_taken_per_round,
              damage_exchange_ratio,
              damage_dealt_per_round_delta,
              damage_taken_per_round_delta,
              damage_exchange_ratio_delta,
              overall_mitigation_pct_delta,
              crit_rate_dealt_delta,
              hull_repair_per_round_delta,
              comparison_key
            FROM stfc_build_difference_summary
            WHERE (? IS NULL OR event_id = ?)
              AND (? IS NULL OR COALESCE(display_name, player_name, player_id, '') LIKE ?)
              AND (? IS NULL OR ship_name LIKE ?)
              AND (? IS NULL OR COALESCE(opponent_ship_name, opponent_name, '') LIKE ?)
              AND (? IS NULL OR comparison_key = ?)
              AND comparable_sample_size >= ?
            ORDER BY
              comparable_sample_size DESC,
              ABS(COALESCE(damage_exchange_ratio_delta, 0)) DESC,
              battle_time DESC
            LIMIT ?
        """, (
            event_id, event_id,
            player, _like(player),
            ship, _like(ship),
            opponent, _like(opponent),
            comparison_key, comparison_key,
            min_sample,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def encounter_score_summary(
    encounter_family: str | None = None,
    ship: str | None = None,
    target_family: str | None = None,
    opponent: str | None = None,
    captain: str | None = None,
    bridge_contains: str | None = None,
    solo_or_group: str | None = None,
    min_sample: int = 1,
    limit: int = 25,
):
    """Rank observed setups with encounter-aware scoring for hostiles, armadas, PvP, and outposts."""
    encounter_family = _text_or_none(encounter_family)
    ship = _text_or_none(ship)
    target_family = _text_or_none(target_family)
    opponent = _text_or_none(opponent)
    captain = _text_or_none(captain)
    bridge_contains = _text_or_none(bridge_contains)
    solo_or_group = _text_or_none(solo_or_group)
    encounter_family, target_family, opponent = _normalize_encounter_filters(encounter_family, target_family, opponent)
    min_sample = max(1, int(min_sample))
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_encounter_score_summary
            WHERE (? IS NULL OR encounter_family = ?)
              AND (? IS NULL OR ship_name LIKE ?)
              AND (? IS NULL OR target_family LIKE ?)
              AND (? IS NULL OR COALESCE(opponent_ship_name, opponent_name, '') LIKE ?)
              AND (? IS NULL OR captain_name LIKE ?)
              AND (? IS NULL OR bridge_crew LIKE ?)
              AND (? IS NULL OR solo_or_group = ?)
              AND sample_size >= ?
            ORDER BY
              avg_encounter_score DESC,
              sample_size DESC,
              avg_damage_exchange_ratio DESC
            LIMIT ?
        """, (
            encounter_family, encounter_family,
            ship, _like(ship),
            target_family, _like(target_family),
            opponent, _like(opponent),
            captain, _like(captain),
            bridge_contains, _like(bridge_contains),
            solo_or_group, solo_or_group,
            min_sample,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def battle_quality(
    event_id: int | None = None,
    quality_bucket: str | None = None,
    min_quality_score: float | None = None,
    limit: int = 25,
):
    """Return battle quality scores and warnings before trusting battles as evidence."""
    quality_bucket = _text_or_none(quality_bucket)
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_battle_quality
            WHERE (? IS NULL OR event_id = ?)
              AND (? IS NULL OR quality_bucket = ?)
              AND (? IS NULL OR quality_score >= ?)
            ORDER BY event_id DESC
            LIMIT ?
        """, (
            event_id, event_id,
            quality_bucket, quality_bucket,
            min_quality_score, min_quality_score,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def hostile_kill_count(player: str, days: int = 7):
    """Count distinct hostile kills for a player over a rolling day window using corrected analytics_initiator_wins."""
    player = _text_or_none(player)
    if not player:
        return {"error": "hostile_kill_count requires player"}
    days = max(1, min(int(days), 365))
    with connect(read_only=True) as conn:
        row = conn.execute("""
            WITH matching AS (
              SELECT DISTINCT
                event_id,
                battle_time,
                COALESCE(analytics_initiator_wins, 0) AS analytics_initiator_wins
              FROM stfc_battle_quality
              WHERE battle_type = 'hostile'
                AND lower(COALESCE(initiator_name, '')) LIKE lower(?)
                AND datetime(battle_time) >= datetime('now', ?)
            )
            SELECT
              ? AS player,
              ? AS days,
              COUNT(DISTINCT CASE WHEN analytics_initiator_wins = 1 THEN event_id END) AS hostile_kills,
              MIN(battle_time) AS first_battle_time,
              MAX(battle_time) AS last_battle_time,
              COUNT(DISTINCT CASE WHEN analytics_initiator_wins = 0 THEN event_id END) AS distinct_hostile_losses,
              'battle_type=hostile; analytics_initiator_wins=1; distinct event_id; rolling SQLite now window' AS count_basis
            FROM matching
        """, (_like(player), f"-{days} days", player, days)).fetchone()
        return dict(row) if row else {}

@mcp.tool()
def hostile_rep_summary(
    player: str,
    days: int = 7,
    faction: str | None = None,
    target: str | None = None,
):
    """Summarize hostile reputation gains, losses, and net changes by faction/resource for a player."""
    player = _text_or_none(player)
    if not player:
        return {"error": "hostile_rep_summary requires player"}
    days = max(1, min(int(days), 365))
    faction = _text_or_none(faction)
    target = _text_or_none(target)
    params = (
        _like(player),
        f"-{days} days",
        faction,
        _like(faction),
        _like(faction),
        target,
        _like(target),
        _like(target),
        _like(target),
    )
    where = """
        WHERE lower(COALESCE(player_name, player_id, '')) LIKE lower(?)
          AND datetime(battle_time) >= datetime('now', ?)
          AND (? IS NULL OR COALESCE(faction_name, resource_name, CAST(resource_id AS TEXT), '') LIKE ? OR COALESCE(resource_name, faction_name, CAST(resource_id AS TEXT), '') LIKE ?)
          AND (? IS NULL OR COALESCE(target_name, '') LIKE ? OR COALESCE(target_family, '') LIKE ? OR COALESCE(hostile_key, '') LIKE ?)
    """
    with connect(read_only=True) as conn:
        totals = conn.execute(f"""
            SELECT
              ? AS player,
              ? AS days,
              COUNT(DISTINCT event_id) AS battle_count,
              COUNT(*) AS reputation_row_count,
              SUM(CASE WHEN direction = 'gained' OR amount > 0 THEN amount ELSE 0 END) AS reputation_gained,
              SUM(CASE WHEN direction = 'lost' OR amount < 0 THEN ABS(amount) ELSE 0 END) AS reputation_lost,
              SUM(amount) AS net_reputation,
              MIN(battle_time) AS first_battle_time,
              MAX(battle_time) AS last_battle_time,
              'stfc_hostile_rep_gains; rolling SQLite now window; gained/lost kept separate; net=sum(amount)' AS count_basis
            FROM stfc_hostile_rep_gains
            {where}
        """, (player, days, *params)).fetchone()
        by_reputation = conn.execute(f"""
            SELECT
              COALESCE(faction_name, resource_name, CAST(resource_id AS TEXT), 'unknown') AS reputation,
              COALESCE(faction_name, 'unknown') AS faction_name,
              COALESCE(resource_name, CAST(resource_id AS TEXT), 'unknown') AS resource_name,
              resource_id,
              COUNT(DISTINCT event_id) AS battle_count,
              COUNT(*) AS reputation_row_count,
              SUM(CASE WHEN direction = 'gained' OR amount > 0 THEN amount ELSE 0 END) AS reputation_gained,
              SUM(CASE WHEN direction = 'lost' OR amount < 0 THEN ABS(amount) ELSE 0 END) AS reputation_lost,
              SUM(amount) AS net_reputation,
              MIN(battle_time) AS first_battle_time,
              MAX(battle_time) AS last_battle_time
            FROM stfc_hostile_rep_gains
            {where}
            GROUP BY reputation, faction_name, resource_name, resource_id
            ORDER BY net_reputation DESC, reputation_gained DESC
        """, params).fetchall()
        top_targets = conn.execute(f"""
            SELECT
              COALESCE(target_family, target_name, hostile_key, 'unknown') AS target_family,
              COALESCE(target_name, target_family, hostile_key, 'unknown') AS target_name,
              target_level,
              COUNT(DISTINCT event_id) AS battle_count,
              SUM(CASE WHEN direction = 'gained' OR amount > 0 THEN amount ELSE 0 END) AS reputation_gained,
              SUM(CASE WHEN direction = 'lost' OR amount < 0 THEN ABS(amount) ELSE 0 END) AS reputation_lost,
              SUM(amount) AS net_reputation
            FROM stfc_hostile_rep_gains
            {where}
            GROUP BY target_family, target_name, target_level
            ORDER BY net_reputation DESC, battle_count DESC
            LIMIT 25
        """, params).fetchall()
        return {
            "player": player,
            "days": days,
            "faction": faction,
            "target": target,
            "totals": dict(totals) if totals else {},
            "by_reputation": [dict(r) for r in by_reputation],
            "top_targets": [dict(r) for r in top_targets],
        }

@mcp.tool()
def comparison_groups(
    comparison_key: str | None = None,
    encounter_family: str | None = None,
    ship: str | None = None,
    target_family: str | None = None,
    solo_or_group: str | None = None,
    min_usable_samples: int = 1,
    limit: int = 25,
):
    """Return normalized comparison cohorts with evidence level and average observed performance."""
    comparison_key = _text_or_none(comparison_key)
    encounter_family = _text_or_none(encounter_family)
    ship = _text_or_none(ship)
    target_family = _text_or_none(target_family)
    solo_or_group = _text_or_none(solo_or_group)
    encounter_family, target_family, _ = _normalize_encounter_filters(encounter_family, target_family)
    min_usable_samples = max(1, int(min_usable_samples))
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_comparison_groups
            WHERE (? IS NULL OR comparison_key = ?)
              AND (? IS NULL OR encounter_family = ?)
              AND (? IS NULL OR ship_name LIKE ?)
              AND (? IS NULL OR target_family LIKE ?)
              AND (? IS NULL OR solo_or_group = ?)
              AND usable_samples >= ?
            ORDER BY usable_samples DESC, avg_encounter_score DESC
            LIMIT ?
        """, (
            comparison_key, comparison_key,
            encounter_family, encounter_family,
            ship, _like(ship),
            target_family, _like(target_family),
            solo_or_group, solo_or_group,
            min_usable_samples,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def group_armadas(
    event_id: int | None = None,
    player: str | None = None,
    target: str | None = None,
    limit: int = 25,
):
    """Return materialized group/solo-armada battle summaries with team totals and participant counts."""
    player = _text_or_none(player)
    target = _text_or_none(target)
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_group_armada_summary
            WHERE (? IS NULL OR event_id = ?)
              AND (? IS NULL OR armada_target_name LIKE ? OR armada_target_family LIKE ?)
              AND (? IS NULL OR event_id IN (
                SELECT event_id
                FROM stfc_group_armada_participants
                WHERE COALESCE(player_name, display_name, '') LIKE ?
              ))
            ORDER BY battle_time DESC, event_id DESC
            LIMIT ?
        """, (
            event_id, event_id,
            target, _like(target), _like(target),
            player, _like(player),
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def group_armada_participants(
    event_id: int | None = None,
    player: str | None = None,
    target: str | None = None,
    limit: int = 50,
):
    """Return one row per player-side ship participant in group/solo-armada style battles."""
    player = _text_or_none(player)
    target = _text_or_none(target)
    limit = max(1, min(int(limit), 500))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_group_armada_participants
            WHERE (? IS NULL OR event_id = ?)
              AND (? IS NULL OR COALESCE(player_name, display_name, '') LIKE ?)
              AND (? IS NULL OR armada_target_name LIKE ? OR armada_target_family LIKE ?)
            ORDER BY battle_time DESC, event_id DESC, participant_rank_by_damage ASC
            LIMIT ?
        """, (
            event_id, event_id,
            player, _like(player),
            target, _like(target), _like(target),
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def player_ship_baseline(
    player: str | None = None,
    ship: str | None = None,
    encounter_family: str | None = None,
    target_family: str | None = None,
    solo_or_group: str | None = None,
    limit: int = 25,
):
    """Summarize a player's observed ship baseline by encounter and target family. Requires player or ship."""
    player = _text_or_none(player)
    ship = _text_or_none(ship)
    encounter_family = _text_or_none(encounter_family)
    target_family = _text_or_none(target_family)
    solo_or_group = _text_or_none(solo_or_group)
    encounter_family, target_family, _ = _normalize_encounter_filters(encounter_family, target_family)
    limit = max(1, min(int(limit), 100))
    if not player and not ship:
        return {"error": "player_ship_baseline requires player or ship to avoid an expensive full-database baseline scan."}
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            WITH filtered AS (
              SELECT *
              FROM stfc_encounter_scored_battles
              WHERE (? IS NULL OR COALESCE(display_name, player_name, player_id, '') LIKE ?)
                AND (? IS NULL OR ship_name LIKE ?)
                AND (? IS NULL OR encounter_family = ?)
                AND (? IS NULL OR target_family LIKE ?)
                AND (? IS NULL OR solo_or_group = ?)
            )
            SELECT
              COALESCE(player_id, display_name, player_name, 'unknown') AS player_key,
              display_name,
              player_id,
              player_name,
              ship_name,
              ship_level,
              fleet_grade,
              encounter_family,
              target_family,
              solo_or_group,
              COUNT(*) AS sample_size,
              COUNT(DISTINCT comparison_key) AS comparison_group_count,
              AVG(encounter_score) AS avg_encounter_score,
              AVG(damage_exchange_ratio) AS avg_damage_exchange_ratio,
              AVG(damage_dealt_per_round) AS avg_damage_dealt_per_round,
              AVG(damage_taken_per_round) AS avg_damage_taken_per_round,
              AVG(damage_dealt_per_attack) AS avg_damage_dealt_per_attack,
              AVG(damage_taken_per_attack) AS avg_damage_taken_per_attack,
              AVG(avg_overall_mitigation_pct) AS avg_overall_mitigation_pct,
              AVG(crit_rate_dealt) AS avg_crit_rate_dealt,
              AVG(hull_repair_per_round) AS avg_hull_repair_per_round,
              AVG(offense_rating) AS avg_offense_rating,
              AVG(defense_rating) AS avg_defense_rating,
              AVG(health_rating) AS avg_health_rating,
              AVG(officer_rating) AS avg_officer_rating,
              AVG(deflector_rating) AS avg_deflector_rating,
              AVG(forbidden_tech_rating) AS avg_forbidden_tech_rating
            FROM filtered
            GROUP BY
              player_key,
              display_name,
              player_id,
              player_name,
              ship_name,
              ship_level,
              fleet_grade,
              encounter_family,
              target_family,
              solo_or_group
            ORDER BY sample_size DESC, avg_encounter_score DESC
            LIMIT ?
        """, (
            player, _like(player),
            ship, _like(ship),
            encounter_family, encounter_family,
            target_family, _like(target_family),
            solo_or_group, solo_or_group,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def battle_evidence(
    event_id: int | None = None,
    player: str | None = None,
    ship: str | None = None,
    comparison_key: str | None = None,
    limit: int = 25,
):
    """Return evidence-ready battle rows with quality, cohort strength, metrics, and evidence note."""
    player = _text_or_none(player)
    ship = _text_or_none(ship)
    comparison_key = _text_or_none(comparison_key)
    limit = max(1, min(int(limit), 100))
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT
              bq.event_id,
              bq.battle_id,
              bq.battle_time,
              bq.battle_type,
              bq.encounter_family,
              bq.target_family,
              bq.solo_or_group,
              bq.initiator_name,
              bq.target_name,
              bq.initiator_ship_name,
              bq.target_ship_name,
              bq.rounds,
              bq.attack_events,
              bq.ship_count,
              bq.actual_damage_taken,
              bq.battle_actual_damage_taken,
              bq.player_damage_dealt_actual,
              bq.player_damage_taken_actual,
              bq.player_shield_damage_taken,
              bq.player_hull_damage_taken,
              bq.player_damage_taken_before_mitigation,
              bq.player_attacks_dealt,
              bq.player_attacks_taken,
              bq.player_crits_dealt,
              bq.player_crits_taken,
              bq.player_crit_rate_dealt,
              bq.player_hull_repaired,
              bq.player_net_hull_damage_after_repairs,
              bq.player_avg_overall_mitigation_pct,
              bq.player_initial_hhp,
              bq.player_final_hhp,
              bq.target_initial_hhp,
              bq.target_final_hhp,
              bq.player_damage_exchange_ratio,
              bq.inferred_initiator_wins,
              bq.analytics_initiator_wins,
              bq.damage_before_mitigation,
              bq.avg_overall_mitigation_pct,
              bq.crit_rate,
              bq.total_repair,
              bq.quality_bucket,
              bq.quality_score,
              bq.quality_warnings,
              CASE
                WHEN bq.quality_bucket = 'bad' THEN 'Do not use as evidence until parse/data issues are fixed.'
                WHEN bq.quality_bucket IN ('good', 'partial') THEN 'Usable battle-log evidence. Use player_damage_taken_actual for player survivability; actual_damage_taken is battle-wide damage to all defenders.'
                ELSE 'Noisy battle-log evidence; use only as a weak observation.'
              END AS evidence_note
            FROM stfc_battle_quality bq
            WHERE (? IS NULL OR bq.event_id = ?)
              AND (? IS NULL OR COALESCE(bq.initiator_name, bq.target_name, '') LIKE ?)
              AND (? IS NULL OR COALESCE(bq.initiator_ship_name, bq.target_ship_name, '') LIKE ?)
              AND (? IS NULL OR (
                COALESCE(bq.encounter_family, '') || '|' ||
                COALESCE(bq.initiator_ship_name, bq.target_ship_name, '') || '|' ||
                COALESCE(bq.target_family, '')
              ) = ?)
            ORDER BY bq.event_id DESC
            LIMIT ?
        """, (
            event_id, event_id,
            player, _like(player),
            ship, _like(ship),
            comparison_key, comparison_key,
            limit,
        )).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def mechanics_catalog():
    """Explain the MCP-friendly STFC mechanics knowledge tables and when to use them."""
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT *
            FROM stfc_mechanics_catalog
            ORDER BY object_name
        """).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def expectation_profile(encounter_type: str, applies_to: str | None = None):
    """Return source-backed expectations, rules, and crews for an encounter type before judging a battle."""
    with connect(read_only=True) as conn:
        profiles = conn.execute("""
            SELECT *
            FROM stfc_expectation_profile_details
            WHERE encounter_type = ?
              AND (? IS NULL OR applies_to = ? OR applies_to IS NULL)
            ORDER BY
              CASE WHEN applies_to = ? THEN 0 ELSE 1 END,
              confidence DESC
        """, (encounter_type, applies_to, applies_to, applies_to)).fetchall()
        rules = conn.execute("""
            SELECT r.*, s.title AS source_title, s.url AS source_url, s.source_type
            FROM stfc_encounter_rules r
            LEFT JOIN stfc_mechanics_sources s ON s.source_id = r.source_id
            WHERE r.encounter_type = ?
              AND (? IS NULL OR r.applies_to = ? OR r.applies_to IS NULL)
            ORDER BY r.priority, r.rule_id
        """, (encounter_type, applies_to, applies_to)).fetchall()
        crews = conn.execute("""
            SELECT c.*, s.title AS source_title, s.url AS source_url, s.source_type
            FROM stfc_recommended_crews c
            LEFT JOIN stfc_mechanics_sources s ON s.source_id = c.source_id
            WHERE c.encounter_type = ?
              AND (? IS NULL OR c.applies_to = ? OR c.applies_to IS NULL)
            ORDER BY c.crew_id
        """, (encounter_type, applies_to, applies_to)).fetchall()

        return {
            "profiles": [dict(r) for r in profiles],
            "rules": [dict(r) for r in rules],
            "recommended_crews": [dict(r) for r in crews],
        }

@mcp.tool()
def stat_sources(stat_name: str):
    """Return known sources and scope rules for a stat, such as critical_mitigation."""
    with connect(read_only=True) as conn:
        rows = conn.execute("""
            SELECT ss.*, s.title AS source_title, s.url AS source_url, s.source_type
            FROM stfc_stat_sources ss
            LEFT JOIN stfc_mechanics_sources s ON s.source_id = ss.source_id
            WHERE lower(ss.stat_name) = lower(?)
            ORDER BY ss.scope, ss.source_name
        """, (stat_name,)).fetchall()
        return [dict(r) for r in rows]

@mcp.tool()
def get_raw_log(pk_id: int):
    """Fetch the raw_json for the TS frontend/parser to use."""
    with connect(read_only=True) as conn:
        row = conn.execute("SELECT raw_json FROM stfc_events WHERE id = ?", (pk_id,)).fetchone()
        return dict(row) if row else {"error": "Not found"}

@mcp.tool()
def save_ts_parse_result(id: int, parsed_json: str, summary: str):
    """The 'Aftermath' command: TS writes the final result back to Python."""
    blocked = _require_python_write_tools()
    if blocked:
        return blocked
    with connect() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO stfc_parsed_battles (pk_id, raw_json, summary_text)
            VALUES (?, ?, ?)
        """, (id, parsed_json, summary))
        return {"status": "success"}


@mcp.tool()
def reimport_entities_from_all_json(
    path: str = "",
):
    """Rebuild entities from game-data/all.json. Defaults to <project_root>/game-data/all.json."""
    blocked = _require_python_write_tools()
    if blocked:
        return blocked

    # Resolve path: use provided path if given, else fall back to project-root-relative default
    if path:
        p = Path(path)
    else:
        p = PROJECT_ROOT / "game-data" / "all.json"

    if not p.exists():
        return {
            "error": f"File not found: {p}",
            "hint": "Pass an explicit path or place all.json at <project_root>/game-data/all.json",
        }

    data = json.loads(p.read_text(encoding="utf-8"))

    rows = []

    def add_entity(entity_id, entity_type, obj):
        if not isinstance(obj, dict):
            return

        loca_id = (
            obj.get("loca_id")
            or obj.get("locaId")
            or obj.get("loca")
            or obj.get("name_loca_id")
            or obj.get("nameLocaId")
        )

        name = (
            obj.get("name")
            or obj.get("display_name")
            or obj.get("displayName")
            or obj.get("loca_name")
            or obj.get("locaName")
            or obj.get("title")
        )

        try:
            entity_id_int = int(entity_id)
        except Exception:
            return

        try:
            loca_id_int = int(loca_id) if loca_id is not None else None
        except Exception:
            loca_id_int = None

        rows.append((
            entity_id_int,
            str(entity_type),
            loca_id_int,
            str(name) if name is not None else None,
            json.dumps(obj, ensure_ascii=False),
        ))

    if isinstance(data, dict):
        for top_key, value in data.items():
            if isinstance(value, dict):
                # Case: { "ships": { "123": {...} } }
                if all(isinstance(v, dict) for v in value.values()):
                    for entity_id, obj in value.items():
                        add_entity(entity_id, top_key, obj)

                # Case: { "123": {...} }
                elif "id" in value:
                    add_entity(value.get("id", top_key), top_key, value)

            elif isinstance(value, list):
                # Case: { "ships": [ {...}, {...} ] }
                for obj in value:
                    if isinstance(obj, dict):
                        entity_id = (
                            obj.get("id")
                            or obj.get("art_id")
                            or obj.get("artId")
                            or obj.get("loca_id")
                            or obj.get("locaId")
                        )
                        add_entity(entity_id, top_key, obj)

    with connect() as conn:
        conn.execute("DELETE FROM entities")
        conn.executemany(
            """
            INSERT OR REPLACE INTO entities (id, type, loca_id, name, raw_json)
            VALUES (?, ?, ?, ?, ?)
            """,
            rows,
        )

    return {
        "status": "success",
        "inserted": len(rows),
        "path": str(p),
    }
