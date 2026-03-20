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
import type { ReactNode } from "react";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { useLeaderboard } from "../hooks/useLeaderboard";

interface LeaderboardRow {
  contribution_count: number;
  raw_uploads_count: number;
  ortho_uploads_count: number;
  jobs_completed_count: number;
}

function podiumRankStyles(rank: number) {
  if (rank === 1) {
    return {
      bgcolor: "#D6AE2A",
      color: "#0B1F3A",
      border: "1px solid rgba(11,31,58,0.1)",
    };
  }
  if (rank === 2) {
    return {
      bgcolor: "#C0C7D1",
      color: "#0B1F3A",
      border: "1px solid rgba(11,31,58,0.1)",
    };
  }
  if (rank === 3) {
    return {
      bgcolor: "#B87333",
      color: "#FFFFFF",
      border: "1px solid rgba(11,31,58,0.08)",
    };
  }
  return {
    bgcolor: "rgba(11,31,58,0.06)",
    color: "text.primary",
    border: "1px solid rgba(11,31,58,0.06)",
  };
}

function LeaderboardTable({
  title,
  rows,
  renderIdentity,
}: {
  title: string;
  rows: LeaderboardRow[];
  renderIdentity: (row: any, index: number) => ReactNode;
}) {
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 4,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(15, 44, 43, 0.12)",
        height: "100%",
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, px: 3, pt: 3, pb: 1 }}>
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
            <TableRow key={`${title}-${index}`} hover>
              <TableCell sx={{ width: 92 }}>
                <Box
                  sx={{
                    ...podiumRankStyles(index + 1),
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    fontSize: index < 3 ? "1.35rem" : "1rem",
                    lineHeight: 1,
                  }}
                >
                  {index + 1}
                </Box>
              </TableCell>
              <TableCell>{renderIdentity(row, index)}</TableCell>
              <TableCell align="right">{row.raw_uploads_count}</TableCell>
              <TableCell align="right">{row.ortho_uploads_count}</TableCell>
              <TableCell align="right">{row.jobs_completed_count}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                {row.contribution_count}
              </TableCell>
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
      <Box sx={{ maxWidth: 1400, mx: "auto", display: "grid", gap: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Contribution Leaderboard
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          <LeaderboardTable
            title="Organizations"
            rows={organizationEntries}
            renderIdentity={(entry, index) => (
              <Typography
                variant="body1"
                sx={{
                  fontWeight: index < 3 ? 800 : 700,
                  fontSize: index < 3 ? "1.02rem" : "0.95rem",
                  color: "text.primary",
                }}
              >
                {entry.organization_name}
              </Typography>
            )}
          />
          <LeaderboardTable
            title="Users"
            rows={userEntries}
            renderIdentity={(entry, index) => (
              <Box>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: index < 3 ? 800 : 700,
                    fontSize: index < 3 ? "1.02rem" : "0.95rem",
                    color: "text.primary",
                    lineHeight: 1.2,
                  }}
                >
                  {entry.username}
                </Typography>
                {entry.organization_name ? (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.35,
                      fontSize: "0.8rem",
                      fontWeight: 400,
                      color: "text.secondary",
                      lineHeight: 1.2,
                    }}
                  >
                    {entry.organization_name}
                  </Typography>
                ) : null}
              </Box>
            )}
          />
        </Box>
      </Box>
    </Box>
  );
}
