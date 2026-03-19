import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const SOURCE_ID = "dataset-detail-footprint";
const FILL_LAYER_ID = "dataset-detail-fill";
const STROKE_LAYER_ID = "dataset-detail-stroke";

interface DatasetFootprintMapProps {
  footprint: GeoJSON.MultiPolygon;
}

export function DatasetFootprintMap({ footprint }: DatasetFootprintMapProps) {
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
      center: [122.5, 12.3],
      zoom: 5.2,
      interactive: false,
    });

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: footprint,
          properties: {},
        },
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": "#d17b0f",
          "fill-opacity": 0.3,
        },
      });

      map.addLayer({
        id: STROKE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#0f5d5e",
          "line-width": 2.4,
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [footprint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: "Feature",
        geometry: footprint,
        properties: {},
      });
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const polygon of footprint.coordinates) {
      for (const [lng, lat] of polygon[0] ?? []) {
        bounds.extend([Number(lng), Number(lat)]);
      }
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: 36,
        duration: 0,
        maxZoom: 12,
      });
    }
  }, [footprint]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
