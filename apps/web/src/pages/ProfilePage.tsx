import { Box, Card, CardContent, Chip, Divider, List, ListItem, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { navigate } from "../hooks/usePathname";
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
              Contributions are the user’s published, valid datasets that are visible to everyone.
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
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
