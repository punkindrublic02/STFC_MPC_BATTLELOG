import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Link as MuiLink,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import KeyIcon from "@mui/icons-material/Key";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import SmartToyIcon from "@mui/icons-material/SmartToy";

import { Frame } from "../components/Frame";
import { LOCAL_SYNC_BASE_URL } from "../combatlog/components/CombatLog";

const TOKEN_KEY = "stfcBattleAccessToken";

function makeToml(token: string) {
  return `[sync.targets.alliance]
url = "https://battleapi.punkndrublic.us/submit"
token = "${token || "PASTE_YOUR_TOKEN_HERE"}"
battlelogs = true
debug = false
logging = true
verify_ssl = true`;
}

function makeAiToolInstructions(token: string) {
  const apiToken = token || "PASTE_YOUR_TOKEN_HERE";
  return `STFC_API_BASE_URL=https://battleapi.punkndrublic.us
STFC_API_TOKEN=${apiToken}
STFC_AUTH_HEADER=Authorization: Bearer ${apiToken}

SYSTEM_INSTRUCTION=You are connected to the STFC Toolbox for Star Trek Fleet Command alliance analytics. Use the STFC hosted API to answer questions about battle logs, crews, hostile efficiency, armadas, territory reminders, player scan context, and event planning. Never reveal tokens or raw private credentials. When answering, cite the battle, ship, target, crew, and observed result when available. If the database does not have enough evidence, say what data is missing.`;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

const setupSteps = [
  {
    label: "1",
    title: "Create your access token",
    body:
      "Use self-registration below or ask an admin for a token. Each player gets separate access so uploads can be managed without disrupting the rest of the alliance.",
    icon: <KeyIcon color="primary" />,
  },
  {
    label: "2",
    title: "Install the community mod",
    body:
      "Install the STFC Community Mod, then open community_patch_settings.toml and paste the generated sync target block. Keep the token private.",
    icon: <SettingsIcon color="primary" />,
  },
  {
    label: "3",
    title: "Restart STFC",
    body:
      "The mod reads the config during startup. After restart, completed battles should upload automatically.",
    icon: <RestartAltIcon color="primary" />,
  },
  {
    label: "4",
    title: "Confirm the feed",
    body:
      "Save the same token in this browser, then open My Battles or Battle Stats to make sure new logs are arriving.",
    icon: <SearchIcon color="primary" />,
  },
];

export function AllianceStart() {
  const [token, setToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [playerName, setPlayerName] = React.useState(() => localStorage.getItem("stfcPlayerName") ?? "");
  const [registerName, setRegisterName] = React.useState(() => localStorage.getItem("stfcPlayerName") ?? "");
  const [registerAlliance, setRegisterAlliance] = React.useState("Alliance Name");
  const [inviteCode, setInviteCode] = React.useState("");
  const [generatedToken, setGeneratedToken] = React.useState("");
  const [registering, setRegistering] = React.useState(false);
  const [registerMessage, setRegisterMessage] = React.useState("");
  const [registerError, setRegisterError] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [message, setMessage] = React.useState("");
  const [battlelogsShared, setBattlelogsShared] = React.useState(true);
  const [sharingStatus, setSharingStatus] = React.useState<"idle" | "saving">("idle");
  const [sharingMessage, setSharingMessage] = React.useState("");
  const [sharingError, setSharingError] = React.useState("");
  const trimmedToken = token.trim();
  const configToken = generatedToken || trimmedToken;
  const toml = makeToml(configToken);
  const aiToolInstructions = makeAiToolInstructions(configToken);

  const saveToken = React.useCallback((value: string) => {
    setToken(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed);
    else localStorage.removeItem(TOKEN_KEY);
    setStatus("idle");
  }, []);

  const savePlayerName = React.useCallback((value: string) => {
    setPlayerName(value);
    const trimmed = value.trim();
    if (trimmed) localStorage.setItem("stfcPlayerName", trimmed);
    else localStorage.removeItem("stfcPlayerName");
  }, []);

  const checkToken = React.useCallback(async () => {
    if (!trimmedToken) {
      setStatus("bad");
      setMessage("Enter your alliance token first.");
      return;
    }
    setStatus("checking");
    setMessage("");
    try {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${trimmedToken}` },
      });
      if (!response.ok) throw new Error(response.status === 403 ? "Token rejected by the API." : `API returned ${response.status}.`);
      const body = await response.json();
      setBattlelogsShared(Number(body.client?.battlelogs_shared ?? 1) !== 0);
      setStatus("ok");
      setMessage(`Token works for ${body.client?.display_name ?? "this member"}.`);
    } catch (error) {
      setStatus("bad");
      setMessage(error instanceof Error ? error.message : "Token check failed.");
    }
  }, [trimmedToken]);

  const registerToken = React.useCallback(async () => {
    const displayName = registerName.trim();
    const allianceId = registerAlliance.trim();
    if (!displayName) {
      setRegisterError("Enter your player name first.");
      return;
    }
    if (!allianceId) {
      setRegisterError("Enter an alliance id or short alliance name.");
      return;
    }

    setRegistering(true);
    setRegisterError("");
    setRegisterMessage("");
    setGeneratedToken("");
    try {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/auth/self-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          alliance_id: allianceId,
          invite_code: inviteCode.trim() || undefined,
          battlelogs_shared: battlelogsShared ? 1 : 0,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `API returned ${response.status}.`);

      const newToken = String(body.api_key ?? "").trim();
      setGeneratedToken(newToken);
      setRegisterMessage(`Token created for ${body.display_name ?? displayName}. Save it now; it will not be shown again.`);
      setBattlelogsShared(Number(body.battlelogs_shared ?? 1) !== 0);
      savePlayerName(displayName);
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : "Could not create token.");
    } finally {
      setRegistering(false);
    }
  }, [inviteCode, registerAlliance, registerName, savePlayerName]);

  const saveBattlelogSharing = React.useCallback(async () => {
    if (!trimmedToken) {
      setSharingError("Enter and save your alliance token first.");
      return;
    }

    setSharingStatus("saving");
    setSharingMessage("");
    setSharingError("");
    try {
      const response = await fetch(`${LOCAL_SYNC_BASE_URL}/auth/me/battlelog-sharing`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${trimmedToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ battlelogs_shared: battlelogsShared ? 1 : 0 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `API returned ${response.status}.`);
      setBattlelogsShared(Number(body.battlelogs_shared ?? 1) !== 0);
      setSharingMessage(battlelogsShared
        ? "Battle-log sharing is on. Other token users can find your shared logs in searches."
        : "Battle-log sharing is off. Only this token can pull your uploaded logs.");
    } catch (error) {
      setSharingError(error instanceof Error ? error.message : "Could not save battle-log sharing.");
    } finally {
      setSharingStatus("idle");
    }
  }, [battlelogsShared, trimmedToken]);

  return (
    <Frame title="Player Start">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Player Start
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
            Set up battle-log uploads, control how your data is shared, and jump into the tools your alliance uses for
            crew testing, target selection, and territory planning.
          </Typography>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderColor: "primary.main",
            background:
              "linear-gradient(135deg, rgba(25,118,210,0.10), rgba(0,188,212,0.06) 45%, rgba(255,193,7,0.08))",
          }}
        >
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" gutterBottom>
                  Turn battle logs into alliance intelligence
                </Typography>
                <Typography color="text.secondary">
                  Uploads give the alliance searchable evidence: which crews worked, which targets paid off, and which
                  fights are worth repeating. You can still drag a CSV into Completed Battles for a private one-off review.
                </Typography>
              </Box>
              <Button
                component={MuiLink}
                href="https://github.com/punkindrublic02/STFC_MPC_BATTLELOG"
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                sx={{ textDecoration: "none" }}
              >
                GitHub README
              </Button>
            </Stack>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
              {setupSteps.map((step) => (
                <Paper key={step.title} variant="outlined" sx={{ p: 1.75, height: "100%" }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={step.label} color="primary" size="small" />
                      {step.icon}
                    </Stack>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.body}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Downloads</Typography>
            <Typography color="text.secondary">
              Start with the official PC client. Add the community mod only when you are ready to upload battle logs.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                component={MuiLink}
                href="https://startrekfleetcommand.com/"
                target="_blank"
                rel="noreferrer"
                variant="contained"
                sx={{ textDecoration: "none" }}
              >
                Official STFC Download
              </Button>
              <Button
                component={MuiLink}
                href="https://github.com/netniv/stfc-mod/releases/tag/v1.1.4"
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                sx={{ textDecoration: "none" }}
              >
                STFC Community Mod v1.1.4
              </Button>
            </Stack>
            <Alert severity="info">
              The community mod is open source and separate from the official game. Keep the two links clear when helping
              alliance members set up.
            </Alert>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">What the site can prove</Typography>
            <Typography color="text.secondary">
              This site is built around uploaded battle logs. A battle can have three evidence levels:
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">Stored</Typography>
                <Typography variant="body2" color="text.secondary">
                  The raw battle exists in the database. It can be opened, copied, and inspected.
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">Parsed facts</Typography>
                <Typography variant="body2" color="text.secondary">
                  Ships, officers, rounds, damage, buffs, repairs, and readable battle text were decoded.
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">Scored evidence</Typography>
                <Typography variant="body2" color="text.secondary">
                  The battle can be compared against similar stored battles for rankings, trends, and test ideas.
                </Typography>
              </Paper>
            </Box>
            <Alert severity="info">
              AI answers should say which level is available. If only parsed facts exist, the AI can explain what happened,
              but should not claim a crew is best. If scored evidence exists, it can compare the result to similar battles.
            </Alert>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip color="success" label="New" />
              <Typography variant="h6">Self-register for an access token</Typography>
            </Stack>
            <Typography color="text.secondary">
              Create your own upload/API token, then save it in the mod config. The token is only shown once.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField
                label="Your player name"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              />
              <TextField
                label="Alliance"
                value={registerAlliance}
                onChange={(event) => setRegisterAlliance(event.target.value)}
                size="small"
                sx={{ minWidth: 180 }}
              />
              <TextField
                label="Invite code"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                size="small"
                sx={{ minWidth: 160 }}
                helperText="Only needed if registration is locked"
              />
              <Button variant="contained" startIcon={<KeyIcon />} onClick={registerToken} disabled={registering}>
                Create Token
              </Button>
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={battlelogsShared}
                  onChange={(event) => setBattlelogsShared(event.target.checked)}
                />
              }
              label="Share my battle logs with other token users"
            />
            <Typography variant="body2" color="text.secondary">
              On lets other approved token users find your logs in hostile, ship, crew, and matching battle searches.
              Off keeps your uploads private to this token.
            </Typography>
            {registering ? <LinearProgress /> : null}
            {registerError ? <Alert severity="warning">{registerError}</Alert> : null}
            {registerMessage ? (
              <Alert severity="success">
                <AlertTitle>{registerMessage}</AlertTitle>
                <Stack spacing={1}>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.5,
                      overflow: "auto",
                      bgcolor: "grey.950",
                      color: "grey.100",
                      borderRadius: 1,
                      fontSize: 13,
                    }}
                  >
                    {generatedToken}
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copyText(generatedToken)}>
                      Copy Token
                    </Button>
                    <Button variant="outlined" onClick={() => saveToken(generatedToken)}>
                      Use On This Browser
                    </Button>
                  </Stack>
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField
                label="Access token"
                type="password"
                value={token}
                onChange={(event) => saveToken(event.target.value)}
                size="small"
                sx={{ minWidth: 300 }}
              />
              <TextField
                label="Your player name"
                value={playerName}
                onChange={(event) => savePlayerName(event.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              />
              <Button variant="contained" startIcon={<KeyIcon />} onClick={checkToken} disabled={status === "checking"}>
                Check Token
              </Button>
              <Button component={RouterLink} to="/my-battles" variant="outlined" startIcon={<SearchIcon />}>
                My Battles
              </Button>
            </Stack>
            {status === "checking" ? <LinearProgress /> : null}
            {message ? <Alert severity={status === "ok" ? "success" : "warning"}>{message}</Alert> : null}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Battle-log sharing</Typography>
            <Typography color="text.secondary">
              This controls whether other approved token users can review your uploaded battle logs when they search by hostile,
              ship, crew, player, or matching combat context. Private logs stay available only through your own token.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={battlelogsShared}
                    onChange={(event) => setBattlelogsShared(event.target.checked)}
                  />
                }
                label={battlelogsShared ? "Sharing on" : "Sharing off"}
              />
              <Button
                variant="contained"
                onClick={saveBattlelogSharing}
                disabled={!trimmedToken || sharingStatus === "saving"}
              >
                Save Sharing
              </Button>
            </Stack>
            {sharingStatus === "saving" ? <LinearProgress /> : null}
            {sharingMessage ? <Alert severity="success">{sharingMessage}</Alert> : null}
            {sharingError ? <Alert severity="warning">{sharingError}</Alert> : null}
          </Stack>
        </Paper>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip color="primary" label="1" />
                <Typography variant="h6">Add the upload config</Typography>
              </Stack>
              <Typography color="text.secondary">
                Put this in community_patch_settings.toml, then restart the mod/game so new battle logs upload.
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  overflow: "auto",
                  bgcolor: "grey.950",
                  color: "grey.100",
                  borderRadius: 1,
                  fontSize: 13,
                }}
              >
                {toml}
              </Box>
              <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copyText(toml)}>
                Copy TOML
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip color="primary" label="2" />
                <Typography variant="h6">Use the data</Typography>
              </Stack>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography>Search your latest battles by player name.</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography>Compare crews by hostile, armada, PvP, or outpost context.</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography>Open battle logs when something looks wrong or interesting.</Typography>
                </Stack>
              </Stack>
              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button component={RouterLink} to="/battle-stats" variant="contained">
                  Crew Results
                </Button>
                <Button component={RouterLink} to="/ship-comparison" variant="outlined">
                  Ship Compare
                </Button>
                <Button component={RouterLink} to="/combatlog" variant="outlined">
                  Battle Logs
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <SmartToyIcon color="primary" />
              <Typography variant="h6">Using ChatGPT or Claude with MPC</Typography>
            </Stack>
            <Typography color="text.secondary">
              Copy the values below into your ChatGPT or Claude MPC setup. This lets the assistant read approved
              STFC Toolbox data through the hosted API using the member's access token.
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography>Copy the MPC values below into the ChatGPT or Claude connector settings.</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography>Use the hosted STFC API URL and the member's personal access token.</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography>After it is connected, ask it to search battles, compare crews, and explain observed results.</Typography>
              </Stack>
            </Stack>
            <Alert severity="warning">
              Do not post tokens in public Discord channels, screenshots, streams, or ticket threads. If a token is lost,
              create a new one and disable the old token from Admin Tokens.
            </Alert>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                maxHeight: 260,
                overflow: "auto",
                bgcolor: "grey.950",
                color: "grey.100",
                borderRadius: 1,
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {aiToolInstructions}
            </Box>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => copyText(aiToolInstructions)}
              sx={{ alignSelf: "flex-start" }}
            >
              Copy MPC Values
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Feedback and support</Typography>
            <Typography color="text.secondary">
              For problems with this website, battle-log uploads, tokens, parser results, Discord alerts, or ChatGPT/Claude
              answers, reach out in my Discord . Include the battle ID if you have one, your player name, ship,
              target, and what looked incorrect.
            </Typography>
            <Typography color="text.secondary">
              Other STFC communities and sites are useful for game discussion and reference, but they do not support this
              project or fix issues on this website. General STFC resources include{" "}
              <MuiLink href="https://stfc.space" target="_blank" rel="noreferrer">
                stfc.space
              </MuiLink>{" "}
              and{" "}
              <MuiLink href="https://cdn.discordapp.com/avatars/532567827949944832/b15da5ded3fa4028b43911f4211840d9.webp?size=1280" target="_blank" rel="noreferrer">
                talkingtrekstfc.com
              </MuiLink>
              .
            </Typography>
          </Stack>
        </Paper>

        <Alert severity="info">
          Tokens only identify upload/API access. If someone loses a token, make a new one and disable the old one from Admin Tokens.
        </Alert>
      </Stack>
    </Frame>
  );
}
