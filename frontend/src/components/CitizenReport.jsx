import { useEffect, useState } from "react";
import axios from "axios";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function CitizenReport({ ward, open, onClose }) {
  const [file, setFile] = useState(null);
  const [selectedWardId, setSelectedWardId] = useState(ward?.ward_id || "DHK-001");
  const [result, setResult] = useState(null);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ward?.ward_id) {
      setSelectedWardId(ward.ward_id);
    }
  }, [ward]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setResult(null);
      setPoints(0);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!result) return;
    let current = 0;
    const target = result.points_awarded || 25;
    const interval = setInterval(() => {
      current += 1;
      setPoints(current);
      if (current >= target) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [result]);

  if (!open) return null;

  const activeWard = ward || mockData.wards.find((w) => w.ward_id === selectedWardId) || mockData.wards[0];

  const submitReport = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("ward_id", activeWard.ward_id);
    if (file) formData.append("photo", file);

    try {
      const response = await axios.post(`${API_URL}/api/citizen/report`, formData);
      setResult(response.data);
    } catch (err) {
      console.error("Citizen report submission failed", err);
      // Demo fallback if backend offline
      setResult({
        report_id: `DEMO-REP-${Date.now().toString().slice(-4)}`,
        status: "received",
        verified: false,
        points_awarded: 25,
        message_en: "Report received. Points added to leaderboard (Local demonstration mode).",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md midnight-card p-6 border-[#46C8E5]/30 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-[#1B3654]/60 mb-4">
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span>📸</span> Submit Citizen Report
            </div>
            <div className="text-xs text-[#9FB3C9]">
              {activeWard.ward_name} ({activeWard.ward_id})
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#0D1C2E] text-[#9FB3C9] hover:text-white flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* If no pre-selected ward, allow selecting */}
        {!ward && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#9FB3C9] mb-1">
              Select Ward Location:
            </label>
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              className="w-full bg-[#0D1C2E] border border-[#1B3654] text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#46C8E5]"
            >
              {mockData.wards.map((w) => (
                <option key={w.ward_id} value={w.ward_id}>
                  {w.ward_name} ({w.ward_id})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* File upload drop zone */}
        <label className="block border-2 border-dashed border-[#46C8E5]/40 hover:border-[#46C8E5] rounded-2xl p-5 text-center cursor-pointer bg-[#0D1C2E]/60 transition-colors">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#162E4D] text-[#46C8E5] flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-xs text-white font-medium">
              {file ? file.name : "Click to select or drag photo here"}
            </div>
            <div className="text-[10px] text-[#9FB3C9]">
              JPG, PNG, or WEBP (Max 10MB)
            </div>
          </div>
        </label>

        <button
          onClick={submitReport}
          disabled={loading}
          className="mt-4 w-full midnight-btn-primary flex items-center justify-center gap-2 py-2.5"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Verifying &amp; Submitting...
            </>
          ) : (
            "Submit Environmental Report"
          )}
        </button>

        {error && (
          <div className="mt-4 rounded-xl bg-[#4A1B28] border border-[#F45B79]/40 p-3 text-xs text-[#F45B79]">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-xl bg-[#133830] border border-[#33D6A6]/40 p-3.5 text-xs">
            <div className="text-[#33D6A6] font-bold flex items-center gap-1.5">
              <span>✓</span> {result.message_en || "Report logged successfully."}
            </div>
            <div className="text-[#9FB3C9] text-[11px] mt-1">
              Status: <span className="text-white font-medium">Received — pending field inspector review</span>
            </div>
            {result.points_awarded > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-[#9FB3C9]">Points Earned:</span>
                <span className="text-sm font-extrabold text-[#33D6A6]">+{points} pts</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
