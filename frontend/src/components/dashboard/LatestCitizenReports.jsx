import { useState } from "react";
import { Link } from "react-router-dom";

export default function LatestCitizenReports({ onOpenReportModal }) {
  const [selectedReport, setSelectedReport] = useState(null);

  const reports = [
    {
      id: 1,
      title: "Discarded Plastic Sump Retention",
      ward: "Mirpur (Ward 13)",
      time: "2 hours ago",
      risk: "High",
      riskStyle: "bg-rose-500/10 text-rose-400 border-rose-500/25",
      notes: "Discarded plastic container with visible mosquito larvae behind residential garage.",
      type: "Surface Pooling",
    },
    {
      id: 2,
      title: "Balcony Plant Reservoir Stagnation",
      ward: "Badda (Ward 30)",
      time: "4 hours ago",
      risk: "High",
      riskStyle: "bg-rose-500/10 text-rose-400 border-rose-500/25",
      notes: "Commercial apartment balcony with 8 deep pooling planters collecting rainfall.",
      type: "Balcony Reservoir",
    },
    {
      id: 3,
      title: "Blocked Street Drainage Culvert",
      ward: "Mohammadpur (Ward 22)",
      time: "6 hours ago",
      risk: "Medium",
      riskStyle: "bg-amber-500/10 text-amber-400 border-amber-500/25",
      notes: "Heavy mosquito swarming near blocked surface storm drain on Block C.",
      type: "Drainage Culvert",
    },
    {
      id: 4,
      title: "Open Rooftop Concrete Reservoir",
      ward: "Tejgaon (Ward 25)",
      time: "9 hours ago",
      risk: "Medium",
      riskStyle: "bg-amber-500/10 text-amber-400 border-amber-500/25",
      notes: "Rooftop concrete reservoir with broken cover collecting rainwater.",
      type: "Overhead Sump",
    },
  ];

  return (
    <div className="midnight-card p-4 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-white tracking-tight">Recent Community Reports</div>
            <div className="text-[10px] text-slate-400">Photographic hazard surveillance</div>
          </div>
        </div>
        <Link
          to="/citizen"
          className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
        >
          <span>All Reports</span>
          <span>→</span>
        </Link>
      </div>

      {/* Report items */}
      <div className="divide-y divide-white/[0.05] -my-1">
        {reports.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedReport(item)}
            className="py-2.5 px-1.5 hover:bg-white/[0.02] transition-colors flex items-center justify-between gap-3 cursor-pointer group rounded"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors truncate">
                {item.title}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span>{item.ward}</span>
                </span>
                <span>•</span>
                <span className="font-mono text-slate-500">{item.time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${item.riskStyle}`}>
                {item.risk}
              </span>
              <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Action */}
      <div className="pt-2.5 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
        <Link
          to="/citizen"
          className="text-slate-400 hover:text-white transition-colors"
        >
          View Citizen Leaderboard
        </Link>
        <button
          onClick={onOpenReportModal}
          className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
        >
          + Submit Report
        </button>
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="midnight-card max-w-sm w-full p-5 border-white/[0.12] shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] mb-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${selectedReport.riskStyle}`}>
                {selectedReport.risk} Severity
              </span>
              <button
                onClick={() => setSelectedReport(null)}
                className="w-7 h-7 rounded-md bg-[#08111D] text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <h3 className="text-sm font-bold text-white mb-1">{selectedReport.title}</h3>
            <div className="text-[11px] text-slate-400 font-mono mb-3">
              Location: {selectedReport.ward} • {selectedReport.time}
            </div>

            <div className="p-3 rounded-lg bg-[#08111D] border border-white/[0.06] text-xs text-slate-300 mb-4 font-mono leading-relaxed">
              "{selectedReport.notes}"
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="midnight-btn-secondary text-xs py-1.5 px-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
