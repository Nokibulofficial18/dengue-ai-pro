import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { getCached, cachedGet, invalidateCache } from "../utils/apiCache";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function SmartScheduling() {
  // In-memory authority session state (persisted in sessionStorage for cross-tab continuity)
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

  // Active navigation tab
  const [activeTab, setActiveTab] = useState("recommendations"); // 'recommendations' | 'calendar' | 'rainfall' | 'policies'

  // Data states initialized from client cache for instant 0ms mount render
  const [stats, setStats] = useState(() => getCached(`${API_URL}/api/scheduling/stats`));
  const [recommendations, setRecommendations] = useState(() => getCached(`${API_URL}/api/scheduling/recommendations`) || []);
  const [calendarItems, setCalendarItems] = useState(() => getCached(`${API_URL}/api/scheduling/calendar`) || []);
  const [rainfallRecords, setRainfallRecords] = useState(() => getCached(`${API_URL}/api/scheduling/rainfall`) || []);
  const [policies, setPolicies] = useState(() => getCached(`${API_URL}/api/scheduling/policies`) || []);
  const [properties, setProperties] = useState(() => getCached(`${API_URL}/api/sites/properties`) || []);

  // Filters
  const [statusFilter, setStatusFilter] = useState("proposed");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Loading & notification states
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modals
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionTargetRec, setDecisionTargetRec] = useState(null);
  const [decisionType, setDecisionType] = useState("approved"); // 'approved' | 'modified' | 'rejected'
  const [decisionForm, setDecisionForm] = useState({ approved_date: "", decision_notes: "" });

  const [showRainfallModal, setShowRainfallModal] = useState(false);
  const [rainfallForm, setRainfallForm] = useState({
    rainfall_mm: "32.5",
    recorded_at: new Date().toISOString().slice(0, 16),
    ward_id: "W-01",
    area_description: "Mirpur Industrial Zone & Northern Dhaka",
    data_source: "Bangladesh Meteorological Department (BMD Agargaon)",
    status: "verified",
    notes: "Monsoon convective cloudburst resulting in localized ponding.",
  });

  const [showEditPolicyModal, setShowEditPolicyModal] = useState(false);
  const [targetPolicy, setTargetPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState({
    name: "",
    normal_interval_days: 14,
    recurrence_followup_days: 5,
    resolution_followup_days: 7,
    rainfall_threshold_mm: 25.0,
    max_interval_days: 30,
  });

  const [showRecordInspectionModal, setShowRecordInspectionModal] = useState(false);
  const [targetScheduledVisit, setTargetScheduledVisit] = useState(null);
  const [quickInspectionForm, setQuickInspectionForm] = useState({
    inspector_name: "Senior Field Inspector",
    inspector_role: "DNCC Health Inspector",
    result: "clear",
    notes: "Followed up on smart scheduling alert. Surface drain cleared.",
    evidence_notes: "Water drained completely; no active mosquito larvae observed.",
    problem_identified: "",
    weather_conditions: "Humid post-shower",
  });

  // Auth Header helper
  const getAuthHeaders = () => {
    if (!authSession?.token) return {};
    return {
      Authorization: `Bearer ${authSession.token}`,
      "X-Authority-Key": authSession.token,
    };
  };

  // Sync session to sessionStorage
  useEffect(() => {
    if (authSession) {
      sessionStorage.setItem("dengue_auth_session", JSON.stringify(authSession));
    } else {
      sessionStorage.removeItem("dengue_auth_session");
    }
  }, [authSession]);

  // Handle Login
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
      console.error("Login failed", err);
      setLoginError(err.response?.data?.detail || "Invalid credentials or backend unreachable.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleQuickDevLogin = () => {
    setAuthSession({
      token: "dengue-authority-dev-2026",
      user: {
        username: "authority_officer",
        display_name: "DNCC Municipal Authority Lead",
        role: "authority_officer",
        agency: "Dhaka North City Corporation (Vector Intelligence)",
      },
    });
  };

  const handleLogout = () => {
    setAuthSession(null);
  };

  // --------------------------------------------------------------------------
  // Data Fetching with SWR client-side caching
  // --------------------------------------------------------------------------
  const refreshData = async (forceRefresh = false) => {
    if (!authSession) return;
    // Only show loading spinner on cold cache
    if (!stats && recommendations.length === 0) {
      setLoading(true);
    }
    setActionError(null);
    try {
      const headers = getAuthHeaders();
      const [statsRes, recsRes, calRes, rainRes, polRes, propRes] = await Promise.all([
        cachedGet(`${API_URL}/api/scheduling/stats`, { headers }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/scheduling/recommendations`, { headers }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/scheduling/calendar`, { headers }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/scheduling/rainfall`, { headers }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/scheduling/policies`, { headers }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/sites/properties`, { headers }, undefined, forceRefresh).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setRecommendations(recsRes.data);
      setCalendarItems(calRes.data);
      setRainfallRecords(rainRes.data);
      setPolicies(polRes.data);
      setProperties(propRes.data);
    } catch (err) {
      console.error("Failed to load scheduling data", err);
      if (err.response?.status === 401) {
        sessionStorage.removeItem("dengue_auth_session");
        setAuthSession(null);
        setLoginError("Session expired or invalid. Please re-authenticate.");
      }
      setActionError(err.response?.data?.detail || "Failed to load scheduling records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authSession) {
      refreshData();
    }
  }, [authSession]);

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------
  const handleTriggerEvaluation = async () => {
    setEvaluating(true);
    setActionError(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/scheduling/evaluate`,
        { force_reevaluate: false },
        { headers: getAuthHeaders() }
      );
      setActionSuccess(
        `Smart evaluation complete: ${res.data.evaluated_locations_count} locations evaluated, ${res.data.recommendations_generated} new recommendations computed.`
      );
      await refreshData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Evaluation trigger failed.");
    } finally {
      setEvaluating(false);
    }
  };

  const openDecisionModal = (rec, type) => {
    setDecisionTargetRec(rec);
    setDecisionType(type);
    setDecisionForm({
      approved_date: rec.recommended_date,
      decision_notes:
        type === "approved"
          ? `Approved recommended date based on ${rec.trigger_type.replace(/_/g, " ")} intelligence.`
          : "",
    });
    setShowDecisionModal(true);
  };

  const handleSubmitDecision = async (e) => {
    if (e) e.preventDefault();
    if (!decisionTargetRec) return;

    if (decisionType === "modified" && !decisionForm.approved_date) {
      alert("Please specify a revised approved date.");
      return;
    }
    if ((decisionType === "modified" || decisionType === "rejected") && !decisionForm.decision_notes.trim()) {
      alert("A reason or explanation note is mandatory when modifying or rejecting recommendations.");
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/scheduling/recommendations/${decisionTargetRec.id}/decide`,
        {
          decision: decisionType,
          approved_date: decisionType !== "rejected" ? decisionForm.approved_date : null,
          decision_notes: decisionForm.decision_notes,
        },
        { headers: getAuthHeaders() }
      );
      setShowDecisionModal(false);
      setActionSuccess(`Recommendation successfully marked as ${decisionType.toUpperCase()}.`);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save recommendation decision.");
    }
  };

  const handleRecordRainfall = async (e) => {
    if (e) e.preventDefault();
    try {
      await axios.post(
        `${API_URL}/api/scheduling/rainfall`,
        {
          rainfall_mm: parseFloat(rainfallForm.rainfall_mm),
          recorded_at: new Date(rainfallForm.recorded_at).toISOString(),
          ward_id: rainfallForm.ward_id || null,
          area_description: rainfallForm.area_description,
          data_source: rainfallForm.data_source,
          status: rainfallForm.status,
          notes: rainfallForm.notes,
        },
        { headers: getAuthHeaders() }
      );
      setShowRainfallModal(false);
      setActionSuccess("Rainfall observation recorded. Automated re-evaluation triggered for exposed hazards.");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to record rainfall observation.");
    }
  };

  const openEditPolicyModal = (policy) => {
    setTargetPolicy(policy);
    setPolicyForm({
      name: policy.name,
      normal_interval_days: policy.normal_interval_days,
      recurrence_followup_days: policy.recurrence_followup_days,
      resolution_followup_days: policy.resolution_followup_days,
      rainfall_threshold_mm: policy.rainfall_threshold_mm,
      max_interval_days: policy.max_interval_days,
    });
    setShowEditPolicyModal(true);
  };

  const handleSavePolicy = async (e) => {
    if (e) e.preventDefault();
    if (!targetPolicy) return;
    try {
      await axios.patch(
        `${API_URL}/api/scheduling/policies/${targetPolicy.id}`,
        {
          normal_interval_days: parseInt(policyForm.normal_interval_days, 10),
          recurrence_followup_days: parseInt(policyForm.recurrence_followup_days, 10),
          resolution_followup_days: parseInt(policyForm.resolution_followup_days, 10),
          rainfall_threshold_mm: parseFloat(policyForm.rainfall_threshold_mm),
          max_interval_days: parseInt(policyForm.max_interval_days, 10),
        },
        { headers: getAuthHeaders() }
      );
      setShowEditPolicyModal(false);
      setActionSuccess(`Policy '${targetPolicy.name}' updated successfully.`);
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update policy.");
    }
  };

  const openRecordInspectionModal = (calendarItem) => {
    setTargetScheduledVisit(calendarItem);
    setQuickInspectionForm({
      inspector_name: authSession?.user?.display_name || "Field Inspector",
      inspector_role: "DNCC Health Inspector",
      result: "clear",
      notes: `Reinspection completed as scheduled for ${calendarItem.location_code}.`,
      evidence_notes: "Drain inspected and clear of standing water.",
      problem_identified: "",
      weather_conditions: "Humid post-shower",
    });
    setShowRecordInspectionModal(true);
  };

  const handleSaveInspectionVisit = async (e) => {
    if (e) e.preventDefault();
    if (!targetScheduledVisit) return;
    try {
      // 1. Record physical inspection
      const inspRes = await axios.post(
        `${API_URL}/api/sites/locations/${targetScheduledVisit.location_id}/inspections`,
        {
          inspector_name: quickInspectionForm.inspector_name,
          inspector_role: quickInspectionForm.inspector_role,
          result: quickInspectionForm.result,
          notes: quickInspectionForm.notes,
          evidence_notes: quickInspectionForm.evidence_notes,
          problem_identified: quickInspectionForm.problem_identified,
          weather_conditions: quickInspectionForm.weather_conditions,
          create_issue: quickInspectionForm.result === "problem_found",
          issue_type: "standing_water",
          issue_severity: "high",
        },
        { headers: getAuthHeaders() }
      );

      // 2. Complete scheduled visit if visit id is known
      if (targetScheduledVisit.id && targetScheduledVisit.item_type !== "proposed_recommendation") {
        await axios.patch(
          `${API_URL}/api/scheduling/scheduled/${targetScheduledVisit.id}/complete`,
          {
            completed_inspection_id: inspRes.data.id,
            notes: quickInspectionForm.notes,
          },
          { headers: getAuthHeaders() }
        );
      }

      setShowRecordInspectionModal(false);
      setActionSuccess("Physical inspection recorded and linked to scheduled visit! Timeline updated.");
      await refreshData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to record physical inspection.");
    }
  };

  // --------------------------------------------------------------------------
  // Filtered Lists
  // --------------------------------------------------------------------------
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (triggerFilter !== "all" && r.trigger_type !== triggerFilter) return false;
      if (propertyFilter !== "all" && r.property_id !== propertyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (r.location_code || "").toLowerCase();
        const name = (r.location_name || "").toLowerCase();
        const prop = (r.property_name || "").toLowerCase();
        const exp = (r.explanation || "").toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !prop.includes(q) && !exp.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [recommendations, statusFilter, triggerFilter, propertyFilter, searchQuery]);

  const triggerBadges = {
    recurring_hazard: {
      bg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      icon: "🔄",
      label: "Recurring Hazard",
    },
    rainfall_event: {
      bg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      icon: "🌧️",
      label: "Rainfall Trigger",
    },
    post_resolution_followup: {
      bg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      icon: "🛠️",
      label: "Post-Resolution Check",
    },
    baseline_policy: {
      bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      icon: "📋",
      label: "Routine Baseline",
    },
    low_information_baseline: {
      bg: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      icon: "ℹ️",
      label: "Low-History Baseline",
    },
  };

  // Auto-hide success banner
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  // --------------------------------------------------------------------------
  // AUTH GATE SCREEN
  // --------------------------------------------------------------------------
  if (!authSession) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md card p-8 bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-6">
            <span className="text-4xl">📅</span>
            <h1 className="text-2xl font-bold text-white mt-2">Smart Inspection Scheduling</h1>
            <p className="text-xs text-slate-400 mt-1">
              Restricted Authority Module • Requires Authorized Municipal Credentials
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-xs">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Authority Username
              </label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-700 p-3 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Security Password
              </label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-700 p-3 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 transition shadow-lg"
            >
              {loginLoading ? "Verifying Authority..." : "Authenticate Authority Session"}
            </button>

            <button
              type="button"
              onClick={handleQuickDevLogin}
              className="w-full py-2.5 rounded-xl font-semibold text-xs bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-slate-700 transition"
            >
              ⚡ Quick Developer Access (Local Session Key)
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-5">
            Default local credentials: <code className="text-cyan-300">authority</code> /{" "}
            <code className="text-cyan-300">dengue2026</code>
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN SCHEDULING DASHBOARD
  // --------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs font-bold text-emerald-400">
            ✕
          </button>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/50 rounded-2xl text-rose-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs font-bold text-rose-400">
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="card p-6 bg-gradient-to-r from-slate-900 via-[#0b1626] to-[#071322] border border-cyan-500/20 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📅</span>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Smart Reinspection Scheduling
            </h1>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              Improvement 02 Active
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Explainable follow-up recommendations powered by permanent location histories, recurring issue
            patterns, and verified Bangladesh Meteorological Department (BMD) rainfall observations.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTriggerEvaluation}
            disabled={evaluating}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 shadow-md flex items-center gap-1.5 transition"
          >
            {evaluating ? (
              <>
                <span className="animate-spin">🔄</span> Evaluating...
              </>
            ) : (
              <>
                <span>⚡</span> Run Smart Evaluation
              </>
            )}
          </button>

          <button
            onClick={() => setShowRainfallModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-cyan-300 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5 transition"
          >
            <span>🌧️</span> Log Rainfall
          </button>

          <button
            onClick={refreshData}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Refresh Records"
          >
            🔄
          </button>

          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-slate-400">
            <span>Officer: {authSession.user.display_name}</span>
            <button onClick={handleLogout} className="text-rose-400 hover:underline">
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Operational Statistics KPI Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="card p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Planned Visits</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total_scheduled_visits}</div>
            <div className="text-[10px] text-cyan-300 mt-0.5">{stats.upcoming_approved_visits} upcoming</div>
          </div>

          <div className="card p-4 bg-slate-900/80 border border-purple-500/30 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-purple-300">Proposed Recs</div>
            <div className="text-2xl font-bold text-purple-200 mt-1">{stats.proposed_recommendations}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Awaiting Manager Review</div>
          </div>

          <div className={`card p-4 border rounded-xl ${
            stats.overdue_visits > 0
              ? "bg-rose-950/40 border-rose-500/50"
              : "bg-slate-900/80 border-slate-800"
          }`}>
            <div className="text-[11px] uppercase tracking-wider text-rose-300 flex items-center gap-1">
              {stats.overdue_visits > 0 && <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />}
              Overdue Visits
            </div>
            <div className={`text-2xl font-bold mt-1 ${stats.overdue_visits > 0 ? "text-rose-400" : "text-white"}`}>
              {stats.overdue_visits}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Need immediate dispatch</div>
          </div>

          <div className="card p-4 bg-slate-900/80 border border-emerald-500/30 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300">Completed Visits</div>
            <div className="text-2xl font-bold text-emerald-200 mt-1">{stats.completed_visits}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Verified on-site</div>
          </div>

          <div className="card p-4 bg-slate-900/80 border border-cyan-500/30 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-cyan-300">Acceptance Rate</div>
            <div className="text-2xl font-bold text-cyan-200 mt-1">{stats.acceptance_rate_pct}%</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{stats.approved_recommendations} approved recs</div>
          </div>

          <div className="card p-4 bg-slate-900/80 border border-blue-500/30 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-blue-300">Rainfall Events</div>
            <div className="text-2xl font-bold text-blue-200 mt-1">{stats.recent_rainfall_events}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">BMD Verified Station Data</div>
          </div>

          <div className="card p-4 bg-slate-900/80 border border-amber-500/30 rounded-xl">
            <div className="text-[11px] uppercase tracking-wider text-amber-300">Repeat Hazards</div>
            <div className="text-2xl font-bold text-amber-200 mt-1">{stats.recurring_issues_caught}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Confirmed recurrences</div>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("recommendations")}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            activeTab === "recommendations"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>💡</span> Recommendations Review Desk
          <span className="text-xs rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
            {recommendations.filter((r) => r.status === "proposed").length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("calendar")}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            activeTab === "calendar"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>📅</span> Inspection Calendar &amp; Visits
          <span className="text-xs rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
            {calendarItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("rainfall")}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            activeTab === "rainfall"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>🌧️</span> Rainfall Observations Log
          <span className="text-xs rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
            {rainfallRecords.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("policies")}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
            activeTab === "policies"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>⚙️</span> Scheduling Policies &amp; Intervals
          <span className="text-xs rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
            {policies.length}
          </span>
        </button>

        <Link
          to="/authority/sites"
          className="ml-auto pb-3 px-4 text-xs font-semibold text-slate-400 hover:text-cyan-300 flex items-center gap-1"
        >
          <span>🏛️</span> Open Site Registry →
        </Link>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: RECOMMENDATIONS REVIEW DESK                                   */}
      {/* ==================================================================== */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="card p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold mr-1">Status:</span>
              {["proposed", "approved", "modified", "rejected", "all"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    statusFilter === st
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={triggerFilter}
                onChange={(e) => setTriggerFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Trigger Rules</option>
                <option value="recurring_hazard">🔄 Recurring Hazard</option>
                <option value="rainfall_event">🌧️ Rainfall Trigger</option>
                <option value="post_resolution_followup">🛠️ Post-Resolution Check</option>
                <option value="baseline_policy">📋 Routine Periodic Baseline</option>
                <option value="low_information_baseline">ℹ️ Low-History Baseline</option>
              </select>

              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search location code / name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Recommendations Cards List */}
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading recommendations...</div>
          ) : filteredRecommendations.length === 0 ? (
            <div className="p-12 text-center card bg-slate-900/40 border border-slate-800 rounded-2xl">
              <span className="text-3xl">✓</span>
              <h3 className="text-base font-semibold text-white mt-2">
                No recommendations matching this filter
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                All proposed inspection dates may have been reviewed or filter criteria produced zero matches.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecommendations.map((rec) => {
                const badge = triggerBadges[rec.trigger_type] || triggerBadges.baseline_policy;
                return (
                  <div
                    key={rec.id}
                    className="card p-5 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl shadow-lg transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Location & Trigger info */}
                      <div className="space-y-2 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-mono font-bold text-cyan-300 bg-slate-950 px-2.5 py-1 rounded-md border border-cyan-500/20">
                            {rec.location_code}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {rec.location_name}
                          </span>
                          <span className="text-xs text-slate-400">
                            • {rec.property_name} ({rec.ward_id})
                          </span>
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${badge.bg}`}
                          >
                            <span>{badge.icon}</span> {badge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {rec.rule_code} {rec.rule_version}
                          </span>
                        </div>

                        {/* EXPLAINABILITY SECTION ("Why is this inspection recommended?") */}
                        <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                              Why is this inspection recommended?
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.2 rounded font-medium ${
                                rec.evidence_level === "sufficient_history"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {rec.evidence_level === "sufficient_history"
                                ? "Sufficient Longitudinal Evidence"
                                : "Limited History (Standard Rule Applied)"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed font-sans">
                            {rec.explanation}
                          </p>

                          {/* Supporting Records List */}
                          {rec.supporting_records && rec.supporting_records.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              <span className="font-semibold text-slate-300">Supporting Records:</span>
                              {rec.supporting_records.map((sup, idx) => (
                                <span
                                  key={idx}
                                  className="bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded text-slate-300"
                                >
                                  {sup.record_type.toUpperCase()}: {sup.summary} ({sup.date.slice(0, 10)})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Decision Audit info if reviewed */}
                        {rec.decision && (
                          <div className="text-xs text-slate-300 flex items-center gap-2">
                            <span className="font-semibold text-cyan-300">Manager Decision:</span>
                            <span className="capitalize">{rec.decision}</span>
                            {rec.approved_date && <span>for {rec.approved_date}</span>}
                            <span>by {rec.decided_by}</span>
                            {rec.decision_notes && (
                              <span className="italic text-slate-400">"{rec.decision_notes}"</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Date & Action Controls */}
                      <div className="flex flex-col lg:items-end justify-between gap-3 min-w-[220px]">
                        <div className="text-left lg:text-right">
                          <div className="text-[11px] uppercase tracking-wider text-slate-400">
                            Recommended Date
                          </div>
                          <div className="text-xl font-bold text-white font-mono">
                            {rec.recommended_date}
                          </div>
                          <div className="text-[10px] text-cyan-300">
                            Policy: {rec.policy_name || "Dhaka Municipal Standard"}
                          </div>
                        </div>

                        {/* Manager Decision Workflow Controls */}
                        {rec.status === "proposed" ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openDecisionModal(rec, "approved")}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => openDecisionModal(rec, "modified")}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
                            >
                              ✏️ Change Date
                            </button>
                            <button
                              onClick={() => openDecisionModal(rec, "rejected")}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700 transition"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                                rec.status === "approved" || rec.status === "modified"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              }`}
                            >
                              {rec.status}
                            </span>
                            <button
                              onClick={() => openRecordInspectionModal({
                                location_id: rec.location_id,
                                location_code: rec.location_code,
                              })}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-slate-700 transition"
                            >
                              Record Inspection
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: INSPECTION CALENDAR & VISITS                                  */}
      {/* ==================================================================== */}
      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div className="card p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Chronological Visit Schedule</h2>
              <p className="text-xs text-slate-400">
                Unified schedule showing proposed recommendations, approved visits, overdue checks, and completed inspections.
              </p>
            </div>
            <button
              onClick={refreshData}
              className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            >
              🔄 Refresh Calendar
            </button>
          </div>

          {calendarItems.length === 0 ? (
            <div className="p-12 text-center card bg-slate-900/40 border border-slate-800 rounded-2xl">
              <span className="text-3xl">📅</span>
              <h3 className="text-base font-semibold text-white mt-2">No Scheduled Visits</h3>
              <p className="text-xs text-slate-400 mt-1">
                Approve proposed recommendations to populate the active inspection calendar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {calendarItems.map((item) => {
                const statusStyles = {
                  proposed: "border-purple-500/40 bg-purple-950/20 text-purple-300",
                  approved: "border-cyan-500/40 bg-cyan-950/20 text-cyan-300",
                  overdue: "border-rose-500/50 bg-rose-950/30 text-rose-300",
                  completed: "border-emerald-500/40 bg-emerald-950/20 text-emerald-300",
                };

                return (
                  <div
                    key={item.id}
                    className={`card p-5 border rounded-2xl space-y-3 ${
                      item.status === "overdue" ? "bg-rose-950/30 border-rose-500/50" : "bg-slate-900/90 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                        {item.date}
                      </span>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                          statusStyles[item.status] || statusStyles.approved
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-bold text-white">{item.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.subtitle}</div>
                    </div>

                    {item.explanation && (
                      <p className="text-xs text-slate-300 line-clamp-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                        {item.explanation}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Ward: {item.ward_id} • {item.category.replace(/_/g, " ")}
                      </span>
                      {item.status !== "completed" && (
                        <button
                          onClick={() => openRecordInspectionModal(item)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 transition"
                        >
                          Record Result →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: RAINFALL OBSERVATIONS LOG                                     */}
      {/* ==================================================================== */}
      {activeTab === "rainfall" && (
        <div className="space-y-4">
          <div className="card p-5 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Verified Rainfall Observations</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Precipitation observations trigger automatic reinspection evaluation for outdoor and rain-exposed hazard points.
              </p>
            </div>
            <button
              onClick={() => setShowRainfallModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110 shadow transition"
            >
              + Log New Rainfall Observation
            </button>
          </div>

          <div className="card overflow-hidden border border-slate-800 rounded-2xl bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Rainfall (mm)</th>
                    <th className="p-3.5">Ward / Target Area</th>
                    <th className="p-3.5">Observation Source</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rainfallRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="p-3.5 font-mono text-slate-200">{r.recorded_at.replace("T", " ").slice(0, 16)}</td>
                      <td className="p-3.5">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            r.rainfall_mm >= 25.0
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {r.rainfall_mm} mm
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <span className="font-semibold">{r.ward_id || "All Wards"}</span> — {r.area_description}
                      </td>
                      <td className="p-3.5 text-slate-400 font-medium">{r.data_source}</td>
                      <td className="p-3.5">
                        <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-semibold">
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 max-w-xs truncate">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: POLICIES & INTERVALS                                          */}
      {/* ==================================================================== */}
      {activeTab === "policies" && (
        <div className="space-y-4">
          <div className="card p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
            <h2 className="text-base font-bold text-white">Configured Inspection Policies</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Defines standard inspection cadence, expedited recurrence follow-up rules, post-resolution verification windows, and rainfall thresholds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((p) => (
              <div key={p.id} className="card p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{p.name}</h3>
                    <div className="text-xs text-cyan-300 mt-0.5">
                      Scope: {p.scope_type.toUpperCase()} • Category: {p.location_category}
                    </div>
                  </div>
                  <button
                    onClick={() => openEditPolicyModal(p)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
                  >
                    ✏️ Configure
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                  <div className="p-2.5 bg-slate-950 rounded-xl">
                    <div className="text-slate-400 text-[10px] uppercase">Normal Interval</div>
                    <div className="text-base font-bold text-white mt-0.5 font-mono">
                      Every {p.normal_interval_days} Days
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl">
                    <div className="text-slate-400 text-[10px] uppercase">Recurrence Follow-up</div>
                    <div className="text-base font-bold text-rose-300 mt-0.5 font-mono">
                      Within {p.recurrence_followup_days} Days
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl">
                    <div className="text-slate-400 text-[10px] uppercase">Post-Resolution Check</div>
                    <div className="text-base font-bold text-amber-300 mt-0.5 font-mono">
                      Within {p.resolution_followup_days} Days
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-xl">
                    <div className="text-slate-400 text-[10px] uppercase">Rainfall Trigger Threshold</div>
                    <div className="text-base font-bold text-cyan-300 mt-0.5 font-mono">
                      &ge; {p.rainfall_threshold_mm} mm
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Mandatory safety ceiling: {p.max_interval_days} days max</span>
                  <span className="text-emerald-400 font-semibold">Active Policy</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: MANAGER DECISION REVIEW                                     */}
      {/* ==================================================================== */}
      {showDecisionModal && decisionTargetRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg card p-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Manager Decision Review:</span>
                <span className="font-mono text-cyan-300">{decisionTargetRec.location_code}</span>
              </h3>
              <button onClick={() => setShowDecisionModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl text-xs space-y-1">
              <div className="text-slate-300 font-semibold">{decisionTargetRec.location_name}</div>
              <div className="text-slate-400">{decisionTargetRec.explanation}</div>
            </div>

            <form onSubmit={handleSubmitDecision} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Decision Type</label>
                <div className="flex gap-2">
                  {[
                    { id: "approved", label: "✓ Approve", color: "text-emerald-300" },
                    { id: "modified", label: "✏️ Change Date", color: "text-cyan-300" },
                    { id: "rejected", label: "✕ Reject", color: "text-rose-300" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDecisionType(d.id)}
                      className={`flex-1 py-2 rounded-xl border font-bold transition ${
                        decisionType === d.id
                          ? "bg-slate-800 border-cyan-400 " + d.color
                          : "border-slate-800 bg-slate-950 text-slate-400"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {decisionType !== "rejected" && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {decisionType === "modified" ? "Revised Inspection Date" : "Confirmed Inspection Date"}
                  </label>
                  <input
                    type="date"
                    required
                    value={decisionForm.approved_date}
                    onChange={(e) => setDecisionForm({ ...decisionForm, approved_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Manager Explanation &amp; Audit Notes{" "}
                  {decisionType !== "approved" && <span className="text-rose-400">(Mandatory)</span>}
                </label>
                <textarea
                  rows={3}
                  required={decisionType !== "approved"}
                  value={decisionForm.decision_notes}
                  onChange={(e) => setDecisionForm({ ...decisionForm, decision_notes: e.target.value })}
                  placeholder="Record justification for approving, rescheduling, or rejecting..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110"
                >
                  Save Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: LOG RAINFALL OBSERVATION                                    */}
      {/* ==================================================================== */}
      {showRainfallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg card p-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🌧️ Record Verified Rainfall Observation</span>
              </h3>
              <button onClick={() => setShowRainfallModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordRainfall} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Precipitation Amount (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={rainfallForm.rainfall_mm}
                  onChange={(e) => setRainfallForm({ ...rainfallForm, rainfall_mm: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observation Timestamp</label>
                <input
                  type="datetime-local"
                  required
                  value={rainfallForm.recorded_at}
                  onChange={(e) => setRainfallForm({ ...rainfallForm, recorded_at: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Ward / Catchment</label>
                <select
                  value={rainfallForm.ward_id}
                  onChange={(e) => setRainfallForm({ ...rainfallForm, ward_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="">All Dhaka Northern Catchments</option>
                  <option value="W-01">W-01 (Mirpur)</option>
                  <option value="W-02">W-02 (Lalbagh)</option>
                  <option value="W-03">W-03 (Uttara)</option>
                  <option value="W-04">W-04 (Mohakhali)</option>
                  <option value="W-05">W-05 (Tejgaon)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Area Description</label>
                <input
                  type="text"
                  required
                  value={rainfallForm.area_description}
                  onChange={(e) => setRainfallForm({ ...rainfallForm, area_description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observation Source (Verified)</label>
                <input
                  type="text"
                  required
                  value={rainfallForm.data_source}
                  onChange={(e) => setRainfallForm({ ...rainfallForm, data_source: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Meteorological Notes</label>
                <textarea
                  rows={2}
                  value={rainfallForm.notes}
                  onChange={(e) => setRainfallForm({ ...rainfallForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRainfallModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110"
                >
                  Record &amp; Trigger Smart Scheduling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: EDIT POLICY SETTINGS                                        */}
      {/* ==================================================================== */}
      {showEditPolicyModal && targetPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg card p-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚙️ Configure Policy: {targetPolicy.name}</span>
              </h3>
              <button onClick={() => setShowEditPolicyModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Normal Interval (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  required
                  value={policyForm.normal_interval_days}
                  onChange={(e) => setPolicyForm({ ...policyForm, normal_interval_days: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Recurrence Follow-up Interval (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={policyForm.recurrence_followup_days}
                  onChange={(e) => setPolicyForm({ ...policyForm, recurrence_followup_days: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Post-Resolution Verification Window (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={policyForm.resolution_followup_days}
                  onChange={(e) => setPolicyForm({ ...policyForm, resolution_followup_days: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Rainfall Event Threshold (mm precipitation)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="300"
                  required
                  value={policyForm.rainfall_threshold_mm}
                  onChange={(e) => setPolicyForm({ ...policyForm, rainfall_threshold_mm: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Maximum Interval Ceiling (Days)
                </label>
                <input
                  type="number"
                  min="3"
                  max="365"
                  required
                  value={policyForm.max_interval_days}
                  onChange={(e) => setPolicyForm({ ...policyForm, max_interval_days: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditPolicyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110"
                >
                  Save Policy Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: RECORD PHYSICAL INSPECTION (LINK TO SCHEDULED VISIT)         */}
      {/* ==================================================================== */}
      {showRecordInspectionModal && targetScheduledVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg card p-6 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Record Physical Inspection Result</span>
              </h3>
              <button onClick={() => setShowRecordInspectionModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl text-xs space-y-1">
              <div className="text-cyan-300 font-mono font-bold">{targetScheduledVisit.location_code}</div>
              <div className="text-slate-400">
                Completing this form records an official inspection and marks the visit as completed.
              </div>
            </div>

            <form onSubmit={handleSaveInspectionVisit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Inspector Name</label>
                <input
                  type="text"
                  required
                  value={quickInspectionForm.inspector_name}
                  onChange={(e) => setQuickInspectionForm({ ...quickInspectionForm, inspector_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Inspection Result</label>
                <select
                  value={quickInspectionForm.result}
                  onChange={(e) => setQuickInspectionForm({ ...quickInspectionForm, result: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                >
                  <option value="clear">Clear — No problem observed at this point-in-time</option>
                  <option value="problem_found">Problem Found — Mosquito breeding hazard identified</option>
                  <option value="unable_to_inspect">Unable to Inspect / Access obstructed</option>
                </select>
              </div>

              {quickInspectionForm.result === "problem_found" && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Problem Identified</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Stagnant water with active larvae in roof drain"
                    value={quickInspectionForm.problem_identified}
                    onChange={(e) => setQuickInspectionForm({ ...quickInspectionForm, problem_identified: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observation Notes</label>
                <textarea
                  rows={2}
                  required
                  value={quickInspectionForm.notes}
                  onChange={(e) => setQuickInspectionForm({ ...quickInspectionForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Evidence / Physical Conditions</label>
                <input
                  type="text"
                  value={quickInspectionForm.evidence_notes}
                  onChange={(e) => setQuickInspectionForm({ ...quickInspectionForm, evidence_notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRecordInspectionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:brightness-110"
                >
                  Save &amp; Complete Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
