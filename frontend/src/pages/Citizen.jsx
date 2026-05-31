import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import CitizenReport from "../components/CitizenReport.jsx";
import StatsBar from "../components/StatsBar.jsx";
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
    const topWard = leaderboard[0]?.ward_name || "-";
    return { totalReports, totalPoints, topWard };
  }, [leaderboard]);

  return (
    <div className="pb-8">
      <StatsBar />
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-2xl font-semibold">User Dashboard</div>
            <div className="text-sm text-slate-400">
              Track local risk, submit reports, and earn community points.
            </div>
          </div>
          <button
            onClick={() => setShowReport(true)}
            className="rounded-2xl px-4 py-2 text-sm font-semibold btn btn-primary"
          >
            New Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs uppercase text-slate-400">Community Reports</div>
            <div className="text-2xl font-semibold mt-2">
              {loading ? "..." : impactStats.totalReports}
            </div>
            <div className="text-xs text-slate-400 mt-1">Last 7 days</div>
          </div>
          <div className="card p-4">
            <div className="text-xs uppercase text-slate-400">Points Earned</div>
            <div className="text-2xl font-semibold mt-2">
              {loading ? "..." : impactStats.totalPoints}
            </div>
            <div className="text-xs text-slate-400 mt-1">Leaderboard total</div>
          </div>
          <div className="card p-4">
            <div className="text-xs uppercase text-slate-400">Top Ward</div>
            <div className="text-2xl font-semibold mt-2">
              {loading ? "..." : impactStats.topWard}
            </div>
            <div className="text-xs text-slate-400 mt-1">Most active today</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4">
          <div className="card p-5">
            <div className="text-sm font-semibold mb-3">Report Stagnant Water</div>
            <div className="flex items-center gap-2">
              <select
                value={reportWardId}
                onChange={(e) => setReportWardId(e.target.value)}
                className="flex-1 rounded-2xl px-3 py-2 text-sm input"
              >
                {wardOptions.map((ward) => (
                  <option key={ward.ward_id} value={ward.ward_id}>
                    {ward.ward_name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setSelectedWard(selectedWardFromSelect || null);
                  setShowReport(true);
                }}
                className="rounded-2xl px-3 py-2 text-sm font-semibold btn btn-primary"
              >
                Report
              </button>
            </div>
            <div className="text-xs text-slate-300 mt-3">
              Upload a photo or submit a quick report to earn points.
            </div>
            {selectedWardFromSelect && (
              <div className="mt-4 rounded-2xl bg-white/5 p-3 text-xs text-slate-300">
                <div className="text-sm font-semibold text-white">
                  {selectedWardFromSelect.ward_name}
                </div>
                <div className="mt-1">
                  Current risk: {selectedWardFromSelect.risk_level}
                </div>
                <div className="mt-1">
                  Citizen reports: {selectedWardFromSelect.citizen_report_count ?? 0}
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="text-sm font-semibold mb-3">Community Leaderboard</div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((item) => (
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

        <div>
          <div className="text-sm font-semibold mb-3">Nearby Wards</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {loadingWards &&
              [1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-28 rounded-lg bg-white/5 animate-pulse"
                />
              ))}
            {!loadingWards &&
              wardOptions.slice(0, 4).map((ward) => (
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
        </div>
      </div>

      <CitizenReport
        ward={selectedWard || selectedWardFromSelect}
        open={showReport}
        onClose={() => setShowReport(false)}
      />
    </div>
  );
}
