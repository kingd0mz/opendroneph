import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { FeatureCollection, MultiPolygon } from "geojson";
import { DatasetPopupCard } from "../../components/DatasetPopupCard";
import { createRoot, type Root } from "react-dom/client";
import type { DatasetFeatureProperties } from "../datasets/datasetGeoJson";

const SOURCE_ID = "datasets";
const FILL_LAYER_ID = "datasets-fill";
const STROKE_LAYER_ID = "datasets-stroke";

const philippinesCenter: [number, number] = [122.5, 12.3];

interface DatasetMapProps {
  datasetCollection: FeatureCollection<MultiPolygon, DatasetFeatureProperties>;
}

export function DatasetMap({ datasetCollection }: DatasetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRootRef = useRef<Root | null>(null);

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
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: datasetCollection,
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": "#d17b0f",
          "fill-opacity": 0.28,
        },
      });

      map.addLayer({
        id: STROKE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#0f5d5e",
          "line-width": 2.25,
        },
      });

      map.on("click", FILL_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const properties = feature?.properties as DatasetFeatureProperties | undefined;
        const coordinates = event.lngLat;

        if (!properties) {
          return;
        }

        const popupContainer = document.createElement("div");
        popupRootRef.current?.unmount();
        popupRootRef.current = createRoot(popupContainer);
        popupRootRef.current.render(
          <DatasetPopupCard
            title={properties.title}
            dataType={properties.dataType}
            createdAt={properties.createdAt}
          />,
        );

        new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "320px",
        })
          .setLngLat([coordinates.lng, coordinates.lat])
          .setDOMContent(popupContainer)
          .addTo(map);
      });

      map.on("mouseenter", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      popupRootRef.current?.unmount();
      map.remove();
      mapRef.current = null;
    };
  }, [datasetCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(datasetCollection);
      const bounds = new maplibregl.LngLatBounds();
      let hasFeatures = false;

      for (const feature of datasetCollection.features) {
        for (const polygon of feature.geometry.coordinates) {
          for (const [lng, lat] of polygon) {
            bounds.extend([Number(lng), Number(lat)]);
            hasFeatures = true;
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
    }
  }, [datasetCollection]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
