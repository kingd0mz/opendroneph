export type DatasetType = "raw" | "orthophoto";
export type ValidationStatus = "pending" | "valid" | "invalid";
export type AOIPurpose = "disaster" | "landcover" | "benthic";

export interface AOISummary {
  id: string;
  title: string;
  description: string;
  purpose: AOIPurpose;
  isActive: boolean;
  createdAt: string;
}

export interface AOI extends AOISummary {
  geometry: GeoJSON.MultiPolygon;
  rawCount: number;
  orthophotoCount: number;
}

export interface DatasetUploader {
  id: string;
  username: string;
  email: string;
}

export interface DatasetAssetSummary {
  id: string;
  assetType: string;
  sizeBytes: number;
  isDownloadable: boolean;
  createdAt: string;
}

export interface DatasetReference {
  id: string;
  title: string;
  dataType: DatasetType;
  createdAt: string;
}

export interface DatasetApiItem {
  id: string;
  title: string;
  footprint: GeoJSON.MultiPolygon;
  aoi?: {
    id: string;
    title: string;
    description: string;
    purpose: AOIPurpose;
    is_active: boolean;
    created_at: string;
  } | null;
  data_type?: DatasetType;
  type?: DatasetType;
  created_at: string;
}

export interface DatasetDetailApiItem {
  id: string;
  title: string;
  description: string;
  uploader: {
    id: string;
    username: string;
    email: string;
  };
  aoi: {
    id: string;
    title: string;
    description: string;
    purpose: AOIPurpose;
    is_active: boolean;
    created_at: string;
  } | null;
  source_dataset: {
    id: string;
    title: string;
    data_type: DatasetType;
    created_at: string;
  } | null;
  data_type: DatasetType;
  status: string;
  validation_status: ValidationStatus;
  created_at: string;
  footprint: GeoJSON.MultiPolygon;
  assets: Array<{
    id: string;
    asset_type: string;
    size_bytes: number;
    is_downloadable: boolean;
    created_at: string;
  }>;
}

export interface DatasetDownloadApiResponse {
  dataset: string;
  asset: {
    id: string;
    asset_type: string;
    size_bytes: number;
    is_downloadable: boolean;
    created_at: string;
  };
  download_url?: string;
  download_event_id: string;
}

export interface Dataset {
  id: string;
  title: string;
  footprint: GeoJSON.MultiPolygon;
  aoi: AOISummary | null;
  dataType: DatasetType;
  createdAt: string;
}

export interface DatasetDetail {
  id: string;
  title: string;
  description: string;
  uploader: DatasetUploader;
  aoi: AOISummary | null;
  sourceDataset: DatasetReference | null;
  dataType: DatasetType;
  status: string;
  validationStatus: ValidationStatus;
  createdAt: string;
  footprint: GeoJSON.MultiPolygon;
  assets: DatasetAssetSummary[];
}

export interface DatasetDownloadResult {
  datasetId: string;
  asset: DatasetAssetSummary;
  downloadUrl: string | null;
  downloadEventId: string;
}

export interface CreateDatasetInput {
  title: string;
  description: string;
  type: DatasetType;
  footprint: GeoJSON.MultiPolygon;
  captureDate: string;
  aoiId?: string;
  sourceDatasetId?: string;
}

export interface UploadDatasetAssetInput {
  datasetId: string;
  assetType: "raw_archive" | "orthophoto_cog";
  file: File;
  onProgress?: (progress: number) => void;
}

export interface JobApiItem {
  id: string;
  title: string;
  description: string;
  uploader: DatasetUploader;
  data_type: DatasetType;
  status: string;
  validation_status: ValidationStatus;
  created_at: string;
  active_user_count: number;
  active_usernames: string[];
}

export interface Job {
  id: string;
  title: string;
  description: string;
  uploader: DatasetUploader;
  dataType: DatasetType;
  status: string;
  validationStatus: ValidationStatus;
  createdAt: string;
  activeUserCount: number;
  activeUsernames: string[];
}

export interface JobActivityEntryApiItem {
  id: string;
  status: "active" | "completed";
  user: {
    id: string;
    username: string;
  };
  created_at: string;
  updated_at: string;
}

export interface JobActivityApiResponse {
  dataset: {
    id: string;
    title: string;
  };
  active_users: JobActivityEntryApiItem[];
  completed_users: JobActivityEntryApiItem[];
}

export interface JobActivityEntry {
  id: string;
  status: "active" | "completed";
  user: {
    id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface JobActivity {
  dataset: {
    id: string;
    title: string;
  };
  activeUsers: JobActivityEntry[];
  completedUsers: JobActivityEntry[];
}

export interface AOIApiItem {
  id: string;
  title: string;
  description: string;
  geometry: GeoJSON.MultiPolygon;
  purpose: AOIPurpose;
  is_active: boolean;
  created_at: string;
  raw_count: number;
  orthophoto_count: number;
}

export interface AOIDatasetsApiResponse {
  aoi: AOIApiItem;
  raw_datasets: DatasetDetailApiItem[];
  orthophotos: DatasetDetailApiItem[];
}

export interface AOIDatasets {
  aoi: AOI;
  rawDatasets: DatasetDetail[];
  orthophotos: DatasetDetail[];
}
