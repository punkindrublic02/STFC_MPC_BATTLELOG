from __future__ import annotations

from typing import Dict, Optional, List, Any
import sqlite3


class EntityResolver:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self._entity_cache: Dict[int, Optional[Dict[str, Any]]] = {}
        self._loca_cache: Dict[Any, Optional[str]] = {}
        self._combat_label_cache: Dict[int, str] = {}

    def resolve_entity(self, entity_id: int) -> Optional[Dict[str, Any]]:
        if entity_id in self._entity_cache:
            return self._entity_cache[entity_id]

        row = self.conn.execute(
            "SELECT * FROM entities WHERE id = ?",
            (entity_id,),
        ).fetchone()

        result = dict(row) if row else None
        self._entity_cache[entity_id] = result
        return result

    def resolve_name(self, entity_id: int) -> Optional[str]:
        entity = self.resolve_entity(entity_id)
        if not entity:
            return None

        raw_name = entity.get("name")
        if raw_name and str(raw_name).strip() and str(raw_name).strip().lower() != "unknown":
            return str(raw_name).strip()

        display_name = entity.get("display_name")
        if display_name and str(display_name).strip() and str(display_name).strip().lower() != "unknown":
            return str(display_name).strip()

        loca_id = (
            entity.get("name_loca_id")
            or entity.get("display_name_loca_id")
            or entity.get("loca_id")
        )
        if loca_id is not None:
            translated = self.resolve_loca(loca_id)
            if translated and translated.strip().lower() != "unknown":
                return translated.strip()

        return None

    def resolve_loca(self, loca_id: Any) -> Optional[str]:
        if loca_id in self._loca_cache:
            return self._loca_cache[loca_id]

        text: Optional[str] = None

        # Preferred path: game_translations(key, category, text_value)
        try:
            row = self.conn.execute(
                """
                SELECT text_value
                FROM game_translations
                WHERE key = ?
                LIMIT 1
                """,
                (loca_id,),
            ).fetchone()
            if row and row["text_value"]:
                text = str(row["text_value"])
        except Exception:
            pass

        # Fallback: some dbs may store loca keys as strings
        if text is None:
            try:
                row = self.conn.execute(
                    """
                    SELECT text_value
                    FROM game_translations
                    WHERE key = ?
                    LIMIT 1
                    """,
                    (str(loca_id),),
                ).fetchone()
                if row and row["text_value"]:
                    text = str(row["text_value"])
            except Exception:
                pass

        # Legacy fallback if the older table still exists
        if text is None:
            try:
                row = self.conn.execute(
                    "SELECT text FROM game_translation WHERE id = ?",
                    (loca_id,),
                ).fetchone()
                if row and row["text"]:
                    text = str(row["text"])
            except Exception:
                pass

        self._loca_cache[loca_id] = text
        return text

    def resolve_many(self, entity_ids: List[int]) -> Dict[int, Optional[str]]:
        return {eid: self.resolve_name(eid) for eid in entity_ids}

    def resolve_combat_entity_label(self, combat_id: Optional[int]) -> str:
        if combat_id is None:
            return "Unknown"

        try:
            combat_id = int(combat_id)
        except:
            return "Unknown"

        if combat_id in self._combat_label_cache:
            return self._combat_label_cache[combat_id]

        label = None
        hull_id = None
        canonical_entity_id = None

        # STEP 1 — runtime combat entity → hull via parsed_participants
        try:
            row = self.conn.execute(
                """
                SELECT hull_id
                FROM parsed_participants
                WHERE ship_id = ?
                LIMIT 1
                """,
                (combat_id,),
            ).fetchone()

            if row:
                hull_id = row["hull_id"]
        except:
            pass

        # STEP 2 — hull → identity map
        if hull_id is not None:
            try:
                row = self.conn.execute(
                    """
                    SELECT canonical_entity_id, ship_name
                    FROM ship_identity_map
                    WHERE raw_hull_id = ?
                    LIMIT 1
                    """,
                    (hull_id,),
                ).fetchone()

                if row:
                    canonical_entity_id = row["canonical_entity_id"]

                    if row["ship_name"] and row["ship_name"] != "Unknown":
                        label = row["ship_name"]
            except:
                pass

        # STEP 3 — canonical entity → entities/raw_json
        if label is None and canonical_entity_id is not None:
            label = self.resolve_name(canonical_entity_id)

        # STEP 4 — fallback hull direct lookup
        if label is None and hull_id is not None:
            label = self.resolve_name(hull_id)

        # STEP 5 — hostile structured fallback
        if label is None and hull_id is not None:
            label = f"Hull[{hull_id}]"

        if label is None:
            label = f"CombatEntity[{combat_id}]"

        self._combat_label_cache[combat_id] = label
        return label

    

    def label(self, entity_id: Optional[int]) -> str:
        if entity_id is None:
            return "Unknown"
        try:
            entity_id = int(entity_id)
        except (TypeError, ValueError):
            return "Unknown"

        name = self.resolve_name(entity_id)
        if name:
            return f"{name} [{entity_id}]"
        return str(entity_id)
