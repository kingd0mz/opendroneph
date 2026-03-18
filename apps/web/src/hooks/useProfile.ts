import { useEffect, useState } from "react";

import { ApiError } from "../services/api";
import { fetchMyProfile } from "../services/users";
import type { UserProfile } from "../types/user";

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        const result = await fetchMyProfile();
        if (!isMounted) {
          return;
        }
        setProfile(result);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : "Failed to load profile.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  return { profile, isLoading, error };
}
