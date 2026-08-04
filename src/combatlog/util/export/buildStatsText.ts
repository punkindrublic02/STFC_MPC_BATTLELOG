function text(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
    return String(value);
}

function pct(value: unknown): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    return `${value.toFixed(2)}%`;
}

function num(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumEvents(parsedData: any, predicate: (event: any) => boolean, valueGetter: (event: any) => number): number {
    let total = 0;
    const battleLog = parsedData?.battleLog ?? [];

    for (const round of battleLog) {
        for (const subRound of round?.subRounds ?? []) {
            for (const event of subRound?.events ?? []) {
                if (predicate(event)) total += valueGetter(event);
            }
        }
    }

    return total;
}

function countEvents(parsedData: any, predicate: (event: any) => boolean): number {
    let total = 0;
    const battleLog = parsedData?.battleLog ?? [];

    for (const round of battleLog) {
        for (const subRound of round?.subRounds ?? []) {
            for (const event of subRound?.events ?? []) {
                if (predicate(event)) total += 1;
            }
        }
    }

    return total;
}

export function buildStatsText(parsedData: any, _gameData?: any): string {
    const battleLog = parsedData?.battleLog ?? [];
    const ships = parsedData?.allShips ?? [];

    const attackEvents = countEvents(parsedData, (event) => event?.type === "attack");
    const critEvents = countEvents(parsedData, (event) => event?.type === "attack" && Boolean(event?.crit ?? event?.isCrit));

    const stdMitigated = sumEvents(
        parsedData,
        (event) => event?.type === "attack",
        (event) => num(event?.stdDamageMitigated ?? event?.damageStdMitigated ?? event?.damage_std_mitigated)
    );

    const isoMitigated = sumEvents(
        parsedData,
        (event) => event?.type === "attack",
        (event) => num(event?.isoDamageMitigated ?? event?.damageIsoMitigated ?? event?.damage_iso_mitigated)
    );

    const apexMitigated = sumEvents(
        parsedData,
        (event) => event?.type === "attack",
        (event) => num(event?.apexDamageMitigated ?? event?.damageApexMitigated ?? event?.damage_apex_mitigated)
    );

    const damageToShp = sumEvents(
        parsedData,
        (event) => event?.type === "attack",
        (event) => num(event?.damageToShp ?? event?.damageSHP ?? event?.damage_shp)
    );

    const damageToHhp = sumEvents(
        parsedData,
        (event) => event?.type === "attack",
        (event) => num(event?.damageToHhp ?? event?.damageHHP ?? event?.damage_hhp)
    );

    const totalKnownDamage = damageToShp + damageToHhp + stdMitigated + isoMitigated + apexMitigated;

    const lines: string[] = [];

    lines.push("Metric\tValue");
    lines.push(`Ships involved\t${text(ships.length)}`);
    lines.push(`Rounds\t${text(battleLog.length)}`);
    lines.push(`Attack events\t${text(attackEvents)}`);
    lines.push(`Crit events\t${text(critEvents)}`);
    lines.push(`Crit rate\t${attackEvents ? pct((critEvents / attackEvents) * 100) : ""}`);
    lines.push(`Std damage mitigated\t${text(stdMitigated)}`);
    lines.push(`Iso damage mitigated\t${text(isoMitigated)}`);
    lines.push(`Apex damage mitigated\t${text(apexMitigated)}`);
    lines.push(`Damage to SHP\t${text(damageToShp)}`);
    lines.push(`Damage to HHP\t${text(damageToHhp)}`);
    lines.push(`Total known damage/mitigation\t${text(totalKnownDamage)}`);
    lines.push(`Apex share of known total\t${totalKnownDamage ? pct((apexMitigated / totalKnownDamage) * 100) : ""}`);

    return lines.join("\n");
}