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

interface StateEntry {
  name: string;
  blocks: number;
  bbox: [number, number, number, number];
}

interface Props {
  geojson: FeatureCollection;
  bbox: [number, number, number, number] | null;
  mapKey: string;
  stadiaKey: string;
  cities?: CityEntry[];
  states?: StateEntry[];
  visitedStates?: Feature[];
  visitedCountries?: Feature[];
}

export default function TravelsMap({ geojson, bbox, mapKey, stadiaKey, cities, states, visitedStates, visitedCountries }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<string>("");
  const [hover, setHover] = useState<{
    x: number; y: number; blocks: number; where: string;
  } | null>(null);
  const [projection, setProjection] = useState<"mercator" | "globe">("mercator");
  const [statePopup, setStatePopup] = useState<{
    x: number; y: number; name: string; blocks: number; bbox: [number, number, number, number];
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layers, setLayers] = useState({
    fog: true,
    states: true,
    countries: true,
    cities: true,
  });

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
        // Admin boundary layers for visited states/countries sit UNDER the
        // explored polygons so red regions remain visually dominant.
        if (visitedCountries && visitedCountries.length) {
          map.addSource("visited-countries", {
            type: "geojson",
            data: { type: "FeatureCollection", features: visitedCountries },
            promoteId: "name",
          });
          map.addLayer({
            id: "visited-countries-fill",
            type: "fill",
            source: "visited-countries",
            paint: { "fill-color": "#b30000", "fill-opacity": 0.04 },
          });
          map.addLayer({
            id: "visited-countries-outline",
            type: "line",
            source: "visited-countries",
            paint: {
              "line-color": "#121212",
              "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 4, 0.8, 8, 1.0],
              "line-opacity": 0.4,
            },
          });
        }
        if (visitedStates && visitedStates.length) {
          map.addSource("visited-states", {
            type: "geojson",
            data: { type: "FeatureCollection", features: visitedStates },
            promoteId: "name",
          });
          map.addLayer({
            id: "visited-states-fill",
            type: "fill",
            source: "visited-states",
            paint: {
              "fill-color": "#b30000",
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.18,
                0.06,
              ],
            },
          });
          map.addLayer({
            id: "visited-states-outline",
            type: "line",
            source: "visited-states",
            paint: {
              "line-color": "#121212",
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                2.2,
                0.8,
              ],
              "line-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.9,
                0.45,
              ],
            },
          });
          // Hover lift + click-for-stats wiring.
          let hoveredStateId: string | number | null = null;
          map.on("mousemove", "visited-states-fill", (ev) => {
            const f = ev.features?.[0];
            if (!f || f.id === undefined) return;
            if (hoveredStateId !== null && hoveredStateId !== f.id) {
              map.setFeatureState({ source: "visited-states", id: hoveredStateId }, { hover: false });
            }
            hoveredStateId = f.id;
            map.setFeatureState({ source: "visited-states", id: hoveredStateId }, { hover: true });
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "visited-states-fill", () => {
            if (hoveredStateId !== null) {
              map.setFeatureState({ source: "visited-states", id: hoveredStateId }, { hover: false });
              hoveredStateId = null;
            }
            map.getCanvas().style.cursor = "";
          });
          map.on("click", "visited-states-fill", (ev) => {
            const f = ev.features?.[0];
            if (!f) return;
            const props = f.properties as { name?: string; blocks?: number };
            const fb = geomBbox(f as Feature);
            if (!props.name || !fb) return;
            setStatePopup({
              x: ev.point.x,
              y: ev.point.y,
              name: props.name,
              blocks: Number(props.blocks ?? 0),
              bbox: fb,
            });
          });
        }

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
            [[ev.point.x - 20, ev.point.y - 20], [ev.point.x + 20, ev.point.y + 20]],
            { layers: ["explored-fill"] },
          );
          map.getCanvas().style.cursor = near.length ? "pointer" : "";
          if (near.length) {
            let best = near[0];
            let bestDist = Infinity;
            let bestCenter: [number, number] = [0, 0];
            for (const h of near) {
              const b = geomBbox(h as Feature);
              if (!b) continue;
              const cx = (b[0] + b[2]) / 2;
              const cy = (b[1] + b[3]) / 2;
              const proj = map.project([cx, cy]);
              const d = (proj.x - ev.point.x) ** 2 + (proj.y - ev.point.y) ** 2;
              if (d < bestDist) { bestDist = d; best = h; bestCenter = [cx, cy]; }
            }
            const blocks = Number((best.properties as { blocks?: number })?.blocks ?? 0);
            const where = describeLocation(bestCenter, cities, states);
            setHover({ x: ev.point.x, y: ev.point.y, blocks, where });
          } else {
            setHover((prev) => (prev ? null : prev));
          }
        });
        map.on("mouseout", () => setHover(null));

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      try {
        map.setProjection({ type: projection });
      } catch (err) {
        console.warn("setProjection skipped:", err);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [projection]);

  // Sync layer visibility toggles with the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setVis = (id: string, visible: boolean) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    const apply = () => {
      setVis("fog-fill", layers.fog);
      setVis("visited-states-fill", layers.states);
      setVis("visited-states-outline", layers.states);
      setVis("visited-countries-fill", layers.countries);
      setVis("visited-countries-outline", layers.countries);
      // City HTML markers are not MapLibre layers; hide via CSS.
      const root = map.getContainer();
      root.style.setProperty("--cities-display", layers.cities ? "flex" : "none");
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [layers]);

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

      {hover && (
        <div
          className="absolute pointer-events-none text-[11px] font-mono bg-[rgba(246,241,230,0.95)] px-2 py-1 border border-[rgba(18,18,18,0.25)] leading-4 shadow-sm"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="text-[10px] ink-body font-semibold leading-3 mb-[2px]">{hover.where}</div>
          <div>
            <span className="text-[var(--accent)] font-semibold">{hover.blocks.toLocaleString()}</span>{" "}
            <span className="ink-muted">600&nbsp;m cells · ~{(hover.blocks * 0.36).toFixed(hover.blocks * 0.36 >= 100 ? 0 : 1)} km²</span>
          </div>
        </div>
      )}

      {statePopup && (
        <div
          className="absolute text-xs bg-[rgba(246,241,230,0.97)] px-3 py-2 border border-[rgba(18,18,18,0.5)] shadow-md leading-5"
          style={{ left: Math.min(statePopup.x + 16, 9999), top: statePopup.y + 16, minWidth: 180 }}
        >
          <div className="flex flex-row items-baseline justify-between gap-2">
            <div className="font-semibold ink-body text-sm">{statePopup.name}</div>
            <button
              type="button"
              onClick={() => setStatePopup(null)}
              className="ink-muted text-xs hover:text-[var(--accent)]"
              aria-label="close"
            >
              ✕
            </button>
          </div>
          <div className="mt-1 ink-muted">
            <span className="text-[var(--accent)] font-semibold">{statePopup.blocks.toLocaleString()}</span>{" "}
            cells · ~{(statePopup.blocks * 0.36).toFixed(statePopup.blocks * 0.36 >= 100 ? 0 : 1)} km²
          </div>
          <button
            type="button"
            onClick={() => {
              const m = mapRef.current;
              if (!m) return;
              m.fitBounds(
                [[statePopup.bbox[0], statePopup.bbox[1]], [statePopup.bbox[2], statePopup.bbox[3]]],
                { padding: 80, maxZoom: 10, duration: 700 },
              );
              setStatePopup(null);
            }}
            className="mt-2 text-[11px] px-2 py-[2px] border border-[rgba(18,18,18,0.4)] hover:bg-[var(--accent)] hover:text-[var(--paper)] hover:border-[var(--accent)] transition-colors"
          >
            zoom to
          </button>
        </div>
      )}

      <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
        <div className="flex flex-row gap-1">
          <button
            type="button"
            onClick={() => setProjection((p) => (p === "mercator" ? "globe" : "mercator"))}
            className="text-xs px-2 py-1 bg-[rgba(246,241,230,0.95)] border border-[rgba(18,18,18,0.25)] hover:bg-[var(--accent)] hover:text-[var(--paper)] transition-colors"
            title="toggle map projection"
          >
            {projection === "mercator" ? "globe" : "mercator"}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={`text-xs px-2 py-1 border border-[rgba(18,18,18,0.25)] transition-colors ${settingsOpen ? "bg-[var(--accent)] text-[var(--paper)]" : "bg-[rgba(246,241,230,0.95)] hover:bg-[var(--accent)] hover:text-[var(--paper)]"}`}
            title="layer settings"
            aria-expanded={settingsOpen}
          >
            layers
          </button>
        </div>
        {settingsOpen && (
          <div className="text-xs bg-[rgba(246,241,230,0.97)] px-3 py-2 border border-[rgba(18,18,18,0.4)] shadow-md flex flex-col gap-1">
            {(
              [
                ["fog", "fog overlay"],
                ["states", "state borders"],
                ["countries", "country borders"],
                ["cities", "city labels"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex flex-row items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={(e) => setLayers((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="accent-[var(--accent)]"
                />
                <span className="ink-body">{label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

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

// Haversine-ish distance in km.
function distKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function describeLocation(
  center: [number, number],
  cities: CityEntry[] | undefined,
  states: StateEntry[] | undefined,
): string {
  let state: StateEntry | null = null;
  if (states) {
    for (const s of states) {
      if (
        center[0] >= s.bbox[0] && center[0] <= s.bbox[2] &&
        center[1] >= s.bbox[1] && center[1] <= s.bbox[3]
      ) { state = s; break; }
    }
  }
  let nearest: { city: CityEntry; d: number } | null = null;
  if (cities && cities.length) {
    for (const c of cities) {
      const d = distKm(center, [c.lng, c.lat]);
      if (!nearest || d < nearest.d) nearest = { city: c, d };
    }
  }
  if (nearest && nearest.d <= 15) {
    return state ? `${nearest.city.name}, ${state.name}` : nearest.city.name;
  }
  if (nearest && nearest.d <= 60 && state) return `near ${nearest.city.name} · ${state.name}`;
  if (nearest && nearest.d <= 60) return `near ${nearest.city.name}`;
  if (state) return state.name;
  const lngDir = center[0] >= 0 ? "E" : "W";
  const latDir = center[1] >= 0 ? "N" : "S";
  return `${Math.abs(center[1]).toFixed(2)}°${latDir} ${Math.abs(center[0]).toFixed(2)}°${lngDir}`;
}
