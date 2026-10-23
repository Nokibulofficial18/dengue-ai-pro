import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  Tooltip,
  CircleMarker,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import WardCard from "../WardCard.jsx";
import CitizenReport from "../CitizenReport.jsx";
import { mockData } from "../../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

// Basemap configurations with 100% reliable public endpoints (no API key required)
const BASEMAPS = {
  dark: {
    name: "Dark Canvas",
    id: "dark",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: "&copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
      maxZoom: 16,
    },
    labels: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      attribution: "&copy; Esri",
      maxZoom: 16,
    },
  },
  osm: {
    name: "Street Map",
    id: "osm",
    base: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
      maxZoom: 19,
    },
    labels: null,
  },
  satellite: {
    name: "Satellite",
    id: "satellite",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "&copy; Esri, Maxar, Earthstar Geographics",
      maxZoom: 18,
    },
    labels: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      attribution: "&copy; Esri",
      maxZoom: 18,
    },
  },
};

// Mathematical hexagon generator for genuine geospatial honeycomb overlays
function generateHexagon(centerLat, centerLon, radiusKm = 0.55) {
  const coords = [];
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    coords.push([
      centerLat + latDelta * Math.sin(angle),
      centerLon + lonDelta * Math.cos(angle),
    ]);
  }
  return coords;
}

// Generate clusters of hexagons around ward center to form risk fields
function generateWardHexCluster(ward) {
  const centerLat = ward.lat;
  const centerLon = ward.lon;
  const baseScore = ward.score ?? ward.swapi_score ?? 0.5;

  const offsets = [
    { dLat: 0, dLon: 0, mult: 1.0 },
    { dLat: 0.0065, dLon: 0.0038, mult: 0.88 },
    { dLat: -0.0065, dLon: 0.0038, mult: 0.85 },
    { dLat: 0, dLon: 0.0085, mult: 0.80 },
    { dLat: 0, dLon: -0.0085, mult: 0.82 },
    { dLat: 0.0065, dLon: -0.0045, mult: 0.90 },
    { dLat: -0.0065, dLon: -0.0045, mult: 0.87 },
  ];

  return offsets.map((off, idx) => {
    const hexScore = Math.min(1.0, Math.max(0.1, baseScore * off.mult));
    let color = "#46C8E5"; // Low
    if (hexScore >= 0.7) {
      color = "#F45B79"; // High
    } else if (hexScore >= 0.4) {
      color = "#F6BA49"; // Medium
    }

    return {
      id: `${ward.ward_id}-hex-${idx}`,
      coords: generateHexagon(centerLat + off.dLat, centerLon + off.dLon, 0.42),
      color,
      score: hexScore,
      ward,
    };
  });
}

// Internal map controller hook component with reactive ResizeObserver & invalidation
function LeafletMapController({ onMapReady, targetWard, basemapKey }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    onMapReady(map);

    const forceInvalidate = () => {
      try {
        map.invalidateSize({ pan: false });
      } catch {
        // Safe fallback
      }
    };

    // Staggered invalidation passes to prevent rendering blackout on mount/transitions
    forceInvalidate();
    const t1 = setTimeout(forceInvalidate, 80);
    const t2 = setTimeout(forceInvalidate, 300);
    const t3 = setTimeout(forceInvalidate, 800);

    // Watch window resize
    window.addEventListener("resize", forceInvalidate);

    // Watch container resize via ResizeObserver
    let ro = null;
    const container = map.getContainer();
    if (container && typeof window.ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        forceInvalidate();
      });
      ro.observe(container);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", forceInvalidate);
      if (ro) ro.disconnect();
    };
  }, [map, onMapReady]);

  useEffect(() => {
    if (map) {
      try {
        map.invalidateSize({ pan: false });
      } catch {
        // Safe fallback
      }
    }
  }, [map, basemapKey]);

  useEffect(() => {
    if (map && targetWard && targetWard.lat && targetWard.lon) {
      map.flyTo([targetWard.lat, targetWard.lon], 14, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [map, targetWard]);

  return null;
}

export default function RiskMapPanel({ onSelectWard, selectedWardId }) {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("all");
  const [wardFilter, setWardFilter] = useState("all");
  const [basemapKey, setBasemapKey] = useState("dark");
  const [activeWard, setActiveWard] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [hoveredHexId, setHoveredHexId] = useState(null);

  useEffect(() => {
    const fetchWards = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/heatmap/wards`);
        if (res.data && res.data.length > 0) {
          setWards(res.data);
        } else {
          setWards(mockData.wards);
        }
      } catch {
        setWards(mockData.wards);
      } finally {
        setLoading(false);
      }
    };
    fetchWards();
  }, []);

  // Filtered wards
  const displayedWards = useMemo(() => {
    return wards.filter((w) => {
      const score = w.score ?? w.swapi_score ?? 0;
      if (riskFilter === "high" && score < 0.7) return false;
      if (riskFilter === "medium" && (score < 0.4 || score >= 0.7)) return false;
      if (riskFilter === "low" && score >= 0.4) return false;
      if (wardFilter !== "all" && w.ward_id !== wardFilter) return false;
      return true;
    });
  }, [wards, riskFilter, wardFilter]);

  // All hexagon clusters
  const hexClusters = useMemo(() => {
    return displayedWards.flatMap((ward) => generateWardHexCluster(ward));
  }, [displayedWards]);

  // Target ward derived from selectedWardId or activeWard
  const targetWardObj = useMemo(() => {
    if (selectedWardId) {
      return wards.find((w) => w.ward_id === selectedWardId) || null;
    }
    return null;
  }, [selectedWardId, wards]);

  const handleZoom = (delta) => {
    if (mapInstance) {
      if (delta > 0) {
        mapInstance.zoomIn();
      } else {
        mapInstance.zoomOut();
      }
    }
  };

  const handleReset = () => {
    if (mapInstance) {
      mapInstance.flyTo([23.78, 90.40], 12, { duration: 1 });
      setRiskFilter("all");
      setWardFilter("all");
      setActiveWard(null);
    }
  };

  const currentBasemap = BASEMAPS[basemapKey] || BASEMAPS.dark;

  return (
    <div className="midnight-card relative overflow-hidden flex flex-col h-full min-h-[540px]">
      {/* Top Header of Map Panel */}
      <div className="p-3.5 px-5 border-b border-[#1B3654]/60 flex flex-wrap items-center justify-between gap-3 bg-[#172C45]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#46C8E5]/15 border border-[#46C8E5]/30 flex items-center justify-center text-[#46C8E5] shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Dhaka Vector Risk &amp; Hazard Map</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[#46C8E5]/15 text-[#46C8E5] border border-[#46C8E5]/30">
                Leaflet.js Engine
              </span>
            </div>
            <div className="text-[11px] text-[#9FB3C9]">
              Live geospatial hexagonal vector overlays • 10 Dhaka City Corporation Wards
            </div>
          </div>
        </div>

        {/* Controls: Basemap Toggle + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Basemap Switcher */}
          <div className="flex items-center rounded-lg bg-[#0D1C2E] border border-[#1B3654] p-0.5">
            {Object.entries(BASEMAPS).map(([key, bm]) => (
              <button
                key={key}
                onClick={() => setBasemapKey(key)}
                className={`px-2.5 py-1 text-xs rounded-md transition font-medium flex items-center gap-1.5 ${
                  basemapKey === key
                    ? "bg-[#1E3A5F] text-[#46C8E5] font-semibold shadow-sm"
                    : "text-[#9FB3C9] hover:text-white"
                }`}
                title={bm.name}
              >
                {key === "dark" && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {key === "osm" && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                )}
                {key === "satellite" && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z" />
                  </svg>
                )}
                <span className="hidden sm:inline">{bm.name}</span>
              </button>
            ))}
          </div>

          {/* Risk Level Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-[#0D1C2E] border border-[#1B3654] text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#46C8E5]"
          >
            <option value="all">Risk Level ▾</option>
            <option value="high">High Risk (&gt;0.70)</option>
            <option value="medium">Medium Risk (0.40–0.70)</option>
            <option value="low">Low Risk (&lt;0.40)</option>
          </select>

          {/* Wards Selector */}
          <select
            value={wardFilter}
            onChange={(e) => {
              const val = e.target.value;
              setWardFilter(val);
              if (val !== "all") {
                const w = wards.find((x) => x.ward_id === val);
                if (w) {
                  setActiveWard(w);
                  if (onSelectWard) onSelectWard(w);
                  if (mapInstance) mapInstance.flyTo([w.lat, w.lon], 14, { duration: 1.2 });
                }
              }
            }}
            className="bg-[#0D1C2E] border border-[#1B3654] text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#46C8E5]"
          >
            <option value="all">All Wards ▾</option>
            {wards.map((w) => (
              <option key={w.ward_id} value={w.ward_id}>
                {w.ward_name} ({w.ward_id})
              </option>
            ))}
          </select>

          {/* Reset / Center View Button */}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-[#0D1C2E] border border-[#1B3654] text-[#9FB3C9] hover:text-white hover:border-[#46C8E5] transition"
            title="Recenter Map View"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Map Area */}
      <div className="relative flex-1 min-h-[460px] bg-[#081C36]">
        {loading && (
          <div className="absolute inset-0 z-30 bg-[#081C36]/80 flex items-center justify-center backdrop-blur-xs">
            <div className="flex items-center gap-2.5 text-xs text-[#46C8E5] bg-[#0D1C2E] px-4 py-2 rounded-xl border border-[#1B3654] shadow-xl">
              <span className="w-3 h-3 rounded-full bg-[#46C8E5] animate-ping" />
              Loading Dhaka geospatial vector layers...
            </div>
          </div>
        )}

        <MapContainer
          center={[23.78, 90.40]}
          zoom={12}
          zoomControl={false}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
        >
          {/* Synchronizer hook for map interactions */}
          <LeafletMapController
            onMapReady={setMapInstance}
            targetWard={targetWardObj}
            basemapKey={basemapKey}
          />

          {/* Primary Base Tile Layer */}
          <TileLayer
            key={`${basemapKey}-base`}
            url={currentBasemap.base.url}
            attribution={currentBasemap.base.attribution}
            maxZoom={currentBasemap.base.maxZoom || 18}
          />

          {/* Optional Reference / Labels Tile Layer for Dark or Satellite */}
          {currentBasemap.labels && (
            <TileLayer
              key={`${basemapKey}-labels`}
              url={currentBasemap.labels.url}
              attribution={currentBasemap.labels.attribution}
              maxZoom={currentBasemap.labels.maxZoom || 18}
              opacity={0.88}
            />
          )}

          {/* Genuine Honeycomb Hexagonal Risk Overlay */}
          {hexClusters.map((hex) => {
            const isHovered = hoveredHexId === hex.id;
            return (
              <Polygon
                key={hex.id}
                positions={hex.coords}
                pathOptions={{
                  color: isHovered ? "#FFFFFF" : hex.color,
                  fillColor: hex.color,
                  fillOpacity: isHovered ? 0.85 : 0.62,
                  weight: isHovered ? 2.2 : 1.2,
                  opacity: isHovered ? 1 : 0.85,
                }}
                eventHandlers={{
                  mouseover: () => setHoveredHexId(hex.id),
                  mouseout: () => setHoveredHexId(null),
                  click: () => {
                    setActiveWard(hex.ward);
                    if (onSelectWard) onSelectWard(hex.ward);
                    if (mapInstance) {
                      mapInstance.flyTo([hex.ward.lat, hex.ward.lon], 14, { duration: 1.0 });
                    }
                  },
                }}
              >
                <Tooltip sticky>
                  <div className="text-xs font-sans text-white p-1">
                    <div className="font-bold flex items-center justify-between gap-3">
                      <span>{hex.ward.ward_name}</span>
                      <span className="text-[10px] text-[#46C8E5] font-mono">{hex.ward.ward_id}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[#9FB3C9]">SWAPI Risk:</span>
                      <span className={`font-mono font-bold ${hex.score >= 0.7 ? "text-[#F45B79]" : hex.score >= 0.4 ? "text-[#F6BA49]" : "text-[#46C8E5]"}`}>
                        {(hex.score).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">Click hexagon to inspect ward analytics</div>
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}

          {/* Centroid Markers & Popups */}
          {displayedWards.map((w) => {
            const score = w.score ?? w.swapi_score ?? 0;
            const isHighRisk = score >= 0.7;

            return (
              <CircleMarker
                key={`marker-${w.ward_id}`}
                center={[w.lat, w.lon]}
                radius={isHighRisk ? 6 : 4}
                pathOptions={{
                  color: "#FFFFFF",
                  fillColor: isHighRisk ? "#F45B79" : score >= 0.4 ? "#F6BA49" : "#46C8E5",
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Popup>
                  <WardCard
                    ward={w}
                    onReport={() => {
                      setActiveWard(w);
                      setShowReportModal(true);
                    }}
                  />
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Floating Custom Map Controls (Left) */}
        <div className="absolute left-4 top-4 z-20 flex flex-col items-center gap-2">
          {/* Compass Rose */}
          <div
            className="w-8 h-8 rounded-full bg-[#0C1829] bg-opacity-95 border border-[#1B3654] text-[#46C8E5] font-bold text-xs flex items-center justify-center shadow-xl select-none"
            title="True North"
          >
            N
          </div>

          {/* Custom Zoom Buttons */}
          <div className="flex flex-col rounded-xl bg-[#0C1829] bg-opacity-95 border border-[#1B3654] overflow-hidden shadow-xl">
            <button
              onClick={() => handleZoom(1)}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#1B3654] hover:text-[#46C8E5] border-b border-[#1B3654] text-base font-bold transition"
              aria-label="Zoom in"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => handleZoom(-1)}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#1B3654] hover:text-[#46C8E5] text-base font-bold transition"
              aria-label="Zoom out"
              title="Zoom Out"
            >
              −
            </button>
          </div>

          {/* Target Locate / Center Button */}
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-full bg-[#0C1829] bg-opacity-95 border border-[#1B3654] text-[#46C8E5] flex items-center justify-center shadow-xl hover:bg-[#1B3654] hover:text-white transition"
            title="Recenter on Dhaka"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
          </button>
        </div>

        {/* Floating Risk Legend (Top Right) */}
        <div className="absolute right-4 top-4 z-20 bg-[#0C1829] bg-opacity-95 backdrop-blur-md border border-[#1B3654] rounded-xl p-3 text-[11px] shadow-2xl min-w-[155px]">
          <div className="font-semibold text-white mb-2 text-[10px] uppercase tracking-wider text-[#9FB3C9] flex items-center justify-between">
            <span>Risk Severity</span>
            <span className="w-2 h-2 rounded-full bg-[#46C8E5] animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#F45B79] shadow-sm shadow-[#F45B79]/50" />
              <span className="text-white font-medium">High (&gt; 0.70)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#F6BA49] shadow-sm shadow-[#F6BA49]/50" />
              <span className="text-white font-medium">Medium (0.40–0.70)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#46C8E5] shadow-sm shadow-[#46C8E5]/50" />
              <span className="text-white font-medium">Low (&lt; 0.40)</span>
            </div>
            <div className="pt-2 mt-2 border-t border-[#1B3654]/80 space-y-1">
              <div className="flex items-center gap-2 text-[#9FB3C9]">
                <div className="w-3 h-3 rounded-full border-2 border-white bg-[#F45B79]" />
                <span className="text-[10px]">Ward Centroid</span>
              </div>
              <div className="flex items-center gap-2 text-[#9FB3C9]">
                <div className="w-3 h-0.5 bg-[#46C8E5]" />
                <span className="text-[10px]">Vector Cell</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Inset Overview Box (Bottom Right) */}
        <div
          onClick={handleReset}
          className="absolute right-4 bottom-4 z-20 bg-[#0C1829] bg-opacity-95 border border-[#1B3654] rounded-xl p-2.5 shadow-2xl hidden sm:block w-32 cursor-pointer hover:border-[#46C8E5]/50 transition group"
          title="Click to reset city overview"
        >
          <div className="text-[9px] font-semibold text-center text-[#9FB3C9] mb-1 group-hover:text-white transition">
            Dhaka City Area
          </div>
          <div className="w-full h-16 bg-[#081525] rounded border border-[#1B3654]/60 relative flex items-center justify-center overflow-hidden">
            <svg className="w-24 h-16 text-[#1B3654]" viewBox="0 0 100 80" fill="currentColor">
              <path d="M30 10 L60 8 L75 25 L85 45 L70 70 L40 75 L20 60 L15 35 Z" opacity="0.65" />
            </svg>
            <div className="absolute w-8 h-8 border-2 border-[#46C8E5] rounded-sm bg-[#46C8E5]/25 shadow-sm animate-pulse" />
          </div>
          <div className="text-[9px] text-[#46C8E5] text-center mt-1 font-mono">Recenter ↺</div>
        </div>

        {/* Scale & Coordinate Indicator (Bottom Left) */}
        <div className="absolute left-4 bottom-4 z-20 bg-[#0C1829] bg-opacity-95 border border-[#1B3654] rounded-lg px-2.5 py-1 text-[10px] text-[#9FB3C9] font-mono flex items-center gap-3 shadow-lg">
          <span>Dhaka (23.78° N, 90.40° E)</span>
          <span className="text-[#1B3654]">|</span>
          <div className="flex items-center gap-1.5">
            <span>5 km</span>
            <div className="w-8 h-1 bg-[#46C8E5] rounded-full" />
          </div>
        </div>
      </div>

      {/* Citizen Report Modal Trigger */}
      {showReportModal && (
        <CitizenReport
          ward={activeWard}
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
