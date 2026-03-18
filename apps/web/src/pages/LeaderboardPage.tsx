import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { useLeaderboard } from "../hooks/useLeaderboard";

export function LeaderboardPage() {
  const { entries, isLoading, error } = useLeaderboard();

  if (isLoading) {
    return <FullscreenLoadingState />;
  }

  if (error) {
    return (
      <FullscreenState
        title="Leaderboard Unavailable"
        description={error}
        severity="error"
      />
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, height: "100%", overflow: "auto" }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        Contribution Leaderboard
      </Typography>
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15, 44, 43, 0.12)",
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "primary.main" }}>
              <TableCell sx={{ color: "common.white", fontWeight: 700 }}>Rank</TableCell>
              <TableCell sx={{ color: "common.white", fontWeight: 700 }}>Username</TableCell>
              <TableCell sx={{ color: "common.white", fontWeight: 700 }} align="right">
                Contributions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={entry.user_id} hover>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{entry.username}</TableCell>
                <TableCell align="right">{entry.contribution_count}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2" color="text.secondary">
                    No contributors are available yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
