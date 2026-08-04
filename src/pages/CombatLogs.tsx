import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PsychologyIcon from "@mui/icons-material/Psychology";
import RefreshIcon from "@mui/icons-material/Refresh";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";
import { CombatAssetLabel } from "../combatlog/components/CombatAssetLabel";
import type { GameData } from "../combatlog/util/gameData";

const TOKEN_KEY = "stfcBattleAccessToken";

type RecentBattle = {
  id: number | string;
  battle_id: string | null;
  battle_time: string | null;
  display_attacker: string | null;
  display_defender: string | null;
  parsed: boolean;
  parse_error: string | null;
  rounds: number | null;
  sub_rounds: number | null;
  attacks: number;
  crit_rate: number | null;
  avg_overall_mitigation_pct: number | null;
  avg_repair_per_round: number | null;
  ship_count: number;
  hull_above_base?: Array<{
    side: string;
    display_name: string | null;
    ship_name: string | null;
    percent_above_base: number | null;
  }>;
  ship_visuals?: Array<{
    side: string | null;
    display_name: string | null;
    player_name: string | null;
    ship_name: string | null;
    hull_id: number | string | null;
    ship_level: number | string | null;
  }>;
};

function compact(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  if (Math.abs(number) >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return number.toFixed(Math.abs(number) < 10 ? 2 : 0);
}

function pct(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "n/a";
}

function formatDate(value: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function battleLabel(row: RecentBattle) {
  return `${row.display_attacker ?? "Unknown attacker"} vs ${row.display_defender ?? "Unknown defender"}`;
}

function rowMatches(row: RecentBattle, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [
    row.id,
    row.battle_id,
    row.display_attacker,
    row.display_defender,
    row.battle_time,
    row.parse_error,
    ...(row.hull_above_base ?? []).map((ship) => `${ship.display_name ?? ""} ${ship.ship_name ?? ""}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(term);
}

export function CombatLogs(): React.JSX.Element {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [limit, setLimit] = React.useState("50");
  const [search, setSearch] = React.useState("");
  const [rows, setRows] = React.useState<RecentBattle[]>([]);
  const [gameData, setGameData] = React.useState<GameData | undefined>();
  const [selectedCompareIds, setSelectedCompareIds] = React.useState<Set<string>>(() => new Set());
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = React.useState("");
  const trimmedToken = accessToken.trim();

  const saveToken = React.useCallback((value: string) => {
    setAccessToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const loadBattles = React.useCallback(async () => {
    if (!trimmedToken) {
      setStatus("error");
      setMessage("Enter an access token to load alliance battle logs.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const params = new URLSearchParams();
      params.set("limit", String(Math.max(10, Math.min(Number(limit) || 50, 100))));
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-summaries/recent?${params.toString()}`, {
        headers: { Authorization: `Bearer ${trimmedToken}` },
      });
      if (!response.ok) {
        throw new Error(response.status === 401 || response.status === 403
          ? "Token rejected by the API."
          : `Could not load battle logs: ${response.status}`);
      }
      const body = await response.json();
      const nextRows = Array.isArray(body) ? body : [];
      setRows(nextRows);
      setStatus("ok");
      setMessage(`Loaded ${nextRows.length} newest battle logs.`);
    } catch (error) {
      setRows([]);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load battle logs.");
    }
  }, [limit, trimmedToken]);

  React.useEffect(() => {
    if (trimmedToken) void loadBattles();
    // Load once from the saved token; the button handles changes after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    let canceled = false;
    fetch("/data/game-data/all.json")
      .then((response) => response.ok ? response.json() : undefined)
      .then((body) => {
        if (!canceled && body) setGameData(body as GameData);
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, []);

  const visibleRows = rows.filter((row) => rowMatches(row, search));
  const parsedCount = rows.filter((row) => row.parsed).length;
  const unparsedCount = rows.length - parsedCount;

  const openDetails = React.useCallback((id: RecentBattle["id"]) => {
    navigate(`/combatlog/${encodeURIComponent(String(id))}`);
  }, [navigate]);

  const openFacts = React.useCallback((id: RecentBattle["id"]) => {
    navigate(`/battle-insights/${encodeURIComponent(String(id))}`);
  }, [navigate]);

  const toggleCompare = React.useCallback((id: RecentBattle["id"], checked: boolean) => {
    setSelectedCompareIds((current) => {
      const next = new Set(current);
      if (checked) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  }, []);

  const sendSelectedToCompare = React.useCallback(() => {
    const ids = Array.from(selectedCompareIds);
    if (ids.length < 2) return;
    localStorage.setItem("stfcCompareBattleIds", ids.join(", "));
    navigate(`/battle-compare?ids=${encodeURIComponent(ids.join(","))}`);
  }, [navigate, selectedCompareIds]);

  return (
    <Frame title="Battle Log Explorer">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Battle Log Explorer
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
            Browse the newest stored alliance battles. Use Details for the parsed battle log, or AI Facts for the evidence packet.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
            <TextField
              label="Access token"
              type="password"
              size="small"
              value={accessToken}
              onChange={(event) => saveToken(event.target.value)}
              sx={{ minWidth: 280 }}
            />
            <TextField
              select
              label="Newest logs"
              size="small"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              sx={{ width: 150 }}
            >
              <MenuItem value="25">25</MenuItem>
              <MenuItem value="50">50</MenuItem>
              <MenuItem value="100">100</MenuItem>
            </TextField>
            <TextField
              label="Filter loaded rows"
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 260, flexGrow: 1 }}
            />
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={loadBattles} disabled={status === "loading"}>
              Load Logs
            </Button>
            <Button
              variant="outlined"
              startIcon={<CompareArrowsIcon />}
              onClick={sendSelectedToCompare}
              disabled={selectedCompareIds.size < 2}
            >
              Compare {selectedCompareIds.size || ""}
            </Button>
          </Stack>
        </Paper>

        {status === "loading" ? <LinearProgress /> : null}
        {message ? <Alert severity={status === "error" ? "warning" : "info"}>{message}</Alert> : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Loaded</Typography>
            <Typography variant="h4">{rows.length}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Parsed</Typography>
            <Typography variant="h4">{parsedCount}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Needs Parser Review</Typography>
            <Typography variant="h4">{unparsedCount}</Typography>
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Stack spacing={1} sx={{ maxHeight: { xs: "58vh", md: "62vh" }, overflow: "auto", pr: 0.5 }}>
            {visibleRows.map((row) => {
              const selected = selectedCompareIds.has(String(row.id));
              return (
                <Paper
                  key={row.id}
                  variant="outlined"
                  sx={{
                    p: 1,
                    display: "grid",
                    gridTemplateColumns: { xs: "auto 1fr", md: "auto minmax(260px, 1.5fr) minmax(260px, 1fr) auto" },
                    gap: 1,
                    alignItems: "center",
                  }}
                  onClick={() => openDetails(row.id)}
                >
                  <Checkbox
                    checked={selected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => toggleCompare(row.id, event.target.checked)}
                    inputProps={{ "aria-label": `Select battle ${row.id} for compare` }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{battleLabel(row)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{row.id}{row.battle_time ? ` · ${formatDate(row.battle_time)}` : ""}
                    </Typography>
                    {gameData && Array.isArray(row.ship_visuals) && row.ship_visuals.length > 0 ? (
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                        {row.ship_visuals.slice(0, 4).map((ship, index) => (
                          <CombatAssetLabel
                            key={`${row.id}-${ship.side ?? index}-${ship.hull_id ?? ship.ship_name ?? index}`}
                            data={gameData}
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
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <Chip size="small" color={row.parsed ? "success" : "warning"} label={row.parsed ? "parsed" : "unparsed"} />
                      {row.ship_count ? <Chip size="small" variant="outlined" label={`${row.ship_count} ships`} /> : null}
                      {row.parse_error ? <Chip size="small" color="warning" label={row.parse_error} /> : null}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ gridColumn: { xs: "2 / -1", md: "auto" } }}>
                    <Chip size="small" label={`${compact(row.rounds)} rounds`} />
                    <Chip size="small" label={`${compact(row.attacks)} attacks`} />
                    <Chip size="small" label={`crit ${pct(row.crit_rate)}`} />
                    <Chip size="small" label={`mit ${pct(row.avg_overall_mitigation_pct)}`} />
                    <Chip size="small" label={`repair ${compact(row.avg_repair_per_round)}`} />
                    {(row.hull_above_base ?? []).slice(0, 1).map((ship, index) => (
                      <Chip
                        key={`${row.id}-${ship.side}-${index}`}
                        size="small"
                        variant="outlined"
                        label={`${ship.display_name ?? ship.ship_name ?? ship.side}: +${pct(ship.percent_above_base)}`}
                      />
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={0.5} justifyContent={{ xs: "flex-start", md: "flex-end" }} sx={{ gridColumn: { xs: "2 / -1", md: "auto" } }}>
                    <Button
                      size="small"
                      startIcon={<PsychologyIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openFacts(row.id);
                      }}
                    >
                      AI Facts
                    </Button>
                    <Button
                      size="small"
                      endIcon={<OpenInNewIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetails(row.id);
                      }}
                    >
                      Details
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
            {status !== "loading" && !visibleRows.length ? (
              <Box sx={{ p: 2 }}>
                <Typography color="text.secondary">No battle logs match the current filter.</Typography>
              </Box>
            ) : null}
          </Stack>
        </Paper>
      </Stack>
    </Frame>
  );
}
