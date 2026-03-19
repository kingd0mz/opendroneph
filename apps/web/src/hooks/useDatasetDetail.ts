import { useEffect, useState } from "react";

import { ApiError } from "../services/api";
import { fetchDatasetDetail } from "../services/datasets";
import type { DatasetDetail } from "../types/dataset";

interface UseDatasetDetailResult {
  dataset: DatasetDetail | null;
  isLoading: boolean;
  error: string | null;
  statusCode: number | null;
}

export function useDatasetDetail(datasetId: string | null): UseDatasetDetailResult {
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDataset() {
      if (!datasetId) {
        setDataset(null);
        setError("Dataset not found.");
        setStatusCode(404);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const result = await fetchDatasetDetail(datasetId);
        if (!isMounted) {
          return;
        }
        setDataset(result);
        setError(null);
        setStatusCode(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        const message =
          loadError instanceof ApiError ? loadError.message : "Failed to load dataset details.";
        setDataset(null);
        setError(message);
        setStatusCode(loadError instanceof ApiError ? loadError.statusCode : null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDataset();

    return () => {
      isMounted = false;
    };
  }, [datasetId]);

  return { dataset, isLoading, error, statusCode };
}
