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
    <div className="min-h-screen bg-[#0F1A2E] text-white px-6 py-12">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-4">
          Dengue<span className="text-[#0F7B6C]">AI</span> Pro
        </h1>
        <p className="text-lg text-gray-300 mb-10">
          Preventing dengue before a single larva hatches
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-[#1A2E4A] rounded-xl p-4 text-left"
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="font-semibold mb-1">{feature.title}</div>
              <div className="text-xs text-gray-300">{feature.description}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mb-10">
          <Link
            to="/"
            className="rounded-full bg-[#0F7B6C] px-6 py-3 text-sm font-semibold"
          >
            View Live Map →
          </Link>
          <Link
            to="/authority"
            className="rounded-full bg-[#E8A020] px-6 py-3 text-sm font-semibold text-[#0F1A2E]"
          >
            Authority Dashboard →
          </Link>
        </div>

        <div className="text-xs text-gray-400">
          Team GSTU NEUROBLITZZZ | The Infinity AI BuildFest 2026
        </div>
      </div>
    </div>
  );
}
