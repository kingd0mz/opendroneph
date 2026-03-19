import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

import type { Job } from "../../types/dataset";

function activityLabel(job: Job) {
  if (job.activeUserCount === 0) {
    return "No active workers yet";
  }

  const [firstName] = job.activeUsernames;
  if (job.activeUserCount === 1) {
    return `${firstName} is working`;
  }

  return `${firstName} and ${job.activeUserCount - 1} others are working`;
}

interface JobCardProps {
  job: Job;
  downloadingJobId: string | null;
  onDownload: (datasetId: string) => Promise<void>;
}

export function JobCard({ job, downloadingJobId, onDownload }: JobCardProps) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(15,93,94,0.08)",
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.2}>
          <Stack direction="row" justifyContent="space-between" gap={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {job.title}
            </Typography>
            <Chip label=".zip" size="small" color="primary" />
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Uploader: {job.uploader.username}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {activityLabel(job)}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => void onDownload(job.id)}
            disabled={downloadingJobId === job.id}
          >
            {downloadingJobId === job.id ? "Preparing..." : "Download"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
