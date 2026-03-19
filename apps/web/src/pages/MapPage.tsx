import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { AOIList } from "../components/home/AOIList";
import { ContributionFeed, type ContributionFeedItem } from "../components/home/ContributionFeed";
import { JobList } from "../components/home/JobList";
import { useAuth } from "../context/AuthContext";
import { toDatasetFeatureCollection } from "../features/datasets/datasetGeoJson";
import { DatasetMap } from "../features/map/DatasetMap";
import type { AOIFeatureProperties } from "../features/map/DatasetMap";
import { navigate } from "../hooks/usePathname";
import { ApiError } from "../services/api";
import {
  downloadDataset,
  fetchAois,
  fetchDatasetDetail,
  fetchJobs,
  fetchPublishedDatasets,
} from "../services/datasets";
import { fetchMyProfile } from "../services/users";
import type { AOI, Dataset, Job } from "../types/dataset";
import type { UserProfile } from "../types/user";

function toAoiFeatureCollection(aois: AOI[]): GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, AOIFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: aois.map((aoi) => ({
      type: "Feature",
      geometry: aoi.geometry,
      properties: {
        id: aoi.id,
        title: aoi.title,
        purpose: aoi.purpose,
      },
    })),
  };
}

function latestContributionIds(datasets: Dataset[]) {
  return [...datasets]
    .filter((dataset) => dataset.dataType === "orthophoto")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5)
    .map((dataset) => dataset.id);
}

function uniqueAoiCount(profile: UserProfile) {
  return profile.aois_contributed_to.length;
}

export function MapPage() {
  const { isAuthenticated, requireAuth } = useAuth();
  const [aois, setAois] = useState<AOI[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contributionFeed, setContributionFeed] = useState<ContributionFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHomepage() {
      try {
        setIsLoading(true);
        const [aoisResult, jobsResult, datasetsResult, profileResult] = await Promise.all([
          fetchAois(),
          fetchJobs(),
          fetchPublishedDatasets(),
          isAuthenticated ? fetchMyProfile().catch(() => null) : Promise.resolve(null),
        ]);

        const feedIds = latestContributionIds(datasetsResult);
        const feedDetails = await Promise.all(
          feedIds.map(async (id) => {
            const detail = await fetchDatasetDetail(id);
            return {
              id: detail.id,
              title: detail.title,
              contributor: detail.uploader.username,
              createdAt: detail.createdAt,
              dataType: detail.dataType,
            } satisfies ContributionFeedItem;
          }),
        );

        if (!isMounted) {
          return;
        }

        setAois(aoisResult.filter((aoi) => aoi.isActive));
        setJobs(jobsResult.slice(0, 4));
        setDatasets(datasetsResult.filter((dataset) => dataset.dataType === "orthophoto"));
        setProfile(profileResult);
        setContributionFeed(feedDetails);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : "Failed to load the homepage.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadHomepage();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const datasetCollection = useMemo(() => toDatasetFeatureCollection(datasets), [datasets]);
  const aoiCollection = useMemo(() => toAoiFeatureCollection(aois), [aois]);

  async function handleJobDownload(datasetId: string) {
    await requireAuth(async () => {
      try {
        setDownloadingJobId(datasetId);
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
        setDownloadingJobId(null);
      }
    });
  }

  if (isLoading) {
    return <FullscreenLoadingState />;
  }

  if (error) {
    return (
      <FullscreenState
        title="Homepage Unavailable"
        description={error}
        severity="error"
      />
    );
  }

  return (
    <Box sx={{ position: "relative", height: "100%", minHeight: 0, overflow: "hidden", bgcolor: "#06171c" }}>
      <Box sx={{ position: "absolute", inset: 0 }}>
        <DatasetMap datasetCollection={datasetCollection} aoiCollection={aoiCollection} />
      </Box>

      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, rgba(3,15,19,0.82) 0%, rgba(3,15,19,0.6) 26%, rgba(3,15,19,0.18) 52%, rgba(3,15,19,0.08) 100%)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          top: { xs: 16, md: 24 },
          left: { xs: 16, md: 24 },
          right: { xs: 16, md: "auto" },
          width: { xs: "auto", md: 430 },
          maxHeight: { xs: "calc(100% - 32px)", md: "calc(100% - 48px)" },
          overflow: "auto",
          pr: { md: 1 },
        }}
      >
        <Stack spacing={2}>
          <Card
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              bgcolor: "rgba(8,22,28,0.9)",
              color: "common.white",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 30px 70px rgba(0,0,0,0.34)",
              backdropFilter: "blur(18px)",
            }}
          >
            <CardContent sx={{ p: 2.6 }}>
              <Stack spacing={1.4}>
                <Typography variant="overline" sx={{ color: "#ffe6ab", letterSpacing: 1.4 }}>
                  Help Map the Philippines
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.02, fontSize: { xs: "2rem", md: "2.7rem" } }}>
                  Show up where the country needs data.
                </Typography>
                <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.76)" }}>
                  Contribute drone data for disaster response, environmental monitoring, and national mapping.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1}>
                  <Button variant="contained" color="warning" onClick={() => navigate("/upload")}>
                    Upload Dataset
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => {
                      const firstMission = aois[0];
                      if (firstMission) {
                        navigate(`/aois/${firstMission.id}`);
                      }
                    }}
                    disabled={aois.length === 0}
                  >
                    View Missions
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {message ? <Alert severity="info">{message}</Alert> : null}

          <Card sx={{ borderRadius: 4, bgcolor: "rgba(250,248,242,0.95)", backdropFilter: "blur(18px)" }}>
            <CardContent sx={{ p: 2.2 }}>
              <Stack spacing={1.6}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Active Missions
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                    Purpose-driven areas where new imagery matters most right now.
                  </Typography>
                </Box>
                {aois.length === 0 ? (
                  <Alert severity="info">No active missions yet. Open contribution is still available anytime.</Alert>
                ) : (
                  <AOIList aois={aois} />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 4, bgcolor: "rgba(250,248,242,0.95)", backdropFilter: "blur(18px)" }}>
            <CardContent sx={{ p: 2.2 }}>
              <Stack spacing={1.4}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Open Jobs (Raw Data)
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                    Raw archives that anyone can process into orthophotos.
                  </Typography>
                </Box>
                {jobs.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No open RAW jobs yet.
                  </Typography>
                ) : (
                  <JobList jobs={jobs} downloadingJobId={downloadingJobId} onDownload={handleJobDownload} />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 4, bgcolor: "rgba(250,248,242,0.95)", backdropFilter: "blur(18px)" }}>
            <CardContent sx={{ p: 2.2 }}>
              <Stack spacing={1.4}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Latest Contributions
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                    Recent public outputs from the community.
                  </Typography>
                </Box>
                {contributionFeed.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No public orthophoto contributions yet.
                  </Typography>
                ) : (
                  <ContributionFeed items={contributionFeed} />
                )}
              </Stack>
            </CardContent>
          </Card>

          {profile ? (
            <Card sx={{ borderRadius: 4, bgcolor: "rgba(15,93,94,0.9)", color: "common.white", backdropFilter: "blur(18px)" }}>
              <CardContent sx={{ p: 2.2 }}>
                <Stack spacing={1.5}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Your Impact
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={`You contributed ${profile.dataset_count} datasets`} sx={{ bgcolor: "#ffe6ab", color: "#17343a", fontWeight: 800 }} />
                    <Chip label={`${profile.completed_jobs.length} jobs completed`} sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "common.white", fontWeight: 700 }} />
                    <Chip label={`${uniqueAoiCount(profile)} AOI${uniqueAoiCount(profile) === 1 ? "" : "s"} supported`} sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "common.white", fontWeight: 700 }} />
                  </Stack>
                  <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
                  <Button variant="outlined" color="inherit" onClick={() => navigate("/profile")}>
                    View Profile
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
