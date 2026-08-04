import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    AlertTitle,
    AppBar,
    Box,
    Button,
    Checkbox,
    Chip,
    CssBaseline,
    Divider,
    Drawer,
    IconButton,
    LinearProgress,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Stack,
    TextField,
    Toolbar,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import LinkIcon from "@mui/icons-material/Link";
import MenuIcon from "@mui/icons-material/Menu";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";

import { Frame } from "../../components/Frame";
import { DropZone } from "../../components/DropZone";

import {
    CombatLogParsedData,
    GameData,
    JournalsGetMessage,
    parseAllData,
    RawCombatLog,
} from "../util/combatLog";

import { Overview } from "./Overview";
import { BattleLog } from "./BattleLog";
import { BattleLogRaw } from "./BattleLogRaw";
import { Ships } from "./Ships";
import { Buffs } from "./Buffs";
import { Officers } from "./Officers";
import { Loot } from "./Loot";
import { DamageGraph } from "./DamageGraph";
import { Charts } from "./Charts";
import { Stats } from "./Stats";
import { Suggestions } from "./Suggestions";
import { CombatAssetLabel } from "./CombatAssetLabel";
import { buildCombatLogAnalysisPayload } from "../util/export/buildCombatLogAnalysisPayload";
const drawerWidth = 260;

declare const process: {
    env: {
        STFC_LOCAL_SYNC_URL_DEV?: string;
        STFC_LOCAL_SYNC_URL_PROD?: string;
    };
};

export const LOCAL_SYNC_BASE_URL =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? process.env.STFC_LOCAL_SYNC_URL_DEV || "http://127.0.0.1:8787"
        : process.env.STFC_LOCAL_SYNC_URL_PROD || "/api";

type LogData =
    | { status: "empty" }
    | { status: "error"; details: string }
    | { status: "success"; data: JournalsGetMessage };

type CsvBattlePreview = {
    file_name: string;
    player_name: string;
    target_name: string;
    ship_name: string;
    ship_level: number | null;
    outcome: string;
    captain: string | null;
    bridge_officers: string | null;
    below_deck_officers: string | null;
    rounds: number;
    attacks: number;
    damage_dealt: number;
    damage_taken: number;
    crit_rate: number | null;
    officer_triggers: number;
    score: number;
};

type View =
    | "overview"
    | "battlelog"
    | "battlelograw"
    | "ships"
    | "buffs"
    | "officers"
    | "loot"
    | "damage_graph"
    | "charts"
    | "stats"
    | "suggestions";

interface ActiveViewProps {
    activeView: View;
    input: RawCombatLog;
    data: GameData;
    parsedData: CombatLogParsedData;
    onOpenBuffs?: () => void;
}

function ActiveViewComponent({
    activeView,
    input,
    data,
    parsedData,
    onOpenBuffs,
}: ActiveViewProps) {
    switch (activeView) {
        case "overview":
            return <Overview input={input} data={data} parsedData={parsedData} onOpenBuffs={onOpenBuffs} />;
        case "battlelog":
            return <BattleLog input={input} data={data} parsedData={parsedData} raw_json={false} />;
        case "battlelograw":
            return <BattleLogRaw input={input} />;
        case "ships":
            return <Ships input={input} data={data} parsedData={parsedData} raw_json={false} />;
        case "buffs":
            return <Buffs input={input} data={data} parsedData={parsedData} />;
        case "officers":
            return <Officers input={input} data={data} parsedData={parsedData} raw_json={false} />;
        case "loot":
            return <Loot input={input} data={data} parsedData={parsedData} raw_json={false} />;
        case "damage_graph":
            return <DamageGraph input={input} data={data} parsedData={parsedData} raw_json={false} />;
        case "charts":
            return <Charts input={input} data={data} parsedData={parsedData} />;
        case "stats":
            return <Stats input={input} data={data} parsedData={parsedData} raw_json={false} />;
        case "suggestions":
            return <Suggestions input={input} data={data} parsedData={parsedData} raw_json={false} />;
        default:
            return <Overview input={input} data={data} parsedData={parsedData} />;
    }
}

function normalizeBattlePayload(input: unknown): JournalsGetMessage {
    let data: any = input;
    let wrapperNames: any = undefined;

    if (typeof data === "string") {
        data = JSON.parse(data);
    }

    if (Array.isArray(data)) {
        data = data[0];
    }

    if (data?.journal) {
        wrapperNames = data.names;
        data = data.journal;
    }

    if (!data || !data.battle_log) {
        throw new Error("This file does not appear to be a raw combat log");
    }

    return {
        ...data,
        names: data.names ?? wrapperNames,
        journal: data,
    } as JournalsGetMessage;
}

function buildCombatLogSummary(
    input: RawCombatLog,
    parsedData: CombatLogParsedData
): string {
    const lines: string[] = [];

    lines.push(`Battle ID: ${String(input.id ?? input.battle_id ?? "Unknown")}`);
    lines.push(`Ships involved: ${parsedData.allShips.length}`);
    lines.push("");
    lines.push("SHIPS");

    for (const ship of parsedData.allShips) {
        lines.push(`- ${ship.displayName}`);
    }

    return lines.join("\n");
}

function formatAveragePercent(values: number[]) {
    const filtered = values.filter((value) => Number.isFinite(value));
    if (!filtered.length) return "n/a";
    return `${(filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(1)}%`;
}

function buildChatGptBattleContext(
    input: RawCombatLog,
    parsedData: CombatLogParsedData,
    gameData: GameData,
    currentDbId?: number | string
) {
    const analysisPayload = buildCombatLogAnalysisPayload(input, parsedData, gameData);
    const attacks = Object.values(parsedData.stats.ships).flatMap((ship: any) => ship.damageOut ?? []);
    const repairs = Object.values(parsedData.stats.ships).flatMap((ship: any) => ship.hullRepairs ?? []);
    const totalRepair = repairs.reduce((sum: number, repair: any) => sum + (Number(repair.hhp) || 0), 0);
    const repairRounds = new Set(repairs.map((repair: any) => repair.t?.round).filter(Boolean));
    const critRate = attacks.length
        ? attacks.filter((attack: any) => attack.crit).length / attacks.length
        : NaN;
    const mitigation = formatAveragePercent(
        attacks.map((attack: any) => Number(attack.all_mitigation)).filter(Number.isFinite)
    );
    const winner =
        input?.initiator_wins === true
            ? "initiator"
            : input?.initiator_wins === false
                ? "target"
                : "unknown";

    const lines = [
        "STFC battle context for ChatGPT/MCP analysis",
        `Battle database id: ${currentDbId ?? input.id ?? input.battle_id ?? "unknown"}`,
        `Outcome: ${winner}`,
        `Rounds: ${parsedData.battleLog.length}`,
        `Attacks: ${attacks.length}`,
        `Critical hit rate: ${Number.isFinite(critRate) ? `${(critRate * 100).toFixed(1)}%` : "n/a"}`,
        `Average mitigation: ${mitigation}`,
        `Hull repair total: ${formatCompactNumber(totalRepair)} over ${repairRounds.size} repair rounds`,
        "",
        "Ships and officers:",
        ...parsedData.allShips.map((ship) => {
            const officers = ship.officers
                .filter(Boolean)
                .map((officer) => officer?.officerName)
                .filter(Boolean)
                .join(", ");
            return `- ${ship.side}: ${ship.displayName} officers: ${officers || "unknown"}`;
        }),
        "",
        "Buffs:",
        analysisPayload.sections.buffs.slice(0, 1800),
        "",
        "Crew suggestions:",
        analysisPayload.sections.crew_suggestions.slice(0, 1800),
        "",
        "Battle log summary:",
        analysisPayload.sections.battle_log.slice(0, 2400),
    ];

    return lines.join("\n");
}

function getNameFromMap(names: any, id: unknown): string | undefined {
    if (!id) return undefined;

    const entry = names?.[String(id)] ?? names?.[id as any];
    if (!entry) return undefined;

    if (typeof entry === "string") return entry;
    if (entry?.alliance_tag && entry?.name) return `[${entry.alliance_tag}] ${entry.name}`;
    return entry?.name;
}

function getRecentBattleNames(b: any) {
    if (b.display_attacker || b.display_defender) {
        return {
            attacker: b.display_attacker || "Unknown",
            defender: b.display_defender || "Unknown",
        };
    }

    const raw = b.raw_json ?? b.data ?? b.journal ?? b.payload ?? b.parsed_json;
    const parsedRaw = typeof raw === "string" ? JSON.parse(raw) : raw;
    const journal = parsedRaw?.journal ?? parsedRaw ?? {};
    const names = parsedRaw?.names ?? journal?.names ?? {};

    const attackerId =
        journal?.attacker?.id ??
        journal?.initiator_id ??
        Object.values(journal?.initiator_fleet_data?.deployed_fleets ?? {})[0]?.["uid"];

    const defenderId =
        journal?.defender?.id ??
        journal?.target_id ??
        Object.values(journal?.target_fleet_data?.deployed_fleets ?? {})[0]?.["uid"];

    return {
        attacker:
            journal?.attacker?.name ??
            getNameFromMap(names, attackerId) ??
            (attackerId ? String(attackerId) : "Unknown"),
        defender:
            journal?.defender?.name ??
            getNameFromMap(names, defenderId) ??
            (defenderId ? String(defenderId) : "Unknown"),
    };
}

function formatCompactNumber(value: unknown) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    if (Math.abs(num) >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2)}T`;
    if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return Math.round(num).toLocaleString();
}

function isProbablyCsvBattleExport(content: string) {
    const trimmed = content.trimStart();
    if (!trimmed) return false;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
    return trimmed.includes("Player Name") && trimmed.includes("Battle Event");
}

function CsvPreviewPanel({ battle }: { battle: CsvBattlePreview }) {
    const bridge = [battle.captain, battle.bridge_officers].filter(Boolean).join(" | ") || "Unknown";
    const belowDeck = battle.below_deck_officers || "Not listed in CSV header; inferred from ability triggers when possible";

    return (
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                        <Typography variant="h6">CSV Battle Preview</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Parsed locally from {battle.file_name}. This preview is not saved to the database.
                        </Typography>
                    </Box>
                    <Chip
                        color={String(battle.outcome).toUpperCase() === "VICTORY" ? "success" : "warning"}
                        label={battle.outcome || "UNKNOWN"}
                    />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.25 }}>
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                        <Typography variant="overline" color="text.secondary">Player Ship</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {battle.player_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {battle.ship_name}{battle.ship_level ? ` L${battle.ship_level}` : ""}
                        </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                        <Typography variant="overline" color="text.secondary">Target</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {battle.target_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {battle.rounds} rounds · {battle.attacks} attacks
                        </Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                        <Typography variant="overline" color="text.secondary">Preview Score</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {battle.score}/100
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            crit {battle.crit_rate == null ? "n/a" : `${(battle.crit_rate * 100).toFixed(1)}%`}
                        </Typography>
                    </Paper>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 1.25 }}>
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                        <Typography variant="overline" color="text.secondary">Crew</Typography>
                        <Typography variant="body2"><strong>Bridge:</strong> {bridge}</Typography>
                        <Typography variant="body2"><strong>Below deck:</strong> {belowDeck}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                        <Typography variant="overline" color="text.secondary">Observed Output</Typography>
                        <Typography variant="body2"><strong>Damage dealt:</strong> {formatCompactNumber(battle.damage_dealt)}</Typography>
                        <Typography variant="body2"><strong>Damage taken:</strong> {formatCompactNumber(battle.damage_taken)}</Typography>
                        <Typography variant="body2"><strong>Officer triggers:</strong> {battle.officer_triggers}</Typography>
                    </Paper>
                </Box>

                <Alert severity="info">
                    To save this battle for alliance history and AI comparisons, use the token-required CSV import or automatic mod upload.
                </Alert>
            </Stack>
        </Paper>
    );
}

function formatPercent(value: unknown) {
    const num = Number(value);
    return Number.isFinite(num) ? `${(num * 100).toFixed(0)}%` : "n/a";
}

function formatSignedPercent(value: unknown) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "n/a";

    const percent = num * 100;
    const sign = percent > 0 ? "+" : "";
    if (Math.abs(percent) >= 1000) {
        return `${sign}${formatCompactNumber(percent)}%`;
    }

    return `${sign}${percent.toFixed(Math.abs(percent) < 10 ? 1 : 0)}%`;
}




export function CombatLogNew() {
    const navigate = useNavigate();
    const { id: routeBattleId } = useParams();
    const [logData, setLogData] = useState<LogData>({ status: "empty" });
    const [csvPreview, setCsvPreview] = useState<CsvBattlePreview | undefined>();
    const [csvPreviewLoading, setCsvPreviewLoading] = useState(false);
    const [activeView, setActiveView] = useState<View>("overview");
    const [currentDbId, setCurrentDbId] = useState<number | string | undefined>();
    const [accessToken, setAccessToken] = useState(() => localStorage.getItem("stfcBattleAccessToken") ?? "");
    const [playerSearchName, setPlayerSearchName] = useState("");
    const [battleSearchScan, setBattleSearchScan] = useState("500");
    const [battleSearchResults, setBattleSearchResults] = useState<any[] | undefined>();
    const [battleSearchMeta, setBattleSearchMeta] = useState<{ query: string; scanned: number; count: number } | undefined>();
    const [battleSearchLoading, setBattleSearchLoading] = useState(false);
    const [battleSearchError, setBattleSearchError] = useState<string | undefined>();
    const [copyMessage, setCopyMessage] = useState<string | undefined>();
    const [battleQuestion, setBattleQuestion] = useState("What should I learn from this battle?");
    const [selectedCompareIds, setSelectedCompareIds] = useState<Set<string>>(() => new Set());
    const [autoParsedIds, setAutoParsedIds] = useState<Set<string | number>>(
        () => new Set()
    );

    const trimmedAccessToken = accessToken.trim();
    const authHeaders = useCallback(() => {
        return trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {};
    }, [trimmedAccessToken]);

    const updateAccessToken = useCallback((value: string) => {
        setAccessToken(value);
        const trimmed = value.trim();
        if (trimmed) {
            localStorage.setItem("stfcBattleAccessToken", trimmed);
        } else {
            localStorage.removeItem("stfcBattleAccessToken");
        }
    }, []);

    const copyText = useCallback(async (text: string, message: string) => {
        await navigator.clipboard.writeText(text);
        setCopyMessage(message);
        window.setTimeout(() => setCopyMessage(undefined), 2500);
    }, []);
    
    const gameData = useQuery({
        queryKey: ["game-data"],
        queryFn: async () => {
            const res = await fetch("/data/game-data/all.json");
            if (!res.ok) {
                throw new Error("Could not load game definitions");
            }
            return (await res.json()) as GameData;
        },
    });

    const {
        data: recentBattles,
        error: recentBattlesError,
        isLoading: recentBattlesLoading,
        isFetching: recentBattlesFetching,
        refetch: refetchRecentBattles,
    } = useQuery({
        queryKey: ["recent-battles", trimmedAccessToken],
        queryFn: async () => {
            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-summaries/recent?limit=20`, {
                headers: authHeaders(),
            });
            if (!res.ok) {
                throw new Error(res.status === 401 || res.status === 403
                    ? "Enter a valid access token to load battle history"
                    : "Failed to fetch recent battles");
            }
            return await res.json();
        },
        enabled: !!trimmedAccessToken,
    });

    const tokenStatus = useQuery({
        queryKey: ["api-client", trimmedAccessToken],
        queryFn: async () => {
            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/auth/me`, {
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`Token check failed: ${res.status}`);
            return await res.json();
        },
        enabled: !!trimmedAccessToken,
        retry: false,
    });

    const parsedData = useMemo(() => {
        if (logData.status === "success" && gameData.data) {
            return parseAllData(logData.data, gameData.data);
        }
        return undefined;
    }, [logData, gameData.data]);


    const headerRoot = logData.status === "success" ? logData.data : undefined;
    const headerJournal = headerRoot?.journal;
    const headerNames = headerRoot?.names ?? headerJournal?.names ?? {};

    const headerAttackerId = headerJournal?.attacker?.id ?? headerJournal?.initiator_id;
    const headerDefenderId = headerJournal?.defender?.id;
    const headerTargetId = headerJournal?.target_id;

    const headerAttacker =
        headerJournal?.attacker?.name ||
        (headerAttackerId ? headerNames?.[headerAttackerId]?.name : undefined) ||
        "Unknown";

    const headerDefender =
        headerJournal?.defender?.name ||
        (headerDefenderId ? headerNames?.[headerDefenderId]?.name : undefined) ||
        (headerTargetId ? headerNames?.[headerTargetId]?.name : undefined) ||
        headerTargetId ||
        "Unknown";

    const chatGptBattleContext = useMemo(() => {
        if (logData.status !== "success" || !parsedData || !gameData.data) return "";
        return buildChatGptBattleContext(logData.data.journal, parsedData, gameData.data, currentDbId);
    }, [currentDbId, gameData.data, logData, parsedData]);

    const chatGptPrompt = useMemo(() => {
        const question = battleQuestion.trim() || "What should I learn from this battle?";
        return `${chatGptBattleContext}\n\nQuestion:\n${question}`;
    }, [battleQuestion, chatGptBattleContext]);

    const mcpPrompt = useMemo(() => {
        const question = battleQuestion.trim() || "What should I learn from this battle?";
        const battleId = currentDbId ?? logData.status === "success"
            ? currentDbId ?? (logData.status === "success" ? logData.data.journal.id ?? logData.data.journal.battle_id : undefined)
            : undefined;

        return [
            "Use my STFC MCP tools if available.",
            "",
            "Alliance member handoff flow:",
            "1. The user must have the stfc-tool installed/configured in their ChatGPT/MCP setup.",
            "2. Use the battle id below to inspect the stored database data.",
            "3. Review parsed ships, officers, buffs, mitigation, hull repair, critical hits, and round events.",
            "4. Compare the database facts against the compact context below.",
            "5. Answer from observed battle data first, then give practical crew/tech changes to test next.",
            "",
            `Battle ID: ${battleId ?? "unknown"}`,
            "",
            "User question:",
            question,
            "",
            "Compact battle context:",
            chatGptBattleContext,
        ].join("\n");
    }, [battleQuestion, chatGptBattleContext, currentDbId, logData]);

    const currentBattleLink = useMemo(() => {
        if (!currentDbId) return window.location.href;
        return `${window.location.origin}/combatlog/${currentDbId}`;
    }, [currentDbId]);

    


    const saveParsedBattleToDb = useCallback(
        async (id: number | string, parsedData: any, analysisPayload: any) => {
            console.log("saveParsedBattleToDb", {
                id,
                parsedDataExists: !!parsedData,
                summaryLength: analysisPayload?.summary?.length,
                exportLength: analysisPayload?.export_text?.length,
            });
            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/battles`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({
                    id: id,
                    parsed_json: parsedData,
                    summary: analysisPayload?.summary,
                    export_text: analysisPayload?.export_text,
                    sections: analysisPayload?.sections,
                    analysis_json: analysisPayload?.analysis_json,
                }),
            });

            if (!res.ok) throw new Error(`Failed to save parsed battle: ${res.status}`);
            return await res.json().catch(() => null);
        },
        [authHeaders]
    );

    const loadLogData = useCallback(
        async (content: string | object, id?: number | string, fileName = "battle.csv") => {
            try {
                if (typeof content === "string" && isProbablyCsvBattleExport(content)) {
                    setCsvPreviewLoading(true);
                    setCsvPreview(undefined);
                    setLogData({ status: "empty" });
                    setCurrentDbId(undefined);

                    const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-csv/parse`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ file_name: fileName, text: content }),
                    });
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(body?.error ?? `CSV parser returned ${response.status}`);
                    }
                    setCsvPreview(body.battle as CsvBattlePreview);
                    return;
                }

                const normalized = normalizeBattlePayload(content);

                setCurrentDbId(id);
                setCsvPreview(undefined);

                setLogData({
                    status: "success",
                    data: normalized,
                });
            } catch (error: any) {
                setCsvPreview(undefined);
                setLogData({
                    status: "error",
                    details: error?.message || "Invalid format",
                });
            } finally {
                setCsvPreviewLoading(false);
            }
        },
        []
    );


    const loadFromDb = useCallback(
        async (id: string | number) => {
            if (!id || id === "id") return;

            try {
                setLogData({ status: "empty" });

                const res = await fetch(`${LOCAL_SYNC_BASE_URL}/battles/${id}`, {
                    headers: authHeaders(),
                });
                if (!res.ok) {
                    throw new Error(`Server returned ${res.status}`);
                }

                const row = await res.json();

                const battleContent =
                    row.raw_json ??
                    row.data ??
                    row.journal ??
                    row.payload ??
                    row.parsed_json;

                if (!battleContent) {
                    throw new Error("No battle data found in this record.");
                }

                await loadLogData(battleContent, id);
            } catch (error: any) {
                setLogData({
                    status: "error",
                    details: error?.message || "Failed to load battle",
                });
            }
        },
        [authHeaders, loadLogData]
    );

    useEffect(() => {
        if (routeBattleId && trimmedAccessToken) {
            loadFromDb(routeBattleId);
        }
    }, [routeBattleId, trimmedAccessToken, loadFromDb]);

    const searchBattlesByPlayer = useCallback(
        async (event?: React.FormEvent) => {
            event?.preventDefault();
            const player = playerSearchName.trim();
            if (!player) return;
            if (!trimmedAccessToken) {
                setBattleSearchError("Enter an access token before searching stored battles.");
                return;
            }

            setBattleSearchLoading(true);
            setBattleSearchError(undefined);
            try {
                const scan = Math.max(1, Number(battleSearchScan) || 500);
                const params = new URLSearchParams({
                    player,
                    scan: String(scan),
                    limit: "50",
                });
                const res = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-summaries/search?${params.toString()}`, {
                    headers: authHeaders(),
                });
                if (!res.ok) {
                    throw new Error(`Search failed: ${res.status}`);
                }

                const payload = await res.json();
                setBattleSearchResults(Array.isArray(payload.results) ? payload.results : []);
                setBattleSearchMeta({
                    query: payload.query ?? player,
                    scanned: Number(payload.scanned) || 0,
                    count: Number(payload.count) || 0,
                });
                setLogData((current) => current.status === "success" ? { status: "empty" } : current);
            } catch (error: any) {
                setBattleSearchError(error?.message || "Battle search failed");
                setBattleSearchResults([]);
                setBattleSearchMeta(undefined);
            } finally {
                setBattleSearchLoading(false);
            }
        },
        [authHeaders, battleSearchScan, playerSearchName, trimmedAccessToken]
    );

    const parseAndSaveBattleById = useCallback(
        async (id: string | number) => {
            if (!id || id === "id" || !gameData.data) return;

            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/battles/${id}`, {
                headers: authHeaders(),
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);

            const row = await res.json();

            const battleContent =
                row.raw_json ??
                row.data ??
                row.journal ??
                row.payload;

            if (!battleContent) {
                throw new Error(`No raw battle content for ${id}`);
            }

            const normalized = normalizeBattlePayload(battleContent);
            const parsed = parseAllData(normalized, gameData.data);
            const analysisPayload = buildCombatLogAnalysisPayload(
                normalized.journal,
                parsed,
                gameData.data,
            );

            await saveParsedBattleToDb(row.event_id ?? row.id ?? id, parsed, analysisPayload);
        },
        [authHeaders, gameData.data, saveParsedBattleToDb]
    );

    


    useEffect(() => {
    if (!gameData.data) return;
    if (!trimmedAccessToken) return;
    if (!Array.isArray(recentBattles) || recentBattles.length === 0) return;

    const nextBattle = recentBattles.find((b: any) => {
        const id = b.event_id ?? b.id;
        if (!id || id === "id") return false;

        // skip if backend says it already has parsed data
        if (b.parsed_at || b.summary_text || b.parse_version) return false;

        return !autoParsedIds.has(id);
    });

    if (!nextBattle) return;


    const id = nextBattle.event_id ?? nextBattle.id;

    setAutoParsedIds((prev) => {
        const copy = new Set(prev);
        copy.add(id);
        return copy;
    });

    parseAndSaveBattleById(id).catch((err) => {
        console.error("Auto parse failed", id, err);

        // allow retry on next poll
        setAutoParsedIds((prev) => {
            const copy = new Set(prev);
            copy.delete(id);
            return copy;
        });
    });
}, [recentBattles, gameData.data, trimmedAccessToken, autoParsedIds, parseAndSaveBattleById]);

    const MenuItem = ({ label, view }: { label: string; view: View }) => (
        <ListItemButton selected={activeView === view} onClick={() => setActiveView(view)}>
            <ListItemText primary={label} />
        </ListItemButton>
    );

    const apiClient = tokenStatus.data?.client;
    const tokenStatusChip = trimmedAccessToken ? (
        <Chip
            size="small"
            color={tokenStatus.isSuccess ? "success" : tokenStatus.isError ? "error" : "default"}
            label={
                tokenStatus.isSuccess
                    ? `Connected: ${apiClient?.display_name ?? "member"}`
                    : tokenStatus.isError
                        ? "Token not accepted"
                        : "Checking token"
            }
        />
    ) : (
        <Chip size="small" label="No token" />
    );

    const TokenPanel = ({ compact = false }: { compact?: boolean }) => (
        <Paper variant="outlined" sx={{ p: compact ? 1.25 : 2, mb: 2 }}>
            <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    {tokenStatusChip}
                    {trimmedAccessToken && (
                        <Button size="small" onClick={() => updateAccessToken("")}>
                            Forget
                        </Button>
                    )}
                </Stack>
                <TextField
                    size="small"
                    fullWidth
                    type="password"
                    label="Access token"
                    value={accessToken}
                    onChange={(event) => updateAccessToken(event.target.value)}
                />
                {!trimmedAccessToken && !compact && (
                    <Typography variant="caption" color="text.secondary">
                        Enter your alliance token to browse stored battles.
                    </Typography>
                )}
            </Stack>
        </Paper>
    );

    const renderBattleSummaryButton = (b: any) => {
        const { attacker, defender } = getRecentBattleNames(b);
        const id = String(b.id);
        const selected = selectedCompareIds.has(id);
        const shipVisuals = Array.isArray(b.ship_visuals) ? b.ship_visuals.slice(0, 4) : [];

        return (
            <ListItemButton
                key={b.id}
                onClick={() => loadFromDb(b.id)}
                sx={{
                    alignItems: "stretch",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    mb: 0.75,
                    p: 0.75,
                }}
            >
                <Checkbox
                    edge="start"
                    checked={selected}
                    tabIndex={-1}
                    onClick={(event) => {
                        event.stopPropagation();
                    }}
                    onChange={(event) => {
                        setSelectedCompareIds((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(id);
                            else next.delete(id);
                            return next;
                        });
                    }}
                    inputProps={{ "aria-label": `Select battle ${id} for compare` }}
                    sx={{ alignSelf: "flex-start", mr: 0.75, mt: -0.25 }}
                />
                <Box sx={{ width: "100%" }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {attacker} vs {defender}
                        </Typography>
                        <Chip
                            size="small"
                            color={b.parsed ? "success" : "warning"}
                            label={b.parsed ? "parsed" : "raw"}
                        />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        {b.battle_time
                            ? new Date(b.battle_time).toLocaleString()
                            : `Battle #${b.id}`}
                    </Typography>
                    {shipVisuals.length > 0 && gameData.data ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                            {shipVisuals.map((ship: any, index: number) => (
                                <CombatAssetLabel
                                    key={`${b.id}-${ship.side ?? index}-${ship.hull_id ?? ship.ship_name ?? index}`}
                                    data={gameData.data}
                                    kind="ship"
                                    id={Number(ship.hull_id)}
                                    label={ship.ship_name ?? ship.display_name ?? "Unknown ship"}
                                    secondary={[
                                        ship.display_name && ship.display_name !== ship.ship_name ? ship.display_name : "",
                                        ship.ship_level ? `L${ship.ship_level}` : "",
                                    ].filter(Boolean).join(" ")}
                                    size={28}
                                />
                            ))}
                        </Stack>
                    ) : null}
                    {Array.isArray(b.matched_players) && b.matched_players.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                            matched {b.matched_players.slice(0, 3).join(", ")}
                        </Typography>
                    )}
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                        <Chip size="small" label={`${b.rounds ?? "?"} rounds`} />
                        <Chip size="small" label={`${b.attack_events ?? b.attacks ?? 0} attacks`} />
                        <Chip size="small" label={`crit ${formatPercent(b.crit_rate)}`} />
                        <Chip size="small" label={`mit ${formatPercent(b.avg_overall_mitigation_pct)}`} />
                        <Chip size="small" label={`repair ${formatCompactNumber(b.total_repair)}`} />
                        {b.hull_above_base_ship_count > 0 && (
                            <Chip
                                size="small"
                                label={`hull ${formatSignedPercent(b.max_hull_above_base_pct)}`}
                            />
                        )}
                    </Stack>
                </Box>
            </ListItemButton>
        );
    };

    const sendSelectedToCompare = () => {
        const ids = Array.from(selectedCompareIds);
        if (!ids.length) return;
        localStorage.setItem("stfcCompareBattleIds", ids.join(", "));
        navigate(`/battle-compare?ids=${encodeURIComponent(ids.join(","))}`);
    };

    if (logData.status !== "success" || !gameData.data || !parsedData) {
        return (
            <Frame title="Completed Battles">
                <Box sx={{ py: { xs: 1, md: 2 } }}>
                    <Typography variant="h4" gutterBottom>
                        Completed Battles & Parsed Battle Logs
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 900 }}>
                        Drag in a PC game CSV export for a no-token preview, open a stored battle with your token, or select specific saved battles to compare. CSV previews are not stored.
                    </Typography>

                    {logData.status === "error" && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            <AlertTitle>Failed to load combat log</AlertTitle>
                            {logData.details}
                        </Alert>
                    )}

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
                            gap: { xs: 2, md: 3 },
                        }}
                    >
                        <Box>
                            <DropZone onLoad={(data, fileName) => loadLogData(data, undefined, fileName)} />
                            {csvPreviewLoading ? <LinearProgress sx={{ mt: 2 }} /> : null}
                            {csvPreview ? <CsvPreviewPanel battle={csvPreview} /> : null}
                        </Box>

                        <Box sx={{ borderLeft: { md: "1px solid #ddd" }, pl: { md: 3 } }}>
                            <TokenPanel />

                            <Box
                                component="form"
                                onSubmit={searchBattlesByPlayer}
                                sx={{ mb: 2 }}
                            >
                                <Stack spacing={1}>
                                    <TextField
                                        size="small"
                                        fullWidth
                                        label="Player name"
                                        value={playerSearchName}
                                        onChange={(event) => setPlayerSearchName(event.target.value)}
                                    />
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            size="small"
                                            label="Scan latest"
                                            value={battleSearchScan}
                                            onChange={(event) => setBattleSearchScan(event.target.value)}
                                            sx={{ width: 130 }}
                                            inputProps={{ inputMode: "numeric" }}
                                        />
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={!trimmedAccessToken || !playerSearchName.trim() || battleSearchLoading}
                                            startIcon={<SearchIcon />}
                                        >
                                            Search
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Box>

                            {battleSearchLoading && <LinearProgress sx={{ mb: 1 }} />}
                            {battleSearchError && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    <AlertTitle>Battle search failed</AlertTitle>
                                    {battleSearchError}
                                </Alert>
                            )}
                            {battleSearchResults && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="h6">Search Results</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {battleSearchMeta
                                            ? `${battleSearchMeta.count} matches for "${battleSearchMeta.query}" from ${battleSearchMeta.scanned} battles`
                                            : "Player battle search"}
                                    </Typography>
                                    <List dense sx={{ mt: 1, maxHeight: "34vh", overflow: "auto", pr: 0.5 }}>
                                        {battleSearchResults.length > 0 ? (
                                            battleSearchResults.map(renderBattleSummaryButton)
                                        ) : (
                                            <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    No matches found in that search window.
                                                </Typography>
                                            </Paper>
                                        )}
                                    </List>
                                </Box>
                            )}

                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Box>
                                    <Typography variant="h6">Completed Battles</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {Array.isArray(recentBattles)
                                            ? `${recentBattles.length} loaded from local sync. Select only the battles you want to compare.`
                                            : "Local sync battle history"}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<CompareArrowsIcon />}
                                        onClick={sendSelectedToCompare}
                                        disabled={selectedCompareIds.size < 2}
                                    >
                                        Send {selectedCompareIds.size || ""} to Compare
                                    </Button>
                                    <IconButton
                                        aria-label="Refresh completed battles"
                                        onClick={() => refetchRecentBattles()}
                                        disabled={!trimmedAccessToken || recentBattlesFetching}
                                        size="small"
                                    >
                                        <RefreshIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Stack>
                            <Divider sx={{ mb: 1 }} />
                            {recentBattlesFetching && <LinearProgress sx={{ mb: 1 }} />}

                            {recentBattlesError && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    <AlertTitle>Local sync is not returning battles</AlertTitle>
                                    {(recentBattlesError as Error)?.message || "Check the local sync service."}
                                </Alert>
                            )}

                            <List dense sx={{ maxHeight: { xs: "42vh", md: "46vh" }, overflow: "auto", pr: 0.5 }}>
                                {Array.isArray(recentBattles) && recentBattles.length > 0 ? (
                                    recentBattles.map(renderBattleSummaryButton)
                                ) : recentBattlesLoading ? (
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Loading recent battles...
                                        </Typography>
                                    </Paper>
                                ) : !trimmedAccessToken ? (
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Enter an access token to load stored battles.
                                        </Typography>
                                    </Paper>
                                ) : (
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No battles found. Drop a combat log or check that local sync is running.
                                        </Typography>
                                    </Paper>
                                )}
                            </List>
                        </Box>
                    </Box>
                </Box>
            </Frame>
        );
    }

    

    return (
        <Box sx={{ display: "flex" }}>
            <CssBaseline />

            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        sx={{ mr: 2 }}
                        onClick={() => setLogData({ status: "empty" })}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Typography variant="h6" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                        {headerAttacker} vs {headerDefender}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            color="inherit"
                            size="small"
                            startIcon={<LinkIcon />}
                            onClick={() => copyText(currentBattleLink, "Battle link copied")}
                        >
                            Link
                        </Button>
                        <Button
                            color="inherit"
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={() => copyText(chatGptBattleContext, "ChatGPT context copied")}
                        >
                            Context
                        </Button>
                    </Stack>
                </Toolbar>
            </AppBar>

            <Drawer
                variant="permanent"
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: {
                        width: drawerWidth,
                        boxSizing: "border-box",
                    },
                }}
            >
                <Toolbar />
                <Box sx={{ overflow: "auto" }}>
                    <Box sx={{ p: 2, pb: 0 }}>
                        <TokenPanel compact />
                    </Box>
                    <Box
                        component="form"
                        onSubmit={searchBattlesByPlayer}
                        sx={{ p: 2, pb: 1 }}
                    >
                        <Stack spacing={1}>
                            <TextField
                                size="small"
                                fullWidth
                                label="Player name"
                                value={playerSearchName}
                                onChange={(event) => setPlayerSearchName(event.target.value)}
                            />
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    size="small"
                                    label="Scan"
                                    value={battleSearchScan}
                                    onChange={(event) => setBattleSearchScan(event.target.value)}
                                    sx={{ width: 120 }}
                                    inputProps={{ inputMode: "numeric" }}
                                />
                                <IconButton
                                    type="submit"
                                    aria-label="Search battles by player"
                                    disabled={!trimmedAccessToken || !playerSearchName.trim() || battleSearchLoading}
                                    size="small"
                                >
                                    <SearchIcon fontSize="small" />
                                </IconButton>
                            </Stack>
                        </Stack>
                    </Box>

                    <List>
                        <MenuItem label="Overview" view="overview" />
                        <MenuItem label="Battle Log" view="battlelog" />
                        <MenuItem label="Raw Battle Log" view="battlelograw" />
                        <MenuItem label="Ships" view="ships" />
                        <MenuItem label="Officers" view="officers" />
                        <MenuItem label="Buffs" view="buffs" />
                        <MenuItem label="Loot" view="loot" />
                        <MenuItem label="Stats" view="stats" />
                    </List>

                    <Divider />

                    <List>
                        <MenuItem label="Damage Graph" view="damage_graph" />
                        <MenuItem label="Charts" view="charts" />
                        <MenuItem label="Crew Suggestions" view="suggestions" />
                    </List>
                </Box>
            </Drawer>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    minWidth: 0,
                    maxWidth: "100%",
                    overflow: "hidden",
                    p: { xs: 1.25, md: 2 },
                }}
            >
                <Toolbar />
                <ActiveViewComponent
                    activeView={activeView}
                    input={logData.data.journal}
                    data={gameData.data}
                    parsedData={parsedData}
                    onOpenBuffs={() => setActiveView("buffs")}
                />
                <Paper variant="outlined" sx={{ mt: 3, p: 2 }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="h6">Ask ChatGPT</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Build a compact battle prompt for ChatGPT or your MCP-enabled chat.
                            </Typography>
                        </Box>
                        {copyMessage && <Alert severity="success">{copyMessage}</Alert>}
                        <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            label="Question"
                            value={battleQuestion}
                            onChange={(event) => setBattleQuestion(event.target.value)}
                        />
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                                variant="contained"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => copyText(chatGptPrompt, "Prompt copied")}
                            >
                                Copy Prompt
                            </Button>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => copyText(mcpPrompt, "MCP prompt copied")}
                            >
                                Copy MCP Prompt
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => copyText(chatGptBattleContext, "Context copied")}
                            >
                                Copy Context Only
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<LinkIcon />}
                                onClick={() => copyText(currentBattleLink, "Battle link copied")}
                            >
                                Copy Link
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
}
