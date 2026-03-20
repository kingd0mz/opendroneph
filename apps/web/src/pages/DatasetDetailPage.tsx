import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";

import { DatasetFootprintMap } from "../components/DatasetFootprintMap";
import { useAuth } from "../context/AuthContext";
import { FullscreenState } from "../components/FullscreenState";
import { useDatasetDetail } from "../hooks/useDatasetDetail";
import { navigate } from "../hooks/usePathname";
import { ApiError } from "../services/api";
import { downloadDataset } from "../services/datasets";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(sizeBytes / 1024 / 1024)} MB`;
}

function validationTone(status: string): "success" | "warning" | "error" {
  if (status === "valid") {
    return "success";
  }
  if (status === "pending") {
    return "warning";
  }
  return "error";
}

interface DatasetDetailPageProps {
  datasetId: string | null;
}

export function DatasetDetailPage({ datasetId }: DatasetDetailPageProps) {
  const { requireAuth } = useAuth();
  const { dataset, isLoading, error, statusCode } = useDatasetDetail(datasetId);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const statusLabel = useMemo(() => dataset?.validationStatus.replace("_", " ") ?? "", [dataset?.validationStatus]);

  async function performDownload() {
    if (!datasetId) {
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadMessage(null);
      const result = await downloadDataset(datasetId);

      if (result.downloadUrl) {
        window.location.assign(result.downloadUrl);
        return;
      }

      setDownloadMessage("Download request succeeded, but no download URL was returned.");
    } catch (downloadError) {
      if (downloadError instanceof ApiError) {
        if (downloadError.statusCode === 401) {
          setDownloadMessage("You need to sign in to download this dataset.");
          return;
        }
        if (downloadError.statusCode === 403) {
          setDownloadMessage("Your account is not allowed to download this dataset.");
          return;
        }
        if (downloadError.statusCode === 400) {
          setDownloadMessage(downloadError.message);
          return;
        }
      }

      setDownloadMessage("Download failed.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownload() {
    await requireAuth(performDownload);
  }

  if (isLoading) {
    return (
      <FullscreenState
        title="Loading Dataset"
        description="Fetching dataset metadata, footprint, and downloadable assets."
      />
    );
  }

  if (statusCode === 404) {
    return (
      <FullscreenState
        title="Dataset Not Found"
        description="The requested dataset does not exist or is not publicly available."
        severity="warning"
      />
    );
  }

  if (error || !dataset) {
    return (
      <FullscreenState
        title="Dataset Load Failed"
        description={error ?? "Failed to load dataset details."}
        severity="error"
      />
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto", p: { xs: 2, md: 3 } }}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Button variant="text" onClick={() => navigate("/")} sx={{ px: 0, mb: 1 }}>
              Back to Map
            </Button>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {dataset.title}
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary", mt: 1, maxWidth: 840 }}>
              {dataset.description || "No description provided."}
            </Typography>
          </Box>
          <Chip
            color={validationTone(dataset.validationStatus)}
            label={`Validation: ${statusLabel}`}
            sx={{ fontWeight: 700, textTransform: "capitalize" }}
          />
        </Stack>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">
          <Card sx={{ flex: 1.2, minHeight: 360, overflow: "hidden" }}>
            <CardContent sx={{ p: 0, height: "100%" }}>
              <Box sx={{ px: 2.5, pt: 2.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Footprint
                </Typography>
              </Box>
              <Box sx={{ height: 300, p: 2 }}>
                <DatasetFootprintMap footprint={dataset.footprint} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Dataset Info
              </Typography>
              <Stack spacing={1.5}>
                <Typography variant="body2"><strong>Data type:</strong> {dataset.dataType}</Typography>
                <Typography variant="body2"><strong>Status:</strong> {dataset.status}</Typography>
                <Typography variant="body2"><strong>Created:</strong> {formatDate(dataset.createdAt)}</Typography>
                {dataset.aoi ? (
                  <Typography
                    variant="body2"
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/aois/${dataset.aoi?.id}`)}
                  >
                    <strong>AOI:</strong> {dataset.aoi.title}
                  </Typography>
                ) : null}
                <Typography
                  variant="body2"
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/users/${dataset.uploader.id}`)}
                >
                  <strong>Uploader:</strong> {dataset.uploader.username} ({dataset.uploader.email})
                </Typography>
                {dataset.job ? (
                  <Typography variant="body2">
                    <strong>Linked Job:</strong> {dataset.job.title}
                  </Typography>
                ) : null}
                {dataset.mission ? (
                  <Typography variant="body2">
                    <strong>Mission:</strong> {dataset.mission.title}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Assets
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Published, valid datasets are publicly viewable. Download requires login.
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={() => void handleDownload()}
                disabled={isDownloading || dataset.assets.every((asset) => !asset.isDownloadable)}
              >
                {isDownloading ? "Preparing Download..." : "Download Dataset"}
              </Button>
            </Stack>

            {downloadMessage ? <Alert severity="info" sx={{ mb: 2 }}>{downloadMessage}</Alert> : null}

            {dataset.assets.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No assets are available for this dataset yet.
              </Typography>
            ) : (
              <List disablePadding>
                {dataset.assets.map((asset, index) => (
                  <Box key={asset.id}>
                    <ListItem
                      disableGutters
                      secondaryAction={
                        <Button
                          variant="outlined"
                          onClick={() => void handleDownload()}
                          disabled={isDownloading || !asset.isDownloadable}
                        >
                          Download
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={asset.assetType}
                        secondary={`Size: ${formatBytes(asset.sizeBytes)} | Created: ${formatDate(asset.createdAt)}`}
                      />
                    </ListItem>
                    {index < dataset.assets.length - 1 ? <Divider /> : null}
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
