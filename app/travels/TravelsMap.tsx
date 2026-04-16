"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Position } from "geojson";

interface CityEntry {
  name: string;
  lng: number;
  lat: number;
  rank: number;
}

interface Props {
  geojson: FeatureCollection;
  bbox: [number, number, number, number] | null;
  mapKey: string;
  stadiaKey: string;
  cities?: CityEntry[];
}

export default function TravelsMap({ geojson, bbox, mapKey, stadiaKey, cities }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    // Stamen Toner (lite) via Stadia — clean black-ink-on-paper basemap
    // that matches the site's paper/ink aesthetic. No colors to fight the
    // red explored fill.
    const keyParam = stadiaKey ? `?api_key=${stadiaKey}` : "";
    const style: maplibregl.StyleSpecification | string = mapKey
      ? `https://api.maptiler.com/maps/landscape/style.json?key=${mapKey}`
      : {
          version: 8,
          sources: {
            toner: {
              type: "raster",
              tiles: [
                `https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png${keyParam}`,
              ],
              tileSize: 256,
              maxzoom: 18,
              attribution:
                "\u00a9 <a href='https://stadiamaps.com/'>Stadia Maps</a> \u00a9 <a href='https://stamen.com/'>Stamen Design</a> \u00a9 <a href='https://openstreetmap.org/copyright'>OpenStreetMap</a>",
            },
          },
          layers: [{ id: "toner", type: "raster", source: "toner" }],
        };

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el,
        style,
        center: bbox ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] : [0, 20],
        zoom: bbox ? 3 : 1.5,
      });
    } catch (err) {
      setStatus(`init failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    mapRef.current = map;
    map.on("error", (e) => setStatus(`map error: ${e.error?.message ?? "unknown"}`));
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");

    const explored = geojson.features.filter(
      (f) => (f.properties as { kind?: string })?.kind === "explored",
    );
    const exploredFC: FeatureCollection | null = explored.length
      ? { type: "FeatureCollection", features: explored }
      : null;
    const fog = geojson.features.find(
      (f) => (f.properties as { kind?: string })?.kind === "fog",
    );

    map.on("load", () => {
      try {
        if (!exploredFC) return;
        map.addSource("explored", { type: "geojson", data: exploredFC });
        if (fog) {
          map.addSource("fog", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [fog] },
          });
          // Paper-cream overlay on unexplored — lets the B&W toner read at
          // reduced contrast, letting the red fills dominate.
          map.addLayer({
            id: "fog-fill",
            type: "fill",
            source: "fog",
            paint: {
              "fill-color": "#efe6d6",
              "fill-opacity": [
                "interpolate", ["linear"], ["zoom"],
                0, 0.7,
                4, 0.62,
                8, 0.55,
                14, 0.42,
              ],
              "fill-antialias": true,
            },
          });
        }

        // Outline-only at low zoom so anti-aliased block clusters don't
        // read as filled triangles. Red fill fades in at city scale where
        // the block geometry is truly legible.
        map.addLayer({
          id: "explored-fill",
          type: "fill",
          source: "explored",
          paint: {
            "fill-color": "#b30000",
            "fill-opacity": [
              "interpolate", ["linear"], ["zoom"],
              0, 0,
              9, 0,
              11, 0.45,
              14, 0.65,
              16, 0.5,
            ],
          },
        });
        map.addLayer({
          id: "explored-outline",
          type: "line",
          source: "explored",
          paint: {
            "line-color": "#121212",
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              0, 1.0,
              6, 1.1,
              11, 1.0,
              16, 0.7,
            ],
            "line-opacity": 0.9,
          },
        });

        // Click anywhere near a region to zoom into it.
        map.on("click", (ev) => {
          const HIT_PX = 40;
          const p = ev.point;
          const hits = map.queryRenderedFeatures(
            [[p.x - HIT_PX, p.y - HIT_PX], [p.x + HIT_PX, p.y + HIT_PX]],
            { layers: ["explored-fill"] },
          );
          if (hits.length === 0) return;
          let best = hits[0];
          let bestDist = Infinity;
          for (const h of hits) {
            const b = geomBbox(h as Feature);
            if (!b) continue;
            const cx = (b[0] + b[2]) / 2;
            const cy = (b[1] + b[3]) / 2;
            const proj = map.project([cx, cy]);
            const d = (proj.x - p.x) ** 2 + (proj.y - p.y) ** 2;
            if (d < bestDist) { bestDist = d; best = h; }
          }
          const b = geomBbox(best as Feature);
          if (b) {
            map.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
              padding: 120,
              maxZoom: 13,
              duration: 600,
            });
          }
        });
        map.on("mousemove", (ev) => {
          const near = map.queryRenderedFeatures(
            [[ev.point.x - 40, ev.point.y - 40], [ev.point.x + 40, ev.point.y + 40]],
            { layers: ["explored-fill"] },
          );
          map.getCanvas().style.cursor = near.length ? "pointer" : "";
        });

        // City labels — HTML markers with a red dot + small serif name plate.
        // Scale visibility by NE scalerank: rank 0-4 visible at all zooms,
        // 5-7 from zoom 5+, 8+ only when zoomed in further.
        const MAX_RANK_BY_ZOOM: Array<[number, number]> = [
          [0, 4],
          [5, 7],
          [7, 9],
          [10, 12],
        ];
        const cityMarkers: maplibregl.Marker[] = [];
        if (cities && cities.length > 0) {
          for (const c of cities) {
            const el = document.createElement("div");
            el.className = "travels-city-marker";
            el.dataset.rank = String(c.rank);
            const dot = document.createElement("span");
            dot.className = "travels-city-dot";
            const label = document.createElement("span");
            label.className = "travels-city-label";
            label.textContent = c.name;
            el.appendChild(dot);
            el.appendChild(label);
            const marker = new maplibregl.Marker({ element: el, anchor: "left" })
              .setLngLat([c.lng, c.lat])
              .addTo(map);
            cityMarkers.push(marker);
          }
          const updateCityVisibility = () => {
            const z = map.getZoom();
            let threshold = 4;
            for (const [minZ, rank] of MAX_RANK_BY_ZOOM) if (z >= minZ) threshold = rank;
            for (const m of cityMarkers) {
              const el = m.getElement();
              const r = Number(el.dataset.rank ?? 99);
              el.style.display = r <= threshold ? "" : "none";
            }
          };
          updateCityVisibility();
          map.on("zoomend", updateCityVisibility);
        }

        if (bbox && Number.isFinite(bbox[0])) {
          map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], {
            padding: 60,
            maxZoom: 9,
            animate: false,
          });
        }
        map.resize();
      } catch (err) {
        setStatus(`layer add failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    const onFlyTo = (e: Event) => {
      const ce = e as CustomEvent<{ bbox: [number, number, number, number] }>;
      const b = ce.detail?.bbox;
      if (!b) return;
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 120, maxZoom: 11, duration: 700 });
    };
    window.addEventListener("travels:fly-to", onFlyTo);

    const t = setTimeout(() => map.resize(), 150);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("travels:fly-to", onFlyTo);
      map.remove();
      mapRef.current = null;
    };
  }, [geojson, bbox, mapKey, stadiaKey]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 8,
          border: "1px solid rgba(18,18,18,0.85)",
          boxShadow:
            "0 0 0 1px var(--paper) inset, 0 0 0 4px rgba(18,18,18,0.15) inset, 0 2px 14px rgba(18,18,18,0.12)",
        }}
      />

      <div className="absolute bottom-3 left-3 pointer-events-none text-xs ink-muted bg-[rgba(246,241,230,0.9)] px-2 py-1 border border-[rgba(18,18,18,0.15)]">
        click near a red region or a state chip to zoom in · drag to pan · scroll to zoom
      </div>
      {status && (
        <div className="absolute top-20 right-4 text-xs font-mono break-all bg-[rgba(246,241,230,0.95)] px-2 py-1 max-w-md" style={{ color: "#b30000" }}>
          {status}
        </div>
      )}
    </>
  );
}

function geomBbox(feat: Feature): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visitPoint = (p: Position) => {
    const [x, y] = p;
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  };
  const g = feat.geometry;
  if (g.type === "Polygon") {
    for (const ring of g.coordinates) for (const p of ring) visitPoint(p);
  } else if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) for (const ring of poly) for (const p of ring) visitPoint(p);
  } else {
    return null;
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}
