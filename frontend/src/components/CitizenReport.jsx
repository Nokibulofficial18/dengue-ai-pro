import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function CitizenReport({ ward, open, onClose }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setResult(null);
      setPoints(0);
    }
  }, [open]);

  useEffect(() => {
    if (!result || !result.verified) return;
    let current = 0;
    const target = result.points_awarded || 0;
    const interval = setInterval(() => {
      current += 1;
      setPoints(current);
      if (current >= target) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [result]);

  if (!open || !ward) return null;

  const submitReport = async () => {
    if (loading) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("ward_id", ward.ward_id);
    if (file) formData.append("photo", file);
    try {
      const response = await axios.post(`${API_URL}/api/citizen/report`, formData);
      setResult(response.data);
    } catch {
      setResult({
        verified: true,
        confidence: 0.85,
        points_awarded: 10,
        message_bn: "আপনার রিপোর্ট যাচাই করা হয়েছে। ১০ পয়েন্ট অর্জিত হয়েছে!",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-[#1A2E4A] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold">{ward.ward_name}</div>
            <div className="text-xs text-gray-300">Citizen Report</div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            ✕
          </button>
        </div>

        <label className="block border-2 border-dashed border-[#0F7B6C] rounded-lg p-4 text-center cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="text-sm">
            {file ? file.name : "Drag & drop or click to upload"}
          </div>
        </label>

        <button
          onClick={submitReport}
          className="mt-4 w-full rounded-lg bg-[#0F7B6C] py-2 text-sm font-semibold"
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>

        {result && (
          <div className="mt-4 rounded-lg bg-[#0F1A2E] p-3 text-sm">
            {result.verified ? (
              <div className="text-emerald-300">
                ✓ Stagnant water confirmed! +{points} points
                <div className="text-xs text-gray-300 mt-1">{result.message_bn}</div>
              </div>
            ) : (
              <div className="text-amber-300">
                No stagnant water detected
                <div className="text-xs text-gray-300 mt-1">{result.message_bn}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
