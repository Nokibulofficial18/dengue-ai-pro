import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

const DATASETS = {
  citywide: [
    { day: "Aug 10", risk: 0.32, rainfall: 12 },
    { day: "Aug 11", risk: 0.41, rainfall: 18 },
    { day: "Aug 12", risk: 0.48, rainfall: 25 },
    { day: "Aug 13", risk: 0.58, rainfall: 42 },
    { day: "Aug 14", risk: 0.69, rainfall: 35 },
    { day: "Aug 15", risk: 0.79, rainfall: 15 },
    { day: "Aug 16", risk: 0.84, rainfall: 8 },
  ],
  mirpur: [
    { day: "Aug 10", risk: 0.45, rainfall: 15 },
    { day: "Aug 11", risk: 0.54, rainfall: 22 },
    { day: "Aug 12", risk: 0.68, rainfall: 38 },
    { day: "Aug 13", risk: 0.79, rainfall: 50 },
    { day: "Aug 14", risk: 0.88, rainfall: 40 },
    { day: "Aug 15", risk: 0.91, rainfall: 20 },
    { day: "Aug 16", risk: 0.92, rainfall: 12 },
  ],
  lalbagh: [
    { day: "Aug 10", risk: 0.38, rainfall: 10 },
    { day: "Aug 11", risk: 0.49, rainfall: 16 },
    { day: "Aug 12", risk: 0.55, rainfall: 28 },
    { day: "Aug 13", risk: 0.64, rainfall: 35 },
    { day: "Aug 14", risk: 0.74, rainfall: 29 },
    { day: "Aug 15", risk: 0.82, rainfall: 18 },
    { day: "Aug 16", risk: 0.86, rainfall: 9 },
  ],
};

export default function RiskTrendChart() {
  const [sector, setSector] = useState("citywide");
  const chartData = DATASETS[sector] || DATASETS.citywide;

  const currentRisk = chartData[chartData.length - 1].risk;
  const isHigh = currentRisk >= 0.7;

  return (
    <div className="midnight-card p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-white tracking-tight">Risk Projection (7-Day)</div>
            <div className="text-[10px] text-slate-400">SWAPI composite vector trajectory</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="bg-[#08111D] border border-white/[0.08] text-[11px] text-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-sky-400 transition"
          >
            <option value="citywide">Citywide Composite</option>
            <option value="mirpur">Mirpur Sector 10</option>
            <option value="lalbagh">Lalbagh Old City</option>
          </select>
        </div>
      </div>

      {/* Sub-header metric bar */}
      <div className="flex items-center justify-between px-1 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">7-Day Peak:</span>
          <span className={`font-mono font-bold ${isHigh ? "text-rose-400" : "text-amber-400"}`}>
            {(currentRisk).toFixed(2)} SWAPI
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? "bg-rose-400" : "bg-amber-400"}`} />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400/90">
          <span className="w-2.5 h-0.5 border-b border-dashed border-rose-400 inline-block" />
          <span>Critical Threshold (0.70)</span>
        </div>
      </div>

      {/* Clean Technical Area Chart */}
      <div className="h-44 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -26, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />

            <XAxis
              dataKey="day"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "rgba(255, 255, 255, 0.08)" }}
            />
            <YAxis
              domain={[0, 1.0]}
              ticks={[0.0, 0.25, 0.5, 0.75, 1.0]}
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "rgba(255, 255, 255, 0.08)" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-[#070E1A] border border-white/[0.12] rounded-lg p-2.5 text-xs shadow-2xl">
                      <div className="text-slate-400 text-[10px] font-mono">{item.day}</div>
                      <div className="text-white font-bold font-mono text-sm mt-0.5">
                        SWAPI: {item.risk}
                      </div>
                      <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                        Rainfall: {item.rainfall} mm
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={0.70}
              stroke="#F43F5E"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="risk"
              stroke="#38BDF8"
              strokeWidth={2}
              fill="url(#trendFill)"
              dot={{ r: 2.5, fill: "#38BDF8", strokeWidth: 0 }}
              activeDot={{ r: 4, fill: "#FFFFFF", stroke: "#38BDF8", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
