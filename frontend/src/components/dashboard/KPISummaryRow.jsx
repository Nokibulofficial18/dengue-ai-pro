import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function KPISummaryRow() {
  const [stats, setStats] = useState({
    highRiskWards: 8,
    totalWards: 54,
    citizenReports: 247,
    activeTeams: 12,
    totalTeams: 18,
    riskIndex: 0.72,
  });

  useEffect(() => {
    axios
      .get(`${API_URL}/api/swapi/stats/summary`)
      .then((res) => {
        if (res.data) {
          setStats((prev) => ({
            ...prev,
            highRiskWards: res.data.critical_count || res.data.high_risk_count || prev.highRiskWards,
            totalWards: res.data.total_wards || prev.totalWards,
            riskIndex: res.data.city_average_risk ? Number(res.data.city_average_risk.toFixed(2)) : prev.riskIndex,
          }));
        }
      })
      .catch(() => {
        // Fallback baseline maintained
      });
  }, []);

  return (
    <div className="midnight-card p-4 sm:p-5 border-white/[0.09] bg-gradient-to-r from-[#101D30] via-[#14243B] to-[#101D30]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-center">
        {/* Left Column: Primary Outbreak Insight (Command Hero) */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-between space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              HIGH ALERT · OUTBREAK SURGE
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Citywide Vector Risk: <strong className="text-white font-bold">{stats.riskIndex.toFixed(2)} SWAPI</strong> (+0.15 uptick)
            </span>
          </div>

          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {stats.highRiskWards} of {stats.totalWards} Monitored Sectors Exceed Critical Vector Threshold
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              Rapid Aedes aegypti breeding velocity detected following 42mm precipitation. Mirpur (0.91) and Lalbagh (0.93) require immediate chemical larvicide application and construction sump drainage.
            </p>
          </div>

          <div className="pt-1 flex items-center gap-3">
            <a
              href="/authority"
              className="midnight-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <span>Mobilize Field Squads</span>
              <span>→</span>
            </a>
            <span className="text-[11px] font-mono text-slate-400">
              DGHS Protocol WHO-2024 active
            </span>
          </div>
        </div>

        {/* Right Column: Supporting Metrics with Deliberate Density */}
        <div className="lg:col-span-5 xl:col-span-5 grid grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-white/[0.08] pt-4 lg:pt-0 lg:pl-6">
          {/* Metric 1: Critical Sectors */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Critical
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
              {stats.highRiskWards}
              <span className="text-xs text-slate-500 font-mono font-normal">/{stats.totalWards}</span>
            </div>
            <div className="text-[10px] text-rose-400 font-mono">
              SWAPI &gt; 0.70
            </div>
          </div>

          {/* Metric 2: Citizen Reports */}
          <div className="space-y-1 border-l border-white/[0.06] pl-3">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Civic Intake
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
              {stats.citizenReports}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono">
              92% verified
            </div>
          </div>

          {/* Metric 3: Active Squads */}
          <div className="space-y-1 border-l border-white/[0.06] pl-3">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
              Squads Active
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
              {stats.activeTeams}
              <span className="text-xs text-slate-500 font-mono font-normal">/{stats.totalTeams}</span>
            </div>
            <div className="text-[10px] text-sky-400 font-mono">
              67% deployed
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
