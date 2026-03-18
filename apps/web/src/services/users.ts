import { api } from "./api";
import type { LeaderboardEntry, UserProfile } from "../types/user";

export async function fetchMyProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>("/users/me/");
  return response.data;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await api.get<LeaderboardEntry[]>("/leaderboard/");
  return response.data;
}
