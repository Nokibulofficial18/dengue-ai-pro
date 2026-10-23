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
    <div className="midnight-card p-5">
      {/* Top Summary Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 mb-4 border-b border-[#1B3654]/60">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#4A1B28] text-[#F45B79] border border-[#F45B79]/40">
            {summary.critical} Critical Wards
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#162E4D] text-[#46C8E5] border border-[#46C8E5]/40">
            {summary.officers} Officers Required
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#133830] text-[#33D6A6] border border-[#33D6A6]/40">
            {summary.larvicide.toFixed(1)} L Larvicide (Bti)
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9FB3C9]">
          <span>Sync in {countdown}s</span>
          <button
            onClick={fetchQueue}
            className="p-1.5 rounded-lg bg-[#0D1C2E] border border-[#1B3654] text-[#46C8E5] hover:bg-[#172C45] transition"
            title="Refresh queue"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1B3654]/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#172C45]/80 text-[#9FB3C9]">
            <tr>
              <th className="p-3 font-semibold">Priority</th>
              <th className="p-3 font-semibold">Ward</th>
              <th className="p-3 font-semibold">SWAPI Risk</th>
              <th className="p-3 font-semibold">Team Size</th>
              <th className="p-3 font-semibold">Larvicide</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1B3654]/40 bg-[#0D1C2E]/40">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#9FB3C9]">
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
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${
                        newOrders[order.ward_id] ? "bg-[#46C8E5]/10" : ""
                      }`}
                      onClick={() => toggleExpand(order.ward_id)}
                    >
                      <td className="p-3 font-bold text-white">
                        <span className="w-6 h-6 rounded-md bg-[#1B3654] text-[#46C8E5] inline-flex items-center justify-center font-mono">
                          #{order.priority_rank || idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-white">
                        {order.ward_name} <span className="text-[10px] text-[#9FB3C9] font-normal">({order.ward_id})</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            isCritical ? "bg-[#F45B79]/20 text-[#F45B79]" : "bg-[#F6BA49]/20 text-[#F6BA49]"
                          }`}
                        >
                          {(order.swapi_score || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 text-white">
                        {order.officer_count || order.recommended_officers || 2} Officers
                      </td>
                      <td className="p-3 text-[#33D6A6] font-mono font-semibold">
                        {order.larvicide_litres ? `${order.larvicide_litres} L` : "12.0 L"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isConfirmed
                              ? "bg-[#133830] text-[#33D6A6] border border-[#33D6A6]/40"
                              : "bg-[#4A3515] text-[#F6BA49] border border-[#F6BA49]/40"
                          }`}
                        >
                          {isConfirmed ? "Confirmed" : "Pending"}
                        </span>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {!isConfirmed ? (
                          <button
                            onClick={() => confirmDispatch(order.ward_id)}
                            className="midnight-btn-primary text-xs py-1 px-3"
                          >
                            Dispatch Crew
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#33D6A6] font-semibold">
                            ✓ Dispatched
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr className="bg-[#172C45]/50 border-t border-b border-[#1B3654]/40">
                        <td colSpan={7} className="p-4 space-y-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#46C8E5] tracking-wider">
                              Target Sector &amp; Focus:
                            </span>
                            <p className="text-xs text-white mt-0.5">
                              {order.target_sector || "High-risk residential storm drains and open construction sumps."}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#9FB3C9] tracking-wider">
                              Clinical RAG Reasoning:
                            </span>
                            <p className="text-xs text-slate-300 mt-0.5 italic">
                              "{order.reasoning || "Elevated rainfall and drainage coefficients trigger priority source reduction under WHO guideline."}"
                            </p>
                          </div>
                          {order.rag_citation && (
                            <div className="text-[11px] text-[#33D6A6]">
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
