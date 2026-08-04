import * as React from "react";
import { useCallback, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    LinearProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

type ApiClient = {
    id: number;
    display_name: string | null;
    player_id: string | null;
    alliance_id: string | null;
    is_active: number;
    battlelogs_shared: number;
    created_at: string;
    last_seen_at: string | null;
};

export function AdminTokens() {
    const [adminToken, setAdminToken] = useState(() => localStorage.getItem("stfcAdminToken") ?? "");
    const [displayName, setDisplayName] = useState("");
    const [allianceId, setAllianceId] = useState("punkndrublic");
    const [playerId, setPlayerId] = useState("");
    const [clients, setClients] = useState<ApiClient[]>([]);
    const [createdToken, setCreatedToken] = useState<string | undefined>();
    const [message, setMessage] = useState<string | undefined>();
    const [error, setError] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);

    const headers = useCallback(() => ({
        "Content-Type": "application/json",
        "x-admin-token": adminToken.trim(),
    }), [adminToken]);

    const updateAdminToken = (value: string) => {
        setAdminToken(value);
        const trimmed = value.trim();
        if (trimmed) localStorage.setItem("stfcAdminToken", trimmed);
        else localStorage.removeItem("stfcAdminToken");
    };

    const loadClients = useCallback(async () => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/admin/api-clients`, { headers: headers() });
            if (!res.ok) throw new Error(`Admin API returned ${res.status}`);
            const payload = await res.json();
            setClients(Array.isArray(payload.clients) ? payload.clients : []);
        } catch (err: any) {
            setError(err?.message ?? "Could not load tokens");
        } finally {
            setLoading(false);
        }
    }, [headers]);

    const createClient = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(undefined);
        setCreatedToken(undefined);
        try {
            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/admin/api-clients`, {
                method: "POST",
                headers: headers(),
                body: JSON.stringify({
                    display_name: displayName,
                    alliance_id: allianceId,
                    player_id: playerId || undefined,
                }),
            });
            if (!res.ok) throw new Error(`Create token failed: ${res.status}`);
            const payload = await res.json();
            setCreatedToken(payload.api_key);
            setMessage(`Created token for ${payload.display_name}`);
            setDisplayName("");
            setPlayerId("");
            await loadClients();
        } catch (err: any) {
            setError(err?.message ?? "Could not create token");
        } finally {
            setLoading(false);
        }
    };

    const setClientActive = async (id: number, isActive: boolean) => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/admin/api-clients/${id}`, {
                method: "PATCH",
                headers: headers(),
                body: JSON.stringify({ is_active: isActive ? 1 : 0 }),
            });
            if (!res.ok) throw new Error(`Update token failed: ${res.status}`);
            await loadClients();
        } catch (err: any) {
            setError(err?.message ?? "Could not update token");
        } finally {
            setLoading(false);
        }
    };

    const setBattlelogSharing = async (id: number, shared: boolean) => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch(`${LOCAL_SYNC_BASE_URL}/admin/api-clients/${id}`, {
                method: "PATCH",
                headers: headers(),
                body: JSON.stringify({ battlelogs_shared: shared ? 1 : 0 }),
            });
            if (!res.ok) throw new Error(`Update sharing failed: ${res.status}`);
            await loadClients();
        } catch (err: any) {
            setError(err?.message ?? "Could not update battle-log sharing");
        } finally {
            setLoading(false);
        }
    };

    const copyCreatedToken = async () => {
        if (!createdToken) return;
        await navigator.clipboard.writeText(createdToken);
        setMessage("Token copied");
    };

    return (
        <Frame title="API Tokens">
            <Box sx={{ py: 4 }}>
                <Stack spacing={3}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={2}>
                            <Typography variant="h5">Token Admin</Typography>
                            <TextField
                                type="password"
                                label="Admin token"
                                value={adminToken}
                                onChange={(event) => updateAdminToken(event.target.value)}
                            />
                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="outlined"
                                    startIcon={<RefreshIcon />}
                                    disabled={!adminToken.trim() || loading}
                                    onClick={loadClients}
                                >
                                    Load Tokens
                                </Button>
                                <Button onClick={() => updateAdminToken("")}>Forget Admin Token</Button>
                            </Stack>
                        </Stack>
                    </Paper>

                    <Paper component="form" variant="outlined" sx={{ p: 2 }} onSubmit={createClient}>
                        <Stack spacing={2}>
                            <Typography variant="h6">Create Alliance Token</Typography>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                                <TextField
                                    required
                                    label="Display name"
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value)}
                                />
                                <TextField
                                    label="Alliance ID"
                                    value={allianceId}
                                    onChange={(event) => setAllianceId(event.target.value)}
                                />
                                <TextField
                                    label="Player ID"
                                    value={playerId}
                                    onChange={(event) => setPlayerId(event.target.value)}
                                />
                            </Stack>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!adminToken.trim() || !displayName.trim() || loading}
                            >
                                Create Token
                            </Button>
                            {createdToken && (
                                <Alert
                                    severity="success"
                                    action={
                                        <Button color="inherit" size="small" startIcon={<ContentCopyIcon />} onClick={copyCreatedToken}>
                                            Copy
                                        </Button>
                                    }
                                >
                                    {createdToken}
                                </Alert>
                            )}
                        </Stack>
                    </Paper>

                    {loading && <LinearProgress />}
                    {message && <Alert severity="success">{message}</Alert>}
                    {error && <Alert severity="error">{error}</Alert>}

                    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
                        <Box sx={{ p: 2 }}>
                            <Typography variant="h6">Issued Tokens</Typography>
                        </Box>
                        <Divider />
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Alliance</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell>Last Seen</TableCell>
                                    <TableCell>Battle Logs</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {clients.map((client) => (
                                    <TableRow key={client.id}>
                                        <TableCell>{client.display_name ?? `Client ${client.id}`}</TableCell>
                                        <TableCell>{client.alliance_id ?? "-"}</TableCell>
                                        <TableCell>{client.created_at ? new Date(client.created_at).toLocaleString() : "-"}</TableCell>
                                        <TableCell>{client.last_seen_at ? new Date(client.last_seen_at).toLocaleString() : "never"}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Chip
                                                    size="small"
                                                    color={client.battlelogs_shared ? "primary" : "default"}
                                                    label={client.battlelogs_shared ? "shared" : "private"}
                                                />
                                                <Button
                                                    size="small"
                                                    onClick={() => setBattlelogSharing(client.id, !client.battlelogs_shared)}
                                                >
                                                    {client.battlelogs_shared ? "Make Private" : "Share"}
                                                </Button>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                color={client.is_active ? "success" : "default"}
                                                label={client.is_active ? "active" : "inactive"}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Button
                                                size="small"
                                                color={client.is_active ? "warning" : "success"}
                                                onClick={() => setClientActive(client.id, !client.is_active)}
                                            >
                                                {client.is_active ? "Disable" : "Enable"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>
                </Stack>
            </Box>
        </Frame>
    );
}
