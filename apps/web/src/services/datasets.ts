import { api } from "./api";
import type {
  AOI,
  AOIApiItem,
  AOIDatasets,
  AOIDatasetsApiResponse,
  AOISummary,
  CreateDatasetInput,
  Dataset,
  DatasetApiItem,
  DatasetAssetSummary,
  DatasetDetail,
  DatasetDetailApiItem,
  DatasetDownloadApiResponse,
  DatasetDownloadResult,
  DatasetFlag,
  DatasetReference,
  GridAggregationResponse,
  Job,
  JobApiItem,
  MissionApiItem,
  MissionSummary,
  UploadDatasetAssetInput,
} from "../types/dataset";

function normalizeAoiSummary(item: {
  id: string;
  title: string;
  description: string;
  purpose: AOIApiItem["purpose"];
  is_active: boolean;
  created_at: string;
}): AOISummary {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    purpose: item.purpose,
    isActive: item.is_active,
    createdAt: item.created_at,
  };
}

function normalizeMission(item: JobApiItem["mission"] | MissionApiItem | null): MissionSummary | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    aoi: normalizeAoiSummary(item.aoi),
    eventType: item.event_type,
    status: item.status,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function normalizeAoi(item: AOIApiItem): AOI {
  return {
    ...normalizeAoiSummary(item),
    geometry: item.geometry,
    rawCount: item.raw_count,
    orthophotoCount: item.orthophoto_count,
  };
}

function normalizeDataset(item: DatasetApiItem): Dataset {
  return {
    id: item.id,
    title: item.title,
    footprint: item.footprint,
    aoi: item.aoi ? normalizeAoiSummary(item.aoi) : null,
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

function normalizeFlag(flag: DatasetDetailApiItem["flags"][number]): DatasetFlag {
  return {
    id: flag.id,
    reason: flag.reason,
    status: flag.status,
    createdBy: flag.created_by,
    createdAt: flag.created_at,
    updatedAt: flag.updated_at,
  };
}

function normalizeDatasetDetail(item: DatasetDetailApiItem): DatasetDetail {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    uploader: item.uploader,
    aoi: item.aoi ? normalizeAoiSummary(item.aoi) : null,
    job: item.job ? normalizeDatasetReference(item.job) : null,
    mission: normalizeMission(item.mission),
    dataType: item.data_type,
    status: item.status,
    validationStatus: item.validation_status,
    createdAt: item.created_at,
    footprint: item.footprint,
    assets: item.assets.map(normalizeAsset),
    flags: item.flags.map(normalizeFlag),
  };
}

function normalizeJob(item: JobApiItem): Job {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    uploader: item.uploader,
    aoi: item.aoi ? normalizeAoiSummary(item.aoi) : null,
    mission: normalizeMission(item.mission),
    dataType: item.data_type,
    status: item.status,
    validationStatus: item.validation_status,
    createdAt: item.created_at,
    participantsCount: item.participants_count,
    outputsCount: item.outputs_count,
    participants: item.participants.map((participant) => ({
      id: participant.id,
      username: participant.username,
      organizationName: participant.organization_name,
    })),
    outputs: item.outputs.map(normalizeDatasetReference),
    jobStatus: item.job_status,
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
    aoi_id: input.aoiId,
    job_id: input.jobId,
    mission_id: input.missionId,
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

export async function fetchAois(): Promise<AOI[]> {
  const response = await api.get<AOIApiItem[]>("/aois/");
  return response.data.map(normalizeAoi);
}

export async function fetchAoiDatasets(aoiId: string): Promise<AOIDatasets> {
  const response = await api.get<AOIDatasetsApiResponse>(`/aois/${aoiId}/datasets/`);
  return {
    aoi: normalizeAoi(response.data.aoi),
    rawDatasets: response.data.raw_datasets.map(normalizeDatasetDetail),
    orthophotos: response.data.orthophotos.map(normalizeDatasetDetail),
  };
}

export async function fetchGridAggregations(zoom: number, bbox: [number, number, number, number]): Promise<GridAggregationResponse> {
  const response = await api.get<GridAggregationResponse>("/grid-aggregations/", {
    params: {
      zoom,
      bbox: bbox.join(","),
    },
  });
  return response.data;
}

export async function fetchMissions(): Promise<MissionSummary[]> {
  const response = await api.get<MissionApiItem[]>("/missions/");
  return response.data.map((item) => normalizeMission(item)).filter((item): item is MissionSummary => item !== null);
}
