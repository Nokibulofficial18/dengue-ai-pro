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

  useEffect(() => {
    const fetchWards = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/swapi/all`);
        const sorted = [...res.data].sort((a, b) => b.score - a.score);
        setWards(sorted);
      } catch {
        const sorted = [...mockData.wards].sort(
          (a, b) => b.swapi_score - a.swapi_score
        );
        setWards(sorted);
      } finally {
        setLoading(false);
      }
    };

    fetchWards();
  }, []);

  return (
    <div className="p-6">
      <div className="text-xl font-semibold mb-4">All Ward Details</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading &&
          [1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 rounded-lg bg-white/5 animate-pulse"
            />
          ))}
        {!loading &&
          wards.map((ward) => (
            <WardCard
              key={ward.ward_id}
              ward={{
                ...ward,
                score: ward.score ?? ward.swapi_score,
              }}
              onReport={() => {
                setSelectedWard(ward);
                setShowReport(true);
              }}
            />
          ))}
      </div>
      <CitizenReport
        ward={selectedWard}
        open={showReport}
        onClose={() => setShowReport(false)}
      />
    </div>
  );
}
