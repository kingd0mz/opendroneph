import { api } from "./api";
import type { Dataset, DatasetApiItem } from "../types/dataset";

function normalizeDataset(item: DatasetApiItem): Dataset {
  return {
    id: item.id,
    title: item.title,
    footprint: item.footprint,
    dataType: item.data_type ?? item.type ?? "orthophoto",
    createdAt: item.created_at,
  };
}

export async function fetchPublishedDatasets(): Promise<Dataset[]> {
  const response = await api.get<DatasetApiItem[]>("/datasets/", {
    params: { status: "published" },
  });

  return response.data.map(normalizeDataset);
}
