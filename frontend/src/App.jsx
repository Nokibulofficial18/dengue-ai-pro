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
      <div className="min-h-screen bg-[#0b1220] text-slate-50">
        {!backendOnline && (
          <div className="bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1220] text-center text-sm py-2">
            Running in offline demo mode — using sample Dhaka data
          </div>
        )}
        <nav className="glass px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-lg">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300">
              DengueAI Pro
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link
                to="/"
                className="text-sm font-medium text-slate-200 hover:text-cyan-300"
              >
                Live Map
              </Link>
              <Link
                to="/wards"
                className="text-sm font-medium text-slate-200 hover:text-cyan-300"
              >
                Ward Details
              </Link>
              <Link
                to="/citizen"
                className="text-sm font-medium text-slate-200 hover:text-cyan-300"
              >
                Citizen Reports
              </Link>
              <Link
                to="/authority"
                className="text-sm font-medium text-slate-200 hover:text-cyan-300"
              >
                Authority Dashboard
              </Link>
              <Link
                to="/demo"
                className="text-sm font-medium text-slate-200 hover:text-cyan-300"
              >
                Demo
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-400/20 text-emerald-200 px-3 py-1 text-xs font-semibold badge">
              SDG 03
            </span>
            <span className="rounded-full bg-amber-300/90 px-3 py-1 text-xs font-semibold text-[#0b1220] badge">
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
              className="md:hidden text-sm text-slate-100"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              ☰
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div className="md:hidden surface px-6 py-3 flex flex-col gap-2">
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
