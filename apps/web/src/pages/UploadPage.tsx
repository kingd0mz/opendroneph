import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { FullscreenState } from "../components/FullscreenState";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../hooks/usePathname";
import { ApiError } from "../services/api";
import { createDataset, fetchDatasetDetail, publishDataset, uploadDatasetAsset } from "../services/datasets";
import type { DatasetDetail, DatasetType, ValidationStatus } from "../types/dataset";

const PLACEHOLDER_FOOTPRINT: GeoJSON.MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [[
      [120.95, 14.53],
      [121.03, 14.53],
      [121.03, 14.61],
      [120.95, 14.61],
      [120.95, 14.53],
    ]],
  ],
};

const DATASET_TYPE_OPTIONS: Array<{ value: DatasetType; label: string }> = [
  { value: "raw", label: "RAW" },
  { value: "orthophoto", label: "ORTHOPHOTO" },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function validationSeverity(status: ValidationStatus | null): "success" | "warning" | "error" {
  if (status === "valid") {
    return "success";
  }
  if (status === "pending") {
    return "warning";
  }
  return "error";
}

export function UploadPage() {
  const { isAuthenticated, loading, openLoginModal } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [datasetType, setDatasetType] = useState<DatasetType>("raw");
  const [captureDate, setCaptureDate] = useState(todayDate());
  const [sourceDatasetId, setSourceDatasetId] = useState("");
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [datasetDetail, setDatasetDetail] = useState<DatasetDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      openLoginModal(() => navigate("/upload"));
    }
  }, [isAuthenticated, loading, openLoginModal]);

  const validationStatus = datasetDetail?.validationStatus ?? null;
  const canPublish = validationStatus === "valid" && !isPublishing;
  const activeDatasetType = datasetDetail?.dataType ?? datasetType;
  const assetType = useMemo(
    () => (activeDatasetType === "raw" ? "raw_archive" : "orthophoto_cog"),
    [activeDatasetType],
  );

  async function refreshDatasetDetail(id: string) {
    const detail = await fetchDatasetDetail(id);
    setDatasetDetail(detail);
    return detail;
  }

  async function handleCreateDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setUploadError(null);
    setPublishError(null);
    setSuccessMessage(null);

    try {
      const created = await createDataset({
        title: title.trim(),
        description: description.trim(),
        type: datasetType,
        sourceDatasetId: datasetType === "orthophoto" && sourceDatasetId.trim() ? sourceDatasetId.trim() : undefined,
        footprint: PLACEHOLDER_FOOTPRINT,
        captureDate: captureDate || todayDate(),
      });

      setDatasetId(created.id);
      await refreshDatasetDetail(created.id);
      setSuccessMessage("Dataset created. Upload an asset to continue.");
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.message : "Failed to create dataset.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUploadAsset() {
    if (!datasetId || !selectedFile) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setPublishError(null);
    setSuccessMessage(null);
    setUploadProgress(0);

    try {
      await uploadDatasetAsset({
        datasetId,
        assetType,
        file: selectedFile,
        onProgress: setUploadProgress,
      });
      const detail = await refreshDatasetDetail(datasetId);
      if (detail.validationStatus === "valid") {
        setSuccessMessage("Asset uploaded. Dataset is valid and ready to publish.");
      } else {
        setSuccessMessage("Asset uploaded.");
      }
    } catch (error) {
      setUploadError(error instanceof ApiError ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePublish() {
    if (!datasetId || validationStatus !== "valid") {
      return;
    }

    setIsPublishing(true);
    setPublishError(null);
    setSuccessMessage(null);

    try {
      await publishDataset(datasetId);
      navigate(`/datasets/${datasetId}`);
    } catch (error) {
      setPublishError(error instanceof ApiError ? error.message : "Publish failed.");
    } finally {
      setIsPublishing(false);
    }
  }

  if (loading) {
    return (
      <FullscreenState
        title="Loading Upload Page"
        description="Checking your session before opening contributor tools."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <FullscreenState
        title="Sign In Required"
        description="You need to sign in to create, upload, and publish datasets."
        severity="warning"
      />
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto", p: { xs: 2, md: 4 } }}>
      <Stack spacing={3} sx={{ maxWidth: 880, mx: "auto" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Contribute Dataset
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary", mt: 1 }}>
            Create a dataset record, upload one asset, then publish it if validation passes.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Stack spacing={2.5} component="form" onSubmit={handleCreateDataset}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                1. Create Dataset
              </Typography>
              {createError ? <Alert severity="error">{createError}</Alert> : null}
              <TextField
                label="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                multiline
                minRows={3}
                fullWidth
              />
              <TextField
                select
                label="Dataset Type"
                value={datasetType}
                onChange={(event) => setDatasetType(event.target.value as DatasetType)}
                fullWidth
              >
                {DATASET_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Capture Date"
                type="date"
                value={captureDate}
                onChange={(event) => setCaptureDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              {datasetType === "orthophoto" ? (
                <TextField
                  label="Source RAW Dataset ID (optional)"
                  value={sourceDatasetId}
                  onChange={(event) => setSourceDatasetId(event.target.value)}
                  fullWidth
                  helperText="Optional reference only. Orthophotos can still be created and published without linking."
                />
              ) : null}
              <Alert severity="info">
                Footprint uses a temporary placeholder inside the Philippines for now. Upload UI does not collect geometry yet.
              </Alert>
              <Box>
                <Button type="submit" variant="contained" disabled={isCreating || !title.trim()}>
                  {isCreating ? "Creating..." : "Create Dataset"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                2. Upload Asset
              </Typography>
              {!datasetId ? (
                <Alert severity="info">Create a dataset first.</Alert>
              ) : null}
              {uploadError ? <Alert severity="error">{uploadError}</Alert> : null}
              <Button variant="outlined" component="label" disabled={!datasetId || isUploading}>
                {selectedFile ? "Change File" : "Select File"}
                <input
                  hidden
                  type="file"
                  accept={activeDatasetType === "raw" ? ".zip" : ".tif,.tiff"}
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </Button>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {selectedFile ? `Selected: ${selectedFile.name}` : "No file selected."}
              </Typography>
              {isUploading ? <LinearProgress variant={uploadProgress > 0 ? "determinate" : "indeterminate"} value={uploadProgress} /> : null}
              <Box>
                <Button
                  variant="contained"
                  onClick={() => void handleUploadAsset()}
                  disabled={!datasetId || !selectedFile || isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload Asset"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                3. Publish Dataset
              </Typography>
              {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
              {publishError ? <Alert severity="error">{publishError}</Alert> : null}
              {validationStatus ? (
                <Alert severity={validationSeverity(validationStatus)}>
                  Validation status: <strong>{validationStatus}</strong>
                  {validationStatus === "invalid" ? " - Dataset cannot be published." : null}
                </Alert>
              ) : (
                <Alert severity="info">Upload an asset to see validation status.</Alert>
              )}
              {datasetDetail ? (
                <Stack spacing={0.5}>
                  <Typography variant="body2"><strong>Dataset ID:</strong> {datasetDetail.id}</Typography>
                  <Typography variant="body2"><strong>Status:</strong> {datasetDetail.status}</Typography>
                  <Typography variant="body2"><strong>Type:</strong> {datasetDetail.dataType}</Typography>
                  {datasetDetail.sourceDataset ? (
                    <Typography variant="body2">
                      <strong>Source RAW Dataset:</strong> {datasetDetail.sourceDataset.title} ({datasetDetail.sourceDataset.id})
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}
              <Box>
                <Button variant="contained" onClick={() => void handlePublish()} disabled={!canPublish}>
                  {isPublishing ? "Publishing..." : "Publish Dataset"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
