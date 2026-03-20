import { Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

import type { Job } from "../../types/dataset";

function activityLabel(job: Job) {
  if (job.outputsCount === 0) {
    return "No orthophoto outputs yet";
  }
  return `${job.outputsCount} output${job.outputsCount === 1 ? "" : "s"} from ${job.participantsCount} contributor${job.participantsCount === 1 ? "" : "s"}`;
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
        borderRadius: 1.5,
        bgcolor: "#FFFFFF",
        border: "1px solid rgba(11,31,58,0.08)",
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.2}>
          <Stack direction="row" justifyContent="space-between" gap={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, color: "primary.main" }}>
              {job.title}
            </Typography>
            <Chip
              label=".zip"
              size="small"
              sx={{ bgcolor: "rgba(11,31,58,0.08)", color: "primary.main" }}
            />
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
