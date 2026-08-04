import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

import { Frame } from "../components/Frame";
import { GameAssetAvatar } from "../components/GameAssetAvatar";
import type { GameData } from "../combatlog/util/gameData";
import { resolveOfficerAsset, resolveShipAsset } from "../util/gameAssets";

type CrewSetup = {
  id: string;
  group: string;
  title: string;
  encounter: string;
  ship?: string;
  ships?: string[];
  schedule?: string;
  bridge: string[];
  captain?: string | null;
  swaps?: string[];
  belowDeck?: string[];
  tech?: string[];
  boosts?: string[];
  focus?: string[];
  avoid?: string[];
  banned?: string[];
  notes?: string[];
  source?: string;
};

const setupGroups = [
  "Outposts",
  "VGER Challenge",
  "Borg Solomadas",
  "Conqueror Borg",
  "Training Drones",
];

const crewSetups: CrewSetup[] = [
  {
    id: "outpost-activators",
    group: "Outposts",
    title: "Outpost & retaliation attackers - officers that activate",
    encounter: "Outposts",
    bridge: [
      "Five of Eleven",
      "Gabriel Lorca",
      "Philipa Georgiou",
      "TOS James T Kirk",
      "Ba'el",
      "Martok",
      "Gowron",
      "Khan",
      "Kirk",
      "Nero",
      "Gorkon",
      "Harcourt Fenton Mudd",
      "TMP Hikaru Sulu",
      "One of Eleven",
      "Ash Tyler",
      "Tal",
      "D'jaoki",
      "Alexander Marcus",
      "Charvanek",
      "Kang",
      "Kerla",
      "Spock",
      "Uhura",
      "Chang",
      "Yuki",
      "Eurydice",
      "TMP Uhura",
      "Pike",
      "TNG Picard",
      "TNG Data",
      "Ent-E Riker",
      "Ent-E Picard",
      "Harry Mudd",
      "Zhou",
      "TOS Hikaru Sulu",
      "Phlox",
      "Jonathan Archer",
      "Trip Tucker",
      "TOS Leonard McCoy",
      "VGER Ilia",
    ],
    captain: null,
    belowDeck: [
      "SNW D'chok",
      "SNW Scotty",
      "SNW Black Ops Chapel",
      "WoK Joachim",
      "SNW Pelia",
      "SNW Hemmer",
      "Odo",
      "PIC Hugh",
      "The Doctor",
      "Tendi",
      "Badgey",
      "Boimler",
      "Mariner",
      "Rutherford",
    ],
    focus: ["Hull Breach", "Burn", "Morale", "Critical Chance", "Officer abilities that activate on outpost attacks"],
    notes: [
      "Reference sheet for outpost and retaliation attackers. Officers marked (c) in the source are captain-only; (o) means officer ability only; CC% means critical chance. Red names are hull breach, yellow/orange are burn, blue are morale.",
    ],
    source: "BlueMandalorian, STFC Community & Crew, Feb 4, 2026",
  },
  {
    id: "outpost-lorca-five-khan",
    group: "Outposts",
    title: "Hull breach pressure - Lorca / Five / Khan",
    encounter: "Outposts",
    bridge: ["Gabriel Lorca", "Five of Eleven", "Khan"],
    belowDeck: ["SNW D'chok", "SNW Scotty", "SNW Black Ops Chapel", "WoK Joachim", "SNW Pelia", "PIC Hugh"],
    focus: ["Hull Breach", "Critical Chance", "Critical Damage", "Fast shield-to-hull pressure"],
    notes: ["Use when the goal is to force hull breach and capitalize with crit pressure. This is one of the highlighted current-crew patterns from the source sheet."],
    source: "BlueMandalorian, STFC Community & Crew, Feb 4, 2026",
  },
  {
    id: "outpost-pike-five-tyler",
    group: "Outposts",
    title: "Pike activator - Pike / Five / Ash Tyler",
    encounter: "Outposts",
    bridge: ["Pike", "Five of Eleven", "Ash Tyler"],
    belowDeck: ["SNW D'chok", "SNW Scotty", "SNW Black Ops Chapel", "WoK Joachim", "SNW Pelia", "The Doctor"],
    focus: ["Bridge officer activation", "Damage pressure", "Outpost attacks"],
    notes: ["Pike is captain-only on the source sheet. This setup is for outpost/retaliation use where Pike activation is the driver."],
    source: "BlueMandalorian, STFC Community & Crew, Feb 4, 2026",
  },
  {
    id: "outpost-georgiou-five-tyler",
    group: "Outposts",
    title: "Burn pressure - Georgiou / Five / Ash Tyler",
    encounter: "Outposts",
    bridge: ["Philipa Georgiou", "Five of Eleven", "Ash Tyler"],
    belowDeck: ["SNW Scotty", "SNW Black Ops Chapel", "WoK Joachim", "SNW Pelia", "Odo", "PIC Hugh"],
    focus: ["Burn", "Officer ability activation", "Sustained damage"],
    notes: ["Georgiou is marked officer-ability-only on the source sheet. Good search target when users ask for burn outpost crews."],
    source: "BlueMandalorian, STFC Community & Crew, Feb 4, 2026",
  },
  {
    id: "outpost-kirk-five-morale",
    group: "Outposts",
    title: "Morale pressure - Kirk / Five / TOS James T Kirk",
    encounter: "Outposts",
    bridge: ["Kirk", "Five of Eleven", "TOS James T Kirk"],
    belowDeck: ["SNW D'chok", "SNW Scotty", "WoK Joachim", "PIC Hugh", "The Doctor", "Boimler"],
    focus: ["Morale", "Officer ability activation", "Crew support"],
    notes: ["TOS James T Kirk is marked officer-ability-only in the source sheet. Blue entries in the sheet indicate morale-oriented options."],
    source: "BlueMandalorian, STFC Community & Crew, Feb 4, 2026",
  },
  {
    id: "outpost-gorkon-five-kirk",
    group: "Outposts",
    title: "Critical chance pressure - Gorkon / Five / Kirk",
    encounter: "Outposts",
    bridge: ["Gorkon", "Five of Eleven", "Kirk"],
    belowDeck: ["SNW D'chok", "SNW Black Ops Chapel", "WoK Joachim", "PIC Hugh", "Badgey", "Mariner"],
    focus: ["Critical Chance", "Hull Breach", "Retaliation attacks"],
    notes: ["Gorkon is marked CC% on the source sheet. Use this as a crit-chance search target rather than a guaranteed best-in-slot claim."],
    source: "BlueMandalorian, STFC Community & Crew, Feb 4, 2026",
  },
  {
    id: "vger-hurak-ensign",
    group: "VGER Challenge",
    title: "Hurak - Ensign Suder / Annorax / Seska",
    encounter: "Hurak",
    schedule: "Monday and Friday",
    bridge: ["Ensign Suder", "Annorax", "Seska"],
    belowDeck: ["B'Elanna Torres", "Harry Kim", "Neelix", "PIC Hugh", "WoK Carol Marcus", "SNW Nurse Chapel", "Hugh", "Masriad Vael", "WoK Saavik", "Quasi", "WoK Joachim", "Zeph"],
    tech: ["Quantum Slipstream", "Chaos Deflector", "Agony Booth", "Godsend", "Cerritos Boost", "Excelsior Boost"],
    focus: ["Burning", "HHP/SHP Repair", "Apex Barrier"],
    avoid: ["Officers that trigger massive Apex Barrier on hostile"],
    notes: ["Experiment with below deck setup. Results vary by ship choice, tier, research, artifacts, tech, building bonuses, and active buffs."],
    source: "BlueMandalorian, updated Feb 5, 2026",
  },
  {
    id: "vger-gorn-ensign",
    group: "VGER Challenge",
    title: "Gorn - Ensign Suder / Annorax / Seska",
    encounter: "Gorn",
    schedule: "Tuesday and Thursday",
    bridge: ["Ensign Suder", "Annorax", "Seska"],
    swaps: ["Pike", "Kathryn Janeway", "Ent-E Picard"],
    belowDeck: ["WoK Joachim", "Harry Kim", "PIC Hugh", "B'Elanna Torres", "WoK Carol Marcus", "SNW Nurse Chapel", "Masriad Vael", "WoK Saavik", "Hugh", "Quasi", "Neelix", "Alok Sahar"],
    tech: ["Quantum Slipstream", "Chaos Deflector", "Agony Booth", "Godsend", "Cerritos Boost", "Excelsior Boost"],
    focus: ["Isolytic Damage", "Apex Barrier", "HHP/SHP Repair"],
    source: "BlueMandalorian, updated Feb 5, 2026",
  },
  {
    id: "vger-silent-trip",
    group: "VGER Challenge",
    title: "Silent - Trip / Annorax / Ensign Suder",
    encounter: "Silent",
    schedule: "Saturday",
    bridge: ["Trip Tucker", "Annorax", "Ensign Suder"],
    swaps: ["SNW M'Benga", "Kathryn Janeway", "Seska"],
    belowDeck: ["WoK Carol Marcus", "PIC Hugh", "WoK Joachim", "B'Elanna Torres", "SNW Nurse Chapel", "Harry Kim", "WoK McCoy", "Masriad Vael", "Hugh", "WoK Saavik", "Neelix", "Rachel Garrett"],
    tech: ["Quantum Slipstream", "Chaos Deflector", "Agony Booth", "Godsend", "Cerritos Boost", "Excelsior Boost"],
    focus: ["Apex Shred", "Critical Damage Reduction", "Critical Chance Reduction", "Apex Barrier", "HHP/SHP Repair"],
    source: "BlueMandalorian, updated Feb 5, 2026",
  },
  {
    id: "vger-orion-wip",
    group: "VGER Challenge",
    title: "Orion - fast kill / HHP survival",
    encounter: "Orion",
    schedule: "Wednesday and Sunday",
    bridge: ["S31 Georgiou", "Chang", "Ent-E Picard"],
    swaps: ["Ensign Suder", "Leslie", "Moreau", "Harcourt Fenton Mudd", "Pike"],
    belowDeck: ["PIC Hugh", "Neelix", "B'Elanna Torres", "SNW Nurse Chapel", "WoK Joachim", "WoK Carol Marcus", "Harry Kim", "WoK McCoy", "V'ger Ilia", "TMP Uhura", "WoK Saavik", "Quasi"],
    tech: ["Agony Booth", "Godsend", "Quantum Slipstream", "Excelsior Boost"],
    focus: ["Kill fast", "Survive massive HHP damage"],
    banned: ["Orion-only banned crew notes apply"],
    source: "BlueMandalorian, updated Feb 5, 2026",
  },
  {
    id: "vger-fighters",
    group: "VGER Challenge",
    title: "Excelsior vs. VGER Fighters",
    encounter: "Fighters",
    schedule: "Daily",
    bridge: ["Eurydice", "Pike", "Ensign Suder"],
    swaps: ["Seska", "Chang"],
    belowDeck: ["Harry Kim", "PIC Hugh", "B'Elanna Torres", "WoK Carol Marcus", "WoK Joachim", "Neelix"],
    tech: ["S31 Torpedo Pods", "Enaran Execution Post", "Excelsior Boost"],
    focus: ["HHP/SHP Repair", "Shot Delay"],
    source: "BlueMandalorian, updated Feb 5, 2026",
  },
  {
    id: "solomada-velox-69",
    group: "Borg Solomadas",
    title: "Velox/Borg Cube/Relativity vs. 69 Solomada",
    encounter: "Solomada 69",
    ship: "Velox",
    ships: ["Velox", "Borg Cube", "U.S.S. Relativity"],
    bridge: ["Miles O'Brien", "Benjamin Sisko", "Gwen DeMarco"],
    belowDeck: ["B'Elanna Torres", "Harry Kim", "Neelix", "Odo", "Ent-E Troi"],
    tech: ["Berserker Complex", "Chrono Deflector", "Quantum Slipstream", "Godsend"],
    boosts: ["Cerritos Support: Yes (3x)", "Defiant Reinforce: Yes for Cube/Velox", "Titan Max Fortify: Yes", "Armada Damage Exos: Yes"],
    focus: ["Stack Health", "Maverick Anti-Solomada Research"],
    source: "BlueMandalorian, Mar 16, 2026",
  },
  {
    id: "solomada-cube-69",
    group: "Borg Solomadas",
    title: "Borg Cube vs. 69 Solomada",
    encounter: "Solomada 69",
    ship: "Borg Cube",
    bridge: ["Seven of Nine", "Chakotay", "Kathryn Janeway"],
    belowDeck: ["WoK McCoy", "SNW Scotty", "WoK Joachim", "PIC Hugh"],
    tech: ["Quantum Slipstream", "Godsend"],
    boosts: ["Titan Max Fortify: Yes", "Armada Damage Exos: Yes"],
    focus: ["Stack Defense", "Maverick Anti-Solomada Research"],
    source: "BlueMandalorian, Mar 16, 2026",
  },
  {
    id: "solomada-vengeance-72",
    group: "Borg Solomadas",
    title: "Vengeance/Scimitar/Enterprise E vs. 72 Solomada",
    encounter: "Solomada 72",
    ship: "USS Vengeance",
    ships: ["USS Vengeance", "Scimitar", "USS Enterprise E"],
    bridge: ["Toli", "Dajash Tolra", "Five of Eleven"],
    belowDeck: ["B'Elanna Torres", "Harry Kim", "Neelix", "The Doctor", "PIC Hugh"],
    tech: ["Quantum Slipstream", "Chrono Deflector"],
    boosts: ["Cerritos Support: Yes (3x)", "Defiant Reinforce: Yes for Vengeance"],
    focus: ["Locked setup", "Maverick Anti-Solomada Research"],
    source: "BlueMandalorian guest edition, Mar 16, 2026",
  },
  {
    id: "borg-sphere-s31",
    group: "Conqueror Borg",
    title: "Borg Spheres - S31 / SNW M'Benga / Gorkon",
    encounter: "Conqueror Borg Sphere",
    bridge: ["S31 Georgiou", "SNW M'Benga", "Gorkon"],
    swaps: ["Chang"],
    belowDeck: ["WoK Carol Marcus", "WoK McCoy", "Harry Kim", "Neelix", "PIC Hugh", "B'Elanna Torres"],
    tech: ["Borg Operating Table", "Interplexing Beacon"],
    banned: ["Pike", "Kathryn Janeway", "Ent-E Picard"],
    notes: ["Post-Arkfall version. Use overall tech such as Chrono Deflector, Quantum Slipstream, Tolthian Mine, Temporal Conduit, Agony Booth, Godsend, Metreon Cascade, and Interphasic Mirror."],
    source: "BlueMandalorian, Apr 3, 2026",
  },
  {
    id: "borg-sphere-beverly",
    group: "Conqueror Borg",
    title: "Borg Spheres - Beverly / TNG Picard / Ent-E Data",
    encounter: "Conqueror Borg Sphere",
    bridge: ["Beverly Crusher", "TNG Picard", "Ent-E Data"],
    belowDeck: ["WoK Carol Marcus", "B'Elanna Torres", "PIC Hugh", "WoK McCoy", "Harry Kim", "Neelix"],
    tech: ["Borg Operating Table", "Interplexing Beacon"],
    banned: ["Pike", "Kathryn Janeway", "Ent-E Picard"],
    source: "BlueMandalorian, Apr 3, 2026",
  },
  {
    id: "drone-anti-interceptor",
    group: "Training Drones",
    title: "Academy Training Drones - Anti-Interceptor",
    encounter: "Anti-Interceptor",
    bridge: ["The Doctor", "Kathryn Janeway", "WoK McCoy"],
    belowDeck: ["WoK Carol Marcus", "PIC Hugh", "Harry Kim", "B'Elanna Torres", "Neelix"],
    tech: ["Quantum Slipstream", "Chrono Deflector"],
    focus: ["Health", "Defense", "Critical mitigation"],
    notes: ["Arcfall WIP. Tested crew feedback still expected."],
    source: "BlueMandalorian, Apr 29, 2026",
  },
  {
    id: "drone-anti-battleship",
    group: "Training Drones",
    title: "Academy Training Drones - Anti-Battleship",
    encounter: "Anti-Battleship",
    bridge: ["S31 Georgiou", "SNW Pike", "SNW T'Pring"],
    swaps: ["SNW Una", "Ent-E Data"],
    belowDeck: ["WoK Carol Marcus", "B'Elanna Torres", "PIC Hugh", "Quasi", "Harry Kim", "Neelix"],
    tech: ["Metreon Cascade", "Godsend"],
    focus: ["Increased Apex Barrier", "Massive critical damage mitigation"],
    source: "BlueMandalorian, Apr 29, 2026",
  },
  {
    id: "drone-anti-explorer",
    group: "Training Drones",
    title: "Academy Training Drones - Anti-Explorer",
    encounter: "Anti-Explorer",
    bridge: ["Ent-E Picard", "Ent-E Riker", "WoK Saavik"],
    swaps: ["Kathryn Janeway", "Ent-E Data", "Academy Doctor"],
    belowDeck: ["WoK Carol Marcus", "Tom Paris", "B'Elanna Torres", "Harry Kim", "Neelix", "Quasi"],
    tech: ["Agony Booth", "Temporal Conduit"],
    focus: ["Only hurt by Isolytic Damage", "Massive critical damage mitigation"],
    source: "BlueMandalorian, Apr 29, 2026",
  },
  {
    id: "drone-anti-wave",
    group: "Training Drones",
    title: "Duo Wave Defense - Anti-Wave",
    encounter: "Anti-Wave",
    bridge: ["WoK Saavik", "Annorax", "WoK McCoy"],
    belowDeck: ["WoK Carol Marcus", "B'Elanna Torres", "PIC Hugh", "Harry Kim", "Neelix", "Quasi"],
    tech: ["Quantum Slipstream", "Chrono Deflector"],
    notes: ["Hit a repair drone first thing in Wave 2. Killing a repair drone grants a 60 second protection, enough for a single wave of hostiles."],
    source: "BlueMandalorian, Apr 29, 2026",
  },
  {
    id: "drone-anti-drone",
    group: "Training Drones",
    title: "Duo Wave Defense - Anti-Drone",
    encounter: "Anti-Drone",
    bridge: ["Seska", "One of Eleven", "Ensign Suder"],
    swaps: ["Kathryn Janeway", "Chang"],
    belowDeck: ["WoK Carol Marcus", "B'Elanna Torres", "PIC Hugh", "Harry Kim", "Neelix", "Quasi"],
    tech: ["Enaran Execution Post", "Chrono Deflector"],
    focus: ["Increased Apex Shred", "Critical mitigation"],
    notes: ["Shield regen abilities like Seska OA and morale can help offset shield reduction against Venari Ral."],
    source: "BlueMandalorian, Apr 29, 2026",
  },
];

function pillList(
  values: string[] | undefined,
  color: "default" | "primary" | "secondary" | "warning" = "default",
  data?: GameData,
) {
  if (!values?.length) return <Typography variant="body2" color="text.secondary">None listed</Typography>;
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {values.map((value) => (
        <GameAssetAvatar
          key={value}
          asset={resolveOfficerAsset(value, data)}
          label={value}
          variant="chip"
          color={color}
        />
      ))}
    </Stack>
  );
}

function getCaptain(setup: CrewSetup) {
  if (setup.captain !== undefined) return setup.captain;
  return setup.bridge.length === 3 ? setup.bridge[1] : null;
}

function getShipOptions(setup: CrewSetup) {
  return setup.ships?.length ? setup.ships : setup.ship ? [setup.ship] : [];
}

function getBridgeSeats(setup: CrewSetup) {
  const captain = getCaptain(setup);
  if (setup.bridge.length === 3) {
    return [
      { role: "Officer", officer: setup.bridge[0] },
      { role: "Captain", officer: captain ?? setup.bridge[1], captain: true },
      { role: "Officer", officer: setup.bridge[2] },
    ];
  }

  return setup.bridge.map((officer) => ({
    role: captain === officer ? "Captain" : "Officer",
    officer,
    captain: captain === officer,
  }));
}

function bridgeOfficerList(setup: CrewSetup, data?: GameData) {
  if (!setup.bridge?.length) return <Typography variant="body2" color="text.secondary">None listed</Typography>;
  const seats = getBridgeSeats(setup);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: `repeat(${Math.min(seats.length, 3)}, minmax(0, 1fr))` },
        gap: 1,
      }}
    >
      {seats.map((seat, index) => (
        <Box
          key={`${seat.officer}-${index}`}
          sx={{
            border: "1px solid",
            borderColor: seat.captain ? "secondary.main" : "divider",
            bgcolor: seat.captain ? "secondary.main" : "background.default",
            color: seat.captain ? "secondary.contrastText" : "text.primary",
            borderRadius: 1,
            p: 1,
            minHeight: 76,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography variant="caption" sx={{ opacity: 0.78 }}>{seat.role}</Typography>
          <GameAssetAvatar
            asset={resolveOfficerAsset(seat.officer, data)}
            label={seat.officer}
            variant="seat"
            captain={Boolean(seat.captain)}
            size={42}
          />
        </Box>
      ))}
    </Box>
  );
}

function shipContext(setup: CrewSetup, data?: GameData) {
  const ships = getShipOptions(setup);
  if (!ships.length) {
    return <Typography variant="body2" color="text.secondary">No fixed ship listed in the source sheet</Typography>;
  }

  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {ships.map((ship) => (
        <GameAssetAvatar
          key={ship}
          asset={resolveShipAsset(ship, data)}
          label={ship}
          variant="chip"
          color={ship === setup.ship ? "primary" : "default"}
        />
      ))}
    </Stack>
  );
}

function copyText(setup: CrewSetup) {
  const captain = getCaptain(setup);
  return [
    setup.title,
    `Encounter: ${setup.encounter}`,
    setup.ship ? `Ship: ${setup.ship}` : undefined,
    setup.ships?.length ? `Ship options: ${setup.ships.join(", ")}` : undefined,
    setup.schedule ? `Schedule: ${setup.schedule}` : undefined,
    captain ? `Captain: ${captain}` : undefined,
    `Bridge: ${setup.bridge.join(" / ")}`,
    setup.swaps?.length ? `Swaps: ${setup.swaps.join(", ")}` : undefined,
    setup.belowDeck?.length ? `Below deck: ${setup.belowDeck.join(", ")}` : undefined,
    setup.tech?.length ? `Tech: ${setup.tech.join(", ")}` : undefined,
    setup.boosts?.length ? `Boosts: ${setup.boosts.join(", ")}` : undefined,
    setup.focus?.length ? `Focus: ${setup.focus.join(", ")}` : undefined,
    setup.avoid?.length ? `Avoid: ${setup.avoid.join(", ")}` : undefined,
    setup.banned?.length ? `Banned: ${setup.banned.join(", ")}` : undefined,
    setup.notes?.length ? `Notes: ${setup.notes.join(" ")}` : undefined,
    setup.source ? `Source: ${setup.source}` : undefined,
  ].filter(Boolean).join("\n");
}

export function OfficerSetups() {
  const [group, setGroup] = useState(setupGroups[0]);
  const [query, setQuery] = useState("");
  const [shipFilter, setShipFilter] = useState("all");
  const [copied, setCopied] = useState<string | undefined>();
  const gameData = useQuery({
    queryKey: ["game-data"],
    queryFn: async () => {
      const response = await fetch("/data/game-data/all.json");
      if (!response.ok) throw new Error("Could not load game data");
      return (await response.json()) as GameData;
    },
  });

  const visibleSetups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return crewSetups.filter((setup) => {
      const matchesGroup = setup.group === group;
      const haystack = [
        setup.title,
        setup.encounter,
        setup.ship,
        ...(setup.ships ?? []),
        setup.schedule,
        ...(setup.bridge ?? []),
        ...(setup.swaps ?? []),
        ...(setup.belowDeck ?? []),
        ...(setup.tech ?? []),
        ...(setup.boosts ?? []),
        ...(setup.focus ?? []),
        ...(setup.notes ?? []),
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      const matchesShip = shipFilter === "all" || setup.ship === shipFilter || setup.ships?.includes(shipFilter) || setup.encounter === shipFilter;
      return matchesGroup && matchesQuery && matchesShip;
    });
  }, [group, query, shipFilter]);

  const filterOptions = useMemo(() => {
    const values = crewSetups
      .filter((setup) => setup.group === group)
      .flatMap((setup) => [...getShipOptions(setup), setup.encounter])
      .filter(Boolean) as string[];
    return Array.from(new Set(values)).sort();
  }, [group]);

  const handleCopy = async (setup: CrewSetup) => {
    await navigator.clipboard.writeText(copyText(setup));
    setCopied(setup.title);
    window.setTimeout(() => setCopied(undefined), 2500);
  };

  return (
    <Frame title="Officer Setup Helper">
      <Box sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h4">Officer Setup Helper</Typography>
              <Typography color="text.secondary">
                Searchable crew sheets for outposts, challenge hostiles, Borg Solomadas, Conqueror Borg, and Academy drone waves.
              </Typography>
              <Tabs
                value={group}
                onChange={(_event, value) => {
                  setGroup(value);
                  setShipFilter("all");
                }}
                variant="scrollable"
                scrollButtons="auto"
              >
                {setupGroups.map((name) => <Tab key={name} value={name} label={name} />)}
              </Tabs>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Search officer, tech, encounter, note"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <FormControl sx={{ minWidth: 220 }}>
                  <InputLabel id="crew-filter-label">Filter</InputLabel>
                  <Select
                    labelId="crew-filter-label"
                    label="Filter"
                    value={shipFilter}
                    onChange={(event) => setShipFilter(event.target.value)}
                    startAdornment={<FilterAltIcon fontSize="small" />}
                  >
                    <MenuItem value="all">All setups</MenuItem>
                    {filterOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
              {copied && <Alert severity="success">Copied {copied}</Alert>}
            </Stack>
          </Paper>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 2 }}>
            {visibleSetups.map((setup) => (
              <Paper key={setup.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="h6">{setup.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {setup.encounter}{getShipOptions(setup).length ? ` - ${getShipOptions(setup).join(" / ")}` : ""}{setup.schedule ? ` - ${setup.schedule}` : ""}
                    </Typography>
                    </Box>
                    <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => handleCopy(setup)}>
                      Copy
                    </Button>
                  </Stack>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Ship Context</Typography>
                    {shipContext(setup, gameData.data)}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Bridge Seats</Typography>
                    {getCaptain(setup) ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Source layout: Officer / Captain / Officer
                      </Typography>
                    ) : null}
                    {bridgeOfficerList(setup, gameData.data)}
                  </Box>
                  {setup.swaps?.length ? (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Swaps</Typography>
                      {pillList(setup.swaps, "warning", gameData.data)}
                    </Box>
                  ) : null}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Below Deck</Typography>
                    {pillList(setup.belowDeck, "default", gameData.data)}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Tech</Typography>
                    {pillList(setup.tech, "secondary")}
                  </Box>
                  {setup.boosts?.length ? (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Boosts</Typography>
                      {pillList(setup.boosts)}
                    </Box>
                  ) : null}
                  {setup.focus?.length ? (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Emphasis</Typography>
                      {pillList(setup.focus)}
                    </Box>
                  ) : null}
                  {(setup.avoid?.length || setup.banned?.length) ? (
                    <Alert severity="warning">
                      {[...(setup.avoid ?? []), ...(setup.banned ?? [])].join("; ")}
                    </Alert>
                  ) : null}
                  {setup.notes?.length ? (
                    <Alert severity="info">
                      {setup.notes.join(" ")}
                    </Alert>
                  ) : null}
                  {setup.source ? (
                    <Typography variant="caption" color="text.secondary">{setup.source}</Typography>
                  ) : null}
                </Stack>
              </Paper>
            ))}
          </Box>
        </Stack>
      </Box>
    </Frame>
  );
}
