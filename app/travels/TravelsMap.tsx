"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, Position } from "geojson";
import PhotoModal, { type PhotoLite } from "./PhotoModal";

const DEFAULT_COUNTRY = "United States of America";

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
  photos?: PhotoLite[];
  // ISO date string. Features with addedOn === this date are rendered in a
  // brighter "fresh" red so the user can see what changed in the latest run.
  generatedAt?: string;
}

export default function TravelsMap({ geojson, bbox, mapKey, stadiaKey, cities, states, visitedStates, visitedCountries, photos, generatedAt }: Props) {
  const generatedDate = (generatedAt ?? "").slice(0, 10);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<string>("");
  const [hover, setHover] = useState<{
    x: number; y: number; blocks: number; where: string;
  } | null>(null);
  const [projection, setProjection] = useState<"mercator" | "globe">("mercator");
  const [statePopup, setStatePopup] = useState<{
    x: number; y: number; name: string; blocks: number; bbox: [number, number, number, number]; photos: PhotoLite[];
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layers, setLayers] = useState({
    fog: true,
    states: true,
    countries: true,
    cities: true,
    photos: true,
  });
  const [photoView, setPhotoView] = useState<{
    list: PhotoLite[];
    index: number;
  } | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>(DEFAULT_COUNTRY);
  // Track latest selectedCountry inside the map-init closure (which runs once
  // and captures stale state otherwise).
  const selectedCountryRef = useRef(selectedCountry);
  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
  }, [selectedCountry]);

  const visitedCountryNames = useMemo(() => {
    const names = (visitedCountries ?? [])
      .map((f) => (f.properties as { name?: string })?.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    return Array.from(new Set(names)).sort();
  }, [visitedCountries]);

  // If the default country has no data yet (e.g. only Korea is populated),
  // fall back to the first visited country so the states view isn't empty.
  useEffect(() => {
    if (visitedCountryNames.length === 0) return;
    if (visitedCountryNames.includes(selectedCountry)) return;
    setSelectedCountry(visitedCountryNames[0]);
  }, [visitedCountryNames, selectedCountry]);

  const openPhoto = (list: PhotoLite[], index: number) => {
    const p = list[index];
    if (!p) return;
    setPhotoView({ list, index });
    const m = mapRef.current;
    if (m) {
      const targetZoom = Math.max(m.getZoom(), 10);
      m.easeTo({ center: [p.lng, p.lat], zoom: targetZoom, duration: 600 });
    }
  };

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
    map.on("error", (e) => {
      // MapLibre cancels in-flight tile fetches when the viewport changes
      // quickly; those surface here as "Failed to fetch" AJAXErrors with
      // status 0. They're not actionable, so swallow them.
      const msg = e.error?.message ?? "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (e.error as any)?.status;
      if (status === 0 || /failed to fetch/i.test(msg) || /aborted/i.test(msg)) return;
      setStatus(`map error: ${msg || "unknown"}`);
    });
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
            paint: {
              "fill-color": [
                "case",
                ["==", ["get", "addedOn"], generatedDate],
                "#ff3838",
                "#b30000",
              ],
              "fill-opacity": [
                "case",
                ["==", ["get", "addedOn"], generatedDate],
                0.18,
                0.04,
              ],
            },
          });
          map.addLayer({
            id: "visited-countries-outline",
            type: "line",
            source: "visited-countries",
            paint: {
              "line-color": "#121212",
              "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 4, 1.2, 8, 1.6],
              "line-opacity": 0.55,
            },
          });
          // Click a country to swap which country's states are rendered.
          // Clicks on an already-selected country are no-ops; a different
          // country switches the state-level view.
          map.on("click", "visited-countries-fill", (ev) => {
            const f = ev.features?.[0];
            if (!f) return;
            const name = (f.properties as { name?: string })?.name;
            if (name && name !== selectedCountryRef.current) {
              setSelectedCountry(name);
            }
          });
        }
        if (visitedStates && visitedStates.length) {
          map.addSource("visited-states", {
            type: "geojson",
            data: { type: "FeatureCollection", features: visitedStates },
            promoteId: "name",
          });
          // Show only the selected country's states. Filter is updated by a
          // separate effect when selectedCountry changes.
          const countryFilter: maplibregl.FilterSpecification = [
            "==",
            ["get", "country"],
            selectedCountryRef.current,
          ];
          map.addLayer({
            id: "visited-states-fill",
            type: "fill",
            source: "visited-states",
            filter: countryFilter,
            paint: {
              "fill-color": [
                "case",
                ["==", ["get", "addedOn"], generatedDate],
                "#ff3838",
                "#b30000",
              ],
              "fill-opacity": [
                "case",
                ["==", ["get", "addedOn"], generatedDate],
                ["case", ["boolean", ["feature-state", "hover"], false], 0.42, 0.28],
                ["case", ["boolean", ["feature-state", "hover"], false], 0.18, 0.06],
              ],
            },
          });
          map.addLayer({
            id: "visited-states-outline",
            type: "line",
            source: "visited-states",
            filter: countryFilter,
            paint: {
              "line-color": "#121212",
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                3,
                1.4,
              ],
              "line-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                1,
                0.7,
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
            if (!props.name) return;
            // queryRenderedFeatures clips geometry to the viewport, so use
            // the original feature from the prop list for an accurate bbox.
            const originalFeat = (visitedStates ?? []).find(
              (s) => (s.properties as { name?: string })?.name === props.name,
            ) as Feature | undefined;
            const fb = geomBbox((originalFeat ?? (f as Feature)) as Feature);
            if (!fb) return;
            const photosInState = (photos ?? []).filter(
              (p) =>
                p.lng >= fb[0] && p.lng <= fb[2] && p.lat >= fb[1] && p.lat <= fb[3],
            );
            setStatePopup({
              x: ev.point.x,
              y: ev.point.y,
              name: props.name,
              blocks: Number(props.blocks ?? 0),
              bbox: fb,
              photos: photosInState,
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

        // Alma mater pin — Colgate University (Hamilton, NY). Custom badge
        // in Colgate maroon with a serif "Colgate" label; click flies there.
        {
          const COLGATE = { lng: -75.5337, lat: 42.8189, label: "Colgate" };
          const el = document.createElement("div");
          el.className = "travels-almamater";
          el.title = "Colgate University — alma mater";
          const badge = document.createElement("span");
          badge.className = "travels-almamater-badge";
          badge.textContent = "C";
          const label = document.createElement("span");
          label.className = "travels-almamater-label";
          label.textContent = COLGATE.label;
          el.appendChild(badge);
          el.appendChild(label);
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            map.easeTo({ center: [COLGATE.lng, COLGATE.lat], zoom: 14, duration: 700 });
          });
          new maplibregl.Marker({ element: el, anchor: "left" })
            .setLngLat([COLGATE.lng, COLGATE.lat])
            .addTo(map);
        }

        // Photo markers — one HTML dot per geotagged photo. Click opens the
        // lightbox (<PhotoModal>). Marker size scales with zoom via a CSS
        // custom property so a 12 px dot doesn't cover a whole state at
        // continental view.
        const photoMarkers: maplibregl.Marker[] = [];
        if (photos && photos.length > 0) {
          for (let i = 0; i < photos.length; i++) {
            const p = photos[i];
            const el = document.createElement("div");
            el.className = "travels-photo-marker";
            el.title = p.caption ?? "";
            el.addEventListener("click", (ev) => {
              ev.stopPropagation();
              openPhoto(photos, i);
            });
            photoMarkers.push(
              new maplibregl.Marker({ element: el, anchor: "center" })
                .setLngLat([p.lng, p.lat])
                .addTo(map),
            );
          }
          const updatePhotoScale = () => {
            const z = map.getZoom();
            // z=2 → 0.4 (tiny), z=6 → 0.65, z=10 → 0.9, z=14 → 1.1
            const scale = Math.max(0.4, Math.min(1.2, 0.35 + (z - 1) * 0.065));
            map.getContainer().style.setProperty("--photo-marker-scale", String(scale));
          };
          updatePhotoScale();
          map.on("zoom", updatePhotoScale);
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
    // Intentionally only depends on map config: rebuilding the map on every
    // data change (e.g. timelapse frames) would tear down the camera and
    // markers. Data is fed in via the source-update effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, stadiaKey]);

  // Push new data into the map's existing GeoJSON sources without rebuilding
  // the map, so timelapse / snapshot navigation stays smooth.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const explored = geojson.features.filter(
        (f) => (f.properties as { kind?: string })?.kind === "explored",
      );
      const fog = geojson.features.find(
        (f) => (f.properties as { kind?: string })?.kind === "fog",
      );
      const exploredSrc = map.getSource("explored") as maplibregl.GeoJSONSource | undefined;
      if (exploredSrc) {
        exploredSrc.setData({ type: "FeatureCollection", features: explored });
      }
      const fogSrc = map.getSource("fog") as maplibregl.GeoJSONSource | undefined;
      if (fogSrc && fog) {
        fogSrc.setData({ type: "FeatureCollection", features: [fog] });
      }
      const statesSrc = map.getSource("visited-states") as maplibregl.GeoJSONSource | undefined;
      if (statesSrc && visitedStates) {
        statesSrc.setData({ type: "FeatureCollection", features: visitedStates });
      }
      const countriesSrc = map.getSource("visited-countries") as maplibregl.GeoJSONSource | undefined;
      if (countriesSrc && visitedCountries) {
        countriesSrc.setData({ type: "FeatureCollection", features: visitedCountries });
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [geojson, visitedStates, visitedCountries]);

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
      // HTML markers aren't MapLibre layers; hide via CSS custom properties.
      const root = map.getContainer();
      root.style.setProperty("--cities-display", layers.cities ? "flex" : "none");
      root.style.setProperty("--photos-display", layers.photos ? "block" : "none");
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [layers]);

  // Sync state-layer filter to selectedCountry.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const filter: maplibregl.FilterSpecification = [
      "==",
      ["get", "country"],
      selectedCountry,
    ];
    const apply = () => {
      if (map.getLayer("visited-states-fill")) map.setFilter("visited-states-fill", filter);
      if (map.getLayer("visited-states-outline")) map.setFilter("visited-states-outline", filter);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [selectedCountry]);

  // Repaint fresh-region highlights when the snapshot date changes (timelapse).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer("visited-states-fill")) {
        map.setPaintProperty("visited-states-fill", "fill-color", [
          "case",
          ["==", ["get", "addedOn"], generatedDate],
          "#ff3838",
          "#b30000",
        ]);
        map.setPaintProperty("visited-states-fill", "fill-opacity", [
          "case",
          ["==", ["get", "addedOn"], generatedDate],
          ["case", ["boolean", ["feature-state", "hover"], false], 0.42, 0.28],
          ["case", ["boolean", ["feature-state", "hover"], false], 0.18, 0.06],
        ]);
      }
      if (map.getLayer("visited-countries-fill")) {
        map.setPaintProperty("visited-countries-fill", "fill-color", [
          "case",
          ["==", ["get", "addedOn"], generatedDate],
          "#ff3838",
          "#b30000",
        ]);
        map.setPaintProperty("visited-countries-fill", "fill-opacity", [
          "case",
          ["==", ["get", "addedOn"], generatedDate],
          0.18,
          0.04,
        ]);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [generatedDate]);

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
          className="absolute text-xs bg-[rgba(246,241,230,0.97)] px-3 py-2 border border-[rgba(18,18,18,0.5)] shadow-md leading-5 overflow-y-auto"
          style={(() => {
            const POPUP_W = 320;
            const POPUP_H = 400;
            const el = mapRef.current?.getContainer();
            const w = el?.clientWidth ?? 9999;
            const h = el?.clientHeight ?? 9999;
            const left = Math.max(0, Math.min(statePopup.x + 16, w - POPUP_W));
            const top = Math.max(0, Math.min(statePopup.y + 16, h - POPUP_H));
            return { left, top, minWidth: 200, maxWidth: POPUP_W, maxHeight: POPUP_H };
          })()}
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
          {statePopup.photos.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider ink-muted mb-1">
                {statePopup.photos.length} photo{statePopup.photos.length === 1 ? "" : "s"}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {statePopup.photos.slice(0, 9).map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      openPhoto(statePopup.photos, i);
                      setStatePopup(null);
                    }}
                    className="relative block aspect-square overflow-hidden border border-[rgba(18,18,18,0.25)] hover:border-[var(--accent)] transition-colors"
                    title={p.caption ?? ""}
                  >
                    <img
                      src={`/api/travels/photos/${p.id}/thumb`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
              {statePopup.photos.length > 9 && (
                <div className="text-[10px] ink-muted mt-1">+ {statePopup.photos.length - 9} more</div>
              )}
            </div>
          )}
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
            {visitedCountryNames.length >= 2 && (
              <label className="flex flex-row items-center gap-2 mt-1 pt-1 border-t border-[rgba(18,18,18,0.15)]">
                <span className="ink-body">states for</span>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="bg-[rgba(246,241,230,0.9)] border border-[rgba(18,18,18,0.25)] px-1 py-[1px] text-xs ink-body"
                >
                  {visitedCountryNames.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 pointer-events-none text-xs ink-muted bg-[rgba(246,241,230,0.9)] px-2 py-1 border border-[rgba(18,18,18,0.15)]">
        click near a red region or a state chip to zoom in · drag to pan · scroll to zoom
      </div>

      {photoView && (
        <PhotoModal
          photo={photoView.list[photoView.index]}
          onClose={() => setPhotoView(null)}
          onPrev={
            photoView.list.length > 1
              ? () => {
                  const nextIndex = (photoView.index - 1 + photoView.list.length) % photoView.list.length;
                  openPhoto(photoView.list, nextIndex);
                }
              : undefined
          }
          onNext={
            photoView.list.length > 1
              ? () => {
                  const nextIndex = (photoView.index + 1) % photoView.list.length;
                  openPhoto(photoView.list, nextIndex);
                }
              : undefined
          }
          position={{ index: photoView.index, total: photoView.list.length }}
        />
      )}
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
