import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface FullscreenStateProps {
  title: string;
  description: string;
  severity?: "info" | "warning" | "error";
  icon?: ReactNode;
}

export function FullscreenState({
  title,
  description,
  severity = "info",
  icon,
}: FullscreenStateProps) {
  return (
    <Box
      sx={{
        display: "grid",
        placeItems: "center",
        height: "100%",
        px: 3,
      }}
    >
      <Alert
        severity={severity}
        icon={icon}
        sx={{
          width: "min(520px, 100%)",
          borderRadius: 3,
          boxShadow: "0 20px 50px rgba(15, 44, 43, 0.14)",
        }}
      >
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2">{description}</Typography>
      </Alert>
    </Box>
  );
}

export function FullscreenLoadingState() {
  return (
    <FullscreenState
      title="Loading Datasets"
      description="Fetching published footprints from the OpenDronePH API."
      icon={<CircularProgress color="inherit" size={20} />}
    />
  );
}
