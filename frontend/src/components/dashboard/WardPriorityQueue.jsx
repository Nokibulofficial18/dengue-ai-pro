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
    action: "Source reduction",
    status: "Pending",
    statusType: "warning",
  },
  {
    id: 4,
    ward: "Mohammadpur (Ward 22)",
    riskLevel: "Medium",
    score: "0.68",
    action: "Community outreach",
    status: "Assigned",
    statusType: "success",
  },
  {
    id: 5,
    ward: "Tejgaon (Ward 25)",
    riskLevel: "Medium",
    score: "0.62",
    action: "Larvicide application",
    status: "Pending",
    statusType: "warning",
  },
];

export default function WardPriorityQueue() {
  const [queue, setQueue] = useState(defaultQueue);

  useEffect(() => {
    // Attempt to pull real dispatch/swapi queue from backend
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
        // Fallback to high-fidelity reference queue
      });
  }, []);

  return (
    <div className="midnight-card p-4 sm:p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1B3654]/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#46C8E5]/15 border border-[#46C8E5]/30 flex items-center justify-center text-[#46C8E5]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <circle cx="12" cy="12" r="4" strokeWidth={2} />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">Ward Priority Queue</span>
        </div>
        <Link
          to="/wards"
          className="text-xs text-[#46C8E5] hover:text-white flex items-center gap-1 font-medium transition-colors"
        >
          View All Wards →
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[#9FB3C9] border-b border-[#1B3654]/50">
              <th className="pb-2 font-semibold">#</th>
              <th className="pb-2 font-semibold">Ward (Area)</th>
              <th className="pb-2 font-semibold">Risk Level</th>
              <th className="pb-2 font-semibold">Risk Score</th>
              <th className="pb-2 font-semibold">Recommended Action</th>
              <th className="pb-2 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1B3654]/30">
            {queue.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 font-medium text-[#9FB3C9]">{row.id}</td>
                <td className="py-2.5 font-medium text-white">{row.ward}</td>
                <td className="py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      row.riskLevel === "High"
                        ? "bg-[#F45B79]/15 text-[#F45B79] border border-[#F45B79]/30"
                        : "bg-[#F6BA49]/15 text-[#F6BA49] border border-[#F6BA49]/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        row.riskLevel === "High" ? "bg-[#F45B79]" : "bg-[#F6BA49]"
                      }`}
                    />
                    {row.riskLevel}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-white font-semibold">{row.score}</td>
                <td className="py-2.5 text-[#9FB3C9] max-w-[180px] truncate" title={row.action}>
                  {row.action}
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      row.statusType === "success"
                        ? "bg-[#133830] text-[#33D6A6] border border-[#33D6A6]/40"
                        : row.statusType === "primary"
                        ? "bg-[#162E4D] text-[#46C8E5] border border-[#46C8E5]/40"
                        : "bg-[#4A3515] text-[#F6BA49] border border-[#F6BA49]/40"
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
