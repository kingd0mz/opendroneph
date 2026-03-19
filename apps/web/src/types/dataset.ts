export type DatasetType = "raw" | "orthophoto";
export type ValidationStatus = "pending" | "valid" | "invalid";

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

export interface DatasetApiItem {
  id: string;
  title: string;
  footprint: GeoJSON.MultiPolygon;
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
  dataType: DatasetType;
  createdAt: string;
}

export interface DatasetDetail {
  id: string;
  title: string;
  description: string;
  uploader: DatasetUploader;
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
