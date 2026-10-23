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
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in duration-300">
      {/* 1. Top KPI Cards Row */}
      <KPISummaryRow />

      {/* 2. Main Middle Section: Large Map + Right Trend & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Dhaka Dengue Risk Map (~62% width on desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <RiskMapPanel
            selectedWardId={selectedWardId}
            onSelectWard={(ward) => setSelectedWardId(ward.ward_id)}
          />
        </div>

        {/* Right Column: Risk Trend (Next 7 Days) + AI Insights (~38% width on desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <RiskTrendChart />
          <AIInsightsPanel onOpenRAG={() => setShowRAGModal(true)} />
        </div>
      </div>

      {/* 3. Bottom Row: Ward Priority Queue + Latest Citizen Reports + Data Quality */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Ward Priority Queue (~45% width) */}
        <div className="md:col-span-12 lg:col-span-5 xl:col-span-5 flex flex-col">
          <WardPriorityQueue />
        </div>

        {/* Latest Citizen Reports (~28% width) */}
        <div className="md:col-span-6 lg:col-span-4 xl:col-span-4 flex flex-col">
          <LatestCitizenReports onOpenReportModal={() => setShowCitizenModal(true)} />
        </div>

        {/* Data Quality & Mock Feed (~27% width) */}
        <div className="md:col-span-6 lg:col-span-3 xl:col-span-3 flex flex-col">
          <DataQualityPanel />
        </div>
      </div>

      {/* Citizen Report Modal */}
      {showCitizenModal && (
        <CitizenReport
          ward={null}
          open={showCitizenModal}
          onClose={() => setShowCitizenModal(false)}
        />
      )}

      {/* RAG Chat Modal Drawer */}
      {showRAGModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="midnight-card max-w-2xl w-full p-6 border-[#46C8E5]/40 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[#46C8E5] text-lg">🤖</span>
                <span className="text-base font-bold text-white">
                  DengueAI Pro RAG Assistant &amp; WHO Guidelines
                </span>
              </div>
              <button
                onClick={() => setShowRAGModal(false)}
                className="text-[#9FB3C9] hover:text-white text-base"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto pr-1">
              <LLMChat />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
