import * as React from "react";
import { extractTags, RawCombatLog } from "../util/combatLog";

export interface BattleLogRawProps {
    input: RawCombatLog;
}

export const BattleLogRaw = ({ input }: BattleLogRawProps) => {
    // Extract the tags from the battle_log array and map them with indices
    // for quick pattern reference during debugging.
    const data: string = extractTags(input.battle_log)
        .map((v, i) => `${i}: ${v}`)
        .join("\n");

    return (
        <div style={{ padding: '16px', backgroundColor: '#1e1e1e', color: '#d4d4d4', borderRadius: '4px' }}>
            <code style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.85rem' }}>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                    {data}
                </pre>
            </code>
        </div>
    );
};