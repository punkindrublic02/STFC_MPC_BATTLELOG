import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InsightsIcon from "@mui/icons-material/Insights";
import ShareIcon from "@mui/icons-material/Share";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { Frame } from "../components/Frame";
import { GameAssetAvatar } from "../components/GameAssetAvatar";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";
import { GameData, lookupTranslation } from "../combatlog/util/gameData";
import { officerAssetById, resolveOfficerAsset, resolveShipAsset, shipAssetById } from "../util/gameAssets";
import {
  HostileDetail,
  OfficerDetail,
  ShipComponentArmor,
  ShipComponentCargo,
  ShipComponentImpulse,
  ShipComponentShield,
  ShipComponentWarp,
  ShipComponentWeapon,
  ShipDetail,
  ShipDetailComponentData,
} from "../util/gameData";

type EncounterType = "all" | "hostile" | "armada" | "solo-armada" | "outpost" | "pvp";

type ShipOption = {
  id: number;
  label: string;
  name: string;
  grade: number;
  rarity: unknown;
};

type OfficerOption = {
  id: number;
  label: string;
  name: string;
  captainAbility: string;
  officerAbility: string;
  belowDeckAbility: string;
  details: OfficerDetail;
};

type HostileOption = {
  id: number;
  label: string;
  name: string;
  level: number;
  strength: number;
  detail: HostileDetail;
};

type EvidenceFilters = {
  encounter: EncounterType;
  targetName: string;
  playerSearch: string;
};

type BuildState = {
  label: string;
  opsLevel: number;
  shipId: number | undefined;
  tier: number;
  attackBonusPct: number;
  mitigationBonusPct: number;
  hullShieldBonusPct: number;
  captainId: number | undefined;
  bridgeIds: number[];
  belowDeckIds: number[];
};

type CrewResult = {
  comparison_key: string;
  battle_type: string | null;
  target_family: string | null;
  ship_name: string | null;
  ship_level: number | null;
  captain: string | null;
  bridge_officers: string | null;
  below_deck_officers?: string | null;
  battles: number;
  avg_rounds: number | null;
  avg_damage_dealt_per_round: number | null;
  avg_damage_taken_per_round: number | null;
  avg_damage_exchange_ratio: number | null;
  avg_overall_mitigation_pct: number | null;
  avg_crit_rate_dealt: number | null;
  avg_hull_repair_per_round: number | null;
  avg_encounter_score: number | null;
  sample_event_ids?: number[] | string | null;
  source?: "database" | "csv";
};

type RecentDatabaseBuild = {
  event_id: number;
  battle_id: string | null;
  battle_time: string | null;
  ship_id: string | number | null;
  side: string | null;
  display_name: string | null;
  player_id: string | null;
  player_name: string | null;
  ship_name: string | null;
  ship_level: number | null;
  hull_id: number | null;
  fleet_grade: number | null;
  offense_rating: number | null;
  defense_rating: number | null;
  health_rating: number | null;
  officer_rating: number | null;
  deflector_rating: number | null;
  forbidden_tech_rating: number | null;
  battle_type: string | null;
  encounter_family: string | null;
  target_family: string | null;
  solo_or_group: string | null;
  opponent_name: string | null;
  opponent_ship_name: string | null;
  opponent_ship_level: number | null;
  captain_name: string | null;
  bridge_crew: string | null;
  below_deck_crew: string | null;
  rounds: number | null;
  attacks_dealt: number | null;
  attacks_taken: number | null;
  damage_dealt_per_round: number | null;
  damage_taken_per_round: number | null;
  damage_exchange_ratio: number | null;
  avg_overall_mitigation_pct: number | null;
  crit_rate_dealt: number | null;
  hull_repair_per_round: number | null;
  ops_level: number | null;
  snapshot_ship_tier: number | null;
  snapshot_ship_strength: number | null;
  profile_snapshot_age_days: number | null;
  profile_confidence: string | null;
};

type UploadedCsvBattle = {
  fileName: string;
  playerName: string;
  targetName: string;
  shipName: string;
  shipLevel: number | null;
  outcome: string;
  captain: string | null;
  bridgeOfficers: string | null;
  belowDeckOfficers: string | null;
  rounds: number;
  attacks: number;
  damageDealt: number;
  damageTaken: number;
  critRate: number | null;
  officerTriggers: number;
  result: CrewResult;
};

type Prediction = {
  buildName: string;
  shipName: string;
  score: number;
  confidence: "Low" | "Medium" | "High";
  confidenceReason: string;
  base: {
    hhp: number;
    shp: number;
    dpr: number;
    alpha: number;
    alphaTwo: number;
    warp: number;
    cargo: number;
    impulse: number;
  };
  signals: string[];
  warnings: string[];
  observed?: CrewResult;
};

const encounterLabels: Record<EncounterType, string> = {
  all: "All",
  hostile: "Hostile",
  armada: "Armada",
  "solo-armada": "Solo armada",
  outpost: "Outpost",
  pvp: "PvP",
};

const encounterWeights: Record<EncounterType, Record<string, number>> = {
  all: { dpr: 0.22, alpha: 0.14, sustain: 0.2, mitigation: 0.16, repair: 0.1, crit: 0.1, debuff: 0.08 },
  hostile: { dpr: 0.3, alpha: 0.18, sustain: 0.22, mitigation: 0.12, loot: 0.08, repair: 0.1 },
  armada: { dpr: 0.22, alpha: 0.08, sustain: 0.2, mitigation: 0.18, repair: 0.12, debuff: 0.2 },
  "solo-armada": { dpr: 0.2, alpha: 0.08, sustain: 0.24, mitigation: 0.18, repair: 0.16, debuff: 0.14 },
  outpost: { dpr: 0.2, alpha: 0.12, sustain: 0.22, mitigation: 0.16, repair: 0.12, shield: 0.18 },
  pvp: { dpr: 0.18, alpha: 0.22, sustain: 0.16, mitigation: 0.18, crit: 0.16, debuff: 0.1 },
};

const initialBuildA: BuildState = {
  label: "Build A",
  opsLevel: 60,
  shipId: 3426564736,
  tier: 5,
  attackBonusPct: 0,
  mitigationBonusPct: 0,
  hullShieldBonusPct: 0,
  captainId: undefined,
  bridgeIds: [],
  belowDeckIds: [],
};

const initialBuildB: BuildState = {
  ...initialBuildA,
  label: "Build B",
  shipId: 701705952,
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

function hasObservedCrew(row: CrewResult) {
  return Boolean(row.captain?.trim() && row.bridge_officers?.trim());
}

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "n/a";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function normalizeSampleEventIds(value: CrewResult["sample_event_ids"]) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "string") return value.split(/[,\s]+/).map(Number).filter(Number.isFinite);
  return [];
}

function clampPresetSlot(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(26, Math.trunc(value)));
}

export function ShipComparison() {
  const gameData = useQuery({
    queryKey: ["game-data"],
    queryFn: async () => {
      const response = await fetch("/data/game-data/all.json");
      if (!response.ok) throw new Error("Network response was not ok");
      return (await response.json()) as GameData;
    },
  });

  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("stfcBattleAccessToken") ?? "");
  const [encounter, setEncounter] = useState<EncounterType>("all");
  const [target, setTarget] = useState<HostileOption | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [uploadedBattles, setUploadedBattles] = useState<UploadedCsvBattle[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState("Which setup is more likely to work, and why?");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [buildA, setBuildA] = useState<BuildState>(initialBuildA);
  const [buildB, setBuildB] = useState<BuildState>(initialBuildB);
  const [evidenceFilters, setEvidenceFilters] = useState<EvidenceFilters | null>(null);

  const data = gameData.data;
  const shipOptions = useMemo(() => (data ? buildShipOptions(data) : []), [data]);
  const officerOptions = useMemo(() => (data ? buildOfficerOptions(data) : []), [data]);
  const hostileOptions = useMemo(() => (data ? buildHostileOptions(data) : []), [data]);

  const trimmedAccessToken = accessToken.trim();
  const databaseEvidenceEnabled = !!trimmedAccessToken && !!evidenceFilters;
  const observedStats = useQuery({
    queryKey: ["ship-compare-observed", trimmedAccessToken, evidenceFilters],
    queryFn: async () => {
      const filters = evidenceFilters ?? { encounter: "all" as EncounterType, targetName: "", playerSearch: "" };
      const params = new URLSearchParams();
      params.set("limit", "75");
      if (filters.encounter !== "all") params.set("encounter", filters.encounter === "solo-armada" ? "armada" : filters.encounter);
      if (filters.targetName) params.set("target", filters.targetName);
      if (filters.playerSearch) params.set("search", filters.playerSearch);

      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/stats/crew-results?${params.toString()}`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!response.ok) throw new Error(`Could not load observed battle stats: ${response.status}`);
      return (await response.json()) as { count: number; results: CrewResult[] };
    },
    enabled: databaseEvidenceEnabled,
  });

  const tokenStatus = useQuery({
    queryKey: ["api-client", trimmedAccessToken],
    queryFn: async () => {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/auth/me`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!response.ok) throw new Error(`Token check failed: ${response.status}`);
      return (await response.json()) as {
        ok: boolean;
        client: { display_name?: string | null } | null;
        capabilities?: { officer_preset_mod?: boolean };
      };
    },
    enabled: !!trimmedAccessToken,
    retry: false,
  });

  const recentBuilds = useQuery({
    queryKey: ["ship-compare-recent-builds", trimmedAccessToken, evidenceFilters],
    queryFn: async () => {
      const filters = evidenceFilters ?? { encounter: "all" as EncounterType, targetName: "", playerSearch: "" };
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (filters.encounter !== "all") params.set("encounter", filters.encounter);
      if (filters.targetName) params.set("target", filters.targetName);
      if (filters.playerSearch) params.set("search", filters.playerSearch);

      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/ship-comparison/recent-builds?${params.toString()}`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!response.ok) throw new Error(`Could not load recent builds: ${response.status}`);
      return (await response.json()) as { count: number; builds: RecentDatabaseBuild[] };
    },
    enabled: databaseEvidenceEnabled,
  });

  const updateAccessToken = React.useCallback((value: string) => {
    setAccessToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem("stfcBattleAccessToken", trimmed);
    else localStorage.removeItem("stfcBattleAccessToken");
  }, []);

  const handleCsvUpload = React.useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setCsvError(null);
    try {
      const parsed: UploadedCsvBattle[] = [];
      for (const file of Array.from(files)) {
        parsed.push(parseBattleCsv(await file.text(), file.name));
      }
      setUploadedBattles((current) => [...parsed, ...current]);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Could not parse CSV battle log");
    }
  }, []);

  const loadDatabaseEvidence = React.useCallback(() => {
    setEvidenceFilters({
      encounter,
      targetName: target?.name ?? "",
      playerSearch: playerSearch.trim(),
    });
  }, [encounter, playerSearch, target?.name]);

  if (!data) {
    return (
      <Frame title="Ship Build Compare">
        <LinearProgress />
      </Frame>
    );
  }

  const databaseResults = (observedStats.data?.results ?? [])
    .map((result) => ({ ...result, source: "database" as const }))
    .filter(hasObservedCrew);
  const csvResults = uploadedBattles.map((battle) => battle.result).filter(hasObservedCrew);
  const observedResults = [...csvResults, ...databaseResults];
  const predictionA = predictBuild(buildA, encounter, target, data, observedResults);
  const predictionB = predictBuild(buildB, encounter, target, data, observedResults);
  function applyObservedBuild(row: CrewResult, side: "A" | "B") {
    const setBuild = side === "A" ? setBuildA : setBuildB;
    setBuild((current) => buildFromObservedResult(row, current, side === "A" ? "Build A" : "Build B", shipOptions, officerOptions, data));
  }

  function applyRecentBuild(row: RecentDatabaseBuild, side: "A" | "B") {
    const setBuild = side === "A" ? setBuildA : setBuildB;
    setBuild((current) => buildFromRecentDatabaseBuild(row, current, side === "A" ? "Build A" : "Build B", shipOptions, officerOptions, data));
  }

  async function askStfcAiAssist(prediction: Prediction) {
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
          feature: "ship-comparison",
          question: aiQuestion,
          context: buildStfcAiAssistContext(prediction, encounter, target, observedResults),
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
  }

  return (
    <Frame title="Ship Build Compare">
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" gutterBottom>
              Ops Ship & Crew Compare
            </Typography>
            <Typography color="text.secondary">
              {shipOptions.length.toLocaleString()} ships, {officerOptions.length.toLocaleString()} officers, and{" "}
              {hostileOptions.length.toLocaleString()} hostiles loaded from game data {data.version}.
            </Typography>
          </Box>
          <TextField
            label="Access token"
            type="password"
            size="small"
            value={accessToken}
            onChange={(event) => updateAccessToken(event.target.value)}
            sx={{ minWidth: 280 }}
          />
        </Stack>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Compare flow</Typography>
            <Grid container spacing={1.5}>
              {[
                ["1", "Choose evidence", "Upload game CSV logs, or load recent database evidence after entering a token."],
                ["2", "Set the fight", "Pick the encounter type and target so the comparison is judged against the right problem."],
                ["3", "Compare builds", "Fill Build A and B, then use observed rows to prefill or sanity-check the prediction."],
              ].map(([step, title, body]) => (
                <Grid key={step} size={{ xs: 12, md: 4 }}>
                  <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5, height: "100%" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" color="primary" label={step} />
                      <Typography variant="subtitle2">{title}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {body}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">1. Evidence Source</Typography>
                <Typography variant="body2" color="text.secondary">
                  CSV uploads load instantly for one-off tests. Database evidence is stronger, but only loads when you ask for it.
                </Typography>
              </Box>
              <Button variant="outlined" component="label" startIcon={<UploadFileIcon />}>
                Upload CSV
                <input
                  hidden
                  multiple
                  type="file"
                  accept=".csv,text/csv,text/tab-separated-values"
                  onChange={(event) => {
                    void handleCsvUpload(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </Button>
              <TextField
                label="Player, ship, crew, or target search"
                size="small"
                value={playerSearch}
                onChange={(event) => setPlayerSearch(event.target.value)}
                sx={{ minWidth: 260 }}
              />
              <Button
                variant="contained"
                startIcon={<InsightsIcon />}
                onClick={loadDatabaseEvidence}
                disabled={!trimmedAccessToken || observedStats.isFetching || recentBuilds.isFetching}
              >
                Load Database Evidence
              </Button>
            </Stack>
            {!trimmedAccessToken ? (
              <Alert severity="info">Enter an access token to load recent database builds. CSV uploads can still be used without loading database evidence.</Alert>
            ) : null}
            {trimmedAccessToken && !evidenceFilters ? (
              <Alert severity="info">Database evidence is paused. Set the search, encounter, or target, then load evidence when you are ready.</Alert>
            ) : null}
            {evidenceFilters ? (
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip size="small" label={`Evidence: ${encounterLabels[evidenceFilters.encounter]}`} />
                {evidenceFilters.playerSearch ? <Chip size="small" label={`Search: ${evidenceFilters.playerSearch}`} /> : null}
                {evidenceFilters.targetName ? <Chip size="small" label={`Target: ${evidenceFilters.targetName}`} /> : null}
              </Stack>
            ) : null}
            {csvError ? <Alert severity="error">{csvError}</Alert> : null}
            {uploadedBattles.length ? (
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {uploadedBattles.slice(0, 8).map((battle) => (
                  <Chip
                    key={`${battle.fileName}-${battle.playerName}-${battle.targetName}`}
                    size="small"
                    label={`${battle.playerName}: ${battle.shipName} vs ${battle.targetName} (${battle.outcome})`}
                  />
                ))}
                {uploadedBattles.length > 8 ? <Chip size="small" label={`+${uploadedBattles.length - 8} more`} /> : null}
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h6">2. Encounter & Target</Typography>
              <Typography variant="body2" color="text.secondary">
                Rankings change by fight type, so choose the closest match before loading evidence or comparing builds.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
            <ToggleButtonGroup
              exclusive
              value={encounter}
              onChange={(_event, value) => value && setEncounter(value)}
              size="small"
            >
              {(Object.keys(encounterLabels) as EncounterType[]).map((key) => (
                <ToggleButton key={key} value={key}>
                  {encounterLabels[key]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Autocomplete
              options={hostileOptions}
              value={target}
              onChange={(_event, value) => setTarget(value)}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              sx={{ minWidth: 320, flexGrow: 1 }}
              renderInput={(params) => <TextField {...params} size="small" label="Target hostile or armada" />}
            />
            </Stack>
          </Stack>
        </Paper>

        <Box>
          <Typography variant="h6">3. Build A vs Build B</Typography>
          <Typography variant="body2" color="text.secondary">
            Pick the ship, tier, bridge, and below deck officers for each setup. Recent database builds can prefill these fields after evidence is loaded.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <BuildEditor
              build={buildA}
              setBuild={setBuildA}
              shipOptions={shipOptions}
              officerOptions={officerOptions}
              data={data}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <BuildEditor
              build={buildB}
              setBuild={setBuildB}
              shipOptions={shipOptions}
              officerOptions={officerOptions}
              data={data}
            />
          </Grid>
        </Grid>

        <Box>
          <Typography variant="h6">4. Prediction & Evidence</Typography>
          <Typography variant="body2" color="text.secondary">
            The prediction uses the selected build plus matching observed battles. It is strongest when the loaded evidence matches the same player, ship, and target.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <PredictionPanel prediction={predictionA} encounter={encounter} onAsk={askStfcAiAssist} aiLoading={aiLoading} />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <PredictionPanel prediction={predictionB} encounter={encounter} onAsk={askStfcAiAssist} aiLoading={aiLoading} />
          </Grid>
        </Grid>

        <FleetPresetStaging
          builds={{ A: buildA, B: buildB }}
          predictions={{ A: predictionA, B: predictionB }}
          encounter={encounter}
          target={target}
          data={data}
          accessToken={trimmedAccessToken}
          canUseModPreset={Boolean(tokenStatus.data?.capabilities?.officer_preset_mod)}
        />

        <RecentDatabaseBuilds
          enabled={databaseEvidenceEnabled}
          loading={recentBuilds.isFetching}
          error={recentBuilds.error}
          builds={recentBuilds.data?.builds ?? []}
          data={data}
          onApply={applyRecentBuild}
        />

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">STFC AI Assist</Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Question"
              value={aiQuestion}
              onChange={(event) => setAiQuestion(event.target.value)}
            />
            {aiError ? <Alert severity="error">{aiError}</Alert> : null}
            {aiAnswer ? <Alert severity="info" sx={{ whiteSpace: "pre-wrap" }}>{aiAnswer}</Alert> : null}
            <Typography variant="caption" color="text.secondary">
              Sends only the selected build prediction, target, and top observed rows. Raw battle logs are not sent.
            </Typography>
          </Stack>
        </Paper>

        <ObservedResults
          loading={observedStats.isFetching}
          error={observedStats.error}
          enabled={databaseEvidenceEnabled || uploadedBattles.length > 0}
          results={observedResults}
          data={data}
          onApply={applyObservedBuild}
        />
      </Stack>
    </Frame>
  );
}

function BuildEditor(props: {
  build: BuildState;
  setBuild: React.Dispatch<React.SetStateAction<BuildState>>;
  shipOptions: ShipOption[];
  officerOptions: OfficerOption[];
  data: GameData;
}) {
  const { build, setBuild, shipOptions, officerOptions, data } = props;
  const ship = build.shipId ? data.ship[build.shipId] : undefined;
  const selectedShip = shipOptions.find((option) => option.id === build.shipId) ?? null;
  const captain = officerOptions.find((option) => option.id === build.captainId) ?? null;
  const bridge = build.bridgeIds.map((id) => officerOptions.find((option) => option.id === id)).filter(Boolean) as OfficerOption[];
  const belowDeck = build.belowDeckIds.map((id) => officerOptions.find((option) => option.id === id)).filter(Boolean) as OfficerOption[];
  const maxTier = ship?.tiers.length ?? 1;

  function patch(change: Partial<BuildState>) {
    setBuild((current) => ({ ...current, ...change }));
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <GameAssetAvatar asset={shipAssetById(build.shipId, data)} label={selectedShip?.name ?? "No ship"} size={48} />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {build.label || "Build"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selectedShip?.name ?? "Choose a ship"}{captain ? ` · Captain ${captain.name}` : ""}
            </Typography>
          </Box>
          {captain ? <GameAssetAvatar asset={officerAssetById(captain.id, data)} label={captain.name} captain size={42} /> : null}
        </Stack>
        <TextField label="Build name" size="small" value={build.label} onChange={(event) => patch({ label: event.target.value })} />
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Ops"
            size="small"
            type="number"
            value={build.opsLevel}
            onChange={(event) => patch({ opsLevel: clampNumber(event.target.value, 1, 100) })}
            sx={{ width: { xs: "100%", md: 120 } }}
          />
          <Autocomplete
            options={shipOptions}
            value={selectedShip}
            onChange={(_event, value) => patch({ shipId: value?.id, tier: Math.min(build.tier, value ? data.ship[value.id].tiers.length : 1) })}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            sx={{ flexGrow: 1 }}
            renderInput={(params) => <TextField {...params} size="small" label="Ship" />}
          />
          <TextField
            label="Tier"
            size="small"
            select
            value={Math.min(build.tier, maxTier)}
            onChange={(event) => patch({ tier: Number(event.target.value) })}
            sx={{ width: { xs: "100%", md: 110 } }}
          >
            {Array.from({ length: maxTier }, (_value, index) => (
              <MenuItem key={index + 1} value={index + 1}>
                T{index + 1}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Divider />

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Damage bonus %"
              size="small"
              type="number"
              value={build.attackBonusPct}
              onChange={(event) => patch({ attackBonusPct: clampNumber(event.target.value, -95, 10000) })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Mitigation bonus %"
              size="small"
              type="number"
              value={build.mitigationBonusPct}
              onChange={(event) => patch({ mitigationBonusPct: clampNumber(event.target.value, -95, 10000) })}
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Hull/shield bonus %"
              size="small"
              type="number"
              value={build.hullShieldBonusPct}
              onChange={(event) => patch({ hullShieldBonusPct: clampNumber(event.target.value, -95, 10000) })}
              fullWidth
            />
          </Grid>
        </Grid>

        <Divider />

        <Autocomplete
          options={officerOptions}
          value={captain}
          onChange={(_event, value) => patch({ captainId: value?.id })}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField {...params} size="small" label="Captain" />}
        />
        <Autocomplete
          multiple
          limitTags={3}
          options={officerOptions}
          value={bridge}
          onChange={(_event, value) => patch({ bridgeIds: value.slice(0, 2).map((option) => option.id) })}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField {...params} size="small" label="Bridge officers" />}
        />
        <Autocomplete
          multiple
          limitTags={6}
          options={officerOptions}
          value={belowDeck}
          onChange={(_event, value) => patch({ belowDeckIds: value.slice(0, 8).map((option) => option.id) })}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField {...params} size="small" label="Below deck officers" />}
        />
      </Stack>
    </Paper>
  );
}

function PredictionPanel({
  prediction,
  encounter,
  onAsk,
  aiLoading,
}: {
  prediction: Prediction;
  encounter: EncounterType;
  onAsk?: (prediction: Prediction) => void;
  aiLoading?: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
          <Box>
            <Typography variant="h6">{prediction.buildName}</Typography>
            <Typography color="text.secondary">{prediction.shipName}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip color={prediction.score >= 75 ? "success" : prediction.score >= 55 ? "warning" : "default"} label={`${prediction.score}/100`} />
            <Chip variant="outlined" label={`${prediction.confidence} confidence`} />
          </Stack>
        </Stack>

        <Grid container spacing={1}>
          <Metric label="HHP" value={compact(prediction.base.hhp)} />
          <Metric label="SHP" value={compact(prediction.base.shp)} />
          <Metric label="DPR" value={compact(prediction.base.dpr)} />
          <Metric label="R1 alpha" value={compact(prediction.base.alpha)} />
          <Metric label="R1-R2" value={compact(prediction.base.alphaTwo)} />
          <Metric label="Warp" value={compact(prediction.base.warp)} />
        </Grid>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {prediction.signals.map((signal) => (
            <Chip key={signal} size="small" icon={<InsightsIcon />} label={signal} />
          ))}
        </Stack>

        {prediction.warnings.length ? (
          <Alert severity="warning">{prediction.warnings.join(" ")}</Alert>
        ) : (
          <Alert severity="info">{prediction.confidenceReason}</Alert>
        )}

        {prediction.observed ? (
          <ObservedSummary observed={prediction.observed} encounter={encounter} />
        ) : null}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {onAsk ? (
            <Button size="small" variant="contained" startIcon={<InsightsIcon />} disabled={!!aiLoading} onClick={() => onAsk(prediction)}>
              Ask STFC AI Assist
            </Button>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => navigator.clipboard?.writeText(buildPrompt(prediction, encounter))}
          >
            Copy MCP prompt
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function FleetPresetStaging({
  builds,
  predictions,
  encounter,
  target,
  data,
  accessToken,
  canUseModPreset,
}: {
  builds: Record<"A" | "B", BuildState>;
  predictions: Record<"A" | "B", Prediction>;
  encounter: EncounterType;
  target: HostileOption | null;
  data: GameData;
  accessToken: string;
  canUseModPreset: boolean;
}) {
  const [slots, setSlots] = useState<Record<"A" | "B", number>>({ A: 1, B: 2 });
  const [presetNames, setPresetNames] = useState<Record<"A" | "B", string>>({ A: "", B: "" });
  const [existingNames, setExistingNames] = useState<Record<"A" | "B", string>>({ A: "", B: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sendingSide, setSendingSide] = useState<"A" | "B" | null>(null);

  async function copyText(label: string, text: string) {
    await navigator.clipboard?.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 1800);
  }

  async function shareCrew(label: string, text: string) {
    const share = navigator.share;
    if (typeof share === "function") {
      await share.call(navigator, { title: label, text });
      return;
    }
    await copyText(label, text);
  }

  async function sendSlot1(side: "A" | "B", payload: ReturnType<typeof buildFleetPresetCandidate>) {
    setSendingSide(side);
    setSendStatus(null);
    try {
      const slot1Payload = {
        ...payload,
        slot_order: 1,
        preset_name: payload.preset_name || `${payload.ship.name} Slot 1`,
        override: {
          ...payload.override,
          slot_order: 1,
          requires_confirmation: true,
          current_preset_name: existingNames[side].trim() || payload.override.current_preset_name || null,
        },
      };
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/mod/officer-preset-slot1`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ preset: slot1Payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || result.message || `Could not send preset request: ${response.status}`);
      }
      let acknowledged = false;
      if (result.request_id) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        const statusResponse = await fetch(`${LOCAL_SYNC_BASE_URL}/mod/officer-preset-slot1/status`, {
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        const statusResult = await statusResponse.json().catch(() => ({}));
        acknowledged = statusResult?.latest?.request_id === result.request_id && Boolean(statusResult?.latest?.acknowledged_at);
      }
      setSendStatus(acknowledged ? `Build ${side} received by the mod for Slot 1.` : `Build ${side} sent to the connected mod for Slot 1.`);
    } catch (error) {
      setSendStatus(error instanceof Error ? error.message : "Could not send preset request to the mod.");
    } finally {
      setSendingSide(null);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{canUseModPreset ? "Fleet Preset Staging" : "Crew Copy & Sharing"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {canUseModPreset
                ? "Stage Build A or B as a fleet preset candidate before overwriting a saved slot."
                : "Copy or share Build A/B crews without requiring a connected mod."}
            </Typography>
          </Box>
          {copied ? <Chip color="success" label={`${copied} copied`} /> : null}
          {sendStatus ? <Chip color={sendStatus.includes("sent") || sendStatus.includes("received") ? "success" : "warning"} label={sendStatus} /> : null}
        </Stack>

        <Grid container spacing={2}>
          {(["A", "B"] as const).map((side) => {
            const build = builds[side];
            const prediction = predictions[side];
            const slot = slots[side];
            const presetName = presetNames[side].trim() || build.label || `Preset ${slot}`;
            const existingName = existingNames[side].trim();
            const payload = buildFleetPresetCandidate(build, prediction, data, encounter, target, slot, presetName, existingName);
            const shareText = buildFleetPresetShareText(payload);
            const missing = fleetPresetMissingFields(build);

            return (
              <Grid key={side} size={{ xs: 12, lg: 6 }}>
                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5, height: "100%" }}>
                  <Stack spacing={1.25}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Build {side}: {payload.ship.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {payload.crew.captain?.name ?? "No captain"} / {payload.crew.bridge.map((officer) => officer.name).join(", ") || "No bridge"}
                        </Typography>
                      </Box>
                      <Chip color={prediction.score >= 75 ? "success" : prediction.score >= 55 ? "warning" : "default"} label={`${prediction.score}/100`} />
                    </Stack>

                    {missing.length ? <Alert severity="warning">Missing: {missing.join(", ")}.</Alert> : null}

                    {canUseModPreset ? (
                      <>
                        <Grid container spacing={1}>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              label="Preset slot"
                              value={slot}
                              onChange={(event) =>
                                setSlots((current) => ({ ...current, [side]: clampPresetSlot(Number(event.target.value)) }))
                              }
                            >
                              {Array.from({ length: 26 }, (_value, index) => index + 1).map((option) => (
                                <MenuItem key={option} value={option}>
                                  Slot {option}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 8 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="New preset name"
                              value={presetNames[side]}
                              placeholder={build.label}
                              onChange={(event) => setPresetNames((current) => ({ ...current, [side]: event.target.value }))}
                            />
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Current slot name"
                              value={existingNames[side]}
                              placeholder="Optional, used for the overwrite warning"
                              onChange={(event) => setExistingNames((current) => ({ ...current, [side]: event.target.value }))}
                            />
                          </Grid>
                        </Grid>

                        <Alert severity={existingName ? "warning" : "info"}>
                          {existingName
                            ? `This will override Slot ${slot}: ${existingName}.`
                            : `This is staged for Slot ${slot}. Check the in-game preset slot before overwriting it.`}
                        </Alert>
                      </>
                    ) : null}

                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Chip size="small" label={`Captain: ${payload.crew.captain?.name ?? "none"}`} />
                      <Chip size="small" label={`BD: ${payload.crew.below_deck.length}`} />
                      <Chip size="small" label={`Ship ID: ${payload.ship.id ?? "none"}`} />
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ContentCopyIcon />}
                        disabled={missing.length > 0}
                        onClick={() => void copyText(`Build ${side} preset`, shareText)}
                      >
                        Copy crew
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ShareIcon />}
                        disabled={missing.length > 0}
                        onClick={() => void shareCrew(`Build ${side} crew`, shareText)}
                      >
                        Share crew
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ContentCopyIcon />}
                        disabled={missing.length > 0}
                        onClick={() => void copyText(`Build ${side} JSON`, JSON.stringify(payload, null, 2))}
                      >
                        Copy JSON
                      </Button>
                      {canUseModPreset ? (
                        <Button
                          size="small"
                          color="success"
                          variant="contained"
                          disabled={missing.length > 0 || sendingSide !== null}
                          onClick={() => void sendSlot1(side, payload)}
                        >
                          {sendingSide === side ? "Sending..." : "Send to Mod Slot 1"}
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Stack>
    </Paper>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={{ xs: 6, md: 4 }}>
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, px: 1, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </Box>
    </Grid>
  );
}

function ObservedSummary({ observed, encounter }: { observed: CrewResult; encounter: EncounterType }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        Observed {encounterLabels[encounter]} logs
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" label={`${observed.battles} battles`} />
        <Chip size="small" label={`${compact(observed.avg_rounds)} rounds`} />
        <Chip size="small" label={`${compact(observed.avg_damage_dealt_per_round)} dmg/r`} />
        <Chip size="small" label={`${percent(observed.avg_overall_mitigation_pct)} mit`} />
        <Chip size="small" label={`${compact(observed.avg_encounter_score)} score`} />
      </Stack>
    </Box>
  );
}

function OfficerNameChips({ names, data }: { names: string[]; data: GameData }) {
  const uniqueNames = Array.from(new Set(names)).slice(0, 4);
  if (!uniqueNames.length) return null;
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {uniqueNames.map((name, index) => (
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

function RecentDatabaseBuilds(props: {
  enabled: boolean;
  loading: boolean;
  error: unknown;
  builds: RecentDatabaseBuild[];
  data: GameData;
  onApply: (row: RecentDatabaseBuild, side: "A" | "B") => void;
}) {
  const { enabled, loading, error, builds, data, onApply } = props;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">Recent Database Builds</Typography>
            <Typography variant="body2" color="text.secondary">
              Latest battle-log builds matching the selected encounter, target, and search. Use these to prefill Build A or B.
            </Typography>
          </Box>
          {loading ? <LinearProgress sx={{ width: 180 }} /> : null}
        </Stack>
        {!enabled ? <Alert severity="info">Enter an access token to pull recent database builds.</Alert> : null}
        {error ? <Alert severity="error">{error instanceof Error ? error.message : "Could not load recent builds"}</Alert> : null}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Player / Ship</TableCell>
                <TableCell>Crew</TableCell>
                <TableCell>Encounter</TableCell>
                <TableCell align="right">Rounds</TableCell>
                <TableCell align="right">Dmg/R</TableCell>
                <TableCell align="right">Taken/R</TableCell>
                <TableCell align="right">Mit</TableCell>
                <TableCell align="right">Use</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {builds.slice(0, 12).map((row) => (
                <TableRow key={`${row.event_id}-${row.ship_id}-${row.side}`} hover>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2">{row.player_name || row.display_name || "Unknown player"}</Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <GameAssetAvatar
                          asset={shipAssetById(row.hull_id, data) ?? resolveShipAsset(row.ship_name ?? "", data)}
                          label={row.ship_name || "Unknown ship"}
                          size={30}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {row.ship_name || "Unknown ship"}
                          {row.ship_level ? ` L${row.ship_level}` : ""}
                          {row.fleet_grade ? ` G${row.fleet_grade}` : ""}
                          {row.battle_time ? ` · ${formatShortDate(row.battle_time)}` : ""}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        <Chip size="small" variant="outlined" label={`Battle #${row.event_id}`} />
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          onClick={() => navigator.clipboard?.writeText(String(row.event_id))}
                        >
                          Copy ID
                        </Button>
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2">{[row.captain_name, row.bridge_crew].filter(Boolean).join(" / ") || "Unknown crew"}</Typography>
                      <OfficerNameChips names={[row.captain_name, ...splitCrewNames(row.bridge_crew)].filter(Boolean) as string[]} data={data} />
                      {row.below_deck_crew ? (
                        <Typography variant="caption" color="text.secondary">
                          BD: {row.below_deck_crew}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      <Chip size="small" label={row.battle_type || "unknown"} />
                      {row.target_family ? <Chip size="small" variant="outlined" label={row.target_family} /> : null}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{compact(row.rounds)}</TableCell>
                  <TableCell align="right">{compact(row.damage_dealt_per_round)}</TableCell>
                  <TableCell align="right">{compact(row.damage_taken_per_round)}</TableCell>
                  <TableCell align="right">{percent(row.avg_overall_mitigation_pct)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => onApply(row, "A")}>
                        A
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => onApply(row, "B")}>
                        B
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {enabled && !loading && !builds.length ? (
                <TableRow>
                  <TableCell colSpan={8}>No recent build rows matched. Try a broader player, ship, or target search.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
}

function ObservedResults(props: {
  enabled: boolean;
  loading: boolean;
  error: unknown;
  results: CrewResult[];
  data: GameData;
  onApply: (row: CrewResult, side: "A" | "B") => void;
}) {
  const { enabled, loading, error, results, data, onApply } = props;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6">Observed Comparable Results</Typography>
          {loading ? <LinearProgress sx={{ flexGrow: 1 }} /> : null}
        </Stack>
        {!enabled ? <Alert severity="info">Enter an access token to include battle-log results in the prediction.</Alert> : null}
        {error ? <Alert severity="error">{error instanceof Error ? error.message : "Could not load observed results"}</Alert> : null}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Crew</TableCell>
                <TableCell>Context</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Battles</TableCell>
                <TableCell align="right">Rounds</TableCell>
                <TableCell align="right">Dmg/R</TableCell>
                <TableCell align="right">Taken/R</TableCell>
                <TableCell align="right">Trade</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell align="right">Use</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.slice(0, 12).map((row) => (
                <TableRow key={`${row.source ?? "result"}:${row.comparison_key}:${row.captain ?? ""}:${row.bridge_officers ?? ""}`} hover>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2">{[row.captain, row.bridge_officers].filter(Boolean).join(" / ") || "Unknown crew"}</Typography>
                      <OfficerNameChips names={[row.captain, ...splitCrewNames(row.bridge_officers)].filter(Boolean) as string[]} data={data} />
                      {row.below_deck_officers ? (
                        <Typography variant="caption" color="text.secondary">
                          BD: {row.below_deck_officers}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <GameAssetAvatar asset={resolveShipAsset(row.ship_name ?? "", data)} label={row.ship_name || "Unknown ship"} size={28} />
                      <Typography variant="body2">
                        {row.ship_name || "Unknown ship"}
                        {row.ship_level ? ` L${row.ship_level}` : ""} vs {row.target_family || "unknown"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={row.source === "csv" ? "CSV" : "Database"} />
                    {normalizeSampleEventIds(row.sample_event_ids).length ? (
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                        {normalizeSampleEventIds(row.sample_event_ids).slice(0, 3).map((id) => (
                          <Chip key={id} size="small" label={`#${id}`} />
                        ))}
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          onClick={() => navigator.clipboard?.writeText(normalizeSampleEventIds(row.sample_event_ids).join(", "))}
                        >
                          Copy
                        </Button>
                      </Stack>
                    ) : null}
                  </TableCell>
                  <TableCell align="right">{row.battles}</TableCell>
                  <TableCell align="right">{compact(row.avg_rounds)}</TableCell>
                  <TableCell align="right">{compact(row.avg_damage_dealt_per_round)}</TableCell>
                  <TableCell align="right">{compact(row.avg_damage_taken_per_round)}</TableCell>
                  <TableCell align="right">{compact(row.avg_damage_exchange_ratio)}</TableCell>
                  <TableCell align="right">{compact(row.avg_encounter_score)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => onApply(row, "A")}>
                        A
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => onApply(row, "B")}>
                        B
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {enabled && !loading && !results.length ? (
                <TableRow>
                  <TableCell colSpan={11}>No comparable battle-log rows found yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
}

function predictBuild(
  build: BuildState,
  encounter: EncounterType,
  target: HostileOption | null,
  data: GameData,
  observedRows: CrewResult[],
): Prediction {
  const ship = build.shipId ? data.ship[build.shipId] : undefined;
  const shipName = ship ? shipNameFromDetail(ship, data) : "No ship selected";
  const tierIndex = Math.max(0, Math.min((build.tier || 1) - 1, (ship?.tiers.length ?? 1) - 1));
  const base = ship ? buildBaseStats(ship, tierIndex, build) : emptyBaseStats();
  const crew = resolveCrew(build, data);
  const crewText = crew.map((officer) => officer.searchText).join(" ");
  const signalScores = scoreSignals(crewText, encounter);
  const weights = encounterWeights[encounter];
  const targetStrength = target?.strength || target?.detail.strength || 0;
  const targetHhp = target?.detail.stats?.hull_hp ?? 0;
  const targetShp = target?.detail.stats?.shield_hp ?? 0;
  const targetDurability = targetHhp + targetShp;
  const opsBaseline = ship ? ship.grade * 10 : build.opsLevel;
  const opsFactor = Math.max(0.75, Math.min(1.35, 1 + (build.opsLevel - opsBaseline) / 160));
  const playerPower = (base.hhp + base.shp + base.dpr * 8 + base.alphaTwo) * opsFactor;
  const targetRatio = targetDurability > 0 ? playerPower / targetDurability : 1;

  const dprScore = curve(base.dpr / 1_000_000_000);
  const alphaScore = curve(base.alphaTwo / 1_500_000_000);
  const sustainScore = curve((base.hhp + base.shp) / 4_000_000_000);
  const targetScore = target ? Math.max(0, Math.min(100, 50 + Math.log10(Math.max(targetRatio, 0.01)) * 28)) : 58;
  const strengthPenalty = targetStrength > 0 ? Math.max(0, Math.min(16, Math.log10(Math.max(targetStrength / Math.max(playerPower, 1), 1)) * 6)) : 0;

  const score =
    dprScore * weights.dpr +
    alphaScore * weights.alpha +
    sustainScore * weights.sustain +
    signalScores.mitigation * weights.mitigation +
    (signalScores.repair ?? 50) * (weights.repair ?? 0) +
    (signalScores.crit ?? 50) * (weights.crit ?? 0) +
    (signalScores.debuff ?? 50) * (weights.debuff ?? 0) +
    (signalScores.loot ?? 50) * (weights.loot ?? 0) +
    (signalScores.shield ?? 50) * (weights.shield ?? 0) +
    targetScore * 0.18 -
    strengthPenalty +
    (opsFactor - 1) * 18;

  const observed = bestObservedMatch(build, shipName, crew, observedRows);
  const warnings = buildWarnings(build, crew, encounter, target, ship);
  const signals = buildSignals(signalScores, base, target, opsFactor);

  let confidence: Prediction["confidence"] = "Low";
  if (observed && observed.battles >= 5) confidence = "High";
  else if (target || crew.length >= 3) confidence = "Medium";

  return {
    buildName: build.label || "Build",
    shipName,
    score: Math.round(Math.max(0, Math.min(100, observed?.avg_encounter_score ?? score))),
    confidence,
    confidenceReason: observed
      ? `Matched ${observed.battles} observed battle-log rows for this ship or crew.`
      : "This is a game-data estimate until matching battle-log rows exist.",
    base,
    signals,
    warnings,
    observed,
  };
}

function buildBaseStats(ship: ShipDetail, tierIndex: number, build: BuildState) {
  const levelIndex = Math.min(tierIndex * 5, ship.levels.length - 1);
  const attackMultiplier = 1 + build.attackBonusPct / 100;
  const durabilityMultiplier = 1 + build.hullShieldBonusPct / 100;
  return {
    hhp: (
      getComponentValue<ShipComponentArmor>(ship, tierIndex, "Armor", (components) => components[0]?.hp ?? 0) +
      (ship.levels[levelIndex]?.health ?? 0)
    ) * durabilityMultiplier,
    shp: (
      getComponentValue<ShipComponentShield>(ship, tierIndex, "Shield", (components) => components[0]?.hp ?? 0) +
      (ship.levels[levelIndex]?.shield ?? 0)
    ) * durabilityMultiplier,
    dpr: getComponentValue<ShipComponentWeapon>(ship, tierIndex, "Weapon", (components) =>
      components
        .map((weapon) => (((weapon.maximum_damage + weapon.minimum_damage) / 2) * weapon.shots) / Math.max(weapon.cool_down, 1))
        .reduce((left, right) => left + right, 0),
    ) * attackMultiplier,
    alpha: getComponentValue<ShipComponentWeapon>(ship, tierIndex, "Weapon", (components) =>
      components
        .filter((weapon) => weapon.warm_up <= 1)
        .map((weapon) => ((weapon.maximum_damage + weapon.minimum_damage) / 2) * weapon.shots)
        .reduce((left, right) => left + right, 0),
    ) * attackMultiplier,
    alphaTwo: getComponentValue<ShipComponentWeapon>(ship, tierIndex, "Weapon", (components) =>
      components
        .filter((weapon) => weapon.warm_up <= 2)
        .map((weapon) => ((weapon.maximum_damage + weapon.minimum_damage) / 2) * weapon.shots * (weapon.cool_down === 1 ? 2 : 1))
        .reduce((left, right) => left + right, 0),
    ) * attackMultiplier,
    warp: getComponentValue<ShipComponentWarp>(ship, tierIndex, "Warp", (components) => components[0]?.distance ?? 0),
    cargo:
      getComponentValue<ShipComponentCargo>(ship, tierIndex, "Cargo", (components) => components[0]?.max_resources ?? 0) +
      (ship.tiers[tierIndex]?.buffs?.cargo ?? 0),
    impulse: getComponentValue<ShipComponentImpulse>(ship, tierIndex, "Impulse", (components) => components[0]?.impulse ?? 0),
  };
}

function emptyBaseStats() {
  return { hhp: 0, shp: 0, dpr: 0, alpha: 0, alphaTwo: 0, warp: 0, cargo: 0, impulse: 0 };
}

function scoreSignals(text: string, encounter: EncounterType) {
  const lower = text.toLowerCase();
  const count = (terms: string[]) => terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
  const encounterHit =
    encounter === "pvp"
      ? count(["player", "pvp", "against ships"])
      : encounter.includes("armada")
        ? count(["armada", "solo armada"])
        : encounter === "outpost"
          ? count(["station", "base", "outpost"])
          : encounter === "all"
            ? count(["hostile", "hostiles", "pve", "armada", "player", "pvp", "station", "base", "outpost"])
          : count(["hostile", "hostiles", "pve"]);

  return {
    mitigation: Math.min(100, 45 + count(["mitigation", "armor", "dodge", "shield deflection", "critical mitigation"]) * 12 + encounterHit * 6),
    repair: Math.min(100, 40 + count(["repair", "hull health", "shield health", "restore", "heal"]) * 14),
    crit: Math.min(100, 42 + count(["critical", "crit", "isolytic", "iso"]) * 14),
    debuff: Math.min(100, 40 + count(["breach", "burn", "morale", "shred", "reduce", "decrease", "piercing"]) * 10),
    loot: Math.min(100, 40 + count(["loot", "reward", "cargo", "faction"]) * 14),
    shield: Math.min(100, 40 + count(["shield", "absorption", "deflection"]) * 12),
  };
}

function buildSignals(scores: ReturnType<typeof scoreSignals>, base: Prediction["base"], target: HostileOption | null, opsFactor: number) {
  const signals = [
    `Mit ${Math.round(scores.mitigation)}`,
    `Repair ${Math.round(scores.repair)}`,
    `Crit/ISO ${Math.round(scores.crit)}`,
    `Debuff ${Math.round(scores.debuff)}`,
  ];
  if (target) signals.push(`Target L${target.level}`);
  if (base.alphaTwo > base.dpr * 1.4) signals.push("Front-loaded damage");
  if (Math.abs(opsFactor - 1) >= 0.05) signals.push(`Ops scale ${(opsFactor * 100).toFixed(0)}%`);
  return signals;
}

function buildWarnings(
  build: BuildState,
  crew: ReturnType<typeof resolveCrew>,
  encounter: EncounterType,
  target: HostileOption | null,
  ship: ShipDetail | undefined,
) {
  const warnings: string[] = [];
  if (!ship) warnings.push("Select a ship before trusting the score.");
  if (!build.captainId) warnings.push("No captain selected.");
  if (crew.length < 3) warnings.push("Bridge crew is incomplete.");
  if (!target && encounter !== "all" && encounter !== "pvp" && encounter !== "outpost") warnings.push("Pick a target to compare against hostile durability.");
  if (build.opsLevel < 1) warnings.push("Ops level is missing.");
  if (ship && build.opsLevel < ship.grade * 10) warnings.push(`Ops ${build.opsLevel} is below the rough G${ship.grade} baseline used by this estimator.`);
  return warnings;
}

function bestObservedMatch(
  build: BuildState,
  shipName: string,
  crew: ReturnType<typeof resolveCrew>,
  observedRows: CrewResult[],
) {
  if (!observedRows.length) return undefined;
  const captain = crew.find((officer) => officer.role === "captain")?.name.toLowerCase();
  const bridgeNames = crew.filter((officer) => officer.role === "bridge").map((officer) => officer.name.toLowerCase());

  return observedRows
    .map((row) => {
      const rowShip = (row.ship_name ?? "").toLowerCase();
      const rowCrew = `${row.captain ?? ""} ${row.bridge_officers ?? ""} ${row.below_deck_officers ?? ""}`.toLowerCase();
      let score = 0;
      if (rowShip && rowShip.includes(shipName.toLowerCase())) score += 4;
      if (captain && rowCrew.includes(captain)) score += 5;
      score += bridgeNames.filter((name) => rowCrew.includes(name)).length * 2;
      score += Math.min(row.battles, 10) / 5;
      return { row, score };
    })
    .filter((entry) => entry.score >= 4)
    .sort((left, right) => right.score - left.score)[0]?.row;
}

function buildFromObservedResult(
  row: CrewResult,
  current: BuildState,
  label: string,
  shipOptions: ShipOption[],
  officerOptions: OfficerOption[],
  data: GameData,
): BuildState {
  const ship = findShipOptionByName(row.ship_name, shipOptions);
  const maxTier = ship ? data.ship[ship.id]?.tiers.length ?? current.tier : current.tier;
  const tier = row.ship_level ? Math.max(1, Math.min(maxTier, Math.ceil(row.ship_level / 5))) : current.tier;
  const captain = findOfficerOptionByName(row.captain, officerOptions);
  const bridge = splitCrewNames(row.bridge_officers)
    .map((name) => findOfficerOptionByName(name, officerOptions))
    .filter(Boolean) as OfficerOption[];
  const belowDeck = splitCrewNames(row.below_deck_officers)
    .filter((name) => !sameCsvName(name, row.captain) && !splitCrewNames(row.bridge_officers).some((bridgeName) => sameCsvName(bridgeName, name)))
    .map((name) => findOfficerOptionByName(name, officerOptions))
    .filter(Boolean) as OfficerOption[];

  return {
    ...current,
    label,
    shipId: ship?.id ?? current.shipId,
    tier,
    captainId: captain?.id ?? current.captainId,
    bridgeIds: bridge.length ? bridge.slice(0, 2).map((officer) => officer.id) : current.bridgeIds,
    belowDeckIds: belowDeck.length ? belowDeck.slice(0, 8).map((officer) => officer.id) : current.belowDeckIds,
  };
}

function buildFromRecentDatabaseBuild(
  row: RecentDatabaseBuild,
  current: BuildState,
  label: string,
  shipOptions: ShipOption[],
  officerOptions: OfficerOption[],
  data: GameData,
): BuildState {
  const ship = findShipOptionByHullOrName(row.hull_id, row.ship_name, shipOptions);
  const maxTier = ship ? data.ship[ship.id]?.tiers.length ?? current.tier : current.tier;
  const rowTier = row.snapshot_ship_tier ?? (row.ship_level ? Math.ceil(row.ship_level / 5) : null);
  const tier = rowTier ? Math.max(1, Math.min(maxTier, rowTier)) : current.tier;
  const captain = findOfficerOptionByName(row.captain_name, officerOptions);
  const bridge = splitCrewNames(row.bridge_crew)
    .filter((name) => !sameCsvName(name, row.captain_name))
    .map((name) => findOfficerOptionByName(name, officerOptions))
    .filter(Boolean) as OfficerOption[];
  const belowDeck = splitCrewNames(row.below_deck_crew)
    .filter((name) => !sameCsvName(name, row.captain_name) && !splitCrewNames(row.bridge_crew).some((bridgeName) => sameCsvName(bridgeName, name)))
    .map((name) => findOfficerOptionByName(name, officerOptions))
    .filter(Boolean) as OfficerOption[];
  const player = row.player_name || row.display_name || "DB";
  const shipName = row.ship_name || "build";

  return {
    ...current,
    label: `${label}: ${player} ${shipName}`.slice(0, 80),
    opsLevel: row.ops_level ?? current.opsLevel,
    shipId: ship?.id ?? current.shipId,
    tier,
    captainId: captain?.id ?? current.captainId,
    bridgeIds: bridge.length ? bridge.slice(0, 2).map((officer) => officer.id) : current.bridgeIds,
    belowDeckIds: belowDeck.length ? belowDeck.slice(0, 8).map((officer) => officer.id) : current.belowDeckIds,
  };
}

function findShipOptionByHullOrName(hullId: number | string | null | undefined, name: string | null | undefined, shipOptions: ShipOption[]) {
  const numericHullId = Number(hullId);
  if (Number.isFinite(numericHullId)) {
    const exact = shipOptions.find((option) => option.id === numericHullId);
    if (exact) return exact;
  }
  return findShipOptionByName(name, shipOptions);
}

function findShipOptionByName(name: string | null | undefined, shipOptions: ShipOption[]) {
  const normalized = normalizeCrewName(name);
  if (!normalized) return null;
  return (
    shipOptions.find((option) => normalizeCrewName(option.name) === normalized) ??
    shipOptions.find((option) => normalizeCrewName(option.name).includes(normalized) || normalized.includes(normalizeCrewName(option.name))) ??
    null
  );
}

function findOfficerOptionByName(name: string | null | undefined, officerOptions: OfficerOption[]) {
  const normalized = normalizeCrewName(name);
  if (!normalized) return null;
  return (
    officerOptions.find((option) => normalizeCrewName(option.name) === normalized) ??
    officerOptions.find((option) => normalizeCrewName(option.name).includes(normalized) || normalized.includes(normalizeCrewName(option.name))) ??
    null
  );
}

function splitCrewNames(value: string | null | undefined) {
  return String(value ?? "")
    .split(/[,/|;]/g)
    .map((name) => name.trim())
    .filter((name) => name && name !== "--");
}

function normalizeCrewName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(uss|u s s|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCrew(build: BuildState, data: GameData) {
  const ids = [
    { id: build.captainId, role: "captain" as const },
    ...build.bridgeIds.map((id) => ({ id, role: "bridge" as const })),
    ...build.belowDeckIds.map((id) => ({ id, role: "belowDeck" as const })),
  ];
  return ids
    .map(({ id, role }) => {
      if (!id) return null;
      const officer = data.officer[id];
      if (!officer) return null;
      const name = officerName(officer, data);
      return {
        id,
        role,
        name,
        searchText: [
          name,
          abilityName(officer.captain_ability, data),
          abilityName(officer.ability, data),
          officer.below_decks_ability ? abilityName(officer.below_decks_ability, data) : "",
        ].join(" "),
      };
    })
    .filter(Boolean) as Array<{ id: number; role: "captain" | "bridge" | "belowDeck"; name: string; searchText: string }>;
}

function fleetPresetMissingFields(build: BuildState) {
  const missing: string[] = [];
  if (!build.shipId) missing.push("ship");
  if (!build.captainId) missing.push("captain");
  if (build.bridgeIds.length < 2) missing.push("bridge officers");
  return missing;
}

function buildFleetPresetCandidate(
  build: BuildState,
  prediction: Prediction,
  data: GameData,
  encounter: EncounterType,
  target: HostileOption | null,
  slotOrder: number,
  presetName: string,
  existingPresetName: string,
) {
  const crew = resolveCrew(build, data);
  const ship = build.shipId ? data.ship[build.shipId] : undefined;
  const mapOfficer = (role: "captain" | "bridge" | "belowDeck") =>
    crew.filter((officer) => officer.role === role).map((officer) => ({ id: officer.id, name: officer.name }));

  return {
    type: "fleet_preset_candidate",
    version: 1,
    source: "ship-comparison",
    preset_name: presetName,
    slot_order: slotOrder,
    override: {
      slot_order: slotOrder,
      current_preset_name: existingPresetName || null,
      requires_confirmation: true,
    },
    ship: {
      id: build.shipId ?? null,
      name: ship ? shipNameFromDetail(ship, data) : prediction.shipName,
      tier: build.tier,
      ops_level: build.opsLevel,
    },
    crew: {
      captain: mapOfficer("captain")[0] ?? null,
      bridge: mapOfficer("bridge"),
      below_deck: mapOfficer("belowDeck"),
      officer_ids: [build.captainId, ...build.bridgeIds, ...build.belowDeckIds].filter((id): id is number => Number.isFinite(id)),
    },
    comparison: {
      encounter,
      target: target ? { id: target.id, name: target.name, level: target.level, strength: target.strength } : null,
      score: prediction.score,
      confidence: prediction.confidence,
      signals: prediction.signals,
      warnings: prediction.warnings,
    },
  };
}

function buildFleetPresetShareText(candidate: ReturnType<typeof buildFleetPresetCandidate>) {
  const captain = candidate.crew.captain?.name ?? "none";
  const bridge = candidate.crew.bridge.map((officer) => officer.name).join(", ") || "none";
  const belowDeck = candidate.crew.below_deck.map((officer) => officer.name).join(", ") || "none";
  const target = candidate.comparison.target ? `${candidate.comparison.target.name} L${candidate.comparison.target.level}` : encounterLabels[candidate.comparison.encounter];
  return [
    `Fleet preset: ${candidate.preset_name}`,
    `Slot: ${candidate.slot_order}${candidate.override.current_preset_name ? ` (overrides ${candidate.override.current_preset_name})` : ""}`,
    `Ship: ${candidate.ship.name} T${candidate.ship.tier}`,
    `Captain: ${captain}`,
    `Bridge: ${bridge}`,
    `Below Deck: ${belowDeck}`,
    `Use: ${target}`,
    `MPC score: ${candidate.comparison.score}/100 (${candidate.comparison.confidence})`,
    `JSON: ${JSON.stringify(candidate)}`,
  ].join("\n");
}

function buildPrompt(prediction: Prediction, encounter: EncounterType) {
  return [
    "Use the STFC MCP tool and observed battle-log tables where possible.",
    `Evaluate ${prediction.buildName} for ${encounterLabels[encounter]}.`,
    `Ship: ${prediction.shipName}.`,
    `Estimated score: ${prediction.score}/100 (${prediction.confidence} confidence).`,
    `Base stats: HHP ${compact(prediction.base.hhp)}, SHP ${compact(prediction.base.shp)}, DPR ${compact(prediction.base.dpr)}, R1-R2 alpha ${compact(prediction.base.alphaTwo)}.`,
    `Signals: ${prediction.signals.join(", ")}.`,
    "Explain what should work, what will probably fail, and what battle-log evidence would prove it.",
  ].join("\n");
}

function buildStfcAiAssistContext(
  prediction: Prediction,
  encounter: EncounterType,
  target: HostileOption | null,
  observedRows: CrewResult[],
) {
  return {
    encounter,
    selected_build: compactPredictionForAi(prediction),
    target: target
      ? {
          name: target.name,
          level: target.level,
          strength: target.strength,
          hull_hp: target.detail.stats?.hull_hp ?? null,
          shield_hp: target.detail.stats?.shield_hp ?? null,
        }
      : null,
    observed_comparable_results: observedRows.slice(0, 6).map((row) => ({
      source: row.source ?? "database",
      ship: row.ship_name,
      ship_level: row.ship_level,
      target_family: row.target_family,
      captain: row.captain,
      bridge: row.bridge_officers,
      below_deck: row.below_deck_officers,
      battles: row.battles,
      avg_rounds: row.avg_rounds,
      avg_damage_dealt_per_round: row.avg_damage_dealt_per_round,
      avg_damage_taken_per_round: row.avg_damage_taken_per_round,
      avg_trade: row.avg_damage_exchange_ratio,
      avg_mitigation: row.avg_overall_mitigation_pct,
      avg_hull_repair_per_round: row.avg_hull_repair_per_round,
      score: row.avg_encounter_score,
    })),
    instruction:
      "Use observed battle-log evidence first. Do not invent hidden stats. Explain what is supported, what is uncertain, and what battle data would improve the answer.",
  };
}

function compactPredictionForAi(prediction: Prediction) {
  return {
    build: prediction.buildName,
    ship: prediction.shipName,
    score: prediction.score,
    confidence: prediction.confidence,
    confidence_reason: prediction.confidenceReason,
    signals: prediction.signals,
    warnings: prediction.warnings,
    base_stats: {
      hhp: prediction.base.hhp,
      shp: prediction.base.shp,
      dpr: prediction.base.dpr,
      alpha_round_1: prediction.base.alpha,
      alpha_round_1_2: prediction.base.alphaTwo,
      warp: prediction.base.warp,
    },
    matched_observed_result: prediction.observed
      ? {
          source: prediction.observed.source ?? "database",
          ship: prediction.observed.ship_name,
          target_family: prediction.observed.target_family,
          captain: prediction.observed.captain,
          bridge: prediction.observed.bridge_officers,
          below_deck: prediction.observed.below_deck_officers,
          battles: prediction.observed.battles,
          avg_rounds: prediction.observed.avg_rounds,
          score: prediction.observed.avg_encounter_score,
        }
      : null,
  };
}

function parseBattleCsv(text: string, fileName: string): UploadedCsvBattle {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sections = normalized
    .split(/\n\s*\n/g)
    .map((section) => section.trim())
    .filter(Boolean);
  const summary = parseTableSection(findCsvSection(sections, ["Player Name", "Ship Name"]) ?? "");
  const fleetStats = parseTableSection(findCsvSection(sections, ["Fleet Type"]) ?? "");
  const events = parseTableSection(findCsvSection(sections, ["Round", "Attacker Name", "Target Name"]) ?? "");

  if (summary.length < 2 && events.length === 0) {
    throw new Error(`${fileName}: could not find the player/enemy summary or round event section`);
  }

  const { player, enemy } = inferCsvParticipants(summary, events);
  const playerName = player["Player Name"] || "Unknown player";
  const targetName = enemy["Player Name"] || enemy["Ship Name"] || "Unknown target";
  const shipName = player["Ship Name"] || "Unknown ship";
  const shipLevel = nullableNumber(player["Ship Level"]);
  let captain = cleanCsvValue(player["Officer One"]);
  let bridgeOfficers = [cleanCsvValue(player["Officer Two"]), cleanCsvValue(player["Officer Three"])]
    .filter(Boolean)
    .join(", ") || null;
  let belowDeckOfficers: string | null = null;

  let rounds = 0;
  let attacks = 0;
  let crits = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let officerTriggers = 0;
  const officerTriggerCounts = new Map<string, number>();

  for (const event of events) {
    const round = nullableNumber(event["Round"]);
    if (round) rounds = Math.max(rounds, round);
    const type = event["Type"] || event["Battle Event"] || "";
    if (type.toLowerCase().includes("officer")) {
      officerTriggers += 1;
      const owner = cleanCsvValue(event["Ability Owner Name"]);
      if (owner && sameCsvName(event["Attacker Name"], playerName)) {
        officerTriggerCounts.set(owner, (officerTriggerCounts.get(owner) ?? 0) + 1);
      }
    }
    if (type !== "Attack") continue;

    const totalDamage =
      nullableNumber(event["Total Damage"]) ??
      (nullableNumber(event["Hull Damage"]) ?? 0) + (nullableNumber(event["Shield Damage"]) ?? 0);
    const attacker = event["Attacker Name"] ?? "";
    const target = event["Target Name"] ?? "";
    if (sameCsvName(attacker, playerName)) {
      attacks += 1;
      damageDealt += totalDamage;
      if ((event["Critical Hit?"] ?? "").toUpperCase() === "YES") crits += 1;
    } else if (sameCsvName(target, playerName)) {
      damageTaken += totalDamage;
    }
  }

  if (!rounds) rounds = 1;
  if (!captain && !bridgeOfficers && officerTriggerCounts.size) {
    const triggeredOfficers = [...officerTriggerCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([name]) => name);
    belowDeckOfficers = triggeredOfficers.slice(0, 8).join(", ") || null;
  } else if (officerTriggerCounts.size) {
    const knownBridge = [captain, ...splitCrewNames(bridgeOfficers)];
    belowDeckOfficers = [...officerTriggerCounts.keys()]
      .filter((name) => !knownBridge.some((known) => sameCsvName(known, name)))
      .slice(0, 8)
      .join(", ") || null;
  }
  const playerFleet = fleetStats.find((row) => (row["Fleet Type"] ?? "").toLowerCase().includes("player"));
  const score = scoreCsvBattle(player, enemy, playerFleet, rounds, damageDealt, damageTaken, attacks);
  const comparisonKey = `csv:${fileName}:${playerName}:${shipName}:${targetName}:${player["Timestamp"] ?? ""}`;
  const result: CrewResult = {
    comparison_key: comparisonKey,
    battle_type: "csv",
    target_family: targetName,
    ship_name: shipName,
    ship_level: shipLevel,
    captain,
    bridge_officers: bridgeOfficers,
    below_deck_officers: belowDeckOfficers,
    battles: 1,
    avg_rounds: rounds,
    avg_damage_dealt_per_round: damageDealt / rounds,
    avg_damage_taken_per_round: damageTaken / rounds,
    avg_damage_exchange_ratio: damageTaken > 0 ? damageDealt / damageTaken : null,
    avg_overall_mitigation_pct: null,
    avg_crit_rate_dealt: attacks > 0 ? crits / attacks : null,
    avg_hull_repair_per_round: null,
    avg_encounter_score: score,
    source: "csv",
  };

  return {
    fileName,
    playerName,
    targetName,
    shipName,
    shipLevel,
    outcome: player["Outcome"] || "UNKNOWN",
    captain,
    bridgeOfficers,
    belowDeckOfficers,
    rounds,
    attacks,
    damageDealt,
    damageTaken,
    critRate: attacks > 0 ? crits / attacks : null,
    officerTriggers,
    result,
  };
}

function findCsvSection(sections: string[], requiredHeaders: string[]) {
  return sections.find((section) => {
    const firstLine = section.split("\n").find((line) => line.trim());
    if (!firstLine) return false;
    const delimiter = firstLine.includes("\t") ? "\t" : ",";
    const headers = parseDelimitedLine(firstLine, delimiter).map((header) => header.toLowerCase());
    return requiredHeaders.every((required) => headers.includes(required.toLowerCase()));
  });
}

function inferCsvParticipants(summary: Record<string, string>[], events: Record<string, string>[]) {
  if (summary.length >= 2) {
    const player = summary.find((row) => row["Outcome"]?.toUpperCase() === "VICTORY") ?? summary[0];
    const enemy = summary.find((row) => row !== player) ?? summary[1];
    return { player, enemy };
  }

  const namedSides = new Map<string, { name: string; ships: Map<string, number>; friendlyEvents: number; damageDealt: number }>();
  const addSide = (name: string, alliance: string, ship: string, damage = 0) => {
    const cleanedName = cleanCsvValue(name);
    if (!cleanedName) return;
    const key = cleanedName.toLowerCase();
    const current = namedSides.get(key) ?? { name: cleanedName, ships: new Map<string, number>(), friendlyEvents: 0, damageDealt: 0 };
    if (cleanCsvValue(alliance)) current.friendlyEvents += 1;
    const cleanedShip = cleanCsvValue(ship);
    if (cleanedShip) current.ships.set(cleanedShip, (current.ships.get(cleanedShip) ?? 0) + Math.max(1, damage));
    current.damageDealt += damage;
    namedSides.set(key, current);
  };

  for (const event of events) {
    const damage =
      nullableNumber(event["Total Damage"]) ??
      (nullableNumber(event["Hull Damage"]) ?? 0) + (nullableNumber(event["Shield Damage"]) ?? 0);
    addSide(event["Attacker Name"] ?? "", event["Attacker Alliance"] ?? "", event["Attacker Ship"] ?? "", event["Type"] === "Attack" ? damage : 0);
    addSide(event["Target Name"] ?? "", event["Target Alliance"] ?? "", event["Target Ship"] ?? "");
  }

  const sides = [...namedSides.values()].filter((side) => side.name !== "--");
  const playerSide = sides.sort((a, b) => b.friendlyEvents - a.friendlyEvents || b.damageDealt - a.damageDealt)[0];
  const summaryEnemy = summary[0];
  const enemySide =
    (summaryEnemy ? { name: summaryEnemy["Player Name"] || summaryEnemy["Ship Name"] || "Unknown target" } : null) ??
    sides.find((side) => !sameCsvName(side.name, playerSide?.name ?? ""));
  const playerShip = mostWeightedCsvValue(playerSide?.ships) ?? "Unknown ship";
  const enemyOutcome = summaryEnemy?.["Outcome"]?.toUpperCase();

  return {
    player: {
      "Player Name": playerSide?.name ?? "Unknown player",
      "Outcome": enemyOutcome === "DEFEAT" ? "VICTORY" : enemyOutcome === "VICTORY" ? "DEFEAT" : "UNKNOWN",
      "Ship Name": playerShip,
      "Timestamp": summaryEnemy?.["Timestamp"] ?? "",
    },
    enemy: summaryEnemy ?? {
      "Player Name": enemySide?.name ?? "Unknown target",
      "Ship Name": enemySide?.name ?? "Unknown target",
      "Outcome": "UNKNOWN",
    },
  };
}

function mostWeightedCsvValue(values: Map<string, number> | undefined) {
  if (!values?.size) return null;
  return [...values.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function parseTableSection(section: string): Record<string, string>[] {
  const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = parseDelimitedLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseDelimitedLine(line: string, delimiter: string) {
  if (delimiter === "\t") return line.split("\t").map((value) => value.trim());
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

function nullableNumber(value: unknown): number | null {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  if (!cleaned || cleaned === "--") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function cleanCsvValue(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text && text !== "--" ? text : null;
}

function sameCsvName(left: unknown, right: unknown) {
  const a = String(left ?? "").trim().toLowerCase();
  const b = String(right ?? "").trim().toLowerCase();
  return Boolean(a && b && a === b);
}

function scoreCsvBattle(
  player: Record<string, string>,
  enemy: Record<string, string>,
  playerFleet: Record<string, string> | undefined,
  rounds: number,
  damageDealt: number,
  damageTaken: number,
  attacks: number,
) {
  const outcome = (player["Outcome"] ?? "").toUpperCase();
  const remainingHull = nullableNumber(player["Hull Health Remaining"]) ?? 0;
  const maxHull = nullableNumber(player["Hull Health"]) ?? 0;
  const enemyStrength = nullableNumber(enemy["Ship Strength"]) ?? 0;
  const playerStrength = nullableNumber(player["Ship Strength"]) ?? 0;
  const dpr = damageDealt / Math.max(rounds, 1);
  const trade = damageTaken > 0 ? damageDealt / damageTaken : outcome === "VICTORY" ? 3 : 0.5;
  const hullSurvival = maxHull > 0 ? remainingHull / maxHull : outcome === "VICTORY" ? 0.75 : 0;
  const punchRatio = enemyStrength > 0 && playerStrength > 0 ? enemyStrength / playerStrength : 1;
  const fleetDpr = nullableNumber(playerFleet?.["Damage Per Round"]) ?? dpr;

  return Math.round(Math.max(0, Math.min(100,
    (outcome === "VICTORY" ? 24 : 4) +
    curve(dpr / 1_000_000_000) * 0.24 +
    curve(fleetDpr / 1_000_000_000) * 0.16 +
    Math.min(22, trade * 8) +
    hullSurvival * 18 +
    Math.min(12, Math.log10(Math.max(punchRatio, 1)) * 8) +
    Math.min(8, attacks),
  )));
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

function buildOfficerOptions(data: GameData): OfficerOption[] {
  return Object.values(data.officer)
    .map((officer) => {
      const name = officerName(officer, data);
      const captainAbility = abilityName(officer.captain_ability, data);
      const officerAbility = abilityName(officer.ability, data);
      const belowDeckAbility = officer.below_decks_ability ? abilityName(officer.below_decks_ability, data) : "";
      return {
        id: officer.id,
        label: `${name}${captainAbility ? ` - ${captainAbility}` : ""}`,
        name,
        captainAbility,
        officerAbility,
        belowDeckAbility,
        details: officer,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
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
        label: `L${hostile.level} ${name} (${compact(hostile.strength)})`,
        detail: hostile,
      };
    })
    .sort((left, right) => {
      const nameOrder = left.name.localeCompare(right.name);
      return nameOrder || left.level - right.level;
    });
}

function officerName(officer: OfficerDetail, data: GameData) {
  return lookupTranslation(data.translations.officer_names, officer.loca_id, "officer_name") || `Officer ${officer.id}`;
}

function abilityName(ability: { loca_id: number } | undefined, data: GameData) {
  if (!ability) return "";
  return lookupTranslation(data.translations.officer_buffs, ability.loca_id, "officer_ability_name") || "";
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

function getComponentValue<C extends ShipDetailComponentData>(
  ship: ShipDetail,
  tier: number,
  tag: string,
  getValue: (components: C[]) => number,
): number {
  const components = ship.tiers[tier]?.components
    .filter((component) => component.data.tag === tag)
    .map((component) => component.data) as C[];
  return getValue(components ?? []);
}

function curve(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(0, Math.min(100, Math.log10(value + 1) * 34));
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}
