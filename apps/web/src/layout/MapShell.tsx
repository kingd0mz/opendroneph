import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";

export function MapShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background:
            "linear-gradient(90deg, rgba(15,93,94,0.98) 0%, rgba(31,127,105,0.95) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <Toolbar sx={{ minHeight: "72px !important" }}>
          <Typography variant="h6" component="h1">
            OpenDronePH
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
