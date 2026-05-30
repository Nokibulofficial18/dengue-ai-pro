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
        officer_id: "DEMO",
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

  return (
    <div className="card p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="text-sm font-semibold">
          {summary.critical} Critical Wards · {summary.officers} Officers Needed ·{" "}
          {summary.larvicide.toFixed(1)} Litres Larvicide
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "--"}</span>
          <span>Refresh in {countdown}s</span>
          <button
            onClick={() => window.print()}
            className="rounded-full px-3 py-1 text-xs btn btn-secondary"
          >
            Print Dispatch Orders
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="text-slate-400 bg-white/5">
            <tr>
              <th className="text-left py-2">Priority</th>
              <th className="text-left py-2">Ward</th>
              <th className="text-left py-2">SWAPI</th>
              <th className="text-left py-2">Officers</th>
              <th className="text-left py-2">Larvicide</th>
              <th className="text-left py-2">Sector</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-6">
                  <div className="h-6 w-full rounded bg-[#0F1A2E] animate-pulse" />
                </td>
              </tr>
            )}
            {!loading && orders.map((order) => {
              const isCritical = (order.swapi_score || 0) > 0.7;
              const rowColor = isCritical ? "bg-rose-500/10" : "bg-amber-500/10";
              return (
                <Fragment key={order.ward_id}>
                  <tr className={`${rowColor} ${newOrders[order.ward_id] ? "animate-pulse" : ""}`}>
                    <td className="py-2">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200 text-xs"
                      >
                        {order.priority_rank}
                      </span>
                    </td>
                    <td className="py-2">{order.ward_name}</td>
                    <td className="py-2">{order.swapi_score?.toFixed(2)}</td>
                    <td className="py-2">{order.officer_count}</td>
                    <td className="py-2">{order.larvicide_litres}</td>
                    <td className="py-2">{order.target_sector}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          order.status === "confirmed"
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-slate-500/30 text-slate-200"
                        }`}
                      >
                        {order.status || "pending"}
                      </span>
                    </td>
                    <td className="py-2 flex flex-col gap-2">
                      <button
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [order.ward_id]: !prev[order.ward_id],
                          }))
                        }
                        className="rounded bg-cyan-500/20 px-2 py-1 text-xs text-cyan-200 btn"
                      >
                        View AI Reasoning
                      </button>
                      <button
                        onClick={() => confirmDispatch(order.ward_id)}
                        className="rounded bg-amber-400 px-2 py-1 text-xs text-[#0b1220] btn btn-amber"
                      >
                        Confirm Dispatch
                      </button>
                    </td>
                  </tr>
                  {expanded[order.ward_id] && (
                    <tr className="bg-white/5">
                      <td colSpan={8} className="p-3 text-xs">
                        <div className="font-semibold mb-1">Reasoning</div>
                        <div>{order.reasoning || order.llm_reasoning}</div>
                        <div className="mt-2 italic text-slate-400">
                          {order.rag_citation}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
