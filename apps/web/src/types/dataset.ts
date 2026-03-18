export type DatasetType = "raw" | "orthophoto";

export interface DatasetApiItem {
  id: string;
  title: string;
  footprint: GeoJSON.MultiPolygon;
  data_type?: DatasetType;
  type?: DatasetType;
  created_at: string;
}

export interface Dataset {
  id: string;
  title: string;
  footprint: GeoJSON.MultiPolygon;
  dataType: DatasetType;
  createdAt: string;
}
