import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { ContributionFeed, type ContributionFeedItem } from "../components/home/ContributionFeed";
import { EventCard, type EventCardData } from "../components/home/EventCard";
import { HomeLayout } from "../components/home/HomeLayout";
import { JobList } from "../components/home/JobList";
import { BRAND_COPY, SECTION_COPY } from "../content/brandCopy";
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
        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 }, bgcolor: "background.default" }}>
          <Stack spacing={2.2}>
            <Card
              sx={{
                borderRadius: 4,
                overflow: "hidden",
                position: "relative",
                background: "linear-gradient(135deg, #0B1F3A 0%, #142C54 62%, #1D4ED8 100%)",
                color: "common.white",
                boxShadow: "0 22px 58px rgba(11, 31, 58, 0.22)",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  right: -48,
                  top: -44,
                  background: "radial-gradient(circle, rgba(242,201,76,0.28) 0%, rgba(242,201,76,0.04) 68%, transparent 72%)",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  right: 48,
                  bottom: -58,
                  background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 70%, transparent 76%)",
                }}
              />
              <CardContent sx={{ p: 2.6 }}>
                <Stack spacing={1.35} sx={{ position: "relative", zIndex: 1 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.03, fontSize: { xs: "2rem", md: "2.5rem" } }}>
                    {BRAND_COPY.platformTitle}
                  </Typography>
                  <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.88)", fontWeight: 500 }}>
                    {BRAND_COPY.platformSubtitle}
                  </Typography>
                  <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.8)" }}>
                    {BRAND_COPY.heroDescription}
                  </Typography>
                  <Stack spacing={0.6}>
                    {BRAND_COPY.valueStatements.map((statement) => (
                      <Typography key={statement} variant="body2" sx={{ color: "rgba(255,255,255,0.78)" }}>
                        {statement}
                      </Typography>
                    ))}
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <Button variant="contained" color="warning" onClick={() => navigate("/upload")}>
                      {BRAND_COPY.primaryCta}
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => navigate("/jobs")}
                      sx={{ borderColor: "rgba(255,255,255,0.28)" }}
                    >
                      {BRAND_COPY.secondaryCta}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {message ? <Alert severity="info">{message}</Alert> : null}

            <Card sx={{ borderRadius: 4, bgcolor: "background.paper" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      {SECTION_COPY.activeMissionsTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      {SECTION_COPY.activeMissionsDescription}
                    </Typography>
                  </Box>
                  {activeEvents.length === 0 ? (
                    <Alert severity="info">{SECTION_COPY.activeMissionsEmpty}</Alert>
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
            <Card sx={{ borderRadius: 4, bgcolor: "background.paper" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.3}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {SECTION_COPY.jobsTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      {SECTION_COPY.jobsDescription}
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

            <Card sx={{ borderRadius: 4, bgcolor: "background.paper" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.3}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {SECTION_COPY.contributionsTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      {SECTION_COPY.contributionsDescription}
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

            <Card sx={{ borderRadius: 4, bgcolor: "background.paper" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.3}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {SECTION_COPY.openAccessTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      {SECTION_COPY.openAccessDescription}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {BRAND_COPY.accessMessage}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {BRAND_COPY.attributionMessage}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {BRAND_COPY.recognitionMessage}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 4, bgcolor: "background.paper" }}>
              <CardContent sx={{ p: 2.1 }}>
                <Stack spacing={1.3}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {BRAND_COPY.partnersTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.4 }}>
                      OpenDronePH brings together public institutions, technical communities, and local contributors.
                    </Typography>
                  </Box>
                  <Stack spacing={0.7}>
                    {BRAND_COPY.partners.map((partner) => (
                      <Typography key={partner} variant="body2" sx={{ color: "text.secondary" }}>
                        {partner}
                      </Typography>
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {profile ? (
              <Card sx={{ borderRadius: 4, bgcolor: "primary.main", color: "common.white" }}>
                <CardContent sx={{ p: 2.1 }}>
                  <Stack spacing={1.4}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {SECTION_COPY.impactTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.84)" }}>
                      {SECTION_COPY.impactDescription}
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
