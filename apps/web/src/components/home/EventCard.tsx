import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
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
  const accentColor =
    event.aoi.purpose === "disaster"
      ? "#D62828"
      : event.aoi.purpose === "landcover"
        ? "#1D4ED8"
        : "#F2C94C";

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
        borderRadius: 1.5,
        border: isFocused ? `1px solid ${accentColor}` : "1px solid rgba(11,31,58,0.08)",
        backgroundColor: "#FFFFFF",
        color: "text.primary",
        boxShadow: isFocused ? "0 16px 36px rgba(11,31,58,0.14)" : "0 10px 24px rgba(11,31,58,0.08)",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: 0 }}>
        <Stack direction="row" alignItems="stretch">
          <Box sx={{ width: 8, bgcolor: accentColor, flexShrink: 0 }} />
          <Box sx={{ p: 2.2, flex: 1 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.15, color: "primary.main" }}>
              {event.aoi.title}
            </Typography>
            <Chip
              label={event.status}
              size="small"
              sx={{
                bgcolor: accentColor,
                color: event.aoi.purpose === "benthic" ? "#0B1F3A" : "#FFFFFF",
                fontWeight: 800,
              }}
            />
          </Stack>

          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {event.aoi.description || "Short-notice mission area awaiting drone coverage."}
          </Typography>

          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 800 }}>
              {event.orthophotoCount} orthophoto{event.orthophotoCount === 1 ? "" : "s"} submitted
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {event.contributorCount} contributor{event.contributorCount === 1 ? "" : "s"}
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
            <Button variant="contained" color="primary" onClick={stopAndRun(() => navigate(`/aois/${event.aoi.id}`))}>
              View Area
            </Button>
            <Button variant="outlined" color="primary" onClick={stopAndRun(() => navigate(`/upload?aoi=${event.aoi.id}`))}>
              Contribute Data
            </Button>
          </Stack>
        </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
