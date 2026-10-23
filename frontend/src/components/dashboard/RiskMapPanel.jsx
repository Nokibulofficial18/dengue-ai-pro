import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  Tooltip,
  CircleMarker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import WardCard from "../WardCard.jsx";
import CitizenReport from "../CitizenReport.jsx";
import { mockData } from "../../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

// Mathematical hexagon generator for genuine geospatial honeycomb overlays
function generateHexagon(centerLat, centerLon, radiusKm = 0.6) {
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

  // Offsets for 7 adjacent hexagons (center + 6 neighbors)
  const offsets = [
    { dLat: 0, dLon: 0, mult: 1.0 },
    { dLat: 0.007, dLon: 0.004, mult: 0.88 },
    { dLat: -0.007, dLon: 0.004, mult: 0.85 },
    { dLat: 0, dLon: 0.009, mult: 0.80 },
    { dLat: 0, dLon: -0.009, mult: 0.82 },
    { dLat: 0.007, dLon: -0.005, mult: 0.90 },
    { dLat: -0.007, dLon: -0.005, mult: 0.87 },
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
      coords: generateHexagon(centerLat + off.dLat, centerLon + off.dLon, 0.45),
      color,
      score: hexScore,
      ward,
    };
  });
}

export default function RiskMapPanel({ onSelectWard, selectedWardId }) {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("all");
  const [wardFilter, setWardFilter] = useState("all");
  const [activeWard, setActiveWard] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);

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

  // Zoom to ward if selected
  useEffect(() => {
    if (selectedWardId && mapInstance) {
      const target = wards.find((w) => w.ward_id === selectedWardId);
      if (target) {
        mapInstance.flyTo([target.lat, target.lon], 13.5, { duration: 1.2 });
        setActiveWard(target);
      }
    }
  }, [selectedWardId, mapInstance, wards]);

  const handleZoom = (delta) => {
    if (mapInstance) {
      mapInstance.setZoom(mapInstance.getZoom() + delta);
    }
  };

  const handleReset = () => {
    if (mapInstance) {
      mapInstance.flyTo([23.78, 90.40], 12, { duration: 1 });
      setRiskFilter("all");
      setWardFilter("all");
    }
  };

  return (
    <div className="midnight-card relative overflow-hidden flex flex-col h-full min-h-[540px]">
      {/* Top Header of Map Panel */}
      <div className="p-4 px-5 border-b border-[#1B3654]/60 flex flex-wrap items-center justify-between gap-3 bg-[#172C45]/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#46C8E5]/15 border border-[#46C8E5]/30 flex items-center justify-center text-[#46C8E5]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              Dhaka Dengue Risk Map
            </div>
            <div className="text-[11px] text-[#9FB3C9]">
              Ward-level illustrative prediction • demo data
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          {/* Risk Filter */}
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
              setWardFilter(e.target.value);
              if (e.target.value !== "all") {
                const w = wards.find((x) => x.ward_id === e.target.value);
                if (w && mapInstance) mapInstance.flyTo([w.lat, w.lon], 13.5);
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

          {/* Reset / Center Button */}
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-[#0D1C2E] border border-[#1B3654] text-[#9FB3C9] hover:text-white hover:border-[#46C8E5] transition"
            title="Reset view"
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
          <div className="absolute inset-0 z-30 bg-[#081C36]/80 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#46C8E5]">
              <span className="w-3 h-3 rounded-full bg-[#46C8E5] animate-ping" />
              Loading Dhaka geospatial vector layers...
            </div>
          </div>
        )}

        <MapContainer
          center={[23.78, 90.40]}
          zoom={12}
          zoomControl={false}
          className="h-full w-full z-0"
          whenCreated={setMapInstance}
        >
          {/* Dark Basemap Tile Layer */}
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Genuine Honeycomb Hexagonal Risk Overlay */}
          {hexClusters.map((hex) => (
            <Polygon
              key={hex.id}
              positions={hex.coords}
              pathOptions={{
                color: hex.color,
                fillColor: hex.color,
                fillOpacity: 0.62,
                weight: 1.2,
                opacity: 0.85,
              }}
              eventHandlers={{
                click: () => {
                  setActiveWard(hex.ward);
                  if (onSelectWard) onSelectWard(hex.ward);
                },
              }}
            >
              <Tooltip sticky>
                <div className="text-xs font-sans text-white">
                  <div className="font-bold">{hex.ward.ward_name}</div>
                  <div className="text-[10px] text-[#9FB3C9]">
                    SWAPI: {(hex.score).toFixed(2)}
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          ))}

          {/* Centroid Markers & Popups */}
          {displayedWards.map((w) => (
            <CircleMarker
              key={`marker-${w.ward_id}`}
              center={[w.lat, w.lon]}
              radius={3}
              pathOptions={{
                color: "#FFFFFF",
                fillColor: (w.score ?? w.swapi_score ?? 0) >= 0.7 ? "#F45B79" : "#46C8E5",
                fillOpacity: 1,
                weight: 1.5,
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
          ))}
        </MapContainer>

        {/* Floating Custom Map Controls (Left) matching reference screenshot */}
        <div className="absolute left-4 top-4 z-20 flex flex-col items-center gap-2">
          {/* Compass Rose */}
          <div className="w-8 h-8 rounded-full bg-[#0C1829]/90 border border-[#1B3654] text-[#46C8E5] font-bold text-xs flex items-center justify-center shadow-lg">
            N
          </div>
          {/* Zoom Buttons */}
          <div className="flex flex-col rounded-xl bg-[#0C1829]/90 border border-[#1B3654] overflow-hidden shadow-lg">
            <button
              onClick={() => handleZoom(1)}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#1B3654] border-b border-[#1B3654] text-sm font-bold"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => handleZoom(-1)}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-[#1B3654] text-sm font-bold"
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
          {/* Target Locate Button */}
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-full bg-[#0C1829]/90 border border-[#1B3654] text-[#46C8E5] flex items-center justify-center shadow-lg hover:bg-[#1B3654]"
            title="Recenter"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
            </svg>
          </button>
        </div>

        {/* Floating Risk Legend (Top Right) matching screenshot */}
        <div className="absolute right-4 top-4 z-20 bg-[#0C1829]/92 backdrop-blur-md border border-[#1B3654] rounded-xl p-3 text-[11px] shadow-2xl min-w-[150px]">
          <div className="font-semibold text-white mb-2 text-[10px] uppercase tracking-wider text-[#9FB3C9]">
            Risk Level (Illustrative)
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F45B79] shadow-sm shadow-[#F45B79]/50" />
              <span className="text-white font-medium">High Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F6BA49] shadow-sm shadow-[#F6BA49]/50" />
              <span className="text-white font-medium">Medium Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#46C8E5] shadow-sm shadow-[#46C8E5]/50" />
              <span className="text-white font-medium">Low Risk</span>
            </div>
            <div className="pt-1.5 mt-1.5 border-t border-[#1B3654]/80 space-y-1">
              <div className="flex items-center gap-2 text-[#9FB3C9]">
                <div className="w-3.5 h-0.5 bg-[#46C8E5]" />
                <span className="text-[10px]">Ward Boundary</span>
              </div>
              <div className="flex items-center gap-2 text-[#9FB3C9]">
                <div className="w-3.5 h-0.5 bg-white/60" />
                <span className="text-[10px]">Major Road</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Inset Overview Box (Bottom Right) matching screenshot */}
        <div className="absolute right-4 bottom-4 z-20 bg-[#0C1829]/90 border border-[#1B3654] rounded-xl p-2 shadow-2xl hidden sm:block w-28">
          <div className="text-[9px] font-semibold text-center text-[#9FB3C9] mb-1">Dhaka City</div>
          <div className="w-full h-16 bg-[#081525] rounded border border-[#1B3654]/40 relative flex items-center justify-center">
            {/* Silhouette of Dhaka shape */}
            <svg className="w-20 h-14 text-[#1B3654]" viewBox="0 0 100 80" fill="currentColor">
              <path d="M30 10 L60 8 L75 25 L85 45 L70 70 L40 75 L20 60 L15 35 Z" opacity="0.6" />
            </svg>
            {/* Red viewport focal rectangle */}
            <div className="absolute w-6 h-6 border-2 border-[#F45B79] rounded-sm bg-[#F45B79]/20" />
          </div>
        </div>

        {/* Scale indicator (Bottom Left) */}
        <div className="absolute left-4 bottom-4 z-20 bg-[#0C1829]/80 border border-[#1B3654] rounded px-2.5 py-1 text-[10px] text-[#9FB3C9] font-mono flex items-center gap-3">
          <span>0</span>
          <span>2.5</span>
          <span>5 km</span>
          <div className="w-12 h-1 bg-white/40 rounded-full" />
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
