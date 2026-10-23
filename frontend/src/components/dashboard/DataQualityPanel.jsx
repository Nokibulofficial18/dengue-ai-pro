export default function DataQualityPanel() {
  const feedItems = [
    {
      id: "citizen",
      name: "Citizen reports (app)",
      update: "Last update: 10 min ago",
      icon: (
        <svg className="w-3.5 h-3.5 text-[#46C8E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: "field",
      name: "Field team updates",
      update: "Last update: 28 min ago",
      icon: (
        <svg className="w-3.5 h-3.5 text-[#33D6A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: "weather",
      name: "Weather data (open source)",
      update: "Last update: 1 hour ago",
      icon: (
        <svg className="w-3.5 h-3.5 text-[#46C8E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
    },
    {
      id: "satellite",
      name: "Satellite imagery",
      update: "Last update: 3 hours ago",
      icon: (
        <svg className="w-3.5 h-3.5 text-[#9B83F5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      ),
    },
    {
      id: "health",
      name: "Health facility data (mock)",
      update: "Last update: 6 hours ago",
      icon: (
        <svg className="w-3.5 h-3.5 text-[#F6BA49]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">Data Quality &amp; Mock Feed</span>
        </div>
        <span className="text-[10px] text-[#46C8E5] px-2 py-0.5 rounded bg-[#1B3654] border border-[#46C8E5]/20 font-medium">
          Demo system status
        </span>
      </div>

      {/* Circular Progress Gauge Section */}
      <div className="flex items-center gap-4 p-2.5 rounded-xl bg-[#172C45]/50 border border-white/5 mb-3">
        {/* Ring Gauge */}
        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
            {/* Background Circle */}
            <path
              className="text-[#1B3654]"
              strokeWidth="3.2"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            {/* Progress Stroke 94% */}
            <path
              className="text-[#46C8E5]"
              strokeDasharray="94, 100"
              strokeWidth="3.2"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-sm font-extrabold text-white">94%</span>
        </div>

        {/* Text next to ring */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#33D6A6]">
            <span className="w-2 h-2 rounded-full bg-[#33D6A6] shadow-sm shadow-[#33D6A6]/50" />
            Demo feed
          </div>
          <p className="text-[11px] text-[#9FB3C9] mt-0.5 leading-snug">
            All data sources connected (mock data for demonstration)
          </p>
        </div>
      </div>

      {/* Feed Status List */}
      <div className="space-y-1.5">
        {feedItems.map((feed) => (
          <div
            key={feed.id}
            className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 text-slate-200">
              <span className="shrink-0">{feed.icon}</span>
              <span className="text-[11px] truncate">{feed.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#9FB3C9] shrink-0 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#33D6A6]" />
              <span>{feed.update}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
