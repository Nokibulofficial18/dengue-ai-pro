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
    <div className="min-h-screen bg-[#0b1220] text-white">
      {/* Hero Banner */}
      <div className="relative overflow-hidden px-6 py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-amber-500/10" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center">
            <div className="inline-block pill bg-cyan-400/20 text-cyan-200 mb-4">
              ✨ SDG 3 Health & Wellbeing
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300">
              DengueAI Pro
            </h1>
            <p className="text-2xl text-slate-200 mb-4 font-medium">
              Prevent Dengue Before It Spreads
            </p>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              Real-time risk intelligence powered by AI, satellite data, and community reports. 
              See how Dhaka's 10 wards are protected using predictive analytics and WHO-grounded guidance.
            </p>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-3 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
              <div className="surface p-3">
                <div className="text-2xl font-bold text-cyan-300">10</div>
                <div className="text-xs text-slate-400">Wards Monitored</div>
              </div>
              <div className="surface p-3">
                <div className="text-2xl font-bold text-emerald-300">321K+</div>
                <div className="text-xs text-slate-400">Cases Tracked</div>
              </div>
              <div className="surface p-3">
                <div className="text-2xl font-bold text-amber-300">Live</div>
                <div className="text-xs text-slate-400">Risk Scores</div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-4">
              <Link
                to="/"
                className="rounded-full px-8 py-4 text-sm font-semibold btn btn-primary shadow-lg"
              >
                🗺️ Explore Live Map
              </Link>
              <Link
                to="/authority"
                className="rounded-full bg-amber-400 px-8 py-4 text-sm font-semibold text-[#0b1220] btn btn-amber shadow-lg"
              >
                📊 See Dispatch Orders
              </Link>
              <Link
                to="/citizen"
                className="rounded-full px-8 py-4 text-sm font-semibold btn btn-secondary shadow-lg"
              >
                📸 Submit a Report
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Core Features Grid */}
        <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">How It Works</h2>
          <p className="text-slate-400">Five technologies working together in real time</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="surface p-4 text-left hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl mb-2">{feature.icon}</div>
              <div className="font-semibold mb-1 text-sm">{feature.title}</div>
              <div className="text-xs text-slate-300">{feature.description}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Get Started in 3 Steps</h2>
          <p className="text-slate-400">Experience the full DengueAI Pro workflow</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-cyan-500/20 text-cyan-200 font-bold text-lg">
                1
              </div>
              <div className="text-lg font-semibold">Explore Risk</div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Open the live heat map to see ward-level SWAPI scores. Click any ward to see the breakdown of rainfall, humidity, temperature, and other factors that drive risk.
            </p>
            <Link to="/" className="text-cyan-300 text-sm font-medium hover:underline">
              → View Live Map
            </Link>
          </div>

          <div className="card p-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-200 font-bold text-lg">
                2
              </div>
              <div className="text-lg font-semibold">Report Sightings</div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              See a stagnant water site? Upload a photo to submit a citizen report. The system verifies the image and awards points to top reporters.
            </p>
            <Link to="/citizen" className="text-emerald-300 text-sm font-medium hover:underline">
              → Submit a Report
            </Link>
          </div>

          <div className="card p-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-500/20 text-amber-200 font-bold text-lg">
                3
              </div>
              <div className="text-lg font-semibold">View Dispatch</div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Watch how AI generates dispatch orders for field teams. See reasoning grounded in WHO guidelines and DGHS case data.
            </p>
            <Link to="/authority" className="text-amber-300 text-sm font-medium hover:underline">
              → View Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Key Benefits */}
      <div className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="text-2xl">⚡</span> What Makes It Real-Time?
          </div>
          <ul className="text-sm text-slate-300 space-y-2">
            <li>✓ Satellite & weather data updates hourly</li>
            <li>✓ Citizen reports processed instantly via AI vision</li>
            <li>✓ Dispatch orders generated within seconds</li>
            <li>✓ WHO guidelines embedded in every recommendation</li>
          </ul>
        </div>

        <div className="card p-6">
          <div className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="text-2xl">🎯</span> Why This Matters
          </div>
          <ul className="text-sm text-slate-300 space-y-2">
            <li>✓ Early detection prevents outbreaks</li>
            <li>✓ Optimized resource allocation saves lives</li>
            <li>✓ Community engagement builds trust</li>
            <li>✓ Data-driven decisions reduce uncertainty</li>
          </ul>
        </div>
      </div>

      {/* Quick Tips & FAQ */}
      <div className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface p-6">
          <div className="text-lg font-semibold mb-4">💡 Pro Tips</div>
          <ul className="text-sm text-slate-300 space-y-3">
            <li>
              <span className="font-semibold text-slate-100">Zoom in on the map</span> to see ward boundaries and risk levels.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Ward Details tab</span> shows all 10 wards sorted by risk.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Leaderboard</span> ranks top citizen reporters by points earned.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Offline mode</span> — if backend is down, demo data loads automatically.
            </li>
          </ul>
        </div>

        <div className="surface p-6">
          <div className="text-lg font-semibold mb-4">❓ Quick Questions</div>
          <ul className="text-sm text-slate-300 space-y-3">
            <li>
              <span className="font-semibold text-slate-100">What is SWAPI?</span> A composite score (0–1) blending rainfall, humidity, temperature, sunlight, and drainage.
            </li>
            <li>
              <span className="font-semibold text-slate-100">How do I earn points?</span> Submit verified citizen reports to climb the leaderboard.
            </li>
            <li>
              <span className="font-semibold text-slate-100">Is this real data?</span> Demo uses sample Dhaka 2023 data; production uses live feeds.
            </li>
          </ul>
        </div>
      </div>

      {/* Detailed Features Section */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Core Capabilities</h2>
          <p className="text-slate-400">Everything you need to manage dengue prevention</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-3xl mb-2">🗺️</div>
            <div className="font-semibold mb-1">Live Risk Map</div>
            <div className="text-xs text-slate-400">Interactive heat map with ward-level scores</div>
          </div>
          <div className="card p-4">
            <div className="text-3xl mb-2">📊</div>
            <div className="font-semibold mb-1">Dispatch Dashboard</div>
            <div className="text-xs text-slate-400">Prioritized orders with AI reasoning</div>
          </div>
          <div className="card p-4">
            <div className="text-3xl mb-2">💬</div>
            <div className="font-semibold mb-1">LLM Chat</div>
            <div className="text-xs text-slate-400">Ask questions, get WHO-cited answers</div>
          </div>
          <div className="card p-4">
            <div className="text-3xl mb-2">🏆</div>
            <div className="font-semibold mb-1">Leaderboard</div>
            <div className="text-xs text-slate-400">Gamified citizen engagement</div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mb-16 card p-8 text-center bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-amber-500/10">
        <h2 className="text-2xl font-bold mb-3">Ready to Dive In?</h2>
        <p className="text-slate-300 mb-6">Start exploring DengueAI Pro — no setup required.</p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-full px-6 py-3 text-sm font-semibold btn btn-primary"
          >
            🚀 Launch Now
          </Link>
          <Link
            to="/wards"
            className="rounded-full px-6 py-3 text-sm font-semibold btn btn-secondary"
          >
            📋 See All Wards
          </Link>
        </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-white/10">
        <div className="text-xs text-slate-400">
          <p className="mb-2">Team GSTU NEUROBLITZZZ | The Infinity AI BuildFest 2026</p>
          <p>Powered by FastAPI, React, Claude AI, and Open-Source GIS</p>
        </div>
      </div>
    </div>
  );
}
