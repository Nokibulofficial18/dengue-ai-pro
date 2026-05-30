import { useEffect, useState } from "react";
import axios from "axios";

import HeatMap from "../components/HeatMap.jsx";
import StatsBar from "../components/StatsBar.jsx";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Home() {
  const [topWards, setTopWards] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  useEffect(() => {
    const fetchWards = async () => {
      setLoadingWards(true);
      try {
        const res = await axios.get(`${API_URL}/api/swapi/all`);
        const sorted = [...res.data].sort((a, b) => b.score - a.score);
        setTopWards(sorted);
      } catch {
        const sorted = [...mockData.wards].sort(
          (a, b) => b.swapi_score - a.swapi_score
        );
        setTopWards(sorted);
      } finally {
        setLoadingWards(false);
      }
    };

    const fetchLeaderboard = async () => {
      setLoadingLeaderboard(true);
      try {
        const res = await axios.get(`${API_URL}/api/citizen/leaderboard`);
        setLeaderboard(res.data.slice(0, 5));
      } catch {
        setLeaderboard(mockData.leaderboard.slice(0, 5));
      } finally {
        setLoadingLeaderboard(false);
      }
    };

    fetchWards();
    fetchLeaderboard();
  }, []);

  const wardOptions = topWards.length ? topWards : mockData.wards;
  const summaryTop = wardOptions.slice(0, 3);

  return (
    <div>
      <StatsBar />
      <div className="grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4 p-6">
        <HeatMap />
        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-sm font-semibold mb-3">Today’s Summary</div>
            {loadingWards ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-6 rounded bg-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-300 space-y-2">
                <div>Top risk wards today:</div>
                <ul className="space-y-1">
                  {summaryTop.map((ward) => (
                    <li key={ward.ward_id}>
                      {ward.ward_name} — SWAPI {(
                        ward.score ?? ward.swapi_score
                      ).toFixed(2)}
                    </li>
                  ))}
                </ul>
                <div className="pt-2 text-xs text-slate-400">
                  Visit Ward Details for full breakdowns and Citizen Reports to submit.
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="text-sm font-semibold mb-3">Citizen Leaderboard</div>
            {loadingLeaderboard ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-6 rounded bg-white/5 animate-pulse"
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
                    <span className="text-slate-300">
                      {entry.reports} reports · {entry.points} points
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
