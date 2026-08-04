import * as React from "react";
import { Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { CombatAssetLabel } from "./CombatAssetLabel";
import { ColumnDefinition, CombatLogTable } from "./CombatLogTable";
import {
  CombatLogParsedData,
  CombatLogShip,
  GameData,
  getShipName,
  getHullType,
  lookupBuff,
  lookupOfficer,
} from "../util/combatLog";
import { RawCombatLog } from "../util/inputTypes";
import {
  allDamageMultiplier,
  apexMitigationTotal,
  critDamage,
  getStats,
  hhpDepleted,
  hullDamageIn,
  hullDamageOut,
  isoDamageMultiplierTotal,
  isoMitigationTotal,
  shieldMitigationTotal,
  shotsIn,
  shotsOut,
  shpDepleted,
  stdDamageMultiplierTotal,
  stdMitigationTotal,
} from "../util/combatLogStats";
import { roundTo2Digits, infinityToEmpty, shortNumber } from "../util/format";

export interface OverviewProps {
  parsedData: CombatLogParsedData;
  input: RawCombatLog;
  data: GameData;
  onOpenBuffs?: () => void;
}

const officerVisuals = (ship: CombatLogShip, data: GameData, start: number, end: number) => {
  const officers = ship.fleetData.fleets_officers[ship.fleetId] ?? [];
  const nodes = officers.slice(start, end).flatMap((officer, offset) => {
    if (!officer) return [];
    const index = start + offset;
    const detail = ship.officers[index];
    if (start >= 3 && detail?.details?.below_decks_ability === undefined) return [];
    return [
      <CombatAssetLabel
        key={`${ship.shipId}:${index}:${officer.id}`}
        data={data}
        kind="officer"
        id={officer.id}
        label={detail?.officerName ?? `Officer ${officer.id}`}
        secondary={index === 0 ? "Captain" : undefined}
        captain={index === 0}
        size={30}
      />,
    ];
  });

  const text = nodes.map((node) => (node.props as { label?: string }).label).join(" + ");
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" data-text={text || ""} title={text || ""}>
      {nodes.length ? nodes : ""}
    </Stack>
  );
};

const bridgeSetup = (ship: CombatLogShip, data: GameData) => officerVisuals(ship, data, 0, 3);

const belowDeckSetup = (ship: CombatLogShip, data: GameData) => officerVisuals(ship, data, 3, 16);

const buffs = (ship: CombatLogShip) => {
  const result = [];
  if (ship.fleetInfo.is_cloaked) {
    result.push("Cloak");
  }
  if (ship.fleetInfo.is_supported) {
    result.push("Cerritos");
  }
  if (ship.fleetInfo.is_armada_supported) {
    result.push("Defiant");
  }
  if (ship.fleetInfo.is_system_wide_buffed) {
    result.push("Titan");
  }
  if (ship.fleetInfo.is_system_wide_supreme_buffed) {
    result.push("TitanMax");
  }
  if (ship.fleetInfo.is_debuffed) {
    result.push("Mantis");
  }
  return result.join(" + ");
};

const activeBuffChips = (ship: CombatLogShip, data: GameData, mode: "officer" | "other") => {
  const buffsForShip = ship.fleetInfo.active_buffs
    .map((buff) => lookupBuff(buff.buff_id, buff.activator_id, data))
    .filter((buff) => (mode === "officer" ? buff.data?.type === "officer" : buff.data?.type !== "officer"));

  const uniqueBuffs = buffsForShip.filter(
    (buff, index, all) =>
      all.findIndex((candidate) => candidate.buff_id === buff.buff_id && candidate.activator_id === buff.activator_id) === index,
  );

  const visible = uniqueBuffs.slice(0, 6);
  const text = uniqueBuffs.map((buff) => `${buff.activatorDisplayName}: ${buff.buffDisplayName}`).join(" | ");

  if (!visible.length) return "";

  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" data-text={text} title={text}>
      {visible.map((buff) => (
        <Chip
          key={`${ship.shipId}:${buff.activator_id}:${buff.buff_id}`}
          size="small"
          label={`${buff.activatorDisplayName}: ${buff.buffDisplayName}`}
          variant={mode === "officer" ? "filled" : "outlined"}
        />
      ))}
      {uniqueBuffs.length > visible.length ? (
        <Chip size="small" label={`+${uniqueBuffs.length - visible.length} more`} variant="outlined" />
      ) : null}
    </Stack>
  );
};

const buffsOverviewLabel = (onOpenBuffs?: () => void) => (
  <Stack spacing={0.5} data-text="Buffs" title="Buffs">
    <Typography variant="body2" sx={{ fontWeight: 700 }}>
      Buffs
    </Typography>
    {onOpenBuffs ? (
      <Button size="small" variant="outlined" onClick={onOpenBuffs} sx={{ alignSelf: "flex-start" }}>
        Open full Buffs tab
      </Button>
    ) : null}
  </Stack>
);

const formatPercentage = (x: number) => (isNaN(x) ? "" : `${(100 * x).toFixed(2)}%`);
const formatMultiplier = (x: number) => (isNaN(x) ? "" : `${x.toFixed(3)}`);
const formatNumber = (x: number) => (isNaN(x) ? "" : shortNumber(x));

const sumDamage = (samples: { hhp: number; shp: number }[]) =>
  samples.reduce((sum, sample) => sum + sample.hhp + sample.shp, 0);

const safeAverage = (values: number[]) => {
  const filtered = values.filter(Number.isFinite);
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : NaN;
};

const formatOneDecimalPercent = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "n/a");

const getSideShips = (allShips: CombatLogShip[], side: "initiator" | "target") =>
  allShips.filter((ship) => ship.side === side);

const sideLabel = (ships: CombatLogShip[]) => ships.map((ship) => ship.displayName).join(", ") || "Unknown";

const topBy = <T,>(items: T[], value: (item: T) => number) =>
  items.reduce<T | undefined>((best, item) => {
    if (!best) return item;
    return value(item) > value(best) ? item : best;
  }, undefined);

const officerTriggerSummary = (parsedData: CombatLogParsedData, data: GameData) => {
  const counts = new Map<number, number>();
  parsedData.battleLog.forEach((round) => {
    round.subRounds.forEach((subRound) => {
      subRound.events.forEach((event) => {
        if (event.type === "ability") {
          counts.set(event.officer, (counts.get(event.officer) ?? 0) + 1);
        }
        if (event.type === "attack") {
          event.triggers.forEach((trigger) => {
            counts.set(trigger.officer, (counts.get(trigger.officer) ?? 0) + 1);
          });
        }
      });
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([officerId, count]) => ({
      officerId,
      count,
      name: lookupOfficer(officerId, data)?.officerName ?? `Officer ${officerId}`,
    }));
};

const BattleQuickRead = ({
  parsedData,
  input,
  data,
  onOpenBuffs,
}: OverviewProps) => {
  const allShips = parsedData.allShips;
  const initiatorShips = getSideShips(allShips, "initiator");
  const targetShips = getSideShips(allShips, "target");
  const winner = input.initiator_wins ? sideLabel(initiatorShips) : sideLabel(targetShips);
  const loser = input.initiator_wins ? sideLabel(targetShips) : sideLabel(initiatorShips);
  const totalAttacks = allShips.reduce((sum, ship) => sum + parsedData.stats.ships[ship.shipId].damageOut.length, 0);
  const totalCrits = allShips.reduce(
    (sum, ship) => sum + parsedData.stats.ships[ship.shipId].damageOut.filter((sample) => sample.crit).length,
    0,
  );
  const initiatorDamageOut = initiatorShips.reduce(
    (sum, ship) => sum + sumDamage(parsedData.stats.ships[ship.shipId].damageOut),
    0,
  );
  const initiatorDamageIn = initiatorShips.reduce(
    (sum, ship) => sum + sumDamage(parsedData.stats.ships[ship.shipId].damageIn),
    0,
  );
  const initiatorRepairs = initiatorShips.reduce(
    (sum, ship) => sum + parsedData.stats.ships[ship.shipId].hullRepairs.reduce((repairSum, repair) => repairSum + repair.hhp, 0),
    0,
  );
  const topDamageShip = topBy(allShips, (ship) => sumDamage(parsedData.stats.ships[ship.shipId].damageOut));
  const topMitigationShip = topBy(allShips, (ship) =>
    safeAverage(parsedData.stats.ships[ship.shipId].damageIn.map((sample) => sample.all_mitigation)),
  );
  const topTriggers = officerTriggerSummary(parsedData, data);
  const battleTime = input.battle_time ? new Date(input.battle_time).toLocaleString() : "";

  const cards = [
    { label: "Result", value: `${winner} won`, note: loser ? `against ${loser}` : "" },
    { label: "Rounds", value: String(parsedData.battleLog.length), note: `${totalAttacks} attacks parsed` },
    { label: "Crit rate", value: formatOneDecimalPercent(totalAttacks ? totalCrits / totalAttacks : NaN), note: "all attacks" },
    { label: "Your exchange", value: `${formatNumber(initiatorDamageOut)} / ${formatNumber(initiatorDamageIn)}`, note: "damage dealt / taken" },
    { label: "Hull repair", value: formatNumber(initiatorRepairs), note: "initiator side" },
  ];

  return (
    <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography variant="h6">Battle Readout</Typography>
            <Typography variant="body2" color="text.secondary">
              Parser-style facts first, then the deeper tables below. {battleTime ? `Captured ${battleTime}.` : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {onOpenBuffs ? (
              <Button size="small" variant="outlined" onClick={onOpenBuffs}>
                Full Buffs
              </Button>
            ) : null}
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, minmax(0, 1fr))" },
            gap: 1,
          }}
        >
          {cards.map((card) => (
            <Paper key={card.label} variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {card.label}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {card.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {card.note}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Divider />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle2">What stood out</Typography>
            <Typography variant="body2" color="text.secondary">
              Top damage: {topDamageShip ? `${topDamageShip.displayName} (${formatNumber(sumDamage(parsedData.stats.ships[topDamageShip.shipId].damageOut))})` : "n/a"}.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Best incoming mitigation: {topMitigationShip ? `${topMitigationShip.displayName} (${formatOneDecimalPercent(safeAverage(parsedData.stats.ships[topMitigationShip.shipId].damageIn.map((sample) => sample.all_mitigation)))})` : "n/a"}.
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">Officer firing</Typography>
            {topTriggers.length ? (
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                {topTriggers.map((trigger) => (
                  <Chip key={trigger.officerId} size="small" label={`${trigger.name}: ${trigger.count}`} />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No officer triggers were parsed.
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2">Best next use</Typography>
            <Typography variant="body2" color="text.secondary">
              Use this battle as a fact sheet. Select several similar battles from Completed Battles to compare crews or test one officer change at a time.
            </Typography>
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
};

export const Overview = ({ parsedData, input, data, onOpenBuffs }: OverviewProps) => {
  const allShips = parsedData.allShips;

  return (
    <Stack spacing={2}>
      <BattleQuickRead parsedData={parsedData} input={input} data={data} onOpenBuffs={onOpenBuffs} />

      <CombatLogTable
        
        columns={[
          { label: "", align: "left" },
          ...allShips.map((ship) => ({ label: ship.displayName, align: "left" }) as ColumnDefinition),
        ]}
        data={[
        {
          cells: [
            "Ship name",
            ...allShips.map((ship) => {
              const hullId = ship.fleetInfo.hull_ids?.[0] ?? ship.fleetData.hull_ids?.[ship.infoIndex];
              return (
                <CombatAssetLabel
                  key={`${ship.shipId}:${hullId}:overview`}
                  data={data}
                  kind="ship"
                  id={hullId}
                  label={getShipName(ship, input, data)}
                  secondary={ship.displayName}
                />
              );
            }),
          ],
        },
        {
          cells: [
            "Ship class",
            ...allShips.map((ship) => (ship.details ? getHullType(ship.details.hull_type) : "")),
          ],
        },
        { cells: ["Bridge setup", ...allShips.map((ship) => bridgeSetup(ship, data))] },
        { cells: ["Below deck setup", ...allShips.map((ship) => belowDeckSetup(ship, data))] },
        { cells: [buffsOverviewLabel(onOpenBuffs), ...allShips.map((ship) => buffs(ship))] },
        { cells: ["Officer buffs", ...allShips.map((ship) => activeBuffChips(ship, data, "officer"))] },
        { cells: ["Research / tech / building buffs", ...allShips.map((ship) => activeBuffChips(ship, data, "other"))] },
        { cells: ["", ...allShips.map((ship) => "")] },
        { cells: ["OFFENSE", ...allShips.map((ship) => "")] },
        {
          cells: [
            "Shots fired",
            ...allShips.map((ship) => formatNumber(shotsOut(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Crits fired",
            ...allShips.map((ship) => formatNumber(shotsOut(ship, parsedData, true))),
          ],
        },
        {
          cells: [
            "Hull damage done",
            ...allShips.map((ship) => formatNumber(hullDamageOut(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Std damage multiplier (non-crit)",
            ...allShips.map((ship) =>
              formatMultiplier(stdDamageMultiplierTotal(ship, parsedData, 0.5, false)),
            ),
          ],
        },
        {
          cells: [
            "Std damage multiplier (crit)",
            ...allShips.map((ship) =>
              formatMultiplier(stdDamageMultiplierTotal(ship, parsedData, 0.5, true)),
            ),
          ],
        },
        {
          cells: [
            "Crit damage multiplier",
            ...allShips.map((ship) => formatMultiplier(critDamage(ship, parsedData))),
          ],
        },
        
        {
          cells: [
            "Iso damage multiplier",
            ...allShips.map((ship) => formatMultiplier(isoDamageMultiplierTotal(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Total damage multiplier",
            ...allShips.map((ship) => formatMultiplier(allDamageMultiplier(ship, parsedData))),
          ],
        },
        { cells: ["", ...allShips.map((ship) => "")] },
        { cells: ["DEFENSE", ...allShips.map((ship) => "")] },
        {
          cells: [
            "Shots taken",
            ...allShips.map((ship) => formatNumber(shotsIn(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Crits taken",
            ...allShips.map((ship) => formatNumber(shotsIn(ship, parsedData, true))),
          ],
        },
        {
          cells: [
            "Hull damage taken",
            ...allShips.map((ship) => formatNumber(hullDamageIn(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Round SHP depleted",
            ...allShips.map((ship) => formatNumber(shpDepleted(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Round HHP depleted",
            ...allShips.map((ship) => formatNumber(hhpDepleted(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Std mitigation",
            ...allShips.map((ship) => formatPercentage(stdMitigationTotal(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Iso mitigation",
            ...allShips.map((ship) => formatPercentage(isoMitigationTotal(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Apex mitigation",
            ...allShips.map((ship) => formatPercentage(apexMitigationTotal(ship, parsedData))),
          ],
        },
        {
          cells: [
            "Shield mitigation",
            ...allShips.map((ship) => formatPercentage(shieldMitigationTotal(ship, parsedData))),
          ],
        },
        ]}
      /*data2={allShips.map((ship) => ({
        cells: [
          ship.displayName,
          getShipName(ship, input, data),
          setup(ship),
          buffs(ship),
          `${roundTo2Digits(
            100 *
              getStats(
                parsedData.stats.ships[ship.shipId].damageIn,
                (x) => true,
                (x) => x.mitigation,
              ).max,
          )}%`,
          `${shortNumber(
            getStats(
              parsedData.stats.ships[ship.shipId].damageOut,
              (x) => true,
              (x) => x.hhp,
            ).sum,
          )}`,
          `${shortNumber(
            getStats(
              parsedData.stats.ships[ship.shipId].damageIn,
              (x) => true,
              (x) => x.hhp,
            ).sum,
          )}`,
          `${infinityToEmpty(
            getStats(
              parsedData.stats.ships[ship.shipId].shpDepleted,
              (x) => true,
              (x) => x.t.round,
            ).min,
          )}`,
          `${infinityToEmpty(
            getStats(
              parsedData.stats.ships[ship.shipId].hhpDepleted,
              (x) => true,
              (x) => x.t.round,
            ).min,
          )}`,
        ],
      }))}*/
      ></CombatLogTable>
    </Stack>
  );
};
