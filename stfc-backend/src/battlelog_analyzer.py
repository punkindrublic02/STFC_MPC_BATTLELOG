import sqlite3
import json
from typing import Dict, List, Optional, Any
from config import settings

DB_PATH = settings.db_path
TABLE_NAME = "stfc_events"
SOURCE_COL = "raw_json"
RESULT_COL = "parsed_summary"


class BattleAnalyzer:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    # ------------------------------------------------------------
    # DB Initialization
    # ------------------------------------------------------------
    def initialize_database(self) -> bool:
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                f"SELECT name FROM sqlite_master "
                f"WHERE type='table' AND name='{TABLE_NAME}'"
            )
            if not cur.fetchone():
                print(f"Error: Table '{TABLE_NAME}' not found.")
                return False

            cur.execute(f"PRAGMA table_info({TABLE_NAME})")
            cols = [c[1] for c in cur.fetchall()]
            if RESULT_COL not in cols:
                print(f"Adding column '{RESULT_COL}' to '{TABLE_NAME}'...")
                cur.execute(
                    f"ALTER TABLE {TABLE_NAME} "
                    f"ADD COLUMN {RESULT_COL} TEXT"
                )
                conn.commit()
            return True
        except Exception as e:
            print(f"Initialization Error: {e}")
            return False
        finally:
            conn.close()

    # ------------------------------------------------------------
    # Pattern-Based Battle Log Parser
    # ------------------------------------------------------------
        # ------------------------------------------------------------
    # Correct Opcode-Based Battle Log Parser (Final)
    # ------------------------------------------------------------
    def _resolve_name_from_db(self, entity_id: int) -> str | None:
        """Try to resolve a name for any entity id from the game entity catalog."""
        try:
            conn = self.get_connection()
            conn.row_factory = sqlite3.Row
            # Try game entity catalog first (officers, abilities, FT, weapons)
            row = conn.execute(
                """
                SELECT COALESCE(display_name, human_text) AS name
                FROM stfc_game_entity_catalog
                WHERE entity_id = ?
                LIMIT 1
                """,
                (entity_id,),
            ).fetchone()
            if row and row["name"]:
                conn.close()
                return str(row["name"])
            # Fallback: entities table
            row = conn.execute(
                "SELECT name FROM entities WHERE id = ? LIMIT 1",
                (entity_id,),
            ).fetchone()
            conn.close()
            if row and row["name"]:
                return str(row["name"])
        except Exception:
            pass
        return None

    def _parse_battle_log(self, log: List[Any]) -> Dict[str, Any]:
        """
        Fully decoded battle log parser:
        - Officer abilities
        - Forbidden tech buffs
        - Attack payloads
        - Attack metadata + triggers
        - Role labels (Initiator/Target)
        - Name lookups (officer/weapon/FT)
        """

        # -----------------------------
        # Name resolver (DB-backed, falls back to id string)
        # -----------------------------
        _name_cache: Dict[int, str | None] = {}

        def resolve(entity_id: int) -> str | None:
            if entity_id not in _name_cache:
                _name_cache[entity_id] = self._resolve_name_from_db(entity_id)
            return _name_cache[entity_id]

        # -----------------------------
        # Parse events
        # -----------------------------
        events = []
        round_num = 1
        subround = 1
        event_index = 0

        def next_event():
            nonlocal event_index
            event_index += 1
            return event_index

        i = 0
        n = len(log)

        while i < n:
            op = log[i]

            # -------------------------
            # OFFICER ABILITY
            # -------------------------
            if op == -86:
                officer_id = log[i + 1]
                ability_id = log[i + 2]
                value = log[i + 3]

                events.append({
                    "round": round_num,
                    "subround": subround,
                    "event": next_event(),
                    "type": "ABILITY",
                    "officer_id": officer_id,
                    "officer_name": resolve(officer_id),
                    "ability_id": ability_id,
                    "ability_name": resolve(ability_id),
                    "value": value,
                })

                i += 5
                continue

            # -------------------------
            # FORBIDDEN TECH
            # -------------------------
            if op == -84:
                j = i + 1
                while j < n and log[j] != -83:
                    ship_id = log[j]
                    if log[j + 1] != -82:
                        break

                    ft_id = log[j + 2]
                    effect_id = log[j + 3]
                    value = log[j + 4]

                    events.append({
                        "round": round_num,
                        "subround": subround,
                        "event": next_event(),
                        "type": "FORBIDDEN_TECH",
                        "ship_id": ship_id,
                        "ft_id": ft_id,
                        "ft_name": resolve(ft_id),
                        "effect_id": effect_id,
                        "effect_name": resolve(effect_id),
                        "value": value,
                    })

                    j += 6

                i = j + 1
                continue

            # -------------------------
            # ATTACK PAYLOAD
            # -------------------------
            if op == -98:
                attacker = log[i + 1]
                target = log[i + 2]
                flags = log[i + 3:i + 7]

                shots = log[i + 7]
                remaining_hhp = log[i + 8]
                damage_shp = log[i + 9]
                remaining_shp = log[i + 10]
                std_mitigated = log[i + 11]
                iso_damage = log[i + 12]
                iso_mitigated = log[i + 13]
                apex_mitigated = log[i + 14]

                attack = {
                    "round": round_num,
                    "subround": subround,
                    "event": next_event(),
                    "type": "ATTACK",
                    "attacker_id": attacker,
                    "target_id": target,
                    "flags": flags,
                    "shots": shots,
                    "remaining_hhp": remaining_hhp,
                    "damage_shp": damage_shp,
                    "remaining_shp": remaining_shp,
                    "std_mitigated": std_mitigated,
                    "iso_damage": iso_damage,
                    "iso_mitigated": iso_mitigated,
                    "apex_mitigated": apex_mitigated,
                    "weapon_id": None,
                    "weapon_name": None,
                    "damage_type_id": None,
                    "extra_value": None,
                    "triggers": [],
                }

                j = i + 15

                # -------------------------
                # ATTACK METADATA + TRIGGERS
                # -------------------------
                if j < n and log[j] == -93:
                    ship_id = log[j + 1]
                    weapon_id = log[j + 3]
                    damage_type_id = log[j + 4]
                    extra_value = log[j + 5]

                    attack["weapon_id"] = weapon_id
                    attack["weapon_name"] = resolve(weapon_id)
                    attack["damage_type_id"] = damage_type_id
                    attack["extra_value"] = extra_value

                    k = j + 6
                    while k < n and log[k] != -99:
                        if log[k] == -91:
                            ability_id = log[k + 1]
                            effect_id = log[k + 2]
                            value = log[k + 3]
                            attack["triggers"].append({
                                "ability_id": ability_id,
                                "effect_id": effect_id,
                                "value": value,
                            })
                            k += 4
                        else:
                            k += 1

                    i = k + 1
                else:
                    i = j

                events.append(attack)
                continue

            # -------------------------
            # END ROUND
            # -------------------------
            if op == -97:
                break

            i += 1

        # ------------------------------------------------------------
        # ROLE LABELS (Initiator / Target)
        # ------------------------------------------------------------
        initiator_id = None
        target_id = None

        for e in events:
            if e["type"] == "ATTACK":
                initiator_id = e["attacker_id"]
                target_id = e["target_id"]
                break

        for e in events:
            if e["type"] == "ATTACK":
                e["subject"] = "Initiator 1" if e["attacker_id"] == initiator_id else "Target 1"
                e["object"] = "Target 1" if e["target_id"] == target_id else "Initiator 1"

            if e["type"] == "ABILITY":
                e["subject"] = "Initiator 1" if e["officer_id"] == initiator_id else "Target 1"

            if e["type"] == "FORBIDDEN_TECH":
                e["subject"] = "Initiator 1" if e["ship_id"] == initiator_id else "Target 1"

        return {"events": events}


    # ------------------------------------------------------------
    # High-Level Journal Parser
    # ------------------------------------------------------------
    def parse_raw_payload(self, raw_payload: str) -> Optional[Dict[str, Any]]:
        try:
            if not raw_payload:
                return None

            data = json.loads(raw_payload)
            journal = data.get("journal", data)

            battle_duration = int(journal.get("battle_duration", 0) or 0)

            i_hp_list = journal.get("initial_ship_hps") or [0]
            i_sh_list = journal.get("initial_ship_shps") or [0]
            f_hp_list = journal.get("final_ship_hps") or [0]
            f_sh_list = journal.get("final_ship_shps") or [0]

            i_hp = float(sum(i_hp_list))
            i_sh = float(sum(i_sh_list))
            f_hp = float(sum(f_hp_list))
            f_sh = float(sum(f_sh_list))

            hp_lost = max(0.0, i_hp - f_hp)
            sh_lost = max(0.0, i_sh - f_sh)
            victory = f_hp > 0.0
            hp_efficiency = (f_hp / i_hp * 100.0) if i_hp > 0 else 0.0

            battle_log = journal.get("battle_log") or []
            parsed_log = self._parse_battle_log(battle_log)

            winner = "attacker" if victory else "defender"

            return {
                "victory": bool(victory),
                "winner": winner,
                "battle_duration": battle_duration,
                "rounds": battle_duration,
                "hp_efficiency": round(hp_efficiency, 2),
                "hp_lost": int(hp_lost),
                "sh_lost": int(sh_lost),
                "initial_ship_hps": i_hp_list,
                "initial_ship_shps": i_sh_list,
                "final_ship_hps": f_hp_list,
                "final_ship_shps": f_sh_list,
                "events": parsed_log["events"],
            }

        except Exception as e:
            return {"error": str(e)}

    # ------------------------------------------------------------
    # Process Logs
    # ------------------------------------------------------------
    def process_logs(self, limit: Optional[int] = None):
        conn = self.get_connection()
        cur = conn.cursor()

        query = (
            f"SELECT rowid, {SOURCE_COL} "
            f"FROM {TABLE_NAME} WHERE {RESULT_COL} IS NULL"
        )
        if limit:
            query += f" LIMIT {limit}"

        cur.execute(query)
        rows = cur.fetchall()
        print(f"Processing {len(rows)} new logs...")

        for rid, raw_content in rows:
            summary = self.parse_raw_payload(raw_content)
            if summary:
                cur.execute(
                    f"UPDATE {TABLE_NAME} "
                    f"SET {RESULT_COL} = ? WHERE rowid = ?",
                    (json.dumps(summary), rid),
                )

        conn.commit()
        conn.close()

    # ------------------------------------------------------------
    # Performance Report
    # ------------------------------------------------------------
    def get_performance_report(self) -> str:
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            f"SELECT {RESULT_COL} FROM {TABLE_NAME} "
            f"WHERE {RESULT_COL} IS NOT NULL"
        )
        rows = cur.fetchall()
        conn.close()

        summaries = []
        for r in rows:
            try:
                obj = json.loads(r[0])
                if "error" not in obj:
                    summaries.append(obj)
            except Exception:
                continue

        if not summaries:
            return "No valid performance data found in the database."

        total = len(summaries)
        wins = sum(1 for s in summaries if s.get("victory"))
        total_hp_loss = sum(s.get("hp_lost", 0) for s in summaries)
        total_sh_loss = sum(s.get("sh_lost", 0) for s in summaries)
        avg_rounds = sum(s.get("rounds", 0) for s in summaries) / total
        avg_eff = sum(s.get("hp_efficiency", 0) for s in summaries) / total

        lines = [
            "=" * 40,
            f"STFC BATTLE REPORT: {TABLE_NAME}",
            "=" * 40,
            f"Total Battles:         {total}",
            f"Win Rate:              {(wins / total * 100):.2f}%",
            f"Avg Rounds:            {avg_rounds:.1f}",
            f"Avg Hull Remaining:    {avg_eff:.2f}%",
            f"Total Hull Damaged:    {total_hp_loss:,.0f}",
            f"Total Shield Damaged:  {total_sh_loss:,.0f}",
            "=" * 40,
        ]
        return "\n".join(lines)


# ------------------------------------------------------------
# Main Entry
# ------------------------------------------------------------
if __name__ == "__main__":
    analyzer = BattleAnalyzer()
    if analyzer.initialize_database():
        analyzer.process_logs()
        print(analyzer.get_performance_report())
