import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

import { navigate } from "../../hooks/usePathname";
import type { AOI } from "../../types/dataset";

const PURPOSE_LABELS: Record<AOI["purpose"], string> = {
  disaster: "Disaster Response",
  landcover: "Land Cover Validation",
  benthic: "Coastal Mapping",
};

function missionStatus(aoi: AOI) {
  if (aoi.rawCount === 0 && aoi.orthophotoCount === 0) {
    return "Needs Data";
  }
  if (aoi.orthophotoCount > 0) {
    return "Recently Updated";
  }
  return "Ongoing";
}

interface AOIListProps {
  aois: AOI[];
}

export function AOIList({ aois }: AOIListProps) {
  return (
    <Stack spacing={1.5}>
      {aois.map((aoi) => (
        <Card
          key={aoi.id}
          sx={{
            borderRadius: 3,
            border: "1px solid rgba(255, 209, 102, 0.2)",
            background: "linear-gradient(180deg, rgba(16,49,56,0.96) 0%, rgba(14,39,45,0.94) 100%)",
            color: "common.white",
            boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
          }}
        >
          <CardContent sx={{ p: 2.2 }}>
            <Stack spacing={1.6}>
              <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                    {aoi.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.68)", mt: 0.6 }}>
                    {aoi.description || "Priority area awaiting new imagery."}
                  </Typography>
                </Box>
                <Chip
                  label={PURPOSE_LABELS[aoi.purpose]}
                  size="small"
                  sx={{ bgcolor: "#f0b44d", color: "#17343a", fontWeight: 800 }}
                />
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  label={missionStatus(aoi)}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: "rgba(255,255,255,0.22)", color: "common.white", fontWeight: 700 }}
                />
                <Typography variant="body2" sx={{ color: "#ffe6ab", fontWeight: 700, alignSelf: "center" }}>
                  {aoi.orthophotoCount} orthophoto{aoi.orthophotoCount === 1 ? "" : "s"} submitted
                </Typography>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <Button variant="contained" color="warning" onClick={() => navigate(`/aois/${aoi.id}`)}>
                  View Area
                </Button>
                <Button variant="outlined" color="inherit" onClick={() => navigate(`/upload?aoi=${aoi.id}`)}>
                  Contribute Data
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
