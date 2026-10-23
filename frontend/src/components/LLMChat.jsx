import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { mockData } from "../data/mockData.js";

const API_URL = import.meta.env.VITE_API_URL || "";

const suggestions = [
  "Which 5 wards need dispatch today?",
  "What is the risk in Mirpur?",
  "How much larvicide do we need?",
  "What is the SWAPI formula?",
];

export default function LLMChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello Officer. I am the DengueAI Pro clinical protocol assistant. Ask me about ward risk scores, larviciding protocols, or DGHS clinical guidelines.",
      source: "WHO / DGHS Protocol Registry",
      timestamp: "Just now",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: "user", content, timestamp }]);
    setInput("");
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/dispatch/query`, {
        question: content,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.answer,
          source: response.data.source,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      const fallback =
        mockData.llmResponses?.[content] ||
        mockData.llmResponses?.["Which 5 wards need dispatch today?"] ||
        "WHO Vector Guidelines recommend larvicide application (Bti 1mg/L) for any container holding water for >4 days. Wards with SWAPI > 0.70 must receive priority field inspection within 24 hours.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: fallback,
          source: "WHO / DGHS Guidelines",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between">
      {/* Suggestions Pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {suggestions.map((text) => (
          <button
            key={text}
            onClick={() => sendMessage(text)}
            className="rounded-md bg-[#08111D] text-sky-400 border border-white/[0.08] hover:border-sky-400/40 hover:bg-[#0E1827] px-2.5 py-1 text-[11px] font-mono transition"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[360px] min-h-[220px]">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-sky-600 text-white shadow-sm"
                : "bg-[#0E1827] border border-white/[0.07] text-slate-200"
            }`}
          >
            <div className="whitespace-pre-line font-sans">{msg.content}</div>
            <div className="mt-2 pt-1.5 border-t border-white/[0.08] text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>{msg.timestamp} {msg.source ? `• ${msg.source}` : ""}</span>
              {msg.role === "assistant" && (
                <button
                  onClick={() => copyToClipboard(msg.content, idx)}
                  className="hover:text-white transition-colors"
                >
                  {copiedIdx === idx ? "Copied ✓" : "Copy"}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="bg-[#0E1827] border border-white/[0.07] rounded-xl p-3 text-xs text-sky-400 max-w-[50%] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span className="font-mono text-[11px]">Synthesizing clinical protocol...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="mt-3 pt-2.5 border-t border-white/[0.07] flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask clinical or vector protocol question..."
          className="flex-1 midnight-input text-xs"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="midnight-btn-primary px-3 py-1.5 text-xs"
        >
          Send
        </button>
      </form>
    </div>
  );
}
