import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, List, ListItem, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";

import { AOIMap } from "../components/AOIMap";
import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../hooks/usePathname";
import { ApiError } from "../services/api";
import { downloadDataset, fetchAoiDatasets } from "../services/datasets";
import type { AOIDatasets, AOI, DatasetDetail } from "../types/dataset";

const PURPOSE_LABELS: Record<AOI["purpose"], string> = {
  disaster: "Disaster Response",
  landcover: "Land Cover Validation",
  benthic: "Benthic Habitat Mapping",
};

function DatasetSection({
  title,
  datasets,
  emptyMessage,
  onDownload,
  downloadingDatasetId,
}: {
  title: string;
  datasets: DatasetDetail[];
  emptyMessage: string;
  onDownload?: (datasetId: string) => Promise<void>;
  downloadingDatasetId?: string | null;
}) {
  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          {title}
        </Typography>
        {datasets.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {emptyMessage}
          </Typography>
        ) : (
          <List disablePadding>
            {datasets.map((dataset, index) => (
              <Box key={dataset.id}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigate(`/datasets/${dataset.id}`)}>
                    <ListItemText
                      primary={dataset.title}
                      secondary={`${dataset.dataType} | ${new Date(dataset.createdAt).toLocaleDateString()}`}
                    />
                  </ListItemButton>
                  {onDownload ? (
                    <Button
                      variant="outlined"
                      sx={{ mr: 2 }}
                      onClick={() => void onDownload(dataset.id)}
                      disabled={downloadingDatasetId === dataset.id}
                    >
                      {downloadingDatasetId === dataset.id ? "Preparing..." : "Download"}
                    </Button>
                  ) : null}
                </ListItem>
                {index < datasets.length - 1 ? <Divider /> : null}
              </Box>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

interface AOIPageProps {
  aoiId: string | null;
}

export function AOIPage({ aoiId }: AOIPageProps) {
  const { requireAuth } = useAuth();
  const [payload, setPayload] = useState<AOIDatasets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingDatasetId, setDownloadingDatasetId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAoi() {
      if (!aoiId) {
        setError("AOI not found.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const result = await fetchAoiDatasets(aoiId);
        if (!isMounted) {
          return;
        }
        setPayload(result);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : "Failed to load the AOI.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAoi();

    return () => {
      isMounted = false;
    };
  }, [aoiId]);

  const allDatasets = useMemo(
    () => [...(payload?.rawDatasets ?? []), ...(payload?.orthophotos ?? [])],
    [payload],
  );

  async function handleDownload(datasetId: string) {
    await requireAuth(async () => {
      try {
        setDownloadingDatasetId(datasetId);
        setMessage(null);
        const result = await downloadDataset(datasetId);
        if (result.downloadUrl) {
          window.location.assign(result.downloadUrl);
          return;
        }
        setMessage("Download request succeeded, but no download URL was returned.");
      } catch (downloadError) {
        setMessage(downloadError instanceof ApiError ? downloadError.message : "Download failed.");
      } finally {
        setDownloadingDatasetId(null);
      }
    });
  }

  if (isLoading) {
    return <FullscreenLoadingState />;
  }

  if (error || !payload) {
    return (
      <FullscreenState
        title="AOI Unavailable"
        description={error ?? "Unable to load the requested area."}
        severity="error"
      />
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto", bgcolor: "#f6f1e8", p: { xs: 2, md: 4 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1180, mx: "auto" }}>
        <Box>
          <Button variant="text" onClick={() => navigate("/")} sx={{ px: 0, mb: 1 }}>
            Back to Home
          </Button>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 900 }}>
                {payload.aoi.title}
              </Typography>
              <Typography variant="body1" sx={{ color: "text.secondary", mt: 1, maxWidth: 760 }}>
                {payload.aoi.description || "No AOI description provided yet."}
              </Typography>
            </Box>
            <Stack spacing={1} alignItems={{ xs: "flex-start", md: "flex-end" }}>
              <Chip label={PURPOSE_LABELS[payload.aoi.purpose]} color="primary" />
              <Button variant="contained" onClick={() => navigate(`/upload?aoi=${payload.aoi.id}`)}>
                Upload for This Area
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Card sx={{ borderRadius: 4, overflow: "hidden" }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Area Map
              </Typography>
            </Box>
            <Box sx={{ height: 420, px: 2, pb: 2 }}>
              <AOIMap
                aoiGeometry={payload.aoi.geometry}
                datasets={allDatasets.map((dataset) => ({
                  id: dataset.id,
                  title: dataset.title,
                  footprint: dataset.footprint,
                }))}
              />
            </Box>
          </CardContent>
        </Card>

        {allDatasets.length === 0 ? (
          <Alert severity="info">Be the first to contribute data for this area.</Alert>
        ) : null}
        {message ? <Alert severity="info">{message}</Alert> : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <DatasetSection
              title="RAW Data"
              datasets={payload.rawDatasets}
              emptyMessage="Be the first to contribute data for this area."
              onDownload={handleDownload}
              downloadingDatasetId={downloadingDatasetId}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <DatasetSection
              title="Orthophotos"
              datasets={payload.orthophotos}
              emptyMessage="No published orthophotos for this area yet."
            />
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
