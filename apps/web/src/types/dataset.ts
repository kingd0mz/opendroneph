export type DatasetType = "raw" | "orthophoto";
export type ValidationStatus = "pending" | "valid" | "invalid";
export type AOIPurpose = "disaster" | "landcover" | "benthic";
export type MissionStatus = "active" | "closed";
export type JobStatus = "active" | "completed";

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
  organization_name: string;
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

export interface MissionSummary {
  id: string;
  title: string;
  description: string;
  aoi: AOISummary;
  eventType: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetFlag {
  id: string;
  reason: string;
  status: "pending" | "ignored";
  createdBy: DatasetUploader;
  createdAt: string;
  updatedAt: string;
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
  uploader: DatasetUploader;
  aoi: {
    id: string;
    title: string;
    description: string;
    purpose: AOIPurpose;
    is_active: boolean;
    created_at: string;
  } | null;
  job: {
    id: string;
    title: string;
    data_type: DatasetType;
    created_at: string;
  } | null;
  mission: {
    id: string;
    title: string;
    description: string;
    event_type: string;
    status: MissionStatus;
    created_at: string;
    updated_at: string;
    aoi: {
      id: string;
      title: string;
      description: string;
      purpose: AOIPurpose;
      is_active: boolean;
      created_at: string;
    };
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
  flags: Array<{
    id: string;
    reason: string;
    status: "pending" | "ignored";
    created_by: DatasetUploader;
    created_at: string;
    updated_at: string;
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
  job: DatasetReference | null;
  mission: MissionSummary | null;
  dataType: DatasetType;
  status: string;
  validationStatus: ValidationStatus;
  createdAt: string;
  footprint: GeoJSON.MultiPolygon;
  assets: DatasetAssetSummary[];
  flags: DatasetFlag[];
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
  jobId?: string;
  missionId?: string;
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
  aoi: DatasetDetailApiItem["aoi"];
  mission: DatasetDetailApiItem["mission"];
  data_type: DatasetType;
  status: string;
  validation_status: ValidationStatus;
  created_at: string;
  participants_count: number;
  outputs_count: number;
  participants: Array<{
    id: string;
    username: string;
    organization_name: string;
  }>;
  outputs: Array<{
    id: string;
    title: string;
    data_type: DatasetType;
    created_at: string;
  }>;
  job_status: JobStatus;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  uploader: DatasetUploader;
  aoi: AOISummary | null;
  mission: MissionSummary | null;
  dataType: DatasetType;
  status: string;
  validationStatus: ValidationStatus;
  createdAt: string;
  participantsCount: number;
  outputsCount: number;
  participants: Array<{
    id: string;
    username: string;
    organizationName: string;
  }>;
  outputs: DatasetReference[];
  jobStatus: JobStatus;
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

export interface GridAggregationCellProperties {
  id: string;
  count: number;
}

export interface GridAggregationResponse {
  zoom_band: "low" | "mid" | "high";
  cell_size_degrees: number | null;
  grid_cells: GeoJSON.FeatureCollection<GeoJSON.Polygon, GridAggregationCellProperties>;
}
