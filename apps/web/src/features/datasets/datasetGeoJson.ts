import type { Feature, FeatureCollection, MultiPolygon } from "geojson";

import type { Dataset } from "../../types/dataset";

export interface DatasetFeatureProperties {
  id: string;
  title: string;
  dataType: string;
  createdAt: string;
}

export function toDatasetFeatureCollection(
  datasets: Dataset[],
): FeatureCollection<MultiPolygon, DatasetFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: datasets.map<Feature<MultiPolygon, DatasetFeatureProperties>>(
      (dataset) => ({
        type: "Feature",
        geometry: dataset.footprint,
        properties: {
          id: dataset.id,
          title: dataset.title,
          dataType: dataset.dataType,
          createdAt: dataset.createdAt,
        },
      }),
    ),
  };
}
