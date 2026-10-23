const riskColors = {
  critical: "#F45B79",
  high: "#F45B79",
  moderate: "#F6BA49",
  medium: "#F6BA49",
  low: "#33D6A6",
};

function ProgressBar({ label, value, color }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#9FB3C9]">{label}</span>
        <span className="text-white font-medium">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#0D1C2E]">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function WardCard({ ward, onReport }) {
  if (!ward) return null;
  const levelKey = (ward.risk_level || "medium").toLowerCase();
  const color = riskColors[levelKey] || "#F6BA49";
  const displayScore = ward.swapi_score ?? ward.score ?? 0;

  return (
    <div className="p-4 text-white min-w-[270px]">
      <div className="flex items-center justify-between pb-3 border-b border-[#1B3654]/60">
        <div>
          <div className="text-base font-bold text-white">{ward.ward_name}</div>
          <div className="text-[11px] text-[#9FB3C9]">{ward.ward_id}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black font-mono" style={{ color }}>
            {displayScore.toFixed(2)}
          </div>
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider"
            style={{ background: `${color}25`, color, border: `1px solid ${color}40` }}
          >
            {ward.risk_level || "Medium"}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <ProgressBar label="Rainfall" value={ward.rainfall_contribution || 32} color={color} />
        <ProgressBar label="Humidity" value={ward.humidity_contribution || 24} color={color} />
        <ProgressBar label="Sunlight Risk" value={ward.sunlight_contribution || 18} color={color} />
        <ProgressBar label="Temperature" value={ward.temp_contribution || 12} color={color} />
        <ProgressBar label="Drainage" value={ward.drainage_contribution || 14} color={color} />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1B3654]/60">
        <span className="rounded-full bg-[#133830] text-[#33D6A6] border border-[#33D6A6]/40 px-2.5 py-0.5 text-[10px] font-semibold">
          Reports: {ward.citizen_report_count ?? ward.report_count ?? 0}
        </span>
        <button
          onClick={onReport}
          className="midnight-btn-primary text-xs py-1 px-3 shadow"
        >
          Report Water
        </button>
      </div>
    </div>
  );
}
