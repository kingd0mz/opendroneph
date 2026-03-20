import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { DatasetFeatureProperties } from "../datasets/datasetGeoJson";
import type { GridAggregationCellProperties } from "../../types/dataset";
import { navigate } from "../../hooks/usePathname";
import { fetchGridAggregations } from "../../services/datasets";

const DATASET_SOURCE_ID = "datasets";
const DATASET_FILL_LAYER_ID = "datasets-fill";
const DATASET_STROKE_LAYER_ID = "datasets-stroke";
const GRID_SOURCE_ID = "dataset-grid";
const GRID_FILL_LAYER_ID = "dataset-grid-fill";
const GRID_HOVER_LAYER_ID = "dataset-grid-hover";
const GRID_STROKE_LAYER_ID = "dataset-grid-stroke";
const GRID_SYMBOL_LAYER_ID = "dataset-grid-symbol";
const AOI_SOURCE_ID = "aois";
const AOI_GLOW_LAYER_ID = "aois-glow";
const AOI_FILL_LAYER_ID = "aois-fill";
const AOI_STROKE_LAYER_ID = "aois-stroke";
const HIGH_ZOOM_THRESHOLD = 11;

const philippinesCenter: [number, number] = [122.5, 12.3];
const emptyGridCollection: FeatureCollection<Polygon, GridAggregationCellProperties> = {
  type: "FeatureCollection",
  features: [],
};

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

function extendPolygonBounds(bounds: maplibregl.LngLatBounds, geometry: Polygon | MultiPolygon) {
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const [lng, lat] of ring) {
        bounds.extend([Number(lng), Number(lat)]);
      }
    }
    return;
  }

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        bounds.extend([Number(lng), Number(lat)]);
      }
    }
  }
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
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const requestIdRef = useRef(0);

  function hasMapLayers(map: maplibregl.Map) {
    return (
      map.isStyleLoaded() &&
      !!map.getLayer(AOI_FILL_LAYER_ID) &&
      !!map.getLayer(AOI_STROKE_LAYER_ID) &&
      !!map.getLayer(AOI_GLOW_LAYER_ID) &&
      !!map.getLayer(DATASET_FILL_LAYER_ID) &&
      !!map.getLayer(GRID_FILL_LAYER_ID)
    );
  }

  function fitGeometryBounds(geometry: Polygon | MultiPolygon, maxZoom = 12) {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    extendPolygonBounds(bounds, geometry);
    map.fitBounds(bounds, {
      padding: 84,
      duration: 700,
      maxZoom,
    });
  }

  function fitToAoi(aoiId: string | null) {
    const feature = aoiCollection?.features.find((entry) => entry.properties.id === aoiId);
    if (feature) {
      fitGeometryBounds(feature.geometry);
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

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    });

    async function refreshGridLayer() {
      if (!map.isStyleLoaded()) {
        return;
      }

      const gridSource = map.getSource(GRID_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (!gridSource) {
        return;
      }

      const zoom = map.getZoom();
      if (zoom >= HIGH_ZOOM_THRESHOLD) {
        gridSource.setData(emptyGridCollection);
        map.setFilter(GRID_HOVER_LAYER_ID, ["==", ["get", "id"], ""]);
        popupRef.current?.remove();
        return;
      }

      const bounds = map.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];

      const requestId = ++requestIdRef.current;
      try {
        const response = await fetchGridAggregations(zoom, bbox);
        if (requestId !== requestIdRef.current) {
          return;
        }
        gridSource.setData(response.grid_cells);
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }
        gridSource.setData(emptyGridCollection);
      }
    }

    function setGridHover(featureId: string | null, lngLat?: maplibregl.LngLat) {
      if (!map.isStyleLoaded()) {
        return;
      }

      map.setFilter(GRID_HOVER_LAYER_ID, ["==", ["get", "id"], featureId ?? ""]);

      if (!featureId || !lngLat) {
        popupRef.current?.remove();
        return;
      }

      const feature = map.queryRenderedFeatures(map.project(lngLat), {
        layers: [GRID_FILL_LAYER_ID],
      })[0];
      const count = Number(feature?.properties?.count ?? 0);
      popupRef.current
        ?.setLngLat(lngLat)
        .setHTML(`<strong>${count}</strong> contribution${count === 1 ? "" : "s"}`)
        .addTo(map);
    }

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      map.addSource(DATASET_SOURCE_ID, {
        type: "geojson",
        data: datasetCollection,
      });

      map.addSource(GRID_SOURCE_ID, {
        type: "geojson",
        data: emptyGridCollection,
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
            "#D62828",
            "#1D4ED8",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            16,
            9,
          ],
          "line-opacity": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            0.22,
            0.12,
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
            "#D62828",
            "#1D4ED8",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            0.14,
            0.1,
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
            "#D62828",
            "#1D4ED8",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "isEvent"], false],
            4.4,
            2.6,
          ],
        },
      });

      map.addLayer({
        id: GRID_FILL_LAYER_ID,
        type: "fill",
        source: GRID_SOURCE_ID,
        maxzoom: HIGH_ZOOM_THRESHOLD,
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "count"],
            1, "#DCEEFF",
            5, "#8AB6E8",
            15, "#3B82C4",
            30, "#0B4F8A",
          ],
          "fill-opacity": 0.5,
        },
      });

      map.addLayer({
        id: GRID_HOVER_LAYER_ID,
        type: "line",
        source: GRID_SOURCE_ID,
        maxzoom: HIGH_ZOOM_THRESHOLD,
        filter: ["==", ["get", "id"], ""],
        paint: {
          "line-color": "#0B1F3A",
          "line-width": 3,
        },
      });

      map.addLayer({
        id: GRID_STROKE_LAYER_ID,
        type: "line",
        source: GRID_SOURCE_ID,
        maxzoom: HIGH_ZOOM_THRESHOLD,
        paint: {
          "line-color": "#2A5D90",
          "line-width": 1,
          "line-opacity": 0.6,
        },
      });

      map.addLayer({
        id: GRID_SYMBOL_LAYER_ID,
        type: "symbol",
        source: GRID_SOURCE_ID,
        maxzoom: HIGH_ZOOM_THRESHOLD,
        layout: {
          "text-field": ["to-string", ["get", "count"]],
          "text-size": 12,
          "text-font": ["Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#0B1F3A",
          "text-halo-color": "#FFFFFF",
          "text-halo-width": 1,
        },
      });

      map.addLayer({
        id: DATASET_FILL_LAYER_ID,
        type: "fill",
        source: DATASET_SOURCE_ID,
        minzoom: HIGH_ZOOM_THRESHOLD,
        paint: {
          "fill-color": "#0B1F3A",
          "fill-opacity": 0.1,
        },
      });

      map.addLayer({
        id: DATASET_STROKE_LAYER_ID,
        type: "line",
        source: DATASET_SOURCE_ID,
        minzoom: HIGH_ZOOM_THRESHOLD,
        paint: {
          "line-color": "#142C54",
          "line-width": 1.4,
        },
      });

      map.on("click", DATASET_FILL_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as DatasetFeatureProperties | undefined;
        if (properties) {
          navigate(`/datasets/${properties.id}`);
        }
      });

      map.on("click", GRID_FILL_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (feature?.geometry?.type === "Polygon") {
          fitGeometryBounds(feature.geometry, 11);
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

      map.on("mousemove", GRID_FILL_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const featureId = typeof feature?.properties?.id === "string" ? feature.properties.id : null;
        if (featureId && event.lngLat) {
          map.getCanvas().style.cursor = "pointer";
          setGridHover(featureId, event.lngLat);
        }
      });

      map.on("mouseleave", GRID_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        setGridHover(null);
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

      map.on("moveend", () => {
        void refreshGridLayer();
      });

      map.on("zoomend", () => {
        void refreshGridLayer();
      });

      void refreshGridLayer();
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
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
        extendPolygonBounds(bounds, feature.geometry);
        hasFeatures = true;
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
