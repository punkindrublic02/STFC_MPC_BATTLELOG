import {
    CombatLogParsedData,
    CombatLogShip,
    GameData,
    RawCombatLog,
    getShipName,
} from "../combatLog";
import {
    Stats,
    average,
    apexMitigationStats,
    getStats,
    isoDamageMultiplierStats,
    isoMitigationStats,
    stdDamageMultiplierStats,
    stdMitigationStats,
} from "../combatLogStats";

function pct(value: number): string {
    return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "";
}

function num(value: number): string {
    return Number.isFinite(value) ? value.toFixed(4) : "";
}

function rehp(value: number): string {
    if (!Number.isFinite(value)) return "";
    return value >= 1 ? `+${((value - 1) * 100).toFixed(2)}%` : `-${((1 - value) * 100).toFixed(2)}%`;
}

function avg(stats: Stats): number {
    return average(stats);
}

function createContext(ship: CombatLogShip, parsedData: CombatLogParsedData) {
    const shipStats = parsedData.stats.ships[ship.shipId];

    const rawEnergy = getStats(
        shipStats.damageOut,
        (x) => x.std_damage_type === "ENERGY",
        (x) => x.std_damage,
    );
    const rawKinetic = getStats(
        shipStats.damageOut,
        (x) => x.std_damage_type === "KINETIC",
        (x) => x.std_damage,
    );
    const actualEnergy = getStats(
        shipStats.damageOut,
        (x) => x.std_damage_type === "ENERGY" && x.std_damage > 0,
        (x) => (x.std_damage - x.std_mitigated) * (1 - x.apex_mitigation),
    );
    const actualKinetic = getStats(
        shipStats.damageOut,
        (x) => x.std_damage_type === "KINETIC" && x.std_damage > 0,
        (x) => (x.std_damage - x.std_mitigated) * (1 - x.apex_mitigation),
    );
    const actualIso = getStats(
        shipStats.damageOut,
        (x) => x.iso_damage > 0,
        (x) => (x.iso_damage - x.iso_mitigated) * (1 - x.apex_mitigation),
    );
    const damageInRaw = getStats(
        shipStats.damageIn,
        (x) => x.std_damage + x.iso_damage > 0,
        (x) => x.std_damage + x.iso_damage,
    );
    const damageInShp = getStats(
        shipStats.damageIn,
        (x) => x.shp > 0,
        (x) => x.shp,
    );
    const damageInHhp = getStats(
        shipStats.damageIn,
        (x) => x.hhp > 0,
        (x) => x.hhp,
    );
    const hullRepairPercent = getStats(
        shipStats.hullRepairs,
        () => true,
        (x) => x.fraction,
    );

    return {
        ship,
        stats: shipStats,
        rawEnergy,
        rawKinetic,
        actualEnergy,
        actualKinetic,
        actualIso,
        damageInRaw,
        damageInShp,
        damageInHhp,
        damageMultiplierStd: stdDamageMultiplierStats(ship, parsedData, 0.5, false),
        damageMultiplierIso: isoDamageMultiplierStats(ship, parsedData),
        mitigationApex: apexMitigationStats(ship, parsedData),
        mitigationIso: isoMitigationStats(ship, parsedData),
        mitigationStd: stdMitigationStats(ship, parsedData),
        hullRepairPercent,
    };
}

function quickStats(context: ReturnType<typeof createContext>) {
    return [
        ["Damage multiplier", num(avg(context.damageMultiplierStd))],
        ["Iso multiplier", num(avg(context.damageMultiplierIso))],
        ["Apex mitigation", pct(avg(context.mitigationApex))],
        ["Iso mitigation", pct(avg(context.mitigationIso))],
        ["Std mitigation", pct(avg(context.mitigationStd))],
        ["Hull repair", pct(avg(context.hullRepairPercent))],
        ["Shield uptime", pct(context.damageInShp.count / context.damageInRaw.count)],
    ].map(([stat, value]) => ({ stat, value }));
}

function defensiveSuggestions(player: ReturnType<typeof createContext>, target: ReturnType<typeof createContext>) {
    const actualEnergy = target.actualEnergy.sum;
    const actualKinetic = target.actualKinetic.sum;
    const actualIso = target.actualIso.sum;
    const actualTotal = actualEnergy + actualKinetic + actualIso;
    const damageBonus = avg(target.damageMultiplierStd);
    const playerIsoMitigation = avg(player.mitigationIso);
    const isoDefense = 1 / (1 - playerIsoMitigation) - 1;
    const playerStdMitigation = avg(player.mitigationStd);
    const playerApexMitigation = avg(player.mitigationApex);
    const rawStd = target.rawEnergy.sum + target.rawKinetic.sum;
    const shieldDamage = player.damageInShp.sum + player.damageInHhp.sum;
    const currentShieldMitigation = shieldDamage ? player.damageInShp.sum / shieldDamage : NaN;

    const energyRehp = () => {
        const newEnergy = (actualEnergy * Math.max(0, damageBonus - 0.66)) / damageBonus;
        return actualTotal / (newEnergy + actualKinetic + actualIso);
    };
    const kineticRehp = () => {
        const newKinetic = (actualKinetic * Math.max(0, damageBonus - 0.55)) / damageBonus;
        return actualTotal / (actualEnergy + newKinetic + actualIso);
    };
    const isoRehp = () => {
        const newIso = (actualIso / (1 - playerIsoMitigation)) * (1 / (1 + 100 + isoDefense));
        return actualTotal / (actualEnergy + actualKinetic + newIso);
    };
    const stdRehp = () => {
        const newStd = rawStd * (1 - 0.712) * (1 - playerApexMitigation);
        return actualTotal / (newStd + actualIso);
    };

    return [
        {
            effect: "Energy damage reduction",
            example_officers: "Chen",
            value: rehp(energyRehp()),
            basis: `Target damage bonus ${pct(damageBonus)}`,
        },
        {
            effect: "Kinetic damage reduction",
            example_officers: "Cath",
            value: rehp(kineticRehp()),
            basis: `Target damage bonus ${pct(damageBonus)}`,
        },
        {
            effect: "Isolitic defense",
            example_officers: "Joachim",
            value: rehp(isoRehp()),
            basis: `Current isolitic mitigation ${pct(playerIsoMitigation)}`,
        },
        {
            effect: "Standard mitigation",
            example_officers: "Paris, Moreau",
            value: rehp(stdRehp()),
            basis: `Current standard mitigation ${pct(playerStdMitigation)}`,
        },
        {
            effect: "Shield mitigation",
            example_officers: "SNW Pike, Janeway, WoK Carol",
            value: Number.isFinite(currentShieldMitigation) ? pct(currentShieldMitigation) : "N/A",
            basis: "Current shield uptime from incoming damage",
        },
    ];
}

function offensiveSuggestions(player: ReturnType<typeof createContext>) {
    const damageBonus = avg(player.damageMultiplierStd);
    const rdpr = (damageBonus + 1000) / damageBonus;

    return [
        {
            effect: "Damage bonus",
            example_officers: "",
            value: num(rdpr),
            basis: `Current damage bonus ${pct(damageBonus)}`,
        },
    ];
}

export function buildSuggestionsAnalysis(
    parsedData: CombatLogParsedData,
    input: RawCombatLog,
    gameData: GameData,
) {
    const playerShip = parsedData.allShips[0];
    const targetShip = parsedData.allShips[1];

    if (!playerShip || !targetShip) {
        return {
            player_ship: null,
            target_ship: null,
            quick_stats: [],
            defensive: [],
            offensive: [],
        };
    }

    const player = createContext(playerShip, parsedData);
    const target = createContext(targetShip, parsedData);

    return {
        player_ship: `${playerShip.displayName} [${getShipName(playerShip, input, gameData)}]`,
        target_ship: `${targetShip.displayName} [${getShipName(targetShip, input, gameData)}]`,
        quick_stats: [
            {
                ship: playerShip.displayName,
                role: "player",
                stats: quickStats(player),
            },
            {
                ship: targetShip.displayName,
                role: "target",
                stats: quickStats(target),
            },
        ],
        defensive: defensiveSuggestions(player, target),
        offensive: offensiveSuggestions(player),
    };
}

export function buildSuggestionsText(
    parsedData: CombatLogParsedData,
    input: RawCombatLog,
    gameData: GameData,
): string {
    const analysis = buildSuggestionsAnalysis(parsedData, input, gameData);
    const lines: string[] = [];

    lines.push(`Player ship\t${analysis.player_ship ?? ""}`);
    lines.push(`Target ship\t${analysis.target_ship ?? ""}`);
    lines.push("");
    lines.push("Quick Stats");
    lines.push(["Role", "Ship", "Stat", "Value"].join("\t"));
    for (const shipStats of analysis.quick_stats) {
        for (const stat of shipStats.stats) {
            lines.push([shipStats.role, shipStats.ship, stat.stat, stat.value].join("\t"));
        }
    }

    lines.push("");
    lines.push("Defensive Crew Suggestions");
    lines.push(["Effect", "Example Officers", "Value", "Basis"].join("\t"));
    for (const row of analysis.defensive) {
        lines.push([row.effect, row.example_officers, row.value, row.basis].join("\t"));
    }

    lines.push("");
    lines.push("Offensive Crew Suggestions");
    lines.push(["Effect", "Example Officers", "Value", "Basis"].join("\t"));
    for (const row of analysis.offensive) {
        lines.push([row.effect, row.example_officers, row.value, row.basis].join("\t"));
    }

    return lines.join("\n");
}
