import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { getCached, cachedGet, invalidateCache } from "../utils/apiCache";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function ServiceVerification() {
  // Authentication & Role Session State
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("dengue_auth_session");
      if (saved) return JSON.parse(saved);
      // Default to supervisor role for dev exploration
      return {
        token: "dengue-authority-dev-2026",
        user: {
          username: "authority",
          display_name: "DNCC Field Operations Supervisor",
          role: "supervisor",
          agency: "Dhaka North City Corporation (Health & Vector Control)",
        },
      };
    } catch {
      return null;
    }
  });

  const [loginForm, setLoginForm] = useState({ username: "authority", password: "dengue2026", role: "supervisor" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState("supervisor"); // 'supervisor' | 'worker' | 'directory' | 'followup' | 'contractors'

  // Data states initialized from client cache for instant 0ms mount render
  const [stats, setStats] = useState(() => getCached(`${API_URL}/api/services/stats`));
  const [workOrders, setWorkOrders] = useState(() => getCached(`${API_URL}/api/services/work-orders`) || []);
  const [supervisorQueue, setSupervisorQueue] = useState(() => getCached(`${API_URL}/api/services/reviews/queue`) || []);
  const [followupQueue, setFollowupQueue] = useState(() => getCached(`${API_URL}/api/services/follow-up/queue`) || []);
  const [properties, setProperties] = useState(() => getCached(`${API_URL}/api/sites/properties`) || []);
  const [locations, setLocations] = useState(() => getCached(`${API_URL}/api/sites/locations`) || []);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [resolutionFilter, setResolutionFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Loading & Notifications
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Modals
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Create Work Order Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    property_id: "",
    location_id: "",
    title: "",
    description: "",
    required_action: "clean_drain",
    priority: "medium",
    assigned_worker_id: "WRK-001",
    assigned_worker_name: "Kamal Hossain",
    assigned_contractor: "Bengal CleanCare Services Ltd.",
    responsible_supervisor: "Supervisor Tariqul Islam",
    due_date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    labor_hours: 2.0,
    actual_cost: 2500.0,
    currency: "BDT",
    repair_classification: "routine_maintenance",
  });

  // Evidence Submission Modal
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evidenceTargetWO, setEvidenceTargetWO] = useState(null);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceForm, setEvidenceForm] = useState({
    action_type: "Cleaned",
    work_description: "",
    materials_used: "",
    unresolved_notes: "",
    access_restricted: false,
    labor_hours: "2.5",
    actual_cost: "3000.0",
    evidence_category: "after_photo",
  });
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Supervisor Review Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTargetWO, setReviewTargetWO] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("accepted"); // 'accepted' | 'clarification_required' | 'rejected'
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Follow-up Resolution Modal
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupTargetWO, setFollowupTargetWO] = useState(null);
  const [followupOutcome, setFollowupOutcome] = useState("clear"); // 'clear' | 'problem_still_present' | 'unable_to_inspect'
  const [followupNotes, setFollowupNotes] = useState("");
  const [followupInspector, setFollowupInspector] = useState("Senior Field Inspector Zahid");
  const [submittingFollowup, setSubmittingFollowup] = useState(false);

  // Secure Image Preview Modal
  const [previewImage, setPreviewImage] = useState(null);

  // Build Auth Headers
  const authHeaders = useMemo(() => {
    if (!authSession) return {};
    return {
      Authorization: `Bearer ${authSession.token}`,
      "X-Authority-Key": authSession.token,
    };
  }, [authSession]);

  // Load Initial Data with SWR client-side caching
  const fetchData = async (forceRefresh = false) => {
    if (!authSession) return;
    // Only show loading spinner if cold cache (no data yet)
    if (!stats && workOrders.length === 0) {
      setLoading(true);
    }
    setActionError(null);
    try {
      const [statsRes, woRes, revQueueRes, fuQueueRes, propsRes, locsRes] = await Promise.all([
        cachedGet(`${API_URL}/api/services/stats`, { headers: authHeaders }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/services/work-orders`, { headers: authHeaders }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/services/reviews/queue`, { headers: authHeaders }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/services/follow-up/queue`, { headers: authHeaders }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/sites/properties`, { headers: authHeaders }, undefined, forceRefresh),
        cachedGet(`${API_URL}/api/sites/locations`, { headers: authHeaders }, undefined, forceRefresh),
      ]);

      setStats(statsRes.data);
      setWorkOrders(woRes.data);
      setSupervisorQueue(revQueueRes.data);
      setFollowupQueue(fuQueueRes.data);
      setProperties(propsRes.data);
      setLocations(locsRes.data);

      if (propsRes.data.length > 0 && !createForm.property_id) {
        setCreateForm((prev) => ({
          ...prev,
          property_id: propsRes.data[0].id,
        }));
      }
    } catch (err) {
      console.error("Error fetching service verification data:", err);
      if (err.response?.status === 401) {
        sessionStorage.removeItem("dengue_auth_session");
        setAuthSession(null);
        setLoginError("Authority session expired. Please re-authenticate.");
      }
      setActionError(err.response?.data?.detail || "Failed to load service records from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authSession]);

  // Handle Quick Role Switching for Demonstration
  const handleSwitchRole = (newRole, displayName) => {
    const updated = {
      ...authSession,
      user: {
        ...authSession.user,
        role: newRole,
        display_name: displayName,
      },
    };
    setAuthSession(updated);
    sessionStorage.setItem("dengue_auth_session", JSON.stringify(updated));
    setActionSuccess(`Switched active persona to ${displayName} (${newRole.toUpperCase()})`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await axios.post(`${API_URL}/api/authority/login`, loginForm);
      const session = {
        token: res.data.token,
        user: res.data.user,
      };
      setAuthSession(session);
      sessionStorage.setItem("dengue_auth_session", JSON.stringify(session));
    } catch (err) {
      setLoginError(err.response?.data?.detail || "Authentication failed. Check credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Start Task (Field Worker)
  const handleStartWorkOrder = async (workOrderId) => {
    try {
      await axios.post(`${API_URL}/api/services/work-orders/${workOrderId}/start`, {}, { headers: authHeaders });
      setActionSuccess(`Work order #${workOrderId} marked IN PROGRESS on site.`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to mark task started.");
    }
  };

  // Open Submit Evidence Modal
  const handleOpenEvidenceModal = (wo) => {
    setEvidenceTargetWO(wo);
    // Check local draft
    const draftKey = `draft_wo_evidence_${wo.id}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        setEvidenceForm(JSON.parse(savedDraft));
      } catch {
        // fallback
      }
    } else {
      setEvidenceForm({
        action_type: wo.required_action ? wo.required_action.replace("_", " ").toUpperCase() : "Cleaned",
        work_description: "",
        materials_used: "",
        unresolved_notes: "",
        access_restricted: false,
        labor_hours: wo.labor_hours ? String(wo.labor_hours) : "2.5",
        actual_cost: wo.actual_cost ? String(wo.actual_cost) : "3000.0",
        evidence_category: "after_photo",
      });
    }
    setEvidenceFiles([]);
    setShowEvidenceModal(true);
  };

  // Handle Evidence Form Input & Draft Persistence
  const handleEvidenceFormChange = (key, value) => {
    setEvidenceForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (evidenceTargetWO) {
        localStorage.setItem(`draft_wo_evidence_${evidenceTargetWO.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Submit Evidence
  const handleSubmitEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceTargetWO) return;
    setUploadingEvidence(true);
    setActionError(null);

    const formData = new FormData();
    formData.append("action_type", evidenceForm.action_type);
    formData.append("work_description", evidenceForm.work_description);
    if (evidenceForm.materials_used) formData.append("materials_used", evidenceForm.materials_used);
    if (evidenceForm.unresolved_notes) formData.append("unresolved_notes", evidenceForm.unresolved_notes);
    formData.append("access_restricted", evidenceForm.access_restricted ? "true" : "false");
    if (evidenceForm.labor_hours) formData.append("labor_hours", evidenceForm.labor_hours);
    if (evidenceForm.actual_cost) formData.append("actual_cost", evidenceForm.actual_cost);
    formData.append("evidence_category", evidenceForm.evidence_category);

    for (let i = 0; i < evidenceFiles.length; i++) {
      formData.append("files", evidenceFiles[i]);
    }

    try {
      const res = await axios.post(
        `${API_URL}/api/services/work-orders/${evidenceTargetWO.id}/submit-evidence`,
        formData,
        {
          headers: {
            ...authHeaders,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      // Clear draft on successful upload
      localStorage.removeItem(`draft_wo_evidence_${evidenceTargetWO.id}`);
      setShowEvidenceModal(false);
      setActionSuccess(`Service evidence for #${evidenceTargetWO.id} submitted successfully! Awaiting supervisor review.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err) {
      console.error("Evidence submission error:", err);
      setActionError(err.response?.data?.detail || "Failed to submit service evidence.");
    } finally {
      setUploadingEvidence(false);
    }
  };

  // Open Supervisor Review Modal
  const handleOpenReviewModal = (wo) => {
    setReviewTargetWO(wo);
    setReviewDecision("accepted");
    setReviewNotes("");
    setShowReviewModal(true);
  };

  // Submit Supervisor Review
  const handleSubmitSupervisorReview = async (e) => {
    e.preventDefault();
    if (!reviewTargetWO) return;
    setSubmittingReview(true);
    setActionError(null);

    try {
      await axios.post(
        `${API_URL}/api/services/work-orders/${reviewTargetWO.id}/review`,
        {
          decision: reviewDecision,
          decision_notes: reviewNotes || (reviewDecision === "accepted" ? "Work evidence accepted as complete and verified." : "Additional information requested."),
        },
        { headers: authHeaders }
      );

      setShowReviewModal(false);
      const msg =
        reviewDecision === "accepted"
          ? `Work order #${reviewTargetWO.id} verified! Status updated to 'WORK VERIFIED'. Resolution awaiting follow-up.`
          : `Review recorded: ${reviewDecision.replace("_", " ").toUpperCase()}`;
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Supervisor review submission failed.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Open Follow-up Modal
  const handleOpenFollowupModal = (wo) => {
    setFollowupTargetWO(wo);
    setFollowupOutcome("clear");
    setFollowupNotes("On-site physical inspection confirmed absence of standing water and no mosquito larvae detected.");
    setShowFollowupModal(true);
  };

  // Submit Follow-up Resolution Outcome
  const handleSubmitFollowup = async (e) => {
    e.preventDefault();
    if (!followupTargetWO) return;
    setSubmittingFollowup(true);
    setActionError(null);

    try {
      await axios.post(
        `${API_URL}/api/services/work-orders/${followupTargetWO.id}/record-followup`,
        {
          verified_outcome: followupOutcome,
          verification_notes: followupNotes,
          inspector_name: followupInspector,
        },
        { headers: authHeaders }
      );

      setShowFollowupModal(false);
      const msg =
        followupOutcome === "clear"
          ? `Resolution confirmed at follow-up for #${followupTargetWO.id}! Hazard issue marked as RESOLVED.`
          : `Follow-up recorded: Outcome '${followupOutcome}'. Original hazard issue preserved as active.`;
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4500);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to record follow-up resolution.");
    } finally {
      setSubmittingFollowup(false);
    }
  };

  // Handle Create Work Order
  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    setActionError(null);
    try {
      await axios.post(
        `${API_URL}/api/services/work-orders`,
        {
          ...createForm,
          labor_hours: parseFloat(createForm.labor_hours) || 0,
          actual_cost: parseFloat(createForm.actual_cost) || 0,
        },
        { headers: authHeaders }
      );
      setShowCreateModal(false);
      setActionSuccess("New service work order created and assigned successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.detail || "Failed to create service work order.");
    }
  };

  // Filtered Locations for Create Modal
  const filteredCreateLocations = useMemo(() => {
    if (!createForm.property_id) return [];
    return locations.filter((loc) => loc.property_id === createForm.property_id);
  }, [createForm.property_id, locations]);

  // Filtered Work Orders for Directory Tab
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      if (statusFilter !== "all" && wo.status !== statusFilter) return false;
      if (resolutionFilter !== "all" && wo.resolution_verification_status !== resolutionFilter) return false;
      if (propertyFilter !== "all" && wo.property_id !== propertyFilter) return false;
      if (priorityFilter !== "all" && wo.priority !== priorityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = wo.title?.toLowerCase().includes(q);
        const codeMatch = wo.location_code?.toLowerCase().includes(q);
        const workerMatch = wo.assigned_worker_name?.toLowerCase().includes(q);
        const contractorMatch = wo.assigned_contractor?.toLowerCase().includes(q);
        if (!titleMatch && !codeMatch && !workerMatch && !contractorMatch) return false;
      }
      return true;
    });
  }, [workOrders, statusFilter, resolutionFilter, propertyFilter, priorityFilter, searchQuery]);

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const map = {
      assigned: { label: "Assigned", bg: "bg-blue-900/60 text-blue-300 border-blue-700" },
      in_progress: { label: "In Progress", bg: "bg-amber-900/60 text-amber-300 border-amber-700 animate-pulse" },
      evidence_submitted: { label: "Evidence Submitted", bg: "bg-purple-900/60 text-purple-300 border-purple-700" },
      clarification_required: { label: "Clarification Needed", bg: "bg-orange-900/60 text-orange-300 border-orange-700" },
      work_verified: { label: "Work Verified", bg: "bg-emerald-900/60 text-emerald-300 border-emerald-600 font-semibold" },
      cancelled: { label: "Cancelled", bg: "bg-gray-800 text-gray-400 border-gray-700" },
    };
    const c = map[status] || { label: status, bg: "bg-gray-800 text-gray-300 border-gray-700" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  // Resolution Status Badge Helper
  const renderResolutionBadge = (resStatus) => {
    const map = {
      not_required: { label: "No Follow-up Needed", bg: "bg-gray-800 text-gray-400 border-gray-700" },
      awaiting_followup: { label: "Awaiting Follow-up", bg: "bg-amber-950/80 text-amber-400 border-amber-800" },
      followup_scheduled: { label: "Follow-up Scheduled", bg: "bg-blue-950/80 text-blue-400 border-blue-800" },
      resolution_confirmed: { label: "Resolution Confirmed at Follow-up", bg: "bg-emerald-950/90 text-emerald-400 border-emerald-600 font-bold" },
      followup_failed_issue_present: { label: "Follow-up Failed: Issue Present", bg: "bg-red-950/80 text-red-400 border-red-700 font-semibold" },
      issue_reopened: { label: "Issue Reopened", bg: "bg-rose-950/90 text-rose-300 border-rose-600 animate-pulse" },
      followup_inconclusive: { label: "Follow-up Inconclusive", bg: "bg-yellow-950/80 text-yellow-400 border-yellow-700" },
    };
    const c = map[resStatus] || { label: resStatus, bg: "bg-gray-800 text-gray-400 border-gray-700" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  // Priority Badge Helper
  const renderPriorityBadge = (priority) => {
    const map = {
      critical: "bg-red-500/20 text-red-300 border-red-600 font-bold",
      high: "bg-amber-500/20 text-amber-300 border-amber-600",
      medium: "bg-blue-500/20 text-blue-300 border-blue-600",
      low: "bg-gray-500/20 text-gray-400 border-gray-700",
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded border uppercase font-mono ${map[priority] || map.medium}`}>
        {priority}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* TOP BREADCRUMB & HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 mb-1">
              <Link to="/authority" className="hover:underline">Authority Portal</Link>
              <span>/</span>
              <Link to="/authority/sites" className="hover:underline">Site Hazard Registry</Link>
              <span>/</span>
              <span className="text-gray-400">Improvement 03 — Service & Resolution Verification</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>🛠️</span>
              <span>Service & Resolution Verification</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Two-stage operational accountability: Independently records whether assigned service was performed,
              and verifies whether the underlying dengue hazard remained permanently resolved.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold text-sm shadow-md transition flex items-center gap-2"
            >
              <span>➕</span> New Work Order
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700 transition flex items-center gap-1.5"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span> Refresh
            </button>
          </div>
        </div>

        {/* NOTIFICATIONS */}
        {actionError && (
          <div className="bg-red-950/80 border border-red-700 text-red-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}
        {actionSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-600 text-emerald-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white font-bold ml-4">✕</button>
          </div>
        )}

        {/* ACTIVE PERSONA / ROLE SWITCHER */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-xl">
              {authSession?.user?.role === "supervisor" ? "👨‍💼" : authSession?.user?.role === "worker" ? "👷" : authSession?.user?.role === "inspector" ? "🔍" : "🏢"}
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Active Operating Persona</div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{authSession?.user?.display_name || authSession?.user?.username}</span>
                <span className="px-2 py-0.5 rounded text-xs bg-cyan-900/60 text-cyan-300 border border-cyan-700 uppercase font-mono">
                  {authSession?.user?.role || "authority_officer"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-gray-950 p-1.5 rounded-xl border border-gray-800">
            <span className="text-xs text-gray-500 font-mono px-2">Switch View:</span>
            <button
              onClick={() => {
                handleSwitchRole("supervisor", "Engr. Farhana Ahmed (DNCC Supervisor)");
                setActiveTab("supervisor");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${authSession?.user?.role === "supervisor" ? "bg-cyan-600 text-white font-bold shadow" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
            >
              👨‍💼 Supervisor
            </button>
            <button
              onClick={() => {
                handleSwitchRole("worker", "Kamal Hossain (Field Vector Contractor)");
                setActiveTab("worker");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${authSession?.user?.role === "worker" ? "bg-amber-600 text-white font-bold shadow" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
            >
              👷 Field Worker
            </button>
            <button
              onClick={() => {
                handleSwitchRole("inspector", "Senior Inspector Mahbub (QA & Entomology)");
                setActiveTab("followup");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${authSession?.user?.role === "inspector" ? "bg-purple-600 text-white font-bold shadow" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
            >
              🔍 QA Inspector
            </button>
            <button
              onClick={() => {
                handleSwitchRole("property_manager", "Nasir Uddin (Tejgaon Property Manager)");
                setActiveTab("directory");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${authSession?.user?.role === "property_manager" ? "bg-emerald-600 text-white font-bold shadow" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}
            >
              🏢 Property Manager
            </button>
          </div>
        </div>

        {/* CORE OPERATIONAL DISTINCTION BANNER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-950/40 via-gray-900 to-gray-950 border border-blue-900/60 rounded-2xl p-4 shadow">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">📸</span>
              <div>
                <h3 className="text-sm font-bold text-blue-300">Question 1: Was the assigned work performed?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Worker submits physical evidence (photos, description, materials used). Supervisor audits evidence against requirements and marks:
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-bold">
                  <span>✓</span> Work Verified
                </div>
                <div className="text-[11px] text-gray-500 mt-1 italic">
                  * Note: Verified service does NOT prove the mosquito hazard is permanently resolved.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-950/40 via-gray-900 to-gray-950 border border-purple-900/60 rounded-2xl p-4 shadow">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🔬</span>
              <div>
                <h3 className="text-sm font-bold text-purple-300">Question 2: Did the hazard problem remain resolved?</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Following a dedicated observation period, an independent inspector conducts an on-site visit to inspect current conditions:
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950/80 border border-purple-600 text-purple-300 text-xs font-bold">
                  <span>🎯</span> Resolution Confirmed at Follow-up
                </div>
                <div className="text-[11px] text-gray-500 mt-1 italic">
                  * If water or larvae return, the original hazard remains open and recurrence is registered.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OPERATIONAL KPIS */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-400 font-medium">Total Orders</div>
              <div className="text-2xl font-black text-white mt-1">{stats.total_work_orders}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Assigned</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-xs text-amber-400 font-medium">In Progress</div>
              <div className="text-2xl font-black text-amber-300 mt-1">{stats.in_progress_count}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">On-site</div>
            </div>
            <div className="bg-gray-900 border border-purple-900/50 rounded-xl p-3 text-center">
              <div className="text-xs text-purple-300 font-medium">Review Queue</div>
              <div className="text-2xl font-black text-purple-400 mt-1">{stats.evidence_submitted_count}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Awaiting audit</div>
            </div>
            <div className="bg-gray-900 border border-emerald-900/50 rounded-xl p-3 text-center">
              <div className="text-xs text-emerald-400 font-medium">Work Verified</div>
              <div className="text-2xl font-black text-emerald-300 mt-1">{stats.work_verified_count}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Service passed</div>
            </div>
            <div className="bg-gray-900 border border-blue-900/50 rounded-xl p-3 text-center">
              <div className="text-xs text-blue-300 font-medium">Pending Follow-up</div>
              <div className="text-2xl font-black text-blue-400 mt-1">{stats.awaiting_followup_count}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Awaiting visit</div>
            </div>
            <div className="bg-gray-900 border border-teal-900/50 rounded-xl p-3 text-center">
              <div className="text-xs text-teal-300 font-medium">Resolution Confirmed</div>
              <div className="text-2xl font-black text-teal-400 mt-1">{stats.resolution_confirmed_count}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Hazard clear</div>
            </div>
            <div className="bg-gray-900 border border-red-900/50 rounded-xl p-3 text-center">
              <div className="text-xs text-red-400 font-medium">Overdue Tasks</div>
              <div className="text-2xl font-black text-red-400 mt-1">{stats.overdue_work_orders}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Past deadline</div>
            </div>
          </div>
        )}

        {/* TABS HEADER */}
        <div className="border-b border-gray-800 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("supervisor")}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "supervisor"
                ? "border-purple-500 text-purple-300 bg-gray-900/80"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40"
            }`}
          >
            <span>👨‍💼</span>
            <span>Supervisor Review Queue</span>
            {supervisorQueue.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {supervisorQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("worker")}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "worker"
                ? "border-amber-500 text-amber-300 bg-gray-900/80"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40"
            }`}
          >
            <span>👷</span>
            <span>Worker Task Desk</span>
            <span className="text-xs text-gray-500 font-mono">
              ({workOrders.filter((w) => w.status !== "work_verified" && w.status !== "cancelled").length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "directory"
                ? "border-cyan-500 text-cyan-300 bg-gray-900/80"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40"
            }`}
          >
            <span>📋</span>
            <span>All Work Orders</span>
            <span className="text-xs text-gray-500 font-mono">({workOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("followup")}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "followup"
                ? "border-teal-500 text-teal-300 bg-gray-900/80"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40"
            }`}
          >
            <span>🎯</span>
            <span>Resolution Follow-up Board</span>
            {followupQueue.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-teal-500/20 text-teal-300 border border-teal-500/40">
                {followupQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("contractors")}
            className={`px-4 py-2.5 rounded-t-xl text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === "contractors"
                ? "border-blue-500 text-blue-300 bg-gray-900/80"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40"
            }`}
          >
            <span>📊</span>
            <span>Contractor Performance</span>
          </button>
        </div>

        {/* TAB 1: SUPERVISOR REVIEW QUEUE */}
        {activeTab === "supervisor" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Evidence Submissions Awaiting Audit</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700">
                    {supervisorQueue.length} Pending
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Audited work verification: Verify photographs and reported actions before accepting completion.
                </p>
              </div>
            </div>

            {supervisorQueue.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
                <span className="text-4xl block mb-2">🎉</span>
                <p className="text-sm font-semibold text-gray-300">No pending evidence submissions!</p>
                <p className="text-xs text-gray-500 mt-1">All field service submissions have been audited and verified.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {supervisorQueue.map((wo) => {
                  const latestSub = wo.submissions?.[0];
                  return (
                    <div key={wo.id} className="bg-gray-900 border border-gray-800 hover:border-purple-800/80 rounded-2xl p-5 shadow transition">
                      <div className="flex flex-col lg:flex-row justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs px-2 py-0.5 bg-gray-800 text-gray-300 rounded font-semibold border border-gray-700">
                              {wo.id}
                            </span>
                            {renderPriorityBadge(wo.priority)}
                            {renderStatusBadge(wo.status)}
                            <span className="text-xs text-gray-400 font-mono">
                              📍 {wo.location_code} — {wo.location_name}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-white">{wo.title}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">{wo.property_name} | Required: {wo.required_action}</p>
                          </div>

                          {/* Submission Details */}
                          {latestSub && (
                            <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-3 space-y-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between text-gray-400">
                                <span>
                                  Submitted by: <strong className="text-cyan-300">{latestSub.submitted_by}</strong> ({wo.assigned_contractor || "Contractor"})
                                </span>
                                <span>Submitted: {new Date(latestSub.submitted_at).toLocaleString()} (v{latestSub.submission_version})</span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-semibold">Action Performed: </span>
                                <span className="text-emerald-300 font-mono font-medium">{latestSub.action_type}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-semibold">Work Summary: </span>
                                <span className="text-gray-200">{latestSub.work_description}</span>
                              </div>
                              {latestSub.materials_used && (
                                <div>
                                  <span className="text-gray-500 font-semibold">Materials Used: </span>
                                  <span className="text-gray-300">{latestSub.materials_used}</span>
                                </div>
                              )}
                              {latestSub.unresolved_notes && (
                                <div className="text-amber-400">
                                  <span className="font-semibold">⚠️ Unresolved Finding: </span>
                                  <span>{latestSub.unresolved_notes}</span>
                                </div>
                              )}

                              {/* Evidence Photos / Attachments */}
                              <div className="mt-2 pt-2 border-t border-gray-800">
                                <div className="text-xs text-gray-400 font-semibold mb-2">Attached Service Evidence ({latestSub.files.length}):</div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {latestSub.files.map((f) => (
                                    <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center group">
                                      {f.mime_type.startsWith("image/") ? (
                                        <div
                                          onClick={() => setPreviewImage(`${API_URL}/api/services/evidence/file/${f.id}`)}
                                          className="w-full h-24 bg-gray-950 rounded flex items-center justify-center overflow-hidden cursor-pointer relative"
                                        >
                                          <img
                                            src={`${API_URL}/api/services/evidence/file/${f.id}`}
                                            alt={f.original_filename}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                            onError={(e) => {
                                              e.target.style.display = "none";
                                              e.target.parentNode.innerText = "📷 " + f.original_filename;
                                            }}
                                          />
                                          <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] text-gray-300 px-1 rounded">
                                            🔍 View
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="w-full h-24 bg-gray-950 rounded flex flex-col items-center justify-center p-2 text-gray-400">
                                          <span className="text-2xl">📄</span>
                                          <span className="text-[10px] truncate max-w-full mt-1">{f.original_filename}</span>
                                        </div>
                                      )}

                                      <div className="mt-1 text-[10px] text-gray-400 truncate" title={f.original_filename}>
                                        {f.original_filename}
                                      </div>
                                      <div className="text-[9px] font-mono text-gray-500">
                                        {(f.file_size_bytes / 1024).toFixed(1)} KB | {f.evidence_category}
                                      </div>

                                      {/* Cryptographic Duplicate File Warning Flag */}
                                      {f.is_duplicate_flag && (
                                        <div className="mt-1 px-1.5 py-0.5 rounded text-[10px] bg-red-950/90 text-red-300 border border-red-700 font-semibold">
                                          ⚠️ Duplicate File Hash
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Supervisor Actions Box */}
                        <div className="lg:w-64 flex flex-col justify-between gap-3 bg-gray-950/60 p-4 rounded-xl border border-gray-800">
                          <div>
                            <div className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Audit Decision</div>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Accepting verifies that service work was completed. Follow-up inspection will evaluate lasting resolution.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <button
                              onClick={() => {
                                setReviewTargetWO(wo);
                                setReviewDecision("accepted");
                                setReviewNotes("Evidence audited and verified against location standards. Work completed.");
                                setShowReviewModal(true);
                              }}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                            >
                              <span>✅</span> Accept Work Verified
                            </button>

                            <button
                              onClick={() => {
                                setReviewTargetWO(wo);
                                setReviewDecision("clarification_required");
                                setReviewNotes("");
                                setShowReviewModal(true);
                              }}
                              className="w-full py-2 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                            >
                              <span>💬</span> Request Clarification
                            </button>

                            <button
                              onClick={() => {
                                setReviewTargetWO(wo);
                                setReviewDecision("rejected");
                                setReviewNotes("");
                                setShowReviewModal(true);
                              }}
                              className="w-full py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                            >
                              <span>❌</span> Reject Evidence
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FIELD WORKER TASK DESK */}
        {activeTab === "worker" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Field Operations & Task Execution Desk</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Assigned tasks for on-site contractors. Record commencement, log completed mitigation, and submit photographic evidence.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workOrders
                .filter((wo) => wo.status !== "work_verified" && wo.status !== "cancelled")
                .map((wo) => {
                  const hasClarification = wo.status === "clarification_required";
                  const latestSub = wo.submissions?.[0];

                  return (
                    <div
                      key={wo.id}
                      className={`bg-gray-900 border rounded-2xl p-4 shadow flex flex-col justify-between transition ${
                        hasClarification ? "border-orange-600/80 bg-orange-950/20" : "border-gray-800 hover:border-cyan-800/80"
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-cyan-400 font-bold">{wo.id}</span>
                          {renderPriorityBadge(wo.priority)}
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-white line-clamp-1">{wo.title}</h3>
                          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <span>🏢 {wo.property_name}</span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">
                            📍 {wo.location_code} ({wo.location_name})
                          </div>
                        </div>

                        <div className="text-xs text-gray-300 bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                          <div><strong className="text-gray-400">Required: </strong>{wo.required_action}</div>
                          <div className="mt-1 text-[11px] text-gray-400 line-clamp-2">{wo.description}</div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-800/80 text-gray-400">
                          <span>Status: {renderStatusBadge(wo.status)}</span>
                          <span className="font-mono">Due: {wo.due_date}</span>
                        </div>

                        {/* Clarification Alert */}
                        {hasClarification && latestSub?.decision_notes && (
                          <div className="bg-orange-950/80 border border-orange-700/80 p-2.5 rounded-lg text-xs text-orange-200">
                            <strong>⚠️ Supervisor Feedback: </strong>
                            <span>{latestSub.decision_notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Task Actions */}
                      <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center gap-2">
                        {wo.status === "assigned" && (
                          <button
                            onClick={() => handleStartWorkOrder(wo.id)}
                            className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                          >
                            <span>▶️</span> Start On-Site Work
                          </button>
                        )}

                        {(wo.status === "in_progress" || wo.status === "clarification_required") && (
                          <button
                            onClick={() => handleOpenEvidenceModal(wo)}
                            className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow"
                          >
                            <span>📸</span> Submit Evidence
                          </button>
                        )}

                        {wo.status === "evidence_submitted" && (
                          <div className="w-full py-2 bg-purple-950/80 border border-purple-800 text-purple-300 rounded-lg text-xs text-center font-medium">
                            ⏳ Evidence In Supervisor Review
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setSelectedWorkOrder(wo);
                            setShowDetailModal(true);
                          }}
                          className="px-2.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition"
                          title="View Details"
                        >
                          👁️
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 3: ALL WORK ORDERS DIRECTORY */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex-1 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search work orders by title, location code, worker, or contractor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="evidence_submitted">Evidence Submitted</option>
                  <option value="clarification_required">Clarification Needed</option>
                  <option value="work_verified">Work Verified</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={resolutionFilter}
                  onChange={(e) => setResolutionFilter(e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Resolutions</option>
                  <option value="awaiting_followup">Awaiting Follow-up</option>
                  <option value="followup_scheduled">Follow-up Scheduled</option>
                  <option value="resolution_confirmed">Resolution Confirmed</option>
                  <option value="followup_failed_issue_present">Follow-up Failed (Issue Present)</option>
                  <option value="issue_reopened">Issue Reopened</option>
                </select>

                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-gray-950/80 text-gray-400 uppercase font-mono text-[11px] border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-4">Order ID / Location</th>
                      <th className="py-3 px-4">Task Title & Property</th>
                      <th className="py-3 px-4">Assigned Personnel</th>
                      <th className="py-3 px-4">Work Status</th>
                      <th className="py-3 px-4">Resolution Status</th>
                      <th className="py-3 px-4">Cost / Labor</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredWorkOrders.map((wo) => (
                      <tr key={wo.id} className="hover:bg-gray-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-cyan-400">{wo.id}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{wo.location_code}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-white truncate">{wo.title}</div>
                          <div className="text-[11px] text-gray-400 truncate">{wo.property_name}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-gray-200">{wo.assigned_worker_name}</div>
                          <div className="text-[11px] text-gray-500">{wo.assigned_contractor || "Direct Agency"}</div>
                        </td>
                        <td className="py-3.5 px-4">{renderStatusBadge(wo.status)}</td>
                        <td className="py-3.5 px-4">{renderResolutionBadge(wo.resolution_verification_status)}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-400">
                          <div>{wo.actual_cost ? `${wo.actual_cost} ${wo.currency}` : "N/A"}</div>
                          <div className="text-[10px] text-gray-500">{wo.labor_hours ? `${wo.labor_hours} hrs` : "—"}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedWorkOrder(wo);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-400 hover:text-cyan-300 rounded-lg font-medium transition"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RESOLUTION FOLLOW-UP BOARD */}
        {activeTab === "followup" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Independent Follow-up & Resolution Confirmation</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700">
                    {followupQueue.length} Pending
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Confirm lasting hazard mitigation. Verification of service completion is stored independently from environmental outcome.
                </p>
              </div>
            </div>

            {followupQueue.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center text-gray-400">
                <span className="text-4xl block mb-2">🌿</span>
                <p className="text-sm font-semibold text-gray-300">No verified work orders pending follow-up!</p>
                <p className="text-xs text-gray-500 mt-1">All verified service interventions have completed independent on-site resolution checks.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followupQueue.map((wo) => (
                  <div key={wo.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-cyan-400 font-bold">{wo.id}</span>
                      {renderResolutionBadge(wo.resolution_verification_status)}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white">{wo.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{wo.property_name} | {wo.location_name}</p>
                    </div>

                    <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs space-y-1.5 text-gray-300">
                      <div><strong className="text-gray-400">Performed Service: </strong>{wo.action_performed || "Cleaning / Repair"}</div>
                      <div><strong className="text-gray-400">Supervisor Verified: </strong>{wo.verified_at ? new Date(wo.verified_at).toLocaleDateString() : "Yes"}</div>
                      <div><strong className="text-gray-400">Materials: </strong>{wo.materials_used || "Standard equipment"}</div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenFollowupModal(wo)}
                        className="flex-1 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                      >
                        <span>🔬</span> Record Follow-up Outcome
                      </button>
                      <button
                        onClick={() => {
                          setSelectedWorkOrder(wo);
                          setShowDetailModal(true);
                        }}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs"
                      >
                        Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CONTRACTOR PERFORMANCE VIEW */}
        {activeTab === "contractors" && stats?.contractor_performance && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Contractor Service Delivery Statistics</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Factual operational metrics extracted directly from verified work orders. (Resubmissions indicate quality audits, not fraud).
              </p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-gray-950/80 text-gray-400 uppercase font-mono text-[11px] border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-4">Contractor / Agency</th>
                      <th className="py-3 px-4 text-center">Assigned</th>
                      <th className="py-3 px-4 text-center">Completed</th>
                      <th className="py-3 px-4 text-center">Verified</th>
                      <th className="py-3 px-4 text-center">Clarification Rate</th>
                      <th className="py-3 px-4 text-center">Avg Labor Hours</th>
                      <th className="py-3 px-4 text-center">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {stats.contractor_performance.map((c, idx) => (
                      <tr key={idx} className="hover:bg-gray-800/40 transition">
                        <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                          <span>🏢</span> {c.contractor_name}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-400">{c.total_assigned}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-amber-400">{c.completed}</td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-400">{c.verified}</td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                            {c.clarification_rate_pct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-gray-400">{c.avg_labor_hours.toFixed(1)} h</td>
                        <td className="py-3.5 px-4 text-center font-mono text-red-400">{c.overdue_tasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: CREATE WORK ORDER */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>➕</span> Create Property-Level Service Work Order
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white font-bold">✕</button>
              </div>

              <form onSubmit={handleCreateWorkOrder} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 mb-1">Target Property *</label>
                    <select
                      value={createForm.property_id}
                      onChange={(e) => setCreateForm({ ...createForm, property_id: e.target.value, location_id: "" })}
                      required
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    >
                      <option value="">Select registered property...</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Hazard Location *</label>
                    <select
                      value={createForm.location_id}
                      onChange={(e) => setCreateForm({ ...createForm, location_id: e.target.value })}
                      required
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    >
                      <option value="">Select location point...</option>
                      {filteredCreateLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.location_code} — {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Unblock North Roof Drain Sediment Trap"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Detailed Description</label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Provide specific directions, access instructions, or identified risk details..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1">Required Action *</label>
                    <select
                      value={createForm.required_action}
                      onChange={(e) => setCreateForm({ ...createForm, required_action: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    >
                      <option value="clean_drain">Clean & Unblock Drain</option>
                      <option value="drain_water">Drain Standing Water</option>
                      <option value="apply_larvicide">Apply Larvicide</option>
                      <option value="cover_container">Cover Container / Install Mesh</option>
                      <option value="repair_component">Repair Plumbing / Component</option>
                      <option value="waste_removal">Remove Waste & Tires</option>
                      <option value="inspect_condition">Comprehensive Inspection</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Priority</label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={createForm.due_date}
                      onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1">Assigned Worker Name *</label>
                    <input
                      type="text"
                      required
                      value={createForm.assigned_worker_name}
                      onChange={(e) => setCreateForm({ ...createForm, assigned_worker_name: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Assigned Contractor</label>
                    <input
                      type="text"
                      value={createForm.assigned_contractor}
                      onChange={(e) => setCreateForm({ ...createForm, assigned_contractor: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    />
                  </div>
                </div>

                {/* Future Improvement 4 Cost Structure */}
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                  <div className="text-[11px] text-cyan-400 font-semibold uppercase tracking-wider">
                    Service Economics (Improvement 04 Readiness)
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Est. Labor Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        value={createForm.labor_hours}
                        onChange={(e) => setCreateForm({ ...createForm, labor_hours: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Estimated Cost</label>
                      <input
                        type="number"
                        step="100"
                        value={createForm.actual_cost}
                        onChange={(e) => setCreateForm({ ...createForm, actual_cost: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-gray-200"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Classification</label>
                      <select
                        value={createForm.repair_classification}
                        onChange={(e) => setCreateForm({ ...createForm, repair_classification: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-gray-200"
                      >
                        <option value="routine_maintenance">Routine Maintenance</option>
                        <option value="temporary_mitigation">Temporary Mitigation</option>
                        <option value="permanent_repair">Permanent Infrastructure Repair</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-bold shadow"
                  >
                    Create & Assign
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: SUBMIT EVIDENCE */}
        {showEvidenceModal && evidenceTargetWO && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>📸</span> Submit Service Completion Evidence
                  </h3>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Order #{evidenceTargetWO.id} — {evidenceTargetWO.location_code}
                  </div>
                </div>
                <button onClick={() => setShowEvidenceModal(false)} className="text-gray-400 hover:text-white font-bold">✕</button>
              </div>

              <form onSubmit={handleSubmitEvidence} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Action Performed *</label>
                  <select
                    value={evidenceForm.action_type}
                    onChange={(e) => handleEvidenceFormChange("action_type", e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                  >
                    <option value="Cleaned">Cleaned (Debris & Silt Removed)</option>
                    <option value="Drained">Drained (Standing Water Extracted)</option>
                    <option value="Covered">Covered (Mesh / Lid Installed)</option>
                    <option value="Repaired">Repaired (Drainage Fixture Fixed)</option>
                    <option value="Larvicide Applied">Larvicide Applied</option>
                    <option value="Inspected">Inspected (Clear / No Action Needed)</option>
                    <option value="Unable to Access">Unable to Access</option>
                    <option value="Other">Other Authorized Action</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Work Description & Observations *</label>
                  <textarea
                    rows={3}
                    required
                    value={evidenceForm.work_description}
                    onChange={(e) => handleEvidenceFormChange("work_description", e.target.value)}
                    placeholder="Describe exact actions taken on site, area scrubbed, drainage verified, etc..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 mb-1">Materials / Equipment Used</label>
                    <input
                      type="text"
                      value={evidenceForm.materials_used}
                      onChange={(e) => handleEvidenceFormChange("materials_used", e.target.value)}
                      placeholder="e.g. Submersible pump, 500g Bti larvicide"
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 mb-1">Any Unresolved Problems?</label>
                    <input
                      type="text"
                      value={evidenceForm.unresolved_notes}
                      onChange={(e) => handleEvidenceFormChange("unresolved_notes", e.target.value)}
                      placeholder="e.g. Cracked joint still dripping slowly"
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                    />
                  </div>
                </div>

                {/* Upload Section */}
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-cyan-400">Attach Evidence Photographs / Documents *</label>
                    <span className="text-[10px] text-gray-500 font-mono">Max 25MB (JPG, PNG, WEBP, PDF)</span>
                  </div>

                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setEvidenceFiles(e.target.files)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300"
                  />

                  {evidenceFiles.length > 0 && (
                    <div className="space-y-1 text-[11px] text-gray-400">
                      <strong>Selected files ({evidenceFiles.length}):</strong>
                      <ul className="list-disc list-inside">
                        {Array.from(evidenceFiles).map((f, i) => (
                          <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="acc_chk"
                      checked={evidenceForm.access_restricted}
                      onChange={(e) => handleEvidenceFormChange("access_restricted", e.target.checked)}
                      className="rounded bg-gray-900 border-gray-800 text-cyan-500"
                    />
                    <label htmlFor="acc_chk" className="text-gray-400">
                      Site access was partially restricted or required security escort
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowEvidenceModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingEvidence}
                    className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-bold shadow flex items-center gap-1.5"
                  >
                    {uploadingEvidence ? <span className="animate-spin">🔄</span> : <span>📤</span>}
                    <span>{uploadingEvidence ? "Uploading Evidence..." : "Submit for Supervisor Review"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: SUPERVISOR REVIEW DECISION */}
        {showReviewModal && reviewTargetWO && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>👨‍💼</span> Supervisor Evidence Review
                </h3>
                <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-white font-bold">✕</button>
              </div>

              <form onSubmit={handleSubmitSupervisorReview} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Decision *</label>
                  <select
                    value={reviewDecision}
                    onChange={(e) => setReviewDecision(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200 font-semibold"
                  >
                    <option value="accepted">✅ Accept & Verify Work (Work Verified)</option>
                    <option value="clarification_required">💬 Request Clarification (Return to Worker)</option>
                    <option value="rejected">❌ Reject Inadequate Submission</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Decision Notes & Rationale *</label>
                  <textarea
                    rows={4}
                    required
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Explain audit basis: photo confirmation of cleared drain, downspout clarity, etc..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                  />
                </div>

                {reviewDecision === "accepted" && (
                  <div className="bg-emerald-950/60 border border-emerald-800 p-3 rounded-xl text-emerald-200 space-y-1">
                    <div className="font-bold">Next Operational Step:</div>
                    <p className="text-[11px] leading-relaxed">
                      Acceptance records this service as <strong>WORK VERIFIED</strong> in the permanent location timeline.
                      An independent follow-up inspection will be scheduled to assess whether the hazard is permanently resolved.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-bold shadow"
                  >
                    {submittingReview ? "Recording Review..." : "Confirm Supervisor Decision"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: RECORD FOLLOW-UP RESOLUTION */}
        {showFollowupModal && followupTargetWO && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🔬</span> Record Follow-up Resolution Outcome
                  </h3>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Order #{followupTargetWO.id} — {followupTargetWO.location_code}
                  </div>
                </div>
                <button onClick={() => setShowFollowupModal(false)} className="text-gray-400 hover:text-white font-bold">✕</button>
              </div>

              <form onSubmit={handleSubmitFollowup} className="space-y-4 text-xs">
                <div>
                  <label className="block text-gray-400 mb-1">Inspector Observation Outcome *</label>
                  <select
                    value={followupOutcome}
                    onChange={(e) => setFollowupOutcome(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200 font-semibold"
                  >
                    <option value="clear">✅ Clear — Problem Absent (Resolution Confirmed at Follow-up)</option>
                    <option value="problem_still_present">❌ Problem Still Present — Intervention Ineffective (Issue Remains Open)</option>
                    <option value="unable_to_inspect">⚠️ Inconclusive / Site Inaccessible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Follow-up Inspector Name *</label>
                  <input
                    type="text"
                    required
                    value={followupInspector}
                    onChange={(e) => setFollowupInspector(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 mb-1">Physical Observation Notes *</label>
                  <textarea
                    rows={4}
                    required
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    placeholder="Document current conditions on site (e.g. water fully drained, no pupae or larvae detected, gravity flow unimpeded)..."
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-gray-200"
                  />
                </div>

                {followupOutcome === "clear" ? (
                  <div className="bg-teal-950/60 border border-teal-800 p-3 rounded-xl text-teal-200 text-[11px] leading-relaxed">
                    <strong>Resolution Confirmation: </strong>
                    The underlying hazard issue will be updated to <strong>RESOLVED</strong> with audit attribution.
                    The location is NOT labeled permanently dengue-free, but verified as clear on this follow-up date.
                  </div>
                ) : followupOutcome === "problem_still_present" ? (
                  <div className="bg-red-950/60 border border-red-800 p-3 rounded-xl text-red-200 text-[11px] leading-relaxed">
                    <strong>Hazard Remains Active: </strong>
                    Although service work was performed, the hazard issue remains <strong>OPEN</strong>.
                    Recurrence tracking will record an ineffective intervention for future infrastructure repair analysis.
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowFollowupModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingFollowup}
                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-lg font-bold shadow"
                  >
                    {submittingFollowup ? "Submitting..." : "Save Follow-up Outcome"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 5: WORK ORDER PROFILE / DETAILS */}
        {showDetailModal && selectedWorkOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 font-bold text-sm">{selectedWorkOrder.id}</span>
                    {renderStatusBadge(selectedWorkOrder.status)}
                    {renderResolutionBadge(selectedWorkOrder.resolution_verification_status)}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{selectedWorkOrder.title}</h3>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-white font-bold text-base">✕</button>
              </div>

              {/* Location & Property Meta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                <div>
                  <span className="text-gray-500">Property: </span>
                  <div className="text-gray-200 font-semibold">{selectedWorkOrder.property_name}</div>
                </div>
                <div>
                  <span className="text-gray-500">Location Point: </span>
                  <div className="text-gray-200 font-mono">{selectedWorkOrder.location_code}</div>
                </div>
                <div>
                  <span className="text-gray-500">Assigned Worker: </span>
                  <div className="text-gray-200">{selectedWorkOrder.assigned_worker_name}</div>
                </div>
                <div>
                  <span className="text-gray-500">Supervisor: </span>
                  <div className="text-gray-200">{selectedWorkOrder.responsible_supervisor}</div>
                </div>
              </div>

              {/* Economic & Labor Metadata (Improvement 04) */}
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 grid grid-cols-3 gap-3">
                <div>
                  <span className="text-gray-500">Labor Hours: </span>
                  <span className="text-cyan-300 font-mono">{selectedWorkOrder.labor_hours || 0} hrs</span>
                </div>
                <div>
                  <span className="text-gray-500">Actual Cost: </span>
                  <span className="text-emerald-300 font-mono">{selectedWorkOrder.actual_cost} {selectedWorkOrder.currency}</span>
                </div>
                <div>
                  <span className="text-gray-500">Repair Class: </span>
                  <span className="text-gray-300 font-mono">{selectedWorkOrder.repair_classification}</span>
                </div>
              </div>

              {/* Timeline Status History */}
              <div className="space-y-2">
                <h4 className="font-bold text-white">Status Audit History</h4>
                <div className="space-y-1.5">
                  {selectedWorkOrder.status_history?.map((h) => (
                    <div key={h.id} className="bg-gray-950/70 p-2.5 rounded-lg border border-gray-800/80 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-200">{h.from_status || "created"} ➔ {h.to_status}</span>
                        {h.notes && <span className="text-gray-400 ml-2">({h.notes})</span>}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {h.changed_by} | {new Date(h.changed_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Submissions */}
              {selectedWorkOrder.submissions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-white">Evidence Submissions & Photos</h4>
                  {selectedWorkOrder.submissions.map((sub) => (
                    <div key={sub.id} className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-2">
                      <div className="flex justify-between items-center text-gray-400 text-[11px]">
                        <span>Version {sub.submission_version} by <strong>{sub.submitted_by}</strong></span>
                        <span>{new Date(sub.submitted_at).toLocaleString()}</span>
                      </div>
                      <div><strong>Action: </strong>{sub.action_type} - {sub.work_description}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                        {sub.files?.map((f) => (
                          <div
                            key={f.id}
                            onClick={() => setPreviewImage(`${API_URL}/api/services/evidence/file/${f.id}`)}
                            className="bg-gray-900 border border-gray-800 rounded p-1.5 cursor-pointer text-center hover:border-cyan-600 transition"
                          >
                            {f.mime_type.startsWith("image/") ? (
                              <img
                                src={`${API_URL}/api/services/evidence/file/${f.id}`}
                                alt={f.original_filename}
                                className="w-full h-16 object-cover rounded"
                                onError={(e) => { e.target.style.display = "none"; }}
                              />
                            ) : (
                              <div className="h-16 flex items-center justify-center text-2xl">📄</div>
                            )}
                            <div className="text-[10px] truncate mt-1 text-gray-300">{f.original_filename}</div>
                            {f.is_duplicate_flag && (
                              <span className="text-[9px] text-red-400 font-bold block">⚠️ Duplicate Hash</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-gray-800">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 6: IMAGE PREVIEW */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-4xl max-h-[90vh] bg-gray-900 p-2 rounded-2xl border border-gray-800" onClick={(e) => e.stopPropagation()}>
              <img src={previewImage} alt="Evidence Preview" className="max-h-[80vh] w-auto rounded-xl object-contain mx-auto" />
              <div className="mt-2 flex justify-between items-center text-xs text-gray-400 px-2">
                <span>Secure Evidence File Stream</span>
                <button onClick={() => setPreviewImage(null)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-white">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
