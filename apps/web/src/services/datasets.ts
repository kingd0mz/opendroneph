import { api } from "./api";
import type {
  CreateDatasetInput,
  Dataset,
  DatasetApiItem,
  DatasetAssetSummary,
  DatasetDetail,
  DatasetDetailApiItem,
  DatasetDownloadApiResponse,
  DatasetDownloadResult,
  DatasetReference,
  Job,
  JobActivity,
  JobActivityApiResponse,
  JobApiItem,
  UploadDatasetAssetInput,
} from "../types/dataset";

function normalizeDataset(item: DatasetApiItem): Dataset {
  return {
    id: item.id,
    title: item.title,
    footprint: item.footprint,
    dataType: item.data_type ?? item.type ?? "orthophoto",
    createdAt: item.created_at,
  };
}

function normalizeDatasetReference(item: {
  id: string;
  title: string;
  data_type: DatasetReference["dataType"];
  created_at: string;
}): DatasetReference {
  return {
    id: item.id,
    title: item.title,
    dataType: item.data_type,
    createdAt: item.created_at,
  };
}

function normalizeAsset(
  asset: DatasetDetailApiItem["assets"][number] | DatasetDownloadApiResponse["asset"],
): DatasetAssetSummary {
  return {
    id: asset.id,
    assetType: asset.asset_type,
    sizeBytes: asset.size_bytes,
    isDownloadable: asset.is_downloadable,
    createdAt: asset.created_at,
  };
}

function normalizeDatasetDetail(item: DatasetDetailApiItem): DatasetDetail {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    uploader: item.uploader,
    sourceDataset: item.source_dataset ? normalizeDatasetReference(item.source_dataset) : null,
    dataType: item.data_type,
    status: item.status,
    validationStatus: item.validation_status,
    createdAt: item.created_at,
    footprint: item.footprint,
    assets: item.assets.map(normalizeAsset),
  };
}

function normalizeJob(item: JobApiItem): Job {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    uploader: item.uploader,
    dataType: item.data_type,
    status: item.status,
    validationStatus: item.validation_status,
    createdAt: item.created_at,
    activeUserCount: item.active_user_count,
    activeUsernames: item.active_usernames,
  };
}

function normalizeJobActivityEntry(item: JobActivityApiResponse["active_users"][number]) {
  return {
    id: item.id,
    status: item.status,
    user: item.user,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function normalizeJobActivity(item: JobActivityApiResponse): JobActivity {
  return {
    dataset: item.dataset,
    activeUsers: item.active_users.map(normalizeJobActivityEntry),
    completedUsers: item.completed_users.map(normalizeJobActivityEntry),
  };
}

export async function fetchPublishedDatasets(): Promise<Dataset[]> {
  const response = await api.get<DatasetApiItem[]>("/datasets/");

  return response.data.map(normalizeDataset);
}

export async function fetchDatasetDetail(datasetId: string): Promise<DatasetDetail> {
  const response = await api.get<DatasetDetailApiItem>(`/datasets/${datasetId}/`);
  return normalizeDatasetDetail(response.data);
}

export async function createDataset(input: CreateDatasetInput): Promise<{ id: string }> {
  const response = await api.post<{ id: string }>("/datasets/", {
    title: input.title,
    description: input.description,
    type: input.type,
    source_dataset_id: input.sourceDatasetId,
    footprint: input.footprint,
    capture_date: input.captureDate,
    platform_type: "drone",
    camera_model: "Unknown",
    license_type: "cc_by",
  });

  return response.data;
}

export async function uploadDatasetAsset(input: UploadDatasetAssetInput): Promise<void> {
  const formData = new FormData();
  formData.append("asset_type", input.assetType);
  formData.append("file", input.file);

  await api.post(`/datasets/${input.datasetId}/upload-asset/`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (event) => {
      if (!input.onProgress || !event.total) {
        return;
      }
      input.onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
}

export async function publishDataset(datasetId: string): Promise<void> {
  await api.post(`/datasets/${datasetId}/publish/`);
}

export async function downloadDataset(datasetId: string): Promise<DatasetDownloadResult> {
  const response = await api.get<DatasetDownloadApiResponse>(`/datasets/${datasetId}/download/`);
  return {
    datasetId: response.data.dataset,
    asset: normalizeAsset(response.data.asset),
    downloadUrl: response.data.download_url ?? null,
    downloadEventId: response.data.download_event_id,
  };
}

export async function fetchJobs(): Promise<Job[]> {
  const response = await api.get<JobApiItem[]>("/jobs/");
  return response.data.map(normalizeJob);
}

export async function startJob(datasetId: string): Promise<void> {
  await api.post(`/jobs/${datasetId}/start/`);
}

export async function completeJob(datasetId: string): Promise<void> {
  await api.post(`/jobs/${datasetId}/complete/`);
}

export async function fetchJobActivity(datasetId: string): Promise<JobActivity> {
  const response = await api.get<JobActivityApiResponse>(`/jobs/${datasetId}/activity/`);
  return normalizeJobActivity(response.data);
}
