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
    <div className="w-full bg-[#0F7B6C] px-6 py-3 text-sm flex items-center justify-between">
      <div>10 Wards Monitored</div>
      <div className="h-6 w-px bg-white/30" />
      <div>
        {loading ? (
          <span className="inline-block h-4 w-10 bg-white/30 animate-pulse rounded" />
        ) : (
          `${criticalCount} Critical`
        )}
      </div>
      <div className="h-6 w-px bg-white/30" />
      <div>{cases.toLocaleString()} Cases in 2023</div>
      <div className="h-6 w-px bg-white/30" />
      <div>DengueAI Pro Active 🟢</div>
    </div>
  );
}
