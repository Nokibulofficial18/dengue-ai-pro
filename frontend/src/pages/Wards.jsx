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
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in duration-200">
      {/* Control Bar */}
      <div className="midnight-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium text-slate-300">
            Showing <strong className="text-white font-mono">{filtered.length}</strong> of {wards.length} Ward Profiles
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-[11px] text-slate-400 font-mono">
            SWAPI Model Calibration Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-[#08111D] border border-white/[0.08] text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-400 transition"
          >
            <option value="all">All Risk Tiers</option>
            <option value="high">Critical Risk (&gt;0.70)</option>
            <option value="medium">Elevated Risk (0.40–0.70)</option>
            <option value="low">Low Risk (&lt;0.40)</option>
          </select>
        </div>
      </div>

      {/* Grid of Wards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {loading &&
          [1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-56 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.05]"
            />
          ))}
        {!loading &&
          filtered.map((ward) => (
            <div key={ward.ward_id} className="midnight-card hover:border-sky-500/30 transition-all">
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
