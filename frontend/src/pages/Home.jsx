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
  const summaryTop = wardOptions.slice(0, 5);

  return (
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Main Geospatial Risk Map */}
        <div className="lg:col-span-8 xl:col-span-9 h-[680px]">
          <RiskMapPanel
            selectedWardId={selectedWardId}
            onSelectWard={(ward) => setSelectedWardId(ward.ward_id)}
          />
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-3.5 flex flex-col">
          {/* Top Wards Card */}
          <div className="midnight-card p-4 flex-1">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.07]">
              <div className="text-xs font-semibold text-white tracking-tight uppercase tracking-wider">
                Highest Risk Sectors Today
              </div>
              <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/25">
                Priority
              </span>
            </div>

            {loadingWards ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {summaryTop.map((ward) => {
                  const score = ward.score ?? ward.swapi_score ?? 0;
                  const isHigh = score >= 0.7;
                  const isSelected = selectedWardId === ward.ward_id;

                  return (
                    <div
                      key={ward.ward_id}
                      onClick={() => setSelectedWardId(ward.ward_id)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-sky-500/10 border-sky-500/40"
                          : "bg-[#0E1827] border-white/[0.05] hover:border-sky-500/25 hover:bg-[#121F33]"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-medium text-slate-100">{ward.ward_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ward.ward_id}</div>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          isHigh
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
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
          <div className="midnight-card p-4">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.07]">
              <div className="text-xs font-semibold text-white tracking-tight uppercase tracking-wider">
                Community Surveillance
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
                Top Citizens
              </span>
            </div>

            {loadingLeaderboard ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className="flex items-center justify-between text-xs py-2 px-2.5 rounded-lg bg-[#0E1827] border border-white/[0.04]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-white/[0.05] text-sky-400 text-[10px] font-mono font-bold flex items-center justify-center border border-white/[0.08]">
                        #{entry.rank}
                      </span>
                      <span className="text-slate-200 font-medium">{entry.ward_name}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] font-mono">
                      {entry.reports} reports · <span className="text-emerald-400 font-bold">{entry.points} pts</span>
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
