import * as React from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    FormControlLabel,
    Link,
    MenuItem,
    Stack,
    Switch,
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
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { Frame } from "../components/Frame";

type TaskCategory = {
    name: string;
    points: number;
    credits: number;
    legendaryCredits: number;
    rerolls: number;
    grade: string;
    notes: string;
};

type TournamentTask = {
    task: string;
    category: string;
    grade: string;
    spendType: "No purchase" | "No purchase, prep needed" | "Premium";
    prep: string;
};

const sourceUrl = "https://startrekfleetcommand.com/news/alliance-tournaments-updates/";

const categories: TaskCategory[] = [
    {
        name: "Legacy Standard",
        points: 5000,
        credits: 275,
        legendaryCredits: 0,
        rerolls: 0,
        grade: "G2+",
        notes: "Regular gameplay and saved resources. Best participation floor for mixed alliances.",
    },
    {
        name: "Legacy Heroic",
        points: 10000,
        credits: 4400,
        legendaryCredits: 0,
        rerolls: 0,
        grade: "G2+",
        notes: "Existing heroic tasks return mostly unchanged, with some grade limits.",
    },
    {
        name: "Seasonal Standard",
        points: 10000,
        credits: 550,
        legendaryCredits: 220,
        rerolls: 0,
        grade: "Usually G3+",
        notes: "Gameplay-based tasks tied to newer systems such as Ascension and Academy.",
    },
    {
        name: "Seasonal Advanced",
        points: 15000,
        credits: 550,
        legendaryCredits: 550,
        rerolls: 1,
        grade: "Usually G3+",
        notes: "Higher engagement with newer loops. May require saved resources or regular participation.",
    },
    {
        name: "Seasonal Elite",
        points: 20000,
        credits: 3300,
        legendaryCredits: 1100,
        rerolls: 2,
        grade: "Usually G3+",
        notes: "Longer accumulation tasks. Some may not be completable from zero in one tournament.",
    },
    {
        name: "Premium",
        points: 20000,
        credits: 4400,
        legendaryCredits: 4400,
        rerolls: 3,
        grade: "Segmented",
        notes: "Purchase-oriented tasks remain, but the excessive Update 90 requirements were removed.",
    },
];

const scoringRows = [
    { delta: "Hostile 3+ levels above you", points: 21 },
    { delta: "Hostile 2 levels above you", points: 13 },
    { delta: "Hostile 1 level above you", points: 8 },
    { delta: "Same level", points: 5 },
    { delta: "Hostile 1 level below you", points: 3 },
    { delta: "Hostile 2 levels below you", points: 2 },
    { delta: "Hostile 3+ levels below you", points: 1 },
];

const newTasks: TournamentTask[] = [
    { task: "Acquire 6,600 Maverick Credits", category: "Seasonal Standard", grade: "G5, G6, G7", spendType: "No purchase", prep: "Save Maverick credit income before tournament." },
    { task: "Defeat 3 Uncommon Conqueror Borg Solo Armadas", category: "Seasonal Advanced", grade: "G5, G6, G7", spendType: "No purchase, prep needed", prep: "Save directives and confirm solo armada crews." },
    { task: "Acquire 2,250 Exotic Spirits Shipments", category: "Premium", grade: "G5, G6, G7", spendType: "Premium", prep: "Purchase-oriented. Re-roll if avoiding spend." },
    { task: "Defeat 1 Uncommon Conqueror Borg Solo Armada", category: "Seasonal Standard", grade: "G5, G6, G7", spendType: "No purchase", prep: "Keep at least one run ready." },
    { task: "Acquire 150 Borg Sphere Parts", category: "Seasonal Advanced", grade: "G5, G6, G7", spendType: "No purchase, prep needed", prep: "Save Sphere part claims." },
    { task: "Earn 800 points by defeating Conqueror Borg Suppressor Hostiles", category: "Seasonal Elite", grade: "G5, G6, G7", spendType: "No purchase, prep needed", prep: "Time-heavy hostile grind; use higher-level targets when safe." },
    { task: "Defeat 400 points worth of Academy Training Drones", category: "Seasonal Standard", grade: "G6, G7", spendType: "No purchase", prep: "Use hostile calculator for kill count." },
    { task: "Acquire 150 Academy Engineering Credits", category: "Seasonal Standard", grade: "G6, G7", spendType: "No purchase", prep: "Hold credit claims if possible." },
    { task: "Acquire 1,800 Academy Engineering Credits", category: "Seasonal Standard", grade: "G6, G7", spendType: "No purchase", prep: "Save a larger credit bundle before accepting." },
    { task: "Acquire 200 Class Honors", category: "Seasonal Advanced", grade: "G6, G7", spendType: "No purchase, prep needed", prep: "Save Class Honors claims." },
    { task: "Acquire 6,250 Class Honors", category: "Premium", grade: "G6, G7", spendType: "Premium", prep: "Purchase-oriented. Re-roll if avoiding spend." },
    { task: "Defeat 400 points worth of Venari Ral Hostiles", category: "Seasonal Standard", grade: "G6, G7", spendType: "No purchase", prep: "Use hostile calculator for kill count." },
    { task: "Defeat 20 Duo Wave Defense Waves", category: "Seasonal Advanced", grade: "G6, G7", spendType: "No purchase, prep needed", prep: "Coordinate partner timing before tournament." },
    { task: "Acquire 200 Athena Ship Parts", category: "Seasonal Elite", grade: "G6, G7", spendType: "No purchase, prep needed", prep: "May need saved progress from multiple days." },
    { task: "Spend 15,000 Consulate Quantum Cores", category: "Seasonal Elite", grade: "G6, G7", spendType: "No purchase, prep needed", prep: "In-game spend. Save cores and spend only after task appears." },
    { task: "Spend 21,000 Consulate Quantum Cores", category: "Seasonal Elite", grade: "G6, G7", spendType: "No purchase, prep needed", prep: "In-game spend. Save cores and spend only after task appears." },
    { task: "Defeat 400 points worth of Federation Elite Assassins", category: "Seasonal Standard", grade: "G3, G4", spendType: "No purchase", prep: "Use hostile calculator for kill count." },
    { task: "Defeat 400 points worth of Klingon Elite Assassins", category: "Seasonal Standard", grade: "G3, G4", spendType: "No purchase", prep: "Use hostile calculator for kill count." },
    { task: "Defeat 400 points worth of Romulan Elite Assassins", category: "Seasonal Standard", grade: "G3, G4", spendType: "No purchase", prep: "Use hostile calculator for kill count." },
    { task: "Acquire 225 Ascension Particles", category: "Seasonal Advanced", grade: "G3, G4", spendType: "No purchase, prep needed", prep: "Save Ascension particle claims." },
    { task: "Acquire 240 Ascension Particles", category: "Seasonal Advanced", grade: "G3, G4", spendType: "No purchase, prep needed", prep: "Save Ascension particle claims." },
    { task: "Acquire 330 Ascension Particles", category: "Seasonal Advanced", grade: "G3, G4", spendType: "No purchase, prep needed", prep: "Save Ascension particle claims." },
    { task: "Acquire 675 Ascension Particles", category: "Seasonal Elite", grade: "G3, G4", spendType: "No purchase, prep needed", prep: "Longer saved-resource task." },
    { task: "Acquire 720 Ascension Particles", category: "Seasonal Elite", grade: "G3, G4", spendType: "No purchase, prep needed", prep: "Longer saved-resource task." },
    { task: "Acquire 990 Ascension Particles", category: "Seasonal Elite", grade: "G3, G4", spendType: "No purchase, prep needed", prep: "Longer saved-resource task." },
    { task: "Acquire 6,000 Ascension Particles", category: "Premium", grade: "G3, G4", spendType: "Premium", prep: "Purchase-oriented. Re-roll if avoiding spend." },
];

const returningHeroic = [
    "Acquire 6,000 Uncommon Ex-Borg Credits",
    "Acquire 55,000 Forbidden Tech Protomatter",
    "Acquire 15,000 Temporal Disruptors",
    "Acquire 1,500 Uncommon Skill Points",
    "Acquire 7,000 Galactic Recruit Tokens",
];

const gradeLimitedHeroic = [
    "Acquire 500 Epic Borg Solo Directives",
    "Acquire 500 Epic Dominion Solo Directives",
];

function formatNumber(value: number) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function hostilePoints(playerLevel: number, hostileLevel: number) {
    const diff = hostileLevel - playerLevel;
    if (diff >= 3) return 21;
    if (diff === 2) return 13;
    if (diff === 1) return 8;
    if (diff === 0) return 5;
    if (diff === -1) return 3;
    if (diff === -2) return 2;
    return 1;
}

function spendChipColor(spendType: TournamentTask["spendType"]) {
    if (spendType === "No purchase") return "success";
    if (spendType === "No purchase, prep needed") return "warning";
    return "error";
}

function copyTextForAlliance(playerLevel: number, hostileLevel: number) {
    const points = hostilePoints(playerLevel, hostileLevel);
    const kills400 = Math.ceil(400 / points);
    const kills800 = Math.ceil(800 / points);
    return [
        "Alliance Tournament prep",
        "Return date: July 16, 2026",
        "Stored re-roll cap increased from 40 to 60.",
        "Seasonal Advanced gives 1 re-roll, Seasonal Elite gives 2, Premium gives 3.",
        `Hostile scoring example: player L${playerLevel} vs hostile L${hostileLevel} = ${points} points per kill.`,
        `Estimated kills: ${kills400} for a 400-point task, ${kills800} for an 800-point task.`,
        "Focus by grade: G3-G4 Ascension and Elite Assassins; G5-G7 Conqueror Borg, Academy, Venari Ral, Athena, and Consulate tasks.",
        `Official source: ${sourceUrl}`,
    ].join("\n");
}

export function AllianceTournaments() {
    const [gradeFilter, setGradeFilter] = React.useState("All");
    const [freeOnly, setFreeOnly] = React.useState(false);
    const [playerLevel, setPlayerLevel] = React.useState(70);
    const [hostileLevel, setHostileLevel] = React.useState(73);
    const [copied, setCopied] = React.useState(false);

    const filteredTasks = React.useMemo(() => {
        return newTasks.filter((task) => {
            const gradeMatches = gradeFilter === "All" || task.grade.includes(gradeFilter);
            const spendMatches = !freeOnly || task.spendType !== "Premium";
            return gradeMatches && spendMatches;
        });
    }, [freeOnly, gradeFilter]);

    const freeTaskCount = filteredTasks.filter((task) => task.spendType !== "Premium").length;
    const premiumTaskCount = filteredTasks.filter((task) => task.spendType === "Premium").length;

    const points = hostilePoints(playerLevel, hostileLevel);
    const kills400 = Math.ceil(400 / points);
    const kills800 = Math.ceil(800 / points);

    const copySummary = React.useCallback(async () => {
        await navigator.clipboard.writeText(copyTextForAlliance(playerLevel, hostileLevel));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
    }, [hostileLevel, playerLevel]);

    return (
        <Frame title="Alliance Tournaments">
            <Stack spacing={3}>
                <Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <EmojiEventsIcon color="primary" />
                        <Typography variant="h4">Alliance Tournament Planner</Typography>
                        <Chip label="Returns Jul 16" color="primary" variant="outlined" />
                        <Chip label="Re-roll cap 60" color="success" variant="outlined" />
                    </Stack>
                    <Typography variant="body1" sx={{ mt: 1, maxWidth: 980 }}>
                        Task rewards, grade segments, hostile scoring, and prep notes based on Scopely's July 10 Alliance
                        Tournaments update.
                    </Typography>
                    <Link href={sourceUrl} target="_blank" rel="noreferrer">
                        Official Scopely source
                    </Link>
                </Box>

                <Alert severity="info">
                    Lower leagues award smaller tournament credit amounts than the Master League values shown here.
                    Treat this as a planning reference, not a live reward claim for every alliance bracket.
                </Alert>

                <Alert severity="success">
                    No-spend planning rule: keep Seasonal Standard tasks first, keep Seasonal Advanced or Elite tasks only
                    if the player already has the loop unlocked and saved resources, and re-roll Premium tasks when avoiding
                    real-money purchases.
                </Alert>

                <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
                    <Card sx={{ flex: 1 }}>
                        <CardContent>
                            <Typography variant="h6">What Changed</Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Stack spacing={1}>
                                <Typography>Excessive Update 90 premium requirements were removed.</Typography>
                                <Typography>Stored re-roll cap increased from 40 to 60.</Typography>
                                <Typography>Some completed tasks now award extra re-rolls.</Typography>
                                <Typography>Reputation bundles return to the Alliance Tournament Store.</Typography>
                                <Typography>Tasks are now segmented by grade eligibility.</Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1 }}>
                        <CardContent>
                            <Typography variant="h6">What Stayed</Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Stack spacing={1}>
                                <Typography>Limited re-rolls remain.</Typography>
                                <Typography>Premium tasks remain, but with the extreme requirements removed.</Typography>
                                <Typography>Existing heroic tasks return with prior requirements.</Typography>
                                <Typography>Some heroic tasks are now only available to G4-G5 players.</Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>

                <Card>
                    <CardContent>
                        <Typography variant="h6">Task Reward Structure</Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Category</TableCell>
                                        <TableCell align="right">Alliance Points</TableCell>
                                        <TableCell align="right">Tournament Credits</TableCell>
                                        <TableCell align="right">Legendary Credits</TableCell>
                                        <TableCell align="right">Re-rolls</TableCell>
                                        <TableCell>Grade</TableCell>
                                        <TableCell>Use</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {categories.map((category) => (
                                        <TableRow key={category.name}>
                                            <TableCell><strong>{category.name}</strong></TableCell>
                                            <TableCell align="right">{formatNumber(category.points)}</TableCell>
                                            <TableCell align="right">{formatNumber(category.credits)}</TableCell>
                                            <TableCell align="right">{formatNumber(category.legendaryCredits)}</TableCell>
                                            <TableCell align="right">{category.rerolls}</TableCell>
                                            <TableCell>{category.grade}</TableCell>
                                            <TableCell>{category.notes}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6">Hostile Task Scoring</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Higher-level hostiles complete point-based tasks faster.
                                </Typography>
                            </Box>
                            <TextField
                                label="Your level"
                                type="number"
                                size="small"
                                value={playerLevel}
                                onChange={(event) => setPlayerLevel(Number(event.target.value))}
                                sx={{ width: 140 }}
                            />
                            <TextField
                                label="Hostile level"
                                type="number"
                                size="small"
                                value={hostileLevel}
                                onChange={(event) => setHostileLevel(Number(event.target.value))}
                                sx={{ width: 150 }}
                            />
                            <Button startIcon={<ContentCopyIcon />} variant="outlined" onClick={copySummary}>
                                {copied ? "Copied" : "Copy Prep"}
                            </Button>
                        </Stack>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
                            <Alert severity="success" sx={{ flex: 1 }}>
                                L{playerLevel} vs L{hostileLevel}: <strong>{points} points per kill</strong>
                            </Alert>
                            <Alert severity="info" sx={{ flex: 1 }}>
                                400-point task: <strong>{kills400} kills</strong>
                            </Alert>
                            <Alert severity="info" sx={{ flex: 1 }}>
                                800-point task: <strong>{kills800} kills</strong>
                            </Alert>
                        </Stack>
                        <TableContainer sx={{ mt: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Level Difference</TableCell>
                                        <TableCell align="right">Points Per Kill</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {scoringRows.map((row) => (
                                        <TableRow key={row.delta}>
                                            <TableCell>{row.delta}</TableCell>
                                            <TableCell align="right">{row.points}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6">New Seasonal Tasks</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Filter by grade segment to see what your alliance members should prepare for.
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Chip color="success" variant="outlined" label={`${freeTaskCount} no-spend`} />
                                <Chip color="error" variant="outlined" label={`${premiumTaskCount} premium`} />
                            </Stack>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={freeOnly}
                                        onChange={(event) => setFreeOnly(event.target.checked)}
                                    />
                                }
                                label="No-spend only"
                            />
                            <TextField
                                select
                                label="Grade segment"
                                size="small"
                                value={gradeFilter}
                                onChange={(event) => setGradeFilter(event.target.value)}
                                sx={{ width: 180 }}
                            >
                                {["All", "G3", "G4", "G5", "G6", "G7"].map((grade) => (
                                    <MenuItem key={grade} value={grade}>{grade}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        <TableContainer sx={{ mt: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Task</TableCell>
                                        <TableCell>Category</TableCell>
                                        <TableCell>Spend</TableCell>
                                        <TableCell>Grade</TableCell>
                                        <TableCell>Prep note</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredTasks.map((task) => (
                                        <TableRow key={`${task.task}-${task.grade}`}>
                                            <TableCell>{task.task}</TableCell>
                                            <TableCell><Chip label={task.category} size="small" variant="outlined" /></TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={task.spendType}
                                                    size="small"
                                                    color={spendChipColor(task.spendType)}
                                                    variant={task.spendType === "No purchase" ? "filled" : "outlined"}
                                                />
                                            </TableCell>
                                            <TableCell>{task.grade}</TableCell>
                                            <TableCell>{task.prep}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>

                <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
                    <Card sx={{ flex: 1 }}>
                        <CardContent>
                            <Typography variant="h6">Heroic Tasks Still Available</Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Stack spacing={1}>
                                {returningHeroic.map((task) => (
                                    <Typography key={task}>{task}</Typography>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1 }}>
                        <CardContent>
                            <Typography variant="h6">G4-G5 Limited Heroic Tasks</Typography>
                            <Divider sx={{ my: 1.5 }} />
                            <Stack spacing={1}>
                                {gradeLimitedHeroic.map((task) => (
                                    <Typography key={task}>{task}</Typography>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </Stack>
        </Frame>
    );
}
