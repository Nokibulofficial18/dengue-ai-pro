import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import DashboardHeader from "./DashboardHeader.jsx";

export default function AppShell({ children, onSearch, backendOnline = true }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // If on the public landing page (/), render the public product layout with a top navbar
  const isLandingPage = location.pathname === "/";

  if (isLandingPage) {
    return (
      <div className="min-h-screen bg-[#142235] text-[#F2F7FF] flex flex-col font-sans selection:bg-[#46C8E5]/30">
        {/* Public Product Navigation Bar */}
        <header className="sticky top-0 z-40 bg-[#0C1829]/95 backdrop-blur-md border-b border-[#1B3654]/70 px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#14263D] border border-[#46C8E5]/40 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#46C8E5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <span className="text-base font-bold text-white tracking-tight">
                  DengueAI <span className="text-[#46C8E5]">Pro</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-semibold text-[#9FB3C9] tracking-wider">
                  Public Health Intelligence
                </span>
              </div>
            </Link>

            {/* Navigation Destinations */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#9FB3C9]">
              <Link to="/map" className="hover:text-white transition-colors">
                Risk Map
              </Link>
              <Link to="/wards" className="hover:text-white transition-colors">
                Ward Analytics
              </Link>
              <Link to="/citizen" className="hover:text-white transition-colors">
                Citizen Reporting
              </Link>
              <Link to="/authority" className="hover:text-white transition-colors">
                Field Operations
              </Link>
              <Link to="/authority/coordination" className="hover:text-white transition-colors">
                Consortium Hub
              </Link>
            </nav>

            {/* Action Button */}
            <div className="flex items-center gap-3">
              <Link
                to="/intelligence"
                className="midnight-btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
              >
                <span>Launch Intelligence Center</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Public Page Children */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  // Otherwise, render the unified application workspace with sidebar + dashboard header
  return (
    <div className="min-h-screen bg-[#142235] text-[#F2F7FF] flex font-sans selection:bg-[#46C8E5]/30">
      {/* Fixed Left Sidebar */}
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-w-0">
        {/* Top Header */}
        <DashboardHeader
          onSearch={onSearch}
          setMobileOpen={setMobileOpen}
          backendOnline={backendOnline}
        />

        {/* Offline notification banner if backend offline */}
        {!backendOnline && (
          <div className="bg-[#4A3515]/80 border-b border-[#F6BA49]/40 text-[#F6BA49] px-6 py-2 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F6BA49] animate-pulse" />
              Operating in offline demo baseline mode — using verified Dhaka historical datasets
            </span>
            <span className="text-[11px] opacity-80">Local baseline active</span>
          </div>
        )}

        {/* Page Children */}
        <main className="flex-1 p-4 md:p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
