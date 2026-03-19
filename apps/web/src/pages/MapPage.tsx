import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { AOIList } from "../components/home/AOIList";
import { ContributionFeed, type ContributionFeedItem } from "../components/home/ContributionFeed";
import { EventCard, type EventCardData } from "../components/home/EventCard";
import { HomeLayout } from "../components/home/HomeLayout";
import { JobList } from "../components/home/JobList";
import { useAuth } from "../context/AuthContext";
import { toDatasetFeatureCollection } from "../features/datasets/datasetGeoJson";
import { DatasetMap } from "../features/map/DatasetMap";
import type { AOIFeatureProperties } from "../features/map/DatasetMap";
import { navigate } from "../hooks/usePathname";
import { ApiError } from "../services/api";
import {
  downloadDataset,
  fetchAoiDatasets,
  fetchAois,
  fetchDatasetDetail,
  fetchJobs,
  fetchPublishedDatasets,
} from "../services/datasets";
import { fetchMyProfile } from "../services/users";
import type { AOI, Dataset, Job } from "../types/dataset";
import type { UserProfile } from "../types/user";

function toAoiFeatureCollection(
  aois: AOI[],
  eventIds: Set<string>,
): GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, AOIFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: aois.map((aoi) => ({
      type: "Feature",
      geometry: aoi.geometry,
      properties: {
        id: aoi.id,
        title: aoi.title,
        purpose: aoi.purpose,
        isEvent: eventIds.has(aoi.id),
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

function eventPriority(aoi: AOI) {
  if (aoi.purpose === "disaster") {
    return 0;
  }
  if (aoi.orthophotoCount === 0) {
    return 1;
  }
  return 2;
}

function eventStatus(aoi: AOI): EventCardData["status"] {
  if (aoi.rawCount === 0 && aoi.orthophotoCount === 0) {
    return "Needs Data";
  }
  if (aoi.orthophotoCount > 0) {
    return "Recently Updated";
  }
  return "Ongoing";
}

export function MapPage() {
  const { isAuthenticated, requireAuth } = useAuth();
  const [aois, setAois] = useState<AOI[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contributionFeed, setContributionFeed] = useState<ContributionFeedItem[]>([]);
  const [activeEvents, setActiveEvents] = useState<EventCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);
  const [hoveredAoiId, setHoveredAoiId] = useState<string | null>(null);
  const [focusedAoiId, setFocusedAoiId] = useState<string | null>(null);

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

        const activeAois = aoisResult
          .filter((aoi) => aoi.isActive)
          .sort((left, right) => eventPriority(left) - eventPriority(right))
          .slice(0, 3);

        const [feedDetails, eventDetails] = await Promise.all([
          Promise.all(
            latestContributionIds(datasetsResult).map(async (id) => {
              const detail = await fetchDatasetDetail(id);
              return {
                id: detail.id,
                title: detail.title,
                contributor: detail.uploader.username,
                createdAt: detail.createdAt,
                dataType: detail.dataType,
              } satisfies ContributionFeedItem;
            }),
          ),
          Promise.all(
            activeAois.map(async (aoi) => {
              const detail = await fetchAoiDatasets(aoi.id);
              const contributors = new Set(
                [...detail.rawDatasets, ...detail.orthophotos].map((dataset) => dataset.uploader.id),
              );
              return {
                aoi,
                status: eventStatus(aoi),
                orthophotoCount: detail.orthophotos.length,
                contributorCount: contributors.size,
              } satisfies EventCardData;
            }),
          ),
        ]);

        if (!isMounted) {
          return;
        }

        setAois(aoisResult.filter((aoi) => aoi.isActive));
        setJobs(jobsResult.slice(0, 4));
        setDatasets(datasetsResult.filter((dataset) => dataset.dataType === "orthophoto"));
        setProfile(profileResult);
        setContributionFeed(feedDetails);
        setActiveEvents(eventDetails);
        setFocusedAoiId(eventDetails[0]?.aoi.id ?? activeAois[0]?.id ?? null);
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

  const eventIds = useMemo(() => new Set(activeEvents.map((event) => event.aoi.id)), [activeEvents]);
  const mappingPriorities = useMemo(() => {
    const remaining = aois.filter((aoi) => !eventIds.has(aoi.id));
    return remaining.length > 0 ? remaining : aois;
  }, [aois, eventIds]);
  const datasetCollection = useMemo(() => toDatasetFeatureCollection(datasets), [datasets]);
  const aoiCollection = useMemo(() => toAoiFeatureCollection(aois, eventIds), [aois, eventIds]);

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
    <HomeLayout
      sidebar={(
        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 }, bgcolor: "#f4efe5" }}>
          <Stack spacing={2.2}>
            <Card
              sx={{
                borderRadius: 4,
                overflow: "hidden",
                background: "linear-gradient(140deg, #103238 0%, #1f7f69 58%, #f0b44d 100%)",
                color: "common.white",
                boxShadow: "0 22px 58px rgba(16, 50, 56, 0.24)",
              }}
            >
              <CardContent sx={{ p: 2.6 }}>
                <Stack spacing={1.25}>
                  <Typography variant="overline" sx={{ letterSpacing: 1.2, opacity: 0.92 }}>
                    Help Map the Philippines
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.03, fontSize: { xs: "2rem", md: "2.5rem" } }}>
                    The country needs data now.
                  </Typography>
                  <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.84)" }}>
                    Join the community in providing drone data for disaster response and national mapping.
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <Button variant="contained" color="warning" onClick={() => navigate("/upload")}>
                      Upload Dataset
                    </Button>
                    <Button variant="outlined" color="inherit" onClick={() => navigate("/jobs")}>
                      Browse Jobs
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {message ? <Alert severity="info">{message}</Alert> : null}

            <Card sx={{ borderRadius: 4, bgcolor: "#fcfaf5" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      Active Missions
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      What is happening right now and where help is urgently needed.
                    </Typography>
                  </Box>
                  {activeEvents.length === 0 ? (
                    <Alert severity="info">No active missions right now. Explore mapping priorities below.</Alert>
                  ) : (
                    <Stack spacing={1.4}>
                      {activeEvents.map((event) => (
                        <EventCard
                          key={event.aoi.id}
                          event={event}
                          isFocused={focusedAoiId === event.aoi.id}
                          onFocus={setFocusedAoiId}
                          onHover={setHoveredAoiId}
                        />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 4, bgcolor: "#fcfaf5" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.4}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Mapping Priorities
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      Ongoing areas that still benefit from more imagery and outputs.
                    </Typography>
                  </Box>
                  {mappingPriorities.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      No mapping priorities available yet.
                    </Typography>
                  ) : (
                    <AOIList
                      aois={mappingPriorities}
                      focusedAoiId={focusedAoiId}
                      onFocus={setFocusedAoiId}
                      onHover={setHoveredAoiId}
                    />
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 4, bgcolor: "#fcfaf5" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.3}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Available Drone Data
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      Open RAW archives that anyone can process into orthophotos.
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

            <Card sx={{ borderRadius: 4, bgcolor: "#fcfaf5" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.3}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Recent Contributions
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      New public outputs from contributors across the country.
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
              <Card sx={{ borderRadius: 4, bgcolor: "#0f5d5e", color: "common.white" }}>
                <CardContent sx={{ p: 2.1 }}>
                  <Stack spacing={1.4}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Your Contributions
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip label={`${profile.dataset_count} datasets uploaded`} sx={{ bgcolor: "#ffe6ab", color: "#17343a", fontWeight: 800 }} />
                      <Chip label={`${profile.completed_jobs.length} jobs completed`} sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "common.white", fontWeight: 700 }} />
                      <Chip label={`${uniqueAoiCount(profile)} AOIs supported`} sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "common.white", fontWeight: 700 }} />
                    </Stack>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.14)" }} />
                    <Button variant="outlined" color="inherit" onClick={() => navigate("/profile")}>
                      View Profile
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ) : null}
          </Stack>
        </Box>
      )}
      map={(
        <Box sx={{ position: "absolute", inset: 0 }}>
          <DatasetMap
            datasetCollection={datasetCollection}
            aoiCollection={aoiCollection}
            hoveredAoiId={hoveredAoiId}
            focusedAoiId={focusedAoiId}
            onAoiSelect={setFocusedAoiId}
          />
        </Box>
      )}
    />
  );
}
