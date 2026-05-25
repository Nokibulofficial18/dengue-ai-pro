import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import axios from "axios";

import Authority from "./pages/Authority.jsx";
import Citizen from "./pages/Citizen.jsx";
import Demo from "./pages/Demo.jsx";
import Home from "./pages/Home.jsx";
import Wards from "./pages/Wards.jsx";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/demo/status`)
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/health`).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0F1A2E] text-white">
        {!backendOnline && (
          <div className="bg-[#E8A020] text-[#0F1A2E] text-center text-sm py-2">
            Running in offline demo mode — using sample Dhaka data
          </div>
        )}
        <nav className="bg-[#1A3C5E] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-[#0F7B6C]">
              DengueAI Pro
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/"
                className="text-sm font-medium hover:text-[#0F7B6C]"
              >
                Live Map
              </Link>
              <Link
                to="/wards"
                className="text-sm font-medium hover:text-[#0F7B6C]"
              >
                Ward Details
              </Link>
              <Link
                to="/citizen"
                className="text-sm font-medium hover:text-[#0F7B6C]"
              >
                Citizen Reports
              </Link>
              <Link
                to="/authority"
                className="text-sm font-medium hover:text-[#0F7B6C]"
              >
                Authority Dashboard
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#0F7B6C] px-3 py-1 text-xs font-semibold">
              SDG 03
            </span>
            <span className="rounded-full bg-[#E8A020] px-3 py-1 text-xs font-semibold text-[#0F1A2E]">
              BuildFest 2026
            </span>
            <span className="flex items-center gap-2 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendOnline ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              {backendOnline ? "Backend Online" : "Backend Offline"}
            </span>
            <button
              className="md:hidden text-sm"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              ☰
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div className="md:hidden bg-[#1A3C5E] px-6 py-3 flex flex-col gap-2">
            <Link to="/" onClick={() => setMenuOpen(false)}>
              Live Map
            </Link>
            <Link to="/wards" onClick={() => setMenuOpen(false)}>
              Ward Details
            </Link>
            <Link to="/citizen" onClick={() => setMenuOpen(false)}>
              Citizen Reports
            </Link>
            <Link to="/authority" onClick={() => setMenuOpen(false)}>
              Authority Dashboard
            </Link>
            <Link to="/demo" onClick={() => setMenuOpen(false)}>
              Demo
            </Link>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wards" element={<Wards />} />
          <Route path="/citizen" element={<Citizen />} />
          <Route path="/authority" element={<Authority />} />
          <Route path="/demo" element={<Demo />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
