import { useState } from "react";
import KPISummaryRow from "../components/dashboard/KPISummaryRow.jsx";
import RiskMapPanel from "../components/dashboard/RiskMapPanel.jsx";
import RiskTrendChart from "../components/dashboard/RiskTrendChart.jsx";
import AIInsightsPanel from "../components/dashboard/AIInsightsPanel.jsx";
import WardPriorityQueue from "../components/dashboard/WardPriorityQueue.jsx";
import LatestCitizenReports from "../components/dashboard/LatestCitizenReports.jsx";
import DataQualityPanel from "../components/dashboard/DataQualityPanel.jsx";
import CitizenReport from "../components/CitizenReport.jsx";
import LLMChat from "../components/LLMChat.jsx";

export default function HealthIntelligence() {
  const [selectedWardId, setSelectedWardId] = useState(null);
  const [showCitizenModal, setShowCitizenModal] = useState(false);
  const [showRAGModal, setShowRAGModal] = useState(false);

  return (
    <div className="space-y-6 max-w-[1720px] mx-auto animate-in fade-in duration-200">
      {/* 1. Executive Intelligence & Outbreak Hero Console */}
      <KPISummaryRow />

      {/* 2. Geospatial Vector Intelligence & Clinical Guidance */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Geospatial Vector Surveillance &amp; Clinical Decision Support
          </div>
          <span className="text-[10px] font-mono text-slate-500">Live 10-Ward Surveillance Grid</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Vector Intelligence Map (~64% width on desktop) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
            <RiskMapPanel
              selectedWardId={selectedWardId}
              onSelectWard={(ward) => setSelectedWardId(ward.ward_id)}
            />
          </div>

          {/* Right Column: Risk Forecast Curve + AI Insights (~36% width on desktop) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
            <RiskTrendChart />
            <AIInsightsPanel onOpenRAG={() => setShowRAGModal(true)} />
          </div>
        </div>
      </div>

      {/* 3. Field Operations & Civic Surveillance Console */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Field Operations Queue, Community Reports &amp; Telemetry
          </div>
          <span className="text-[10px] font-mono text-slate-500">Real-Time Municipal Action Stream</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Ward Priority Queue (~44% width) */}
          <div className="md:col-span-12 lg:col-span-5 xl:col-span-5 flex flex-col">
            <WardPriorityQueue />
          </div>

          {/* Latest Citizen Reports (~28% width) */}
          <div className="md:col-span-6 lg:col-span-4 xl:col-span-4 flex flex-col">
            <LatestCitizenReports onOpenReportModal={() => setShowCitizenModal(true)} />
          </div>

          {/* Data Quality & Telemetry Feed (~28% width) */}
          <div className="md:col-span-6 lg:col-span-3 xl:col-span-3 flex flex-col">
            <DataQualityPanel />
          </div>
        </div>
      </div>

      {/* Citizen Hazard Report Modal */}
      {showCitizenModal && (
        <CitizenReport
          ward={null}
          open={showCitizenModal}
          onClose={() => setShowCitizenModal(false)}
        />
      )}

      {/* Clinical RAG Protocol Assistant Modal */}
      {showRAGModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="midnight-card max-w-2xl w-full p-5 border-white/[0.12] shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-white tracking-tight">
                    Clinical AI Guidance &amp; WHO Guidelines
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Grounded vector response recommendations
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRAGModal(false)}
                className="w-7 h-7 rounded-md bg-[#08111D] text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[72vh] overflow-y-auto pr-1">
              <LLMChat />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
