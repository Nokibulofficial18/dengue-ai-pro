import { useState } from "react";

export default function AIInsightsPanel({ onOpenRAG }) {
  const [selectedInsight, setSelectedInsight] = useState(null);

  const insights = [
    {
      id: "mirpur",
      priority: "CRITICAL",
      badgeStyle: "bg-rose-500/10 text-rose-400 border-rose-500/25",
      title: "Elevated Vector Index in Mirpur Wards 12–14",
      desc: "Historical precipitation patterns combined with satellite pooling telemetry indicate rapid Aedes aegypti breeding velocity.",
      protocol: "WHO Vector Control Protocol",
      action: "Accelerate Bacillus thuringiensis israelensis (Bti) larvicide application in open storm channels. Enforce 7-day inspection cycles.",
    },
    {
      id: "badda",
      priority: "ELEVATED",
      badgeStyle: "bg-amber-500/10 text-amber-400 border-amber-500/25",
      title: "Basement & Construction Sump Stagnation Detected",
      desc: "Cross-referenced civic photo reports pinpoint 14 unpumped retention sumps in Badda & Demra industrial sectors.",
      protocol: "DGHS Environmental Guidelines",
      action: "Issue Section 12 Municipal notice for dewatering or temephos larvicidal treatment within 48 hours.",
    },
    {
      id: "community",
      priority: "ADVISORY",
      badgeStyle: "bg-sky-500/10 text-sky-400 border-sky-500/25",
      title: "Community Source Reduction Mobilization",
      desc: "Rising report frequency in Mohammadpur residential plots indicates high roof water container retention.",
      protocol: "Civic Health Surveillance",
      action: "Deploy ward volunteer brigades for doorstep container inversion and distribution of targeted larvicide granules.",
    },
  ];

  return (
    <div className="midnight-card p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-white tracking-tight">Clinical AI Insights</div>
            <div className="text-[10px] text-slate-400">WHO &amp; DGHS protocol grounded</div>
          </div>
        </div>

        {onOpenRAG && (
          <button
            onClick={onOpenRAG}
            className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
          >
            <span>Ask Protocol AI</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* Insight Items */}
      <div className="divide-y divide-white/[0.05] -my-1">
        {insights.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedInsight(item)}
            className="py-2.5 px-1.5 hover:bg-white/[0.02] cursor-pointer transition-colors rounded group"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold border ${item.badgeStyle}`}>
                {item.priority}
              </span>
              <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300 transition-colors">
                {item.protocol}
              </span>
            </div>
            <div className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
              {item.title}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                {item.desc}
              </p>
              <span className="text-[10px] text-sky-400 group-hover:text-sky-300 font-medium shrink-0 flex items-center gap-0.5">
                Review →
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Insight Detail Modal Drawer */}
      {selectedInsight && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="midnight-card max-w-lg w-full p-5 border-white/[0.12] shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${selectedInsight.badgeStyle}`}>
                  {selectedInsight.priority}
                </span>
                <span className="text-xs text-slate-400 font-mono">{selectedInsight.protocol}</span>
              </div>
              <button
                onClick={() => setSelectedInsight(null)}
                className="w-7 h-7 rounded-md bg-[#08111D] text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <h3 className="text-sm font-bold text-white mb-2">{selectedInsight.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">{selectedInsight.desc}</p>

            <div className="p-3 rounded-lg bg-[#08111D] border border-white/[0.06] mb-4">
              <div className="text-[10px] font-mono uppercase text-sky-400 font-semibold mb-1">
                Prescribed Response Protocol
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-mono">
                {selectedInsight.action}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedInsight(null)}
                className="midnight-btn-secondary text-xs py-1.5 px-3"
              >
                Close Briefing
              </button>
              {onOpenRAG && (
                <button
                  onClick={() => {
                    setSelectedInsight(null);
                    onOpenRAG();
                  }}
                  className="midnight-btn-primary text-xs py-1.5 px-3"
                >
                  Query Clinical AI →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
