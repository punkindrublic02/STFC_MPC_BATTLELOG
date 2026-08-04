import * as React from "react";
import { Link as RouterLink, LinkProps as RouterLinkProps, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  CssBaseline,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Chip,
} from "@mui/material";
import {
  Person as PersonIcon,
  Settings as SettingsIcon,
  Flight as FlightIcon,
  FlashOn as FlashOnIcon,
  Groups as GroupsIcon,
  Info as InfoIcon,
  EventNote as EventNoteIcon,
  Radar as RadarIcon,
  Article as ArticleIcon,
  QueryStats as QueryStatsIcon,
  RocketLaunch as RocketLaunchIcon,
  ManageSearch as ManageSearchIcon,
  Map as MapIcon,
  EmojiEvents as EmojiEventsIcon,
  TravelExplore as TravelExploreIcon,
  CompareArrows as CompareArrowsIcon,
  FactCheck as FactCheckIcon,
  SmartToy as SmartToyIcon,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";

const drawerWidth = 240;

interface ListItemLinkProps {
  icon?: React.ReactElement;
  primary: string;
  to: string;
}

function ListItemLink(props: ListItemLinkProps) {
  const { icon, primary, to } = props;
  const location = useLocation();
  const selected = location.pathname === to || (to !== "/" && location.pathname.startsWith(`${to}/`));

  const renderLink = React.useMemo(
    () =>
      React.forwardRef<any, Omit<RouterLinkProps, "to">>((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to],
  );

  return (
    <li>
      <ListItemButton
        component={renderLink}
        selected={selected}
        sx={{
          mx: 1,
          my: 0.25,
          borderRadius: 1,
          minHeight: 38,
          "&.Mui-selected": {
            color: "common.white",
            backgroundColor: alpha("#6fb6e8", 0.2),
            borderLeftColor: "secondary.main",
          },
          "&.Mui-selected:hover": {
            backgroundColor: alpha("#6fb6e8", 0.26),
          },
        }}
      >
        {icon ? <ListItemIcon>{icon}</ListItemIcon> : null}
        <ListItemText
          primary={primary}
          primaryTypographyProps={{
            fontSize: 13.5,
            fontWeight: selected ? 700 : 500,
            noWrap: true,
          }}
        />
      </ListItemButton>
    </li>
  );
}

export interface FrameProps {
  children?: React.ReactNode;
  title: string;
}

export function Frame(props: FrameProps) {
  const { children, title } = props;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "background.default" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: 1,
          borderColor: alpha("#ffffff", 0.14),
        }}
      >
        <Toolbar sx={{ minHeight: 60 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="caption" sx={{ letterSpacing: 0, color: alpha("#ffffff", 0.72), fontWeight: 700 }}>
              STFC TOOLBOX
            </Typography>
            <Typography variant="h6" noWrap sx={{ lineHeight: 1.15 }}>
              {title}
            </Typography>
          </Box>
          <Chip
            size="small"
            label="Alliance Ops"
            sx={{
              color: "secondary.contrastText",
              bgcolor: "secondary.main",
              fontWeight: 800,
            }}
          />
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: 0,
          },
        }}
      >
        <Toolbar sx={{ minHeight: 60 }} />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="overline" sx={{ color: alpha("#dce8f5", 0.62), letterSpacing: 0, fontWeight: 800 }}>
            Battle evidence
          </Typography>
          <Typography variant="body2" sx={{ color: alpha("#dce8f5", 0.82), lineHeight: 1.35 }}>
            Logs, crews, territory timing, and alliance decisions in one place.
          </Typography>
        </Box>
        <Box sx={{ overflow: "auto", pb: 2 }}>
          <List>
            <ListSubheader>Start</ListSubheader>
            <ListItemLink to="/player-start" primary="Player Start" icon={<RocketLaunchIcon />} />
            <ListItemLink to="/my-battles" primary="My Battles" icon={<ManageSearchIcon />} />
            <ListItemLink to="/stfc-ai-assist" primary="STFC AI Assist" icon={<SmartToyIcon />} />
          </List>
          <Divider />
          <List>
            <ListSubheader>Battle Logs</ListSubheader>
            <ListItemLink to="/combatlogs" primary="Battle Log Explorer" icon={<FlashOnIcon />} />
            <ListItemLink to="/combatlog" primary="Completed Battles" icon={<FlashOnIcon />} />
            <ListItemLink to="/battle-compare" primary="Selected Battle Compare" icon={<CompareArrowsIcon />} />
            <ListItemLink to="/run-insights" primary="Run Insights Advanced" icon={<QueryStatsIcon />} />
            <ListItemLink to="/battle-stats" primary="Battle Stats Advanced" icon={<QueryStatsIcon />} />
            <ListItemLink to="/parser-diagnostics" primary="Parser Diagnostics" icon={<FactCheckIcon />} />
          </List>
          <Divider />
          <List>
            <ListSubheader>Planning</ListSubheader>
            <ListItemLink to="/officer-setups" primary="Officer Setups" icon={<GroupsIcon />} />
            <ListItemLink to="/ship-comparison" primary="Ship Build Compare" icon={<FlashOnIcon />} />
            <ListItemLink to="/territory" primary="Territory Refresh" icon={<MapIcon />} />
            <ListItemLink to="/alliance-tournaments" primary="Alliance Tournaments" icon={<EmojiEventsIcon />} />
            <ListItemLink to="/alliance-events" primary="Alliance Events" icon={<EventNoteIcon />} />
          </List>
          <Divider />
          <List>
            <ListSubheader>Reference</ListSubheader>
            <ListItemLink to="/mitigation" primary="Mitigation" icon={<FlashOnIcon />} />
            <ListItemLink to="/vger-excelsior" primary="V'Ger / Excelsior" icon={<TravelExploreIcon />} />
            <ListItemLink to="/game-mechanics" primary="Game Mechanics" icon={<FlashOnIcon />} />
            <ListItemLink to="/news" primary="STFC News" icon={<ArticleIcon />} />
            <ListItemLink to="/quick-scans" primary="Quick Scans" icon={<RadarIcon />} />
            <ListItemLink to="/simulator" primary="Simulator" icon={<FlashOnIcon />} />
            <ListItemLink to="/origin-sector" primary="Origin Sector" icon={<FlashOnIcon />} />
            <ListItemLink to="/leslie" primary="Leslie" icon={<FlashOnIcon />} />
            <ListItemLink to="/scrapping" primary="Scrapping" icon={<FlashOnIcon />} />
          </List>
          <Divider />
          <List>
            <ListItemLink to="/about" primary="About" icon={<InfoIcon />} />
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, lg: 3 }, py: 3 }}>
        <Toolbar />
        <Box sx={{ maxWidth: 1540, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
