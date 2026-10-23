const riskColors = {
  critical: "#F43F5E",
  high: "#F43F5E",
  moderate: "#F59E0B",
  medium: "#F59E0B",
  low: "#10B981",
};

function ProgressBar({ label, value, color }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-mono font-medium">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#08111D] overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function WardCard({ ward, onReport }) {
  if (!ward) return null;
  const levelKey = (ward.risk_level || "medium").toLowerCase();
  const color = riskColors[levelKey] || "#F59E0B";
  const displayScore = ward.swapi_score ?? ward.score ?? 0;

  return (
    <div className="p-4 text-white min-w-[270px] bg-[#101D30] rounded-xl border border-white/[0.08]">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div>
          <div className="text-sm font-bold text-white tracking-tight">{ward.ward_name}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ward.ward_id}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold font-mono" style={{ color }}>
            {displayScore.toFixed(2)}
          </div>
          <span
            className="inline-block rounded px-1.5 py-0.2 text-[9px] uppercase font-mono font-semibold"
            style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}35` }}
          >
            {ward.risk_level || "Medium"}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <ProgressBar label="Rainfall Weight" value={ward.rainfall_contribution || 32} color={color} />
        <ProgressBar label="Relative Humidity" value={ward.humidity_contribution || 24} color={color} />
        <ProgressBar label="Drainage Flow Deficit" value={ward.drainage_contribution || 18} color={color} />
        <ProgressBar label="Ambient Temperature" value={ward.temp_contribution || 14} color={color} />
      </div>

      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/[0.08]">
        <span className="rounded px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-mono">
          Reports: {ward.citizen_report_count ?? ward.report_count ?? 0}
        </span>
        <button
          onClick={onReport}
          className="midnight-btn-primary text-xs py-1 px-2.5"
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}
