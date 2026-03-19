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
  isEvent: boolean;
}

interface DatasetMapProps {
  datasetCollection: FeatureCollection<MultiPolygon, DatasetFeatureProperties>;
  aoiCollection?: FeatureCollection<MultiPolygon, AOIFeatureProperties>;
  hoveredAoiId?: string | null;
  focusedAoiId?: string | null;
  onAoiSelect?: (aoiId: string) => void;
}

export function DatasetMap({
  datasetCollection,
  aoiCollection,
  hoveredAoiId = null,
  focusedAoiId = null,
  onAoiSelect,
}: DatasetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  function hasMapLayers(map: maplibregl.Map) {
    return (
      map.isStyleLoaded() &&
      !!map.getLayer(AOI_FILL_LAYER_ID) &&
      !!map.getLayer(AOI_STROKE_LAYER_ID) &&
      !!map.getLayer(AOI_GLOW_LAYER_ID) &&
      !!map.getLayer(DATASET_FILL_LAYER_ID)
    );
  }

  function fitToAoi(aoiId: string | null) {
    const map = mapRef.current;
    if (!map || !aoiId || !aoiCollection || !map.isStyleLoaded()) {
      return;
    }

    const feature = aoiCollection.features.find((entry) => entry.properties.id === aoiId);
    if (!feature) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasBounds = false;

    for (const polygon of feature.geometry.coordinates) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          bounds.extend([Number(lng), Number(lat)]);
          hasBounds = true;
        }
      }
    }

    if (hasBounds) {
      map.fitBounds(bounds, {
        padding: 84,
        duration: 700,
        maxZoom: 12,
      });
    }
  }

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
          "line-color": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            "#ff9087",
            "#ffe18f",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            16,
            10,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            0.24,
            0.14,
          ],
          "line-blur": 2,
        },
      });

      map.addLayer({
        id: AOI_FILL_LAYER_ID,
        type: "fill",
        source: AOI_SOURCE_ID,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            "#ef6a61",
            "#f0b44d",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            0.2,
            0.12,
          ],
        },
      });

      map.addLayer({
        id: AOI_STROKE_LAYER_ID,
        type: "line",
        source: AOI_SOURCE_ID,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            "#ffb2ac",
            "#ffd166",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            4.4,
            3,
          ],
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
          onAoiSelect?.(properties.id);
          fitToAoi(properties.id);
        }
      });

      map.on("click", AOI_STROKE_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as AOIFeatureProperties | undefined;
        if (properties) {
          onAoiSelect?.(properties.id);
          fitToAoi(properties.id);
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
  }, [aoiCollection, datasetCollection, onAoiSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasMapLayers(map)) {
      return;
    }

    const activeAoiId = hoveredAoiId ?? focusedAoiId;

    map.setPaintProperty(AOI_FILL_LAYER_ID, "fill-opacity", [
      "case",
      ["==", ["get", "id"], activeAoiId ?? ""],
      0.32,
      ["boolean", ["get", "isEvent"], false],
      0.2,
      0.12,
    ]);
    map.setPaintProperty(AOI_STROKE_LAYER_ID, "line-width", [
      "case",
      ["==", ["get", "id"], activeAoiId ?? ""],
      6,
      ["boolean", ["get", "isEvent"], false],
      4.4,
      3,
    ]);
    map.setPaintProperty(AOI_GLOW_LAYER_ID, "line-opacity", [
      "case",
      ["==", ["get", "id"], activeAoiId ?? ""],
      0.42,
      ["boolean", ["get", "isEvent"], false],
      0.24,
      0.14,
    ]);
  }, [focusedAoiId, hoveredAoiId]);

  useEffect(() => {
    if (focusedAoiId) {
      fitToAoi(focusedAoiId);
    }
  }, [focusedAoiId]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
