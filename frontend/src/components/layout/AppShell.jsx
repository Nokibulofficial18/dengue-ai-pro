import { useState } from "react";
import Sidebar from "./Sidebar.jsx";
import DashboardHeader from "./DashboardHeader.jsx";

export default function AppShell({ children, onSearch, backendOnline = true }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0B1524] text-slate-100 flex font-sans selection:bg-sky-500/30">
      {/* Fixed Left Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Workspace Area */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-w-0">
        {/* Top Header */}
        <DashboardHeader
          onSearch={onSearch}
          setMobileOpen={setMobileOpen}
          backendOnline={backendOnline}
        />

        {/* Offline notification banner if backend offline */}
        {!backendOnline && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 px-6 py-2 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Operating in local demonstration mode — baseline historical vector datasets active
            </span>
            <span className="text-[10px] font-mono opacity-80">Local Baseline Active</span>
          </div>
        )}

        {/* Page Children Container */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 space-y-4">
          {children}
        </main>
      </div>
    </div>
  );
}
