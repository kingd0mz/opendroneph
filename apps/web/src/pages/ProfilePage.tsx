import { Box, Card, CardContent, Chip, Divider, List, ListItem, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { navigate } from "../hooks/usePathname";
import { useProfile } from "../hooks/useProfile";

interface ProfilePageProps {
  userId?: string | null;
}

export function ProfilePage({ userId = null }: ProfilePageProps) {
  const { profile, isLoading, error } = useProfile(userId);

  if (isLoading) {
    return <FullscreenLoadingState />;
  }

  if (error || !profile) {
    return (
      <FullscreenState
        title="Profile Unavailable"
        description={error ?? "Unable to load the current user profile."}
        severity="error"
      />
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        placeItems: "center",
        height: "100%",
        p: 3,
      }}
    >
      <Card
        sx={{
          width: "min(560px, 100%)",
          borderRadius: 4,
          boxShadow: "0 24px 60px rgba(15, 44, 43, 0.16)",
          background: "linear-gradient(180deg, #fffaf0 0%, #f4efe2 100%)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2.5}>
            <Typography variant="overline" color="text.secondary">
              {userId ? "Public Contributor Profile" : "Contributor Profile"}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {profile.username}
            </Typography>
            <Chip
              label={`${profile.contribution_count} contributions`}
              sx={{
                alignSelf: "flex-start",
                px: 1,
                py: 2,
                bgcolor: "primary.main",
                color: "common.white",
                fontWeight: 700,
              }}
            />
            <Typography variant="body1" color="text.secondary">
              Contributions are the user&apos;s published, valid datasets that are visible to everyone.
            </Typography>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Contributions
              </Typography>
              {profile.contributions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No public contributions yet.
                </Typography>
              ) : (
                <List disablePadding>
                  {profile.contributions.map((contribution, index) => (
                    <Box key={contribution.id}>
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => navigate(`/datasets/${contribution.id}`)}>
                          <ListItemText
                            primary={contribution.title}
                            secondary={`${contribution.type} | ${new Date(contribution.created_at).toLocaleDateString()}`}
                          />
                        </ListItemButton>
                      </ListItem>
                      {index < profile.contributions.length - 1 ? <Divider /> : null}
                    </Box>
                  ))}
                </List>
              )}
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Uploaded Datasets
              </Typography>
              {profile.uploaded_datasets.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No public uploaded datasets yet.
                </Typography>
              ) : (
                <List disablePadding>
                  {profile.uploaded_datasets.map((dataset, index) => (
                    <Box key={dataset.id}>
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => navigate(`/datasets/${dataset.id}`)}>
                          <ListItemText
                            primary={dataset.title}
                            secondary={`${dataset.type} | ${new Date(dataset.created_at).toLocaleDateString()}`}
                          />
                        </ListItemButton>
                      </ListItem>
                      {index < profile.uploaded_datasets.length - 1 ? <Divider /> : null}
                    </Box>
                  ))}
                </List>
              )}
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Completed Jobs
              </Typography>
              {profile.completed_jobs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No completed jobs recorded yet.
                </Typography>
              ) : (
                <List disablePadding>
                  {profile.completed_jobs.map((job, index) => (
                    <Box key={job.id}>
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => navigate(`/datasets/${job.id}`)}>
                          <ListItemText
                            primary={job.title}
                            secondary={`completed | ${new Date(job.created_at).toLocaleDateString()}`}
                          />
                        </ListItemButton>
                      </ListItem>
                      {index < profile.completed_jobs.length - 1 ? <Divider /> : null}
                    </Box>
                  ))}
                </List>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
