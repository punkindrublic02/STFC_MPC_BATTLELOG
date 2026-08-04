import * as React from "react";
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

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

const TOKEN_KEY = "stfcBattleAccessToken";

type DiagnosticsResponse = {
  totals: Record<string, number>;
  unknowns: Record<string, number>;
  quality: Record<string, number>;
  parse_versions: Array<{ parse_version: string; battles: number }>;
  recent_errors: Array<{ event_id: number; battle_time: string | null; battle_id: string | null; parse_error: string | null }>;
  recent_unparsed: Array<{ id: number; timestamp: string | null; battle_id: string | null; source: string | null }>;
  generated_at: string;
};

function fmt(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function title(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ParserDiagnostics() {
  const [token, setToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [data, setData] = React.useState<DiagnosticsResponse | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = React.useState("");
  const trimmedToken = token.trim();

  const saveToken = React.useCallback((value: string) => {
    setToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const loadDiagnostics = React.useCallback(async () => {
    if (!trimmedToken) {
      setStatus("error");
      setMessage("Enter your access token first.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/parser/diagnostics`, {
        headers: { Authorization: `Bearer ${trimmedToken}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error ?? `API returned ${response.status}`);
      setData(body);
      setStatus("ok");
      setMessage(`Diagnostics refreshed at ${new Date(body.generated_at).toLocaleString()}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not load parser diagnostics.");
    }
  }, [trimmedToken]);

  React.useEffect(() => {
    if (trimmedToken) void loadDiagnostics();
  }, []);

  const totalParsed = Number(data?.totals?.parsed_battles ?? 0);
  const totalEvents = Number(data?.totals?.source_events ?? 0);
  const parseRate = totalEvents > 0 ? totalParsed / totalEvents : 0;

  return (
    <Frame title="Parser Diagnostics">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Parser Diagnostics
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 920 }}>
            This is the parser quality board: it shows how much battle data is parsed, what is missing names, and which rows need attention after game updates.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField label="Access token" type="password" size="small" value={token} onChange={(event) => saveToken(event.target.value)} sx={{ minWidth: 300 }} />
            <Button variant="contained" startIcon={<RefreshIcon />} disabled={status === "loading"} onClick={loadDiagnostics}>
              Refresh
            </Button>
            {data ? <Chip label={`${(parseRate * 100).toFixed(1)}% parsed`} color={parseRate > 0.95 ? "success" : "warning"} /> : null}
          </Stack>
        </Paper>

        {status === "loading" ? <LinearProgress /> : null}
        {message ? <Alert severity={status === "error" ? "warning" : "info"}>{message}</Alert> : null}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
          {Object.entries(data?.totals ?? {}).map(([key, value]) => (
            <Paper key={key} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="overline" color="text.secondary">{title(key)}</Typography>
              <Typography variant="h4">{fmt(value)}</Typography>
            </Paper>
          ))}
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Missing Human Text / IDs</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
            {Object.entries(data?.unknowns ?? {}).map(([key, value]) => (
              <Box key={key} sx={{ p: 1.5, border: "1px solid", borderColor: Number(value) > 0 ? "warning.light" : "divider", borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">{title(key)}</Typography>
                <Typography variant="h5">{fmt(value)}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Quality Flags</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {Object.entries(data?.quality ?? {}).map(([key, value]) => (
              <Chip key={key} label={`${title(key)}: ${fmt(value)}`} color={Number(value) > 0 && key !== "scored_rows" ? "warning" : "default"} />
            ))}
          </Stack>
        </Paper>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Parser Version</TableCell>
                <TableCell align="right">Battles</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.parse_versions ?? []).map((row) => (
                <TableRow key={row.parse_version}>
                  <TableCell>{row.parse_version}</TableCell>
                  <TableCell align="right">{fmt(row.battles)}</TableCell>
                </TableRow>
              ))}
              {!data?.parse_versions?.length ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography color="text.secondary">No parser version data loaded yet.</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Recent Parse Errors</TableCell>
                <TableCell>Battle ID</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.recent_errors ?? []).map((row) => (
                <TableRow key={row.event_id}>
                  <TableCell>#{row.event_id}{row.battle_time ? ` · ${new Date(row.battle_time).toLocaleString()}` : ""}</TableCell>
                  <TableCell>{row.battle_id ?? "n/a"}</TableCell>
                  <TableCell>{row.parse_error ?? "Unknown error"}</TableCell>
                </TableRow>
              ))}
              {!data?.recent_errors?.length ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No recent parse errors.</Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Recent Unparsed Events</TableCell>
                <TableCell>Battle ID</TableCell>
                <TableCell>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.recent_unparsed ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>#{row.id}{row.timestamp ? ` · ${new Date(row.timestamp).toLocaleString()}` : ""}</TableCell>
                  <TableCell>{row.battle_id ?? "n/a"}</TableCell>
                  <TableCell>{row.source ?? "unknown"}</TableCell>
                </TableRow>
              ))}
              {!data?.recent_unparsed?.length ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No unparsed events in the recent queue.</Typography>
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
