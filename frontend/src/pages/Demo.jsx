import { Link } from "react-router-dom";

const features = [
  {
    icon: "🧠",
    title: "SWAPI Risk Engine",
    description: "Hyper-local dengue risk scoring across Dhaka wards.",
  },
  {
    icon: "🛰️",
    title: "Satellite & Weather",
    description: "Monsoon precipitation and drainage coefficient modeling.",
  },
  {
    icon: "🤖",
    title: "LLM Dispatch",
    description: "AI-generated field crew orders with WHO guideline citations.",
  },
  {
    icon: "📚",
    title: "RAG Knowledge",
    description: "Grounded responses from DGHS and WHO clinical guidance.",
  },
  {
    icon: "🧪",
    title: "Citizen Reporting",
    description: "Community-powered stagnant water detection and points.",
  },
];

export default function Demo() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4 animate-in fade-in">
      {/* Hero Banner */}
      <div className="midnight-card p-8 md:p-12 text-center relative overflow-hidden border-[#46C8E5]/30">
        <div className="absolute inset-0 bg-gradient-to-r from-[#46C8E5]/10 via-[#9B83F5]/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#1B3654] text-[#46C8E5] border border-[#46C8E5]/30 mb-4">
            ✨ Public Health Intelligence Initiative
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
            DengueAI <span className="text-[#46C8E5]">Pro</span>
          </h1>
          <p className="text-lg md:text-xl text-[#F2F7FF] mb-3 font-semibold">
            Predict • Prevent • Protect Dhaka
          </p>
          <p className="text-sm text-[#9FB3C9] mb-8 max-w-2xl mx-auto leading-relaxed">
            AI-native dengue risk intelligence combining nonlinear SWAPI environmental modeling,
            permanent facility hazard tracking, smart reinspection scheduling, and inter-property consortium coordination.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="midnight-btn-primary px-6 py-2.5 text-sm font-semibold flex items-center gap-2"
            >
              <span>📊</span> Open Health Intelligence Center
            </Link>
            <Link
              to="/map"
              className="midnight-btn-secondary px-6 py-2.5 text-sm font-semibold flex items-center gap-2"
            >
              <span>🗺️</span> Explore Live Map
            </Link>
            <Link
              to="/citizen"
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-[#162E4D] text-[#46C8E5] border border-[#46C8E5]/40 hover:bg-[#1B3654] transition flex items-center gap-2"
            >
              <span>📸</span> Submit Report
            </Link>
          </div>
        </div>
      </div>

      {/* Core Features Grid */}
      <div className="midnight-card p-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white">How The Platform Operates</h2>
          <p className="text-xs text-[#9FB3C9]">Five core technologies operating concurrently</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-4 rounded-xl bg-[#172C45]/60 border border-white/5 text-left hover:border-[#46C8E5]/40 transition"
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="font-bold text-white mb-1 text-xs">{feature.title}</div>
              <div className="text-[11px] text-[#9FB3C9] leading-relaxed">{feature.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Step Workflow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="midnight-card p-6 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-full bg-[#162E4D] text-[#46C8E5] font-bold text-sm flex items-center justify-center mb-3">
              1
            </div>
            <div className="text-base font-bold text-white mb-2">Explore Ward Risk</div>
            <p className="text-xs text-[#9FB3C9] leading-relaxed mb-4">
              Open the interactive heat map to evaluate ward-level SWAPI risk scores. Inspect environmental factor contributions like rainfall and drainage.
            </p>
          </div>
          <Link to="/" className="text-xs font-semibold text-[#46C8E5] hover:underline">
            → Health Intelligence Center
          </Link>
        </div>

        <div className="midnight-card p-6 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-full bg-[#133830] text-[#33D6A6] font-bold text-sm flex items-center justify-center mb-3">
              2
            </div>
            <div className="text-base font-bold text-white mb-2">Citizen Reporting</div>
            <p className="text-xs text-[#9FB3C9] leading-relaxed mb-4">
              Encounter stagnant water? Upload a smartphone photo to notify municipal response teams and earn community gamification points.
            </p>
          </div>
          <Link to="/citizen" className="text-xs font-semibold text-[#33D6A6] hover:underline">
            → Citizen Reporting Portal
          </Link>
        </div>

        <div className="midnight-card p-6 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-full bg-[#4A3515] text-[#F6BA49] font-bold text-sm flex items-center justify-center mb-3">
              3
            </div>
            <div className="text-base font-bold text-white mb-2">Field Operations</div>
            <p className="text-xs text-[#9FB3C9] leading-relaxed mb-4">
              Review AI-prioritized crew dispatch recommendations, larvicide dosages, and verify contractor cleanup evidence.
            </p>
          </div>
          <Link to="/authority" className="text-xs font-semibold text-[#F6BA49] hover:underline">
            → Authority Operations Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
