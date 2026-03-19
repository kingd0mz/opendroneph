import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { MouseEvent } from "react";

import { navigate } from "../../hooks/usePathname";
import type { AOI } from "../../types/dataset";

const PURPOSE_LABELS: Record<AOI["purpose"], string> = {
  disaster: "Disaster",
  landcover: "Landcover",
  benthic: "Coastal",
};

interface AOICardProps {
  aoi: AOI;
  isFocused: boolean;
  onFocus: (aoiId: string) => void;
  onHover: (aoiId: string | null) => void;
}

export function AOICard({ aoi, isFocused, onFocus, onHover }: AOICardProps) {
  function stopAndRun(action: () => void) {
    return (browserEvent: MouseEvent<HTMLButtonElement>) => {
      browserEvent.stopPropagation();
      action();
    };
  }

  return (
    <Card
      onMouseEnter={() => onHover(aoi.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onFocus(aoi.id)}
      sx={{
        cursor: "pointer",
        borderRadius: 1.5,
        bgcolor: "#FFFFFF",
        border: isFocused ? "1px solid rgba(11,31,58,0.22)" : "1px solid rgba(11,31,58,0.08)",
        boxShadow: isFocused ? "0 14px 30px rgba(11,31,58,0.12)" : "0 8px 20px rgba(11,31,58,0.06)",
      }}
    >
      <CardContent sx={{ p: 1.8 }}>
        <Stack spacing={1.1}>
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, color: "primary.main" }}>
              {aoi.title}
            </Typography>
            <Chip
              label={PURPOSE_LABELS[aoi.purpose]}
              size="small"
              sx={{
                bgcolor: aoi.purpose === "disaster" ? "rgba(214,40,40,0.1)" : "rgba(29,78,216,0.1)",
                color: aoi.purpose === "disaster" ? "#D62828" : "#1D4ED8",
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {aoi.orthophotoCount} output{aoi.orthophotoCount === 1 ? "" : "s"}
          </Typography>
          <Button variant="outlined" onClick={stopAndRun(() => navigate(`/aois/${aoi.id}`))}>
            View Area
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
