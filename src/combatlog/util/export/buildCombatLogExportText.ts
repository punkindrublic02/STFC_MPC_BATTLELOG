import { buildBattleLogText } from "../buildBattleLogText";
import { RawCombatLog } from "../combatLog";
import { buildBuffsText } from "./buildBuffsText";
import { buildOfficersText } from "./buildOfficersText";
import { buildOverviewText } from "./buildOverviewText";
import { buildShipsText } from "./buildShipsText";
import { buildStatsText } from "./buildStatsText";
import { buildSuggestionsText } from "./buildSuggestionsText";
export function buildCombatLogExportText(parsedData: any, gameData: any, input?: RawCombatLog): string {
    return [
        "=== OVERVIEW ===",
        buildOverviewText(parsedData, gameData),

        "",
        "=== SHIPS ===",
        buildShipsText(parsedData, gameData),

        "",
        "=== OFFICERS ===",
        buildOfficersText(parsedData, gameData),

        "",
        "=== BUFFS ===",
        input ? buildBuffsText(parsedData, input, gameData) : "",

        "",
        "=== BATTLE LOG ===",
        buildBattleLogText(parsedData, gameData),

        "",
        "=== STATS ===",
        buildStatsText(parsedData, gameData),

        "",
        "=== CREW SUGGESTIONS ===",
        input ? buildSuggestionsText(parsedData, input, gameData) : "",

    ].join("\n");
}
