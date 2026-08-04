import { buildBattleLogText } from "../buildBattleLogText";
import { CombatLogParsedData, GameData, RawCombatLog } from "../combatLog";
import { buildBuffRows, buildBuffsText } from "./buildBuffsText";
import { buildCombatLogExportText } from "./buildCombatLogExportText";
import { buildOfficersRows, buildOfficersText } from "./buildOfficersText";
import { buildOverviewText } from "./buildOverviewText";
import { buildShipsText } from "./buildShipsText";
import { buildStatsText } from "./buildStatsText";
import { buildSuggestionsAnalysis, buildSuggestionsText } from "./buildSuggestionsText";

export function buildCombatLogAnalysisPayload(
    input: RawCombatLog,
    parsedData: CombatLogParsedData,
    gameData: GameData,
) {
    const sections = {
        overview: buildOverviewText(parsedData, gameData),
        ships: buildShipsText(parsedData, gameData),
        officers: buildOfficersText(parsedData, gameData),
        buffs: buildBuffsText(parsedData, input, gameData),
        battle_log: buildBattleLogText(parsedData, gameData),
        stats: buildStatsText(parsedData, gameData),
        crew_suggestions: buildSuggestionsText(parsedData, input, gameData),
    };

    return {
        summary: sections.battle_log,
        export_text: buildCombatLogExportText(parsedData, gameData, input),
        sections,
        analysis_json: {
            officers: buildOfficersRows(parsedData, gameData),
            buffs: buildBuffRows(parsedData, input, gameData),
            crew_suggestions: buildSuggestionsAnalysis(parsedData, input, gameData),
        },
    };
}
