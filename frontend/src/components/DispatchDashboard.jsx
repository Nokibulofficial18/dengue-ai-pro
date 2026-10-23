import { Fragment, useEffect, useState } from "react";
import axios from "axios";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function DispatchDashboard() {
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [countdown, setCountdown] = useState(300);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [newOrders, setNewOrders] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/dispatch/queue`);
      setOrders((prev) => {
        const prevIds = new Set(prev.map((item) => item.ward_id));
        const incoming = res.data || [];
        const updates = {};
        incoming.forEach((item) => {
          if (!prevIds.has(item.ward_id)) updates[item.ward_id] = true;
        });
        setNewOrders(updates);
        return incoming;
      });
    } catch {
      setOrders(mockData.dispatchOrders);
    } finally {
      setLastUpdated(new Date());
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const refreshTimer = setInterval(fetchQueue, 5 * 60 * 1000);
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 300 : prev - 1));
    }, 1000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(countdownTimer);
    };
  }, []);

  useEffect(() => {
    if (Object.keys(newOrders).length === 0) return;
    const timer = setTimeout(() => setNewOrders({}), 3000);
    return () => clearTimeout(timer);
  }, [newOrders]);

  const summary = orders.reduce(
    (acc, order) => {
      if ((order.swapi_score || 0) > 0.7) acc.critical += 1;
      acc.officers += order.officer_count || order.recommended_officers || 0;
      acc.larvicide += order.larvicide_litres || 0;
      return acc;
    },
    { critical: 0, officers: 0, larvicide: 0 }
  );

  const confirmDispatch = async (wardId) => {
    try {
      await axios.post(`${API_URL}/api/dispatch/${wardId}/confirm`, {
        officer_id: "DEMO_OFFICER",
      });
    } catch {
      // demo fallback
    }
    setOrders((prev) =>
      prev.map((order) =>
        order.ward_id === wardId ? { ...order, status: "confirmed" } : order
      )
    );
  };

  const toggleExpand = (wardId) => {
    setExpanded((prev) => ({ ...prev, [wardId]: !prev[wardId] }));
  };

  return (
    <div className="midnight-card p-4">
      {/* Top Summary Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 mb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
            {summary.critical} Critical Sectors
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/25">
            {summary.officers} Officers Required
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            {summary.larvicide.toFixed(1)} L Bti Larvicide
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>Auto-sync in {countdown}s</span>
          <button
            onClick={fetchQueue}
            className="p-1 rounded bg-[#08111D] border border-white/[0.08] text-slate-400 hover:text-white transition"
            title="Refresh queue"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0E1827] text-slate-400 text-[10px] font-mono uppercase tracking-wider">
            <tr>
              <th className="p-2.5 font-medium w-12">Tier</th>
              <th className="p-2.5 font-medium">Ward Sector</th>
              <th className="p-2.5 font-medium">Risk Score</th>
              <th className="p-2.5 font-medium">Squad Strength</th>
              <th className="p-2.5 font-medium">Bti Dosage</th>
              <th className="p-2.5 font-medium">Status</th>
              <th className="p-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] bg-[#0A121F]">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  Loading field dispatch recommendations...
                </td>
              </tr>
            ) : (
              orders.map((order, idx) => {
                const isCritical = (order.swapi_score || 0) >= 0.7;
                const isExpanded = !!expanded[order.ward_id];
                const isConfirmed = order.status === "confirmed" || order.status === "completed";

                return (
                  <Fragment key={order.ward_id}>
                    <tr
                      className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${
                        newOrders[order.ward_id] ? "bg-sky-500/10" : ""
                      }`}
                      onClick={() => toggleExpand(order.ward_id)}
                    >
                      <td className="p-2.5 font-mono text-slate-400">
                        <span className="w-5 h-5 rounded bg-white/[0.05] text-sky-400 inline-flex items-center justify-center font-mono text-[10px]">
                          #{order.priority_rank || idx + 1}
                        </span>
                      </td>
                      <td className="p-2.5 font-medium text-slate-100">
                        {order.ward_name} <span className="text-[10px] text-slate-400 font-mono">({order.ward_id})</span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`font-mono font-semibold px-2 py-0.5 rounded text-[10px] ${
                            isCritical ? "bg-rose-500/10 text-rose-400 border border-rose-500/25" : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                          }`}
                        >
                          {(order.swapi_score || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-200 font-mono text-[11px]">
                        {order.officer_count || order.recommended_officers || 2} Officers
                      </td>
                      <td className="p-2.5 text-emerald-400 font-mono font-medium text-[11px]">
                        {order.larvicide_litres ? `${order.larvicide_litres} L` : "12.0 L"}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            isConfirmed
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                          }`}
                        >
                          {isConfirmed ? "Confirmed" : "Pending"}
                        </span>
                      </td>
                      <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {!isConfirmed ? (
                          <button
                            onClick={() => confirmDispatch(order.ward_id)}
                            className="midnight-btn-primary text-xs py-1 px-2.5"
                          >
                            Dispatch
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-mono font-medium">
                            ✓ Dispatched
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Detail Accordion */}
                    {isExpanded && (
                      <tr className="bg-[#0E1827] border-t border-b border-white/[0.06]">
                        <td colSpan={7} className="p-3.5 space-y-2">
                          <div>
                            <span className="text-[10px] uppercase font-mono font-semibold text-sky-400 tracking-wider">
                              Target Sector &amp; Focus Area:
                            </span>
                            <p className="text-xs text-slate-200 mt-0.5">
                              {order.target_sector || "High-risk residential storm drains and open construction sumps."}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-mono font-semibold text-slate-400 tracking-wider">
                              Clinical RAG Reasoning:
                            </span>
                            <p className="text-xs text-slate-300 mt-0.5 font-mono italic">
                              "{order.reasoning || "Elevated rainfall and drainage coefficients trigger priority source reduction under WHO guideline."}"
                            </p>
                          </div>
                          {order.rag_citation && (
                            <div className="text-[10px] text-emerald-400 font-mono">
                              <span className="font-semibold">Citation:</span> {order.rag_citation}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
