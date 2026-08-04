import * as React from "react";
import { CombatAssetLabel } from "./CombatAssetLabel";
import { ColumnDefinition, CombatLogCell, CombatLogTable } from "./CombatLogTable";
import { ShipComponentWeapon } from "../../util/gameData";
import {
  CombatLogParsedData,
  GameData,
  getWeaponDamageType,
  lookupBattleLogAbility,
  lookupComponent,
  RawCombatLog,
} from "../util/combatLog";

export interface BattleLogProps {
  parsedData: CombatLogParsedData;
  input: RawCombatLog;
  data: GameData;
  raw_json: boolean;
}
const roundTo2Digits = (x: number) => Math.round((x + Number.EPSILON) * 100.0) / 100.0;

const compactNumber = (value: unknown) => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return value === undefined || value === null ? "???" : `${value}`;
  if (Math.abs(number) < 1000) {
    return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(number);
};

function shipCell(shipId: number | string, parsedData: CombatLogParsedData, input: RawCombatLog, data: GameData) {
  const ship = parsedData.shipById[shipId];
  if (!ship) return "???";
  const hullId = ship.fleetInfo.hull_ids?.[0] ?? ship.fleetData.hull_ids?.[ship.infoIndex];
  return (
    <CombatAssetLabel
      key={`${ship.shipId}:${hullId}:battle`}
      data={data}
      kind="ship"
      id={hullId}
      label={ship.displayName}
      secondary={ship.details ? undefined : ""}
    />
  );
}

export const BattleLog = ({ parsedData, input, data }: BattleLogProps) => {
  const tableData: CombatLogCell[][] = parsedData.battleLog.flatMap(
    (round, roundId) => [
      ...round.hullRepairs.flatMap((event, repairId) => [
        [
          roundId + 1,
          0,
          repairId + 1,
          shipCell(event.ship, parsedData, input, data),
          "REPAIR",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          event.hull_repaired,
          "",
          "",
        ],
      ]),
      ...round.subRounds.flatMap((subround, subRoundId) =>
        subround.events.flatMap((event, eventId) => {
          switch (event.type) {
            case "attack": {
              const weapon = lookupComponent(event.weapon, data);
              const weaponData = weapon?.component.data as ShipComponentWeapon | undefined;
              const totalDamage =
                event.damage_std_mitigated +
                event.damage_taken_shield +
                event.damage_taken_hull +
                event.damage_iso_mitigated +
                event.damage_apex_mitigated;
              return [
                [
                  roundId + 1,
                  subRoundId + 1,
                  eventId + 1,
                  shipCell(event.ship, parsedData, input, data),
                  "ATTACK",
                  shipCell(event.target, parsedData, input, data),
                  weapon?.displayName,
                  weaponData ? getWeaponDamageType(weaponData) : undefined,
                  roundTo2Digits(
                    totalDamage - event.damage_iso_unmitigated - event.damage_iso_mitigated,
                  ),
                  roundTo2Digits(event.damage_std_mitigated),
                  roundTo2Digits(event.damage_iso_unmitigated + event.damage_iso_mitigated),
                  roundTo2Digits(event.damage_iso_mitigated),
                  roundTo2Digits(event.damage_apex_mitigated),
                  event.damage_taken_shield,
                  event.damage_taken_hull,
                  event.crit ? "CRIT" : "",
                  "",
                  event.remaining_shield,
                  event.remaining_hull,
                ],
                ...event.triggers.map((trigger) => {
                  const ability = lookupBattleLogAbility(trigger.ability, trigger.officer, data);
                  return [
                    roundId + 1,
                    subRoundId + 1,
                    eventId + 1,
                    shipCell(event.ship, parsedData, input, data),
                    "TRIGGER",
                    ability?.source || "???",
                    ability?.source === "officer" ? (
                      <CombatAssetLabel
                        data={data}
                        kind="officer"
                        id={Number(trigger.officer)}
                        label={ability?.sourceDisplayName || String(trigger.officer)}
                        size={30}
                      />
                    ) : ability?.sourceDisplayName || trigger.officer,
                    ability?.abilityDisplayName || trigger.ability,
                    trigger.value,
                  ];
                }),
              ];
            }
            case "charge": {
              const weapon = lookupComponent(event.weapon, data);
              const weaponData = weapon?.component.data as ShipComponentWeapon | undefined;
              return [
                [
                  roundId + 1,
                  subRoundId + 1,
                  eventId + 1,
                  shipCell(event.ship, parsedData, input, data),
                  "CHARGE",
                  "",
                  weapon?.displayName,
                  weaponData ? getWeaponDamageType(weaponData) : undefined,
                  `${Math.round(event.charge * 100)}%`,
                ],
              ];
            }
            case "ability": {
              const ability = lookupBattleLogAbility(event.ability, event.officer, data);
              return [
                [
                  roundId + 1,
                  subRoundId + 1,
                  eventId + 1,
                  shipCell(event.ship, parsedData, input, data),
                  "APPLY",
                  ability?.source || "???",
                  ability?.source === "officer" ? (
                    <CombatAssetLabel
                      data={data}
                      kind="officer"
                      id={Number(event.officer)}
                      label={ability?.sourceDisplayName || String(event.officer)}
                      size={30}
                    />
                  ) : ability?.sourceDisplayName || event.officer,
                  ability?.abilityDisplayName || event.ability,
                  event.value,
                ],
              ];
            }
            default:
              return [roundId + 1, subRoundId + 1, eventId + 1, "???", (event as any).type, "???"];
          }
        }),
      ),
    ],
  );

  const columns: ColumnDefinition[] = [
    { label: "Rnd", align: "center", width: 44 },
    { label: "Sub", align: "center", width: 44 },
    { label: "Evt", align: "center", width: 44 },
    { label: "Subject", align: "left", width: "10%" },
    { label: "Verb", align: "left", width: 68 },
    { label: "Object", align: "left", width: "10%" },
    { label: "Weapon", align: "left", width: "9%" },
    { label: "Type", align: "left", width: 66 },
    { label: "Std", align: "right", width: 76 },
    { label: "Std Mit", align: "right", width: 76 },
    { label: "Iso", align: "right", width: 76 },
    { label: "Iso Mit", align: "right", width: 76 },
    { label: "Apex Mit", align: "right", width: 76 },
    { label: "SHP Dmg", align: "right", width: 76 },
    { label: "HHP Dmg", align: "right", width: 76 },
    { label: "Crit", align: "center", width: 48 },
    { label: "Repair", align: "right", width: 76 },
    { label: "SHP Left", align: "right", width: 76 },
    { label: "HHP Left", align: "right", width: 76 },
  ];
  const compactColumns = new Set([8, 9, 10, 11, 12, 13, 14, 16, 17, 18]);

  return (
    <CombatLogTable
      
      columns={columns}
      data={tableData.map((rowData) => {
        const fillLen = Math.max(0, columns.length - rowData.length);
        const row: CombatLogCell[] = [
          ...rowData.map((x, colIndex): CombatLogCell => {
            if (React.isValidElement(x)) return x;
            switch (typeof x) {
              case "string":
                return x;
              case "number":
                return compactColumns.has(colIndex) ? compactNumber(x) : x.toLocaleString();
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
