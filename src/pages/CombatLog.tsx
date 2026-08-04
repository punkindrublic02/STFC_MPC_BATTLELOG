import * as React from "react";
import { useState, memo, useEffect } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { useParams } from "react-router-dom";
import {
    Card,
    CardContent,
    Collapse,
    Typography,
    Grid,
    TextField,
    Button,
    MenuItem,
    ListItem,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Paper,
    Stack,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { Frame } from "../components/Frame";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AttackIcon, OfficerIcon, ChargeIcon } from "../components/GameIcon";
import {
    CombatLog,
    CombatLogRound,
    CombatLogRoundEvent,
    CombatLogShip,
    CombatLogOfficer,
} from "../util/combatLog";
import { CombatLogStats, gatherStats } from "../util/combatLogStats";
import { SimpleTable } from "../components/SimpleTable";
import { CollapsibleTable } from "../components/CollapsibleTable";
import { DropZone } from "../components/DropZone";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { LOCAL_SYNC_BASE_URL } from '../combatlog/components/CombatLog';
import { json } from "d3";
import { CombatLogParsedData, GameData, RawCombatLog } from "../combatlog/util/combatLog";


const AttackInlineDataHead = styled("div")(() => ({
    display: "inline-block",
    minWidth: "180px",
    textAlign: "left",
}));

const AttackInlineData = styled("div")(() => ({
    display: "inline-block",
    minWidth: "180px",
    textAlign: "right",
}));

const StyledCard = styled(Card)(() => ({
    display: "flex",
}));

const StyledCardContent = styled(CardContent)((_theme) => ({
    flex: "1 0 auto",
    paddingBottom: 0,
}));

function abbreviateNumber(x: number | undefined) {
    if (x === undefined) return "";
    const tier = (Math.log10(x) / 3) | 0;
    if (tier === 0) return "" + x;
    const suffix = ["", "k", "M", "B", "T", "Qa", "Qi"][tier];
    const scale = Math.pow(10, tier * 3);
    const scaled = x / scale;
    return scaled.toFixed(2) + suffix;
}

function isUsefulNumber(x: number | undefined | null): x is number {
    return x !== undefined && x !== null && !isNaN(x) && x !== Infinity && x !== -Infinity;
}

const formatNumber = (x: number) =>
    isUsefulNumber(x) ? (Math.round((x + Number.EPSILON) * 100) / 100).toLocaleString() : "";

const formatInt = (x: number | undefined) =>
    isUsefulNumber(x) ? Math.round(x).toLocaleString() : "";

const formatPercent = (x: number) =>
    isUsefulNumber(x) ? (x * 100).toFixed(0) + "%" : "";

interface ExpandingListRowProps {
    icon?: React.JSX.Element;
    text: string | React.JSX.Element;
    details: string | React.JSX.Element;
    className?: string;
    side: "initiator" | "target";
}

function ExpandingListRow(props: ExpandingListRowProps) {
    const { icon, text, details } = props;
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <ListItemButton onClick={() => setOpen(!open)}>
                {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
                <ListItemText primary={text} />
                {open ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={open} timeout="auto" unmountOnExit>
                {details}
            </Collapse>
        </>
    );
}

const StyledExpandingListRow = styled(ExpandingListRow, {
    shouldForwardProp: (prop) => prop !== "side",
})<ExpandingListRowProps>(({ side }) => ({
    ...(side === "initiator"
        ? { backgroundColor: "#e0f2f1" }
        : { backgroundColor: "#fce4ec" }),
}));

const ExpandingListRowM = memo(StyledExpandingListRow);

interface CombatRoundEventProps {
    event: CombatLogRoundEvent;
    ships: CombatLogShip[];
}

function CombatRoundEvent(props: CombatRoundEventProps) {
    const { event, ships } = props;

    switch (event.type) {
        case "attack": {
            const sideA: "initiator" | "target" =
                ships.find((s: CombatLogShip) => s.ship_id === event.ship)?.side === "initiator"
                    ? "initiator"
                    : "target";
            const damage_total =
                event.damage_taken_hull + event.damage_taken_shield + event.damage_mitigated;
            const mitigation = damage_total > 0 ? event.damage_mitigated / damage_total : 0;
            

            return (
                <ExpandingListRowM
                    side={sideA}
                    icon={<AttackIcon />}
                    text={
                        <>
                            <AttackInlineDataHead>
                                {event.ship} hits {event.target}
                                {event.crit ? " (critical)" : ""}
                            </AttackInlineDataHead>
                            <AttackInlineData>{formatInt(damage_total)} dmg</AttackInlineData>
                            <AttackInlineData>{formatInt(event.damage_mitigated)} mitigated</AttackInlineData>
                            <AttackInlineData>{formatInt(event.damage_taken_shield)} shield dmg</AttackInlineData>
                            <AttackInlineData>{formatInt(event.damage_taken_hull)} hull dmg</AttackInlineData>
                        </>
                    }
                    details={
                        <p>
                            &emsp;Weapon: {event.weapon}
                            <br />
                            &emsp;Mitigation: {formatPercent(mitigation)}
                            <br />
                            &emsp;Remaining shield: {formatInt(event.remaining_shield)}
                            <br />
                            &emsp;Remaining hull: {formatInt(event.remaining_hull)}
                        </p>
                    }
                />
            );
        }

        case "charge": {
            const sideC: "initiator" | "target" =
                ships.find((s: CombatLogShip) => s.ship_id === event.ship)?.side === "initiator"
                    ? "initiator"
                    : "target";

            return (
                <ExpandingListRowM
                    side={sideC}
                    icon={<ChargeIcon />}
                    text={<>{event.ship} charges a weapon to {formatPercent(event.charge)}.</>}
                    details={<p>&emsp;Weapon: {event.weapon}</p>}
                />
            );
        }

        case "ability": {
            const sideB: "initiator" | "target" =
                ships.find((s: CombatLogShip) => s.ship_id === event.ship)?.side === "initiator"
                    ? "initiator"
                    : "target";

            return (
                <ExpandingListRowM
                    side={sideB}
                    icon={<OfficerIcon />}
                    text={<>{event.ship} activates {event.officer}.</>}
                    details={
                        <p>
                            &emsp;Officer: {event.officer}
                            <br />
                            &emsp;Ability: {event.ability}
                            <br />
                            &emsp;Value: {formatNumber(event.value)}
                        </p>
                    }
                />
            );
        }

        default:
            return (
                <ExpandingListRowM
                    side="target"
                    icon={<OfficerIcon />}
                    text={<>Unknown event.</>}
                    details={
                        <p>
                            &emsp;Type: {(event as any).type}
                            <br />
                        </p>
                    }
                />
            );
    }
}

const CombatRoundEventM = memo(CombatRoundEvent);

interface CombatLogRoundCardProps {
    round: CombatLogRound;
    ships: CombatLogShip[];
}

function CombatLogRoundCard(props: CombatLogRoundCardProps) {
    const { round, ships } = props;

    return (
        <StyledCard>
            <StyledCardContent>
                <Typography gutterBottom variant="h5" component="h2">
                    Round {round.round}
                </Typography>
                <List>
                    {round.events.map((event, i) => (
                        <CombatRoundEventM event={event} ships={ships} key={i} />
                    ))}
                </List>
            </StyledCardContent>
        </StyledCard>
    );
}

const CombatLogRoundCardM = memo(CombatLogRoundCard);

interface CombatLogFleetCardProps {
    ships: CombatLogShip[];
}

function CombatLogFleetCard(props: CombatLogFleetCardProps) {
    const { ships } = props;

    return (
        <StyledCard>
            <StyledCardContent>
                <Typography gutterBottom variant="h5" component="h2">
                    Participants
                </Typography>
                <CollapsibleTable
                    columns={[
                        { label: "Side", align: "left" },
                        { label: "Name", align: "left" },
                        { label: "Ship", align: "left" },
                        { label: "Tier", align: "left" },
                        { label: "Level", align: "left" },
                        { label: "Officers", align: "left" },
                        { label: "Power", align: "left" },
                    ]}
                    data={ships.map((ship) => ({
                        cells: [
                            ship.side,
                            ship.ship_id,
                            ship.hull_name,
                            "" + ship.tier,
                            "" + ship.level,
                            ship.officers
                                .slice(0, 3)
                                .filter((o): o is CombatLogOfficer => o !== null)
                                .map((o) => o.name)
                                .join(" + "),
                            formatInt(ship.rating.offense + ship.rating.defense + ship.rating.health),
                        ],
                        details: (
                            <>
                                Officers - bridge:{" "}
                                {ship.officers
                                    .slice(0, 3)
                                    .filter((o): o is CombatLogOfficer => o !== null)
                                    .map((o) => `${o.name} (${o.level})`)
                                    .join(", ")}
                                <br />
                                Officers - below deck:{" "}
                                {ship.officers
                                    .slice(3)
                                    .filter((o): o is CombatLogOfficer => o !== null)
                                    .map((o) => `${o.name} (${o.level})`)
                                    .join(", ")}
                                <br />
                                Officer bonus - attack: {formatPercent(ship.officer_bonus.attack)}
                                <br />
                                Officer bonus - defense: {formatPercent(ship.officer_bonus.defense)}
                                <br />
                                Officer bonus - health: {formatPercent(ship.officer_bonus.health)}
                                <br />
                            </>
                        ),
                    }))}
                />
            </StyledCardContent>
        </StyledCard>
    );
}

const CombatLogFleetCardM = memo(CombatLogFleetCard);

interface CombatLogSummaryCardProps {
    combatLog: CombatLog;
    stats: CombatLogStats;
}

function CombatLogSummaryCard(props: CombatLogSummaryCardProps) {
    const { combatLog, stats } = props;

    let winnerHullDamage = 0;
    combatLog.ships.forEach((ship) => {
        const damage = stats.ships[ship.ship_id]?.hullDamageIn?.sum || 0;
        if (ship.side === "initiator" && combatLog.initiator_wins) {
            winnerHullDamage += damage;
        } else if (ship.side === "target" && !combatLog.initiator_wins) {
            winnerHullDamage += damage;
        }
    });

    return (
        <StyledCard>
            <StyledCardContent>
                <Typography gutterBottom variant="h5" component="h2">
                    Summary
                </Typography>
                <p>
                    {combatLog.initiator_wins ? "Initiator " : "Target "}wins in {combatLog.log.length} rounds.
                </p>
                <p>Winner takes {formatInt(winnerHullDamage)} hull damage.</p>
            </StyledCardContent>
        </StyledCard>
    );
}

const CombatLogSummaryCardM = memo(CombatLogSummaryCard);

interface CombatLogStatsDetailsProps {
    combatLog: CombatLog;
    stats: CombatLogStats;
}

function CombatLogDefensiveStats(props: CombatLogStatsDetailsProps) {
    const { combatLog, stats } = props;

    return (
        <SimpleTable
            columns={[
                { label: "Name", align: "left" },
                { label: "Attacks", align: "right" },
                { label: "Total damage", align: "right" },
                { label: "Min mitigation", align: "right" },
                { label: "Max mitigation", align: "right" },
                { label: "Shield dmg", align: "right" },
                { label: "Hull dmg", align: "right" },
                { label: "Shield depleted", align: "right" },
                { label: "Destroyed", align: "right" },
            ]}
            data={combatLog.ships.map((ship) => {
                const shipStats = stats.ships[ship.ship_id];
                return {
                    cells: [
                        ship.ship_id,
                        formatInt(shipStats.totalRawDamageIn.count),
                        abbreviateNumber(shipStats.totalRawDamageIn.sum),
                        formatPercent(shipStats.mitigationIn.min),
                        formatPercent(shipStats.mitigationIn.max),
                        abbreviateNumber(shipStats.shieldDamageIn.sum),
                        abbreviateNumber(shipStats.hullDamageIn.sum),
                        formatInt(shipStats.roundShieldDepleted),
                        formatInt(shipStats.roundDestroyed),
                    ],
                };
            })}
        />
    );
}

function CombatLogOffensiveStats(props: CombatLogStatsDetailsProps) {
    const { combatLog, stats } = props;

    return (
        <SimpleTable
            columns={[
                { label: "Name", align: "left" },
                { label: "Attacks", align: "right" },
                { label: "Crits", align: "right" },
                { label: "Total damage", align: "right" },
                { label: "Min mitigation", align: "right" },
                { label: "Max mitigation", align: "right" },
                { label: "Shield dmg", align: "right" },
                { label: "Hull dmg", align: "right" },
            ]}
            data={combatLog.ships.map((ship) => {
                const shipStats = stats.ships[ship.ship_id];
                return {
                    cells: [
                        ship.ship_id,
                        formatInt(shipStats.totalRawDamageOut.count),
                        formatInt(shipStats.critRawDamageOut.count),
                        abbreviateNumber(shipStats.totalRawDamageOut.sum),
                        formatPercent(shipStats.mitigationOut.min),
                        formatPercent(shipStats.mitigationOut.max),
                        abbreviateNumber(shipStats.shieldDamageOut.sum),
                        abbreviateNumber(shipStats.hullDamageOut.sum),
                    ],
                };
            })}
        />
    );
}

function CombatLogWeaponStats(props: CombatLogStatsDetailsProps) {
    const { combatLog, stats } = props;

    return (
        <SimpleTable
            columns={[
                { label: "Ship", align: "left" },
                { label: "Weapon", align: "left" },
                { label: "Hits", align: "right" },
                { label: "Min hit", align: "right" },
                { label: "Max hit", align: "right" },
                { label: "Crits", align: "right" },
                { label: "Min crit", align: "right" },
                { label: "Max crit", align: "right" },
            ]}
            data={combatLog.ships
                .flatMap((ship) => {
                    const shipStats = stats.ships[ship.ship_id];
                    if (shipStats === undefined) return [];
                    return Object.keys(shipStats.weapons).map((weaponId) => [
                        ship.ship_id,
                        weaponId,
                        formatInt(shipStats.weapons[weaponId].hitRawDamageOut.count),
                        formatInt(shipStats.weapons[weaponId].hitRawDamageOut.min),
                        formatInt(shipStats.weapons[weaponId].hitRawDamageOut.max),
                        formatInt(shipStats.weapons[weaponId].critRawDamageOut.count),
                        formatInt(shipStats.weapons[weaponId].critRawDamageOut.min),
                        formatInt(shipStats.weapons[weaponId].critRawDamageOut.max),
                    ]);
                })
                .map((rowData) => ({ cells: rowData }))}
        />
    );
}

function CombatLoBurningStats(props: CombatLogStatsDetailsProps) {
    const { combatLog, stats } = props;

    return (
        <>
            <p>
                "Hit point changes" are changes to remaining hull or shield hit points that do not originate
                from weapon attacks.
                <br />
                Those changes can come from burning effects, healing effects, or dynamic changes to officer stats.
            </p>
            <SimpleTable
                columns={[
                    { label: "Name", align: "left" },
                    { label: "Max HHP", align: "right" },
                    { label: "HHP change", align: "right" },
                    { label: "Max SHP", align: "right" },
                    { label: "SHP change", align: "right" },
                ]}
                data={combatLog.ships.map((ship) => {
                    const shipStats = stats.ships[ship.ship_id];
                    return {
                        cells: [
                            ship.ship_id,
                            formatInt(ship.hit_points.hhp_max),
                            formatInt(shipStats.directDamageHull.sum),
                            formatInt(ship.hit_points.shp_max),
                            formatInt(shipStats.directDamageShield.sum),
                        ],
                    };
                })}
            />
        </>
    );
}

function allStats(obj: any) {
    const isObject = (val: any) => typeof val === "object";
    const isStat = (val: any) => typeof val === "object" && Array.isArray(val["data"]);

    const addDelimiter = (a: string, b: string) =>
        a ? (a[0] > "a" && a[0] <= "Z" ? `${a}.${b}` : `${a}["${b}"]`) : b;

    const paths = (currentObj: any, head: string = ""): string[] => {
        return Object.entries(currentObj).reduce<string[]>((product, [key, value]) => {
            const fullPath = addDelimiter(head, key);
            if (isStat(value)) return product.concat(fullPath);
            if (isObject(value)) return product.concat(paths(value, fullPath));
            
            return product;
        }, []);
    };

    return paths(obj);
}

function CombatLogCharts(props: CombatLogStatsDetailsProps) {
    const { stats } = props;
    const [ship, setShip] = useState<string>(props.combatLog.ships[0].ship_id);
    const [stat, setStat] = useState<string>("");

    const getData = (selectedShip: string, selectedStat: string) => {
        if (!selectedStat) return [];

        const root = stats.ships[selectedShip];
        if (!root) return [];

        const tokens: string[] = [];
        const re = /([^.[]]+)|\["([^"]+)"\]/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(selectedStat)) !== null) {
            tokens.push(match[1] ?? match[2]);
        }

        const value = tokens.reduce<any>((obj, key) => {
            if (obj && typeof obj === "object") return obj[key];
            return undefined;
        }, root);

        if (Array.isArray(value)) return value;
        if (value && typeof value === "object" && Array.isArray(value.data)) return value.data;
        return [];
    };

    const data = getData(ship, stat);

    return (
        <>
            <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                    <TextField
                        id="select-ship"
                        label="Ship"
                        fullWidth
                        value={ship}
                        select
                        onChange={(event) => setShip(event.target.value)}
                    >
                        {Object.keys(props.stats.ships).map((shipId) => (
                            <MenuItem value={shipId} key={shipId}>
                                {shipId}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 4 }}>
                    <TextField
                        id="select-data"
                        label="Data"
                        fullWidth
                        value={stat}
                        select
                        onChange={(event) => setStat(event.target.value)}
                    >
                        {allStats(stats.ships[ship]).map((statName) => (
                            <MenuItem value={statName} key={statName}>
                                {statName}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <AutoSizer disableHeight>
                        {({ width }) => (
                            <ComposedChart
                                width={width}
                                height={400}
                                data={data}
                                margin={{ top: 20, right: 80, bottom: 20, left: 20 }}
                            >
                                <CartesianGrid stroke="#f5f5f5" />
                                <Tooltip />
                                <Legend />
                                <XAxis
                                    dataKey="t"
                                    type="number"
                                    label={{ value: "Round", position: "insideBottom", offset: 0 }}
                                />
                                <YAxis
                                    dataKey="value"
                                    type="number"
                                    label={{ value: "Value", angle: -90, position: "insideLeft" }}
                                />
                                <Line
                                    dataKey="value"
                                    stroke="blue"
                                    type="monotone"
                                    dot={true}
                                    activeDot={false}
                                    legendType="none"
                                />
                            </ComposedChart>
                        )}
                    </AutoSizer>
                </Grid>
            </Grid>
        </>
    );
}

interface CombatLogStatsCardProps {
    combatLog: CombatLog;
    stats: CombatLogStats;
}

function CombatLogStatsCard(props: CombatLogStatsCardProps) {
    const { combatLog, stats } = props;

    return (
        <StyledCard>
            <StyledCardContent>
                <Typography gutterBottom variant="h5" component="h2">
                    Analysis
                </Typography>
                <ExpandingListRowM
                    side="initiator"
                    text="Incoming attacks"
                    details={<CombatLogDefensiveStats combatLog={combatLog} stats={stats} />}
                />
                <ExpandingListRowM
                    side="initiator"
                    text="Outgoing attacks"
                    details={<CombatLogOffensiveStats combatLog={combatLog} stats={stats} />}
                />
                <ExpandingListRowM
                    side="initiator"
                    text="Weapon damage"
                    details={<CombatLogWeaponStats combatLog={combatLog} stats={stats} />}
                />
                <ExpandingListRowM
                    side="initiator"
                    text="Direct hit point change"
                    details={<CombatLoBurningStats combatLog={combatLog} stats={stats} />}
                />
                <ExpandingListRowM side="initiator" text="Officers" details={"TODO"} />
                <ExpandingListRowM
                    side="initiator"
                    text="Plots"
                    details={<CombatLogCharts combatLog={combatLog} stats={stats} />}
                />
            </StyledCardContent>
        </StyledCard>
    );
}

const CombatLogStatsCardM = memo(CombatLogStatsCard);

interface CombatLogImplProps {
    combatLog: CombatLog;
}

function CombatLogImpl(props: CombatLogImplProps) {
    const { combatLog } = props;

    if (!combatLog || !Array.isArray(combatLog.log) || !Array.isArray(combatLog.ships)) {
        return (
            <Paper sx={{ p: 4, textAlign: "center", mt: 2 }}>
                <Typography variant="h6" color="textSecondary">
                    Invalid combat log payload.
                </Typography>
            </Paper>
        );
    }

    const stats = gatherStats(combatLog);

    return (
        <Grid container spacing={1}>
            <Grid size={{ xs: 12 }}>
                <CombatLogFleetCardM ships={combatLog.ships} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <CombatLogSummaryCardM combatLog={combatLog} stats={stats} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <CombatLogStatsCardM combatLog={combatLog} stats={stats} />
            </Grid>
            {combatLog.log.map((round) => (
                <Grid size={{ xs: 12 }} key={round.round}>
                    <CombatLogRoundCardM round={round} ships={combatLog.ships} />
                </Grid>
            ))}
        </Grid>
    );
}

const CombatLogImplM = memo(CombatLogImpl);

function normalizeBattleInput(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return undefined;

    const digits = trimmed.match(/\d+/g)?.join("");
    if (!digits) return undefined;

    return { source: "api", id: digits };
}

function extractPayload(json: any) {
    // 1. Identify the potential payload source
    let payload =
        json?.viewModel ??
        json?.raw_json ??
        json?.combat_log ??
        json?.data ??
        json;

    // 2. If the payload is a string (common for SQLite 'raw_json' columns), parse it
    if (typeof payload === "string") {
        try {
            payload = JSON.parse(payload);
        } catch (e) {
            console.error("Failed to parse raw_json string:", e);
            return undefined;
        }
    }

    // 3. Validate that we now have the required arrays
    if (payload && Array.isArray(payload?.log) && Array.isArray(payload?.ships)) {
        return payload as CombatLog;
    }

    return undefined;
}


export function CombatLog() {
    const { id } = useParams();
    const [combatLog, setCombatLog] = useState<CombatLog | undefined>(undefined);

    async function fetchData() {
        try {
            const response = await fetch(`${LOCAL_SYNC_BASE_URL}/${id}`);
            const row = await response.json();

            // IMPORTANT: Look at your database schema. 
            // If the combat data is in a column named 'raw_json':
            const rawData = typeof row.raw_json === 'string'
                ? JSON.parse(row.raw_json)
                : row.raw_json;

            // Now pass THAT to your state
            setCombatLog(rawData);
        } catch (err) {
            console.error("Frontend Parse Error:", err);
        }
    }

    useEffect(() => {
        async function fetchData() {
            // Use the ID from the URL (id) instead of a generic /battles
            const url = `${LOCAL_SYNC_BASE_URL}/${id}`;
            console.log("DEBUG: Fetching specific log from:", url);

            const response = await fetch(url);
            const row = await response.json();

            // Check if your DB stores the log in 'raw_json' or 'payload'
            // Based on your curl, the data is likely in row.raw_json
            const dataToParse = typeof row.raw_json === 'string'
                ? JSON.parse(row.raw_json)
                : row; // or row.payload depending on your schema

            setCombatLog(dataToParse);
        }

        if (id) fetchData();
    }, [id]);

    // THIS IS THE PART THAT IS LIKELY MISSING OR BROKEN
    return (
        <Frame title={`Combat log ${id}`}>
            {combatLog === undefined ? (
                <p>Loading...</p>
            ) : (
                <ErrorBoundary>
                    <CombatLogImplM combatLog={combatLog} />
                </ErrorBoundary>
            )}
        </Frame>
    );


    async function handleResaveToDB() {
        if (!combatLog) return;

        const payload = {
            battleData: {
                id: Number(id),
                battle_id: combatLog.battle_id,
                battle_time: combatLog.time,
                initiator_id: combatLog.initiator,
                target_id: combatLog.target,
                initiator_wins: combatLog.initiator_wins ? 1 : 0,
                parsed_json: combatLog,
                raw_json: JSON.stringify(combatLog)
            },
            ships: combatLog.ships.map(s => ({
                id: Number(id),
                ship_id: s.ship_id,
                player_id: s.player_id,
                side: s.side,
                display_name: s.name,
                ship_name: s.hull_name,
                ship_level: s.level,
                hull_id: s.hull_id,
                officers: s.officers
            })),
            // Fixed: Added 'o' back to parameters and handled null officers
            officers: combatLog.ships.flatMap(s =>
                s.officers
                    .filter((o): o is CombatLogOfficer => o !== null)
                    .map((o, idx) => ({
                        id: Number(id),
                        ship_id: s.ship_id,
                        player_id: s.player_id,
                        side: s.side,
                        officer_id: o.id,
                        officer_name: o.name,
                        slot_index: idx,
                        is_captain: idx === 0
                    }))
            )
        };

        try {
            // Pointing to your specific battleapi endpoint
            const response = await fetch(`${LOCAL_SYNC_BASE_URL}/resave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                alert("Database Synced: Battle, Ships, and Crew updated.");
            } else {
                console.error("Resave failed:", response.statusText);
            }
        } catch (err) {
            console.error("Network error during resave:", err);
        }
    
    


        const handleFileData = async (data: string) => {
            try {
                const json = JSON.parse(data);
                const payload = extractPayload(json);

                if (!payload) {
                    console.error("Dropped file is not a valid combat log payload:", json);
                    return;
                }

                setCombatLog(payload);
                setSelectedBattle(undefined);

                const res = await fetch("/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        raw_json: json,
                        parsed_json: payload,
                    }),
                });

                if (!res.ok) {
                    console.error("Failed to persist parsed combat log");
                }
            } catch (err) {
                console.error("Failed to parse dropped JSON:", err);
            }
        };

        function buildCombatLogSummary(
            input: RawCombatLog,
            data: GameData,
            parsedData: CombatLogParsedData
        ): string {
            const lines: string[] = [];

            lines.push(`Battle ID: ${String(input.id ?? input.battle_id ?? "Unknown")}`);
            lines.push("");
            lines.push("SHIPS");

            for (const ship of parsedData.allShips) {
                lines.push(`- ${ship.displayName}`);
            }

            lines.push("");
            lines.push("OVERVIEW");
            lines.push(`Ships involved: ${parsedData.allShips.length}`);

            return lines.join("\n");
        }
        // RESAVE: Send the current state of 'combatLog' back to the new table
        async function resaveParsedData() {
            if (!combatLog) return;

            await fetch(`${LOCAL_SYNC_BASE_URL}/resave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    parsed_json: normalizeBattleInput
                    
                }), 
            });
            alert("Analysis resaved to STFC Parsed Results table.");
        }

        useEffect(() => {
            if (    id) ingestRawData();
        }, [    id]);

        return (
            <Frame title={`Combat log ${    id}`}>
                {combatLog === undefined ? (
                    <p>Loading Raw Data...</p>
                ) : (
                    <ErrorBoundary>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                            <Button onClick={resaveParsedData} variant="contained">
                                Resave Analysis to DB
                            </Button>
                        </div>
                        <CombatLogImplM combatLog={combatLog} />
                    </ErrorBoundary>
                )}
            </Frame>
        );
    }
}


function setSelectedBattle(undefined: undefined) {
    throw new Error("Function not implemented.");
}

/*
 * Attempt to ingest raw event data from the configured LOCAL_SYNC_BASE_URL.
 *
 * Notes:
 * - This implementation is intentionally non-invasive and will not modify component state
 *   because it runs outside of React hooks. It will fetch the raw event payload (if an event id
 *   can be inferred from the window location) and dispatch a window event with the result so
 *   components can react if they choose to listen for it.
 *
 * @returns {Promise<void>}
 */
async function ingestRawData(): Promise<void> {
    try {
        // Try to extract an event id from the current URL path as a best-effort approach.
        // Examples it tries to handle:
        // - /events/123
        // - /combatlog/123
        // - /.../123 (fallback to last path segment)
        const path = window.location.pathname || "";
        const parts = path.split("/").filter(Boolean);
        const last = parts[parts.length - 1];
        if (!last) {
            console.warn("ingestRawData: no path segment found to infer event id.");
            return;
        }

        const IdMatch = last.match(/^\d+$/);
        if (!IdMatch) {
            console.warn("ingestRawData: inferred segment is not numeric:", last);
            return;
        }

        const id = IdMatch[0];
        const url = `${LOCAL_SYNC_BASE_URL}`;

        const resp = await fetch(url);
        if (!resp.ok) {
            console.warn("ingestRawData: fetch failed", resp.status, resp.statusText);
            return;
        }

        const payload = await resp.json();

        // Dispatch a window event so other parts of the app can subscribe if needed.
        const event = new CustomEvent("ingestRawData:loaded", { detail: payload });
        window.dispatchEvent(event);
    } catch (err) {
        console.error("ingestRawData error:", err);
    }
}