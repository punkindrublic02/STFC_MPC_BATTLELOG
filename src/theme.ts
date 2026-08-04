import { alpha, createTheme } from "@mui/material/styles";

export const stfcTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1f6ea8",
      dark: "#123b63",
      light: "#6fb6e8",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#d6a530",
      dark: "#9c6f14",
      light: "#f3d27a",
      contrastText: "#111827",
    },
    error: {
      main: "#b3262d",
    },
    warning: {
      main: "#d9822b",
    },
    info: {
      main: "#31a8c7",
    },
    success: {
      main: "#2d7d5b",
    },
    background: {
      default: "#eef4f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#172033",
      secondary: "#55657a",
    },
    divider: alpha("#1f6ea8", 0.16),
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: [
      "Roboto",
      "Arial",
      "sans-serif",
    ].join(","),
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "linear-gradient(90deg, #10233f 0%, #164f78 62%, #8c6b23 100%)",
          boxShadow: "0 2px 10px rgba(16, 35, 63, 0.28)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#0f1b2f",
          color: "#dce8f5",
          borderRight: "1px solid rgba(111, 182, 232, 0.24)",
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          color: "#6fb6e8",
          minWidth: 40,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderLeft: "3px solid transparent",
          color: "#dce8f5",
          "&:hover": {
            backgroundColor: "rgba(111, 182, 232, 0.14)",
            borderLeftColor: "#d6a530",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderColor: alpha("#1f6ea8", 0.18),
          boxShadow: "0 1px 0 rgba(16, 35, 63, 0.04)",
        },
      },
    },
    MuiListSubheader: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          color: alpha("#dce8f5", 0.62),
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: "32px",
          textTransform: "uppercase",
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#1f6ea8", 0.08),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 5,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          textTransform: "none",
          fontWeight: 700,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: "#1f6ea8",
          fontWeight: 700,
        },
      },
    },
  },
});
