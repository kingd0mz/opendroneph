import type { AOISummary } from "./dataset";

export interface UserContribution {
  id: string;
  title: string;
  type: string;
  status: string;
  validation_status: string;
  created_at: string;
}

export interface CompletedJob {
  id: string;
  title: string;
  status: string;
  validation_status: string;
  created_at: string;
}

export interface UserStats {
  raw_uploads_count: number;
  ortho_uploads_count: number;
  jobs_completed_count: number;
}

export interface AuthUser {
  id: string;
  email: string;
  is_email_verified: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  organization_name: string;
}

export interface UserProfile {
  id: string;
  username: string;
  organization_name: string;
  contribution_count: number;
  dataset_count: number;
  stats: UserStats;
  contributions: UserContribution[];
  uploaded_datasets: UserContribution[];
  completed_jobs: CompletedJob[];
  aois_contributed_to: AOISummary[];
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  organization_name: string;
  raw_uploads_count: number;
  ortho_uploads_count: number;
  jobs_completed_count: number;
  contribution_count: number;
}

export interface OrganizationLeaderboardEntry {
  organization_name: string;
  raw_uploads_count: number;
  ortho_uploads_count: number;
  jobs_completed_count: number;
  contribution_count: number;
}

export interface LeaderboardResponse {
  users: LeaderboardEntry[];
  organizations: OrganizationLeaderboardEntry[];
}
