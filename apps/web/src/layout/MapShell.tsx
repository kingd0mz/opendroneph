import { AppBar, Avatar, Box, Button, IconButton, Menu, MenuItem, Stack, Toolbar } from "@mui/material";
import type { PropsWithChildren } from "react";
import { useState } from "react";

import { BRAND_COPY } from "../content/brandCopy";
import { useAuth } from "../context/AuthContext";
import { navigate, usePathname } from "../hooks/usePathname";
import { HeaderBrand } from "./HeaderBrand";

export function MapShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { isAuthenticated, loading, logout, openLoginModal, user } = useAuth();
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<HTMLElement | null>(null);

  const links = [
    { label: "Home", to: "/" },
    { label: "Jobs", to: "/jobs" },
    { label: "Contribute", to: "/upload" },
    { label: "Leaderboard", to: "/leaderboard" },
  ];

  function handleNavigate(to: string) {
    if ((to === "/profile" || to === "/upload") && !isAuthenticated) {
      openLoginModal(() => navigate(to));
      return;
    }

    navigate(to);
  }

  async function handleLogout() {
    setAvatarMenuAnchor(null);
    await logout();
    if (pathname === "/profile" || pathname === "/upload") {
      navigate("/");
    }
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: "linear-gradient(90deg, #0B1F3A 0%, #142C54 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <Toolbar
          sx={{
            minHeight: "72px !important",
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <HeaderBrand />
          <Stack direction="row" spacing={1} alignItems="center">
            {links.map((link) => (
              <Button
                key={link.to}
                onClick={() => handleNavigate(link.to)}
                color={link.to === "/upload" ? "warning" : "inherit"}
                variant={link.to === "/upload" ? "contained" : pathname === link.to ? "outlined" : "text"}
                sx={{
                  borderColor: "rgba(255,255,255,0.34)",
                  color: link.to === "/upload" ? "#0B1F3A" : "common.white",
                  fontWeight: 700,
                }}
              >
                {link.to === "/upload" ? BRAND_COPY.primaryCta : link.label}
              </Button>
            ))}
            {isAuthenticated && user ? (
              <>
                <IconButton
                  onClick={(event) => setAvatarMenuAnchor(event.currentTarget)}
                  color="inherit"
                  aria-label="Open profile menu"
                  aria-controls={avatarMenuAnchor ? "profile-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={avatarMenuAnchor ? "true" : undefined}
                  sx={{
                    border: pathname === "/profile" ? "1px solid rgba(255,255,255,0.34)" : "1px solid transparent",
                    color: "common.white",
                    p: 0.5,
                  }}
                >
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: "#F2C94C",
                      color: "#0B1F3A",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                    }}
                  >
                    {user.email.slice(0, 1).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  id="profile-menu"
                  anchorEl={avatarMenuAnchor}
                  open={!!avatarMenuAnchor}
                  onClose={() => setAvatarMenuAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  <MenuItem
                    onClick={() => {
                      setAvatarMenuAnchor(null);
                      handleNavigate("/profile");
                    }}
                  >
                    Profile
                  </MenuItem>
                  <MenuItem onClick={() => void handleLogout()}>Logout</MenuItem>
                </Menu>
              </>
            ) : null}
            {loading ? null : isAuthenticated ? null : (
              <Button
                onClick={() => openLoginModal()}
                color="inherit"
                variant="outlined"
                sx={{
                  borderColor: "rgba(255,255,255,0.34)",
                  color: "common.white",
                  fontWeight: 700,
                }}
              >
                Sign In
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
