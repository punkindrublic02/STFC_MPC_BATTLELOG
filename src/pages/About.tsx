import * as React from "react";
import {
    Box,
    Link,
    List,
    ListItem,
    ListItemText,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import { Frame } from "../components/Frame";
import { AutoLinkText } from "../components/AutoLinkText";

export function About() {
    return (
        <Frame title="About">
            <Box sx={{ py: 3, maxWidth: 900 }}>
                <Stack spacing={3}>
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography variant="h4">About This Toolbox</Typography>
                            <Typography>
                                <AutoLinkText value="This site is an alliance-focused adaptation inspired by the existing STFC community toolbox work. Thanks to the players, guide makers, spreadsheet builders, combat-log testers, and community Discords that made the original ideas useful enough to build on. This is a community project, not an official source. The goal is to make battle logs, officer setups, mechanics notes, and MCP-ready summaries easier to use for real game decisions. Thank you to STFC-MOD https://github.com/netniV/stfc-mod/releases for all you do to support and make our PC lives better!" />
                            </Typography>
                            <Typography color="text.secondary">
                                The goal here is practical: make battle logs, officer setups, mechanics notes,
                                and MCP-ready summaries easier to use for real game decisions.
                            </Typography>
                        </Stack>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h5" gutterBottom>
                            Feedback
                        </Typography>
                        <Typography>
                            This site is a community helper, not an official source. Battle logs, officer setup
                            notes, mechanics summaries, and crew suggestions may be incomplete, incorrect, or
                            outdated as STFC changes. Use the information as a starting point and verify important
                            decisions with your own testing.
                        </Typography>
                        <Typography sx={{ mt: 2 }}>
                            Updates may happen when time allows. Tested corrections and clearer explanations are
                            always helpful, but there may be delays before they make it into the site.
                        </Typography>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h5" gutterBottom>
                            Visual Assets
                        </Typography>
                        <Typography>
                            Officer and ship images are used only as identification helpers when a local thumbnail is
                            available. This fan toolbox stores the game-data art ID mapping separately from the image
                            files and falls back to initials or ship icons when an image is missing.
                        </Typography>
                        <Typography sx={{ mt: 2 }} color="text.secondary">
                            Star Trek Fleet Command names, imagery, and related marks belong to their respective
                            owners. This project is not affiliated with or endorsed by Scopely, CBS, or Paramount.
                            If an image should be removed, reach out in my Discord.
                        </Typography>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h5" gutterBottom>
                            Useful STFC Resources
                        </Typography>
                        <List>
                            <ListItem disablePadding sx={{ mb: 1 }}>
                                <ListItemText
                                    primary={
                                        <Link
                                            href="https://github.com/punkindrublic02/STFC_MPC_BATTLELOG/tree/main"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            STFC_MPC_BATTLELOG
                                        </Link>
                                    }
                                    secondary="GitHub Repository (Private Workspace Source)"
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ mb: 1 }}>
                                <ListItemText
                                    primary={<Link href="https://stfc.space/" target="_blank" rel="noreferrer">stfc.space</Link>}
                                    secondary="STFC Database"
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ mb: 1 }}>
                                <ListItemText
                                    primary={<Link href="https://www.talkingtrekstfc.com" target="_blank" rel="noreferrer">talkingtrekstfc.com</Link>}
                                    secondary="Talking Trek Podcasts"
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ mb: 1 }}>
                                <ListItemText
                                    primary={<Link href="https://discord.gg/6s5dnrg" target="_blank" rel="noreferrer">Official STFC Discord</Link>}
                                    secondary="Community discussion and official STFC announcements"
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ mb: 1 }}>
                                <ListItemText
                                    primary={<Link href="https://discord.gg/SXn4cy3" target="_blank" rel="noreferrer">Crew Setups &amp; Ship Info</Link>}
                                    secondary="Community crew testing and ship information"
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ mb: 1 }}>
                                <ListItemText
                                    primary={<Link href="https://discord.gg/TalkingTrek" target="_blank" rel="noreferrer">Talking Trek Podcast Discord</Link>}
                                    secondary="Talking Trek community discussion"
                                />
                            </ListItem>
                        </List>
                    </Paper>
                </Stack>
            </Box>
        </Frame>
    );
}
