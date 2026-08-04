import { CombatLogParsedData } from "./combatLog";
import { GameData } from "./gameData";

type AnyParsedData = any;
type AnyGameData = any;


function text(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
    return String(value);
}

function getShipName(parsedData: CombatLogParsedData, shipId: unknown): string {
    if (shipId === null || shipId === undefined) return "";
    const ship = (parsedData as any).shipById?.[shipId as any];
    return ship?.displayName ?? `??? [${String(shipId)}]`;
}

function getEventValue(event: any): string {
    return text(
        event?.value ??
        event?.damage ??
        event?.damageTaken ??
        event?.damage_taken ??
        event?.stdDamage ??
        event?.isoDamage ??
        ""
    );
}

export function buildBattleLogText(
    parsedData: CombatLogParsedData,
    _gameData?: GameData
): string {
    const columns = [
        "Round",
        "Subround",
        "Event",
        "Subject",
        "Verb",
        "Object",
        "Weapon",
        "Damage type",
        "Std Damage",
        "Std Damage mitigated",
        "Iso damage",
        "Iso damage mitigated",
        "Damage apex mitigated",
        "Damage to SHP",
        "Damage to HHP",
        "Crit",
        "Remaining SHP",
        "Remaining HHP",
    ];

    

    const rows: string[][] = [];

    const battleLog = (parsedData as any).battleLog ?? [];
    const normalizedRows = rows.map((row) => {
        const fixed = [...row];
        while (fixed.length < columns.length) fixed.push("");
        return fixed.slice(0, columns.length);
    });

    battleLog.forEach((round: any, roundIndex: number) => {
        const subRounds = round?.subRounds ?? [];

        subRounds.forEach((subRound: any, subRoundIndex: number) => {
            const events = subRound?.events ?? [];

            events.forEach((event: any, eventIndex: number) => {
                const base = [
                    text(roundIndex + 1),
                    text(subRoundIndex + 1),
                    text(eventIndex + 1),
                ];

                if (event?.type === "ability") {
                    rows.push([
                        ...base,
                        getShipName(parsedData, event.ship),
                        "APPLY",
                        text(event.officerName ?? event.officer ?? ""),
                        text(event.abilityName ?? event.ability ?? ""),
                        getEventValue(event),
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
                    ]);
                    return;
                }

                if (event?.type === "forbiddenTech" || event?.type === "forbidden_tech") {
                    rows.push([
                        ...base,
                        getShipName(parsedData, event.ship),
                        "APPLY",
                        text(event.techName ?? event.tech ?? event.forbiddenTech ?? ""),
                        text(event.buffName ?? event.buff ?? event.effect ?? ""),
                        getEventValue(event),
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
                    ]);
                    return;
                }

                if (event?.type === "attack") {
                    rows.push([
                        ...base,
                        getShipName(parsedData, event.sourceShip ?? event.attacker ?? event.ship),
                        "ATTACK",
                        getShipName(parsedData, event.targetShip ?? event.target),
                        text(event.weaponName ?? event.weapon ?? ""),
                        text(event.damageTypeName ?? event.damageType ?? ""),
                        text(event.stdDamage ?? event.standardDamage ?? event.damage_std ?? ""),
                        text(event.stdDamageMitigated ?? event.damageStdMitigated ?? event.damage_std_mitigated ?? ""),
                        text(event.isoDamage ?? event.damageIso ?? event.damage_iso ?? ""),
                        text(event.isoDamageMitigated ?? event.damageIsoMitigated ?? event.damage_iso_mitigated ?? ""),
                        text(event.apexDamageMitigated ?? event.damageApexMitigated ?? event.damage_apex_mitigated ?? ""),
                        text(event.damageToShp ?? event.damageSHP ?? event.damage_shp ?? ""),
                        text(event.damageToHhp ?? event.damageHHP ?? event.damage_hhp ?? ""),
                        text(event.crit ?? event.isCrit ?? ""),
                        text(event.remainingShp ?? event.remainingSHP ?? event.remaining_shp ?? ""),
                        text(event.remainingHhp ?? event.remainingHHP ?? event.remaining_hhp ?? ""),
                    ]);
                    return;
                }

                rows.push([
                    ...base,
                    getShipName(parsedData, event?.ship ?? event?.sourceShip ?? event?.attacker ?? ""),
                    text(event?.type ?? "UNKNOWN"),
                    text(event?.target ?? event?.object ?? ""),
                    text(event?.weaponName ?? event?.weapon ?? ""),
                    text(event?.damageTypeName ?? event?.damageType ?? ""),
                    getEventValue(event),
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
                ]);
            });
        });
    });

    return [columns.join("\t"), ...rows.map((row) => row.join("\t"))].join("\n");
}