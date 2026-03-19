import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../hooks/usePathname";
import { ApiError } from "../services/api";
import { completeJob, downloadDataset, fetchJobs, startJob } from "../services/datasets";
import type { Job } from "../types/dataset";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatActivity(job: Job) {
  if (job.activeUserCount === 0) {
    return "No one has marked this job as active yet.";
  }

  const [firstName] = job.activeUsernames;
  if (job.activeUserCount === 1) {
    return `${firstName} is working on this.`;
  }

  return `${firstName} and ${job.activeUserCount - 1} others are working on this.`;
}

export function JobsPage() {
  const { requireAuth } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  async function loadJobs(showSpinner = true) {
    try {
      if (showSpinner) {
        setIsLoading(true);
      }
      const results = await fetchJobs();
      setJobs(results);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load jobs.");
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  async function handleProtectedAction(jobId: string, action: () => Promise<void>, successMessage: string) {
    await requireAuth(async () => {
      try {
        setActiveJobId(jobId);
        setMessage(null);
        await action();
        await loadJobs(false);
        setMessage(successMessage);
      } catch (actionError) {
        setMessage(actionError instanceof ApiError ? actionError.message : "Action failed.");
      } finally {
        setActiveJobId(null);
      }
    });
  }

  async function handleDownload(jobId: string) {
    await requireAuth(async () => {
      try {
        setActiveJobId(jobId);
        setMessage(null);
        const result = await downloadDataset(jobId);
        if (result.downloadUrl) {
          window.location.assign(result.downloadUrl);
          return;
        }
        setMessage("Download request succeeded, but no download URL was returned.");
      } catch (downloadError) {
        setMessage(downloadError instanceof ApiError ? downloadError.message : "Download failed.");
      } finally {
        setActiveJobId(null);
      }
    });
  }

  if (isLoading) {
    return <FullscreenLoadingState />;
  }

  if (error) {
    return (
      <FullscreenState
        title="Jobs Unavailable"
        description={error}
        severity="error"
      />
    );
  }

  if (jobs.length === 0) {
    return (
      <FullscreenState
        title="No Open Jobs"
        description="Published RAW datasets will appear here once contributors upload them."
        severity="warning"
      />
    );
  }

  return (
    <Box sx={{ height: "100%", overflow: "auto", p: { xs: 2, md: 4 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1040, mx: "auto" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Open Jobs
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary", mt: 1 }}>
            Jobs are published RAW datasets. Anyone can download them, process them offline, and upload an orthophoto later.
          </Typography>
        </Box>

        {message ? <Alert severity="info">{message}</Alert> : null}

        <Stack spacing={2.5}>
          {jobs.map((job) => {
            const isBusy = activeJobId === job.id;

            return (
              <Card key={job.id} sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 700, cursor: "pointer" }}
                          onClick={() => navigate(`/datasets/${job.id}`)}
                        >
                          {job.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75 }}>
                          {job.description || "No description provided."}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label="RAW" color="primary" />
                        <Chip label={`Validation: ${job.validationStatus}`} variant="outlined" />
                      </Stack>
                    </Stack>

                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                      <Stack spacing={0.75}>
                        <Typography variant="body2">
                          <strong>Uploader:</strong>{" "}
                          <Box
                            component="span"
                            sx={{ cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => navigate(`/users/${job.uploader.id}`)}
                          >
                            {job.uploader.username}
                          </Box>
                        </Typography>
                        <Typography variant="body2">
                          <strong>Created:</strong> {formatDate(job.createdAt)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {formatActivity(job)}
                        </Typography>
                      </Stack>

                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button
                          variant="outlined"
                          onClick={() => void handleProtectedAction(job.id, () => startJob(job.id), "Job marked as active.")}
                          disabled={isBusy}
                        >
                          I&apos;m Working on This
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => void handleProtectedAction(job.id, () => completeJob(job.id), "Job marked as completed.")}
                          disabled={isBusy}
                        >
                          Mark as Completed
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => void handleDownload(job.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? <CircularProgress size={18} color="inherit" /> : "Download"}
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
}
