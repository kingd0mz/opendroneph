import { AppBar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";

import { useAuth } from "../context/AuthContext";
import { navigate, usePathname } from "../hooks/usePathname";

export function MapShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { isAuthenticated, loading, logout, openLoginModal, user } = useAuth();

  const links = [
    { label: "Map", to: "/" },
    { label: "Leaderboard", to: "/leaderboard" },
    { label: "Profile", to: "/profile" },
  ];

  function handleNavigate(to: string) {
    if (to === "/profile" && !isAuthenticated) {
      openLoginModal(() => navigate(to));
      return;
    }

    navigate(to);
  }

  async function handleLogout() {
    await logout();
    if (pathname === "/profile") {
      navigate("/");
    }
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background:
            "linear-gradient(90deg, rgba(15,93,94,0.98) 0%, rgba(31,127,105,0.95) 100%)",
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
          <Typography variant="h6" component="h1">
            OpenDronePH
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {isAuthenticated && user ? (
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.82)", mr: 1 }}>
                {user.email}
              </Typography>
            ) : null}
            {links.map((link) => (
              <Button
                key={link.to}
                onClick={() => handleNavigate(link.to)}
                color="inherit"
                variant={pathname === link.to ? "outlined" : "text"}
                sx={{
                  borderColor: "rgba(255,255,255,0.34)",
                  color: "common.white",
                  fontWeight: 700,
                }}
              >
                {link.label}
              </Button>
            ))}
            {loading ? null : isAuthenticated ? (
              <Button
                onClick={() => void handleLogout()}
                color="inherit"
                variant="text"
                sx={{ color: "common.white", fontWeight: 700 }}
              >
                Logout
              </Button>
            ) : (
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
                Login
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
