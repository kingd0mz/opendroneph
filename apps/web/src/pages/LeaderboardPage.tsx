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

interface LeaderboardRow {
  contribution_count: number;
  raw_uploads_count: number;
  ortho_uploads_count: number;
  jobs_completed_count: number;
}

function LeaderboardTable({
  title,
  rows,
  renderName,
}: {
  title: string;
  rows: LeaderboardRow[];
  renderName: (row: any) => string;
}) {
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(15, 44, 43, 0.12)",
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, px: 3, pt: 3 }}>
        {title}
      </Typography>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: "primary.main" }}>
            <TableCell sx={{ color: "common.white", fontWeight: 700 }}>Rank</TableCell>
            <TableCell sx={{ color: "common.white", fontWeight: 700 }}>Name</TableCell>
            <TableCell sx={{ color: "common.white", fontWeight: 700 }} align="right">RAW</TableCell>
            <TableCell sx={{ color: "common.white", fontWeight: 700 }} align="right">Orthos</TableCell>
            <TableCell sx={{ color: "common.white", fontWeight: 700 }} align="right">Jobs</TableCell>
            <TableCell sx={{ color: "common.white", fontWeight: 700 }} align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${renderName(row)}-${index}`} hover>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{renderName(row)}</TableCell>
              <TableCell align="right">{row.raw_uploads_count}</TableCell>
              <TableCell align="right">{row.ortho_uploads_count}</TableCell>
              <TableCell align="right">{row.jobs_completed_count}</TableCell>
              <TableCell align="right">{row.contribution_count}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography variant="body2" color="text.secondary">
                  No contributors are available yet.
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function LeaderboardPage() {
  const { userEntries, organizationEntries, isLoading, error } = useLeaderboard();

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
      <Box sx={{ maxWidth: 1200, mx: "auto", display: "grid", gap: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Contribution Leaderboard
        </Typography>
        <LeaderboardTable
          title="Users"
          rows={userEntries}
          renderName={(entry) => entry.organization_name ? `${entry.username} (${entry.organization_name})` : entry.username}
        />
        <LeaderboardTable
          title="Organizations"
          rows={organizationEntries}
          renderName={(entry) => entry.organization_name}
        />
      </Box>
    </Box>
  );
}
