import { Link } from "react-router-dom";

const features = [
  {
    icon: "🧠",
    title: "SWAPI Risk Engine",
    description: "Hyper-local dengue risk scoring for every ward.",
  },
  {
    icon: "🛰️",
    title: "Satellite Detection",
    description: "Water pooling detection for rapid vector response.",
  },
  {
    icon: "🤖",
    title: "LLM Dispatch",
    description: "AI-generated field orders with WHO citations.",
  },
  {
    icon: "📚",
    title: "RAG Knowledge",
    description: "Grounded responses from DGHS and WHO guidance.",
  },
  {
    icon: "🧪",
    title: "Citizen Reporting",
    description: "Community-powered detection and rewards.",
  },
];

export default function Demo() {
  return (
    <div className="min-h-screen bg-[#0b1220] text-white px-6 py-12">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300">
          DengueAI Pro
        </h1>
        <p className="text-lg text-slate-300 mb-4">
          Preventing dengue before a single larva hatches
        </p>
        <p className="text-sm text-slate-400 mb-10">
          Explore the live risk map, submit a citizen report, and see how dispatch
          decisions are generated in real time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="surface p-4 text-left"
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="font-semibold mb-1">{feature.title}</div>
              <div className="text-xs text-slate-300">{feature.description}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="card p-5 text-left">
            <div className="text-sm font-semibold mb-2">1. Explore Live Risk</div>
            <div className="text-sm text-slate-300">
              Open the live heat map to see ward-level SWAPI scores and risk bands.
            </div>
          </div>
          <div className="card p-5 text-left">
            <div className="text-sm font-semibold mb-2">2. Report in 30 Seconds</div>
            <div className="text-sm text-slate-300">
              Submit a quick citizen report to simulate community-led detection.
            </div>
          </div>
          <div className="card p-5 text-left">
            <div className="text-sm font-semibold mb-2">3. View Dispatch Logic</div>
            <div className="text-sm text-slate-300">
              See AI-generated dispatch orders with WHO-grounded reasoning.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mb-10">
          <Link
            to="/"
            className="rounded-full px-6 py-3 text-sm font-semibold btn btn-primary"
          >
            View Live Map →
          </Link>
          <Link
            to="/authority"
            className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-[#0b1220] btn btn-amber"
          >
            Authority Dashboard →
          </Link>
          <Link
            to="/citizen"
            className="rounded-full px-6 py-3 text-sm font-semibold btn btn-secondary"
          >
            Submit a Citizen Report →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 text-left">
          <div className="surface p-4">
            <div className="text-sm font-semibold mb-2">Quick Tips</div>
            <ul className="text-xs text-slate-300 space-y-2">
              <li>• Click a ward in the map to see a detailed risk breakdown.</li>
              <li>• Use Ward Details for a full list of SWAPI contributors.</li>
              <li>• The system runs in demo mode if the backend is offline.</li>
            </ul>
          </div>
          <div className="surface p-4">
            <div className="text-sm font-semibold mb-2">What this demo shows</div>
            <ul className="text-xs text-slate-300 space-y-2">
              <li>• How environmental signals translate into SWAPI risk scores.</li>
              <li>• How citizen input boosts ward-level situational awareness.</li>
              <li>• How dispatch orders are prioritized and explained.</li>
            </ul>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Team GSTU NEUROBLITZZZ | The Infinity AI BuildFest 2026
        </div>
      </div>
    </div>
  );
}
