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
        setCriticalCount(res.data.critical_count || 0);
      } catch {
        setCriticalCount(mockData.statsSummary.critical_count);
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
    <div className="w-full px-6 pt-4">
      <div className="card px-6 py-4 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gradient-to-r from-cyan-500/20 via-emerald-500/10 to-amber-400/20">
        <div className="flex items-center gap-2">
          <span className="pill bg-cyan-400/20 text-cyan-200">Live</span>
          <span>10 Wards Monitored</span>
        </div>
        <div className="h-px md:h-6 md:w-px bg-white/10" />
        <div>
          {loading ? (
            <span className="inline-block h-4 w-10 bg-white/10 animate-pulse rounded" />
          ) : (
            `${criticalCount} Critical`
          )}
        </div>
        <div className="h-px md:h-6 md:w-px bg-white/10" />
        <div>{cases.toLocaleString()} Cases in 2023</div>
        <div className="h-px md:h-6 md:w-px bg-white/10" />
        <div className="text-emerald-200">DengueAI Pro Active</div>
      </div>
    </div>
  );
}
