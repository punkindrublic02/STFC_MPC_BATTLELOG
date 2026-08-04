import * as React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PsychologyIcon from "@mui/icons-material/Psychology";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";
import { CombatAssetLabel } from "../combatlog/components/CombatAssetLabel";
import type { GameData } from "../combatlog/util/gameData";

const TOKEN_KEY = "stfcBattleAccessToken";

type BattleSummary = {
  id: number | string;
  battle_id: string | null;
  battle_time: string | null;
  display_attacker: string | null;
  display_defender: string | null;
  matched_players?: string[];
  parsed: boolean;
  rounds: number | null;
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

function fmtNumber(value: unknown) {
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

function battleLabel(row: BattleSummary) {
  return `${row.display_attacker ?? "Unknown"} vs ${row.display_defender ?? "Unknown"}`;
}

export function MyBattles() {
  const navigate = useNavigate();
  const [token, setToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [player, setPlayer] = React.useState(() => localStorage.getItem("stfcPlayerName") ?? "");
  const [scan, setScan] = React.useState(() => localStorage.getItem("stfcBattleScanCount") ?? "500");
  const [rows, setRows] = React.useState<BattleSummary[]>([]);
  const [gameData, setGameData] = React.useState<GameData | undefined>();
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = React.useState("");
  const trimmedToken = token.trim();
  const trimmedPlayer = player.trim();

  const saveToken = React.useCallback((value: string) => {
    setToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const savePlayer = React.useCallback((value: string) => {
    setPlayer(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem("stfcPlayerName", trimmed);
    else localStorage.removeItem("stfcPlayerName");
  }, []);

  const saveScan = React.useCallback((value: string) => {
    setScan(value);
    localStorage.setItem("stfcBattleScanCount", value);
  }, []);

  const loadBattles = React.useCallback(async () => {
    if (!trimmedToken || !trimmedPlayer) {
      setStatus("error");
      setMessage("Enter your token and player name first.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const params = new URLSearchParams();
      params.set("player", trimmedPlayer);
      params.set("scan", String(Math.max(1, Math.min(Number(scan) || 500, 10000))));
      params.set("limit", "75");
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-summaries/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${trimmedToken}` },
      });
      if (!response.ok) throw new Error(response.status === 403 ? "Token rejected by the API." : `API returned ${response.status}.`);
      const body = await response.json();
      setRows(body.results ?? []);
      setStatus("ok");
      setMessage(`Found ${body.count ?? 0} battles from the newest ${body.scanned ?? scan} rows.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load battles.");
    }
  }, [trimmedToken, trimmedPlayer, scan]);

  React.useEffect(() => {
    if (trimmedToken && trimmedPlayer) void loadBattles();
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

  const parsedCount = rows.filter((row) => row.parsed).length;
  const avgRounds = rows.length ? rows.reduce((sum, row) => sum + (Number(row.rounds) || 0), 0) / rows.length : 0;
  const avgCrit = rows.length ? rows.reduce((sum, row) => sum + (Number(row.crit_rate) || 0), 0) / rows.length : 0;

  const openBattleDetails = React.useCallback((row: BattleSummary) => {
    if (!row.id) return;
    if (trimmedToken) localStorage.setItem(TOKEN_KEY, trimmedToken);
    if (trimmedPlayer) localStorage.setItem("stfcPlayerName", trimmedPlayer);
    navigate(`/combatlog/${encodeURIComponent(String(row.id))}`);
  }, [navigate, trimmedPlayer, trimmedToken]);

  return (
    <Frame title="My Battles">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            My Battles
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Save your token and player name once, then use this page as your personal launch point.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", xl: "row" }} spacing={1.5} alignItems={{ xs: "stretch", xl: "center" }}>
            <TextField label="Access token" type="password" size="small" value={token} onChange={(event) => saveToken(event.target.value)} sx={{ minWidth: 300 }} />
            <TextField label="Player name" size="small" value={player} onChange={(event) => savePlayer(event.target.value)} sx={{ minWidth: 220 }} />
            <TextField label="Battles to search" type="number" size="small" value={scan} onChange={(event) => saveScan(event.target.value)} sx={{ width: 160 }} />
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={loadBattles} disabled={status === "loading"}>
              Refresh
            </Button>
            <Button component={RouterLink} to={`/combatlog?player=${encodeURIComponent(trimmedPlayer)}`} variant="outlined" startIcon={<ManageSearchIcon />}>
              Open Log Search
            </Button>
          </Stack>
        </Paper>

        {status === "loading" ? <LinearProgress /> : null}
        {message ? <Alert severity={status === "error" ? "warning" : "info"}>{message}</Alert> : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Matched Battles</Typography>
            <Typography variant="h4">{rows.length}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Parsed</Typography>
            <Typography variant="h4">{parsedCount}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="overline" color="text.secondary">Avg Rounds / Crit</Typography>
            <Typography variant="h4">{fmtNumber(avgRounds)} / {pct(avgCrit)}</Typography>
          </Paper>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Battle</TableCell>
                <TableCell>Matched</TableCell>
                <TableCell align="right">Rounds</TableCell>
                <TableCell align="right">Attacks</TableCell>
                <TableCell align="right">Crit</TableCell>
                  <TableCell align="right">Mitigation</TableCell>
                  <TableCell align="right">Repair/R</TableCell>
                  <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => openBattleDetails(row)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{battleLabel(row)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{row.id}{row.battle_time ? ` · ${new Date(row.battle_time).toLocaleString()}` : ""}
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
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      {(row.matched_players ?? []).slice(0, 3).map((name) => <Chip key={name} size="small" label={name} />)}
                      {!row.parsed ? <Chip size="small" color="warning" label="unparsed" /> : null}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{fmtNumber(row.rounds)}</TableCell>
                  <TableCell align="right">{fmtNumber(row.attacks)}</TableCell>
                  <TableCell align="right">{pct(row.crit_rate)}</TableCell>
                  <TableCell align="right">{pct(row.avg_overall_mitigation_pct)}</TableCell>
                  <TableCell align="right">{fmtNumber(row.avg_repair_per_round)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button
                        size="small"
                        startIcon={<PsychologyIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (trimmedToken) localStorage.setItem(TOKEN_KEY, trimmedToken);
                          navigate(`/battle-insights/${encodeURIComponent(String(row.id))}`);
                        }}
                      >
                        Insight
                      </Button>
                      <Button
                        size="small"
                        endIcon={<OpenInNewIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          openBattleDetails(row);
                        }}
                      >
                        Details
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && status !== "loading" ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography color="text.secondary">No battles loaded yet.</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Frame>
  );
}
