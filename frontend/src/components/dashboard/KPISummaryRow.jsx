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
    // Attempt to load live summary from backend if available
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
        // High fidelity baseline values remain
      });
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. High-Risk Wards */}
      <div className="midnight-card p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A1B28] border border-[#F45B79]/30 flex items-center justify-center text-[#F45B79] shadow-md shadow-[#F45B79]/10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-[#9FB3C9] flex items-center gap-1">
                <span>High-Risk Wards</span>
                <span className="cursor-help opacity-70 hover:opacity-100" title="Wards with SWAPI score > 0.70">ⓘ</span>
              </div>
              <div className="text-2xl lg:text-[28px] font-bold text-white mt-1 leading-none">
                {stats.highRiskWards} <span className="text-sm font-normal text-[#9FB3C9]">of {stats.totalWards}</span>
              </div>
            </div>
          </div>

          {/* Micro bar chart (Red) */}
          <div className="flex items-end gap-1 h-9 pt-2">
            {[40, 60, 45, 80, 50, 95, 75, 100].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-t-sm bg-[#F45B79] opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 pt-2 text-[11px] font-medium text-[#F45B79] flex items-center gap-1">
          <span>↑</span>
          <span>+3 from last week</span>
        </div>
      </div>

      {/* 2. Citizen Reports (7 days) */}
      <div className="midnight-card p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#162E4D] border border-[#46C8E5]/30 flex items-center justify-center text-[#46C8E5] shadow-md shadow-[#46C8E5]/10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-[#9FB3C9] flex items-center gap-1">
                <span>Citizen Reports (7 days)</span>
                <span className="cursor-help opacity-70 hover:opacity-100" title="Verified community reports of stagnant water">ⓘ</span>
              </div>
              <div className="text-2xl lg:text-[28px] font-bold text-white mt-1 leading-none">
                {stats.citizenReports}
              </div>
            </div>
          </div>

          {/* Micro bar chart (Cyan) */}
          <div className="flex items-end gap-1 h-9 pt-2">
            {[30, 45, 60, 50, 70, 65, 85, 95].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-t-sm bg-[#46C8E5] opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 pt-2 text-[11px] font-medium text-[#33D6A6] flex items-center gap-1">
          <span>↑</span>
          <span>+18% from previous week</span>
        </div>
      </div>

      {/* 3. Active Field Teams */}
      <div className="midnight-card p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#133830] border border-[#33D6A6]/30 flex items-center justify-center text-[#33D6A6] shadow-md shadow-[#33D6A6]/10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-[#9FB3C9] flex items-center gap-1">
                <span>Active Field Teams</span>
                <span className="cursor-help opacity-70 hover:opacity-100" title="Inspection and larviciding squads currently on site">ⓘ</span>
              </div>
              <div className="text-2xl lg:text-[28px] font-bold text-white mt-1 leading-none">
                {stats.activeTeams} <span className="text-sm font-normal text-[#9FB3C9]">of {stats.totalTeams}</span>
              </div>
            </div>
          </div>

          {/* Micro bar chart (Green) */}
          <div className="flex items-end gap-1 h-9 pt-2">
            {[50, 60, 55, 75, 80, 70, 90, 100].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-t-sm bg-[#33D6A6] opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 pt-2 text-[11px] font-medium text-[#33D6A6] flex items-center gap-1">
          <span>↑</span>
          <span>2 more teams deployed</span>
        </div>
      </div>

      {/* 4. Predicted Risk Index */}
      <div className="midnight-card p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2A1E4A] border border-[#9B83F5]/30 flex items-center justify-center text-[#9B83F5] shadow-md shadow-[#9B83F5]/10">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-[#9FB3C9] flex items-center gap-1">
                <span>Predicted Risk Index</span>
                <span className="cursor-help opacity-70 hover:opacity-100" title="Citywide composite SWAPI risk projection">ⓘ</span>
              </div>
              <div className="text-2xl lg:text-[28px] font-bold text-white mt-1 leading-none">
                {stats.riskIndex.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Micro line curve (Violet) */}
          <div className="h-9 w-20 pt-1">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 80 30" fill="none">
              <path
                d="M0 25 C 20 22, 35 15, 50 12 C 65 9, 75 4, 80 2"
                stroke="#9B83F5"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0 25 C 20 22, 35 15, 50 12 C 65 9, 75 4, 80 2 L 80 30 L 0 30 Z"
                fill="url(#violet-fade)"
                opacity="0.25"
              />
              <circle cx="80" cy="2" r="2.5" fill="#9B83F5" />
              <defs>
                <linearGradient id="violet-fade" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#9B83F5" />
                  <stop offset="1" stopColor="#9B83F5" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="mt-3 pt-2 text-[11px] font-medium text-[#9B83F5] flex items-center gap-1">
          <span>↑</span>
          <span>+0.15 from last week</span>
        </div>
      </div>
    </div>
  );
}
