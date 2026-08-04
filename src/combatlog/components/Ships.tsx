import * as React from "react";
import { CombatAssetLabel } from "./CombatAssetLabel";
import { ColumnDefinition, CombatLogCell, CombatLogTable } from "./CombatLogTable";
import {
  CombatLogParsedData,
  GameData,
  getShipName,
  lookupComponent,
  RawCombatLog,
} from "../util/combatLog";

export interface ShipsProps {
  parsedData: CombatLogParsedData;
  input: RawCombatLog;
  data: GameData;
  raw_json: boolean;
}

function formatCompactNumber(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  if (Math.abs(num) >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return Math.round(num).toLocaleString();
}

function getBaseHullHealth(ship: any, data: GameData) {
  const hullId = ship.fleetInfo.hull_ids?.[0] ?? ship.fleetData.hull_ids?.[ship.infoIndex];
  const level = ship.fleetInfo.ship_levels?.[ship.infoId];
  const baseHull = data.ship?.[hullId]?.levels?.find((entry) => entry.level === level)?.health;

  return typeof baseHull === "number" && Number.isFinite(baseHull) && baseHull > 0
    ? baseHull
    : undefined;
}

function getBattleMaxHull(ship: any) {
  const maxHull = ship.fleetInfo.ship_hps?.[ship.infoId];
  return typeof maxHull === "number" && Number.isFinite(maxHull) && maxHull > 0
    ? maxHull
    : undefined;
}

function formatHullOverBase(ship: any, data: GameData) {
  const baseHull = getBaseHullHealth(ship, data);
  const maxHull = getBattleMaxHull(ship);
  if (!baseHull || !maxHull) return "";

  const percent = (maxHull / baseHull - 1) * 100;
  const sign = percent > 0 ? "+" : "";
  const percentText =
    Math.abs(percent) >= 1000
      ? `${sign}${formatCompactNumber(percent)}%`
      : `${sign}${percent.toFixed(Math.abs(percent) < 10 ? 1 : 0)}%`;

  return `${percentText} (${(maxHull / baseHull).toFixed(2)}x base)`;
}

export const Ships = ({ parsedData, input, data, raw_json }: ShipsProps) => {
  const tableData: CombatLogCell[][] = [];
  const ships = parsedData.allShips;
  tableData.push([
    "name",
    ...ships.map((s) => {
      const name = getShipName(s, input, data);
      const hullId = s.fleetInfo.hull_ids?.[0] ?? s.fleetData.hull_ids?.[s.infoIndex];
      return (
        <CombatAssetLabel
          key={`${s.shipId}:${hullId}:name`}
          data={data}
          kind="ship"
          id={hullId}
          label={name}
          secondary={s.displayName}
        />
      );
    }),
  ]);
  tableData.push(["grade", ...ships.map((s) => `G${s.fleetInfo.fleet_grade}`)]);
  tableData.push(["tier", ...ships.map((s) => s.fleetInfo.ship_tiers[s.infoId])]);
  tableData.push(["level", ...ships.map((s) => s.fleetInfo.ship_levels[s.infoId])]);
  tableData.push(["base hull", ...ships.map((s) => formatCompactNumber(getBaseHullHealth(s, data)))]);
  tableData.push(["battle max hull", ...ships.map((s) => formatCompactNumber(getBattleMaxHull(s)))]);
  tableData.push(["hull over base", ...ships.map((s) => formatHullOverBase(s, data))]);
  tableData.push([" "]);
  tableData.push(["ACTIVATED BUFFS"]);
  tableData.push(["Cloaked", ...ships.map((s) => (s.fleetInfo.is_cloaked ? "YES" : ""))]);
  tableData.push([
    "Cerritos supported",
    ...ships.map((s) => (s.fleetInfo.is_supported ? "YES" : "")),
  ]);
  tableData.push([
    "Defiant reinforced",
    ...ships.map((s) => (s.fleetInfo.is_armada_supported ? "YES" : "")),
  ]);
  tableData.push([
    "Titan fortified",
    ...ships.map((s) => (s.fleetInfo.is_system_wide_buffed ? "YES" : "")),
  ]);
  tableData.push([
    "Titan max fortified",
    ...ships.map((s) => (s.fleetInfo.is_system_wide_supreme_buffed ? "YES" : "")),
  ]);
  tableData.push(["Mantis debuff", ...ships.map((s) => (s.fleetInfo.is_debuffed ? "YES" : ""))]);
  tableData.push([
    "war shield",
    ...ships.map((s) => (s.fleetInfo.is_war_shield_activated ? "YES" : "")),
  ]);
  tableData.push([
    "weapon damage",
    ...ships.map((s) => (s.fleetInfo.is_weapon_damage_activated ? "YES" : "")),
  ]);
  tableData.push([
    "weapon penetration",
    ...ships.map((s) => (s.fleetInfo.is_weapon_penetration_activated ? "YES" : "")),
  ]);
  tableData.push([
    "weapon shots",
    ...ships.map((s) => (s.fleetInfo.is_weapon_shots_activated ? "YES" : "")),
  ]);
  tableData.push([
    "crit damage",
    ...ships.map((s) => (s.fleetInfo.is_critical_damage_activated ? "YES" : "")),
  ]);
  tableData.push(["detected", ...ships.map((s) => (s.fleetInfo.is_detected ? "YES" : ""))]);
  tableData.push([" "]);
  tableData.push(["COMPONENTS"]);
  const componentName = (ids: number[] | undefined, i: number) =>
    !!ids && ids[i] > 0 ? lookupComponent(ids[i], data)?.displayName : "";
  tableData.push([
    "Component 1",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 0)),
  ]);
  tableData.push([
    "Component 2",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 1)),
  ]);
  tableData.push([
    "Component 3",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 2)),
  ]);
  tableData.push([
    "Component 4",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 3)),
  ]);
  tableData.push([
    "Component 5",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 4)),
  ]);
  tableData.push([
    "Component 6",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 5)),
  ]);
  tableData.push([
    "Component 7",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 6)),
  ]);
  tableData.push([
    "Component 8",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 7)),
  ]);
  tableData.push([
    "Component 9",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 8)),
  ]);
  tableData.push([
    "Component 10",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 9)),
  ]);
  tableData.push([
    "Component 11",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 10)),
  ]);
  tableData.push([
    "Component 12",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 11)),
  ]);
  tableData.push([
    "Component 13",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 12)),
  ]);
  tableData.push([
    "Component 14",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 13)),
  ]);
  tableData.push([
    "Component 15",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 14)),
  ]);
  tableData.push([
    "Component 16",
    ...ships.map((s) => componentName(s.fleetInfo.ship_components[s.infoId], 15)),
  ]);

  const columns: ColumnDefinition[] = [
    { label: "", align: "left" },
    ...ships.map((ps) => ({ label: ps.displayName, align: "left" }) as const),
  ];

  return (
    <CombatLogTable
      raw_json={raw_json}
      columns={columns}
      data={tableData.map((rowData) => {
        const fillLen = Math.max(0, columns.length - rowData.length);
        const row: CombatLogCell[] = [
          ...rowData.map((x): CombatLogCell => {
            if (React.isValidElement(x)) return x;
            switch (typeof x) {
              case "string":
                return x;
              case "number":
                return x.toLocaleString();
              case "undefined":
                return "???";
              default:
                return `${x}`;
            }
          }),
          ...Array(fillLen).fill(""),
        ];
        return { cells: row };
      })}
    ></CombatLogTable>
  );
};
