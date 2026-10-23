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
    <div className="space-y-5 max-w-[1720px] mx-auto animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1B3654]/60 gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Community Citizen Reporting Portal</h2>
          <p className="text-xs text-[#9FB3C9]">
            Submit photographs of stagnant water, earn civic points, and mobilize municipal vector response
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedWard(selectedWardFromSelect);
            setShowReport(true);
          }}
          className="midnight-btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <span>📸</span> Submit New Photo Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="midnight-card p-5">
          <div className="text-[11px] font-semibold uppercase text-[#9FB3C9] tracking-wider">
            Verified Community Reports
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">
            {loading ? "..." : impactStats.totalReports}
          </div>
          <div className="text-xs text-[#33D6A6] mt-1">↑ Active across Dhaka wards</div>
        </div>

        <div className="midnight-card p-5">
          <div className="text-[11px] font-semibold uppercase text-[#9FB3C9] tracking-wider">
            Civic Points Distributed
          </div>
          <div className="text-3xl font-extrabold text-[#46C8E5] mt-2">
            {loading ? "..." : impactStats.totalPoints.toLocaleString()}
          </div>
          <div className="text-xs text-[#9FB3C9] mt-1">Rewarding community vigilantes</div>
        </div>

        <div className="midnight-card p-5">
          <div className="text-[11px] font-semibold uppercase text-[#9FB3C9] tracking-wider">
            Most Active Sector
          </div>
          <div className="text-3xl font-extrabold text-[#F6BA49] mt-2">
            {impactStats.topWard}
          </div>
          <div className="text-xs text-[#9FB3C9] mt-1">Rank #1 in source detection</div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Quick Submit Form + Selected Ward */}
        <div className="lg:col-span-6 space-y-4">
          <div className="midnight-card p-5">
            <h3 className="text-sm font-bold text-white mb-2">Select Your Neighborhood Ward</h3>
            <p className="text-xs text-[#9FB3C9] mb-4">
              Choose your ward to review current environmental indicators before uploading evidence
            </p>

            <select
              value={reportWardId}
              onChange={(e) => setReportWardId(e.target.value)}
              className="w-full bg-[#0D1C2E] border border-[#1B3654] text-xs text-white rounded-xl p-3 focus:outline-none focus:border-[#46C8E5] mb-4"
            >
              {wardOptions.map((ward) => (
                <option key={ward.ward_id} value={ward.ward_id}>
                  {ward.ward_name} ({ward.ward_id})
                </option>
              ))}
            </select>

            {loadingWards ? (
              <div className="h-44 rounded-xl bg-white/5 animate-pulse" />
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

          <div className="midnight-card p-5">
            <h4 className="text-xs font-bold text-[#46C8E5] uppercase tracking-wider mb-2">
              How Gamified Points Work
            </h4>
            <div className="space-y-2 text-xs text-[#9FB3C9]">
              <div className="flex items-start gap-2">
                <span className="text-[#33D6A6] font-bold">+25 pts</span>
                <span>Submit photo of open container or clogged rooftop drain</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#46C8E5] font-bold">+50 pts</span>
                <span>Field crew dispatched and resolves the reported hazard</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#9B83F5] font-bold">Badge</span>
                <span>Reach Top 10 in your ward for Dhaka Health Champion recognition</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Leaderboard Table */}
        <div className="lg:col-span-6">
          <div className="midnight-card p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1B3654]/60">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🏆</span> Citywide Citizen Leaderboard
              </h3>
              <span className="text-[10px] text-[#9FB3C9]">Updated hourly</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#9FB3C9] border-b border-[#1B3654]/40">
                    <th className="pb-2 font-semibold">Rank</th>
                    <th className="pb-2 font-semibold">Ward Area</th>
                    <th className="pb-2 font-semibold">Reports</th>
                    <th className="pb-2 font-semibold text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B3654]/30">
                  {leaderboard.map((row) => (
                    <tr key={row.rank} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 font-bold text-white">
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                            row.rank === 1
                              ? "bg-[#F6BA49] text-[#0C1829] font-black"
                              : row.rank === 2
                              ? "bg-slate-300 text-[#0C1829] font-black"
                              : row.rank === 3
                              ? "bg-[#9B83F5] text-white font-black"
                              : "bg-[#1B3654] text-[#9FB3C9]"
                          }`}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-white">{row.ward_name}</td>
                      <td className="py-2.5 text-[#9FB3C9]">{row.reports}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-[#33D6A6]">
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
