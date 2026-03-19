import { useMemo } from "react";
import { Box } from "@mui/material";

import { FullscreenLoadingState, FullscreenState } from "../components/FullscreenState";
import { DatasetMap } from "../features/map/DatasetMap";
import { useDatasets } from "../hooks/useDatasets";
import { toDatasetFeatureCollection } from "../features/datasets/datasetGeoJson";

export function MapPage() {
  const { datasets, isLoading, error } = useDatasets();
  const orthophotoDatasets = useMemo(
    () => datasets.filter((dataset) => dataset.dataType === "orthophoto"),
    [datasets],
  );
  const datasetCollection = useMemo(
    () => toDatasetFeatureCollection(orthophotoDatasets),
    [orthophotoDatasets],
  );

  if (isLoading) {
    return <FullscreenLoadingState />;
  }

  if (error) {
    return (
      <FullscreenState
        title="Dataset Load Failed"
        description={error}
        severity="error"
      />
    );
  }

  if (orthophotoDatasets.length === 0) {
    return (
      <FullscreenState
        title="No Published Orthophotos"
        description="Published, valid orthophoto footprints will appear here once the backend returns public records."
        severity="warning"
      />
    );
  }

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <DatasetMap datasetCollection={datasetCollection} />
    </Box>
  );
}
