import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { FeatureCollection, MultiPolygon } from "geojson";
import type { DatasetFeatureProperties } from "../datasets/datasetGeoJson";
import { navigate } from "../../hooks/usePathname";

const DATASET_SOURCE_ID = "datasets";
const DATASET_FILL_LAYER_ID = "datasets-fill";
const DATASET_STROKE_LAYER_ID = "datasets-stroke";
const AOI_SOURCE_ID = "aois";
const AOI_GLOW_LAYER_ID = "aois-glow";
const AOI_FILL_LAYER_ID = "aois-fill";
const AOI_STROKE_LAYER_ID = "aois-stroke";

const philippinesCenter: [number, number] = [122.5, 12.3];

export interface AOIFeatureProperties {
  id: string;
  title: string;
  purpose: string;
}

interface DatasetMapProps {
  datasetCollection: FeatureCollection<MultiPolygon, DatasetFeatureProperties>;
  aoiCollection?: FeatureCollection<MultiPolygon, AOIFeatureProperties>;
}

export function DatasetMap({ datasetCollection, aoiCollection }: DatasetMapProps) {
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
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: philippinesCenter,
      zoom: 5.2,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      map.addSource(DATASET_SOURCE_ID, {
        type: "geojson",
        data: datasetCollection,
      });

      map.addSource(AOI_SOURCE_ID, {
        type: "geojson",
        data: aoiCollection ?? {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: AOI_GLOW_LAYER_ID,
        type: "line",
        source: AOI_SOURCE_ID,
        paint: {
          "line-color": "#ffe18f",
          "line-width": 12,
          "line-opacity": 0.18,
          "line-blur": 2,
        },
      });

      map.addLayer({
        id: AOI_FILL_LAYER_ID,
        type: "fill",
        source: AOI_SOURCE_ID,
        paint: {
          "fill-color": "#f0b44d",
          "fill-opacity": 0.16,
        },
      });

      map.addLayer({
        id: AOI_STROKE_LAYER_ID,
        type: "line",
        source: AOI_SOURCE_ID,
        paint: {
          "line-color": "#ffd166",
          "line-width": 3.5,
        },
      });

      map.addLayer({
        id: DATASET_FILL_LAYER_ID,
        type: "fill",
        source: DATASET_SOURCE_ID,
        paint: {
          "fill-color": "#1f7f69",
          "fill-opacity": 0.2,
        },
      });

      map.addLayer({
        id: DATASET_STROKE_LAYER_ID,
        type: "line",
        source: DATASET_SOURCE_ID,
        paint: {
          "line-color": "#0f5d5e",
          "line-width": 1.8,
        },
      });

      map.on("click", DATASET_FILL_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as DatasetFeatureProperties | undefined;
        if (properties) {
          navigate(`/datasets/${properties.id}`);
        }
      });

      map.on("click", AOI_FILL_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as AOIFeatureProperties | undefined;
        if (properties) {
          navigate(`/aois/${properties.id}`);
        }
      });

      map.on("click", AOI_STROKE_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as AOIFeatureProperties | undefined;
        if (properties) {
          navigate(`/aois/${properties.id}`);
        }
      });

      map.on("mouseenter", DATASET_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", DATASET_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("mouseenter", AOI_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", AOI_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("mouseenter", AOI_STROKE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", AOI_STROKE_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [datasetCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const datasetSource = map.getSource(DATASET_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (datasetSource) {
      datasetSource.setData(datasetCollection);
    }

    const missionSource = map.getSource(AOI_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (missionSource) {
      missionSource.setData(
        aoiCollection ?? {
          type: "FeatureCollection",
          features: [],
        },
      );
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasFeatures = false;

    const collections = [
      datasetCollection,
      aoiCollection ?? { type: "FeatureCollection", features: [] as typeof datasetCollection.features },
    ];

    for (const collection of collections) {
      for (const feature of collection.features) {
        for (const polygon of feature.geometry.coordinates) {
          for (const ring of polygon) {
            for (const [lng, lat] of ring) {
              bounds.extend([Number(lng), Number(lat)]);
              hasFeatures = true;
            }
          }
        }
      }
    }

    if (hasFeatures) {
      map.fitBounds(bounds, {
        padding: 72,
        duration: 800,
        maxZoom: 11,
      });
    }
  }, [aoiCollection, datasetCollection]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
