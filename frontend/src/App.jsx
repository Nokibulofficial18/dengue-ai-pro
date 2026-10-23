import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import axios from "axios";

import AppShell from "./components/layout/AppShell.jsx";
import PublicOverview from "./pages/PublicOverview.jsx";
import HealthIntelligence from "./pages/HealthIntelligence.jsx";
import Authority from "./pages/Authority.jsx";
import Citizen from "./pages/Citizen.jsx";
import Demo from "./pages/Demo.jsx";
import Home from "./pages/Home.jsx";
import Wards from "./pages/Wards.jsx";
import SiteHazardRegistry from "./pages/SiteHazardRegistry.jsx";
import SmartScheduling from "./pages/SmartScheduling.jsx";
import ServiceVerification from "./pages/ServiceVerification.jsx";
import RepairPlanning from "./pages/RepairPlanning.jsx";
import MultiPropertyCoordination from "./pages/MultiPropertyCoordination.jsx";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [backendOnline, setBackendOnline] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/demo/status`)
      .then(() => setBackendOnline(true))
      .catch(() => {
        axios
          .get(`${API_URL}/api/health`)
          .then(() => setBackendOnline(true))
          .catch(() => setBackendOnline(false));
      });
  }, []);

  return (
    <BrowserRouter>
      <AppShell backendOnline={backendOnline}>
        <Routes>
          {/* Public Overview: Citizen & Public Health Surveillance View */}
          <Route path="/" element={<PublicOverview />} />

          {/* Health Intelligence Center: Clinical, Epidemiological & Dispatch Center */}
          <Route path="/intelligence" element={<HealthIntelligence />} />

          {/* Core Preserved Routes */}
          <Route path="/map" element={<Home />} />
          <Route path="/wards" element={<Wards />} />
          <Route path="/citizen" element={<Citizen />} />
          <Route path="/authority" element={<Authority />} />
          <Route path="/demo" element={<Demo />} />

          {/* Enterprise Authority Modules */}
          <Route path="/authority/sites" element={<SiteHazardRegistry />} />
          <Route path="/sites" element={<SiteHazardRegistry />} />
          <Route path="/authority/scheduling" element={<SmartScheduling />} />
          <Route path="/scheduling" element={<SmartScheduling />} />
          <Route path="/authority/services" element={<ServiceVerification />} />
          <Route path="/services" element={<ServiceVerification />} />
          <Route path="/authority/repair-planning" element={<RepairPlanning />} />
          <Route path="/repair-planning" element={<RepairPlanning />} />
          <Route path="/authority/coordination" element={<MultiPropertyCoordination />} />
          <Route path="/coordination" element={<MultiPropertyCoordination />} />
          <Route path="/multi-property" element={<MultiPropertyCoordination />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
