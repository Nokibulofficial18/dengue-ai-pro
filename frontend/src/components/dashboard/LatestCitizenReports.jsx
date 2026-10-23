import { useState } from "react";
import { Link } from "react-router-dom";

export default function LatestCitizenReports({ onOpenReportModal }) {
  const [selectedReport, setSelectedReport] = useState(null);

  const reports = [
    {
      id: 1,
      title: "Stagnant water in container",
      ward: "Mirpur (Ward 13)",
      time: "2 hours ago",
      risk: "High",
      riskColor: "#F45B79",
      bgRisk: "bg-[#F45B79]/15 text-[#F45B79] border-[#F45B79]/30",
      notes: "Discarded plastic container with visible mosquito larvae behind residential garage.",
      // High-fidelity SVG illustration thumbnail
      thumb: (
        <svg className="w-full h-full text-[#46C8E5]" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="8" fill="#172C45" />
          <path d="M12 14 L28 14 L25 30 L15 30 Z" fill="#20354D" stroke="#46C8E5" strokeWidth="1.5" />
          <ellipse cx="20" cy="18" rx="5" ry="2" fill="#46C8E5" opacity="0.6" />
        </svg>
      ),
    },
    {
      id: 2,
      title: "Potential breeding site",
      ward: "Badda (Ward 30)",
      time: "4 hours ago",
      risk: "High",
      riskColor: "#F45B79",
      bgRisk: "bg-[#F45B79]/15 text-[#F45B79] border-[#F45B79]/30",
      notes: "Flower pots with pooled rainwater on apartment balcony ledge.",
      thumb: (
        <svg className="w-full h-full text-[#F6BA49]" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="8" fill="#172C45" />
          <path d="M14 16 L26 16 L24 28 L16 28 Z" fill="#20354D" stroke="#F6BA49" strokeWidth="1.5" />
          <circle cx="20" cy="13" r="3" fill="#33D6A6" />
        </svg>
      ),
    },
    {
      id: 3,
      title: "Mosquito presence",
      ward: "Mohammadpur (Ward 22)",
      time: "6 hours ago",
      risk: "Medium",
      riskColor: "#F6BA49",
      bgRisk: "bg-[#F6BA49]/15 text-[#F6BA49] border-[#F6BA49]/30",
      notes: "Heavy mosquito swarming near blocked surface storm drain.",
      thumb: (
        <svg className="w-full h-full text-[#9B83F5]" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="8" fill="#172C45" />
          <path d="M10 24 Q 20 18 30 24" stroke="#9B83F5" strokeWidth="2" fill="none" />
          <circle cx="20" cy="15" r="2" fill="#F45B79" />
          <line x1="16" y1="12" x2="24" y2="18" stroke="#9FB3C9" strokeWidth="1" />
        </svg>
      ),
    },
    {
      id: 4,
      title: "Open water tank",
      ward: "Tejgaon (Ward 25)",
      time: "9 hours ago",
      risk: "Medium",
      riskColor: "#F6BA49",
      bgRisk: "bg-[#F6BA49]/15 text-[#F6BA49] border-[#F6BA49]/30",
      notes: "Rooftop concrete reservoir with broken cover collecting rainwater.",
      thumb: (
        <svg className="w-full h-full text-[#46C8E5]" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="8" fill="#172C45" />
          <rect x="12" y="14" width="16" height="14" rx="2" fill="#20354D" stroke="#46C8E5" strokeWidth="1.5" />
          <line x1="10" y1="14" x2="30" y2="14" stroke="#33D6A6" strokeWidth="2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="midnight-card p-4 sm:p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#1B3654]/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#46C8E5]/15 border border-[#46C8E5]/30 flex items-center justify-center text-[#46C8E5]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">Latest Citizen Reports</span>
        </div>
        <span className="text-[10px] text-[#9FB3C9]">Illustrative report feed</span>
      </div>

      {/* Report items */}
      <div className="space-y-2">
        {reports.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedReport(item)}
            className="p-2 sm:p-2.5 rounded-xl bg-[#172C45]/50 hover:bg-[#172C45] border border-white/5 hover:border-[#46C8E5]/30 transition-all flex items-center gap-3 cursor-pointer group"
          >
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
              {item.thumb}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate group-hover:text-[#46C8E5] transition-colors">
                {item.title}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#9FB3C9] mt-0.5 flex-wrap">
                <span className="flex items-center gap-0.5">
                  📍 {item.ward}
                </span>
                <span>•</span>
                <span>🕒 {item.time}</span>
              </div>
            </div>

            {/* Badge & Chevron */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${item.bgRisk}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: item.riskColor }}
                />
                {item.risk}
              </span>
              <span className="text-[#9FB3C9] group-hover:text-white transition-colors text-xs font-bold pl-1">
                ›
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Action */}
      <div className="pt-2 mt-2 border-t border-[#1B3654]/40 flex items-center justify-between">
        <Link
          to="/citizen"
          className="text-[11px] text-[#46C8E5] hover:underline flex items-center gap-1 font-medium"
        >
          Open Citizen Portal →
        </Link>
        <button
          onClick={onOpenReportModal}
          className="text-[11px] text-[#33D6A6] hover:underline font-medium"
        >
          + Submit New Report
        </button>
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="midnight-card max-w-sm w-full p-5 border-[#46C8E5]/40 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="text-xs font-bold text-white">{selectedReport.title}</div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-[#9FB3C9] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="text-[#9FB3C9]">Location: <span className="text-white font-medium">{selectedReport.ward}</span></div>
              <div className="text-[#9FB3C9]">Submitted: <span className="text-white">{selectedReport.time}</span></div>
              <div className="text-[#9FB3C9]">Severity: <span className="font-bold" style={{ color: selectedReport.riskColor }}>{selectedReport.risk} Risk</span></div>
              <div className="p-2.5 rounded-lg bg-[#0D1C2E] text-slate-300 mt-2">
                "{selectedReport.notes}"
              </div>
            </div>
            <div className="mt-4 flex justify-end">
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
