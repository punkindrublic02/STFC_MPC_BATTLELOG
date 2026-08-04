import * as React from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import ScienceIcon from "@mui/icons-material/Science";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

const TOKEN_KEY = "stfcBattleAccessToken";

type BattleInsightResponse = {
  mode?: "scored" | "parsed_only";
  data_quality?: {
    scored_evidence_available?: boolean;
    parsed_text_available?: boolean;
    warning?: string | null;
  };
  battle_facts: Record<string, any>;
  historical_context: Record<string, any>;
  interpretation: {
    drivers: string[];
    unusually_good: boolean;
    likely_variance: boolean;
  };
  recommendation: {
    summary: string;
    next_test: string[];
    hold_constant: string[];
  };
};

function compactNumber(value: unknown, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return Intl.NumberFormat(undefined, {
    notation: Math.abs(number) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(number);
}

function pct(value: unknown, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : "n/a";
}

function signedPct(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function signedPoints(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${number > 0 ? "+" : ""}${(number * 100).toFixed(1)} pts`;
}

function shortText(value: unknown, limit = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function confidenceColor(value: string) {
  if (value === "high") return "success";
  if (value === "medium") return "warning";
  return "default";
}

export function BattleInsight() {
  const { id } = useParams();
  const [accessToken, setAccessToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [copyMessage, setCopyMessage] = React.useState<string | undefined>();
  const trimmedAccessToken = accessToken.trim();

  const updateAccessToken = React.useCallback((value: string) => {
    setAccessToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const insight = useQuery({
    queryKey: ["battle-insight", id, trimmedAccessToken],
    queryFn: async () => {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battles/${encodeURIComponent(String(id))}/insights`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!response.ok) {
        throw new Error(response.status === 404
          ? "Battle ID was not found for this token."
          : response.status === 401 || response.status === 403
            ? "Enter a valid access token to load this insight."
            : `Could not load battle insight: ${response.status}`);
      }
      return response.json() as Promise<BattleInsightResponse>;
    },
    enabled: !!id && !!trimmedAccessToken,
  });

  const facts = insight.data?.battle_facts;
  const history = insight.data?.historical_context;
  const evidence = facts?.evidence ?? {};
  const deltas = history?.deltas_vs_cohort ?? {};
  const scoreRank = history?.rank?.score ?? {};
  const hullRank = history?.rank?.hull_efficiency ?? {};
  const aiFactPrompt = React.useMemo(() => {
    if (!facts) return "";
    const compact = {
      mode: insight.data?.mode ?? "unknown",
      data_quality: insight.data?.data_quality ?? {},
      battle_facts: facts,
      historical_context: history,
      interpretation: insight.data?.interpretation,
      recommendation: insight.data?.recommendation,
    };
    return [
      "Use STFC battle-log facts only. Do not guess hidden stats or game mechanics that are not supported by the data.",
      "If the packet says parsed_only, answer only from parsed facts and say that historical scoring is unavailable.",
      "If scored evidence exists, explain the battle facts, historical comparison, confidence, and one controlled test to run next.",
      "",
      "Battle fact packet:",
      JSON.stringify(compact, null, 2),
    ].join("\n");
  }, [facts, history, insight.data]);

  const copyAiFactPrompt = React.useCallback(async () => {
    if (!aiFactPrompt) return;
    await navigator.clipboard.writeText(aiFactPrompt);
    setCopyMessage("AI fact prompt copied");
    window.setTimeout(() => setCopyMessage(undefined), 2500);
  }, [aiFactPrompt]);

  return (
    <Frame title="Battle Insight">
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" gutterBottom>
              Battle Insight
            </Typography>
            <Typography color="text.secondary">
              Compares one battle against your stored history and suggests the next controlled test.
            </Typography>
          </Box>
          <Button component={RouterLink} to="/my-battles" startIcon={<ArrowBackIcon />} variant="outlined">
            My Battles
          </Button>
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Access token"
            type="password"
            value={accessToken}
            onChange={(event) => updateAccessToken(event.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => insight.refetch()}
            disabled={!trimmedAccessToken || insight.isFetching}
          >
            Refresh
          </Button>
          <Button
            component={RouterLink}
            to={`/combatlog/${encodeURIComponent(String(id ?? ""))}`}
            variant="text"
          >
            Parsed Details
          </Button>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={copyAiFactPrompt}
            disabled={!aiFactPrompt}
          >
            Copy AI Facts
          </Button>
        </Stack>

        {!trimmedAccessToken ? <Alert severity="info">Enter your access token to load this battle insight.</Alert> : null}
        {copyMessage ? <Alert severity="success">{copyMessage}</Alert> : null}
        {insight.isFetching ? <LinearProgress /> : null}
        {insight.isError ? <Alert severity="error">{insight.error instanceof Error ? insight.error.message : "Could not load insight"}</Alert> : null}
        {insight.data?.data_quality?.warning ? <Alert severity="warning">{insight.data.data_quality.warning}</Alert> : null}

        {facts ? (
          <>
            <Card variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6">
                        {facts.player_name ?? "Unknown player"} · {facts.ship_name ?? "Unknown ship"}{facts.ship_level ? ` L${facts.ship_level}` : ""} vs {facts.target_family ?? "Unknown target"}{facts.target_level ? ` L${facts.target_level}` : ""}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Battle #{facts.event_id}{facts.battle_time ? ` · ${new Date(facts.battle_time).toLocaleString()}` : ""}
                      </Typography>
                    </Box>
                    <Chip size="small" color={insight.data?.mode === "scored" ? "success" : "warning"} label={insight.data?.mode === "scored" ? "scored evidence" : "parsed facts only"} />
                    <Chip size="small" label={facts.battle_type ?? facts.encounter_family ?? "unknown"} />
                    <Chip size="small" label={`${facts.rounds ?? "?"} rounds`} />
                  </Stack>

                  <Typography variant="body2">{facts.crew?.label ?? "Crew not resolved"}</Typography>

                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Damage dealt" value={compactNumber(facts.damage_dealt)} /></Grid>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Damage taken" value={compactNumber(facts.damage_taken)} /></Grid>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Net hull loss" value={compactNumber(facts.net_hull_damage_after_repairs)} /></Grid>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Exchange" value={compactNumber(facts.exchange_ratio)} /></Grid>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Mitigation" value={pct(facts.mitigation_pct)} /></Grid>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Crit rate" value={pct(facts.crit_rate)} /></Grid>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Repair / round" value={compactNumber(facts.repair_per_round)} /></Grid>
                    <Grid size={{ xs: 6, md: 3 }}><Metric label="Score" value={compactNumber(facts.encounter_score)} /></Grid>
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <Card variant="outlined" sx={{ borderRadius: 1, height: "100%" }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h6">Historical Context</Typography>
                        <Chip size="small" color={confidenceColor(history?.confidence ?? "low") as any} label={`${history?.confidence ?? "low"} confidence`} />
                        <Chip size="small" label={`${history?.cohort?.sample_size ?? 0} comparable`} />
                        <Chip size="small" label={`${history?.exact_crew?.sample_size ?? 0} exact crew`} />
                      </Stack>
                      <Alert severity={insight.data?.interpretation.unusually_good ? "success" : "info"}>
                        Score rank {scoreRank.rank ?? "n/a"} of {scoreRank.sample_size ?? 0}; hull efficiency rank {hullRank.rank ?? "n/a"} of {hullRank.sample_size ?? 0}.
                      </Alert>
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 6, md: 3 }}><Metric label="Damage / round" value={signedPct(deltas.damage_per_round_pct)} /></Grid>
                        <Grid size={{ xs: 6, md: 3 }}><Metric label="Net hull loss" value={signedPct(deltas.net_hull_damage_pct)} /></Grid>
                        <Grid size={{ xs: 6, md: 3 }}><Metric label="Mitigation" value={signedPoints(deltas.mitigation_points)} /></Grid>
                        <Grid size={{ xs: 6, md: 3 }}><Metric label="Crit rate" value={signedPoints(deltas.crit_rate_points)} /></Grid>
                      </Grid>
                      <Divider />
                      <Stack spacing={0.75}>
                        {(insight.data?.interpretation.drivers ?? []).map((driver) => (
                          <Typography key={driver} variant="body2">- {driver}</Typography>
                        ))}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Card variant="outlined" sx={{ borderRadius: 1, height: "100%" }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ScienceIcon fontSize="small" />
                        <Typography variant="h6">Recommendation</Typography>
                      </Stack>
                      <Alert severity={insight.data?.interpretation.likely_variance ? "warning" : "success"}>
                        {insight.data?.recommendation.summary}
                      </Alert>
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Next controlled test</Typography>
                        <Stack spacing={0.75}>
                          {(insight.data?.recommendation.next_test ?? []).map((item) => (
                            <Typography key={item} variant="body2">- {item}</Typography>
                          ))}
                        </Stack>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>Hold constant</Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          {(insight.data?.recommendation.hold_constant ?? []).map((item) => (
                            <Chip key={item} size="small" label={item} />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <EvidenceCard title="Officer Ability Activity" emptyText="No officer ability trigger rows were captured for this battle.">
                  {(evidence.officer_triggers ?? []).map((row: any, index: number) => (
                    <Stack key={`${row.officer_id}-${row.ability_id}-${index}`} spacing={0.5} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle2">{row.officer_name ?? `Officer ${row.officer_id ?? "unknown"}`}</Typography>
                        <Chip size="small" label={row.ability_name ?? `Ability ${row.ability_id ?? "unknown"}`} />
                        <Chip size="small" label={`${row.trigger_count ?? 0}x`} />
                        {row.first_trigger_round ? <Chip size="small" label={`R${row.first_trigger_round}-${row.last_trigger_round ?? row.first_trigger_round}`} /> : null}
                      </Stack>
                      {row.effect_tags?.length ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {row.effect_tags.map((tag: string) => <Chip key={tag} size="small" variant="outlined" label={tag.replace(/_/g, " ")} />)}
                        </Stack>
                      ) : null}
                      {row.ability_text ? <Typography variant="caption" color="text.secondary">{shortText(row.ability_text)}</Typography> : null}
                    </Stack>
                  ))}
                </EvidenceCard>
              </Grid>

              <Grid size={{ xs: 12, lg: 6 }}>
                <EvidenceCard title="Status And Effect Coverage" emptyText="No status/effect events were decoded for this battle.">
                  {(evidence.status_effects ?? []).map((row: any, index: number) => (
                    <Stack key={`${row.officer_id}-${row.ability_id}-${index}`} spacing={0.5} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle2">{row.officer_name ?? `Officer ${row.officer_id ?? "unknown"}`}</Typography>
                        <Chip size="small" label={row.ability_name ?? `Ability ${row.ability_id ?? "unknown"}`} />
                        <Chip size="small" label={`${row.active_rounds ?? 0} active rounds`} />
                        <Chip size="small" label={`${pct(row.estimated_round_coverage_pct)} est. coverage`} />
                      </Stack>
                      {row.effect_tags?.length ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {row.effect_tags.map((tag: string) => <Chip key={tag} size="small" variant="outlined" label={tag.replace(/_/g, " ")} />)}
                        </Stack>
                      ) : null}
                    </Stack>
                  ))}
                </EvidenceCard>
              </Grid>
            </Grid>

            <EvidenceCard title="Reputation And Rewards" emptyText="No reputation reward rows were captured for this battle.">
              {(evidence.reputation_rewards ?? []).map((row: any, index: number) => (
                <Box key={`${row.resource_id}-${index}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 140px 120px" }, gap: 1, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Typography variant="body2">{row.faction_name ?? row.resource_name ?? row.name}</Typography>
                  <Typography variant="body2">{row.direction ?? "delta"}</Typography>
                  <Typography variant="body2">{compactNumber(row.amount)}</Typography>
                </Box>
              ))}
            </EvidenceCard>

            <Card variant="outlined" sx={{ borderRadius: 1 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Best Similar Results</Typography>
                <Stack spacing={1}>
                  {(history?.best_similar ?? []).map((row: any) => (
                    <Box key={row.event_id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "120px 1fr 120px 120px" }, gap: 1, alignItems: "center" }}>
                      <Button component={RouterLink} to={`/battle-insights/${row.event_id}`} size="small">
                        #{row.event_id}
                      </Button>
                      <Typography variant="body2">{row.crew}</Typography>
                      <Typography variant="body2">Score {compactNumber(row.score)}</Typography>
                      <Typography variant="body2">Hull {compactNumber(row.net_hull_damage_after_repairs)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>
    </Frame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1, minHeight: 68 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1">
        {value}
      </Typography>
    </Box>
  );
}

function EvidenceCard({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode[] | React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Card variant="outlined" sx={{ borderRadius: 1, height: "100%" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        {items.length ? items : <Typography variant="body2" color="text.secondary">{emptyText}</Typography>}
      </CardContent>
    </Card>
  );
}
