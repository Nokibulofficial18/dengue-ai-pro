import { useState } from "react";

export default function AIInsightsPanel({ onOpenRAG }) {
  const [selectedInsight, setSelectedInsight] = useState(null);

  const insights = [
    {
      id: "mirpur",
      color: "rose",
      borderColor: "border-[#F45B79]/40",
      bgColor: "bg-[#4A1B28]/25 hover:bg-[#4A1B28]/40",
      iconBg: "bg-[#4A1B28] text-[#F45B79] border-[#F45B79]/40",
      titleColor: "text-[#F45B79]",
      title: "Increased risk in Mirpur wards",
      desc: "Higher predicted risk in Mirpur (Wards 12, 13, 14) based on recent reports, weather patterns and historical trends.",
      guidance: "WHO Protocol: Accelerate Bti larvicide application in open storm water channels. Increase inspection frequency to 7-day intervals.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      id: "badda",
      color: "amber",
      borderColor: "border-[#F6BA49]/40",
      bgColor: "bg-[#4A3515]/25 hover:bg-[#4A3515]/40",
      iconBg: "bg-[#4A3515] text-[#F6BA49] border-[#F6BA49]/40",
      titleColor: "text-[#F6BA49]",
      title: "Stagnant water hotspots identified",
      desc: "Potential breeding sites detected from satellite imagery and citizen reports in parts of Badda and Demra.",
      guidance: "DGHS Guideline: Inspect industrial construction perimeters, uncovered roof water sumps, and basement car parks within 48 hours.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      id: "community",
      color: "violet",
      borderColor: "border-[#9B83F5]/40",
      bgColor: "bg-[#2E1E4D]/25 hover:bg-[#2E1E4D]/40",
      iconBg: "bg-[#2E1E4D] text-[#9B83F5] border-[#9B83F5]/40",
      titleColor: "text-[#9B83F5]",
      title: "Community outreach recommended",
      desc: "Increase awareness and source reduction activities in Mohammadpur and Badda based on rising risk and report volume.",
      guidance: "Public Health Action: Dispatch volunteer brigades for doorstep container emptying and distribution of temephos larvicide granules.",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="midnight-card p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1B3654]/60">
        <div className="flex items-center gap-2">
          <span className="text-[#46C8E5] text-base leading-none">✦</span>
          <span className="text-sm font-bold text-white">AI Insights</span>
        </div>
        <span className="text-[10px] text-[#9FB3C9]">
          Al-assisted analysis • Demo data
        </span>
      </div>

      {/* 3 Insight Cards */}
      <div className="space-y-2.5">
        {insights.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedInsight(item)}
            className={`p-3 rounded-xl border ${item.borderColor} ${item.bgColor} cursor-pointer transition-all flex items-start gap-3 group`}
          >
            {/* Left Category Icon */}
            <div
              className={`w-8 h-8 rounded-lg border ${item.iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}
            >
              {item.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className={`text-xs font-bold ${item.titleColor}`}>
                  {item.title}
                </div>
                <span className="text-white/40 group-hover:text-white transition-colors text-xs font-bold pl-1">
                  ›
                </span>
              </div>
              <p className="text-[11px] text-[#9FB3C9] mt-0.5 leading-relaxed line-clamp-2">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal if clicked */}
      {selectedInsight && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="midnight-card max-w-md w-full p-6 animate-in fade-in zoom-in-95 border-[#46C8E5]/40 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className={`text-sm font-bold ${selectedInsight.titleColor}`}>
                {selectedInsight.title}
              </span>
              <button
                onClick={() => setSelectedInsight(null)}
                className="text-[#9FB3C9] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-[10px] uppercase font-semibold text-[#9FB3C9]">Observation</div>
                <p className="text-xs text-white mt-1">{selectedInsight.desc}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#172C45] border border-white/10">
                <div className="text-[10px] uppercase font-semibold text-[#46C8E5]">Protocol Recommendation</div>
                <p className="text-xs text-slate-200 mt-1">{selectedInsight.guidance}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSelectedInsight(null)}
                className="midnight-btn-secondary text-xs py-1.5 px-3"
              >
                Close
              </button>
              {onOpenRAG && (
                <button
                  onClick={() => {
                    setSelectedInsight(null);
                    onOpenRAG();
                  }}
                  className="midnight-btn-primary text-xs py-1.5 px-3"
                >
                  Ask AI Assistant →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
