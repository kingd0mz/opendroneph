import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { Feature, FeatureCollection, MultiPolygon } from "geojson";

const AOI_SOURCE_ID = "aoi-boundary";
const DATASET_SOURCE_ID = "aoi-datasets";

interface AOIMapProps {
  aoiGeometry: GeoJSON.MultiPolygon;
  datasets: Array<{
    id: string;
    title: string;
    footprint: GeoJSON.MultiPolygon;
  }>;
}

export function AOIMap({ aoiGeometry, datasets }: AOIMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [122.5, 12.3],
      zoom: 5.2,
    });

    map.on("load", () => {
      map.addSource(AOI_SOURCE_ID, {
        type: "geojson",
        data: { type: "Feature", geometry: aoiGeometry, properties: {} },
      });
      map.addSource(DATASET_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "aoi-fill",
        type: "fill",
        source: AOI_SOURCE_ID,
        paint: {
          "fill-color": "#0f5d5e",
          "fill-opacity": 0.12,
        },
      });
      map.addLayer({
        id: "aoi-line",
        type: "line",
        source: AOI_SOURCE_ID,
        paint: {
          "line-color": "#0f5d5e",
          "line-width": 3,
        },
      });
      map.addLayer({
        id: "dataset-fill",
        type: "fill",
        source: DATASET_SOURCE_ID,
        paint: {
          "fill-color": "#f0b44d",
          "fill-opacity": 0.3,
        },
      });
      map.addLayer({
        id: "dataset-line",
        type: "line",
        source: DATASET_SOURCE_ID,
        paint: {
          "line-color": "#b86f00",
          "line-width": 2,
        },
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [aoiGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const aoiSource = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (aoiSource) {
      aoiSource.setData({ type: "Feature", geometry: aoiGeometry, properties: {} });
    }

    const datasetSource = map.getSource(DATASET_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (datasetSource) {
      const featureCollection: FeatureCollection<MultiPolygon> = {
        type: "FeatureCollection",
        features: datasets.map<Feature<MultiPolygon>>((dataset) => ({
          type: "Feature",
          geometry: dataset.footprint,
          properties: {
            id: dataset.id,
            title: dataset.title,
          },
        })),
      };
      datasetSource.setData(featureCollection);
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasBounds = false;

    for (const polygon of aoiGeometry.coordinates) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          bounds.extend([Number(lng), Number(lat)]);
          hasBounds = true;
        }
      }
    }

    for (const dataset of datasets) {
      for (const polygon of dataset.footprint.coordinates) {
        for (const ring of polygon) {
          for (const [lng, lat] of ring) {
            bounds.extend([Number(lng), Number(lat)]);
            hasBounds = true;
          }
        }
      }
    }

    if (hasBounds) {
      map.fitBounds(bounds, {
        padding: 48,
        duration: 0,
        maxZoom: 12,
      });
    }
  }, [aoiGeometry, datasets]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
