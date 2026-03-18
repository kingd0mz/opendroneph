export interface UserProfile {
  id: string;
  username: string;
  contribution_count: number;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  contribution_count: number;
}
