import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Chip,
  Divider,
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
import TravelExploreIcon from "@mui/icons-material/TravelExplore";

import { Frame } from "../components/Frame";
import { AutoLinkText } from "../components/AutoLinkText";

type AnyRow = Record<string, any>;

type WorkbookGuide = {
  source: {
    file: string;
    title: string;
    imported_at: string;
    sheets: string[];
  };
  vger_hostiles: AnyRow[];
  challenge_track_rewards: Array<{
    ops: string | null;
    reward_type: string | null;
    milestones: Array<{ milestone: string; value: unknown }>;
  }>;
  no_npc_71_plus_missions: AnyRow[];
  excel_tables: Record<string, Record<string, { ref: string; rows: AnyRow[] }>>;
  guide_notes: Record<string, string[]>;
  raw_cells: Record<string, Array<{ address: string; row: number; col: number; value: unknown }>>;
};

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function dateText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function normalized(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function compactCells(cells: WorkbookGuide["raw_cells"][string], limit = 24) {
  return cells
    .filter((cell) => typeof cell.value === "string" && String(cell.value).trim().length > 2)
    .slice(0, limit);
}

function DataTable({ columns, rows, emptyText = "No rows found" }: { columns: Array<{ key: string; label: string }>; rows: AnyRow[]; emptyText?: string }) {
  if (!rows.length) {
    return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => <TableCell key={column.key}>{column.label}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => <TableCell key={column.key}><AutoLinkText value={valueText(row[column.key])} /></TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function VgerExcelsiorGuide() {
  const [levelFilter, setLevelFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");

  const guide = useQuery({
    queryKey: ["vger-excelsior-guide"],
    queryFn: async () => {
      const response = await fetch("/data/game-knowledge/vger-excelsior-m86-m87.json");
      if (!response.ok) throw new Error(`Could not load V'Ger workbook data: ${response.status}`);
      return (await response.json()) as WorkbookGuide;
    },
  });

  const data = guide.data;

  const filteredHostiles = useMemo(() => {
    if (!data) return [];
    const level = Number(levelFilter);
    const hasLevel = Number.isFinite(level) && levelFilter.trim() !== "";
    const text = textFilter.trim().toLowerCase();
    return data.vger_hostiles.filter((row) => {
      const levelOk = !hasLevel || Number(row.level) === level;
      const textOk = !text || [
        row.system,
        row.system_inherited,
        row.level,
        row.warp,
        row.loot_range,
      ].some((value) => normalized(value).includes(text));
      return levelOk && textOk;
    });
  }, [data, levelFilter, textFilter]);

  const challengeRows = useMemo(() => {
    if (!data) return [];
    const text = textFilter.trim().toLowerCase();
    return data.challenge_track_rewards.filter((row) => {
      if (!text) return true;
      return normalized(row.ops).includes(text) || normalized(row.reward_type).includes(text);
    });
  }, [data, textFilter]);

  const excelsiorTimetable = data?.excel_tables?.Excelsior?.Table_2?.rows ?? [];
  const signalOverview = data?.excel_tables?.["Signal Observatory"]?.Table_10?.rows ?? [];
  const missions = data?.no_npc_71_plus_missions ?? [];
  const crewCells = data?.raw_cells?.["Blues Crews - VGER"] ?? [];
  const systemMapCells = data?.raw_cells?.["System Map (WIP)"] ?? [];

  return (
    <Frame title="V'Ger / Excelsior Guide">
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <TravelExploreIcon color="primary" />
            <Typography variant="h4">V'Ger, Excelsior & Challenge Track</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Workbook-backed guide data for V'Ger hostiles, Excelsior progression, challenge rewards, and no-NPC mission planning.
          </Typography>
        </Box>

        {guide.isLoading ? <LinearProgress /> : null}
        {guide.error ? <Alert severity="error">{guide.error instanceof Error ? guide.error.message : "Could not load guide data"}</Alert> : null}

        {data ? (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                <Box>
                  <Typography variant="h6">{data.source.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Imported {dateText(data.source.imported_at)} from {data.source.sheets.length} workbook tabs.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip size="small" label={`${data.vger_hostiles.length} hostile rows`} />
                  <Chip size="small" label={`${data.challenge_track_rewards.length} reward rows`} />
                  <Chip size="small" label={`${data.no_npc_71_plus_missions.length} missions`} />
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Level"
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                  size="small"
                  sx={{ width: { xs: "100%", md: 140 } }}
                />
                <TextField
                  label="Search guide"
                  value={textFilter}
                  onChange={(event) => setTextFilter(event.target.value)}
                  size="small"
                  fullWidth
                  placeholder="System, reward, mission, ops band..."
                />
              </Stack>
            </Paper>

            <Box>
              <Typography variant="h5" gutterBottom>V'Ger Hostile Stats</Typography>
              <DataTable
                rows={filteredHostiles}
                columns={[
                  { key: "level", label: "Level" },
                  { key: "system_inherited", label: "System" },
                  { key: "warp", label: "Warp" },
                  { key: "shield_shp", label: "Shield" },
                  { key: "hull_hhp", label: "Hull" },
                  { key: "base_iso", label: "Base ISO" },
                  { key: "iso_def", label: "ISO Def" },
                  { key: "apex_barrier", label: "Apex Barrier" },
                  { key: "apex_shred", label: "Apex Shred" },
                  { key: "loot_range", label: "Loot" },
                  { key: "chest", label: "Chest" },
                ]}
              />
            </Box>

            <Box>
              <Typography variant="h5" gutterBottom>Challenge Track Rewards</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ops</TableCell>
                      <TableCell>Reward</TableCell>
                      <TableCell>Milestones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {challengeRows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{valueText(row.ops)}</TableCell>
                        <TableCell>{valueText(row.reward_type)}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            {row.milestones.map((milestone) => (
                              <Chip
                                key={`${milestone.milestone}-${valueText(milestone.value)}`}
                                size="small"
                                label={`${milestone.milestone}: ${valueText(milestone.value)}`}
                              />
                            ))}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Box>
              <Typography variant="h5" gutterBottom>Excelsior Upgrade Timetable</Typography>
              <DataTable
                rows={excelsiorTimetable}
                columns={[
                  { key: "tier", label: "Tier" },
                  { key: "ops_locks", label: "Ops Lock" },
                  { key: "parts_to_next", label: "Parts to Next" },
                  { key: "tier_up_gift", label: "Tier Gift" },
                  { key: "daily_parts", label: "Daily Parts" },
                  { key: "days_until", label: "Days Until" },
                  { key: "tier_2", label: "Decloak Tier" },
                  { key: "cooldown", label: "Decloak CD" },
                  { key: "tier_3", label: "Enhance Tier" },
                  { key: "cooldown_2", label: "Enhance CD" },
                ]}
              />
            </Box>

            <Box>
              <Typography variant="h5" gutterBottom>Signal Observatory Overview</Typography>
              <DataTable
                rows={signalOverview}
                columns={[
                  { key: "level", label: "Level" },
                  { key: "schematics", label: "Schematics" },
                  { key: "damage_vs_vger_hostiles", label: "Damage vs V'Ger" },
                  { key: "g5plus_fkr_pvp_iso", label: "G5+ FKR PvP ISO" },
                  { key: "g5plus_fkr_hostile_crit_dmg", label: "G5+ Hostile Crit" },
                  { key: "7_unc_station_eff", label: "7* Station Eff." },
                  { key: "plus_fkr_credits", label: "+ FKR Credits" },
                  { key: "plus_challenge_credits", label: "+ Challenge Credits" },
                  { key: "other", label: "Other" },
                ]}
              />
            </Box>

            <Box>
              <Typography variant="h5" gutterBottom>No NPC 71+ Missions</Typography>
              <DataTable
                rows={missions}
                columns={[
                  { key: "mission", label: "Mission" },
                  { key: "recommended_level", label: "Rec. Level" },
                  { key: "warp_for_completion", label: "Warp" },
                  { key: "system_start", label: "Start" },
                  { key: "dilemma_choice", label: "Choice" },
                  { key: "donation", label: "Donation" },
                  { key: "mission_info_link", label: "Link" },
                ]}
              />
            </Box>

            <Box>
              <Typography variant="h5" gutterBottom>Workbook Notes & Crew Grid Text</Typography>
              <Stack spacing={2}>
                <Alert severity="info">
                  The original crew sheet uses a visual grid. This page keeps the text extracted from the grid so we can turn it into stricter crew rows later without losing source data.
                </Alert>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>System Mechanics Notes</Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {compactCells(systemMapCells, 18).map((cell) => <Chip key={cell.address} label={`${cell.address}: ${valueText(cell.value)}`} />)}
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>V'Ger Crew Sheet Text</Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {compactCells(crewCells, 32).map((cell) => <Chip key={cell.address} label={`${cell.address}: ${valueText(cell.value)}`} />)}
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>Crew Tips</Typography>
                  <Stack spacing={1}>
                    {(data.guide_notes.vger_crew_tips ?? []).slice(0, 14).map((note, index) => (
                      <Typography key={index} variant="body2"><AutoLinkText value={note} /></Typography>
                    ))}
                  </Stack>
                </Paper>
              </Stack>
            </Box>

            <Divider />
            <Typography variant="caption" color="text.secondary">
              Source workbook path: <AutoLinkText value={data.source.file} />. Rebuild this data with <code>python tools/import-vger-workbook.py</code>.
            </Typography>
          </>
        ) : null}
      </Stack>
    </Frame>
  );
}
