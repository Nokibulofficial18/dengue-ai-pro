import { useEffect, useState } from "react";
import axios from "axios";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function StatsBar() {
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState(0);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/swapi/stats/summary`);
        setCriticalCount(res.data.critical_count || res.data.high_risk_count || 3);
      } catch {
        setCriticalCount(mockData.statsSummary?.critical_count || 3);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  useEffect(() => {
    let current = 0;
    const target = 321179;
    const step = Math.ceil(target / 80);
    const timer = setInterval(() => {
      current = Math.min(target, current + step);
      setCases(current);
      if (current >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full">
      <div className="midnight-card px-5 py-3 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-[#1B3654]/80">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#162E4D] text-[#46C8E5] border border-[#46C8E5]/30">
            Live
          </span>
          <span className="text-white font-medium">10 Dhaka Wards Monitored</span>
        </div>
        <div className="hidden md:block h-4 w-px bg-[#1B3654]" />
        <div>
          {loading ? (
            <span className="inline-block h-4 w-12 bg-white/10 animate-pulse rounded" />
          ) : (
            <span className="text-[#F45B79] font-bold">
              {criticalCount} Critical Priority Wards
            </span>
          )}
        </div>
        <div className="hidden md:block h-4 w-px bg-[#1B3654]" />
        <div className="text-[#9FB3C9]">
          <span className="text-white font-semibold font-mono">{cases.toLocaleString()}</span> Historical DGHS Cases (2023)
        </div>
        <div className="hidden md:block h-4 w-px bg-[#1B3654]" />
        <div className="text-[#33D6A6] font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#33D6A6] animate-pulse" />
          DengueAI Pro Active
        </div>
      </div>
    </div>
  );
}
