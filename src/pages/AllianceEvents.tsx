import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Link,
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";





type AllianceEvent = {
  event_id: string;
  source_news_id: string | null;
  source: string;
  event_type: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  url: string | null;
  created_at: string;
  updated_at: string;
  variant_count?: number;
};

type AllianceEventScorePlayer = {
  player_id: string | null;
  player_name: string | null;
  alliance_tag: string | null;
  rank: number | null;
  score: number | null;
  level: number | null;
  ops_level: number | null;
};

type AllianceEventScoreSnapshot = {
  snapshot_id: string;
  alliance_id: string | null;
  event_id: string | null;
  event_title: string | null;
  event_type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  captured_at: string | null;
  source: string | null;
  player_count: number;
  top_score: number | null;
  players: AllianceEventScorePlayer[];
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventSummary(event: AllianceEvent) {
  const lines = [
    `STFC Alliance Event: ${event.title}`,
    event.published_at ? `Published: ${formatDate(event.published_at)}` : null,
    event.starts_at ? `Starts: ${formatDate(event.starts_at)}` : null,
    event.ends_at ? `Ends: ${formatDate(event.ends_at)}` : null,
    event.description ? `Summary: ${event.description}` : null,
    event.url ? `Link: ${event.url}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function formatScore(value: number | null | undefined) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function AllianceEvents() {
  const [accessToken, setAccessToken] = React.useState(() => localStorage.getItem("stfcBattleAccessToken") ?? "");
  const [copyMessage, setCopyMessage] = React.useState<string | undefined>();
  const [lastUpdated, setLastUpdated] = React.useState<Date | undefined>();
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

    const events = useQuery({
        queryKey: ["stfcAllianceEvents", trimmedAccessToken],
        queryFn: async () => {
            if (!trimmedAccessToken) return { events: [] };

            const response = await fetch(`${LOCAL_SYNC_BASE_URL}/alliance-events?limit=200`, {
                headers: {
                    Authorization: `Bearer ${trimmedAccessToken}`,
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load alliance events: ${response.status}`);
            }

            return response.json();
        },
        enabled: !!trimmedAccessToken,
    });

    const scoreSnapshots = useQuery({
        queryKey: ["stfcAllianceEventScores", trimmedAccessToken],
        queryFn: async () => {
            if (!trimmedAccessToken) return { snapshots: [] };

            const response = await fetch(`${LOCAL_SYNC_BASE_URL}/alliance-events/scores?limit=25`, {
                headers: {
                    Authorization: `Bearer ${trimmedAccessToken}`,
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load alliance event scores: ${response.status}`);
            }

            return response.json();
        },
        enabled: !!trimmedAccessToken,
    });

  React.useEffect(() => {
    if ((events.data || scoreSnapshots.data) && !events.isFetching && !scoreSnapshots.isFetching) setLastUpdated(new Date());
  }, [events.data, events.isFetching, scoreSnapshots.data, scoreSnapshots.isFetching]);

  const copyEvent = React.useCallback(async (event: AllianceEvent) => {
    await navigator.clipboard.writeText(eventSummary(event));
    setCopyMessage("Event summary copied");
    window.setTimeout(() => setCopyMessage(undefined), 2500);
  }, []);

  return (
    <Frame title="Alliance Events">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Alliance Events
          </Typography>
          <Typography color="text.secondary">
            STFC Space calendar events combined with any alliance event rows captured from sync payloads.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            label="Access token"
            type="password"
            value={accessToken}
            onChange={(event) => updateAccessToken(event.target.value)}
            size="small"
            sx={{ maxWidth: 520 }}
            fullWidth
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              events.refetch();
              scoreSnapshots.refetch();
            }}
            disabled={!trimmedAccessToken || events.isFetching || scoreSnapshots.isFetching}
          >
            {events.isFetching || scoreSnapshots.isFetching ? "Refreshing..." : "Refresh"}
          </Button>
          {lastUpdated && !events.isFetching && (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
              Updated {lastUpdated.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </Typography>
          )}
        </Stack>

        {copyMessage ? <Alert severity="success">{copyMessage}</Alert> : null}
        {!trimmedAccessToken ? <Alert severity="info">Enter your alliance token to load stored events.</Alert> : null}
        {events.isError ? <Alert severity="error">{events.error instanceof Error ? events.error.message : "Could not load events"}</Alert> : null}
        {scoreSnapshots.isError ? <Alert severity="error">{scoreSnapshots.error instanceof Error ? scoreSnapshots.error.message : "Could not load event scores"}</Alert> : null}

        <Card variant="outlined" sx={{ borderRadius: 1 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">Alliance Score Tracker</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Player score snapshots from captured alliance event leaderboard payloads.
                  </Typography>
                </Box>
                <Chip size="small" label={`${scoreSnapshots.data?.snapshots?.length ?? 0} snapshots`} />
              </Stack>

              {(scoreSnapshots.data?.snapshots ?? []).length ? (
                <Stack spacing={1.5}>
                  {(scoreSnapshots.data.snapshots as AllianceEventScoreSnapshot[]).map((snapshot) => (
                    <Box key={snapshot.snapshot_id} sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
                      <Box sx={{ px: 1.5, py: 1, bgcolor: "action.hover" }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                          <Typography fontWeight={700} sx={{ flexGrow: 1 }}>
                            {snapshot.event_title ?? snapshot.event_id ?? "Alliance Event"}
                          </Typography>
                          {snapshot.captured_at ? <Chip size="small" label={`Captured ${formatDate(snapshot.captured_at)}`} /> : null}
                          <Chip size="small" label={`${snapshot.player_count ?? snapshot.players.length} players`} />
                        </Stack>
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ width: 76 }}>Rank</TableCell>
                              <TableCell>Player</TableCell>
                              <TableCell align="right">Score</TableCell>
                              <TableCell align="right">Ops</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {snapshot.players.slice(0, 10).map((player, index) => (
                              <TableRow key={`${snapshot.snapshot_id}-${player.player_id ?? player.player_name ?? index}`}>
                                <TableCell>{player.rank ?? index + 1}</TableCell>
                                <TableCell>
                                  {player.alliance_tag ? `[${player.alliance_tag}] ` : ""}
                                  {player.player_name ?? player.player_id ?? "Unknown"}
                                </TableCell>
                                <TableCell align="right">{formatScore(player.score)}</TableCell>
                                <TableCell align="right">{player.ops_level ?? player.level ?? "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">
                  No score snapshots are stored yet. The tracker is ready for payloads shaped like <code>type: alliance_event_scores</code> with an event and players list.
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={1.5}>
          {(events.data?.events ?? []).map((event) => (
            <Card key={event.event_id} variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {event.title}
                    </Typography>
                    <Chip size="small" label={event.source.replace(/_/g, " ")} />
                    {Number(event.variant_count) > 1 ? (
                      <Chip size="small" label={`${event.variant_count} variants`} />
                    ) : null}
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {event.published_at ? <Chip size="small" label={`Published ${formatDate(event.published_at)}`} /> : null}
                    {event.starts_at ? <Chip size="small" label={`Starts ${formatDate(event.starts_at)}`} /> : null}
                    {event.ends_at ? <Chip size="small" label={`Ends ${formatDate(event.ends_at)}`} /> : null}
                  </Stack>

                  {event.description ? (
                    <Typography color="text.secondary">
                      {event.description}
                    </Typography>
                  ) : null}

                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => copyEvent(event)}
                    >
                      Copy
                    </Button>
                    {event.url ? (
                      <Button size="small" component={Link} href={event.url} target="_blank" rel="noreferrer">
                        Open
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {trimmedAccessToken && !events.isLoading && !events.data?.events?.length ? (
          <Alert severity="info">
            No event calendar rows are available yet. Run the game-data update to refresh the STFC Space 30-day event scrape.
          </Alert>
        ) : null}
      </Stack>
    </Frame>
  );
}
