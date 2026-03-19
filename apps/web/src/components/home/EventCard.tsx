import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { MouseEvent } from "react";

import { navigate } from "../../hooks/usePathname";
import type { AOI } from "../../types/dataset";

export interface EventCardData {
  aoi: AOI;
  status: "Ongoing" | "Needs Data" | "Recently Updated";
  orthophotoCount: number;
  contributorCount: number;
}

interface EventCardProps {
  event: EventCardData;
  isFocused: boolean;
  onFocus: (aoiId: string) => void;
  onHover: (aoiId: string | null) => void;
}

export function EventCard({ event, isFocused, onFocus, onHover }: EventCardProps) {
  function stopAndRun(action: () => void) {
    return (browserEvent: MouseEvent<HTMLButtonElement>) => {
      browserEvent.stopPropagation();
      action();
    };
  }

  return (
    <Card
      onMouseEnter={() => onHover(event.aoi.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onFocus(event.aoi.id)}
      sx={{
        cursor: "pointer",
        borderRadius: 3,
        border: isFocused ? "1px solid rgba(235,87,87,0.45)" : "1px solid rgba(235,87,87,0.18)",
        background: isFocused
          ? "linear-gradient(180deg, rgba(88,25,24,0.96) 0%, rgba(47,16,19,0.94) 100%)"
          : "linear-gradient(180deg, rgba(70,23,27,0.96) 0%, rgba(35,14,18,0.94) 100%)",
        color: "common.white",
        boxShadow: isFocused ? "0 24px 56px rgba(85, 10, 10, 0.34)" : "0 18px 44px rgba(0,0,0,0.22)",
      }}
    >
      <CardContent sx={{ p: 2.2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
              {event.aoi.title}
            </Typography>
            <Chip
              label={event.status}
              size="small"
              sx={{
                bgcolor: "#ff8a80",
                color: "#3c0d11",
                fontWeight: 900,
              }}
            />
          </Stack>

          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.76)" }}>
            {event.aoi.description || "Short-notice mission area awaiting drone coverage."}
          </Typography>

          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ color: "#ffd9c7", fontWeight: 800 }}>
              {event.orthophotoCount} orthophoto{event.orthophotoCount === 1 ? "" : "s"} submitted
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.74)" }}>
              {event.contributorCount} contributor{event.contributorCount === 1 ? "" : "s"}
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
            <Button variant="contained" color="warning" onClick={stopAndRun(() => navigate(`/aois/${event.aoi.id}`))}>
              View Area
            </Button>
            <Button variant="outlined" color="inherit" onClick={stopAndRun(() => navigate(`/upload?aoi=${event.aoi.id}`))}>
              Contribute Data
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
