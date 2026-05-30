const riskColors = {
  critical: "#C0392B",
  high: "#C05A1A",
  moderate: "#E8A020",
  low: "#1E6B2E",
};

function ProgressBar({ label, value, color }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-200">{label}</span>
        <span className="text-slate-400">{value}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/5">
        <div
          className="h-2 rounded-full"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function WardCard({ ward, onReport }) {
  if (!ward) return null;
  const color = riskColors[ward.risk_level] || "#E8A020";
  const displayScore = ward.swapi_score ?? ward.score ?? 0;

  return (
    <div className="card p-5 text-white min-w-[260px] hover:shadow-2xl transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{ward.ward_name}</div>
          <div className="text-xs text-slate-400">{ward.ward_id}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color }}>
            {displayScore.toFixed(2)}
          </div>
          <span
            className="inline-block rounded-full px-2 py-1 text-[10px] uppercase"
            style={{ background: `${color}33`, color }}
          >
            {ward.risk_level}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar label="Rainfall" value={ward.rainfall_contribution || 0} color={color} />
        <ProgressBar label="Humidity" value={ward.humidity_contribution || 0} color={color} />
        <ProgressBar
          label="Sunlight Risk"
          value={ward.sunlight_contribution || 0}
          color={color}
        />
        <ProgressBar
          label="Temperature"
          value={ward.temp_contribution || 0}
          color={color}
        />
        <ProgressBar
          label="Drainage"
          value={ward.drainage_contribution || 0}
          color={color}
        />
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="rounded-full bg-emerald-400/15 text-emerald-200 px-2 py-1 text-xs badge">
          Citizen reports: {ward.citizen_report_count ?? ward.report_count ?? 0}
        </span>
        <button
          onClick={onReport}
          className="rounded-full px-3 py-1 text-xs font-semibold btn btn-primary"
        >
          Report Stagnant Water
        </button>
      </div>
    </div>
  );
}
