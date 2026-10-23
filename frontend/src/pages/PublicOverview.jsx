import { useEffect, useState } from "react";
import axios from "axios";
import RiskMapPanel from "../components/dashboard/RiskMapPanel.jsx";
import CitizenReport from "../components/CitizenReport.jsx";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function PublicOverview() {
  const [topWards, setTopWards] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [selectedWardId, setSelectedWardId] = useState(null);
  const [showCitizenModal, setShowCitizenModal] = useState(false);

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

  const preventionGuidelines = [
    {
      title: "Drain Standing Water Containers",
      desc: "Empty flowerpot saucers, discarded plastics, and AC drip trays every 48 hours.",
      category: "Source Reduction",
      cadence: "48h Inspection Cycle",
      icon: (
        <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      ),
    },
    {
      title: "Cover Overhead & Ground Water Tanks",
      desc: "Ensure water reservoirs are sealed with tight-fitting lids or fine nylon mosquito mesh.",
      category: "Physical Barrier",
      cadence: "Permanent Sealing",
      icon: (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: "Recognize Early Dengue Symptoms",
      desc: "High fever (104°F), retro-orbital pain, severe rash, or joint aches require immediate clinical CBC testing.",
      category: "Clinical Triage",
      cadence: "Immediate CBC Test",
      icon: (
        <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in duration-200">
      {/* 1. Public Health Advisory & Emergency Alert Banner */}
      <div className="midnight-card p-4 sm:p-5 border-amber-500/25 bg-gradient-to-r from-[#101D30] via-[#14243B] to-[#101D30] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                Active Public Advisory · Monsoon 2024
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08]">
                DNCC / DSCC Health Directive
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 mt-0.5">
              Elevated Aedes aegypti vector activity detected in Mirpur, Lalbagh, and Badda. Citizens are advised to perform weekly container source reduction.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
          <a
            href="tel:16263"
            className="px-3.5 py-2.5 rounded-lg bg-[#08111D] border border-white/[0.08] hover:border-amber-500/40 text-xs text-amber-300 font-mono font-medium flex items-center justify-center gap-2 transition min-h-[40px]"
            title="DGHS National Health Call Center"
          >
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>DGHS Hotline: 16263</span>
          </a>

          <button
            onClick={() => setShowCitizenModal(true)}
            className="midnight-btn-primary px-3.5 py-2.5 text-xs flex items-center justify-center gap-1.5 shrink-0 min-h-[40px]"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Report Stagnant Water</span>
          </button>
        </div>
      </div>

      {/* 2. Main Geospatial Risk Map & High Risk Sectors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Public Vector Map (8 cols) */}
        <div className="lg:col-span-8 flex flex-col">
          <RiskMapPanel
            selectedWardId={selectedWardId}
            onSelectWard={(ward) => setSelectedWardId(ward.ward_id)}
          />
        </div>

        {/* Right Sidebar: High-Risk Sectors & Community Action (4 cols) */}
        <div className="lg:col-span-4 space-y-3.5 flex flex-col">
          {/* Highest Risk Sectors Today */}
          <div className="midnight-card p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.07]">
                <div className="text-xs font-semibold text-white tracking-tight uppercase tracking-wider">
                  Highest Risk Sectors Today
                </div>
                <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/25">
                  High Alert
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Click any sector to focus the interactive map and review vector severity:
              </p>

              {loadingWards ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
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
                            ? "bg-sky-500/10 border-sky-500/40 shadow-sm"
                            : "bg-[#0E1827] border-white/[0.05] hover:border-sky-500/25 hover:bg-[#121F33]"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-100">{ward.ward_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{ward.ward_id}</div>
                        </div>
                        <div className="text-right">
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-white/[0.06] text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>Updated from 10 City Wards</span>
              <span className="text-sky-400">● Live Satellite &amp; Sump Sync</span>
            </div>
          </div>

          {/* Community Champions Leaderboard */}
          <div className="midnight-card p-4">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.07]">
              <div className="text-xs font-semibold text-white tracking-tight uppercase tracking-wider">
                Community Surveillance
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
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

      {/* 3. Bottom Row: Public Prevention Guidelines & Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {preventionGuidelines.map((item, idx) => (
          <div key={idx} className="midnight-card p-4 flex flex-col justify-between">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0E1827] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                {item.icon}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-tight mb-1">{item.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
            <div className="pt-2.5 mt-3 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="font-medium text-slate-300">{item.category}</span>
              <span className="text-sky-400">{item.cadence}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Citizen Hazard Report Modal */}
      {showCitizenModal && (
        <CitizenReport
          ward={null}
          open={showCitizenModal}
          onClose={() => setShowCitizenModal(false)}
        />
      )}
    </div>
  );
}
