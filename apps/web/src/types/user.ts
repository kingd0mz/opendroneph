export interface UserContribution {
  id: string;
  title: string;
  type: string;
  status: string;
  validation_status: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  is_email_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  contribution_count: number;
  contributions: UserContribution[];
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  contribution_count: number;
}
