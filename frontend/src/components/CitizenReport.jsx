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
    }, 25);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md midnight-card p-5 border-white/[0.12] shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">Submit Hazard Report</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {activeWard.ward_name} ({activeWard.ward_id})
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-[#08111D] text-slate-400 hover:text-white flex items-center justify-center text-xs"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* If no pre-selected ward, allow selecting */}
        {!ward && (
          <div className="mb-3.5">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Designated Ward:
            </label>
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              className="w-full bg-[#08111D] border border-white/[0.08] text-xs text-white rounded-lg p-2 focus:outline-none focus:border-sky-400"
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
        <label className="block border border-dashed border-white/[0.14] hover:border-sky-400/60 rounded-xl p-5 text-center cursor-pointer bg-[#08111D] transition-colors mb-3.5">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-xs text-slate-200 font-medium">
              {file ? file.name : "Select or drag stagnant water photograph"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              JPEG, PNG, or WEBP (Max 10MB)
            </div>
          </div>
        </label>

        <button
          onClick={submitReport}
          disabled={loading}
          className="w-full midnight-btn-primary py-2 text-xs flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Verifying Evidence...
            </>
          ) : (
            "Submit Photographic Evidence"
          )}
        </button>

        {error && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-3.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <div className="flex items-center justify-between text-emerald-400 font-medium mb-1">
              <span>Report Transmitted</span>
              <span className="font-mono font-bold">+{points} PTS</span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono">{result.message_en}</p>
          </div>
        )}
      </div>
    </div>
  );
}
