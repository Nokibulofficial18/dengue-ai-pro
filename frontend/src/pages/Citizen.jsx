import { useEffect, useState } from "react";
import axios from "axios";

import CitizenReport from "../components/CitizenReport.jsx";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Citizen() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportWardId, setReportWardId] = useState("DHK-001");
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/citizen/leaderboard`);
        setLeaderboard(res.data.slice(0, 10));
      } catch {
        setLeaderboard(mockData.leaderboard.slice(0, 10));
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const wardOptions = mockData.wards;
  const selectedWard = wardOptions.find((ward) => ward.ward_id === reportWardId);

  return (
    <div className="p-6">
      <div className="text-xl font-semibold mb-4">Citizen Reporting</div>
      <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4">
        <div className="bg-[#1A2E4A] rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Report Stagnant Water</div>
          <div className="flex items-center gap-2">
            <select
              value={reportWardId}
              onChange={(e) => setReportWardId(e.target.value)}
              className="flex-1 rounded-lg bg-[#0F1A2E] px-3 py-2 text-sm"
            >
              {wardOptions.map((ward) => (
                <option key={ward.ward_id} value={ward.ward_id}>
                  {ward.ward_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowReport(true)}
              className="rounded-lg bg-[#0F7B6C] px-3 py-2 text-sm font-semibold"
            >
              Report
            </button>
          </div>
          <div className="text-xs text-gray-300 mt-3">
            Upload a photo or submit a quick report to earn points.
          </div>
        </div>

        <div className="bg-[#1A2E4A] rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Leaderboard</div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-6 rounded bg-[#0F1A2E] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {leaderboard.map((entry) => (
                <li key={entry.rank} className="flex items-center justify-between">
                  <span>
                    #{entry.rank} {entry.ward_name}
                  </span>
                  <span className="text-gray-300">
                    {entry.reports} reports · {entry.points} points
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <CitizenReport
        ward={selectedWard}
        open={showReport}
        onClose={() => setShowReport(false)}
      />
    </div>
  );
}
