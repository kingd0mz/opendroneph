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
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../hooks/usePathname";
import { useProfile } from "../hooks/useProfile";
import { ApiError } from "../services/api";
import { fetchOrganizations, updateMyOrganization } from "../services/users";
import type { OrganizationOption } from "../types/user";

interface ProfilePageProps {
  userId?: string | null;
}

function contributionTypeLabel(type: string) {
  return type === "raw" ? ".zip archive" : "Orthophoto";
}

function SectionList({
  title,
  emptyState,
  items,
  renderPrimary,
  renderSecondary,
  onItemClick,
}: {
  title: string;
  emptyState: string;
  items: Array<{ id: string }>;
  renderPrimary: (item: any) => string;
  renderSecondary: (item: any) => string;
  onItemClick: (item: any) => void;
}) {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyState}
        </Typography>
      ) : (
        <List disablePadding>
          {items.map((item, index) => (
            <Box key={item.id}>
              <ListItem disablePadding>
                <ListItemButton onClick={() => onItemClick(item)}>
                  <ListItemText primary={renderPrimary(item)} secondary={renderSecondary(item)} />
                </ListItemButton>
              </ListItem>
              {index < items.length - 1 ? <Divider /> : null}
            </Box>
          ))}
        </List>
      )}
    </Box>
  );
}

export function ProfilePage({ userId = null }: ProfilePageProps) {
  const isOwnProfile = !userId;
  const { profile, isLoading, error, reloadProfile } = useProfile(userId);
  const { fetchCurrentUser } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState("");
  const [customOrganization, setCustomOrganization] = useState("");
  const [isSavingOrganization, setIsSavingOrganization] = useState(false);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const hasExistingOption = organizations.some(
      (option) => option.organization_name === profile.organization_name,
    );
    if (!profile.organization_name) {
      setSelectedOrganization("");
      setCustomOrganization("");
      return;
    }

    if (hasExistingOption) {
      setSelectedOrganization(profile.organization_name);
      setCustomOrganization("");
      return;
    }

    setSelectedOrganization("__custom__");
    setCustomOrganization(profile.organization_name);
  }, [organizations, profile]);

  useEffect(() => {
    if (!isOwnProfile) {
      return;
    }

    let active = true;

    async function loadOrganizations() {
      try {
        const options = await fetchOrganizations();
        if (active) {
          setOrganizations(options);
        }
      } catch {
        if (active) {
          setOrganizations([]);
        }
      }
    }

    void loadOrganizations();

    return () => {
      active = false;
    };
  }, [isOwnProfile]);

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

  async function handleSaveOrganization() {
    const nextOrganizationName =
      selectedOrganization === "__custom__" ? customOrganization.trim() : selectedOrganization;

    try {
      setIsSavingOrganization(true);
      setOrganizationError(null);
      setOrganizationNotice(null);
      await updateMyOrganization(nextOrganizationName);
      await fetchCurrentUser();
      reloadProfile();
      setOrganizationNotice(nextOrganizationName ? "Organization updated." : "Organization cleared.");
    } catch (saveError) {
      setOrganizationError(saveError instanceof ApiError ? saveError.message : "Failed to update organization.");
    } finally {
      setIsSavingOrganization(false);
    }
  }

  const effectiveOrganizationName =
    selectedOrganization === "__custom__" ? customOrganization.trim() : selectedOrganization;
  const selectedOption =
    effectiveOrganizationName && selectedOrganization !== "__custom__"
      ? organizations.find((option) => option.organization_name === effectiveOrganizationName) ?? null
      : null;
  const isSaveDisabled =
    isSavingOrganization ||
    effectiveOrganizationName === profile.organization_name ||
    selectedOption?.is_full === true ||
    (selectedOrganization === "__custom__" && effectiveOrganizationName.length === 0);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, height: "100%", overflow: "auto" }}>
      <Box
        sx={{
          maxWidth: 1400,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Card
          sx={{
            borderRadius: 4,
            boxShadow: "0 24px 60px rgba(15, 44, 43, 0.12)",
            background: "linear-gradient(180deg, #fffaf0 0%, #f4efe2 100%)",
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {isOwnProfile ? "Contributor Profile" : "Public Contributor Profile"}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {profile.username}
                </Typography>
              </Box>

              <Chip
                label={`${profile.contribution_count} contribution point${profile.contribution_count === 1 ? "" : "s"}`}
                sx={{
                  alignSelf: "flex-start",
                  px: 1,
                  py: 2,
                  bgcolor: "primary.main",
                  color: "common.white",
                  fontWeight: 700,
                }}
              />

              <SectionList
                title="Contributions"
                emptyState="No public contributions yet."
                items={profile.contributions}
                renderPrimary={(contribution) => contribution.title}
                renderSecondary={(contribution) =>
                  `${contributionTypeLabel(contribution.type)} | ${new Date(contribution.created_at).toLocaleDateString()}`
                }
                onItemClick={(contribution) => navigate(`/datasets/${contribution.id}`)}
              />

              <SectionList
                title="Jobs Currently Working On"
                emptyState="No job downloads recorded yet."
                items={profile.current_jobs}
                renderPrimary={(job) => job.title}
                renderSecondary={(job) =>
                  `Last activity ${new Date(job.last_activity_at).toLocaleDateString()}`
                }
                onItemClick={(job) => navigate(`/datasets/${job.id}`)}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: 4,
            boxShadow: "0 24px 60px rgba(15, 44, 43, 0.12)",
            background: "#FFFFFF",
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="overline" color="text.secondary">
                  Organization
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                  {profile.organization_name || "No current affiliation"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Affiliations are optional. Organizations can have up to 50 members.
                </Typography>
              </Box>

              {isOwnProfile ? (
                <>
                  {organizationError ? <Alert severity="error">{organizationError}</Alert> : null}
                  {organizationNotice ? <Alert severity="success">{organizationNotice}</Alert> : null}

                  <TextField
                    select
                    label="Choose organization"
                    value={selectedOrganization}
                    onChange={(event) => {
                      setSelectedOrganization(event.target.value);
                      setOrganizationError(null);
                      setOrganizationNotice(null);
                    }}
                    fullWidth
                  >
                    <MenuItem value="">No affiliation</MenuItem>
                    {organizations.map((option) => (
                      <MenuItem
                        key={option.organization_name}
                        value={option.organization_name}
                        disabled={option.is_full && option.organization_name !== profile.organization_name}
                      >
                        {option.organization_name} ({option.member_count}/50)
                      </MenuItem>
                    ))}
                    <MenuItem value="__custom__">Use a new organization</MenuItem>
                  </TextField>

                  {selectedOrganization === "__custom__" ? (
                    <TextField
                      label="New organization name"
                      value={customOrganization}
                      onChange={(event) => {
                        setCustomOrganization(event.target.value);
                        setOrganizationError(null);
                        setOrganizationNotice(null);
                      }}
                      fullWidth
                      helperText="Create a new organization name or move into one that does not yet exist."
                    />
                  ) : null}

                  <Button
                    variant="contained"
                    onClick={() => void handleSaveOrganization()}
                    disabled={isSaveDisabled}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {isSavingOrganization ? "Saving..." : "Save Organization"}
                  </Button>
                </>
              ) : null}

              <SectionList
                title="AOIs Contributed To"
                emptyState="No AOI-linked public datasets yet."
                items={profile.aois_contributed_to}
                renderPrimary={(aoi) => aoi.title}
                renderSecondary={(aoi) => aoi.purpose}
                onItemClick={(aoi) => navigate(`/aois/${aoi.id}`)}
              />
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
