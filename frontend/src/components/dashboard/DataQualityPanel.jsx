export default function DataQualityPanel() {
  const feedItems = [
    {
      id: "citizen",
      name: "Civic Reports Stream",
      latency: "12m ago",
      status: "Active",
      statusStyle: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "field",
      name: "Field Crew Telemetry",
      latency: "28m ago",
      status: "Active",
      statusStyle: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "weather",
      name: "BMD Precipitation Grid",
      latency: "1h ago",
      status: "Synced",
      statusStyle: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    },
    {
      id: "satellite",
      name: "Multispectral Sump Radar",
      latency: "3h ago",
      status: "Nominal",
      statusStyle: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    },
    {
      id: "health",
      name: "DGHS Hospital Sentinel",
      latency: "6h ago",
      status: "Verified",
      statusStyle: "text-slate-400 bg-white/[0.04] border-white/[0.08]",
    },
  ];

  return (
    <div className="midnight-card p-4 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-white tracking-tight">Data Stream Integrity</div>
            <div className="text-[10px] text-slate-400">Multi-source pipeline health</div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono text-emerald-400 font-semibold">94% Confidence</span>
          <div className="text-[9px] font-mono text-slate-500">99.8% SLA</div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="px-3 py-2 rounded-lg bg-[#0E1827] border border-white/[0.05] mb-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-200 font-medium text-[11px]">5 of 5 Feeds Synchronized</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">140ms latency</span>
      </div>

      {/* Feed Stream Rows */}
      <div className="space-y-1">
        {feedItems.map((feed) => (
          <div
            key={feed.id}
            className="px-2.5 py-1.5 rounded-md hover:bg-[#0E1827]/80 transition-colors flex items-center justify-between text-xs"
          >
            <span className="text-slate-300 font-medium text-[11px] truncate">{feed.name}</span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-mono text-slate-500">{feed.latency}</span>
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                <span className={`w-1.5 h-1.5 rounded-full ${feed.status === "Active" ? "bg-emerald-400" : feed.status === "Synced" ? "bg-sky-400" : "bg-slate-400"}`} />
                {feed.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="pt-2 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Model Version: SWAPI-4.2</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Live Pipeline
        </span>
      </div>
    </div>
  );
}
