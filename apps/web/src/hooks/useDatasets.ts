import { useEffect, useState } from "react";

import { ApiError } from "../services/api";
import { fetchPublishedDatasets } from "../services/datasets";
import type { Dataset } from "../types/dataset";

interface UseDatasetsResult {
  datasets: Dataset[];
  isLoading: boolean;
  error: string | null;
}

export function useDatasets(): UseDatasetsResult {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDatasets() {
      try {
        setIsLoading(true);
        const results = await fetchPublishedDatasets();
        if (!isMounted) {
          return;
        }
        setDatasets(results);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        const message =
          loadError instanceof ApiError
            ? loadError.message
            : "Failed to load datasets.";
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDatasets();

    return () => {
      isMounted = false;
    };
  }, []);

  return { datasets, isLoading, error };
}
