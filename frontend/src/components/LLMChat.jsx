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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    const timestamp = new Date().toLocaleTimeString();
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
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch {
      const fallback =
        mockData.llmResponses[content] ||
        mockData.llmResponses["Which 5 wards need dispatch today?"] ||
        "Demo response: Please try a predefined question.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: fallback,
          source: "Demo",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="text-sm font-semibold mb-2">Authority LLM Chat</div>

      <div className="flex flex-wrap gap-2 mb-3">
        {suggestions.map((text) => (
          <button
            key={text}
            onClick={() => sendMessage(text)}
            className="rounded-full bg-cyan-500/20 text-cyan-200 px-3 py-1 text-xs btn"
          >
            {text}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-auto bg-gradient-to-r from-cyan-500 to-emerald-400 text-[#0b1220]"
                : "bg-white/5"
            }`}
          >
            <div>{msg.content}</div>
            <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-between">
              <span>{msg.timestamp}</span>
              {msg.role === "assistant" && (
                <button
                  onClick={() => navigator.clipboard.writeText(msg.content)}
                  className="text-amber-300"
                >
                  Copy
                </button>
              )}
            </div>
            {msg.role === "assistant" && (
              <div className="mt-1 text-[10px] text-slate-400">
                Source: {msg.source || "Demo"}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="max-w-[60%] rounded-2xl bg-white/5 px-3 py-2 text-sm">
            <span className="inline-flex gap-1">
              <span className="animate-pulse">•</span>
              <span className="animate-pulse delay-100">•</span>
              <span className="animate-pulse delay-200">•</span>
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          rows={2}
          placeholder="Ask DengueAI Pro anything about current risk..."
          className="flex-1 rounded-2xl px-3 py-2 text-sm outline-none resize-none input"
        />
        <button
          onClick={() => sendMessage(input)}
          className="rounded-2xl px-4 py-2 text-sm font-semibold btn btn-amber"
        >
          Send
        </button>
      </div>

      <div className="mt-3 text-[10px] text-slate-400">
        Responses grounded in WHO guidelines and DGHS case records
      </div>
    </div>
  );
}
