import { Stack } from "@mui/material";

import { JobCard } from "./JobCard";
import type { Job } from "../../types/dataset";

interface JobListProps {
  jobs: Job[];
  downloadingJobId: string | null;
  onDownload: (datasetId: string) => Promise<void>;
}

export function JobList({ jobs, downloadingJobId, onDownload }: JobListProps) {
  return (
    <Stack spacing={1.4}>
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          downloadingJobId={downloadingJobId}
          onDownload={onDownload}
        />
      ))}
    </Stack>
  );
}
