import * as React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useQuery } from "@tanstack/react-query";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";
import { GameData, lookupTranslation } from "../combatlog/util/gameData";
import { HostileDetail, ShipDetail } from "../util/gameData";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: string;
  createdAt: string;
};

type EncounterType = "all" | "hostile" | "armada" | "solo-armada" | "outpost" | "pvp";

type ShipOption = {
  id: number;
  label: string;
  name: string;
  grade: number;
  rarity: unknown;
};

type HostileOption = {
  id: number;
  label: string;
  name: string;
  level: number;
  strength: number;
  detail: HostileDetail;
};

type ObservedCrewResult = {
  encounter_type?: string | null;
  encounter_family?: string | null;
  target_family?: string | null;
  solo_or_group?: string | null;
  ship_name?: string | null;
  ship_level?: number | null;
  fleet_grade?: number | null;
  opponent_name?: string | null;
  opponent_ship_name?: string | null;
  target_level?: number | null;
  captain?: string | null;
  bridge_officers?: string | null;
  below_deck_officers?: string | null;
  battles: number;
  player_count?: number | null;
  first_seen?: string | null;
  last_seen?: string | null;
  avg_rounds?: number | null;
  avg_damage_dealt_per_round?: number | null;
  avg_damage_taken_per_round?: number | null;
  avg_damage_exchange_ratio?: number | null;
  avg_overall_mitigation_pct?: number | null;
  avg_crit_rate_dealt?: number | null;
  avg_hull_repair_per_round?: number | null;
  avg_net_hull_damage_after_repairs?: number | null;
  avg_encounter_score?: number | null;
  score_basis?: string | null;
};

type ObservedResponse = {
  count: number;
  window_days: number;
  results: ObservedCrewResult[];
};

const starterQuestions = [
  "Which observed crew looks best for this target?",
  "What should I test next without changing too many variables?",
  "Is this setup good for grinding or just fast kills?",
  "What does the evidence say is weak in this build?",
];

function sourceLabel(source?: string) {
  if (source === "local") return "Local NPU";
  if (source === "openai") return "OpenAI fallback";
  if (source === "facts") return "Database facts";
  return source || "STFC AI Assist";
}

function formatNumber(value: unknown, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  if (Math.abs(number) >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(digits)}B`;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(digits)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(digits)}K`;
  return number.toFixed(digits);
}

function evidenceSearchName(name: string | undefined) {
  return String(name ?? "")
    .replace(/[↿⇈⇊↑↓★☆]+/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt(question: string, filters: {
  ship?: string;
  ship_id?: number;
  target?: string;
  evidence_target?: string;
  target_id?: number;
  target_level?: number;
  encounter: EncounterType;
}) {
  const parts = [
    question.trim(),
    "",
    "Selected evidence filters:",
    filters.ship ? `Player ship: ${filters.ship}${filters.ship_id ? ` (${filters.ship_id})` : ""}` : null,
    filters.target ? `Hostile/target: ${filters.target}${filters.target_level ? ` L${filters.target_level}` : ""}${filters.target_id ? ` (${filters.target_id})` : ""}` : null,
    filters.evidence_target && filters.evidence_target !== filters.target ? `Evidence target family search: ${filters.evidence_target}` : null,
    filters.encounter !== "all" ? `Encounter: ${filters.encounter}` : null,
    "",
    "Use the supplied observed battle aggregates first. If the data is weak, missing, stale, or not comparable, say that plainly and suggest the next controlled test.",
  ].filter(Boolean);
  return parts.join("\n");
}

function buildObservedContext(filters: {
  ship?: string;
  ship_id?: number;
  target?: string;
  evidence_target?: string;
  target_id?: number;
  target_level?: number;
  encounter: EncounterType;
}, observedRows: ObservedCrewResult[]) {
  return {
    source: "stfc_ai_assist_public_observed_context",
    context_mode: "observed_battle_setup",
    filters,
    evidence_count: observedRows.length,
    observed_battle_summary: observedRows.slice(0, 12).map((row) => ({
      ship: row.ship_name,
      ship_level: row.ship_level,
      target: row.target_family || row.opponent_ship_name || row.opponent_name,
      target_level: row.target_level,
      encounter: row.encounter_type || row.encounter_family,
      captain: row.captain,
      bridge: row.bridge_officers,
      below_deck: row.below_deck_officers,
      battles: row.battles,
      player_count: row.player_count,
      avg_rounds: row.avg_rounds,
      avg_damage_dealt_per_round: row.avg_damage_dealt_per_round,
      avg_damage_taken_per_round: row.avg_damage_taken_per_round,
      avg_trade_ratio: row.avg_damage_exchange_ratio,
      avg_mitigation_pct: row.avg_overall_mitigation_pct,
      avg_crit_rate: row.avg_crit_rate_dealt,
      avg_hull_repair_per_round: row.avg_hull_repair_per_round,
      avg_net_hull_damage: row.avg_net_hull_damage_after_repairs,
      avg_score: row.avg_encounter_score,
      score_basis: row.score_basis,
      first_seen: row.first_seen,
      last_seen: row.last_seen,
    })),
    instruction: "Ground the answer in these aggregate rows. Do not infer from unavailable raw logs. Explain confidence from sample size and comparability.",
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error ?? `Request failed: ${response.status}`);
  return result as T;
}

function buildShipOptions(data: GameData): ShipOption[] {
  return Object.values(data.ship)
    .map((ship) => {
      const name = shipNameFromDetail(ship, data);
      return {
        id: ship.id,
        label: `G${ship.grade} ${ship.rarity} ${name}`,
        name,
        grade: ship.grade,
        rarity: ship.rarity,
      };
    })
    .sort((left, right) => {
      const gradeOrder = right.grade - left.grade;
      if (gradeOrder !== 0) return gradeOrder;
      const rarityOrder = rarityToNumber(right.rarity) - rarityToNumber(left.rarity);
      if (rarityOrder !== 0) return rarityOrder;
      return left.name.localeCompare(right.name);
    });
}

function buildHostileOptions(data: GameData): HostileOption[] {
  return Object.values(data.hostile)
    .map((hostile) => {
      const name =
        lookupTranslation(data.translations.ships, hostile.loca_id, "ship_name") ||
        lookupTranslation(data.translations.officer_names, hostile.loca_id, "officer_name") ||
        `Hostile ${hostile.id}`;
      return {
        id: hostile.id,
        name,
        level: hostile.level,
        strength: hostile.strength,
        label: `L${hostile.level} ${name} (${formatNumber(hostile.strength, 1)})`,
        detail: hostile,
      };
    })
    .sort((left, right) => {
      const nameOrder = left.name.localeCompare(right.name);
      return nameOrder || left.level - right.level;
    });
}

function shipNameFromDetail(ship: ShipDetail, data: GameData) {
  return lookupTranslation(data.translations.ships, ship.loca_id, "ship_name") || `Ship ${ship.id}`;
}

function rarityToNumber(rarity: unknown) {
  switch (rarity) {
    case "Common":
      return 0;
    case "Uncommon":
      return 1;
    case "Rare":
      return 2;
    case "Epic":
      return 3;
    default:
      return 0;
  }
}

export function StfcAiAssist() {
  const [encounter, setEncounter] = React.useState<EncounterType>("hostile");
  const [selectedShip, setSelectedShip] = React.useState<ShipOption | null>(null);
  const [selectedTarget, setSelectedTarget] = React.useState<HostileOption | null>(null);
  const [question, setQuestion] = React.useState("Which observed crew looks best for this target, and what should I test next?");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const gameData = useQuery({
    queryKey: ["game-data"],
    queryFn: async () => {
      const response = await fetch("/data/game-data/all.json");
      if (!response.ok) throw new Error(`Could not load game data: ${response.status}`);
      return (await response.json()) as GameData;
    },
    staleTime: 10 * 60 * 1000,
  });

  const shipOptions = React.useMemo(() => (gameData.data ? buildShipOptions(gameData.data) : []), [gameData.data]);
  const hostileOptions = React.useMemo(() => (gameData.data ? buildHostileOptions(gameData.data) : []), [gameData.data]);

  const observedQuery = useQuery({
    queryKey: ["stfc-ai-assist-observed", selectedShip?.name, selectedTarget?.name, encounter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", "12");
      params.set("days", "60");
      params.set("encounter", encounter);
      if (selectedShip?.name) params.set("ship", selectedShip.name);
      const targetSearch = evidenceSearchName(selectedTarget?.name);
      if (targetSearch) params.set("target", targetSearch);
      return fetchJson<ObservedResponse>(`${LOCAL_SYNC_BASE_URL}/public/ai-assist/observed?${params.toString()}`);
    },
    enabled: Boolean(selectedShip || selectedTarget || encounter !== "all"),
    staleTime: 60 * 1000,
  });

  const observedRows = observedQuery.data?.results ?? [];
  const filters = React.useMemo(() => ({
    ship: selectedShip?.name,
    ship_id: selectedShip?.id,
    target: selectedTarget?.name,
    evidence_target: evidenceSearchName(selectedTarget?.name) || undefined,
    target_id: selectedTarget?.id,
    target_level: selectedTarget?.level,
    encounter,
  }), [encounter, selectedShip?.id, selectedShip?.name, selectedTarget?.id, selectedTarget?.level, selectedTarget?.name]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const ask = React.useCallback(async (overrideQuestion?: string) => {
    const nextQuestion = (overrideQuestion ?? question).trim();
    if (!nextQuestion || loading) return;

    const prompt = buildPrompt(nextQuestion, filters);
    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: nextQuestion,
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/ai/stfc-ai-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: "stfc-ai-assist-public",
          question: prompt,
          context: buildObservedContext(filters, observedRows),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error ?? `STFC AI Assist request failed: ${response.status}`);

      const answer = String(result?.answer ?? result?.message ?? result?.content ?? JSON.stringify(result, null, 2));
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: answer,
        source: result?.source,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not ask STFC AI Assist.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          text: message,
          source: "error",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [filters, loading, observedRows, question]);

  const canAsk = !!question.trim() && !loading;

  return (
    <Frame title="STFC AI Assist">
      <Stack spacing={2} sx={{ maxWidth: 1180, mx: "auto" }}>
        <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
          <Stack spacing={1}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", md: "center" }}>
              <SmartToyIcon color="primary" />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h4">STFC AI Assist</Typography>
                <Typography color="text.secondary">
                  Pick from the same player-ship and hostile catalogs used by Ops Ship & Crew Compare, then ask questions using observed battle history as context.
                </Typography>
              </Box>
              <Chip color="success" label="Public read-only" />
            </Stack>
            <Alert severity="info">
              No website token is required here. This page uses capped aggregate battle evidence only; uploads, raw logs, and private sync still stay behind tokens.
            </Alert>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Observed Battle Context</Typography>
            {gameData.data ? (
              <Typography variant="body2" color="text.secondary">
                {shipOptions.length.toLocaleString()} player ships and {hostileOptions.length.toLocaleString()} hostiles loaded from game data {gameData.data.version}.
              </Typography>
            ) : null}
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                select
                label="Encounter"
                value={encounter}
                onChange={(event) => setEncounter(event.target.value as EncounterType)}
                size="small"
                sx={{ minWidth: { md: 165 } }}
              >
                <MenuItem value="hostile">Hostile</MenuItem>
                <MenuItem value="armada">Armada</MenuItem>
                <MenuItem value="solo-armada">Solo armada</MenuItem>
                <MenuItem value="outpost">Outpost</MenuItem>
                <MenuItem value="pvp">PvP</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </TextField>
              <Autocomplete
                options={shipOptions}
                value={selectedShip}
                onChange={(_event, value) => setSelectedShip(value)}
                getOptionLabel={(option) => option.label}
                loading={gameData.isLoading}
                renderInput={(params) => <TextField {...params} label="Player ship" size="small" />}
                sx={{ minWidth: { md: 280 }, flex: 1 }}
              />
              <Autocomplete
                options={hostileOptions}
                value={selectedTarget}
                onChange={(_event, value) => setSelectedTarget(value)}
                getOptionLabel={(option) => option.label}
                loading={gameData.isLoading}
                renderInput={(params) => <TextField {...params} label="Hostile / target ship" size="small" />}
                sx={{ minWidth: { md: 260 }, flex: 1.2 }}
              />
            </Stack>
            {gameData.isError ? (
              <Alert severity="warning">{gameData.error instanceof Error ? gameData.error.message : "Could not load ship-builder dropdown data."}</Alert>
            ) : null}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${observedRows.length} matching crew summaries`} color={observedRows.length ? "primary" : "default"} />
              {observedQuery.isFetching ? <Chip icon={<CircularProgress size={14} />} label="Refreshing evidence" /> : null}
              {selectedShip ? <Chip label={`Ship: ${selectedShip.name}`} onDelete={() => setSelectedShip(null)} /> : null}
              {selectedTarget ? <Chip label={`Target: ${selectedTarget.name} L${selectedTarget.level}`} onDelete={() => setSelectedTarget(null)} /> : null}
            </Stack>
            {observedRows.length ? (
              <Stack spacing={0.75}>
                {observedRows.slice(0, 3).map((row, index) => (
                  <Paper key={`${row.ship_name}-${row.target_family}-${row.captain}-${index}`} variant="outlined" sx={{ borderRadius: 1, p: 1 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {row.ship_name || "Unknown ship"}{row.ship_level ? ` L${row.ship_level}` : ""} vs {row.target_family || row.opponent_ship_name || row.opponent_name || "unknown target"}{row.target_level ? ` L${row.target_level}` : ""}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Captain: {row.captain || "Unknown"} | Bridge: {row.bridge_officers || "Unknown"} | {row.battles} battles
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={`Rounds ${formatNumber(row.avg_rounds, 2)}`} />
                        <Chip size="small" label={`Trade ${formatNumber(row.avg_damage_exchange_ratio, 1)}`} />
                        <Chip size="small" label={`Hull ${formatNumber(row.avg_net_hull_damage_after_repairs, 1)}`} />
                        <Chip size="small" label={`Score ${formatNumber(row.avg_encounter_score, 1)}`} />
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Alert severity="warning">
                No matching observed crew summaries are loaded yet. The AI can still answer, but it should treat the result as low confidence until matching battles exist.
              </Alert>
            )}
          </Stack>
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            borderRadius: 1,
            minHeight: 420,
            maxHeight: { xs: "none", md: "58vh" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box sx={{ p: 2, flexGrow: 1, overflowY: "auto" }}>
            {messages.length ? (
              <Stack spacing={1.25}>
                {messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                      width: { xs: "100%", md: "min(78%, 760px)" },
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: message.role === "user" ? "primary.main" : "background.default",
                        color: message.role === "user" ? "primary.contrastText" : "text.primary",
                        border: message.role === "assistant" ? "1px solid" : "none",
                        borderColor: "divider",
                      }}
                    >
                      <Stack spacing={0.75}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>
                            {message.role === "user" ? "You" : sourceLabel(message.source)}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.65 }}>
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                          {message.text}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Box>
                ))}
                {loading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Building evidence and asking STFC AI Assist...</Typography>
                  </Stack>
                ) : null}
                <div ref={bottomRef} />
              </Stack>
            ) : (
              <Stack spacing={1.5} sx={{ height: "100%", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                <SmartToyIcon color="primary" sx={{ fontSize: 44 }} />
                <Typography variant="h6">Ask about the selected setup.</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
                  The answer should explain what the observed battles prove, what they do not prove, and what controlled test to run next.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
                  {starterQuestions.map((starter) => (
                    <Chip key={starter} label={starter} onClick={() => setQuestion(starter)} />
                  ))}
                </Stack>
              </Stack>
            )}
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            <Stack spacing={1}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={5}
                label="Ask STFC AI Assist"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    void ask();
                  }
                }}
                placeholder="Example: Which crew is better for grinding this hostile, and why?"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <Button variant="contained" startIcon={<SendIcon />} disabled={!canAsk} onClick={() => void ask()}>
                  Ask
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DeleteOutlineIcon />}
                  disabled={!messages.length || loading}
                  onClick={() => {
                    setMessages([]);
                    setError(null);
                  }}
                >
                  Clear
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Ctrl+Enter sends. Public chat uses capped observed summaries, not private raw battle logs.
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Frame>
  );
}
