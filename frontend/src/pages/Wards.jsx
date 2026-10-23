import { useEffect, useState } from "react";
import axios from "axios";
import WardCard from "../components/WardCard.jsx";
import CitizenReport from "../components/CitizenReport.jsx";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Wards() {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWard, setSelectedWard] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchWards = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/swapi/all`);
        const sorted = [...res.data].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        setWards(sorted);
      } catch {
        const sorted = [...mockData.wards].sort(
          (a, b) => (b.swapi_score ?? 0) - (a.swapi_score ?? 0)
        );
        setWards(sorted);
      } finally {
        setLoading(false);
      }
    };

    fetchWards();
  }, []);

  const filtered = wards.filter((w) => {
    const s = w.score ?? w.swapi_score ?? 0;
    if (filter === "high") return s >= 0.7;
    if (filter === "medium") return s >= 0.4 && s < 0.7;
    if (filter === "low") return s < 0.4;
    return true;
  });

  return (
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1B3654]/60 gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Dhaka Ward Analytics &amp; Risk Profiles</h2>
          <p className="text-xs text-[#9FB3C9]">
            Detailed factor contributions: Rainfall, Humidity, Sunlight, Temperature, and Drainage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-[#0D1C2E] border border-[#1B3654] text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#46C8E5]"
          >
            <option value="all">All Risk Levels ▾</option>
            <option value="high">High Risk (&gt;0.70)</option>
            <option value="medium">Medium Risk (0.40–0.70)</option>
            <option value="low">Low Risk (&lt;0.40)</option>
          </select>
        </div>
      </div>

      {/* Grid of Wards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading &&
          [1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-56 rounded-2xl bg-white/5 animate-pulse border border-white/5"
            />
          ))}
        {!loading &&
          filtered.map((ward) => (
            <div key={ward.ward_id} className="midnight-card midnight-card-hover">
              <WardCard
                ward={{
                  ...ward,
                  score: ward.score ?? ward.swapi_score,
                }}
                onReport={() => {
                  setSelectedWard(ward);
                  setShowReport(true);
                }}
              />
            </div>
          ))}
      </div>

      {/* Citizen Report Modal */}
      <CitizenReport
        ward={selectedWard}
        open={showReport}
        onClose={() => setShowReport(false)}
      />
    </div>
  );
}
