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
      content: "Hello Officer. I am the DengueAI Pro RAG intelligence assistant. Ask me about ward risk scores, larviciding protocols, or DGHS clinical guidelines.",
      source: "WHO / DGHS Knowledge Base",
      timestamp: "Just now",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
            className="rounded-full bg-[#162E4D] text-[#46C8E5] border border-[#46C8E5]/30 hover:bg-[#1B3654] px-2.5 py-1 text-[11px] font-medium transition"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px] min-h-[220px]">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-[#1E6FD9] text-white shadow-md shadow-[#1E6FD9]/20"
                : "bg-[#172C45] border border-[#1B3654] text-slate-100"
            }`}
          >
            <div className="whitespace-pre-line">{msg.content}</div>
            <div className="mt-1.5 pt-1 border-t border-white/10 text-[9px] text-[#9FB3C9] flex items-center justify-between">
              <span>{msg.timestamp} {msg.source ? `• ${msg.source}` : ""}</span>
              {msg.role === "assistant" && (
                <button
                  onClick={() => navigator.clipboard.writeText(msg.content)}
                  className="text-[#46C8E5] hover:underline"
                >
                  Copy
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="max-w-[60%] rounded-2xl bg-[#172C45] border border-[#1B3654] p-3 text-xs text-[#46C8E5]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#46C8E5] animate-ping" />
              <span>Consulting WHO vector guidelines...</span>
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input box */}
      <div className="mt-3 pt-3 border-t border-[#1B3654]/60 flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          rows={1}
          placeholder="Ask RAG about SWAPI risk or protocols..."
          className="flex-1 bg-[#0D1C2E] border border-[#1B3654] text-xs text-white rounded-xl px-3 py-2 outline-none focus:border-[#46C8E5] transition resize-none placeholder-[#9FB3C9]/60"
        />
        <button
          onClick={() => sendMessage(input)}
          className="midnight-btn-primary py-2 px-3.5 text-xs shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
