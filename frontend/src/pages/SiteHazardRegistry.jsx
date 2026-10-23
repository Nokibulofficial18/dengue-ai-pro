import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { getCached, cachedGet, invalidateCache } from "../utils/apiCache";

const API_URL = import.meta.env.VITE_API_URL || "";

// Ward dictionary fallback for labels
const WARDS_LIST = [
  { ward_id: "DHK-001", ward_name: "Mirpur" },
  { ward_id: "DHK-002", ward_name: "Lalbagh" },
  { ward_id: "DHK-003", ward_name: "Uttara" },
  { ward_id: "DHK-004", ward_name: "Mohakhali" },
  { ward_id: "DHK-005", ward_name: "Tejgaon" },
  { ward_id: "DHK-006", ward_name: "Dhanmondi" },
  { ward_id: "DHK-007", ward_name: "Gulshan" },
  { ward_id: "DHK-008", ward_name: "Badda" },
  { ward_id: "DHK-009", ward_name: "Motijheel" },
  { ward_id: "DHK-010", ward_name: "Hazaribagh" },
];

export default function SiteHazardRegistry() {
  // Authority session state (persisted in sessionStorage for smooth cross-module navigation)
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("dengue_auth_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ username: "authority", password: "dengue2026" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Active navigation tab inside Registry
  const [activeTab, setActiveTab] = useState("properties"); // 'properties' | 'locations' | 'timeline' | 'recurring' | 'reports'

  // Data states initialized from client cache for instant 0ms mount render
  const [properties, setProperties] = useState(() => getCached(`${API_URL}/api/sites/properties`) || []);
  const [locations, setLocations] = useState(() => getCached(`${API_URL}/api/sites/locations`) || []);
  const [recurringLocations, setRecurringLocations] = useState(() => getCached(`${API_URL}/api/sites/locations/recurring?days=90`) || []);
  const [citizenReports, setCitizenReports] = useState(() => getCached(`${API_URL}/api/sites/citizen-reports`) || []);
  const [selectedLocationTimeline, setSelectedLocationTimeline] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [locationSchedulingStatus, setLocationSchedulingStatus] = useState(null);
  const [locationServiceOrders, setLocationServiceOrders] = useState([]);

  // Filter states
  const [wardFilter, setWardFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Loading & status states
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modals
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);

  // Selected entities for modals
  const [targetPropertyForLocation, setTargetPropertyForLocation] = useState(null);
  const [targetLocationForAction, setTargetLocationForAction] = useState(null);
  const [targetIssueForAction, setTargetIssueForAction] = useState(null);

  // Form states
  const [propertyForm, setPropertyForm] = useState({
    name: "",
    property_type: "industrial_facility",
    ward_id: "DHK-001",
    address: "",
    latitude: "",
    longitude: "",
    responsible_org: "",
    manager_name: "",
    manager_contact: "",
  });

  const [locationForm, setLocationForm] = useState({
    location_code: "",
    name: "",
    category: "roof_drain",
    floor_zone: "",
    written_directions: "",
    latitude: "",
    longitude: "",
    description: "",
  });

  const [inspectionForm, setInspectionForm] = useState({
    inspector_name: "Inspector Rahman",
    inspector_role: "DNCC Health Inspector",
    result: "problem_found",
    notes: "",
    evidence_notes: "",
    problem_identified: "",
    weather_conditions: "Humid, post-monsoon shower",
    create_issue: true,
    issue_type: "standing_water",
    issue_severity: "high",
    issue_description: "",
  });

  const [issueForm, setIssueForm] = useState({
    issue_type: "standing_water",
    description: "",
    severity: "medium",
  });

  const [resolveForm, setResolveForm] = useState({
    resolution_notes: "",
    resolved_by: "Inspector Rahman",
  });

  const [recurrenceForm, setRecurrenceForm] = useState({
    previous_issue_id: "",
    confirmed_by: "Senior Health Inspector (DNCC)",
    notes: "Confirmed recurrence: stagnant water returned to the same physical point after prior clearing.",
  });

  const [activityForm, setActivityForm] = useState({
    activity_type: "cleaning",
    performed_by: "Rapid Vector Response Team",
    notes: "Applied 500ml larvicide treatment and removed sediment obstruction.",
  });

  const [reportLinkSelection, setReportLinkSelection] = useState({});

  // Auth Header helper
  const getAuthHeaders = () => {
    if (!authSession?.token) return {};
    return {
      Authorization: `Bearer ${authSession.token}`,
    };
  };

  // -------------------------------------------------------------
  // Authority Authentication
  // -------------------------------------------------------------
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await axios.post(`${API_URL}/api/authority/login`, loginForm);
      setAuthSession({
        token: res.data.token,
        user: res.data.user,
      });
    } catch (err) {
      console.error("Authority login failed", err);
      setLoginError(
        err.response?.data?.detail || "Invalid credentials or backend unreachable."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleQuickDevLogin = () => {
    // Quick dev access using backend dev key
    setAuthSession({
      token: "dengue-authority-dev-2026",
      user: {
        username: "dev_officer",
        display_name: "DNCC Municipal Authority Lead",
        role: "authority_officer",
        agency: "Dhaka North City Corporation (Vector Intelligence)",
      },
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("dengue_auth_session");
    setAuthSession(null);
  };

  useEffect(() => {
    if (authSession) {
      sessionStorage.setItem("dengue_auth_session", JSON.stringify(authSession));
    }
  }, [authSession]);

  // -------------------------------------------------------------
  // Data Fetching with SWR client-side caching
  // -------------------------------------------------------------
  const refreshAllData = async (forceRefresh = false) => {
    if (!authSession) return;
    // Only show loading spinner on cold cache
    if (properties.length === 0 && locations.length === 0) {
      setLoading(true);
    }
    setActionError(null);
    const headers = getAuthHeaders();

    try {
      // 1. Fetch properties
      const propsRes = await cachedGet(`${API_URL}/api/sites/properties`, { headers }, undefined, forceRefresh);
      setProperties(propsRes.data);

      // 2. Fetch locations
      const locsRes = await cachedGet(`${API_URL}/api/sites/locations`, { headers }, undefined, forceRefresh);
      setLocations(locsRes.data);

      // 3. Fetch recurring locations
      const recRes = await cachedGet(`${API_URL}/api/sites/locations/recurring?days=90`, { headers }, undefined, forceRefresh);
      setRecurringLocations(recRes.data);

      // 4. Fetch citizen reports
      const crRes = await cachedGet(`${API_URL}/api/sites/citizen-reports`, { headers }, undefined, forceRefresh);
      setCitizenReports(crRes.data);

      // 5. If a location is currently selected for timeline, refresh it
      if (selectedLocationId) {
        loadTimeline(selectedLocationId);
      }
    } catch (err) {
      console.error("Failed to load registry data", err);
      if (err.response?.status === 401) {
        sessionStorage.removeItem("dengue_auth_session");
        setAuthSession(null);
        setLoginError("Session expired. Please re-authenticate.");
      } else {
        setActionError("Could not connect to backend Site Registry API.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authSession) {
      refreshAllData();
    }
  }, [authSession]);

  const loadTimeline = async (locId) => {
    setSelectedLocationId(locId);
    try {
      const [res, schedRes, woRes] = await Promise.all([
        axios.get(`${API_URL}/api/sites/locations/${locId}/timeline`, {
          headers: getAuthHeaders(),
        }),
        axios.get(`${API_URL}/api/scheduling/location/${locId}/status`, {
          headers: getAuthHeaders(),
        }).catch(() => null),
        axios.get(`${API_URL}/api/services/work-orders?location_id=${locId}`, {
          headers: getAuthHeaders(),
        }).catch(() => null),
      ]);
      setSelectedLocationTimeline(res.data);
      if (schedRes && schedRes.data) {
        setLocationSchedulingStatus(schedRes.data);
      } else {
        setLocationSchedulingStatus(null);
      }
      if (woRes && woRes.data) {
        setLocationServiceOrders(woRes.data);
      } else {
        setLocationServiceOrders([]);
      }
      setActiveTab("timeline");
    } catch (err) {
      console.error("Failed to load timeline", err);
      setActionError("Unable to retrieve location timeline.");
    }
  };

  // -------------------------------------------------------------
  // Property Actions
  // -------------------------------------------------------------
  const handleCreateProperty = async (e) => {
    e.preventDefault();
    setActionError(null);
    try {
      const payload = {
        ...propertyForm,
        latitude: propertyForm.latitude ? parseFloat(propertyForm.latitude) : null,
        longitude: propertyForm.longitude ? parseFloat(propertyForm.longitude) : null,
      };
      await axios.post(`${API_URL}/api/sites/properties`, payload, {
        headers: getAuthHeaders(),
      });
      setShowAddPropertyModal(false);
      setPropertyForm({
        name: "",
        property_type: "industrial_facility",
        ward_id: "DHK-001",
        address: "",
        latitude: "",
        longitude: "",
        responsible_org: "",
        manager_name: "",
        manager_contact: "",
      });
      setActionSuccess("Property registered successfully.");
      refreshAllData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to register property.");
    }
  };

  const handleArchiveProperty = async (propId, currentStatus) => {
    const shouldArchive = currentStatus !== "archived";
    if (!window.confirm(`Are you sure you want to ${shouldArchive ? "archive" : "restore"} this property?`)) return;
    try {
      await axios.patch(`${API_URL}/api/sites/properties/${propId}/archive?archive=${shouldArchive}`, {}, {
        headers: getAuthHeaders(),
      });
      setActionSuccess(`Property ${shouldArchive ? "archived" : "restored"}.`);
      refreshAllData();
    } catch (err) {
      setActionError("Failed to update property status.");
    }
  };

  // -------------------------------------------------------------
  // Location Actions
  // -------------------------------------------------------------
  const handleCreateLocation = async (e) => {
    e.preventDefault();
    if (!targetPropertyForLocation) return;
    setActionError(null);
    try {
      const payload = {
        ...locationForm,
        location_code: locationForm.location_code.trim().toUpperCase(),
        latitude: locationForm.latitude ? parseFloat(locationForm.latitude) : null,
        longitude: locationForm.longitude ? parseFloat(locationForm.longitude) : null,
      };
      await axios.post(`${API_URL}/api/sites/properties/${targetPropertyForLocation.id}/locations`, payload, {
        headers: getAuthHeaders(),
      });
      setShowAddLocationModal(false);
      setLocationForm({
        location_code: "",
        name: "",
        category: "roof_drain",
        floor_zone: "",
        written_directions: "",
        latitude: "",
        longitude: "",
        description: "",
      });
      setActionSuccess("Permanent hazard location registered.");
      refreshAllData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to register location.");
    }
  };

  // -------------------------------------------------------------
  // Inspection Actions
  // -------------------------------------------------------------
  const handleRecordInspection = async (e) => {
    e.preventDefault();
    if (!targetLocationForAction) return;
    setActionError(null);
    try {
      await axios.post(`${API_URL}/api/sites/locations/${targetLocationForAction.id}/inspections`, inspectionForm, {
        headers: getAuthHeaders(),
      });
      setShowInspectionModal(false);
      setActionSuccess("Inspection recorded successfully.");
      refreshAllData();
      if (selectedLocationId === targetLocationForAction.id) {
        loadTimeline(targetLocationForAction.id);
      }
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to record inspection.");
    }
  };

  // -------------------------------------------------------------
  // Issue & Recurrence Actions
  // -------------------------------------------------------------
  const handleCreateIssue = async (e) => {
    e.preventDefault();
    if (!targetLocationForAction) return;
    try {
      await axios.post(`${API_URL}/api/sites/locations/${targetLocationForAction.id}/issues`, issueForm, {
        headers: getAuthHeaders(),
      });
      setShowIssueModal(false);
      setActionSuccess("Hazard issue logged.");
      refreshAllData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to log issue.");
    }
  };

  const handleResolveIssue = async (e) => {
    e.preventDefault();
    if (!targetIssueForAction) return;
    try {
      await axios.post(`${API_URL}/api/sites/issues/${targetIssueForAction.id}/resolve`, resolveForm, {
        headers: getAuthHeaders(),
      });
      setShowResolveModal(false);
      setActionSuccess("Issue marked as resolved.");
      refreshAllData();
      if (selectedLocationId) loadTimeline(selectedLocationId);
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to resolve issue.");
    }
  };

  const handleConfirmRecurrence = async (e) => {
    e.preventDefault();
    if (!targetIssueForAction) return;
    try {
      await axios.post(`${API_URL}/api/sites/issues/${targetIssueForAction.id}/confirm-recurrence`, recurrenceForm, {
        headers: getAuthHeaders(),
      });
      setShowRecurrenceModal(false);
      setActionSuccess("Confirmed recurrence recorded.");
      refreshAllData();
      if (selectedLocationId) loadTimeline(selectedLocationId);
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to confirm recurrence.");
    }
  };

  // -------------------------------------------------------------
  // Activity Action
  // -------------------------------------------------------------
  const handleRecordActivity = async (e) => {
    e.preventDefault();
    if (!targetLocationForAction) return;
    try {
      await axios.post(`${API_URL}/api/sites/locations/${targetLocationForAction.id}/activities`, activityForm, {
        headers: getAuthHeaders(),
      });
      setShowActivityModal(false);
      setActionSuccess("Maintenance activity logged.");
      refreshAllData();
      if (selectedLocationId === targetLocationForAction.id) {
        loadTimeline(targetLocationForAction.id);
      }
    } catch (err) {
      setActionError("Failed to record maintenance activity.");
    }
  };

  // -------------------------------------------------------------
  // Citizen Report Association Actions
  // -------------------------------------------------------------
  const handleLinkReport = async (reportId) => {
    const locId = reportLinkSelection[reportId];
    if (!locId) {
      alert("Please select a target hazard location first.");
      return;
    }
    setActionError(null);
    try {
      await axios.post(
        `${API_URL}/api/sites/citizen-reports/${reportId}/link`,
        {
          location_id: locId,
          linked_by: authSession.user?.display_name || "Authority Reviewer",
          notes: "Confirmed from photo and location inspection records.",
        },
        { headers: getAuthHeaders() }
      );
      setActionSuccess(`Citizen report #${reportId} linked to permanent hazard location.`);
      refreshAllData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to link citizen report.");
    }
  };

  const handleUnlinkReport = async (reportId) => {
    if (!window.confirm(`Revoke association for citizen report #${reportId}?`)) return;
    try {
      await axios.post(
        `${API_URL}/api/sites/citizen-reports/${reportId}/unlink?reason=Corrected+by+authority`,
        {},
        { headers: getAuthHeaders() }
      );
      setActionSuccess(`Association for report #${reportId} revoked.`);
      refreshAllData();
    } catch (err) {
      setActionError("Failed to unlink report.");
    }
  };

  // -------------------------------------------------------------
  // Computed / Filtered Views
  // -------------------------------------------------------------
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      const matchWard = wardFilter === "all" || p.ward_id === wardFilter;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.manager_name && p.manager_name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchWard && matchSearch;
    });
  }, [properties, wardFilter, searchQuery]);

  const filteredLocations = useMemo(() => {
    return locations.filter((l) => {
      const matchWard = wardFilter === "all" || l.ward_id === wardFilter;
      const matchCategory = categoryFilter === "all" || l.category === categoryFilter;
      const matchSearch =
        !searchQuery ||
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.location_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.floor_zone && l.floor_zone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.property_name && l.property_name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchWard && matchCategory && matchSearch;
    });
  }, [locations, wardFilter, categoryFilter, searchQuery]);

  const unassignedReportsCount = useMemo(() => {
    return citizenReports.filter((r) => !r.location_id).length;
  }, [citizenReports]);

  // -------------------------------------------------------------
  // RENDER: Authentication Gate
  // -------------------------------------------------------------
  if (!authSession) {
    return (
      <div className="p-6 max-w-xl mx-auto my-12">
        <div className="card p-8 border-cyan-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🏛️</span>
            <div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300">
                Site & Hazard Registry
              </h1>
              <p className="text-xs text-slate-400">Restricted Authority Access — DNCC Vector Intelligence</p>
            </div>
          </div>

          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 mb-6 text-xs text-amber-200">
            <div className="font-semibold mb-1">🔒 Minimum Viable Authority Security</div>
            <div>
              Property and physical hazard records contain restricted municipal infrastructure data. Credentials are
              verified on the backend and held only in memory during this session.
            </div>
          </div>

          {loginError && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/30 p-3 mb-4 text-xs text-red-200">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Authority Username</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full rounded-xl px-3 py-2 text-sm input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full rounded-xl px-3 py-2 text-sm input"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold btn btn-primary mt-2"
            >
              {loginLoading ? "Authenticating..." : "Unlock Authority Registry"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>Dev demo credentials: <code className="text-cyan-300">authority</code> / <code className="text-cyan-300">dengue2026</code></span>
            <button
              onClick={handleQuickDevLogin}
              className="text-cyan-400 hover:text-cyan-300 underline font-medium"
            >
              Quick Connect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Main Registry Dashboard
  // -------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 card p-6 bg-gradient-to-r from-slate-900/90 via-[#0b1220]/90 to-slate-900/90">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="pill bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Task 01 Implementation
            </span>
            <span className="pill bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Persistent Records
            </span>
            <span className="text-xs text-slate-400">| DNCC Vector Control</span>
          </div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300">
            Site & Hazard Registry
          </h1>
          <p className="text-sm text-slate-300">
            Permanent physical asset records, chronological inspection history, recurrence intelligence, and citizen report linking.
          </p>
        </div>

        {/* Officer pill & actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="surface px-3 py-2 text-xs flex items-center gap-2 border border-white/10">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="font-semibold text-white">{authSession.user.display_name}</div>
              <div className="text-[10px] text-slate-400">{authSession.user.agency}</div>
            </div>
          </div>
          <button
            onClick={refreshAllData}
            disabled={loading}
            className="rounded-xl px-3 py-2 text-xs font-semibold btn btn-secondary text-slate-200"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
          <button
            onClick={handleLogout}
            className="rounded-xl px-3 py-2 text-xs font-semibold btn btn-ghost text-red-300 hover:bg-red-500/10"
          >
            Lock
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="rounded-xl bg-red-500/15 border border-red-500/30 p-3 text-sm text-red-200 flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-sm text-emerald-200 flex justify-between items-center">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Quick Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs uppercase text-slate-400">Registered Properties</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">{properties.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Factories, campuses, complexes</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-slate-400">Hazard Locations</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{locations.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Drains, sumps, tanks, basins</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-slate-400">Confirmed Recurrences</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{recurringLocations.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Verified repeat issues (90d)</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase text-slate-400">Unassigned Citizen Reports</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{unassignedReportsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting physical site triage</div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab("properties")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "properties"
              ? "bg-gradient-to-r from-cyan-500/30 to-emerald-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg"
              : "surface text-slate-300 hover:text-white"
          }`}
        >
          🏢 Properties & Sites ({properties.length})
        </button>
        <button
          onClick={() => setActiveTab("locations")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "locations"
              ? "bg-gradient-to-r from-cyan-500/30 to-emerald-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg"
              : "surface text-slate-300 hover:text-white"
          }`}
        >
          📍 Hazard Locations ({locations.length})
        </button>
        <button
          onClick={() => setActiveTab("recurring")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "recurring"
              ? "bg-gradient-to-r from-amber-500/30 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-lg"
              : "surface text-slate-300 hover:text-white"
          }`}
        >
          ⚠️ Recurring Problem Tracker ({recurringLocations.length})
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "reports"
              ? "bg-gradient-to-r from-rose-500/30 to-pink-500/20 text-rose-300 border border-rose-500/40 shadow-lg"
              : "surface text-slate-300 hover:text-white"
          }`}
        >
          📥 Citizen Report Association ({unassignedReportsCount} unassigned)
        </button>
        {selectedLocationTimeline && (
          <button
            onClick={() => setActiveTab("timeline")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "timeline"
                ? "bg-gradient-to-r from-purple-500/30 to-indigo-500/20 text-purple-300 border border-purple-500/40 shadow-lg"
                : "surface text-slate-300 hover:text-white"
            }`}
          >
            ⏱️ Location Timeline ({selectedLocationTimeline.location.location_code})
          </button>
        )}
      </div>

      {/* Global Filter Bar */}
      <div className="surface p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by name, code, zone, manager..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs input w-full sm:w-64"
          />
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs input"
          >
            <option value="all">All Wards</option>
            {WARDS_LIST.map((w) => (
              <option key={w.ward_id} value={w.ward_id}>
                {w.ward_name} ({w.ward_id})
              </option>
            ))}
          </select>

          {activeTab === "locations" && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs input"
            >
              <option value="all">All Categories</option>
              <option value="roof_drain">Roof Drain</option>
              <option value="water_tank">Water Storage Tank</option>
              <option value="construction_pit">Construction Pit</option>
              <option value="basement_drain">Basement Drain / Sump</option>
              <option value="outdoor_container">Outdoor Container</option>
              <option value="fountain">Fountain / Basin</option>
              <option value="gutter">Gutter / Culvert</option>
              <option value="other">Other</option>
            </select>
          )}
        </div>

        <div>
          {activeTab === "properties" && (
            <button
              onClick={() => setShowAddPropertyModal(true)}
              className="rounded-xl px-4 py-2 text-xs font-semibold btn btn-primary flex items-center gap-1.5"
            >
              <span>+</span> Register New Property
            </button>
          )}
          {activeTab === "locations" && (
            <button
              onClick={() => {
                if (properties.length === 0) {
                  alert("Please register a property first.");
                  return;
                }
                setTargetPropertyForLocation(properties[0]);
                setShowAddLocationModal(true);
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold btn btn-primary flex items-center gap-1.5"
            >
              <span>+</span> Register Hazard Location
            </button>
          )}
        </div>
      </div>

      {/* ======================================================= */}
      {/* TAB 1: PROPERTIES MANAGEMENT                            */}
      {/* ======================================================= */}
      {activeTab === "properties" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProperties.map((prop) => (
              <div key={prop.id} className="card p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-all">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="pill bg-slate-800 text-slate-300 text-[10px] font-mono mr-2">
                        {prop.id}
                      </span>
                      <span className={`pill text-[10px] ${prop.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"}`}>
                        {prop.status}
                      </span>
                    </div>
                    <span className="text-xs text-cyan-300 font-semibold">{prop.ward_name}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{prop.name}</h3>
                  <div className="text-xs text-slate-400 mb-3 capitalize">
                    {prop.property_type.replace(/_/g, " ")} · {prop.responsible_org || "Owner unassigned"}
                  </div>

                  <p className="text-xs text-slate-300 mb-3 line-clamp-2">📍 {prop.address}</p>

                  <div className="surface-muted p-2.5 rounded-xl text-xs space-y-1 mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Manager:</span>
                      <span className="text-slate-200">{prop.manager_name || "N/A"}</span>
                    </div>
                    {prop.manager_contact && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Contact:</span>
                        <span className="text-slate-200">{prop.manager_contact}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs py-2 border-t border-white/10 mb-3">
                    <span>Locations: <strong className="text-cyan-300">{prop.location_count}</strong></span>
                    <span>Open Issues: <strong className={prop.active_issues_count > 0 ? "text-amber-400" : "text-slate-400"}>{prop.active_issues_count}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTargetPropertyForLocation(prop);
                        setShowAddLocationModal(true);
                      }}
                      className="flex-1 rounded-xl py-1.5 text-xs font-semibold btn btn-primary text-center"
                    >
                      + Add Location
                    </button>
                    <button
                      onClick={() => handleArchiveProperty(prop.id, prop.status)}
                      className="rounded-xl px-2.5 py-1.5 text-xs btn btn-ghost text-slate-400 hover:text-white"
                      title={prop.status === "active" ? "Archive" : "Restore"}
                    >
                      {prop.status === "active" ? "Archive" : "Restore"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredProperties.length === 0 && (
            <div className="card p-12 text-center text-slate-400">
              <span className="text-4xl block mb-2">🏢</span>
              <p className="text-base font-semibold text-slate-300">No properties found</p>
              <p className="text-xs mt-1">Try clearing filters or click &quot;Register New Property&quot; above.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 2: HAZARD LOCATIONS REGISTRY                        */}
      {/* ======================================================= */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLocations.map((loc) => (
              <div key={loc.id} className="card p-5 flex flex-col justify-between hover:border-cyan-500/40 transition-all">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="pill bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-bold">
                      {loc.location_code}
                    </span>
                    <span className="text-xs text-slate-400">{loc.ward_name}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-0.5">{loc.name}</h3>
                  <div className="text-xs text-cyan-400/90 font-medium mb-2">
                    🏢 {loc.property_name}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="pill bg-slate-800 text-slate-300 text-[10px] capitalize">
                      {loc.category.replace(/_/g, " ")}
                    </span>
                    {loc.floor_zone && (
                      <span className="pill bg-slate-800 text-slate-400 text-[10px]">
                        Zone: {loc.floor_zone}
                      </span>
                    )}
                  </div>

                  {loc.written_directions && (
                    <div className="text-xs text-slate-300 surface-muted p-2.5 rounded-xl mb-3">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Directions:</span>
                      {loc.written_directions}
                    </div>
                  )}

                  {loc.description && (
                    <p className="text-xs text-slate-400 mb-3">{loc.description}</p>
                  )}
                </div>

                <div>
                  <div className="grid grid-cols-3 gap-1 text-center py-2 border-t border-white/10 mb-3 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">Inspections</div>
                      <div className="font-bold text-slate-200">{loc.total_inspections_count}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Open Issues</div>
                      <div className={`font-bold ${loc.open_issues_count > 0 ? "text-rose-400" : "text-slate-400"}`}>
                        {loc.open_issues_count}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Recurrences</div>
                      <div className={`font-bold ${loc.confirmed_recurrences_count > 0 ? "text-amber-400" : "text-slate-400"}`}>
                        {loc.confirmed_recurrences_count}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadTimeline(loc.id)}
                      className="flex-1 rounded-xl py-1.5 text-xs font-semibold btn btn-primary text-center"
                    >
                      Timeline &amp; History
                    </button>
                    <button
                      onClick={() => {
                        setTargetLocationForAction(loc);
                        setShowInspectionModal(true);
                      }}
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold btn btn-secondary text-slate-200"
                      title="Record physical visit inspection"
                    >
                      + Inspect
                    </button>
                    <button
                      onClick={() => {
                        setTargetLocationForAction(loc);
                        setShowActivityModal(true);
                      }}
                      className="rounded-xl px-2.5 py-1.5 text-xs btn btn-ghost text-slate-300"
                      title="Log maintenance or larvicide"
                    >
                      ⚙️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredLocations.length === 0 && (
            <div className="card p-12 text-center text-slate-400">
              <span className="text-4xl block mb-2">📍</span>
              <p className="text-base font-semibold text-slate-300">No hazard locations found</p>
              <p className="text-xs mt-1">Register a location inside an active property to begin tracking.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 3: LOCATION TIMELINE & MEDICAL-RECORD HISTORY       */}
      {/* ======================================================= */}
      {activeTab === "timeline" && selectedLocationTimeline && (
        <div className="space-y-6">
          {/* Location Summary Header */}
          <div className="card p-6 bg-gradient-to-r from-slate-900 via-[#0b1220] to-slate-900 border-purple-500/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="pill bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono text-xs font-bold">
                    {selectedLocationTimeline.location.location_code}
                  </span>
                  <span className="text-xs text-slate-400">
                    Property: <strong>{selectedLocationTimeline.location.property_name}</strong> ({selectedLocationTimeline.location.ward_name})
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {selectedLocationTimeline.location.name}
                </h2>
                <p className="text-xs text-slate-300">
                  Zone: {selectedLocationTimeline.location.floor_zone || "General Site"} | Category: {selectedLocationTimeline.location.category.replace(/_/g, " ")}
                </p>
                {selectedLocationTimeline.location.written_directions && (
                  <p className="text-xs text-slate-400 mt-2">
                    🧭 Directions: {selectedLocationTimeline.location.written_directions}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setTargetLocationForAction(selectedLocationTimeline.location);
                    setShowInspectionModal(true);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold btn btn-primary"
                >
                  + Record Inspection
                </button>
                <button
                  onClick={() => {
                    setTargetLocationForAction(selectedLocationTimeline.location);
                    setShowActivityModal(true);
                  }}
                  className="rounded-xl px-3 py-2 text-xs font-semibold btn btn-secondary text-slate-200"
                >
                  + Add Activity
                </button>
              </div>
            </div>
          </div>

          {/* Requirement 8.7: Location Inspection Schedule Section */}
          {locationSchedulingStatus && (
            <div className="card p-5 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/30 rounded-2xl shadow-xl space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Inspection Schedule &amp; Cadence</h3>
                    <p className="text-[11px] text-cyan-300">
                      Governed by {locationSchedulingStatus.effective_policy_name} (Routine Interval: {locationSchedulingStatus.normal_interval_days} Days)
                    </p>
                  </div>
                </div>
                <Link
                  to="/authority/scheduling"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/30 transition flex items-center gap-1 w-fit"
                >
                  <span>⚡</span> Open Smart Scheduling Desk →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Last Recorded Inspection</div>
                  <div className="text-sm font-bold text-white mt-1 font-mono">
                    {locationSchedulingStatus.last_inspection_date || "Never Inspected"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Result: <span className="text-slate-200 capitalize">{locationSchedulingStatus.last_inspection_result?.replace(/_/g, " ") || "N/A"}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Next Required Cadence Date</div>
                  <div className="text-sm font-bold text-white mt-1 font-mono">
                    {locationSchedulingStatus.next_required_date || "Pending Baseline"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Standard compliance deadline
                  </div>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Scheduled Visit Status</div>
                  <div className="text-sm font-bold mt-1 text-cyan-300 font-mono">
                    {locationSchedulingStatus.next_approved_visit
                      ? `${locationSchedulingStatus.next_approved_visit.scheduled_date} (Approved)`
                      : locationSchedulingStatus.has_active_recommendation
                      ? "Reinspection Proposed"
                      : "Routine Cadence"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {locationSchedulingStatus.status_summary}
                  </div>
                </div>
              </div>

              {locationSchedulingStatus.has_active_recommendation && locationSchedulingStatus.active_recommendation && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-300">
                      ⚡ Active Smart Recommendation ({locationSchedulingStatus.active_recommendation.trigger_type.replace(/_/g, " ").toUpperCase()}):
                    </span>
                    <span className="font-mono text-white font-semibold">
                      Target: {locationSchedulingStatus.active_recommendation.recommended_date}
                    </span>
                  </div>
                  <p className="text-slate-300">
                    {locationSchedulingStatus.active_recommendation.explanation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Linked Service Work Orders & Resolution Verification (Improvement 03) */}
          <div className="card p-5 bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-950 border border-purple-500/30 rounded-2xl shadow-xl space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛠️</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Service Work Orders &amp; Resolution Verification</h3>
                  <p className="text-[11px] text-purple-300">
                    Two-Stage Operational Audit: Track field contractor work completion separately from independent follow-up hazard resolution.
                  </p>
                </div>
              </div>
              <Link
                to="/authority/services"
                className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-purple-600/30 text-purple-200 border border-purple-500/50 hover:bg-purple-600/50 transition self-start md:self-auto flex items-center gap-1"
              >
                <span>🛠️</span> Open Services Desk →
              </Link>
            </div>

            {locationServiceOrders.length === 0 ? (
              <div className="text-xs text-slate-400 py-2 italic">
                No service work orders currently logged for this location point.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {locationServiceOrders.map((wo) => (
                  <div key={wo.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-cyan-300">{wo.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-300">
                        {wo.priority}
                      </span>
                    </div>
                    <div className="font-semibold text-white">{wo.title}</div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-900/60 text-purple-300 border border-purple-700">
                        Work: {wo.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-900/60 text-teal-300 border border-teal-700">
                        Resolution: {wo.resolution_verification_status.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 flex justify-between">
                      <span>Worker: {wo.assigned_worker_name}</span>
                      <span className="font-mono">Due: {wo.due_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline Events List */}
          <div className="card p-6">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <span>📜 Chronological Inspection &amp; Hazard History</span>
              <span className="text-xs font-normal text-slate-400">
                ({selectedLocationTimeline.events.length} total database records)
              </span>
            </h3>

            <div className="relative border-l-2 border-slate-700 ml-4 space-y-6">
              {selectedLocationTimeline.events.map((evt) => {
                let badgeColor = "bg-slate-700 text-slate-300";
                let icon = "📌";

                if (evt.event_type === "registration") {
                  badgeColor = "bg-purple-500/20 text-purple-300 border border-purple-500/30";
                  icon = "🏛️";
                } else if (evt.event_type === "inspection") {
                  if (evt.status === "clear") {
                    badgeColor = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
                    icon = "✓";
                  } else if (evt.status === "problem_found") {
                    badgeColor = "bg-rose-500/20 text-rose-300 border border-rose-500/30";
                    icon = "⚠️";
                  } else {
                    badgeColor = "bg-slate-700 text-slate-300";
                    icon = "❓";
                  }
                } else if (evt.event_type === "issue_reported") {
                  badgeColor = "bg-rose-500/20 text-rose-300 border border-rose-500/30";
                  icon = "🚨";
                } else if (evt.event_type === "issue_resolved") {
                  badgeColor = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
                  icon = "🟢";
                } else if (evt.event_type === "activity") {
                  if (evt.metadata?.type === "work_verified") {
                    badgeColor = "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold";
                    icon = "✅";
                  } else if (evt.metadata?.type === "resolution_confirmed") {
                    badgeColor = "bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold";
                    icon = "🎯";
                  } else if (evt.metadata?.type === "work_order_started") {
                    badgeColor = "bg-amber-500/20 text-amber-300 border border-amber-500/30";
                    icon = "▶️";
                  } else {
                    badgeColor = "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30";
                    icon = "🧹";
                  }
                } else if (evt.event_type === "citizen_report_linked") {
                  badgeColor = "bg-amber-500/20 text-amber-300 border border-amber-500/30";
                  icon = "📱";
                }

                return (
                  <div key={evt.id} className="relative pl-6">
                    {/* Timeline Node */}
                    <div className="absolute -left-[17px] top-1.5 h-8 w-8 rounded-full bg-[#0b1220] border-2 border-slate-600 flex items-center justify-center text-xs shadow-md">
                      {icon}
                    </div>

                    <div className="surface p-4 rounded-xl border border-white/5 hover:border-white/20 transition-all">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`pill text-[10px] ${badgeColor}`}>
                            {evt.event_type.replace(/_/g, " ").toUpperCase()}
                          </span>
                          <span className="text-sm font-bold text-white">{evt.title}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mb-2">{evt.description}</p>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                        <span>Responsible: <strong className="text-slate-200">{evt.performed_by || "System"}</strong></span>
                        {evt.status && (
                          <span className="capitalize">Result/Status: <strong className="text-slate-200">{evt.status}</strong></span>
                        )}
                      </div>

                      {/* Recurrence Action shortcut if issue is open and not recurring */}
                      {evt.event_type === "issue_reported" && evt.status === "open" && !evt.metadata.is_recurrence && (
                        <div className="mt-3 pt-2 border-t border-white/5 flex gap-2">
                          <button
                            onClick={() => {
                              setTargetIssueForAction({ id: evt.metadata.issue_id });
                              setShowResolveModal(true);
                            }}
                            className="rounded-xl px-3 py-1 text-xs font-semibold btn btn-primary"
                          >
                            Mark Resolved
                          </button>
                          <button
                            onClick={() => {
                              setTargetIssueForAction({ id: evt.metadata.issue_id });
                              setShowRecurrenceModal(true);
                            }}
                            className="rounded-xl px-3 py-1 text-xs font-semibold btn btn-secondary text-amber-300"
                          >
                            Confirm as Recurrence
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 4: RECURRING HAZARD TRACKER                         */}
      {/* ======================================================= */}
      {activeTab === "recurring" && (
        <div className="space-y-4">
          <div className="surface p-4 text-xs text-slate-300 flex items-center justify-between border-amber-500/30 bg-amber-500/5">
            <div>
              <span className="text-amber-400 font-bold text-sm block">⚠️ Confirmed Recurring Problem Intelligence</span>
              <span>
                Calculated strictly from real database records where an authorized reviewer confirmed an issue returned after prior resolution.
              </span>
            </div>
            <span className="pill bg-amber-400/20 text-amber-300 font-bold text-xs border border-amber-400/40">
              {recurringLocations.length} locations identified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recurringLocations.map((item) => (
              <div key={item.location_id} className="card p-5 border-amber-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="pill bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold">
                      {item.location_code}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">{item.ward_name}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{item.location_name}</h3>
                  <div className="text-xs text-cyan-400 mb-3">🏢 {item.property_name}</div>

                  {/* Calculated Statement from stored records */}
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 mb-3 text-xs text-amber-200">
                    <div className="font-semibold mb-0.5">Summary Intelligence:</div>
                    <div>&quot;{item.summary_statement}&quot;</div>
                  </div>

                  <div className="surface-muted p-3 rounded-xl text-xs space-y-1.5 mb-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">90-Day Confirmed Recurrences:</span>
                      <span className="font-bold text-amber-300">{item.repeat_count_90d}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lifetime Recurrences:</span>
                      <span className="text-slate-200">{item.total_repeat_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Unresolved Issues:</span>
                      <span className={item.open_issues_count > 0 ? "font-bold text-rose-400" : "text-emerald-300"}>
                        {item.open_issues_count} open
                      </span>
                    </div>
                  </div>

                  {item.latest_issue_description && (
                    <div className="text-xs text-slate-400 mb-3">
                      <span className="font-semibold text-slate-300 block">Latest Recurrence:</span>
                      {item.latest_issue_description}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {item.latest_issue_date ? `Last observed: ${new Date(item.latest_issue_date).toLocaleDateString()}` : ""}
                  </span>
                  <button
                    onClick={() => loadTimeline(item.location_id)}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold btn btn-primary"
                  >
                    View History &amp; Evidence
                  </button>
                </div>
              </div>
            ))}
          </div>

          {recurringLocations.length === 0 && (
            <div className="card p-12 text-center text-slate-400">
              <span className="text-4xl block mb-2">🎉</span>
              <p className="text-base font-semibold text-slate-300">No recurring hazards confirmed in the last 90 days</p>
              <p className="text-xs mt-1">When an issue returns after resolution and is confirmed by an inspector, it will appear here.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================= */}
      {/* TAB 5: CITIZEN REPORT ASSOCIATION                       */}
      {/* ======================================================= */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="surface p-4 text-xs text-slate-300 border-cyan-500/30 bg-cyan-500/5">
            <span className="font-bold text-cyan-300 text-sm block mb-1">📥 Citizen Report Association Desk</span>
            <span>
              Connect citizen stagnant-water reports to verified permanent physical locations. Unlinked reports remain
              strictly unassigned. Location suggestions from the matching ward require human confirmation.
            </span>
          </div>

          <div className="space-y-3">
            {citizenReports.map((report) => (
              <div
                key={report.id}
                className="card p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
                    📸
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-white">Report #{report.id}</span>
                      <span className="pill bg-slate-800 text-slate-300 text-[10px]">
                        {report.ward_name} ({report.ward_id})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(report.submitted_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center gap-3">
                      <span>YOLO Confidence: <strong>{(report.yolo_confidence * 100).toFixed(0)}%</strong></span>
                      <span>Verified Flag: <strong>{report.verified ? "Yes" : "No"}</strong></span>
                      <span>Points: <strong>{report.points_awarded}</strong></span>
                    </div>

                    {/* Associated Location Badge */}
                    <div className="mt-2 text-xs">
                      {report.location_id ? (
                        <span className="inline-flex items-center gap-1.5 pill bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ✓ Linked to: <strong>{report.location_name}</strong> ({report.location_code}) in {report.property_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 pill bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          ⚠️ Unassigned (No physical hazard location confirmed)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Linking Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  {!report.location_id ? (
                    <>
                      <select
                        value={reportLinkSelection[report.id] || ""}
                        onChange={(e) =>
                          setReportLinkSelection({ ...reportLinkSelection, [report.id]: e.target.value })
                        }
                        className="rounded-xl px-3 py-2 text-xs input flex-1 lg:w-64"
                      >
                        <option value="">-- Choose Candidate Location --</option>
                        {report.candidate_locations && report.candidate_locations.length > 0 ? (
                          <optgroup label={`Known Locations in ${report.ward_name}`}>
                            {report.candidate_locations.map((cand) => (
                              <option key={cand.location_id} value={cand.location_id}>
                                {cand.location_code} - {cand.name} ({cand.property_name})
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        <optgroup label="All Locations">
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.location_code} - {loc.name} ({loc.ward_name})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <button
                        onClick={() => handleLinkReport(report.id)}
                        className="rounded-xl px-4 py-2 text-xs font-semibold btn btn-primary flex-shrink-0"
                      >
                        Confirm Link
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadTimeline(report.location_id)}
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold btn btn-secondary text-slate-200"
                      >
                        View Timeline
                      </button>
                      <button
                        onClick={() => handleUnlinkReport(report.id)}
                        className="rounded-xl px-3 py-1.5 text-xs btn btn-ghost text-red-300 hover:bg-red-500/10"
                      >
                        Revoke Link
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: ADD PROPERTY                                     */}
      {/* ======================================================= */}
      {showAddPropertyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Register New Property</h3>
              <button onClick={() => setShowAddPropertyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateProperty} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Property Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Industrial Campus"
                  value={propertyForm.name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Property Type *</label>
                  <select
                    value={propertyForm.property_type}
                    onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  >
                    <option value="industrial_facility">Industrial Facility / Factory</option>
                    <option value="office_building">Office Building</option>
                    <option value="university_campus">University Campus</option>
                    <option value="residential_complex">Residential Complex</option>
                    <option value="hospital">Hospital / Medical Center</option>
                    <option value="other">Other Commercial Site</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ward *</label>
                  <select
                    value={propertyForm.ward_id}
                    onChange={(e) => setPropertyForm({ ...propertyForm, ward_id: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  >
                    {WARDS_LIST.map((w) => (
                      <option key={w.ward_id} value={w.ward_id}>
                        {w.ward_name} ({w.ward_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Address / Location Description *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Street address, sector, or landmark directions"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Latitude (Optional)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 23.8223"
                    value={propertyForm.latitude}
                    onChange={(e) => setPropertyForm({ ...propertyForm, latitude: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Longitude (Optional)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 90.3654"
                    value={propertyForm.longitude}
                    onChange={(e) => setPropertyForm({ ...propertyForm, longitude: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Responsible Organization</label>
                  <input
                    type="text"
                    placeholder="Company or Owner Name"
                    value={propertyForm.responsible_org}
                    onChange={(e) => setPropertyForm({ ...propertyForm, responsible_org: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Manager Contact</label>
                  <input
                    type="text"
                    placeholder="Phone or Email"
                    value={propertyForm.manager_contact}
                    onChange={(e) => setPropertyForm({ ...propertyForm, manager_contact: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Manager Name</label>
                <input
                  type="text"
                  placeholder="Full name of on-site manager"
                  value={propertyForm.manager_name}
                  onChange={(e) => setPropertyForm({ ...propertyForm, manager_name: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPropertyModal(false)}
                  className="rounded-xl px-4 py-2 btn btn-secondary text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 font-semibold btn btn-primary"
                >
                  Save Property Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: ADD HAZARD LOCATION                              */}
      {/* ======================================================= */}
      {showAddLocationModal && targetPropertyForLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Register Hazard Location</h3>
                <p className="text-xs text-cyan-300">Property: {targetPropertyForLocation.name}</p>
              </div>
              <button onClick={() => setShowAddLocationModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B-NORTH-DRAIN-07"
                    value={locationForm.location_code}
                    onChange={(e) => setLocationForm({ ...locationForm, location_code: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input uppercase font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Unique identifier within this site</span>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category *</label>
                  <select
                    value={locationForm.category}
                    onChange={(e) => setLocationForm({ ...locationForm, category: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  >
                    <option value="roof_drain">Roof Drain</option>
                    <option value="water_tank">Water Storage Tank</option>
                    <option value="construction_pit">Construction Pit</option>
                    <option value="basement_drain">Basement Drain / Sump</option>
                    <option value="outdoor_container">Outdoor Container Area</option>
                    <option value="fountain">Fountain / Basin</option>
                    <option value="gutter">Gutter / Storm Drain</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Building B North Roof Drain"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Floor, Section, or Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Building B - Roof Level North"
                  value={locationForm.floor_zone}
                  onChange={(e) => setLocationForm({ ...locationForm, floor_zone: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Written Navigation Directions</label>
                <textarea
                  rows={2}
                  placeholder="Step-by-step navigation instructions for visiting inspectors"
                  value={locationForm.written_directions}
                  onChange={(e) => setLocationForm({ ...locationForm, written_directions: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description / Risk Notes</label>
                <textarea
                  rows={2}
                  placeholder="Physical characteristics, drain dimensions, known pooling causes"
                  value={locationForm.description}
                  onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-xs"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLocationModal(false)}
                  className="rounded-xl px-4 py-2 btn btn-secondary text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 font-semibold btn btn-primary"
                >
                  Register Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: RECORD INSPECTION                                */}
      {/* ======================================================= */}
      {showInspectionModal && targetLocationForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border-cyan-500/30">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Record On-Site Inspection</h3>
                <p className="text-xs text-cyan-300">
                  Location: {targetLocationForAction.name} ({targetLocationForAction.location_code})
                </p>
              </div>
              <button onClick={() => setShowInspectionModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 mb-4 text-[11px] text-amber-200">
              ⚠️ <strong>Mandatory Safety Guideline:</strong> A &quot;clear&quot; inspection confirms only that no vector or
              stagnant water was visible on this visit. It does not certify the location is permanently dengue-free.
            </div>

            <form onSubmit={handleRecordInspection} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Inspector Name *</label>
                  <input
                    type="text"
                    required
                    value={inspectionForm.inspector_name}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, inspector_name: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Inspection Result *</label>
                  <select
                    value={inspectionForm.result}
                    onChange={(e) => setInspectionForm({ ...inspectionForm, result: e.target.value })}
                    className="w-full rounded-xl px-3 py-2 input font-semibold"
                  >
                    <option value="problem_found">⚠️ Problem Found</option>
                    <option value="clear">✓ Clear (No issue observed)</option>
                    <option value="unable_to_inspect">❓ Unable to Inspect</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Weather / Environmental Conditions</label>
                <input
                  type="text"
                  placeholder="e.g. Overcast, 31°C, heavy rains 24h prior"
                  value={inspectionForm.weather_conditions}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, weather_conditions: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Inspector Observations &amp; Notes *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe physical conditions observed at the location"
                  value={inspectionForm.notes}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-xs"
                />
              </div>

              {inspectionForm.result === "problem_found" && (
                <div className="surface p-3 rounded-xl border border-rose-500/30 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300">Hazard Finding Details</span>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inspectionForm.create_issue}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, create_issue: e.target.checked })}
                      />
                      Create Tracked Issue
                    </label>
                  </div>

                  {inspectionForm.create_issue && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-400 mb-0.5">Issue Type</label>
                          <select
                            value={inspectionForm.issue_type}
                            onChange={(e) => setInspectionForm({ ...inspectionForm, issue_type: e.target.value })}
                            className="w-full rounded-xl px-2 py-1.5 input text-xs"
                          >
                            <option value="standing_water">Standing Water</option>
                            <option value="larvae_detected">Mosquito Larvae Detected</option>
                            <option value="clogged_drainage">Clogged Drainage</option>
                            <option value="broken_cover">Broken Cover / Grate</option>
                            <option value="debris_accumulation">Debris Accumulation</option>
                            <option value="other">Other Structural Hazard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-0.5">Severity</label>
                          <select
                            value={inspectionForm.issue_severity}
                            onChange={(e) => setInspectionForm({ ...inspectionForm, issue_severity: e.target.value })}
                            className="w-full rounded-xl px-2 py-1.5 input text-xs"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-0.5">Issue Description</label>
                        <input
                          type="text"
                          placeholder="e.g. 5cm pooled water with visible organic sludge"
                          value={inspectionForm.issue_description}
                          onChange={(e) => setInspectionForm({ ...inspectionForm, issue_description: e.target.value })}
                          className="w-full rounded-xl px-2 py-1.5 input text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInspectionModal(false)}
                  className="rounded-xl px-4 py-2 btn btn-secondary text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 font-semibold btn btn-primary"
                >
                  Save Inspection Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: RECORD MAINTENANCE ACTIVITY                      */}
      {/* ======================================================= */}
      {showActivityModal && targetLocationForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">Record Maintenance Action</h3>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordActivity} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Activity Type *</label>
                <select
                  value={activityForm.activity_type}
                  onChange={(e) => setActivityForm({ ...activityForm, activity_type: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-sm"
                >
                  <option value="cleaning">Debris &amp; Silt Cleaning</option>
                  <option value="larvicide_treatment">Larvicide Application</option>
                  <option value="drainage_repair">Drainage Pipe / Pump Repair</option>
                  <option value="structural_modification">Structural Gradient Correction</option>
                  <option value="notes">General Inspection Note</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Performed By *</label>
                <input
                  type="text"
                  required
                  value={activityForm.performed_by}
                  onChange={(e) => setActivityForm({ ...activityForm, performed_by: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Action Notes &amp; Outcome</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Details of larvicide volume, mechanical unclogging, or replacement parts installed"
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-xs"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  className="rounded-xl px-4 py-2 btn btn-secondary text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 font-semibold btn btn-primary"
                >
                  Log Maintenance Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: RESOLVE ISSUE                                    */}
      {/* ======================================================= */}
      {showResolveModal && targetIssueForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">Resolve Hazard Issue</h3>
              <button onClick={() => setShowResolveModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleResolveIssue} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Resolved By (Authority Officer) *</label>
                <input
                  type="text"
                  required
                  value={resolveForm.resolved_by}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolved_by: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Resolution Verification Notes *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe verification evidence (e.g. water fully evacuated, drain slope corrected, verified dry)"
                  value={resolveForm.resolution_notes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolution_notes: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-xs"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="rounded-xl px-4 py-2 btn btn-secondary text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 font-semibold btn btn-primary"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL: CONFIRM RECURRENCE                               */}
      {/* ======================================================= */}
      {showRecurrenceModal && targetIssueForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card p-6 w-full max-w-md border-amber-500/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">Confirm Recurrence Link</h3>
              <button onClick={() => setShowRecurrenceModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 mb-3 text-[11px] text-amber-200">
              A recurrence requires human confirmation that this new issue is a repeat of an earlier resolved issue at
              the exact same physical location.
            </div>

            <form onSubmit={handleConfirmRecurrence} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Previous Resolved Issue ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ISSUE-SEED-01"
                  value={recurrenceForm.previous_issue_id}
                  onChange={(e) => setRecurrenceForm({ ...recurrenceForm, previous_issue_id: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Confirmed By *</label>
                <input
                  type="text"
                  required
                  value={recurrenceForm.confirmed_by}
                  onChange={(e) => setRecurrenceForm({ ...recurrenceForm, confirmed_by: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Recurrence Notes</label>
                <textarea
                  rows={2}
                  value={recurrenceForm.notes}
                  onChange={(e) => setRecurrenceForm({ ...recurrenceForm, notes: e.target.value })}
                  className="w-full rounded-xl px-3 py-2 input text-xs"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecurrenceModal(false)}
                  className="rounded-xl px-4 py-2 btn btn-secondary text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 font-semibold btn btn-primary"
                >
                  Confirm Recurrence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
