import * as React from "react";
import { useSearchParams } from "react-router-dom";
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
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

const TOKEN_KEY = "stfcBattleAccessToken";

type ComparedBattle = {
  event_id: number;
  battle_time: string | null;
  player_name: string | null;
  ship_name: string | null;
  ship_level: number | null;
  battle_type: string | null;
  target_family: string | null;
  opponent_ship_name: string | null;
  opponent_ship_level: number | null;
  captain_name: string | null;
  bridge_crew: string | null;
  below_deck_crew: string | null;
  rounds: number | null;
  damage_dealt_per_round: number | null;
  damage_taken_per_round: number | null;
  damage_exchange_ratio: number | null;
  avg_overall_mitigation_pct: number | null;
  crit_rate_dealt: number | null;
  hull_repair_per_round: number | null;
  net_hull_damage_after_repairs: number | null;
  encounter_score: number | null;
  top_officer_events?: Array<{ officer_name: string; ability_name: string; triggers: number }>;
};

type CsvImport = {
  import_id: number;
  file_name: string | null;
  player_name: string | null;
  target_name: string | null;
  ship_name: string | null;
  ship_level: number | null;
  outcome: string | null;
  captain: string | null;
  bridge_officers: string | null;
  below_deck_officers: string | null;
  rounds: number | null;
  damage_dealt_per_round: number | null;
  damage_taken_per_round: number | null;
  damage_exchange_ratio: number | null;
  crit_rate: number | null;
  score: number | null;
  created_at: string | null;
};

function fmt(value: unknown) {
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

function battleTitle(row: ComparedBattle) {
  const target = row.target_family || row.opponent_ship_name || "unknown target";
  return `${row.ship_name ?? "Unknown ship"}${row.ship_level ? ` L${row.ship_level}` : ""} vs ${target}${row.opponent_ship_level ? ` L${row.opponent_ship_level}` : ""}`;
}

export function BattleCompare() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [ids, setIds] = React.useState(() => searchParams.get("ids") ?? localStorage.getItem("stfcCompareBattleIds") ?? "");
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = React.useState("");
  const [battles, setBattles] = React.useState<ComparedBattle[]>([]);
  const [csvImports, setCsvImports] = React.useState<CsvImport[]>([]);
  const [csvStatus, setCsvStatus] = React.useState("");
  const trimmedToken = token.trim();

  const saveToken = React.useCallback((value: string) => {
    setToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const saveIds = React.useCallback((value: string) => {
    setIds(value);
    localStorage.setItem("stfcCompareBattleIds", value);
  }, []);

  const authHeaders = React.useCallback(() => (
    trimmedToken ? { Authorization: `Bearer ${trimmedToken}` } : {}
  ), [trimmedToken]);

  const loadCsvImports = React.useCallback(async () => {
    if (!trimmedToken) return;
    const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-csv/imports?limit=25`, {
      headers: authHeaders(),
    });
    if (!response.ok) return;
    const body = await response.json();
    setCsvImports(body.imports ?? []);
  }, [authHeaders, trimmedToken]);

  const compareBattles = React.useCallback(async () => {
    if (!trimmedToken) {
      setStatus("error");
      setMessage("Enter your access token first.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const params = new URLSearchParams({ ids });
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-compare?${params.toString()}`, {
        headers: authHeaders(),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `API returned ${response.status}`);
      setBattles(body.battles ?? []);
      setStatus("ok");
      setMessage(`Compared ${body.count ?? 0} battle rows${body.missing_ids?.length ? `; missing ${body.missing_ids.join(", ")}` : ""}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not compare battles.");
    }
  }, [authHeaders, ids, trimmedToken]);

  const uploadCsv = React.useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    if (!trimmedToken) {
      setCsvStatus("Enter your access token before importing CSV logs.");
      return;
    }
    setCsvStatus("Importing CSV logs...");
    try {
      const payloadFiles = await Promise.all(Array.from(files).map(async (file) => ({
        file_name: file.name,
        text: await file.text(),
      })));
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-csv/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ files: payloadFiles }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `CSV import failed: ${response.status}`);
      setCsvStatus(`Imported ${body.inserted ?? 0}; duplicates ${body.duplicates ?? 0}.`);
      await loadCsvImports();
    } catch (error) {
      setCsvStatus(error instanceof Error ? error.message : "Could not import CSV logs.");
    }
  }, [authHeaders, loadCsvImports, trimmedToken]);

  React.useEffect(() => {
    void loadCsvImports();
  }, [loadCsvImports]);

  React.useEffect(() => {
    const routeIds = searchParams.get("ids");
    if (routeIds) saveIds(routeIds);
  }, [saveIds, searchParams]);

  return (
    <Frame title="Battle Compare">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Battle Compare
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 920 }}>
            Compare real database battles by ID and import CSV battle exports into backend storage so they stop being temporary browser-only evidence.
            Use the Battle # chips or Sample IDs shown on Ship Comparison rows.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
            <TextField label="Access token" type="password" size="small" value={token} onChange={(event) => saveToken(event.target.value)} sx={{ minWidth: 300 }} />
            <TextField label="Battle IDs" size="small" value={ids} onChange={(event) => saveIds(event.target.value)} placeholder="12345, 12346, 12347" sx={{ flexGrow: 1 }} />
            <Button variant="contained" startIcon={<CompareArrowsIcon />} disabled={status === "loading"} onClick={compareBattles}>
              Compare
            </Button>
            <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
              Import CSV
              <input hidden multiple type="file" accept=".csv,text/csv,text/tab-separated-values" onChange={(event) => {
                void uploadCsv(event.target.files);
                event.currentTarget.value = "";
              }} />
            </Button>
          </Stack>
        </Paper>

        {status === "loading" ? <LinearProgress /> : null}
        {message ? <Alert severity={status === "error" ? "warning" : "info"}>{message}</Alert> : null}
        {csvStatus ? <Alert severity={csvStatus.toLowerCase().includes("could not") || csvStatus.toLowerCase().includes("enter") ? "warning" : "success"}>{csvStatus}</Alert> : null}

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Battle</TableCell>
                <TableCell>Crew</TableCell>
                <TableCell align="right">Rounds</TableCell>
                <TableCell align="right">Dmg/R</TableCell>
                <TableCell align="right">Taken/R</TableCell>
                <TableCell align="right">Trade</TableCell>
                <TableCell align="right">Mit</TableCell>
                <TableCell align="right">Crit</TableCell>
                <TableCell align="right">Repair/R</TableCell>
                <TableCell align="right">Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {battles.map((battle) => (
                <TableRow key={battle.event_id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{battleTitle(battle)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{battle.event_id}{battle.battle_time ? ` · ${new Date(battle.battle_time).toLocaleString()}` : ""} · {battle.battle_type ?? "unknown"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{battle.captain_name ?? "Unknown captain"}</Typography>
                    <Typography variant="caption" color="text.secondary">{battle.bridge_crew ?? "No bridge stored"}</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {(battle.top_officer_events ?? []).slice(0, 3).map((event) => (
                        <Chip key={`${battle.event_id}-${event.officer_name}-${event.ability_name}`} size="small" label={`${event.officer_name}: ${event.triggers}`} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{fmt(battle.rounds)}</TableCell>
                  <TableCell align="right">{fmt(battle.damage_dealt_per_round)}</TableCell>
                  <TableCell align="right">{fmt(battle.damage_taken_per_round)}</TableCell>
                  <TableCell align="right">{fmt(battle.damage_exchange_ratio)}</TableCell>
                  <TableCell align="right">{pct(battle.avg_overall_mitigation_pct)}</TableCell>
                  <TableCell align="right">{pct(battle.crit_rate_dealt)}</TableCell>
                  <TableCell align="right">{fmt(battle.hull_repair_per_round)}</TableCell>
                  <TableCell align="right">{fmt(battle.encounter_score)}</TableCell>
                </TableRow>
              ))}
              {!battles.length ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <Typography color="text.secondary">Enter two or more battle IDs to compare.</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Stored CSV Imports</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>CSV Battle</TableCell>
                  <TableCell>Crew</TableCell>
                  <TableCell align="right">Rounds</TableCell>
                  <TableCell align="right">Dmg/R</TableCell>
                  <TableCell align="right">Taken/R</TableCell>
                  <TableCell align="right">Trade</TableCell>
                  <TableCell align="right">Crit</TableCell>
                  <TableCell align="right">Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {csvImports.map((row) => (
                  <TableRow key={row.import_id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.ship_name ?? "Unknown ship"} vs {row.target_name ?? "Unknown target"}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.player_name ?? "Unknown player"} · {row.outcome ?? "unknown"} · {row.file_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.captain ?? "Unknown captain"}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.bridge_officers ?? "No bridge stored"}</Typography>
                    </TableCell>
                    <TableCell align="right">{fmt(row.rounds)}</TableCell>
                    <TableCell align="right">{fmt(row.damage_dealt_per_round)}</TableCell>
                    <TableCell align="right">{fmt(row.damage_taken_per_round)}</TableCell>
                    <TableCell align="right">{fmt(row.damage_exchange_ratio)}</TableCell>
                    <TableCell align="right">{pct(row.crit_rate)}</TableCell>
                    <TableCell align="right">{fmt(row.score)}</TableCell>
                  </TableRow>
                ))}
                {!csvImports.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography color="text.secondary">No CSV imports stored yet.</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </Frame>
  );
}
