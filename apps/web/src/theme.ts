import { createTheme } from "@mui/material";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0B1F3A",
      dark: "#142C54",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#1D4ED8",
      dark: "#142C54",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#F2C94C",
      dark: "#D6AE2A",
      contrastText: "#0B1F3A",
    },
    error: {
      main: "#D62828",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F5F7FA",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0B1F3A",
      secondary: "#516074",
    },
    divider: "rgba(11,31,58,0.08)",
  },
  shape: {
    borderRadius: 10,
  },
  spacing: 8,
  typography: {
    fontFamily: 'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },
    h2: {
      fontWeight: 800,
      letterSpacing: "-0.025em",
    },
    h3: {
      fontWeight: 800,
      letterSpacing: "-0.02em",
    },
    h4: {
      fontWeight: 800,
      letterSpacing: "-0.01em",
    },
    h5: {
      fontWeight: 800,
    },
    h6: {
      fontWeight: 800,
    },
    body1: {
      lineHeight: 1.65,
    },
    body2: {
      lineHeight: 1.55,
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
      letterSpacing: "0.01em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F5F7FA",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(11, 31, 58, 0.08)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 16,
          paddingBlock: 8,
        },
        containedPrimary: {
          backgroundColor: "#0B1F3A",
          color: "#FFFFFF",
        },
        outlinedPrimary: {
          borderColor: "rgba(11,31,58,0.24)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          borderRadius: 999,
        },
      },
    },
  },
});
