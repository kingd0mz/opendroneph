import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import { theme } from "./theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <CssBaseline />
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
