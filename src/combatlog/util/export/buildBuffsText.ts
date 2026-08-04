import { CombatLogParsedData, GameData, RawCombatLog, getShipName, lookupBuff } from "../combatLog";

function text(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
    return String(value);
}

function sortKey(buff: any): string {
    switch (buff.data?.type) {
        case "officer":
            return `0.${buff.activatorDisplayName}.${buff.data.subtype}`;
        case "building":
            return `1.${buff.activatorDisplayName}.${buff.buffDisplayName}`;
        case "research":
            return `2.${buff.activatorDisplayName}.${buff.data.details.column}.${buff.data.details.row}`;
        case "forbidden_tech":
            return `3.${buff.activator_id}.${buff.buff_id}`;
        case "consumable":
            return `4.${buff.activator_id}.${buff.buff_id}`;
        case "other":
            return `8.${buff.activator_id}.${buff.buff_id}`;
        default:
            return `9.${buff.activator_id}.${buff.buff_id}`;
    }
}

function buffRankLabel(shipBuff: any, buff: any): string {
    if (!shipBuff) return "";

    const ranks = Array.isArray(shipBuff.ranks) ? shipBuff.ranks : [];
    const maxRank = ranks.reduce((acc: number, r: number) => Math.max(acc, r + 1), 0);

    if (buff.data?.type === "research") {
        return `${maxRank}/${buff.data.details.levels.length}`;
    }

    if (buff.data?.type === "forbidden_tech") {
        const tiers = buff.data.details.tiers ?? [];
        const maxLevel = tiers[tiers.length - 1]?.max_level;
        return maxLevel ? `${maxRank}/${maxLevel}` : `${maxRank}`;
    }

    return `${maxRank}`;
}

export function buildBuffRows(parsedData: CombatLogParsedData, input: RawCombatLog, gameData: GameData) {
    const ships = parsedData.allShips ?? [];
    const allBuffs = ships
        .flatMap((s) =>
            (s.fleetInfo?.active_buffs ?? []).map((b: any) => ({
                buff_id: b.buff_id,
                activator_id: b.activator_id,
            })),
        )
        .filter(
            (v, i, a) =>
                a.find((v2) => v.buff_id === v2.buff_id && v.activator_id === v2.activator_id) === v,
        )
        .map(({ buff_id, activator_id }) => lookupBuff(buff_id, activator_id, gameData))
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

    return allBuffs.map((buff: any) => {
        const shipsWithRanks: Record<string, string> = {};

        for (const ship of ships) {
            const shipName = getShipName(ship, input, gameData);
            const shipBuff = ship.fleetInfo?.active_buffs?.find(
                (ab: any) => ab.buff_id === buff.buff_id && ab.activator_id === buff.activator_id,
            );
            shipsWithRanks[ship.displayName || shipName] = buffRankLabel(shipBuff, buff);
        }

        return {
            category: buff.data?.type?.toUpperCase() ?? "",
            activator: buff.activatorDisplayName ?? "",
            buff: buff.buffDisplayName ?? "",
            buff_id: buff.buff_id,
            activator_id: buff.activator_id,
            ships: shipsWithRanks,
        };
    });
}

export function buildBuffsText(
    parsedData: CombatLogParsedData,
    input: RawCombatLog,
    gameData: GameData,
): string {
    const ships = parsedData.allShips ?? [];
    const shipHeaders = ships.map((s) => s.displayName || getShipName(s, input, gameData));
    const lines = [["Category", "Activator", "Buff", "Buff ID", "Activator ID", ...shipHeaders].join("\t")];

    for (const row of buildBuffRows(parsedData, input, gameData)) {
        lines.push([
            row.category,
            row.activator,
            row.buff,
            text(row.buff_id),
            text(row.activator_id),
            ...shipHeaders.map((ship) => row.ships[ship] ?? ""),
        ].join("\t"));
    }

    return lines.join("\n");
}
