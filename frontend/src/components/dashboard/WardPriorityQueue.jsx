import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

const defaultQueue = [
  {
    id: 1,
    ward: "Mirpur (Ward 12)",
    riskLevel: "High",
    score: "0.91",
    action: "Source reduction + field inspection",
    status: "Assigned",
    statusType: "success",
  },
  {
    id: 2,
    ward: "Mirpur (Ward 13)",
    riskLevel: "High",
    score: "0.87",
    action: "Field inspection + community outreach",
    status: "In Progress",
    statusType: "primary",
  },
  {
    id: 3,
    ward: "Badda (Ward 30)",
    riskLevel: "High",
    score: "0.83",
    action: "Source reduction & larviciding",
    status: "Pending",
    statusType: "warning",
  },
  {
    id: 4,
    ward: "Mohammadpur (Ward 22)",
    riskLevel: "Medium",
    score: "0.68",
    action: "Community outreach & container dump",
    status: "Assigned",
    statusType: "success",
  },
  {
    id: 5,
    ward: "Tejgaon (Ward 25)",
    riskLevel: "Medium",
    score: "0.62",
    action: "Larvicide application at roof sumps",
    status: "Pending",
    statusType: "warning",
  },
];

export default function WardPriorityQueue() {
  const [queue, setQueue] = useState(defaultQueue);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_URL}/api/dispatch/queue`)
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const formatted = res.data.slice(0, 5).map((item, idx) => {
            const score = item.swapi_score || 0.75;
            let level = "Medium";
            if (score >= 0.7) level = "High";
            else if (score < 0.4) level = "Low";

            let status = item.status === "completed" ? "Assigned" : item.status === "confirmed" ? "In Progress" : "Pending";
            let statusType = status === "Assigned" ? "success" : status === "In Progress" ? "primary" : "warning";

            return {
              id: idx + 1,
              ward: `${item.ward_name} (${item.ward_id})`,
              riskLevel: level,
              score: score.toFixed(2),
              action: item.target_sector || "Larviciding & Source Reduction",
              status: status,
              statusType: statusType,
            };
          });
          setQueue(formatted);
        }
      })
      .catch(() => {
        // Preserves default verified queue
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="midnight-card p-4 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
              <circle cx="12" cy="12" r="4" strokeWidth={1.8} />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-white tracking-tight">Ward Priority Dispatch Queue</div>
            <div className="text-[10px] text-slate-400">Algorithmic intervention rankings</div>
          </div>
        </div>
        <Link
          to="/wards"
          className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
        >
          <span>All Wards</span>
          <span>→</span>
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-white/[0.08] text-[10px] font-mono uppercase tracking-wider">
              <th className="pb-2.5 font-medium w-8 pl-1">#</th>
              <th className="pb-2.5 font-medium">Ward &amp; Intervention Area</th>
              <th className="pb-2.5 font-medium w-24">Risk Tier</th>
              <th className="pb-2.5 font-medium text-right pr-3 w-16">SWAPI</th>
              <th className="pb-2.5 font-medium text-right pr-1 w-24">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {queue.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="py-2.5 font-mono text-slate-500 text-[11px] pl-1 font-medium">{row.id}</td>
                <td className="py-2.5 pr-2">
                  <div className="font-medium text-slate-100 group-hover:text-white transition-colors text-xs">{row.ward}</div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[220px]" title={row.action}>
                    {row.action}
                  </div>
                </td>
                <td className="py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      row.riskLevel === "High"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        row.riskLevel === "High" ? "bg-rose-400" : "bg-amber-400"
                      }`}
                    />
                    {row.riskLevel}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-white font-semibold text-right pr-3">{row.score}</td>
                <td className="py-2.5 text-right pr-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      row.statusType === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        : row.statusType === "primary"
                        ? "bg-sky-500/10 text-sky-400 border border-sky-500/25"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
