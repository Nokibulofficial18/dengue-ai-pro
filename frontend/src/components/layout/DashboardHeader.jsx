import { useState } from "react";
import { useLocation } from "react-router-dom";

export default function DashboardHeader({ onSearch, setMobileOpen, backendOnline = true }) {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const routeMetadata = {
    "/": {
      title: "Public Health Overview",
      subtitle: "Dhaka city-wide vector intelligence, public health advisories, and community reporting",
      badge: "Public Surveillance",
    },
    "/intelligence": {
      title: "Health Intelligence Center",
      subtitle: "Epidemiological trajectory forecasting, WHO clinical AI guidance, and dispatch queue",
      badge: "Command Center",
    },
    "/map": {
      title: "Dhaka Geospatial Risk Map",
      subtitle: "Ward-level environmental risk clusters and physical vector monitoring",
      badge: "GIS Intelligence",
    },
    "/wards": {
      title: "Ward Analytics & Risk Profiles",
      subtitle: "Environmental factor breakdown: Rainfall, Humidity, Drainage, and Temperature",
      badge: "Epidemiological Data",
    },
    "/citizen": {
      title: "Community Citizen Reporting",
      subtitle: "Submit verified photographs of stagnant water to mobilize municipal response",
      badge: "Civic Surveillance",
    },
    "/authority": {
      title: "Field Operations & Crew Dispatch",
      subtitle: "Prioritized field orders, larvicide dosage calculation, and WHO clinical protocols",
      badge: "Field Operations",
    },
    "/authority/sites": {
      title: "Permanent Facility & Hazard Registry",
      subtitle: "Multi-property registration, outdoor/indoor breeding sumps, and issue timelines",
      badge: "Facility Audit",
    },
    "/authority/scheduling": {
      title: "Smart Reinspection Scheduling",
      subtitle: "Rule-based frequency policies, recurrence acceleration, and rainfall triggers",
      badge: "Automated Scheduling",
    },
    "/authority/services": {
      title: "Service & Resolution Verification",
      subtitle: "Field work order lifecycle, photographic evidence hash verification, and supervisor review",
      badge: "Field Verification",
    },
    "/authority/repair-planning": {
      title: "Permanent Repair & Cost Savings",
      subtitle: "Engineering assessments, supplier quotes, and 3-scenario payback financial modeling",
      badge: "Capital Economics",
    },
    "/authority/coordination": {
      title: "Consortium Hub & Shared Areas",
      subtitle: "Inter-property collaborative prevention, shared drainage corridors, and permission isolation",
      badge: "Multi-Tenant Hub",
    },
  };

  const currentMeta = routeMetadata[location.pathname] || {
    title: "Health Intelligence System",
    subtitle: "Dengue outbreak prevention and response platform for Dhaka",
    badge: "Operational",
  };

  const notifications = [
    { id: 1, title: "High-Risk Alert", desc: "Mirpur Ward 12 SWAPI score reached 0.91", time: "10m ago", high: true },
    { id: 2, title: "Rainfall Trigger", desc: "38mm rainfall recorded in Lalbagh sector", time: "45m ago", high: false },
    { id: 3, title: "Field Update", desc: "Team 3 verified larva-free sump in Tejgaon", time: "2h ago", high: false },
  ];

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0B1524]/90 backdrop-blur-md border-b border-white/[0.07] px-4 md:px-6 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      {/* Route Title & Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 rounded-lg bg-[#14243B] text-sky-400 hover:bg-[#192B45] border border-white/[0.08]"
            aria-label="Toggle navigation drawer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
                {currentMeta.title}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/25">
                {currentMeta.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-normal">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls: Search, Notifications, User */}
      <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search wards, sumps..."
            className="w-48 sm:w-64 bg-[#08111D] border border-white/[0.08] rounded-lg px-3 py-1.5 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 transition"
          />
          <svg
            className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <kbd className="hidden sm:inline-block absolute right-2 top-2 text-[9px] font-mono px-1 py-0.5 rounded bg-white/[0.04] text-slate-500 border border-white/[0.06]">
            ⌘K
          </kbd>
        </div>

        {/* Date / Season Context */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#08111D] border border-white/[0.08] px-2.5 py-1.5 rounded-lg text-xs text-slate-300">
          <svg className="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-medium text-[11px]">Monsoon 2024</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 rounded-lg bg-[#08111D] border border-white/[0.08] text-slate-400 hover:text-white hover:border-sky-400/40 relative transition"
            aria-label="Operational notifications"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
              3
            </span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#101D30] border border-white/[0.1] shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.08] text-xs font-semibold text-white">
                <span>Operational Alerts</span>
                <span className="text-sky-400 font-mono text-[10px]">3 New</span>
              </div>
              <div className="divide-y divide-white/[0.05] max-h-56 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="py-2 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center justify-between text-[11px] font-medium">
                      <span className={n.high ? "text-rose-400 font-semibold" : "text-sky-400 font-semibold"}>{n.title}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{n.time}</span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">{n.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Session Profile */}
        <div className="flex items-center gap-2 bg-[#08111D] border border-white/[0.08] pl-1.5 pr-2.5 py-1 rounded-lg">
          <div className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
            AO
          </div>
          <span className="text-[11px] text-slate-200 font-medium hidden sm:inline">
            Officer Session
          </span>
        </div>
      </div>
    </header>
  );
}
