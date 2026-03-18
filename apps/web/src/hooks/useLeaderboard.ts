import { useEffect, useState } from "react";

import { ApiError } from "../services/api";
import { fetchLeaderboard } from "../services/users";
import type { LeaderboardEntry } from "../types/user";

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLeaderboard() {
      try {
        setIsLoading(true);
        const result = await fetchLeaderboard();
        if (!isMounted) {
          return;
        }
        setEntries(result);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : "Failed to load leaderboard.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, []);

  return { entries, isLoading, error };
}
