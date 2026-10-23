import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import CitizenReport from "../components/CitizenReport.jsx";
import WardCard from "../components/WardCard.jsx";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Citizen() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportWardId, setReportWardId] = useState("DHK-001");
  const [showReport, setShowReport] = useState(false);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(true);
  const [selectedWard, setSelectedWard] = useState(null);

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

  useEffect(() => {
    const fetchWards = async () => {
      setLoadingWards(true);
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
        setLoadingWards(false);
      }
    };

    fetchWards();
  }, []);

  const wardOptions = wards.length ? wards : mockData.wards;
  const selectedWardFromSelect = wardOptions.find(
    (ward) => ward.ward_id === reportWardId
  );

  const impactStats = useMemo(() => {
    const totalReports = leaderboard.reduce((sum, entry) => sum + entry.reports, 0);
    const totalPoints = leaderboard.reduce((sum, entry) => sum + entry.points, 0);
    const topWard = leaderboard[0]?.ward_name || "Mirpur";
    return { totalReports, totalPoints, topWard };
  }, [leaderboard]);

  return (
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in duration-200">
      {/* Action Bar */}
      <div className="midnight-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-white tracking-tight">Community Sentinel Network</div>
          <div className="text-[11px] text-slate-400">Citizen photographic surveillance and municipal dispatch linkage</div>
        </div>
        <button
          onClick={() => {
            setSelectedWard(selectedWardFromSelect);
            setShowReport(true);
          }}
          className="midnight-btn-primary text-xs py-1.5 px-3 self-start sm:self-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Submit Evidence Photo</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="midnight-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Verified Reports
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {loading ? "..." : impactStats.totalReports}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-mono">↑ 92% verification rate</div>
        </div>

        <div className="midnight-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Civic Points Awarded
          </div>
          <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
            {loading ? "..." : impactStats.totalPoints.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Community surveillance incentives</div>
        </div>

        <div className="midnight-card p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Most Active Sector
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {impactStats.topWard}
          </div>
          <div className="text-[11px] text-amber-400 mt-1 font-mono">Rank #1 source reports</div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Quick Submit Form + Selected Ward */}
        <div className="lg:col-span-6 space-y-3.5">
          <div className="midnight-card p-4">
            <h3 className="text-xs font-semibold text-white tracking-tight uppercase tracking-wider mb-1">
              Select Ward Sump Profile
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Review environmental metrics before uploading evidence for that sector
            </p>

            <select
              value={reportWardId}
              onChange={(e) => setReportWardId(e.target.value)}
              className="w-full bg-[#08111D] border border-white/[0.08] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-sky-400 mb-3"
            >
              {wardOptions.map((ward) => (
                <option key={ward.ward_id} value={ward.ward_id}>
                  {ward.ward_name} ({ward.ward_id})
                </option>
              ))}
            </select>

            {loadingWards ? (
              <div className="h-44 rounded-xl bg-white/[0.04] animate-pulse" />
            ) : (
              selectedWardFromSelect && (
                <WardCard
                  ward={selectedWardFromSelect}
                  onReport={() => {
                    setSelectedWard(selectedWardFromSelect);
                    setShowReport(true);
                  }}
                />
              )
            )}
          </div>

          <div className="midnight-card p-4">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
              Civic Protocol Rewards
            </h4>
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-2 rounded-md bg-[#08111D] border border-white/[0.04]">
                <span className="text-emerald-400 font-mono font-bold text-[11px]">+25 pts</span>
                <span className="text-[11px]">Submit geo-tagged evidence photo of open container or stagnant water</span>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-md bg-[#08111D] border border-white/[0.04]">
                <span className="text-sky-400 font-mono font-bold text-[11px]">+50 pts</span>
                <span className="text-[11px]">Municipal field team confirms and completes Bti larvicide treatment</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Leaderboard Table */}
        <div className="lg:col-span-6">
          <div className="midnight-card p-4">
            <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-white/[0.07]">
              <div>
                <h3 className="text-xs font-semibold text-white tracking-tight uppercase tracking-wider">
                  Citywide Citizen Leaderboard
                </h3>
                <div className="text-[10px] text-slate-400">Validated report counts per ward</div>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Hourly sync</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-white/[0.06] text-[10px] font-mono uppercase tracking-wider">
                    <th className="pb-2 font-medium w-12">Rank</th>
                    <th className="pb-2 font-medium">Ward Sector</th>
                    <th className="pb-2 font-medium">Reports</th>
                    <th className="pb-2 font-medium text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {leaderboard.map((row) => (
                    <tr key={row.rank} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 font-mono">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono font-bold ${
                            row.rank === 1
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : row.rank === 2
                              ? "bg-slate-300/20 text-slate-200 border border-slate-300/30"
                              : row.rank === 3
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : "text-slate-400"
                          }`}
                        >
                          #{row.rank}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-slate-200">{row.ward_name}</td>
                      <td className="py-2.5 text-slate-400 font-mono text-[11px]">{row.reports}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
