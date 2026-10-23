import { useState } from "react";
import { Link } from "react-router-dom";
import DispatchDashboard from "../components/DispatchDashboard.jsx";
import LLMChat from "../components/LLMChat.jsx";

export default function Authority() {
  const [tab, setTab] = useState("dispatch");

  return (
    <div className="space-y-5 max-w-[1720px] mx-auto animate-in fade-in">
      {/* Header Banner */}
      <div className="midnight-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-[#46C8E5]/30">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-white">
              Authority Field Operations &amp; Vector Control Command
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#133830] text-[#33D6A6] border border-[#33D6A6]/40">
              Active Operations
            </span>
          </div>
          <p className="text-xs text-[#9FB3C9] mt-1">
            Real-time crew dispatching, larvicide dosage recommendations, and WHO/DGHS-grounded clinical guidance
          </p>
        </div>

        {/* Quick Links to Improvements 1–5 */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/authority/coordination"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#172C45] hover:bg-[#20354D] text-[#46C8E5] border border-[#46C8E5]/30 transition"
          >
            🤝 Consortium Hub
          </Link>
          <Link
            to="/authority/repair-planning"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#172C45] hover:bg-[#20354D] text-[#33D6A6] border border-[#33D6A6]/30 transition"
          >
            💰 Repair Planning
          </Link>
          <Link
            to="/authority/services"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#172C45] hover:bg-[#20354D] text-[#9B83F5] border border-[#9B83F5]/30 transition"
          >
            🛠️ Service Orders
          </Link>
          <Link
            to="/authority/scheduling"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#172C45] hover:bg-[#20354D] text-[#F6BA49] border border-[#F6BA49]/30 transition"
          >
            📅 Reinspection
          </Link>
          <Link
            to="/authority/sites"
            className="midnight-btn-primary text-xs py-1.5 px-3"
          >
            🏛️ Site Registry
          </Link>
        </div>
      </div>

      {/* Mobile Tab Toggle */}
      <div className="md:hidden flex rounded-xl bg-[#0C1829] p-1 border border-[#1B3654]">
        <button
          onClick={() => setTab("dispatch")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            tab === "dispatch" ? "bg-[#1E6FD9] text-white" : "text-[#9FB3C9]"
          }`}
        >
          Dispatch Queue
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
            tab === "chat" ? "bg-[#1E6FD9] text-white" : "text-[#9FB3C9]"
          }`}
        >
          RAG AI Guidance
        </button>
      </div>

      {/* Main Grid: Dispatch Dashboard + LLM Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={`lg:col-span-7 xl:col-span-8 ${tab === "dispatch" ? "block" : "hidden"} md:block`}>
          <DispatchDashboard />
        </div>
        <div className={`lg:col-span-5 xl:col-span-4 ${tab === "chat" ? "block" : "hidden"} md:block`}>
          <div className="midnight-card p-5">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#1B3654]/60">
              <span className="text-[#46C8E5]">🤖</span>
              <h3 className="text-sm font-bold text-white">WHO / DGHS RAG Assistant</h3>
            </div>
            <LLMChat />
          </div>
        </div>
      </div>
    </div>
  );
}
