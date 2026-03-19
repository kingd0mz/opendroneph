import { api } from "./api";
import type {
  Dataset,
  DatasetApiItem,
  DatasetAssetSummary,
  DatasetDetail,
  DatasetDetailApiItem,
  DatasetDownloadApiResponse,
  DatasetDownloadResult,
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
    dataType: item.data_type,
    status: item.status,
    validationStatus: item.validation_status,
    createdAt: item.created_at,
    footprint: item.footprint,
    assets: item.assets.map(normalizeAsset),
  };
}

export async function fetchPublishedDatasets(): Promise<Dataset[]> {
  const response = await api.get<DatasetApiItem[]>("/datasets/", {
    params: { status: "published" },
  });

  return response.data.map(normalizeDataset);
}

export async function fetchDatasetDetail(datasetId: string): Promise<DatasetDetail> {
  const response = await api.get<DatasetDetailApiItem>(`/datasets/${datasetId}/`);
  return normalizeDatasetDetail(response.data);
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
