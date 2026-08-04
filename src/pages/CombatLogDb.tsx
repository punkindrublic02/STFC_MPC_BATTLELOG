import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Alert,
    Button,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
    Paper,
} from "@mui/material";
import { Frame } from "../components/Frame";


type BattleRow = {
    id: number;
    battle_id: number | null;
    battle_time: string | null;
    initiator_id: string | null;
    target_id: string | null;
    initiator_wins: number;
    parsed_at: string;
    parse_error: string | null;
};

export function CombatLogDb() {
    const navigate = useNavigate();
    const [isParsing, setIsParsing] = React.useState(false);

    const battles = useQuery({
        queryKey: ["db-stfc_events"],
        queryFn: async () => {
            const res = await fetch("/battles");
            if (!res.ok) throw new Error("failed to load battles");
            return (await res.json()) as BattleRow[];
        },
    });

    const handleParseLatest = async () => {
        setIsParsing(true);
        try {
            const res = await fetch("/parse-batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: 0 }),
            });

            if (!res.ok) {
                throw new Error("failed to parse latest events");
            }

            await battles.refetch();
        } catch (err) {
            console.error("Parse latest failed:", err);
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <Frame title="Battle Database">
            <Stack spacing={2} sx={{ p: 2 }}>
                <Typography variant="body2" color="textSecondary">
                    Showing the last 300 battles parsed from your local database.
                </Typography>

                <Button
                    variant="contained"
                    onClick={handleParseLatest}
                    disabled={isParsing}
                    sx={{ alignSelf: "flex-start" }}
                >
                    {isParsing ? "Parsing..." : "Parse Latest Events"}
                </Button>

                {battles.isLoading && (
                    <Typography variant="body2">Loading recent battles...</Typography>
                )}

                {battles.error && (
                    <Alert severity="error">Failed to load recent battles</Alert>
                )}

                <Paper variant="outlined" sx={{ maxHeight: "70vh", overflow: "auto" }}>
                    <List>
                        {(battles.data ?? []).map((row) => (
                            <ListItemButton
                                key={row.id}
                                onClick={() => navigate(`/combatlog/${row.id}`)}
                                divider
                            >
                                <ListItemText
                                    primary={`Event ${row.id} | Battle ${row.battle_id ?? "Unknown"}`}
                                    secondary={
                                        row.parse_error
                                            ? `Error: ${row.parse_error}`
                                            : `${row.battle_time ?? "No Time"} | ${row.initiator_id ?? "???"} vs ${row.target_id ?? "???"}`
                                    }
                                    secondaryTypographyProps={{
                                        color: row.parse_error ? "error" : "textSecondary",
                                    }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Paper>
            </Stack>
        </Frame>
    );
}