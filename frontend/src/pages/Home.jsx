import { useEffect, useState } from "react";
import axios from "axios";
import RiskMapPanel from "../components/dashboard/RiskMapPanel.jsx";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Home() {
  const [topWards, setTopWards] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [selectedWardId, setSelectedWardId] = useState(null);

  useEffect(() => {
    const fetchWards = async () => {
      setLoadingWards(true);
      try {
        const res = await axios.get(`${API_URL}/api/swapi/all`);
        const sorted = [...res.data].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        setTopWards(sorted);
      } catch {
        const sorted = [...mockData.wards].sort(
          (a, b) => (b.swapi_score ?? 0) - (a.swapi_score ?? 0)
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
  const summaryTop = wardOptions.slice(0, 4);

  return (
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-[#1B3654]/60">
        <div>
          <h2 className="text-xl font-bold text-white">Dhaka Fullscreen Risk Intelligence Map</h2>
          <p className="text-xs text-[#9FB3C9]">Real-time geospatial vector clusters and ward severity ratings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Geospatial Risk Map */}
        <div className="lg:col-span-8 xl:col-span-9 h-[680px]">
          <RiskMapPanel
            selectedWardId={selectedWardId}
            onSelectWard={(ward) => setSelectedWardId(ward.ward_id)}
          />
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Top Wards Card */}
          <div className="midnight-card p-5">
            <div className="text-xs font-bold text-[#46C8E5] uppercase tracking-wider mb-2">
              Highest Risk Sectors Today
            </div>
            {loadingWards ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {summaryTop.map((ward) => {
                  const score = ward.score ?? ward.swapi_score ?? 0;
                  const isHigh = score >= 0.7;
                  return (
                    <div
                      key={ward.ward_id}
                      onClick={() => setSelectedWardId(ward.ward_id)}
                      className="p-2.5 rounded-xl bg-[#172C45]/60 hover:bg-[#172C45] border border-white/5 hover:border-[#46C8E5]/40 transition cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{ward.ward_name}</div>
                        <div className="text-[10px] text-[#9FB3C9]">{ward.ward_id}</div>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                          isHigh
                            ? "bg-[#F45B79]/20 text-[#F45B79] border border-[#F45B79]/40"
                            : "bg-[#F6BA49]/20 text-[#F6BA49] border border-[#F6BA49]/40"
                        }`}
                      >
                        SWAPI {score.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Citizen Leaderboard */}
          <div className="midnight-card p-5">
            <div className="text-xs font-bold text-[#33D6A6] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Citizen Leaderboard</span>
              <span className="text-[10px] text-[#9FB3C9]">Top Contributors</span>
            </div>
            {loadingLeaderboard ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1B3654] text-[#46C8E5] text-[10px] font-bold flex items-center justify-center">
                        #{entry.rank}
                      </span>
                      <span className="text-white font-medium">{entry.ward_name}</span>
                    </div>
                    <span className="text-[#9FB3C9] text-[11px]">
                      {entry.reports} reports · <span className="text-[#33D6A6] font-semibold">{entry.points} pts</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
