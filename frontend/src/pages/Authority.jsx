import { useState } from "react";
import DispatchDashboard from "../components/DispatchDashboard.jsx";
import LLMChat from "../components/LLMChat.jsx";

export default function Authority() {
  const [tab, setTab] = useState("dispatch");
  return (
    <div className="p-6">
      <div className="relative mb-6">
        <div className="text-2xl font-semibold">
          Authority Command Dashboard — DNCC
        </div>
        <div className="text-sm text-slate-300">
          Powered by DengueAI Pro | RAG-grounded LLM Dispatch Intelligence
        </div>
        <span className="absolute right-0 top-0 rounded-full bg-amber-300/90 px-3 py-1 text-xs font-semibold text-[#0b1220]">
          DEMO MODE
        </span>
      </div>

      <div className="md:hidden mb-4 flex gap-2">
        <button
          onClick={() => setTab("dispatch")}
          className={`flex-1 rounded-full px-3 py-2 text-sm ${
            tab === "dispatch" ? "bg-cyan-500/20 text-cyan-200" : "bg-white/5"
          }`}
        >
          Dispatch
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 rounded-full px-3 py-2 text-sm ${
            tab === "chat" ? "bg-cyan-500/20 text-cyan-200" : "bg-white/5"
          }`}
        >
          Chat
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6">
        <div className={`${tab === "dispatch" ? "block" : "hidden"} md:block`}>
          <DispatchDashboard />
        </div>
        <div className={`${tab === "chat" ? "block" : "hidden"} md:block`}>
          <LLMChat />
        </div>
      </div>
    </div>
  );
}
