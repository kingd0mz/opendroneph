import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { useProfile } from "../hooks/useProfile";

export function ProfilePage() {
  const { profile, isLoading, error } = useProfile();

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
              Contributor Profile
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
              Contribution counts are derived by the backend from valid raw uploads and published orthophotos.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
