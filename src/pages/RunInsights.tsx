import * as React from "react";
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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";

import { Frame } from "../components/Frame";
import { GameAssetAvatar } from "../components/GameAssetAvatar";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";
import type { GameData } from "../combatlog/util/gameData";
import { resolveOfficerAsset, resolveShipAsset } from "../util/gameAssets";

type BattleRun = {
  run_id: string;
  crew_fingerprint_id: string;
  crew_label: string;
  bridge_officers: string;
  below_deck_officers: string;
  player_name: string;
  ship_name: string;
  ship_level: number | null;
  fleet_grade: number | null;
  battle_type: string | null;
  target_family: string | null;
  target_level: number | null;
  first_seen: string | null;
  last_seen: string | null;
  battles: number;
  avg_rounds: number | null;
  avg_damage_dealt: number | null;
  avg_damage_taken: number | null;
  avg_net_hull_damage_after_repairs: number | null;
  avg_player_final_hhp: number | null;
  win_count: number;
  loss_count: number;
  death_count: number;
  target_killed_count: number;
  win_rate: number | null;
  survival_rate: number | null;
  avg_damage_exchange_ratio: number | null;
  avg_mitigation_pct: number | null;
  avg_crit_rate: number | null;
  avg_hull_repair_per_round: number | null;
  avg_encounter_score: number | null;
  score_basis: string | null;
  confidence: "low" | "medium" | "high";
  quality_warnings: string[];
  what_changed: string[];
  previous_run: null | {
    crew_label: string;
    battles: number;
    avg_rounds_delta_pct: number | null;
    avg_net_hull_damage_delta_pct: number | null;
    avg_score_delta_pct: number | null;
    win_rate_delta_pct: number | null;
    survival_rate_delta_pct: number | null;
    loss_count: number;
    death_count: number;
  };
  estimated_kills_remaining: null | {
    expected: number;
    conservative: number;
    basis: string;
  };
};

type RunInsightFilters = {
  search: string;
  target: string;
  ship: string;
  days: string;
};

type EvidenceLevel = "very low" | "low" | "medium" | "high";

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactNumber(value: number | null, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}

function pct(value: number | null, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

function signedPct(value: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function confidenceColor(value: BattleRun["confidence"]) {
  if (value === "high") return "success";
  if (value === "medium") return "warning";
  return "default";
}

function evidenceColor(value: EvidenceLevel) {
  if (value === "high") return "success";
  if (value === "medium") return "warning";
  if (value === "low") return "default";
  return "error";
}

function runReliability(run: BattleRun): { level: EvidenceLevel; reason: string } {
  if (run.battles <= 1) return { level: "very low", reason: "single battle observation" };
  if (run.battles < 5) return { level: "low", reason: `${run.battles} battles; useful for spotting a pattern only` };
  if (run.battles < 15) return { level: "medium", reason: `${run.battles} battles in this run` };
  return { level: "high", reason: `${run.battles} battles in this run` };
}

function comparisonConfidence(run: BattleRun): { level: EvidenceLevel; reason: string } {
  if (!run.previous_run) return { level: "very low", reason: "no previous matched run to compare" };
  const smallerSample = Math.min(run.battles, run.previous_run.battles);
  if (smallerSample <= 1) return { level: "very low", reason: `${run.battles} vs ${run.previous_run.battles} battles; too thin to recommend` };
  if (smallerSample < 5) return { level: "low", reason: `${run.battles} vs ${run.previous_run.battles} battles` };
  if (smallerSample < 15) return { level: "medium", reason: `${run.battles} vs ${run.previous_run.battles} battles in a matched cohort` };
  return { level: "high", reason: `${run.battles} vs ${run.previous_run.battles} battles in a matched cohort` };
}

function runCategory(run: BattleRun) {
  if (run.battles <= 1) return "Preliminary observation";
  if (run.previous_run) return "Matched comparison";
  if (run.battles >= 10) return "Established baseline";
  return "Baseline building";
}

function signedDelta(value: number | null, direction: "higher" | "lower") {
  const formatted = signedPct(value);
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { label: formatted, good: false };
  }
  const good = direction === "higher" ? value > 0 : value < 0;
  return { label: formatted, good };
}

function killEstimateLabel(value: number) {
  if (value >= 1000) return "1,000+";
  if (value >= 750) return `${Math.round(value)}+`;
  return String(Math.round(value));
}

function scoreBasisText(run: BattleRun) {
  if (run.battle_type === "hostile" || !run.battle_type) {
    return "Combat-efficiency score combines damage per attack, trade ratio, crit rate, ISO mitigation, repair per round, and damage taken per round.";
  }
  return run.score_basis || "Combat-efficiency score is weighted for this encounter type.";
}

function grindingScore(run: BattleRun) {
  const combatScore = Number(run.avg_encounter_score ?? 0);
  const rounds = Number(run.avg_rounds ?? 99);
  const netHull = Math.max(0, Number(run.avg_net_hull_damage_after_repairs ?? run.avg_damage_taken ?? 0));
  const trade = Number(run.avg_damage_exchange_ratio ?? 0);
  const survival = Number(run.survival_rate ?? run.win_rate ?? 0);
  const failurePenalty = run.loss_count > 0 || run.death_count > 0 ? 10_000 : 0;
  const sampleBonus = Math.min(120, Math.log10(Math.max(1, run.battles)) * 60);
  const survivalBonus = Number.isFinite(survival) ? survival * 800 : 0;
  const speedBonus = Number.isFinite(rounds) && rounds > 0 ? Math.min(80, 120 / rounds) : 0;
  const hullPenalty = Number.isFinite(netHull) ? Math.log10(netHull + 1) * 85 : 0;
  const tradeBonus = Number.isFinite(trade) ? Math.min(80, Math.log10(Math.max(1, trade)) * 20) : 0;
  const combatBonus = Number.isFinite(combatScore) ? Math.min(80, Math.max(-80, combatScore / 5000)) : 0;
  return survivalBonus + sampleBonus + speedBonus + tradeBonus + combatBonus - hullPenalty - failurePenalty;
}

function grindComparisonScore(run: BattleRun) {
  if (!run.previous_run) return grindingScore(run);
  const hull = run.previous_run.avg_net_hull_damage_delta_pct ?? 0;
  const rounds = run.previous_run.avg_rounds_delta_pct ?? 0;
  const score = run.previous_run.avg_score_delta_pct ?? 0;
  const survival = run.previous_run.survival_rate_delta_pct ?? run.previous_run.win_rate_delta_pct ?? 0;
  const failurePenalty = runHasFailure(run) ? 10_000 : 0;

  // For farming, net hull spent per successful kill is the primary signal.
  // Speed and combat score are tie-breakers only when hull efficiency is close.
  return (-hull * 12) + (survival * 6) + (-rounds * 1.5) + (score * 0.5) - failurePenalty;
}

function runHasFailure(run: BattleRun) {
  return run.loss_count > 0 || run.death_count > 0 || (run.win_rate !== null && run.win_rate < 0.999);
}

function failureText(run: BattleRun) {
  const parts = [];
  if (run.loss_count > 0) parts.push(`${run.loss_count} loss${run.loss_count === 1 ? "" : "es"}`);
  if (run.death_count > 0) parts.push(`${run.death_count} ship destruction${run.death_count === 1 ? "" : "s"}`);
  if (!parts.length && run.win_rate !== null && run.win_rate < 0.999) parts.push(`${pct(run.win_rate)} win rate`);
  return parts.join(", ");
}

function betterForGrinding(run: BattleRun) {
  if (!run.previous_run) return null;
  if (runHasFailure(run)) return "worse";
  const hull = run.previous_run.avg_net_hull_damage_delta_pct;
  const rounds = run.previous_run.avg_rounds_delta_pct;
  const score = run.previous_run.avg_score_delta_pct;
  const hullBetter = hull !== null && hull < -8;
  const hullWorse = hull !== null && hull > 8;
  const hullMuchWorse = hull !== null && hull > 20;
  const hullClose = hull === null || Math.abs(hull) <= 8;
  const roundsBetter = rounds !== null && rounds < -10;
  const roundsWorse = rounds !== null && rounds > 10;
  const scoreBetter = score !== null && score > 10;
  const scoreWorse = score !== null && score < -10;

  if (hullBetter) return "better";
  if (hullMuchWorse) return "worse";
  if (hullWorse && (!roundsBetter || scoreWorse)) return "worse";
  if (hullWorse) return "worse";
  if (hullClose && roundsBetter && scoreBetter) return "better";
  if (hullClose && roundsWorse && scoreWorse) return "worse";
  return "close";
}

function grindingReason(run: BattleRun) {
  if (!run.previous_run) {
    if (runHasFailure(run)) return `Unsafe baseline: ${failureText(run)}. Do not use this as a farming recommendation.`;
    return `Baseline from ${run.battles} battles. Use it as a control before calling it best.`;
  }
  if (runHasFailure(run)) {
    return `Not recommended for grinding: ${failureText(run)} in this run. Survival beats speed and score.`;
  }
  const verdict = betterForGrinding(run);
  const hull = signedPct(run.previous_run.avg_net_hull_damage_delta_pct);
  const rounds = signedPct(run.previous_run.avg_rounds_delta_pct);
  const score = signedPct(run.previous_run.avg_score_delta_pct);
  if (verdict === "better") return `Best grinding signal: net hull per kill ${hull}. Speed ${rounds} and combat score ${score} are supporting details only.`;
  if (verdict === "worse") return `Worse grind signal: net hull per kill ${hull}. A faster kill does not help if it burns meaningfully more hull.`;
  return `Close grind result: net hull per kill ${hull}, speed ${rounds}, combat score ${score}. More same-target battles needed.`;
}

function compactRunForAi(run: BattleRun) {
  return {
    finding: resultHeadline(run),
    target: targetLabel(run),
    comparison_type: comparisonType(run),
    takeaway: takeawayText(run),
    changed: changedText(run),
    current_crew: crewDetails(run.crew_label),
    previous_crew: run.previous_run ? crewDetails(run.previous_run.crew_label) : null,
    sample: {
      current_battles: run.battles,
      previous_battles: run.previous_run?.battles ?? null,
      run_reliability: runReliability(run),
      comparison_confidence: comparisonConfidence(run),
    },
    metrics: {
      avg_rounds: run.avg_rounds,
      avg_net_hull_damage_after_repairs: run.avg_net_hull_damage_after_repairs,
      win_rate: run.win_rate,
      survival_rate: run.survival_rate,
      losses: run.loss_count,
      deaths: run.death_count,
      avg_damage_dealt: run.avg_damage_dealt,
      avg_damage_taken: run.avg_damage_taken,
      avg_damage_exchange_ratio: run.avg_damage_exchange_ratio,
      avg_mitigation_pct: run.avg_mitigation_pct,
      avg_crit_rate: run.avg_crit_rate,
      avg_hull_repair_per_round: run.avg_hull_repair_per_round,
      combat_efficiency_score: run.avg_encounter_score,
    },
    deltas_pct: run.previous_run
      ? {
          rounds: run.previous_run.avg_rounds_delta_pct,
          net_hull_damage_after_repairs: run.previous_run.avg_net_hull_damage_delta_pct,
          combat_efficiency_score: run.previous_run.avg_score_delta_pct,
        }
      : null,
    warnings: run.quality_warnings,
  };
}

function buildRunInsightsAiContext(runs: BattleRun[], filters: RunInsightFilters | null) {
  const matched = runs
    .filter((run) => run.previous_run)
    .map((run) => ({ run, confidence: comparisonConfidence(run) }))
    .sort((a, b) => {
      const aFailurePenalty = runHasFailure(a.run) ? 10_000 : 0;
      const bFailurePenalty = runHasFailure(b.run) ? 10_000 : 0;
      const aScore = grindComparisonScore(a.run) - aFailurePenalty;
      const bScore = grindComparisonScore(b.run) - bFailurePenalty;
      return bScore - aScore;
    });
  const supported = matched.filter(({ run, confidence }) => !runHasFailure(run) && (confidence.level === "medium" || confidence.level === "high")).slice(0, 5);
  const unsafe = matched.filter(({ run }) => runHasFailure(run)).slice(0, 5);
  const baselines = runs.filter((run) => !run.previous_run && run.battles > 1 && !runHasFailure(run)).slice(0, 5);

  return {
    filters,
    summary: {
      total_runs_loaded: runs.length,
      matched_comparisons: matched.length,
      baselines: runs.filter((run) => !run.previous_run && run.battles > 1).length,
      preliminary: runs.filter((run) => run.battles <= 1).length,
    },
    supported_findings: supported.map(({ run }) => compactRunForAi(run)),
    unsafe_findings: unsafe.map(({ run }) => compactRunForAi(run)),
    baseline_runs: baselines.map(compactRunForAi),
    instruction:
      "Use only this compact observed run evidence. For grinding, prioritize successful kill and survival first, then net hull consumed per successful kill, then sample size and consistency. Treat rounds and combat-efficiency score as secondary tie-breakers only. Never recommend unsafe_findings for grinding. Explain the strongest supported finding, survival tradeoffs, confidence, and the next controlled test.",
  };
}

function targetLabel(run: BattleRun) {
  return `${run.ship_name}${run.ship_level ? ` L${run.ship_level}` : ""} vs ${run.target_family ?? "Unknown target"}${run.target_level ? ` L${run.target_level}` : ""}`;
}

function crewDisplayName(label: string) {
  const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return label.split("|")[0]?.trim() || label;
}

function crewDetails(label: string) {
  const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 4) {
    return {
      ship: parts[0],
      captain: parts[1],
      bridge: parts[2],
      belowDeck: parts.slice(3).join(" / "),
    };
  }
  return {
    ship: "",
    captain: crewDisplayName(label),
    bridge: label,
    belowDeck: "",
  };
}

function comparisonType(run: BattleRun) {
  if (!run.previous_run) return "New baseline";
  const changeCount = run.what_changed.filter((item) => !/same crew/i.test(item)).length;
  if (run.battles <= 1 || run.previous_run.battles <= 1) return "Preliminary comparison";
  if (changeCount === 1) return "Matched crew-slot test";
  if (changeCount > 1 && run.what_changed.some((item) => /bridge/i.test(item))) return "Matched bridge-crew comparison";
  if (changeCount > 1) return "Full crew comparison";
  return "Comparable historical run";
}

function changedText(run: BattleRun) {
  const changes = run.what_changed.filter((item) => !/same crew/i.test(item));
  if (!run.previous_run) return "No prior matched run is available.";
  if (!changes.length) return "Same crew fingerprint; this run was separated by time, target context, or ingest grouping.";
  return changes.join("; ");
}

function resultHeadline(run: BattleRun) {
  const current = crewDisplayName(run.crew_label);
  if (runHasFailure(run)) return `${current} failed the survival check`;
  if (!run.previous_run) return `${current} established a new baseline`;
  const previous = crewDisplayName(run.previous_run.crew_label);
  const hull = run.previous_run.avg_net_hull_damage_delta_pct;
  const rounds = run.previous_run.avg_rounds_delta_pct;
  const score = run.previous_run.avg_score_delta_pct;
  const hullBetter = hull !== null && hull < -5;
  const hullWorse = hull !== null && hull > 5;
  const faster = rounds !== null && rounds < -5;
  const slower = rounds !== null && rounds > 5;
  const scoreBetter = score !== null && score > 10;
  const scoreWorse = score !== null && score < -5;

  if (hullBetter && faster) return `${current} used less hull per kill and was faster than ${previous}`;
  if (hullBetter && slower) return `${current} preserved more hull than ${previous}, but took longer`;
  if (hullWorse && faster) return `${current} killed faster but burned more hull than ${previous}`;
  if (hullWorse) return `${current} consumed more hull per kill than ${previous}`;
  if (scoreBetter && !hullWorse) return `${current} had a higher combat score with similar hull cost than ${previous}`;
  if (hullBetter) return `${current} improved hull efficiency versus ${previous}`;
  if (faster) return `${current} improved kill speed versus ${previous}`;
  if (scoreWorse) return `${current} had a lower combat score than ${previous}`;
  return `${current} was comparable to ${previous}`;
}

function takeawayText(run: BattleRun) {
  if (runHasFailure(run)) return `Do not treat this as better for grinding. ${failureText(run)} means this setup is unsafe for this target until more successful same-target battles prove otherwise.`;
  if (!run.previous_run) return "Use this as the control run for the next crew change against the same ship and target.";
  const confidence = comparisonConfidence(run);
  if (confidence.level === "very low") return "Too little evidence to recommend either setup yet.";
  const hull = run.previous_run.avg_net_hull_damage_delta_pct;
  const rounds = run.previous_run.avg_rounds_delta_pct;
  const score = run.previous_run.avg_score_delta_pct;
  const hullBetter = hull !== null && hull < -5;
  const hullWorse = hull !== null && hull > 5;
  const faster = rounds !== null && rounds < -5;
  const slower = rounds !== null && rounds > 5;
  const scoreBetter = score !== null && score > 10;
  const scoreWorse = score !== null && score < -5;

  if (hullBetter && faster) return "Better grinding signal: it spent less hull per successful kill and also finished faster.";
  if (hullBetter && slower) return "Better endurance signal: it spent less hull per successful kill, even though the fight took longer.";
  if (hullWorse && faster) return "Not better for grinding: it killed faster, but spent more hull per successful kill.";
  if (hullWorse) return "Worse grinding signal: it spent more hull per successful kill.";
  if (scoreBetter && !hullWorse) return "This setup looks worth keeping for more samples under the same target conditions.";
  if (scoreWorse && hullBetter) return "This may be useful when survival matters more than raw score.";
  if (scoreWorse) return "This setup needs more evidence before treating it as an improvement.";
  return "Result is close enough that more matched battles are needed.";
}

export function RunInsights() {
  const [accessToken, setAccessToken] = React.useState(() => localStorage.getItem("stfcBattleAccessToken") ?? "");
  const [search, setSearch] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [ship, setShip] = React.useState("");
  const [days, setDays] = React.useState("14");
  const [appliedFilters, setAppliedFilters] = React.useState<RunInsightFilters | null>(null);
  const [aiQuestion, setAiQuestion] = React.useState("What is the best supported crew finding here, and what should I test next?");
  const [aiAnswer, setAiAnswer] = React.useState<string | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const trimmedAccessToken = accessToken.trim();
  const gameData = useQuery({
    queryKey: ["game-data"],
    queryFn: async () => {
      const response = await fetch("/data/game-data/all.json");
      if (!response.ok) throw new Error("Could not load game data");
      return (await response.json()) as GameData;
    },
  });

  const updateAccessToken = React.useCallback((value: string) => {
    setAccessToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem("stfcBattleAccessToken", trimmed);
    else localStorage.removeItem("stfcBattleAccessToken");
  }, []);

  const runs = useQuery({
    queryKey: ["battle-runs", trimmedAccessToken, appliedFilters],
    queryFn: async () => {
      const filters = appliedFilters ?? { search: "", target: "", ship: "", days: "14" };
      const params = new URLSearchParams({ limit: "20" });
      params.set("days", filters.days || "14");
      if (filters.search) params.set("search", filters.search);
      if (filters.target) params.set("target", filters.target);
      if (filters.ship) params.set("ship", filters.ship);
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/battle-runs?${params.toString()}`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!response.ok) {
        throw new Error(response.status === 401 || response.status === 403
          ? "Enter a valid access token to load run insights"
          : `Could not load run insights: ${response.status}`);
      }
      return response.json() as Promise<{ count: number; scanned_battles: number; runs: BattleRun[] }>;
    },
    enabled: !!trimmedAccessToken && !!appliedFilters,
  });

  const applyFilters = React.useCallback(() => {
    setAppliedFilters({
      search: search.trim(),
      target: target.trim(),
      ship: ship.trim(),
      days,
    });
  }, [days, search, ship, target]);

  const askStfcAiAssist = React.useCallback(async () => {
    if (!runs.data?.runs?.length) return;
    setAiLoading(true);
    setAiError(null);
    setAiAnswer(null);
    try {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/ai/stfc-ai-assist`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {}),
        },
        body: JSON.stringify({
          feature: "run-insights",
          question: aiQuestion,
          context: buildRunInsightsAiContext(runs.data.runs, appliedFilters),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error ?? `STFC AI Assist request failed: ${response.status}`);
      const answer = String(result?.answer ?? result?.message ?? result?.content ?? JSON.stringify(result, null, 2));
      setAiAnswer(result?.source ? `Source: ${result.source}\n\n${answer}` : answer);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not ask STFC AI Assist");
    } finally {
      setAiLoading(false);
    }
  }, [aiQuestion, appliedFilters, runs.data?.runs, trimmedAccessToken]);

  return (
    <Frame title="Run Insights">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Run Insights
          </Typography>
          <Typography color="text.secondary">
            Groups recent battles into setup runs so crew changes, confidence, and efficiency trends are easier to see.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Access token"
            type="password"
            value={accessToken}
            onChange={(event) => updateAccessToken(event.target.value)}
            size="small"
            sx={{ minWidth: 280 }}
          />
          <TextField label="Player or crew" value={search} onChange={(event) => setSearch(event.target.value)} size="small" />
          <TextField label="Ship" value={ship} onChange={(event) => setShip(event.target.value)} size="small" />
          <TextField label="Target" value={target} onChange={(event) => setTarget(event.target.value)} size="small" />
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
            disabled={!trimmedAccessToken || runs.isFetching}
          >
            Load Runs
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => runs.refetch()}
            disabled={!trimmedAccessToken || !appliedFilters || runs.isFetching}
          >
            Refresh
          </Button>
        </Stack>

        {!trimmedAccessToken ? <Alert severity="info">Enter your alliance token to load run insights.</Alert> : null}
        {trimmedAccessToken && !appliedFilters ? (
          <Alert severity="info">
            Run Insights is heavier than a normal battle lookup. It loads a recent window by default; use 30/90 days only for deeper audits.
          </Alert>
        ) : null}
        {runs.isFetching ? <LinearProgress /> : null}
        {runs.isError ? <Alert severity="error">{runs.error instanceof Error ? runs.error.message : "Could not load run insights"}</Alert> : null}

        {runs.data ? (
          <Typography variant="caption" color="text.secondary">
            Scanned {runs.data.scanned_battles} battle rows from the selected window and found {runs.data.count} runs.
          </Typography>
        ) : null}

        {runs.data?.runs?.length ? (
          <>
            <Alert severity="info">
              Scores are only meaningful inside the same player, ship, target family, and target level cohort. Use them as a matched-test signal, not a global ranking.
            </Alert>
            <BestCrewPanel runs={runs.data.runs} data={gameData.data} />
            <FindingsPanel runs={runs.data.runs} data={gameData.data} />
            <MatchedComparisons runs={runs.data.runs} data={gameData.data} />
            <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="h6">Ask STFC AI Assist About These Runs</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Question"
                  value={aiQuestion}
                  onChange={(event) => setAiQuestion(event.target.value)}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                  <Button variant="contained" onClick={askStfcAiAssist} disabled={aiLoading || !runs.data.runs.length}>
                    Ask STFC AI Assist
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    Sends compact run evidence only. Raw battle logs and private bot credentials stay off the browser.
                  </Typography>
                </Stack>
                {aiLoading ? <LinearProgress /> : null}
                {aiError ? <Alert severity="error">{aiError}</Alert> : null}
                {aiAnswer ? <Alert severity="info" sx={{ whiteSpace: "pre-wrap" }}>{aiAnswer}</Alert> : null}
              </Stack>
            </Paper>
            <Typography variant="h6">All Runs</Typography>
          </>
        ) : null}

        <Stack spacing={1.5}>
          {(runs.data?.runs ?? []).map((run) => (
            <RunCard key={run.run_id} run={run} data={gameData.data} />
          ))}
        </Stack>

        {trimmedAccessToken && appliedFilters && !runs.isLoading && !runs.data?.runs?.length ? (
          <Alert severity="info">No grouped runs matched the current filters.</Alert>
        ) : null}
      </Stack>
    </Frame>
  );
}

function BestCrewPanel({ runs, data }: { runs: BattleRun[]; data?: GameData }) {
  const matchedBetter = runs
    .filter((run) => run.previous_run && betterForGrinding(run) === "better")
    .map((run) => ({ run, confidence: comparisonConfidence(run), score: grindingScore(run) }))
    .sort((a, b) => {
      const confidenceRank = { high: 3, medium: 2, low: 1, "very low": 0 };
      const confidenceDelta = confidenceRank[b.confidence.level] - confidenceRank[a.confidence.level];
      if (confidenceDelta) return confidenceDelta;
      return grindComparisonScore(b.run) - grindComparisonScore(a.run);
    });
  const baselines = runs
    .filter((run) => !run.previous_run && run.battles >= 5 && !runHasFailure(run))
    .map((run) => ({ run, confidence: runReliability(run), score: grindingScore(run) }))
    .sort((a, b) => b.score - a.score);
  const best = matchedBetter[0] ?? baselines[0] ?? null;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 2, borderColor: best ? "success.main" : "divider" }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Best To Use From Loaded Runs</Typography>
          <Typography variant="body2" color="text.secondary">
            Grinding favors successful kills, lower net hull loss per kill, reliable survival, enough samples, and only then speed or combat score.
          </Typography>
        </Box>

        {best ? (
          <>
            <Box sx={{ borderLeft: "4px solid", borderColor: "success.main", pl: 1.5 }}>
              <Typography variant="h5" sx={{ fontSize: { xs: "1.15rem", md: "1.35rem" } }}>
                Use {crewDisplayName(best.run.crew_label)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {targetLabel(best.run)}
              </Typography>
            </Box>
            <CrewComparisonDetails run={best.run} data={data} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip color="success" label={`Grind value ${grindingScore(best.run).toFixed(1)}`} />
              <Chip label={`Net hull ${compactNumber(best.run.avg_net_hull_damage_after_repairs)}`} />
              <Chip label={`${best.run.battles} battles`} />
              <Chip color="success" label={`Win ${pct(best.run.win_rate)}`} />
              <Chip color={evidenceColor(best.confidence.level) as any} label={`${best.confidence.level} confidence`} />
              <Chip label={best.run.previous_run ? comparisonType(best.run) : "Baseline"} />
            </Stack>
            <Alert severity={best.run.previous_run ? "success" : "info"}>
              {grindingReason(best.run)}
            </Alert>
          </>
        ) : (
          <Alert severity="warning">
            No clear grinding winner is loaded yet. Filter to one player, one ship, and one target, then compare crews with at least five battles each.
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary">
          Best grinding is not just highest damage. A good farming crew kills reliably while spending less hull per kill.
        </Typography>
      </Stack>
    </Paper>
  );
}

function FindingsPanel({ runs, data }: { runs: BattleRun[]; data?: GameData }) {
  const matched = runs
    .filter((run) => run.previous_run)
    .map((run) => ({ run, confidence: comparisonConfidence(run) }))
    .sort((a, b) => {
      const aFailurePenalty = runHasFailure(a.run) ? 10_000 : 0;
      const bFailurePenalty = runHasFailure(b.run) ? 10_000 : 0;
      const aScore = grindComparisonScore(a.run) - aFailurePenalty;
      const bScore = grindComparisonScore(b.run) - bFailurePenalty;
      return bScore - aScore;
    });
  const supported = matched.filter(({ run, confidence }) => !runHasFailure(run) && (confidence.level === "medium" || confidence.level === "high")).slice(0, 3);
  const unsafe = matched.filter(({ run }) => runHasFailure(run)).slice(0, 2);
  const preliminaryCount = runs.filter((run) => run.battles <= 1).length;
  const baselines = runs.filter((run) => !run.previous_run && run.battles > 1).length;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Findings</Typography>
          <Typography variant="body2" color="text.secondary">
            Strongest supported conclusions from the loaded run set.
          </Typography>
        </Box>

        {supported.length ? (
          <Stack spacing={1}>
            {supported.map(({ run, confidence }) => {
              const hull = signedDelta(run.previous_run?.avg_net_hull_damage_delta_pct ?? null, "lower");
              const rounds = signedDelta(run.previous_run?.avg_rounds_delta_pct ?? null, "lower");
              const score = signedDelta(run.previous_run?.avg_score_delta_pct ?? null, "higher");
              const grindVerdict = betterForGrinding(run);
              return (
                <Box key={run.run_id} sx={{ borderLeft: "3px solid", borderColor: "primary.main", pl: 1.5, py: 0.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1">{resultHeadline(run)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {targetLabel(run)}
                      </Typography>
                    </Box>
                    {grindVerdict ? <Chip size="small" color={grindVerdict === "better" ? "success" : grindVerdict === "worse" ? "error" : "default"} label={grindVerdict === "better" ? "Better grind" : grindVerdict === "worse" ? "Worse grind" : "Close grind"} /> : null}
                    <Chip size="small" label={comparisonType(run)} />
                    <Chip size="small" color={evidenceColor(confidence.level) as any} label={`${confidence.level} confidence`} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {run.battles} vs {run.previous_run?.battles ?? 0} battles. Net hull per kill {hull.label}, rounds {rounds.label}, combat score {score.label}.
                  </Typography>
                  <Typography variant="body2">
                    Takeaway: {takeawayText(run)}
                  </Typography>
                  <Box component="details" sx={{ mt: 0.75 }}>
                    <Typography component="summary" variant="caption" sx={{ cursor: "pointer", color: "primary.main" }}>
                      View full crew comparison
                    </Typography>
                    <CrewComparisonDetails run={run} data={data} />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Alert severity="warning">
            No strong matched comparison is loaded yet. Use this page to establish baselines, then compare the next controlled crew change against the same ship and target.
          </Alert>
        )}

        {unsafe.length ? (
          <Alert severity="error">
            Unsafe run detected: {unsafe.map(({ run }) => `${crewDisplayName(run.crew_label)} on ${targetLabel(run)} (${failureText(run)})`).join("; ")}. These are not grinding recommendations.
          </Alert>
        ) : null}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`${matched.length} matched comparisons`} />
          <Chip size="small" label={`${baselines} baselines`} />
          <Chip size="small" color={preliminaryCount ? "warning" : "default"} label={`${preliminaryCount} preliminary`} />
        </Stack>
      </Stack>
    </Paper>
  );
}

function MatchedComparisons({ runs, data }: { runs: BattleRun[]; data?: GameData }) {
  const comparisons = runs.filter((run) => run.previous_run).slice(0, 8);
  if (!comparisons.length) return null;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Matched Comparisons</Typography>
          <Typography variant="body2" color="text.secondary">
            These are the only rows where percentage changes should be treated as comparisons.
          </Typography>
        </Box>
        <Stack spacing={1}>
          {comparisons.map((run) => {
            const confidence = comparisonConfidence(run);
              const hull = signedDelta(run.previous_run?.avg_net_hull_damage_delta_pct ?? null, "lower");
            const rounds = signedDelta(run.previous_run?.avg_rounds_delta_pct ?? null, "lower");
            const score = signedDelta(run.previous_run?.avg_score_delta_pct ?? null, "higher");
            const grindVerdict = betterForGrinding(run);
            return (
              <Box
                key={run.run_id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "1.5fr 1fr 0.7fr 0.7fr 0.7fr 0.9fr" },
                  gap: 1,
                  alignItems: "center",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 1,
                }}
              >
                <Box>
                  <Typography variant="subtitle2">{resultHeadline(run)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {run.battles} vs {run.previous_run?.battles ?? 0} battles · {changedText(run)}
                  </Typography>
                  <Box component="details" sx={{ mt: 0.5 }}>
                    <Typography component="summary" variant="caption" sx={{ cursor: "pointer", color: "primary.main" }}>
                      View full crew
                    </Typography>
                    <CrewComparisonDetails run={run} data={data} />
                  </Box>
                </Box>
                <Typography variant="body2">
                  {targetLabel(run)}
                </Typography>
                <DeltaChip label={`Hull ${hull.label}`} good={!runHasFailure(run) && hull.good} />
                <DeltaChip label={`Rounds ${rounds.label}`} good={rounds.good} />
                <DeltaChip label={`Combat ${score.label}`} good={!runHasFailure(run) && score.good} />
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {grindVerdict ? <Chip size="small" color={grindVerdict === "better" ? "success" : grindVerdict === "worse" ? "error" : "default"} label={grindVerdict === "better" ? "Better grind" : grindVerdict === "worse" ? "Worse grind" : "Close grind"} /> : null}
                  <Chip size="small" label={comparisonType(run)} />
                  <Chip size="small" color={evidenceColor(confidence.level) as any} label={confidence.level} />
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );
}

function splitCrewNames(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\s*(?:\||\/|,)\s*/g)
    .map((name) => name.trim())
    .filter(Boolean);
}

function CrewVisualLine({
  ship,
  captain,
  bridge,
  data,
}: {
  ship: string | null | undefined;
  captain: string | null | undefined;
  bridge: string | null | undefined;
  data?: GameData;
}) {
  const officers = Array.from(new Set([captain, ...splitCrewNames(bridge)].filter(Boolean) as string[])).slice(0, 4);
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ my: 0.75 }}>
      {ship ? <GameAssetAvatar asset={resolveShipAsset(ship, data)} label={ship} variant="chip" color="primary" /> : null}
      {officers.map((name, index) => (
        <GameAssetAvatar
          key={`${name}-${index}`}
          asset={resolveOfficerAsset(name, data)}
          label={name}
          variant="chip"
          captain={index === 0}
          color={index === 0 ? "secondary" : "default"}
        />
      ))}
    </Stack>
  );
}

function CrewComparisonDetails({ run, data }: { run: BattleRun; data?: GameData }) {
  const current = crewDetails(run.crew_label);
  const previous = run.previous_run ? crewDetails(run.previous_run.crew_label) : null;
  return (
    <Box sx={{ mt: 1, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Grid container spacing={1}>
        <Grid size={{ xs: 12, md: previous ? 6 : 12 }}>
          <Typography variant="caption" color="text.secondary">Current setup</Typography>
          <Typography variant="body2">Captain: {current.captain || "Unknown"}</Typography>
          <CrewVisualLine ship={current.ship || run.ship_name} captain={current.captain} bridge={current.bridge || run.bridge_officers} data={data} />
          <Typography variant="body2">Bridge: {current.bridge || run.bridge_officers || "Unknown"}</Typography>
          <Typography variant="body2">Below deck: {current.belowDeck || run.below_deck_officers || "Unknown"}</Typography>
        </Grid>
        {previous ? (
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" color="text.secondary">Previous setup</Typography>
            <Typography variant="body2">Captain: {previous.captain || "Unknown"}</Typography>
            <CrewVisualLine ship={previous.ship || run.ship_name} captain={previous.captain} bridge={previous.bridge} data={data} />
            <Typography variant="body2">Bridge: {previous.bridge || "Unknown"}</Typography>
            <Typography variant="body2">Below deck: {previous.belowDeck || "Unknown"}</Typography>
          </Grid>
        ) : null}
      </Grid>
    </Box>
  );
}

function RunCard({ run, data }: { run: BattleRun; data?: GameData }) {
  const reliability = runReliability(run);
  const comparison = comparisonConfidence(run);
  const isPreliminary = reliability.level === "very low";

  return (
    <Card variant="outlined" sx={{ borderRadius: 1, opacity: isPreliminary ? 0.82 : 1 }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1} alignItems={{ xs: "flex-start", lg: "center" }}>
            <GameAssetAvatar asset={resolveShipAsset(run.ship_name, data)} label={run.ship_name || "Unknown ship"} size={48} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">
                {run.player_name} · {targetLabel(run)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDate(run.first_seen)} to {formatDate(run.last_seen)}
              </Typography>
            </Box>
            <Chip size="small" label={runCategory(run)} />
            <Chip size="small" label={comparisonType(run)} />
            <Chip size="small" label={`${run.battles} battles`} />
            <Chip size="small" color={confidenceColor(run.confidence) as any} label={`${run.confidence} backend confidence`} />
          </Stack>

          <Box>
            <Typography variant="subtitle2">{resultHeadline(run)}</Typography>
            <Typography variant="body2" color="text.secondary">
              Changed: {changedText(run)}
            </Typography>
            <Box component="details" sx={{ mt: 0.75 }}>
              <Typography component="summary" variant="caption" sx={{ cursor: "pointer", color: "primary.main" }}>
                View full crew details
              </Typography>
              <CrewComparisonDetails run={run} data={data} />
            </Box>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" color={evidenceColor(reliability.level) as any} label={`Run reliability: ${reliability.level}`} />
            <Chip size="small" color={evidenceColor(comparison.level) as any} label={`Comparison: ${comparison.level}`} />
            <Chip
              size="small"
              color={runHasFailure(run) ? "error" : "success"}
              label={runHasFailure(run) ? `Unsafe: ${failureText(run)}` : "No recorded losses"}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {reliability.reason}. {comparison.reason}.
          </Typography>

          <Grid container spacing={1}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Avg rounds" value={run.avg_rounds?.toFixed(2) ?? "n/a"} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Net hull loss" value={compactNumber(run.avg_net_hull_damage_after_repairs)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Win rate" value={pct(run.win_rate)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Survival" value={pct(run.survival_rate)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Damage dealt" value={compactNumber(run.avg_damage_dealt)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Mitigation" value={pct(run.avg_mitigation_pct)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Crit rate" value={pct(run.avg_crit_rate)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Repair / round" value={compactNumber(run.avg_hull_repair_per_round)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Exchange" value={run.avg_damage_exchange_ratio?.toFixed(2) ?? "n/a"} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Combat score" value={run.avg_encounter_score?.toFixed(1) ?? "n/a"} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Metric label="Final hull" value={compactNumber(run.avg_player_final_hhp)} />
            </Grid>
          </Grid>

          {runHasFailure(run) ? (
            <Alert severity="error">
              This run is not safe for farming: {failureText(run)}. A lower hull-loss delta can be misleading when the current setup died or failed the kill.
            </Alert>
          ) : null}

          {run.previous_run ? (
            <Alert icon={<CompareArrowsIcon />} severity={comparison.level === "very low" ? "warning" : "info"}>
              {comparison.level === "very low" ? "Preliminary comparison" : "Matched comparison"}: {run.previous_run.crew_label}. Net hull per kill {signedPct(run.previous_run.avg_net_hull_damage_delta_pct)}, rounds {signedPct(run.previous_run.avg_rounds_delta_pct)}, combat score {signedPct(run.previous_run.avg_score_delta_pct)}.
              {" "}Takeaway: {takeawayText(run)}
            </Alert>
          ) : (
            <Alert severity="info">
              Baseline established. No previous matched run is available yet; use this as the control for the next crew change.
            </Alert>
          )}

          {run.estimated_kills_remaining ? (
            <Alert severity="success">
              Simple hull-ratio estimate: {killEstimateLabel(run.estimated_kills_remaining.expected)} kills, {killEstimateLabel(run.estimated_kills_remaining.conservative)} conservative. Not validated across a full continuous run unless the sample covers enough starting-hull states.
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {run.what_changed.map((item) => <Chip key={item} size="small" label={item} />)}
            {run.quality_warnings.map((item) => <Chip key={item} size="small" color="warning" label={item.replace(/_/g, " ")} />)}
          </Stack>

          <Divider />
          <Typography variant="caption" color="text.secondary">
            Score basis: {scoreBasisText(run)} Use only for matched ship-and-target comparisons.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Crew fingerprint: {run.crew_fingerprint_id}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function DeltaChip({ label, good }: { label: string; good: boolean }) {
  return <Chip size="small" color={good ? "success" : "default"} label={label} />;
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
