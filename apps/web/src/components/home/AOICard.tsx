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
        borderRadius: 3,
        bgcolor: isFocused ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.9)",
        border: isFocused ? "1px solid rgba(15,93,94,0.22)" : "1px solid rgba(15,93,94,0.08)",
      }}
    >
      <CardContent sx={{ p: 1.8 }}>
        <Stack spacing={1.1}>
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {aoi.title}
            </Typography>
            <Chip label={PURPOSE_LABELS[aoi.purpose]} size="small" color="primary" />
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
