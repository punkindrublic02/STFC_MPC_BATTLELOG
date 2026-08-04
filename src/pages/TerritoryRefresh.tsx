import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Divider,
    Link,
    MenuItem,
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
import AddAlertIcon from "@mui/icons-material/AddAlert";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import MapIcon from "@mui/icons-material/Map";
import RefreshIcon from "@mui/icons-material/Refresh";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

type TerritoryRow = {
    category: "Mining" | "Hostile" | "Armada" | "Service" | "Planning";
    item: string;
    appliesTo: string;
    watchFor: string;
    dataNeeded: string;
    status: "Live data detected" | "Needs logs" | "Needs loot data" | "Ready";
};

type TerritoryReminder = {
    reminder_id: number;
    alliance_id: string | null;
    created_by: string | null;
    zone_number: number;
    system_name: string;
    system_id: string | null;
    territory_name: string | null;
    territory_type: string | null;
    starts_at: string;
    local_time_label: string | null;
    reminder_offsets: number[];
    note: string | null;
    discord_destination_id: number | null;
    discord_channel_label: string | null;
    status: string;
    posted_discord_at: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
};

type TerritorySlot = {
    slot_id: string;
    alliance_id: string | null;
    zone_number: number | null;
    system_id: string | null;
    system_name: string | null;
    territory_name: string | null;
    territory_type: string | null;
    starts_at: string | null;
    ends_at: string | null;
    state: string | null;
    source: string;
    created_at: string;
    updated_at: string;
};

const launchRows: TerritoryRow[] = [
    {
        category: "Mining",
        item: "Raw Isogenite / Isogenite Geode",
        appliesTo: "Territory mining and refinery planning",
        watchFor:
            "1★/2★/3★ Raw Isogenite, Isogenite Geode drops, protected cargo pressure",
        dataNeeded: "Quick scans, mining logs, loot rows, system or territory name",
        status: "Live data detected",
    },
    {
        category: "Hostile",
        item: "Quantum Adjudicator 1★ / 2★ / 3★",
        appliesTo: "Territory hostile farming",
        watchFor:
            "Ship restrictions, Isolytic Damage, Apex Barrier, Apex Shred, critical damage floor",
        dataNeeded:
            "Target id, target level, hostile family alias, battle-log evidence",
        status: "Live data detected",
    },
    {
        category: "Hostile",
        item: "Quantum Guardian 1★ / 2★ / 3★",
        appliesTo: "Rare spawn handling",
        watchFor: "Spawn source, loot value, survivability, best burst crew",
        dataNeeded:
            "Resolved hostile name, loot page capture, kill time, hull loss",
        status: "Live data detected",
    },
    {
        category: "Armada",
        item: "Quantum Tesseract 2★ / 3★ / 4★",
        appliesTo: "Solo/group armadas in refreshed TC",
        watchFor:
            "Participant damage share, crit floor, iso damage, armada loot split",
        dataNeeded:
            "Group participant table rows, rewards, officer trigger summary",
        status: "Live data detected",
    },
    {
        category: "Service",
        item: "Dynamic Seasonal Services",
        appliesTo: "Territory ownership priority",
        watchFor:
            "Buff name, service tier, duration, active season, affected ship or stat",
        dataNeeded: "Service catalog rows, source note, active/inactive timestamp",
        status: "Needs loot data",
    },
    {
        category: "Planning",
        item: "Alliance TC Priority",
        appliesTo: "Where the alliance should spend time first",
        watchFor:
            "Reward value, service value, player ops coverage, travel path, defense pressure",
        dataNeeded:
            "Territory inventory, player needs, battle evidence, mining output",
        status: "Ready",
    },
];

const mechanics = [
    {
        title: "Critical Damage Floor",
        detail:
            "New territory enemies may force a high critical-damage baseline. Treat crit mitigation and survivability as first-class metrics, not side notes.",
    },
    {
        title: "Isolytic Pressure",
        detail:
            "Quantum targets appear built around Isolytic Damage and Isolytic Defense. Normal mitigation alone may not explain survival.",
    },
    {
        title: "Apex Barrier / Shred",
        detail:
            "Apex Barrier and Apex Shred need to be tracked alongside hull loss and damage exchange so crew rankings do not over-credit raw damage.",
    },
    {
        title: "Ship Restrictions",
        detail:
            "Some territory hostiles may require specific ship families or grades. The MCP should flag impossible fights before recommending crews.",
    },
];

function statusColor(status: TerritoryRow["status"]) {
    if (status === "Ready" || status === "Live data detected") return "success";
    if (status === "Needs loot data") return "warning";
    return "default";
}

function authHeaders(token: string) {
    return token.trim()
        ? {
            Authorization: `Bearer ${token.trim()}`,
            "content-type": "application/json",
        }
        : { "content-type": "application/json" };
}

function formatDateTime(value: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatOffset(minutes: number) {
    if (minutes === 0) return "When active";
    if (minutes % 1440 === 0) return `${minutes / 1440}d before`;
    if (minutes % 60 === 0) return `${minutes / 60}h before`;
    return `${minutes}m before`;
}

function buildMcpContext(rows: TerritoryRow[]) {
    return [
        "STFC Update 92 Territory Refresh context",
        "Live data refreshed: June 25, 2026. STFC.space data version 7c7f4e58-89af-4b80-8f7f-13a8141632c0.",
        "Goal: help the alliance classify and analyze new Territory Capture mining, hostile, armada, and service data using observed battle logs and game-data aliases.",
        "",
        "Known mechanics to account for:",
        "- Critical Damage Floor",
        "- Isolytic Damage and Isolytic Defense",
        "- Apex Barrier and Apex Shred",
        "- possible ship restrictions by hostile tier",
        "- dynamic seasonal territory services",
        "",
        "Data rows to watch:",
        ...rows.map(
            (row) =>
                `- ${row.category}: ${row.item}; applies to ${row.appliesTo}; watch for ${row.watchFor}; data needed ${row.dataNeeded}.`,
        ),
        "",
        "When analyzing battle logs, classify the encounter first, then compare only similar territory hostiles, territory armadas, or territory mining outcomes.",
    ].join("\n");
}

export function TerritoryRefresh() {
    const [category, setCategory] = React.useState("All");
    const [query, setQuery] = React.useState("");
    const [copied, setCopied] = React.useState(false);
    const [discordBindCode, setDiscordBindCode] = React.useState<{
        code: string;
        command: string;
        expires_at: string;
    } | null>(null);
    const [discordBindError, setDiscordBindError] = React.useState<string | undefined>();
    const [generatingBindCode, setGeneratingBindCode] = React.useState(false);
    const [accessToken, setAccessToken] = React.useState(
        () => localStorage.getItem("stfcBattleAccessToken") ?? "",
    );

    const [zoneNumber, setZoneNumber] = React.useState(1);
    const [systemName, setSystemName] = React.useState("");
    const [territoryName, setTerritoryName] = React.useState("");
    const [territoryType, setTerritoryType] = React.useState("Mining");
    const [startsAt, setStartsAt] = React.useState("");
    const [note, setNote] = React.useState("");
    const [reminderOffsets, setReminderOffsets] = React.useState<number[]>([
        1440, 60, 15, 0,
    ]);
    const [reminderMessage, setReminderMessage] = React.useState<
        string | undefined
    >();
    const [reminderError, setReminderError] = React.useState<
        string | undefined
    >();
    const [savingReminder, setSavingReminder] = React.useState(false);
    const [slotSearch, setSlotSearch] = React.useState("");
    const [selectedSlotIds, setSelectedSlotIds] = React.useState<string[]>([]);
    const trimmedAccessToken = accessToken.trim();

    const rows = launchRows.filter((row) => {
        const categoryMatch = category === "All" || row.category === category;
        const text =
            `${row.category} ${row.item} ${row.appliesTo} ${row.watchFor} ${row.dataNeeded}`.toLowerCase();
        return categoryMatch && text.includes(query.trim().toLowerCase());
    });

    const copyContext = async () => {
        await navigator.clipboard.writeText(buildMcpContext(launchRows));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    };

    const updateAccessToken = React.useCallback((value: string) => {
        setAccessToken(value);
        const trimmed = value.trim();
        if (trimmed) {
            localStorage.setItem("stfcBattleAccessToken", trimmed);
        } else {
            localStorage.removeItem("stfcBattleAccessToken");
        }
    }, []);

    const generateDiscordBindCode = React.useCallback(async () => {
        setDiscordBindError(undefined);
        setDiscordBindCode(null);
        if (!trimmedAccessToken) {
            setDiscordBindError("Enter your alliance token first.");
            return;
        }

        setGeneratingBindCode(true);
        try {
            const response = await fetch(`${LOCAL_SYNC_BASE_URL}/discord/bind-codes`, {
                method: "POST",
                headers: authHeaders(trimmedAccessToken),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(result?.error ?? `Could not create bind code: ${response.status}`);
            }
            setDiscordBindCode({
                code: result.code,
                command: result.command,
                expires_at: result.expires_at,
            });
        } catch (error) {
            setDiscordBindError(error instanceof Error ? error.message : "Could not create bind code");
        } finally {
            setGeneratingBindCode(false);
        }
    }, [trimmedAccessToken]);

    const copyDiscordBindCommand = React.useCallback(async () => {
        if (!discordBindCode?.command) return;
        await navigator.clipboard.writeText(discordBindCode.command);
    }, [discordBindCode]);

    const reminders = useQuery({
        queryKey: ["territory-reminders", trimmedAccessToken],
        queryFn: async () => {
            const response = await fetch(
                `${LOCAL_SYNC_BASE_URL}/territory/reminders?limit=100`,
                {
                    headers: trimmedAccessToken
                        ? { Authorization: `Bearer ${trimmedAccessToken}` }
                        : {},
                },
            );
            if (!response.ok) {
                throw new Error(
                    response.status === 401 || response.status === 403
                        ? "Enter a valid access token to load TC reminders"
                        : `Could not load TC reminders: ${response.status}`,
                );
            }
            return (await response.json()) as {
                count: number;
                reminders: TerritoryReminder[];
            };
        },
        enabled: !!trimmedAccessToken,
        refetchInterval: 60000,
    });

    const territorySlots = useQuery({
        queryKey: ["territory-slots", trimmedAccessToken, slotSearch],
        queryFn: async () => {
            const params = new URLSearchParams({ limit: "250" });
            if (slotSearch.trim()) params.set("system", slotSearch.trim());
            const response = await fetch(
                `${LOCAL_SYNC_BASE_URL}/territory/slots?${params}`,
                {
                    headers: trimmedAccessToken
                        ? { Authorization: `Bearer ${trimmedAccessToken}` }
                        : {},
                },
            );
            if (!response.ok) {
                throw new Error(
                    response.status === 401 || response.status === 403
                        ? "Enter a valid access token to load territory slots"
                        : `Could not load territory slots: ${response.status}`,
                );
            }
            return (await response.json()) as {
                count: number;
                slots: TerritorySlot[];
            };
        },
        enabled: !!trimmedAccessToken,
        refetchInterval: 60000,
    });

    const visibleSlots = territorySlots.data?.slots ?? [];
    const selectedSlots = visibleSlots.filter((slot) =>
        selectedSlotIds.includes(slot.slot_id),
    );

    const toggleOffset = React.useCallback((minutes: number) => {
        setReminderOffsets((current) =>
            current.includes(minutes)
                ? current.filter((entry) => entry !== minutes)
                : [...current, minutes].sort((a, b) => b - a),
        );
    }, []);

    const createReminder = React.useCallback(async () => {
        setReminderMessage(undefined);
        setReminderError(undefined);
        if (!trimmedAccessToken) {
            setReminderError("Enter your alliance token first.");
            return;
        }
        if (!systemName.trim() || !startsAt) {
            setReminderError("System name and TC time are required.");
            return;
        }

        setSavingReminder(true);
        try {
            const startDate = new Date(startsAt);
            const response = await fetch(
                `${LOCAL_SYNC_BASE_URL}/territory/reminders`,
                {
                    method: "POST",
                    headers: authHeaders(trimmedAccessToken),
                    body: JSON.stringify({
                        zone_number: zoneNumber,
                        system_name: systemName.trim(),
                        territory_name: territoryName.trim() || null,
                        territory_type: territoryType,
                        starts_at: startDate.toISOString(),
                        local_time_label: startDate.toLocaleString(),
                        reminder_offsets: reminderOffsets,
                        discord_channel_label: "SwatBot bound channel",
                        note: note.trim() || null,
                    }),
                },
            );
            const result = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(
                    result?.error ?? `Could not save reminder: ${response.status}`,
                );

            setReminderMessage("TC reminder saved. SwatBot will post it when one of the selected alert windows is due.");
            setSystemName("");
            setTerritoryName("");
            setNote("");
            await reminders.refetch();
        } catch (error) {
            setReminderError(
                error instanceof Error ? error.message : "Could not save reminder",
            );
        } finally {
            setSavingReminder(false);
        }
    }, [
        note,
        reminderOffsets,
        reminders,
        startsAt,
        systemName,
        territoryName,
        territoryType,
        trimmedAccessToken,
        zoneNumber,
    ]);

    const createRemindersForSelectedSlots = React.useCallback(async () => {
        setReminderMessage(undefined);
        setReminderError(undefined);
        if (!trimmedAccessToken) {
            setReminderError("Enter your alliance token first.");
            return;
        }
        if (!selectedSlots.length) {
            setReminderError("Select at least one territory slot.");
            return;
        }

        setSavingReminder(true);
        try {
            let saved = 0;
            for (const slot of selectedSlots) {
                const sourceTime = slot.starts_at ?? startsAt;
                const startDate = sourceTime ? new Date(sourceTime) : null;
                if (!startDate || Number.isNaN(startDate.getTime())) {
                    throw new Error(
                        `Set a TC window for ${slot.system_name ?? slot.territory_name ?? slot.slot_id}.`,
                    );
                }

                const response = await fetch(
                    `${LOCAL_SYNC_BASE_URL}/territory/reminders`,
                    {
                        method: "POST",
                        headers: authHeaders(trimmedAccessToken),
                        body: JSON.stringify({
                            zone_number: slot.zone_number ?? zoneNumber,
                            system_id: slot.system_id,
                            system_name:
                                slot.system_name ?? slot.territory_name ?? "Unknown territory",
                            territory_name: slot.territory_name,
                            territory_type: slot.territory_type ?? territoryType,
                            starts_at: startDate.toISOString(),
                            local_time_label: startDate.toLocaleString(),
                            reminder_offsets: reminderOffsets,
                            discord_channel_label: "SwatBot bound channel",
                            note: note.trim() || null,
                        }),
                    },
                );
                const result = await response.json().catch(() => ({}));
                if (!response.ok)
                    throw new Error(
                        result?.error ?? `Could not save reminder: ${response.status}`,
                    );
                saved += 1;
            }

            setReminderMessage(
                `Saved ${saved} TC reminder${saved === 1 ? "" : "s"}. SwatBot will post each one when its alert window is due.`,
            );
            setSelectedSlotIds([]);
            await reminders.refetch();
        } catch (error) {
            setReminderError(
                error instanceof Error
                    ? error.message
                    : "Could not save selected reminders",
            );
        } finally {
            setSavingReminder(false);
        }
    }, [
        note,
        reminderOffsets,
        reminders,
        selectedSlots,
        startsAt,
        territoryType,
        trimmedAccessToken,
        zoneNumber,
    ]);

    const deleteReminder = React.useCallback(
        async (id: number) => {
            setReminderMessage(undefined);
            setReminderError(undefined);
            try {
                const response = await fetch(
                    `${LOCAL_SYNC_BASE_URL}/territory/reminders/${id}`,
                    {
                        method: "DELETE",
                        headers: authHeaders(trimmedAccessToken),
                    },
                );
                const result = await response.json().catch(() => ({}));
                if (!response.ok)
                    throw new Error(
                        result?.error ?? `Could not delete reminder: ${response.status}`,
                    );
                setReminderMessage("TC reminder deleted.");
                await reminders.refetch();
            } catch (error) {
                setReminderError(
                    error instanceof Error ? error.message : "Could not delete reminder",
                );
            }
        },
        [reminders, trimmedAccessToken],
    );

    return (
        <Frame title="Territory Refresh">
            <Stack spacing={3}>
                <Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <MapIcon color="primary" />
                        <Typography variant="h4" component="h1">
                            Update 92 Territory Refresh
                        </Typography>
                    </Stack>
                    <Typography color="text.secondary" sx={{ maxWidth: 980 }}>
                        Launch-day planning board for the refreshed Territory Capture loop.
                        This page is a working reference until the new game data and battle
                        logs are collected.
                    </Typography>
                </Box>

                <Alert severity="info">
                    Live game data has been refreshed for Update 92. Treat the new Quantum
                    rankings as provisional until alliance battle logs and loot rows start
                    populating.
                </Alert>

                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack
                                direction={{ xs: "column", md: "row" }}
                                spacing={2}
                                justifyContent="space-between"
                            >
                                <Box>
                                    <Typography variant="h6">
                                        Territory Discord Reminders
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Save zone 1-5 windows by star system, then post the reminder
                                        to your alliance Discord.
                                    </Typography>
                                </Box>
                                <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1.5}
                                    alignItems={{ xs: "stretch", sm: "center" }}
                                >
                                    <TextField
                                        label="Access token"
                                        type="password"
                                        size="small"
                                        value={accessToken}
                                        onChange={(event) => updateAccessToken(event.target.value)}
                                        sx={{ minWidth: { sm: 320 } }}
                                    />
                                    <Button
                                        variant="outlined"
                                        startIcon={<RefreshIcon />}
                                        onClick={() => reminders.refetch()}
                                        disabled={!trimmedAccessToken || reminders.isFetching}
                                    >
                                        Refresh
                                    </Button>
                                </Stack>
                            </Stack>

                            {trimmedAccessToken && (
                                <Alert severity="info">
                                    <Stack spacing={1.5}>
                                        <Typography variant="body2">
                                            Discord delivery is handled by SwatBot. Generate a
                                            one-time bind code here, then run the shown command in
                                            the Discord channel that should receive TC alerts.
                                            Saved reminders are queued and posted when their alert
                                            window is due; they are not sent immediately unless an
                                            offset is already due.
                                        </Typography>
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={generateDiscordBindCode}
                                                disabled={generatingBindCode}
                                            >
                                                {generatingBindCode ? "Generating..." : "Generate Discord Bind Code"}
                                            </Button>
                                            {discordBindCode ? (
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<ContentCopyIcon />}
                                                    onClick={copyDiscordBindCommand}
                                                >
                                                    Copy /tc-bind-code
                                                </Button>
                                            ) : null}
                                        </Stack>
                                        {discordBindCode ? (
                                            <Box sx={{ fontFamily: "monospace", fontSize: 13, wordBreak: "break-word" }}>
                                                {discordBindCode.command}
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Expires {formatDateTime(discordBindCode.expires_at)} and can only be used once.
                                                </Typography>
                                            </Box>
                                        ) : null}
                                        {discordBindError ? <Alert severity="error">{discordBindError}</Alert> : null}
                                    </Stack>
                                </Alert>
                            )}

                            {reminderMessage ? (
                                <Alert severity="success">{reminderMessage}</Alert>
                            ) : null}
                            {reminderError ? (
                                <Alert severity="error">{reminderError}</Alert>
                            ) : null}
                            {!trimmedAccessToken ? (
                                <Alert severity="info">
                                    Enter your alliance token to load or create TC reminders.
                                </Alert>
                            ) : null}
                            {reminders.isError ? (
                                <Alert severity="error">
                                    {reminders.error instanceof Error
                                        ? reminders.error.message
                                        : "Could not load TC reminders"}
                                </Alert>
                            ) : null}
                            {territorySlots.isError ? (
                                <Alert severity="warning">
                                    {territorySlots.error instanceof Error
                                        ? territorySlots.error.message
                                        : "Could not load territory slots"}
                                </Alert>
                            ) : null}

                            {trimmedAccessToken && (
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Create Custom TC Reminder
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: {
                                                xs: "1fr",
                                                sm: "1fr 1fr",
                                                md: "repeat(4, 1fr) 1.5fr 1fr",
                                            },
                                            gap: 2,
                                        }}
                                    >
                                        <TextField
                                            select
                                            label="Zone"
                                            size="small"
                                            value={zoneNumber}
                                            onChange={(e) => setZoneNumber(Number(e.target.value))}
                                        >
                                            {[1, 2, 3, 4, 5].map((z) => (
                                                <MenuItem key={z} value={z}>
                                                    Zone {z}
                                                </MenuItem>
                                            ))}
                                        </TextField>

                                        <TextField
                                            label="Star system"
                                            size="small"
                                            required
                                            value={systemName}
                                            onChange={(e) => setSystemName(e.target.value)}
                                        />

                                        <TextField
                                            label="Territory name"
                                            size="small"
                                            value={territoryName}
                                            onChange={(e) => setTerritoryName(e.target.value)}
                                        />

                                        <TextField
                                            select
                                            label="Type"
                                            size="small"
                                            value={territoryType}
                                            onChange={(e) => setTerritoryType(e.target.value)}
                                        >
                                            {["Mining", "Hostile", "Armada", "Service"].map((t) => (
                                                <MenuItem key={t} value={t}>
                                                    {t}
                                                </MenuItem>
                                            ))}
                                        </TextField>

                                        <TextField
                                            label="TC window start"
                                            type="datetime-local"
                                            size="small"
                                            required
                                            value={startsAt}
                                            onChange={(e) => setStartsAt(e.target.value)}
                                            InputLabelProps={{ shrink: true }}
                                        />

                                        <TextField
                                            label="Discord delivery"
                                            size="small"
                                            value="SwatBot bound channel"
                                            InputProps={{ readOnly: true }}
                                            helperText="Generate a bind code above, then run /tc-bind-code in Discord."
                                        />
                                    </Box>

                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                            Trigger offsets (Select matching dynamic warning intervals)
                                        </Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap">
                                            {[1440, 120, 60, 30, 15, 5, 0].map((minutes) => {
                                                const active = reminderOffsets.includes(minutes);
                                                return (
                                                    <Chip
                                                        key={minutes}
                                                        label={formatOffset(minutes)}
                                                        color={active ? "primary" : "default"}
                                                        variant={active ? "filled" : "outlined"}
                                                        onClick={() => toggleOffset(minutes)}
                                                        size="small"
                                                        sx={{ cursor: "pointer" }}
                                                    />
                                                );
                                            })}
                                        </Stack>
                                    </Box>

                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
                                        <TextField
                                            label="Reminder text/notes (Optional tagging or rules)"
                                            size="small"
                                            fullWidth
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder="Crew rules, line priorities or specific roles assigned"
                                        />
                                        <Button
                                            variant="contained"
                                            startIcon={<AddAlertIcon />}
                                            onClick={createReminder}
                                            disabled={savingReminder}
                                            sx={{ minWidth: 160, height: 40 }}
                                        >
                                            {savingReminder ? "Saving..." : "Save Reminder"}
                                        </Button>
                                    </Stack>
                                </Stack>
                            )}

                            {trimmedAccessToken && reminders.data?.reminders && reminders.data.reminders.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        Active Saved Alliance Reminders ({reminders.data.count})
                                    </Typography>
                                    <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: "action.hover" }}>
                                                <TableRow>
                                                    <TableCell>Zone</TableCell>
                                                    <TableCell>System / Nodes</TableCell>
                                                    <TableCell>Type</TableCell>
                                                    <TableCell>Window Start Time</TableCell>
                                                    <TableCell>Alert Windows</TableCell>
                                                    <TableCell>Delivery</TableCell>
                                                    <TableCell>Status/Error</TableCell>
                                                    <TableCell align="right">Controls</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {reminders.data.reminders.map((rem) => (
                                                    <TableRow key={rem.reminder_id} hover>
                                                        <TableCell>Zone {rem.zone_number}</TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight="bold">
                                                                {rem.system_name}
                                                            </Typography>
                                                            {rem.territory_name && (
                                                                <Typography variant="caption" color="text.secondary" display="block">
                                                                    {rem.territory_name}
                                                                </Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip label={rem.territory_type ?? "Mining"} size="small" variant="outlined" />
                                                        </TableCell>
                                                        <TableCell>{formatDateTime(rem.starts_at)}</TableCell>
                                                        <TableCell>
                                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ maxWidth: 220 }}>
                                                                {rem.reminder_offsets.map((offset) => (
                                                                    <Chip key={offset} label={formatOffset(offset)} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                                                                ))}
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell>
                                                            {rem.discord_channel_label ? (
                                                                <Typography variant="body2">{rem.discord_channel_label}</Typography>
                                                            ) : (
                                                                <Typography variant="caption" color="text.secondary">SwatBot bound channel</Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {rem.posted_discord_at ? (
                                                                <Box title={`Posted at: ${new Date(rem.posted_discord_at).toLocaleString()}`} component="span">
                                                                    <Chip label="Delivered" color="success" size="small" />
                                                                </Box>
                                                            ) : rem.last_error ? (
                                                                <Chip label={rem.last_error} color="error" size="small" variant="outlined" />
                                                            ) : (
                                                                <Chip label={rem.status} color="info" size="small" variant="outlined" />
                                                            )}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                                <Button
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => deleteReminder(rem.reminder_id)}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </Button>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}

                            {trimmedAccessToken && (
                                <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                                        <Box>
                                            <Typography variant="subtitle2">Scraped Territory Engine Slots</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Select scraped data slots directly below to batch initialize reminders.
                                            </Typography>
                                        </Box>
                                        <TextField
                                            label="Search star systems"
                                            size="small"
                                            value={slotSearch}
                                            onChange={(e) => setSlotSearch(e.target.value)}
                                            placeholder="Filter rows..."
                                        />
                                    </Stack>

                                    {territorySlots.isPending ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Loading slots...</Typography>
                                    ) : visibleSlots.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No dynamic slots matching criteria discovered.</Typography>
                                    ) : (
                                        <Stack spacing={1}>
                                            <TableContainer sx={{ maxHeight: 280, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                                                <Table size="small" stickyHeader>
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell padding="checkbox" />
                                                            <TableCell>Zone</TableCell>
                                                            <TableCell>System Name</TableCell>
                                                            <TableCell>Type</TableCell>
                                                            <TableCell>Starts At</TableCell>
                                                            <TableCell>State</TableCell>
                                                            <TableCell>Source</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {visibleSlots.map((slot) => {
                                                            const isChecked = selectedSlotIds.includes(slot.slot_id);
                                                            return (
                                                                <TableRow key={slot.slot_id} hover selected={isChecked}>
                                                                    <TableCell padding="checkbox">
                                                                        <Checkbox
                                                                            size="small"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    setSelectedSlotIds((prev) => [...prev, slot.slot_id]);
                                                                                } else {
                                                                                    setSelectedSlotIds((prev) => prev.filter((id) => id !== slot.slot_id));
                                                                                }
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>{slot.zone_number ? `Zone ${slot.zone_number}` : "-"}</TableCell>
                                                                    <TableCell><strong>{slot.system_name ?? slot.territory_name ?? "Unknown"}</strong></TableCell>
                                                                    <TableCell>{slot.territory_type ?? "-"}</TableCell>
                                                                    <TableCell>{formatDateTime(slot.starts_at)}</TableCell>
                                                                    <TableCell>{slot.state ?? "-"}</TableCell>
                                                                    <TableCell><Chip label={slot.source} size="small" sx={{ fontSize: "0.65rem" }} /></TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                size="small"
                                                disabled={selectedSlotIds.length === 0 || savingReminder}
                                                onClick={createRemindersForSelectedSlots}
                                                sx={{ alignSelf: "flex-end" }}
                                            >
                                                Batch Save Selected ({selectedSlotIds.length})
                                            </Button>
                                        </Stack>
                                    )}
                                </Box>
                            )}
                        </Stack>
                    </CardContent>
                </Card>

                <Card variant="outlined">
                    <CardContent>
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={2}
                            sx={{ mb: 2 }}
                        >
                            <Box>
                                <Typography variant="h6">Update 92 Reference Data</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Filter classifications of provisional game rules and observed metrics.
                                </Typography>
                            </Box>
                            <Button
                                variant="outlined"
                                startIcon={<ContentCopyIcon />}
                                onClick={copyContext}
                                color={copied ? "success" : "primary"}
                            >
                                {copied ? "Copied context!" : "Copy Context for MCP"}
                            </Button>
                        </Stack>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
                            <TextField
                                select
                                label="Category Filter"
                                size="small"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                sx={{ minWidth: 160 }}
                            >
                                {["All", "Mining", "Hostile", "Armada", "Service", "Planning"].map(
                                    (cat) => (
                                        <MenuItem key={cat} value={cat}>
                                            {cat}
                                        </MenuItem>
                                    ),
                                )}
                            </TextField>
                            <TextField
                                label="Search reference metrics"
                                size="small"
                                fullWidth
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search items, watch metrics, or data requirements..."
                            />
                        </Stack>

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Category</TableCell>
                                        <TableCell>Item</TableCell>
                                        <TableCell>Applies To</TableCell>
                                        <TableCell>Watch For</TableCell>
                                        <TableCell>Data Needed</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={`${row.category}-${row.item}`} hover>
                                            <TableCell>{row.category}</TableCell>
                                            <TableCell>{row.item}</TableCell>
                                            <TableCell>{row.appliesTo}</TableCell>
                                            <TableCell>{row.watchFor}</TableCell>
                                            <TableCell>{row.dataNeeded}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    color={statusColor(row.status)}
                                                    label={row.status}
                                                    variant={
                                                        row.status === "Ready" ? "filled" : "outlined"
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>

                <Box>
                    <Typography variant="h6" sx={{ mb: 1.5 }}>
                        Observed Mechanics Index
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                            gap: 2,
                        }}
                    >
                        {mechanics.map((mech) => (
                            <Card key={mech.title} variant="outlined" sx={{ bgcolor: "background.paper" }}>
                                <CardContent>
                                    <Typography variant="subtitle2" fontWeight="bold" color="primary" gutterBottom>
                                        {mech.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {mech.detail}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                </Box>
            </Stack>
        </Frame>
    );
}

