import { useState } from "react";
import { Link } from "react-router-dom";
import DispatchDashboard from "../components/DispatchDashboard.jsx";
import LLMChat from "../components/LLMChat.jsx";

export default function Authority() {
  const [tab, setTab] = useState("dispatch");

  return (
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="midnight-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
              Field Operations &amp; Vector Control Command
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              Active Deployment
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational crew assignments, Bti larvicide dosage calculations, and WHO/DGHS clinical protocols
          </p>
        </div>

        {/* Operational Modules Quick Links */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/authority/sites"
            className="midnight-btn-secondary text-xs py-1.5 px-2.5"
          >
            Site Registry
          </Link>
          <Link
            to="/authority/scheduling"
            className="midnight-btn-secondary text-xs py-1.5 px-2.5"
          >
            Scheduling
          </Link>
          <Link
            to="/authority/services"
            className="midnight-btn-secondary text-xs py-1.5 px-2.5"
          >
            Service Orders
          </Link>
          <Link
            to="/authority/repair-planning"
            className="midnight-btn-secondary text-xs py-1.5 px-2.5"
          >
            Repair Economics
          </Link>
          <Link
            to="/authority/coordination"
            className="midnight-btn-primary text-xs py-1.5 px-2.5"
          >
            Consortium Hub
          </Link>
        </div>
      </div>

      {/* Mobile Tab Toggle */}
      <div className="md:hidden flex rounded-lg bg-[#08111D] p-1 border border-white/[0.08]">
        <button
          onClick={() => setTab("dispatch")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
            tab === "dispatch" ? "bg-sky-600 text-white font-semibold" : "text-slate-400"
          }`}
        >
          Dispatch Queue
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
            tab === "chat" ? "bg-sky-600 text-white font-semibold" : "text-slate-400"
          }`}
        >
          Clinical Protocol AI
        </button>
      </div>

      {/* Main Grid: Dispatch Dashboard + LLM Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <div className={`lg:col-span-7 xl:col-span-8 ${tab === "dispatch" ? "block" : "hidden"} md:block`}>
          <DispatchDashboard />
        </div>
        <div className={`lg:col-span-5 xl:col-span-4 ${tab === "chat" ? "block" : "hidden"} md:block`}>
          <div className="midnight-card p-4 h-full flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-3 mb-2.5 border-b border-white/[0.07]">
              <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white tracking-tight">Clinical Protocol AI</h3>
                <div className="text-[10px] text-slate-400 font-mono">WHO &amp; DGHS reference guidance</div>
              </div>
            </div>
            <LLMChat />
          </div>
        </div>
      </div>
    </div>
  );
}
