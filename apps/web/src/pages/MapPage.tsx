import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { navigate } from "../hooks/usePathname";
import { ApiError } from "../services/api";
import { fetchAois } from "../services/datasets";
import type { AOI } from "../types/dataset";

const PURPOSE_LABELS: Record<AOI["purpose"], string> = {
  disaster: "Disaster Response",
  landcover: "Land Cover Validation",
  benthic: "Benthic Habitat Mapping",
};

function orthophotoProgressLabel(count: number) {
  return `${count} orthophoto${count === 1 ? "" : "s"} submitted`;
}

export function MapPage() {
  const [aois, setAois] = useState<AOI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAois() {
      try {
        setIsLoading(true);
        const result = await fetchAois();
        if (!isMounted) {
          return;
        }
        setAois(result);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : "Failed to load active areas.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAois();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeAois = useMemo(
    () => aois.filter((aoi) => aoi.isActive),
    [aois],
  );

  if (isLoading) {
    return <FullscreenLoadingState />;
  }

  if (error) {
    return (
      <FullscreenState
        title="AOI Load Failed"
        description={error}
        severity="error"
      />
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto", bgcolor: "#f6f1e8" }}>
      <Stack spacing={5} sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
        <Card
          sx={{
            borderRadius: 5,
            overflow: "hidden",
            background: "linear-gradient(135deg, #114c5b 0%, #1b7e69 55%, #f0b44d 100%)",
            color: "common.white",
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Stack spacing={2.5} sx={{ maxWidth: 780 }}>
              <Typography variant="overline" sx={{ letterSpacing: 1.4, opacity: 0.9 }}>
                Open Contribution
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 900, lineHeight: 1.05, fontSize: { xs: "2.3rem", md: "4rem" } }}>
                Help Map the Philippines with Drone Data
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.92, maxWidth: 680 }}>
                Contribute drone imagery for disaster response, land cover validation, and coastal mapping.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="contained" color="warning" onClick={() => navigate("/upload")}>
                  Upload Dataset
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    const firstAoi = activeAois[0];
                    if (firstAoi) {
                      navigate(`/aois/${firstAoi.id}`);
                    }
                  }}
                  disabled={activeAois.length === 0}
                >
                  Explore Active Areas
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Contribute to Active Areas
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary", mt: 1 }}>
              These areas highlight where contribution is needed right now. They do not restrict open uploads.
            </Typography>
          </Box>

          {activeAois.length === 0 ? (
            <Alert severity="info">No active AOIs yet. You can still upload drone datasets anytime.</Alert>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              {activeAois.map((aoi) => (
                <Card key={aoi.id} sx={{ borderRadius: 4, background: "#fffdf8" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {aoi.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75 }}>
                            {aoi.description || "No AOI description provided yet."}
                          </Typography>
                        </Box>
                        <Chip label={PURPOSE_LABELS[aoi.purpose]} color="primary" />
                      </Stack>

                      <Stack spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {orthophotoProgressLabel(aoi.orthophotoCount)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {aoi.rawCount} RAW dataset{aoi.rawCount === 1 ? "" : "s"} available
                        </Typography>
                      </Stack>

                      <Box>
                        <Button variant="contained" onClick={() => navigate(`/aois/${aoi.id}`)}>
                          View Area
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Stack>

        <Card sx={{ borderRadius: 4, background: "#fffaf1" }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={1.5} alignItems="flex-start">
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                Upload Existing Drone Data
              </Typography>
              <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 500 }}>
                Already have drone imagery?
              </Typography>
              <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 720 }}>
                Share drone datasets for mapping, monitoring, and temporal analysis.
              </Typography>
              <Button variant="contained" onClick={() => navigate("/upload")}>
                Upload Dataset
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
