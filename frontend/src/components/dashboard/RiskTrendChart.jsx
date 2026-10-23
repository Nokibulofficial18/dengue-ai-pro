import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { day: "Aug 10", risk: 0.32 },
  { day: "Aug 11", risk: 0.41 },
  { day: "Aug 12", risk: 0.48 },
  { day: "Aug 13", risk: 0.58 },
  { day: "Aug 14", risk: 0.69 },
  { day: "Aug 15", risk: 0.79 },
  { day: "Aug 16", risk: 0.84 },
];

export default function RiskTrendChart() {
  const [metric, setMetric] = useState("citywide");

  return (
    <div className="midnight-card p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1B3654]/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#46C8E5]/15 border border-[#46C8E5]/30 flex items-center justify-center text-[#46C8E5]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">Risk Trend (Next 7 Days)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#1B3654] text-[#9FB3C9]">
            Illustrative forecast
          </span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="bg-[#0D1C2E] border border-[#1B3654] text-[11px] text-white rounded-lg px-2 py-1 focus:outline-none focus:border-[#46C8E5]"
          >
            <option value="citywide">Citywide Risk Index ▾</option>
            <option value="mirpur">Mirpur Sector 10</option>
            <option value="lalbagh">Lalbagh Old City</option>
          </select>
        </div>
      </div>

      {/* Recharts Spline Area Curve matching screenshot */}
      <div className="h-44 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              {/* Gradient stroke from cyan to violet */}
              <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#46C8E5" />
                <stop offset="60%" stopColor="#6E85F7" />
                <stop offset="100%" stopColor="#9B83F5" />
              </linearGradient>
              {/* Area fill */}
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9B83F5" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#46C8E5" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="day"
              stroke="#9FB3C9"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "rgba(99, 165, 223, 0.2)" }}
            />
            <YAxis
              domain={[0, 1.0]}
              ticks={[0.0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              stroke="#9FB3C9"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "rgba(99, 165, 223, 0.2)" }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#0C1829] border border-[#46C8E5]/40 rounded-lg p-2 text-xs shadow-xl">
                      <div className="text-[#9FB3C9]">{payload[0].payload.day}</div>
                      <div className="text-white font-bold text-sm">
                        Predicted SWAPI: {payload[0].value}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="risk"
              stroke="url(#strokeGrad)"
              strokeWidth={3}
              fill="url(#areaFill)"
              dot={{
                r: 3.5,
                fill: "#46C8E5",
                stroke: "#142235",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: "#9B83F5",
                stroke: "#FFFFFF",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
