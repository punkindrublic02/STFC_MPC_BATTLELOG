import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
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

type CrewResult = {
  comparison_key: string;
  battle_type: string | null;
  encounter_family: string | null;
  target_family: string | null;
  solo_or_group: string | null;
  ship_name: string | null;
  ship_level: number | null;
  fleet_grade: number | null;
  opponent_name: string | null;
  opponent_ship_name: string | null;
  opponent_ship_level: number | null;
  captain: string | null;
  bridge_officers: string | null;
  battles: number;
  player_count: number;
  avg_rounds: number | null;
  avg_damage_dealt_per_round: number | null;
  avg_damage_taken_per_round: number | null;
  avg_damage_exchange_ratio: number | null;
  avg_overall_mitigation_pct: number | null;
  avg_iso_mitigation_pct: number | null;
  avg_apex_mitigation_pct: number | null;
  avg_crit_rate_dealt: number | null;
  avg_hull_repair_per_round: number | null;
  avg_encounter_score: number | null;
  score_basis: string | null;
};

type BattleStatsFilters = {
  encounter: string;
  target: string;
  ship: string;
  search: string;
  days: string;
};

function compact(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  if (Math.abs(number) >= 1_000_000_000_000) return `${(number / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(number) >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return number.toFixed(Math.abs(number) < 10 ? 2 : 0);
}

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "n/a";
}

function crewLabel(result: CrewResult) {
  const crew = [result.captain, result.bridge_officers].filter(Boolean).join(" / ");
  return crew || "Unknown crew";
}

export function BattleStats() {
  const [accessToken, setAccessToken] = React.useState(() => localStorage.getItem("stfcBattleAccessToken") ?? "");
  const [encounter, setEncounter] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [ship, setShip] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [days, setDays] = React.useState("14");
  const [appliedFilters, setAppliedFilters] = React.useState<BattleStatsFilters | null>(null);
  const trimmedAccessToken = accessToken.trim();

  const updateAccessToken = React.useCallback((value: string) => {
    setAccessToken(value);
    const trimmed = value.trim();
    if (trimmed) {
      localStorage.setItem("stfcBattleAccessToken", trimmed);
    } else {
      localStorage.removeItem("stfcBattleAccessToken");
    }
  }, []);

  const stats = useQuery({
    queryKey: ["battle-stats", trimmedAccessToken, appliedFilters],
    queryFn: async () => {
      const filters = appliedFilters ?? { encounter: "", target: "", ship: "", search: "", days: "14" };
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("days", filters.days || "14");
      if (filters.encounter) params.set("encounter", filters.encounter);
      if (filters.target) params.set("target", filters.target);
      if (filters.ship) params.set("ship", filters.ship);
      if (filters.search) params.set("search", filters.search);

      const res = await fetch(`${LOCAL_SYNC_BASE_URL}/stats/crew-results?${params.toString()}`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Enter a valid access token to load battle stats");
        }
        if (res.status === 404) {
          throw new Error("Battle stats API route was not found. Restart the local-sync API so /stats/crew-results is loaded.");
        }
        throw new Error(`Could not load battle stats: ${res.status}`);
      }
      return await res.json() as { count: number; results: CrewResult[] };
    },
    enabled: !!trimmedAccessToken && !!appliedFilters,
  });

  const applyFilters = React.useCallback(() => {
    setAppliedFilters({
      encounter,
      target: target.trim(),
      ship: ship.trim(),
      search: search.trim(),
      days,
    });
  }, [days, encounter, search, ship, target]);

  return (
    <Frame title="Battle Stats">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Battle Stats
          </Typography>
          <Typography color="text.secondary">
            Crew and encounter results calculated from parsed battle logs, repairs, damage, crits, and mitigation rows.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
          <TextField
            label="Access token"
            type="password"
            value={accessToken}
            onChange={(event) => updateAccessToken(event.target.value)}
            size="small"
            sx={{ minWidth: 260 }}
          />
          <TextField
            label="Encounter"
            size="small"
            select
            value={encounter}
            onChange={(event) => setEncounter(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="hostile">Hostile</MenuItem>
            <MenuItem value="armada">Armada</MenuItem>
            <MenuItem value="pvp">PvP</MenuItem>
            <MenuItem value="outpost">Outpost</MenuItem>
          </TextField>
          <TextField label="Target family" size="small" value={target} onChange={(event) => setTarget(event.target.value)} />
          <TextField label="Ship" size="small" value={ship} onChange={(event) => setShip(event.target.value)} />
          <TextField label="Search crew/player" size="small" value={search} onChange={(event) => setSearch(event.target.value)} />
          <TextField
            label="Window"
            size="small"
            select
            value={days}
            onChange={(event) => setDays(event.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="7">7 days</MenuItem>
            <MenuItem value="14">14 days</MenuItem>
            <MenuItem value="30">30 days</MenuItem>
            <MenuItem value="90">90 days</MenuItem>
            <MenuItem value="0">All time</MenuItem>
          </TextField>
          <Button
            variant="contained"
            onClick={applyFilters}
            disabled={!trimmedAccessToken || stats.isFetching}
          >
            Load Results
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => stats.refetch()}
            disabled={!trimmedAccessToken || !appliedFilters || stats.isFetching}
          >
            Refresh
          </Button>
        </Stack>

        {!trimmedAccessToken ? <Alert severity="info">Enter your alliance token to load battle-log stats.</Alert> : null}
        {trimmedAccessToken && !appliedFilters ? (
          <Alert severity="info">
            Battle Stats is an advanced rollup. It loads a recent window by default; use 30/90 days only for deeper audits.
          </Alert>
        ) : null}
        {stats.isError ? <Alert severity="error">{stats.error instanceof Error ? stats.error.message : "Could not load battle stats"}</Alert> : null}
        {stats.isFetching ? <LinearProgress /> : null}

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Crew</TableCell>
                <TableCell>Context</TableCell>
                <TableCell align="right">Battles</TableCell>
                <TableCell align="right">Rounds</TableCell>
                <TableCell align="right">Dmg/R</TableCell>
                <TableCell align="right">Taken/R</TableCell>
                <TableCell align="right">Trade</TableCell>
                <TableCell align="right">Crit</TableCell>
                <TableCell align="right">Mit</TableCell>
                <TableCell align="right">Repair/R</TableCell>
                <TableCell align="right">Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(stats.data?.results ?? []).map((result) => (
                <TableRow key={result.comparison_key} hover>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {crewLabel(result)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {result.ship_name || "Unknown ship"}
                      {result.ship_level ? ` L${result.ship_level}` : ""}
                      {result.fleet_grade ? ` G${result.fleet_grade}` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      <Chip size="small" label={result.battle_type || "unknown"} />
                      {result.target_family ? <Chip size="small" label={result.target_family} /> : null}
                      {result.solo_or_group ? <Chip size="small" label={result.solo_or_group} /> : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      vs {result.opponent_ship_name || result.opponent_name || "unknown"}
                      {result.opponent_ship_level ? ` L${result.opponent_ship_level}` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{result.battles}</TableCell>
                  <TableCell align="right">{compact(result.avg_rounds)}</TableCell>
                  <TableCell align="right">{compact(result.avg_damage_dealt_per_round)}</TableCell>
                  <TableCell align="right">{compact(result.avg_damage_taken_per_round)}</TableCell>
                  <TableCell align="right">{compact(result.avg_damage_exchange_ratio)}</TableCell>
                  <TableCell align="right">{percent(result.avg_crit_rate_dealt)}</TableCell>
                  <TableCell align="right">{percent(result.avg_overall_mitigation_pct)}</TableCell>
                  <TableCell align="right">{compact(result.avg_hull_repair_per_round)}</TableCell>
                  <TableCell align="right">{compact(result.avg_encounter_score)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {trimmedAccessToken && appliedFilters && !stats.isLoading && !stats.data?.results?.length ? (
          <Alert severity="info">No battle-log stats matched those filters.</Alert>
        ) : null}
      </Stack>
    </Frame>
  );
}
