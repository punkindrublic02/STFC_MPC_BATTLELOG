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
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

type QuickScan = {
  scan_id: string;
  source: string;
  player_id: string | null;
  player_name: string | null;
  scan_type: string | null;
  level: number | null;
  captured_at?: string;
  owner_user_id?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_level?: number | null;
  owner_alliance_id?: string | null;
  num_drydocks?: number | null;
  num_defence_platforms?: number | null;
  current_shield_hp?: number | null;
  max_shield_hp?: number | null;
  current_hp?: number | null;
  max_hp?: number | null;
  resources?: Record<string, unknown> | null;
  shield_expiry_time?: string | null;
  ceasefire_broken_at?: string | null;
  created_at: string;
  updated_at: string;
  decoded: {
    repeated_pairs?: Array<{ id: number | null; value: number | null; float_value?: number | null }>;
  } | null;
};

type QuickScanServiceStatus = {
  enabled: boolean;
  require_token: boolean;
  allowed_alliance_id: string | null;
  allowed_api_client_id: number | null;
  client_alliance_id: string | null;
  client_api_client_id: number | null;
  can_manage: boolean;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return number.toLocaleString();
}

function formatPercent(current: unknown, max: unknown) {
  const currentNumber = Number(current);
  const maxNumber = Number(max);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(maxNumber) || maxNumber <= 0) return null;
  return `${Math.round((currentNumber / maxNumber) * 100)}%`;
}

function resourceSummary(resources: QuickScan["resources"]) {
  if (!resources) return null;
  const entries = Object.entries(resources)
    .filter(([, value]) => value !== null && value !== undefined && Number(value) !== 0)
    .slice(0, 5);
  if (!entries.length) return null;
  return entries.map(([key, value]) => `${key.replace(/_/g, " ")} ${formatNumber(value)}`).join(" · ");
}

export function QuickScans() {
  const [accessToken, setAccessToken] = React.useState(() => localStorage.getItem("stfcBattleAccessToken") ?? "");
  const [serviceDraft, setServiceDraft] = React.useState<QuickScanServiceStatus | null>(null);
  const [savingService, setSavingService] = React.useState(false);
  const [serviceError, setServiceError] = React.useState<string | null>(null);
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

  const scans = useQuery({
    queryKey: ["quick-scans", trimmedAccessToken],
    queryFn: async () => {
      const res = await fetch(`${LOCAL_SYNC_BASE_URL}/quick-scans?limit=100`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!res.ok) {
        throw new Error(res.status === 401 || res.status === 403
          ? "Enter a valid access token to load quick scans"
          : `Could not load quick scans: ${res.status}`);
      }
      return await res.json() as { count: number; scans: QuickScan[] };
    },
    enabled: !!trimmedAccessToken,
    refetchInterval: 30000,
  });

  const serviceStatus = useQuery({
    queryKey: ["quick-scans-service-status", trimmedAccessToken],
    queryFn: async () => {
      const res = await fetch(`${LOCAL_SYNC_BASE_URL}/quick-scans/service-status`, {
        headers: trimmedAccessToken ? { Authorization: `Bearer ${trimmedAccessToken}` } : {},
      });
      if (!res.ok) throw new Error("Could not load quickscan service status");
      const json = await res.json() as { quick_scan: QuickScanServiceStatus };
      return json.quick_scan;
    },
    enabled: !!trimmedAccessToken,
    refetchInterval: 30000,
  });

  React.useEffect(() => {
    if (serviceStatus.data) setServiceDraft(serviceStatus.data);
  }, [serviceStatus.data]);

  const saveServiceSettings = React.useCallback(async () => {
    if (!trimmedAccessToken || !serviceDraft) return;
    setSavingService(true);
    setServiceError(null);
    try {
      const res = await fetch(`${LOCAL_SYNC_BASE_URL}/quick-scans/service-status`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${trimmedAccessToken}`,
        },
        body: JSON.stringify({
          enabled: serviceDraft.enabled,
          require_token: serviceDraft.require_token,
          allowed_alliance_id: serviceDraft.allowed_alliance_id ?? "",
          allowed_api_client_id: serviceDraft.allowed_api_client_id ?? "",
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Could not save quickscan settings: ${res.status}`);
      }
      await serviceStatus.refetch();
      await scans.refetch();
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : "Could not save quickscan settings");
    } finally {
      setSavingService(false);
    }
  }, [scans, serviceDraft, serviceStatus, trimmedAccessToken]);

  return (
    <Frame title="Quick Scans">
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Quick Scans
          </Typography>
          <Typography color="text.secondary">
            Captured scan payloads decoded into usable rows. Raw protobuf hex is kept in the database but hidden here.
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
            onClick={() => scans.refetch()}
            disabled={!trimmedAccessToken || scans.isFetching}
          >
            Refresh
          </Button>
        </Stack>

        {!trimmedAccessToken ? <Alert severity="info">Enter your alliance token to load quick scans.</Alert> : null}
        {scans.isError ? <Alert severity="error">{scans.error instanceof Error ? scans.error.message : "Could not load quick scans"}</Alert> : null}
        {serviceError ? <Alert severity="error">{serviceError}</Alert> : null}

        {serviceDraft ? (
          <Card variant="outlined" sx={{ borderRadius: 1 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Quickscan access
                  </Typography>
                  <Chip
                    size="small"
                    color={serviceDraft.enabled ? "success" : "default"}
                    label={serviceDraft.enabled ? "Service on" : "Service off"}
                  />
                  <Chip
                    size="small"
                    color={serviceDraft.require_token ? "primary" : "warning"}
                    label={serviceDraft.require_token ? "Token required" : "Token optional"}
                  />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  Client: {serviceDraft.client_api_client_id ?? "not set"} · Allowed client: {serviceDraft.allowed_api_client_id ?? "any token"} · Client alliance: {serviceDraft.client_alliance_id || "not set"} · Allowed alliance: {serviceDraft.allowed_alliance_id || "any token"}
                </Typography>

                {serviceDraft.can_manage ? (
                  <>
                    <Divider />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={serviceDraft.enabled}
                            onChange={(event) => setServiceDraft((current) => current ? { ...current, enabled: event.target.checked } : current)}
                          />
                        }
                        label="Quickscan service"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={serviceDraft.require_token}
                            onChange={(event) => setServiceDraft((current) => current ? { ...current, require_token: event.target.checked } : current)}
                          />
                        }
                        label="Require token"
                      />
                      <TextField
                        label="Allowed alliance id/tag"
                        value={serviceDraft.allowed_alliance_id ?? ""}
                        onChange={(event) => setServiceDraft((current) => current ? { ...current, allowed_alliance_id: event.target.value } : current)}
                        size="small"
                        sx={{ minWidth: 220 }}
                      />
                      <TextField
                        label="Allowed token client id"
                        type="number"
                        value={serviceDraft.allowed_api_client_id ?? ""}
                        onChange={(event) => setServiceDraft((current) => current ? {
                          ...current,
                          allowed_api_client_id: event.target.value ? Number(event.target.value) : null,
                        } : current)}
                        size="small"
                        sx={{ minWidth: 190 }}
                      />
                      <Button variant="contained" onClick={saveServiceSettings} disabled={savingService}>
                        Save
                      </Button>
                    </Stack>
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Stack spacing={1.5}>
          {(scans.data?.scans ?? []).map((scan) => {
            const pairs = scan.decoded?.repeated_pairs ?? [];
            const ownerName = scan.owner_name || scan.player_name || scan.owner_id || scan.player_id || "Unknown owner";
            const ownerId = scan.owner_id || scan.owner_user_id || scan.player_id;
            const shieldPct = formatPercent(scan.current_shield_hp, scan.max_shield_hp);
            const hullPct = formatPercent(scan.current_hp, scan.max_hp);
            const resources = resourceSummary(scan.resources);
            return (
              <Card key={scan.scan_id} variant="outlined" sx={{ borderRadius: 1 }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {ownerName}
                      </Typography>
                      <Chip size="small" label={scan.source.replace(/_/g, " ")} />
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {scan.owner_level || scan.level ? <Chip size="small" label={`Level ${scan.owner_level ?? scan.level}`} /> : null}
                      {ownerId ? <Chip size="small" label={ownerId} /> : null}
                      {scan.owner_alliance_id ? <Chip size="small" label={`Alliance ${scan.owner_alliance_id}`} /> : null}
                      {scan.num_drydocks != null ? <Chip size="small" label={`${scan.num_drydocks} drydocks`} /> : null}
                      {scan.num_defence_platforms != null ? <Chip size="small" label={`${scan.num_defence_platforms} platforms`} /> : null}
                      {shieldPct ? <Chip size="small" color="info" label={`Shield ${shieldPct}`} /> : null}
                      {hullPct ? <Chip size="small" color="secondary" label={`Hull ${hullPct}`} /> : null}
                      {scan.shield_expiry_time ? <Chip size="small" color="success" label={`Shield expires ${formatDate(scan.shield_expiry_time)}`} /> : null}
                      {scan.ceasefire_broken_at ? <Chip size="small" color="warning" label={`Ceasefire broken ${formatDate(scan.ceasefire_broken_at)}`} /> : null}
                      <Chip size="small" label={`Captured ${formatDate(scan.captured_at ?? scan.created_at)}`} />
                    </Stack>

                    {resources ? (
                      <Typography variant="body2" color="text.secondary">
                        Resources: {resources}
                      </Typography>
                    ) : pairs.length ? (
                      <Typography variant="body2" color="text.secondary">
                        Saved with {pairs.length} decoded values, but no named resource fields were found.
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Scan saved, but this payload did not include named scan fields.
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>

        {trimmedAccessToken && !scans.isLoading && !scans.data?.scans?.length ? (
          <Alert severity="info">No quick scans have been captured yet.</Alert>
        ) : null}
      </Stack>
    </Frame>
  );
}
