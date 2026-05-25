import { useEffect, useState } from "react";
import axios from "axios";
import {
  MapContainer,
  Popup,
  Rectangle,
  ScaleControl,
  TileLayer,
  Tooltip,
  ZoomControl,
} from "react-leaflet";

import WardCard from "./WardCard.jsx";
import CitizenReport from "./CitizenReport.jsx";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 rounded-lg bg-[#1A2E4A] p-3 text-xs shadow-lg">
      <div className="font-semibold mb-2">Risk Legend</div>
      <div className="flex items-center gap-2">
        <span>🔴</span>
        <span>Critical (&gt;0.7)</span>
      </div>
      <div className="flex items-center gap-2">
        <span>🟠</span>
        <span>High (0.5-0.7)</span>
      </div>
      <div className="flex items-center gap-2">
        <span>🟡</span>
        <span>Moderate (-0.3-0.5)</span>
      </div>
      <div className="flex items-center gap-2">
        <span>🟢</span>
        <span>Low (&lt;-0.3)</span>
      </div>
    </div>
  );
}

export default function HeatMap() {
  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWards = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/heatmap/wards`);
      setWards(res.data);
    } catch {
      setWards(mockData.wards);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWards();
    const interval = setInterval(fetchWards, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-full min-h-[500px] rounded-xl overflow-hidden border border-[#1A3C5E]">
      {loading && (
        <div className="absolute inset-0 z-10 bg-[#1A2E4A] animate-pulse" />
      )}
      <MapContainer center={[23.78, 90.4]} zoom={12} className="h-full w-full">
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomleft" />
        <TileLayer
          attribution="DengueAI Pro | Data: OpenWeatherMap, DGHS"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {wards.map((ward) => (
          <Rectangle
            key={ward.ward_id}
            bounds={ward.bounds}
            pathOptions={{ color: ward.color, fillColor: ward.color, fillOpacity: ward.opacity }}
          >
            <Tooltip sticky>{ward.ward_name}</Tooltip>
            <Popup>
              <WardCard
                ward={ward}
                onReport={() => {
                  setSelectedWard(ward);
                  setShowReport(true);
                }}
              />
            </Popup>
          </Rectangle>
        ))}
      </MapContainer>
      <Legend />
      <CitizenReport
        ward={selectedWard}
        open={showReport}
        onClose={() => setShowReport(false)}
      />
    </div>
  );
}
