import { api } from "./api";
import type { AuthUser, LeaderboardEntry, UserProfile } from "../types/user";

export async function ensureCsrfCookie(): Promise<void> {
  await api.get("/auth/csrf/");
}

export async function login(email: string, password: string): Promise<AuthUser> {
  await ensureCsrfCookie();
  const response = await api.post<AuthUser>("/auth/login/", { email, password });
  return response.data;
}

export async function logout(): Promise<void> {
  await ensureCsrfCookie();
  await api.post("/auth/logout/");
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get<AuthUser>("/auth/me/");
  return response.data;
}

export async function fetchMyProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>("/users/me/");
  return response.data;
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const response = await api.get<UserProfile>(`/users/${userId}/`);
  return response.data;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await api.get<LeaderboardEntry[]>("/leaderboard/");
  return response.data;
}
