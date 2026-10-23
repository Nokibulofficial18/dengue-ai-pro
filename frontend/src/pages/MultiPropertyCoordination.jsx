import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  ZoomControl,
  ScaleControl,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = import.meta.env.VITE_API_URL || "";

// Custom Leaflet DivIcon factory for crisp pins without external asset dependency
function createPinIcon(color = "#06b6d4", icon = "📍") {
  return L.divIcon({
    className: "custom-map-pin",
    html: `
      <div style="
        background: ${color};
        color: #0b1220;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      ">
        ${icon}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export default function MultiPropertyCoordination() {
  // Session / Role emulation
  const [authSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("dengue_auth_session");
      if (saved) return JSON.parse(saved);
      return {
        token: "dengue-authority-dev-2026",
        user: {
          username: "authority",
          display_name: "Engr. Tariqul Islam",
          role: "coordinator",
          agency: "Dhaka EPZ Industrial Estate Management Authority",
        },
      };
    } catch {
      return null;
    }
  });

  // Active Main Navigation Tab
  // 'overview' | 'map' | 'calendar' | 'work_orders' | 'handoffs' | 'invitations' | 'permissions' | 'reports' | 'org_portal'
  const [activeTab, setActiveTab] = useState("overview");

  // Core Data States
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("GRP-EPZ-01");
  const [currentGroup, setCurrentGroup] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [members, setMembers] = useState([]);
  const [sharedAreas, setSharedAreas] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [sharedWorkOrders, setSharedWorkOrders] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sharedRepairs, setSharedRepairs] = useState([]);

  // Organization Portal Perspective State
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState("ORG-BENGAL-APP");
  const [orgDashboard, setOrgDashboard] = useState(null);
  const [loadingOrgDashboard, setLoadingOrgDashboard] = useState(false);

  // Status Alerts
  const [alertSuccess, setAlertSuccess] = useState(null);
  const [alertError, setAlertError] = useState(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSharedAreaModal, setShowSharedAreaModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [showReviewHandoffModal, setShowReviewHandoffModal] = useState(false);
  const [selectedHandoff, setSelectedHandoff] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showActionItemModal, setShowActionItemModal] = useState(false);
  const [showReportView, setShowReportView] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Forms
  const [inviteForm, setInviteForm] = useState({
    invited_org_id: "",
    message: "Sector 3 management invites your organization to align bi-weekly drainage and perimeter vector prevention activities.",
    expires_in_days: 30,
  });

  const [sharedAreaForm, setSharedAreaForm] = useState({
    name: "",
    area_type: "drainage_corridor",
    description: "",
    latitude: 23.805,
    longitude: 90.368,
    responsible_org_id: "",
    responsible_manager: "",
    linked_location_id: "LOC-MIR-01",
    visibility_classification: "consortium_shared",
  });

  const [inspectionForm, setInspectionForm] = useState({
    shared_area_id: "",
    scheduled_date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    assigned_inspector: "Consortium Rapid Inspection Unit",
    notes: "Joint stormwater culvert and perimeter drain evaluation.",
  });

  const [workOrderForm, setWorkOrderForm] = useState({
    shared_area_id: "",
    title: "",
    required_action: "Silt desnagging, larvicide spray application, and standing puddle drainage.",
    priority: "high",
    assigned_worker_name: "Rafiqul Islam (Crew Lead)",
    assigned_contractor: "CleanCare Industrial Vector Services",
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
    description: "",
  });

  const [handoffForm, setHandoffForm] = useState({
    shared_area_id: "",
    originating_org_id: "ORG-BENGAL-APP",
    proposed_receiving_org_id: "ORG-EPZ-MGMT",
    reason: "",
    boundary_evidence_summary: "Physical survey confirms water accumulation straddles fence line.",
  });

  const [reviewHandoffForm, setReviewHandoffForm] = useState({
    decision: "accept",
    reviewed_by_name: "Engr. Tariqul Islam",
    review_decision_notes: "Accepted responsibility under consortium perimeter charter.",
  });

  const [permissionForm, setPermissionForm] = useState({
    source_org_id: "ORG-BENGAL-APP",
    receiving_org_id: "",
    information_category: "shared_area_status",
    permitted_access_level: "operational_status",
    sharing_purpose: "Share operational status of perimeter drainage maintenance.",
    granted_by_name: "Nasreen Akhter",
  });

  const [meetingForm, setMeetingForm] = useState({
    meeting_title: "Bi-Weekly Dengue Prevention Taskforce Review",
    meeting_date: new Date().toISOString().split("T")[0],
    chairperson_name: "Engr. Tariqul Islam",
    chairperson_org_id: "ORG-EPZ-MGMT",
    discussion_summary: "Reviewed monsoon drainage culvert progress, boundary handoff between plot 14 and main corridor, and synchronized larviciding plan.",
    next_meeting_date: new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0],
  });

  const [actionItemForm, setActionItemForm] = useState({
    action_title: "",
    description: "",
    assigned_org_id: "ORG-DELTA-MFG",
    assigned_lead_name: "Rafiqul Hasan",
    due_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
    linked_shared_area_id: "",
  });

  // Calendar and Table Filters
  const [calendarFilter, setCalendarFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const [invitationFilter, setInvitationFilter] = useState("all");

  const notify = (msg, isError = false) => {
    if (isError) {
      setAlertError(msg);
      setTimeout(() => setAlertError(null), 6000);
    } else {
      setAlertSuccess(msg);
      setTimeout(() => setAlertSuccess(null), 5000);
    }
  };

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchConsortiumData = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    try {
      const [
        groupsRes,
        groupRes,
        metricsRes,
        membersRes,
        sharedAreasRes,
        calendarRes,
        workOrdersRes,
        handoffsRes,
        invsRes,
        permsRes,
        meetingsRes,
        actionItemsRes,
        auditRes,
        repairsRes,
        orgsRes,
      ] = await Promise.all([
        axios.get(`${API_URL}/api/coordination/groups`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/metrics`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/members`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/shared-areas`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/calendar`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/work-orders`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/handoffs`),
        axios.get(`${API_URL}/api/coordination/invitations?group_id=${selectedGroupId}`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/permissions`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/meetings`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/action-items`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/audit-logs`),
        axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/repairs`),
        axios.get(`${API_URL}/api/organizations`),
      ]);

      setGroups(groupsRes.data || []);
      setCurrentGroup(groupRes.data);
      setMetrics(metricsRes.data);
      setMembers(membersRes.data || []);
      setSharedAreas(sharedAreasRes.data || []);
      setCalendarEvents(calendarRes.data || []);
      setSharedWorkOrders(workOrdersRes.data || []);
      setHandoffs(handoffsRes.data || []);
      setInvitations(invsRes.data || []);
      setPermissions(permsRes.data || []);
      setMeetings(meetingsRes.data || []);
      setActionItems(actionItemsRes.data || []);
      setAuditLogs(auditRes.data || []);
      setSharedRepairs(repairsRes.data || []);
      setOrganizations(orgsRes.data || []);

      if (sharedAreasRes.data && sharedAreasRes.data.length > 0) {
        setInspectionForm((prev) => ({ ...prev, shared_area_id: sharedAreasRes.data[0].id }));
        setWorkOrderForm((prev) => ({ ...prev, shared_area_id: sharedAreasRes.data[0].id }));
        setHandoffForm((prev) => ({ ...prev, shared_area_id: sharedAreasRes.data[0].id }));
      }
    } catch (err) {
      console.error("Failed to load coordination data:", err);
      notify("Failed to load consortium data. Running with cached values.", true);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgDashboard = async (orgId) => {
    if (!orgId) return;
    setLoadingOrgDashboard(true);
    try {
      const res = await axios.get(`${API_URL}/api/organizations/${orgId}/dashboard`);
      setOrgDashboard(res.data);
    } catch (err) {
      console.error("Failed to load organization portal:", err);
      notify("Failed to load organization portal data.", true);
    } finally {
      setLoadingOrgDashboard(false);
    }
  };

  useEffect(() => {
    fetchConsortiumData();
  }, [selectedGroupId]);

  useEffect(() => {
    if (activeTab === "org_portal") {
      fetchOrgDashboard(selectedOrgId);
    }
  }, [activeTab, selectedOrgId]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.invited_org_id) {
      notify("Please select an organization to invite.", true);
      return;
    }
    try {
      await axios.post(`${API_URL}/api/coordination/invitations`, {
        group_id: selectedGroupId,
        invited_org_id: inviteForm.invited_org_id,
        inviting_org_id: currentGroup.managing_org_id,
        invited_by_name: authSession?.user?.display_name || "Consortium Coordinator",
        message: inviteForm.message,
        expires_in_days: parseInt(inviteForm.expires_in_days) || 30,
      });
      notify("Consortium invitation dispatched successfully!");
      setShowInviteModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to send invitation.", true);
    }
  };

  const handleDecideInvite = async (invitationId, decision) => {
    try {
      await axios.post(`${API_URL}/api/coordination/invitations/${invitationId}/decide`, {
        decision,
        decision_by_name: authSession?.user?.display_name || "Authorized Representative",
        decision_notes: `Formally ${decision} by authorized representative.`,
      });
      notify(`Invitation has been ${decision}ed successfully!`);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to process invitation decision.", true);
    }
  };

  const handleCancelInvite = async (invitationId) => {
    try {
      await axios.post(
        `${API_URL}/api/coordination/invitations/${invitationId}/cancel?cancelled_by=${encodeURIComponent(
          authSession?.user?.display_name || "Consortium Coordinator"
        )}`
      );
      notify("Invitation cancelled.");
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to cancel invitation.", true);
    }
  };

  const handleCreateSharedArea = async (e) => {
    e.preventDefault();
    if (!sharedAreaForm.name) {
      notify("Please provide a name for the shared area.", true);
      return;
    }
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/shared-areas`, {
        ...sharedAreaForm,
        group_id: selectedGroupId,
        responsible_org_id: sharedAreaForm.responsible_org_id || null,
        responsible_manager: sharedAreaForm.responsible_manager || null,
      });
      notify("Shared area registered in consortium registry!");
      setShowSharedAreaModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to register shared area.", true);
    }
  };

  const handleScheduleInspection = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/shared-inspections`, {
        ...inspectionForm,
        created_by: authSession?.user?.display_name || "Consortium Coordinator",
      });
      notify("Shared inspection scheduled! Visit added to consortium calendar.");
      setShowInspectionModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to schedule shared inspection.", true);
    }
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    if (!workOrderForm.title) {
      notify("Please provide a task title.", true);
      return;
    }
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/shared-work-orders`, {
        ...workOrderForm,
        responsible_supervisor: authSession?.user?.display_name || "Consortium Supervisor",
      });
      notify("Shared maintenance task assigned to contractor!");
      setShowWorkOrderModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to assign shared work order.", true);
    }
  };

  const handleCreateHandoff = async (e) => {
    e.preventDefault();
    if (!handoffForm.reason) {
      notify("Please describe the boundary reason for the handoff.", true);
      return;
    }
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/handoffs`, {
        ...handoffForm,
        group_id: selectedGroupId,
        requested_by_name: authSession?.user?.display_name || "Site Representative",
      });
      notify("Responsibility handoff request filed! Awaiting review.");
      setShowHandoffModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to submit handoff request.", true);
    }
  };

  const handleReviewHandoff = async (e) => {
    e.preventDefault();
    if (!selectedHandoff) return;
    try {
      await axios.post(`${API_URL}/api/coordination/handoffs/${selectedHandoff.id}/review`, {
        decision: reviewHandoffForm.decision,
        reviewed_by_name: reviewHandoffForm.reviewed_by_name,
        review_decision_notes: reviewHandoffForm.review_decision_notes,
      });
      notify(`Handoff decision recorded: ${reviewHandoffForm.decision}! Responsibility updated.`);
      setShowReviewHandoffModal(false);
      setSelectedHandoff(null);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to review handoff.", true);
    }
  };

  const handleGrantPermission = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/permissions`, {
        ...permissionForm,
        group_id: selectedGroupId,
        receiving_org_id: permissionForm.receiving_org_id || null,
      });
      notify("Explicit data sharing permission authorized!");
      setShowPermissionModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to grant sharing permission.", true);
    }
  };

  const handleRevokePermission = async (permId) => {
    try {
      await axios.post(`${API_URL}/api/coordination/permissions/${permId}/revoke`, {
        revoked_by_name: authSession?.user?.display_name || "Authorized Representative",
        revocation_reason: "Formal revocation under consortium privacy policy.",
      });
      notify("Data sharing authorization revoked.");
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to revoke permission.", true);
    }
  };

  const handleRecordMeeting = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/meetings`, {
        ...meetingForm,
        group_id: selectedGroupId,
        attendees: members.map((m) => ({ org_id: m.organization_id, name: m.organization_name })),
      });
      notify("Taskforce meeting and minutes logged!");
      setShowMeetingModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to log meeting.", true);
    }
  };

  const handleCreateActionItem = async (e) => {
    e.preventDefault();
    if (!actionItemForm.action_title) {
      notify("Please provide an action title.", true);
      return;
    }
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/action-items`, {
        ...actionItemForm,
        group_id: selectedGroupId,
        linked_shared_area_id: actionItemForm.linked_shared_area_id || null,
      });
      notify("Action item assigned to organization!");
      setShowActionItemModal(false);
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to create action item.", true);
    }
  };

  const handleToggleActionItemStatus = async (item) => {
    const nextStatus = item.status === "completed" ? "in_progress" : "completed";
    try {
      await axios.patch(`${API_URL}/api/coordination/action-items/${item.id}`, {
        status: nextStatus,
        completion_notes: nextStatus === "completed" ? "Verified complete during taskforce audit" : null,
      });
      notify(`Action item updated to ${nextStatus}.`);
      fetchConsortiumData();
    } catch (err) {
      notify("Failed to update action item.", true);
    }
  };

  const handleWithdrawMember = async (orgId) => {
    const reason = window.prompt("Enter formal withdrawal reason (preserves historical audit record):");
    if (!reason) return;
    try {
      await axios.post(`${API_URL}/api/coordination/groups/${selectedGroupId}/members/${orgId}/withdraw`, {
        withdrawal_reason: reason,
        authorized_by: authSession?.user?.display_name || "Authorized Representative",
      });
      notify("Organization withdrawal completed. Tasks flagged for reassignment.");
      fetchConsortiumData();
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to process withdrawal.", true);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/coordination/groups/${selectedGroupId}/report`);
      setReportData(res.data);
      setShowReportView(true);
    } catch (err) {
      notify("Failed to generate report.", true);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived Filtering
  // ---------------------------------------------------------------------------

  const filteredCalendar = useMemo(() => {
    if (calendarFilter === "all") return calendarEvents;
    return calendarEvents.filter((e) => e.event_type === calendarFilter);
  }, [calendarEvents, calendarFilter]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === "all") return sharedWorkOrders;
    if (taskFilter === "open") return sharedWorkOrders.filter((w) => w.status !== "resolved");
    if (taskFilter === "overdue") {
      const today = new Date().toISOString().split("T")[0];
      return sharedWorkOrders.filter((w) => w.deadline < today && w.status !== "resolved");
    }
    return sharedWorkOrders.filter((w) => w.priority === taskFilter || w.status === taskFilter);
  }, [sharedWorkOrders, taskFilter]);

  const filteredInvitations = useMemo(() => {
    if (invitationFilter === "all") return invitations;
    return invitations.filter((i) => i.status === invitationFilter);
  }, [invitations, invitationFilter]);

  // Group boundary coordinates parsing for Leaflet
  const parsedGroupBoundary = useMemo(() => {
    if (!currentGroup?.boundary_geojson) return null;
    try {
      const geo = JSON.parse(currentGroup.boundary_geojson);
      if (geo.type === "Polygon" && geo.coordinates?.[0]) {
        // Leaflet expects [lat, lng]
        return geo.coordinates[0].map(([lng, lat]) => [lat, lng]);
      }
    } catch {
      return null;
    }
    return null;
  }, [currentGroup]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* =====================================================================
          HEADER SECTION & CONSORTIUM SELECTOR
         ===================================================================== */}
      <div className="card p-6 bg-gradient-to-r from-slate-900/95 via-cyan-950/40 to-[#0b1220] border border-cyan-500/20 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤝</span>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                  Multi-Property Prevention Coordination
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold uppercase tracking-wider">
                    Consortium Model
                  </span>
                </h1>
                <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                  Coordinated vector prevention across participating industrial plants, commercial parks, and campuses.
                  Maintains strict data privacy boundaries while aligning common-area drainage maintenance.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Consortium Selector */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Consortium</span>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="input px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 border-cyan-500/30"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateReport}
              className="btn btn-secondary px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1.5 shadow"
            >
              <span>📑</span> Generate Official Report
            </button>

            <Link
              to="/authority"
              className="btn btn-secondary px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white"
            >
              ← Command Center
            </Link>
          </div>
        </div>

        {/* Managing Organization Strip */}
        {currentGroup && (
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Managing Authority:</span>
              <span className="font-semibold text-white">{currentGroup.managing_org_name || currentGroup.managing_org_id}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Coordinator:</span>
              <span className="font-semibold text-cyan-300">{currentGroup.coordinator_name}</span>
              <span className="text-slate-500">({currentGroup.coordinator_contact || "Active"})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Geographic Scope:</span>
              <span className="text-slate-200">{currentGroup.geographic_scope || "Dhaka EPZ Industrial Sector"}</span>
              <span className="pill bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {currentGroup.status?.toUpperCase() || "ACTIVE"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ALERT NOTIFICATIONS */}
      {alertSuccess && (
        <div className="surface p-4 border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm rounded-xl flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{alertSuccess}</span>
          </div>
          <button onClick={() => setAlertSuccess(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}
      {alertError && (
        <div className="surface p-4 border border-red-500/40 bg-red-500/10 text-red-200 text-sm rounded-xl flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{alertError}</span>
          </div>
          <button onClick={() => setAlertError(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* =====================================================================
          METRICS BAR — REAL OPERATIONAL ACCOUNTABILITY (Step 15, Step 29)
         ===================================================================== */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Participating Orgs</span>
            <span className="text-2xl font-bold text-white mt-1">{metrics.total_participating_orgs}</span>
            <span className="text-[10px] text-emerald-400 mt-1">✓ Active Members</span>
          </div>
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Shared Spaces</span>
            <span className="text-2xl font-bold text-cyan-300 mt-1">{metrics.total_shared_areas}</span>
            <span className="text-[10px] text-slate-400 mt-1">Drains, Roads, Bays</span>
          </div>
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Accountability</span>
            <span className="text-2xl font-bold text-emerald-300 mt-1">{metrics.percentage_shared_areas_assigned}%</span>
            <span className="text-[10px] text-emerald-400 mt-1">{metrics.shared_areas_with_assigned_owner}/{metrics.total_shared_areas} Assigned</span>
          </div>
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Upcoming Visits</span>
            <span className="text-2xl font-bold text-cyan-400 mt-1">{metrics.upcoming_shared_inspections_count}</span>
            <span className="text-[10px] text-slate-400 mt-1">Scheduled in Group</span>
          </div>
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Open Tasks</span>
            <span className="text-2xl font-bold text-amber-300 mt-1">{metrics.open_shared_work_orders_count}</span>
            <span className="text-[10px] text-amber-400/90 mt-1">{metrics.overdue_shared_tasks_count} Overdue</span>
          </div>
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Verified Services</span>
            <span className="text-2xl font-bold text-purple-300 mt-1">{metrics.verified_shared_services_count}</span>
            <span className="text-[10px] text-purple-400 mt-1">Supervisor Verified</span>
          </div>
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Pending Handoffs</span>
            <span className="text-2xl font-bold text-orange-400 mt-1">{metrics.pending_handoffs_count}</span>
            <span className="text-[10px] text-orange-300 mt-1">Boundary Reviews</span>
          </div>
          <div className="surface p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Unassigned Areas</span>
            <span className={`text-2xl font-bold mt-1 ${metrics.unassigned_shared_areas_count > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {metrics.unassigned_shared_areas_count}
            </span>
            <span className="text-[10px] text-slate-400 mt-1">Requires Allocation</span>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB NAVIGATION (Screens A through I)
         ===================================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/10 scrollbar-none text-xs font-semibold">
        {[
          { id: "overview", label: "Consortium Overview", icon: "🏛️" },
          { id: "map", label: "Shared Map & Boundaries", icon: "🗺️" },
          { id: "calendar", label: "Group Inspection Calendar", icon: "📅" },
          { id: "work_orders", label: "Shared Tasks & Contractors", icon: "🛠️" },
          { id: "handoffs", label: "Responsibility Handoffs", icon: "🔄" },
          { id: "invitations", label: "Invitations & Consent", icon: "✉️" },
          { id: "permissions", label: "Data Sharing & Privacy", icon: "🔒" },
          { id: "reports", label: "Taskforce Meetings & Reports", icon: "📋" },
          { id: "org_portal", label: "Organization Portal", icon: "🏢" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* =====================================================================
          TAB 1: CONSORTIUM OVERVIEW (Screen A)
         ===================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Quick Actions Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 card p-4 bg-slate-900/60">
            <span className="text-xs text-slate-300 font-medium">
              Coordinator Controls: Maintain group members, shared assets, joint visits, and taskforce meetings.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowInviteModal(true)}
                className="btn btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow"
              >
                <span>➕</span> Invite Organization
              </button>
              <button
                onClick={() => setShowSharedAreaModal(true)}
                className="btn btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 border-cyan-500/30 flex items-center gap-1 hover:bg-cyan-500/10"
              >
                <span>📐</span> Register Shared Area
              </button>
              <button
                onClick={() => setShowInspectionModal(true)}
                className="btn btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-500/10"
              >
                <span>📅</span> Schedule Joint Visit
              </button>
              <button
                onClick={() => setShowMeetingModal(true)}
                className="btn btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 border-purple-500/30 flex items-center gap-1 hover:bg-purple-500/10"
              >
                <span>👥</span> Record Taskforce Meeting
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Participating Organizations & Memberships */}
            <div className="lg:col-span-2 card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🏢</span> Participating Organizations ({members.length})
                </h2>
                <span className="text-xs text-slate-400">Voluntary consent-based alliance</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="surface p-4 rounded-xl border border-white/10 hover:border-cyan-500/30 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-white text-sm">{m.organization_name}</span>
                        <span
                          className={`pill text-[10px] uppercase ${
                            m.role === "managing_lead"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : m.role === "shared_contractor"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          }`}
                        >
                          {m.role.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{m.notes || "Participating member"}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                      <span>Joined: {m.joined_at?.split("T")[0]}</span>
                      {m.role !== "managing_lead" && (
                        <button
                          onClick={() => handleWithdrawMember(m.organization_id)}
                          className="text-red-400 hover:text-red-300 text-[11px] underline"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Shared Spaces Summary */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🌊</span> Shared Corridors & Spaces
                </h2>
                <span className="text-xs text-cyan-300">{sharedAreas.length} registered</span>
              </div>

              <div className="space-y-3">
                {sharedAreas.map((sa) => (
                  <div key={sa.id} className="surface p-3.5 rounded-xl border border-white/10 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-white text-xs">{sa.name}</span>
                      <span className="pill text-[9px] uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {sa.area_type?.replace("_", " ")}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 line-clamp-2">{sa.description}</p>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
                      <span className="text-slate-400">Accountable Org:</span>
                      <span
                        className={`font-semibold ${
                          sa.responsible_org_name === "Responsibility not assigned"
                            ? "text-red-400"
                            : "text-emerald-300"
                        }`}
                      >
                        {sa.responsible_org_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Open Tasks: {sa.open_tasks_count || 0}</span>
                      <span>Upcoming Visits: {sa.upcoming_inspections_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shared Repair Status — Step 19: Operational Integration without Financial Leaks */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>💰</span> Permitted Shared Repair & Civil Upgrade Summaries
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Consortium engineering proposals on shared corridors. Supplier quotes, cost scenarios, and contractor
                  pricing remain confidential.
                </p>
              </div>
              <span className="pill bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                Protected Privacy
              </span>
            </div>

            {sharedRepairs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No capital repair proposals linked to common areas.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {sharedRepairs.map((rp) => (
                  <div key={rp.id} className="surface p-4 rounded-xl border border-white/10 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-white text-xs">{rp.proposal_title}</span>
                      <span className="pill text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                        {rp.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      <span className="text-slate-400">Corridor:</span> {rp.shared_area_name}
                    </p>
                    <p className="text-xs text-slate-300">
                      <span className="text-slate-400">Method:</span> {rp.proposed_method}
                    </p>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Service Life: {rp.expected_service_life_years} yrs</span>
                      <span className="font-medium text-emerald-300">{rp.responsible_org_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SHARED MAP & BOUNDARIES (Screen C)
         ===================================================================== */}
      {activeTab === "map" && (
        <div className="card p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🗺️</span> Shared Space GIS & Consortium Boundary Visualization
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Visualizes agreed industrial park boundaries, common stormwater corridors, access roads, and shared
                waste depots.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Boundary:</span>
              <span className="pill bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px]">
                {currentGroup?.geographic_scope || "Sector 3 Boundary Active"}
              </span>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="h-[520px] rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl">
            <MapContainer center={[23.805, 90.368]} zoom={15} className="h-full w-full">
              <ZoomControl position="bottomright" />
              <ScaleControl position="bottomleft" />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors | DengueAI Pro"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Group Boundary Polygon */}
              {parsedGroupBoundary && (
                <Polygon
                  positions={parsedGroupBoundary}
                  pathOptions={{
                    color: "#06b6d4",
                    fillColor: "#06b6d4",
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: "6, 6",
                  }}
                >
                  <Tooltip sticky>{currentGroup?.name} (Consortium Perimeter)</Tooltip>
                </Polygon>
              )}

              {/* Shared Area Markers */}
              {sharedAreas.map((sa) => {
                if (!sa.latitude || !sa.longitude) return null;
                const isUnassigned = sa.responsible_org_name === "Responsibility not assigned";
                const pinColor = isUnassigned ? "#ef4444" : sa.status === "maintenance_required" ? "#f59e0b" : "#10b981";
                const pinIcon = isUnassigned ? "⚠️" : sa.area_type === "drainage_corridor" ? "🌊" : "📍";

                return (
                  <Marker
                    key={sa.id}
                    position={[sa.latitude, sa.longitude]}
                    icon={createPinIcon(pinColor, pinIcon)}
                  >
                    <Popup>
                      <div className="text-slate-900 p-1 min-w-[220px]">
                        <div className="font-bold text-sm text-cyan-900">{sa.name}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{sa.description}</div>
                        <div className="mt-2 text-xs border-t pt-1.5 space-y-1">
                          <div>
                            <strong>Accountable:</strong>{" "}
                            <span className={isUnassigned ? "text-red-600 font-bold" : "text-emerald-700"}>
                              {sa.responsible_org_name}
                            </span>
                          </div>
                          <div>
                            <strong>Linked Hazard:</strong> {sa.linked_location_name || "LOC-MIR-01"}
                          </div>
                          <div>
                            <strong>Active Tasks:</strong> {sa.open_tasks_count || 0}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* List-Based Fallback View (Step 8 requirement) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Registered Shared Spaces Detail (List Alternative)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/5 text-slate-300 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Area Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Accountable Organization</th>
                    <th className="py-2.5 px-3">Coordinates</th>
                    <th className="py-2.5 px-3">Tasks</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sharedAreas.map((sa) => (
                    <tr key={sa.id} className="hover:bg-white/5">
                      <td className="py-2.5 px-3 font-semibold text-white">{sa.name}</td>
                      <td className="py-2.5 px-3 capitalize">{sa.area_type?.replace("_", " ")}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            sa.responsible_org_name === "Responsibility not assigned"
                              ? "text-red-400"
                              : "text-emerald-300"
                          }`}
                        >
                          {sa.responsible_org_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {sa.latitude ? `${sa.latitude.toFixed(4)}, ${sa.longitude?.toFixed(4)}` : "Not Mapped"}
                      </td>
                      <td className="py-2.5 px-3">{sa.open_tasks_count || 0} open</td>
                      <td className="py-2.5 px-3">
                        <span className="pill text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase">
                          {sa.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: GROUP INSPECTION CALENDAR (Screen D, Step 9, Step 10)
         ===================================================================== */}
      {activeTab === "calendar" && (
        <div className="card p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📅</span> Group Coordinated Inspection & Maintenance Calendar
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Synchronized shared-area visits. Private factory internal inspections are strictly excluded to preserve
                commercial confidentiality.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={calendarFilter}
                onChange={(e) => setCalendarFilter(e.target.value)}
                className="input px-3 py-1.5 rounded-xl text-xs"
              >
                <option value="all">All Shared Activities</option>
                <option value="shared_inspection">Inspections Only</option>
                <option value="shared_work_order">Maintenance Tasks Only</option>
              </select>
              <button
                onClick={() => setShowInspectionModal(true)}
                className="btn btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow"
              >
                <span>➕</span> Schedule Joint Inspection
              </button>
            </div>
          </div>

          {/* Privacy Notice Banner */}
          <div className="surface-muted p-3.5 rounded-xl border border-cyan-500/20 text-xs text-cyan-200 flex items-center gap-2.5">
            <span className="text-base">🛡️</span>
            <span>
              <strong>Server-Side Access Filter Active:</strong> Only activities with explicit group references or shared
              boundaries appear on this calendar. Factory private internal visits remain secluded in their respective
              company dashboards.
            </span>
          </div>

          {/* Events List / Timeline */}
          <div className="space-y-3">
            {filteredCalendar.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No coordinated events found for selected filter.</p>
            ) : (
              filteredCalendar.map((ev) => (
                <div
                  key={ev.event_id}
                  className="surface p-4 rounded-xl border border-white/10 hover:border-cyan-500/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-lg">
                      {ev.event_type === "shared_inspection" ? "🔍" : "🛠️"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{ev.title}</span>
                        <span
                          className={`pill text-[9px] uppercase ${
                            ev.event_type === "shared_inspection"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          }`}
                        >
                          {ev.event_type.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        <span className="text-slate-400">Location:</span> {ev.shared_area_name} •{" "}
                        <span className="text-slate-400">Accountable:</span>{" "}
                        <span className="text-emerald-300 font-medium">{ev.responsible_org_name}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Assigned: {ev.assigned_team} • Slot: {ev.time_slot}
                      </p>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-1 text-right">
                    <span className="text-sm font-bold text-cyan-300">{ev.scheduled_date}</span>
                    <span className="pill text-[9px] bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                      {ev.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: SHARED TASKS & WORK ORDERS (Screen E, Step 11)
         ===================================================================== */}
      {activeTab === "work_orders" && (
        <div className="card p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🛠️</span> Shared Area Maintenance & Work Orders
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Common corridor service orders. Integrated with Improvement 03 Service Verification with strict cost
                sanitization.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value)}
                className="input px-3 py-1.5 rounded-xl text-xs"
              >
                <option value="all">All Shared Tasks</option>
                <option value="open">Open / In Progress</option>
                <option value="overdue">Overdue Tasks</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical</option>
              </select>
              <button
                onClick={() => setShowWorkOrderModal(true)}
                className="btn btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow"
              >
                <span>➕</span> Assign Shared Work Order
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/5 text-slate-300 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Task Details</th>
                  <th className="py-2.5 px-3">Shared Corridor</th>
                  <th className="py-2.5 px-3">Accountable Org</th>
                  <th className="py-2.5 px-3">Assigned Contractor</th>
                  <th className="py-2.5 px-3">Deadline</th>
                  <th className="py-2.5 px-3">Verification</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No shared maintenance tasks matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((wo) => (
                    <tr key={wo.id} className="hover:bg-white/5">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white text-xs">{wo.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{wo.required_action}</div>
                      </td>
                      <td className="py-3 px-3 font-medium text-cyan-300">{wo.shared_area_name}</td>
                      <td className="py-3 px-3 text-slate-200">{wo.responsible_org_name}</td>
                      <td className="py-3 px-3 text-slate-300">{wo.assigned_worker_name}</td>
                      <td className="py-3 px-3 font-semibold text-slate-200">{wo.deadline}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`pill text-[9px] uppercase ${
                            wo.verification_status === "fully_resolved"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {wo.verification_status || "Awaiting Followup"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`pill text-[9px] uppercase ${
                            wo.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : wo.status === "in_progress"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {wo.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: RESPONSIBILITY HANDOFFS (Screen F, Step 12)
         ===================================================================== */}
      {activeTab === "handoffs" && (
        <div className="card p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🔄</span> Boundary Responsibility Handoffs
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Formal transfer of maintenance jurisdiction for issues straddling private factory borders and shared
                park infrastructure.
              </p>
            </div>
            <button
              onClick={() => setShowHandoffModal(true)}
              className="btn btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow"
            >
              <span>➕</span> Request Responsibility Handoff
            </button>
          </div>

          <div className="space-y-3.5">
            {handoffs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No boundary responsibility handoffs recorded.</p>
            ) : (
              handoffs.map((ho) => (
                <div
                  key={ho.id}
                  className="surface p-4 rounded-xl border border-white/10 space-y-3 hover:border-cyan-500/30 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{ho.shared_area_name || "Boundary Gutter"}</span>
                      <span
                        className={`pill text-[9px] uppercase ${
                          ho.status === "accepted"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : ho.status === "rejected"
                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {ho.status.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">Requested: {ho.requested_at?.split("T")[0]}</span>
                  </div>

                  <p className="text-xs text-slate-200 font-medium">
                    <span className="text-slate-400">Reason:</span> {ho.reason}
                  </p>
                  {ho.boundary_evidence_summary && (
                    <p className="text-[11px] text-cyan-300/90 bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-800/30">
                      <strong>Evidence:</strong> {ho.boundary_evidence_summary}
                    </p>
                  )}

                  <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span>From: <strong>{ho.originating_org_name}</strong></span>
                      <span>➔</span>
                      <span>To: <strong>{ho.proposed_receiving_org_name}</strong></span>
                    </div>

                    {ho.status === "pending_review" && (
                      <button
                        onClick={() => {
                          setSelectedHandoff(ho);
                          setShowReviewHandoffModal(true);
                        }}
                        className="btn btn-primary px-3 py-1 rounded-lg text-xs font-semibold"
                      >
                        Review & Decide Handoff →
                      </button>
                    )}

                    {ho.status !== "pending_review" && (
                      <div className="text-[11px] text-slate-400">
                        Decided by <strong>{ho.reviewed_by_name}</strong> on {ho.reviewed_at?.split("T")[0]}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: INVITATIONS & CONSENT (Screen B, Step 6)
         ===================================================================== */}
      {activeTab === "invitations" && (
        <div className="card p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>✉️</span> Organization Consortium Invitations
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Participation requires explicit verification by an authorized representative. Cryptographic tokens
                prevent spoofing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={invitationFilter}
                onChange={(e) => setInvitationFilter(e.target.value)}
                className="input px-3 py-1.5 rounded-xl text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
              </select>
              <button
                onClick={() => setShowInviteModal(true)}
                className="btn btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow"
              >
                <span>➕</span> Send New Invitation
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredInvitations.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No invitations matching filter.</p>
            ) : (
              filteredInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="surface p-4 rounded-xl border border-white/10 hover:border-cyan-500/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{inv.invited_org_name}</span>
                      <span
                        className={`pill text-[9px] uppercase ${
                          inv.status === "accepted"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : inv.status === "pending"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-red-500/20 text-red-300 border border-red-500/40"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{inv.message}</p>
                    <p className="text-[11px] text-slate-400">
                      Invited by: {inv.invited_by_name} ({inv.inviting_org_name}) • Expires: {inv.expires_at?.split("T")[0]}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {inv.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleDecideInvite(inv.id, "accept")}
                          className="btn btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDecideInvite(inv.id, "decline")}
                          className="btn btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleCancelInvite(inv.id)}
                          className="text-red-400 hover:text-red-300 text-xs px-2"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {inv.status !== "pending" && (
                      <span className="text-xs text-slate-400">
                        {inv.decision_by_name ? `Decided by ${inv.decision_by_name}` : "Processed"}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 7: DATA SHARING PERMISSIONS & PRIVACY (Screen G, Step 13)
         ===================================================================== */}
      {activeTab === "permissions" && (
        <div className="card p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🔒</span> Data-Sharing Permissions & Multi-Tenant Isolation
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Zero-leakage default-deny security model. Participation does NOT grant automatic access to private
                records.
              </p>
            </div>
            <button
              onClick={() => setShowPermissionModal(true)}
              className="btn btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow"
            >
              <span>➕</span> Grant Explicit Permission
            </button>
          </div>

          {/* Privacy Rules Matrix Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 space-y-2">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>✅</span> Permitted Shared Operational Data
              </span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>Shared-area task title and due dates</li>
                <li>Joint drainage inspection schedule and status</li>
                <li>Accountable organization and designated supervisor</li>
                <li>Consortium service verification outcomes</li>
                <li>Shared boundary hazard notifications</li>
              </ul>
            </div>
            <div className="surface p-4 rounded-xl border border-red-500/20 bg-red-950/10 space-y-2">
              <span className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🛡️</span> Strictly Protected Private Records (Default Denied)
              </span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>Internal facility inspection photos and notes</li>
                <li>Corporate maintenance budgets and supplier pricing</li>
                <li>Contractor labor rates and tender bids</li>
                <li>Private worker and employee personal contacts</li>
                <li>Confidential citizen reports and individual complaints</li>
              </ul>
            </div>
          </div>

          {/* Explicit Permissions Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Active Data-Sharing Authorizations</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/5 text-slate-300 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Information Category</th>
                    <th className="py-2.5 px-3">Source Organization</th>
                    <th className="py-2.5 px-3">Permitted Scope</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">Granted By</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {permissions.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 font-semibold text-white capitalize">
                        {p.information_category?.replace("_", " ")}
                      </td>
                      <td className="py-3 px-3 text-cyan-300">{p.source_org_name}</td>
                      <td className="py-3 px-3 capitalize">{p.permitted_access_level?.replace("_", " ")}</td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs">{p.sharing_purpose}</td>
                      <td className="py-3 px-3 text-slate-400">
                        {p.granted_by_name} ({p.granted_at?.split("T")[0]})
                      </td>
                      <td className="py-3 px-3">
                        {p.is_revoked ? (
                          <span className="text-slate-500 italic">Revoked</span>
                        ) : (
                          <button
                            onClick={() => handleRevokePermission(p.id)}
                            className="text-red-400 hover:text-red-300 underline font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 8: MEETINGS & REPORTS (Screen H, Step 20)
         ===================================================================== */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="card p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>👥</span> Taskforce Meetings & Action Items
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Minutes and agreed action deliverables across consortium member organizations.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowActionItemModal(true)}
                  className="btn btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 border-cyan-500/30 flex items-center gap-1 hover:bg-cyan-500/10"
                >
                  <span>➕</span> Add Action Item
                </button>
                <button
                  onClick={() => setShowMeetingModal(true)}
                  className="btn btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow"
                >
                  <span>📝</span> Record Meeting
                </button>
              </div>
            </div>

            {/* Meetings Log */}
            <div className="space-y-3">
              {meetings.map((m) => (
                <div key={m.id} className="surface p-4 rounded-xl border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{m.meeting_title}</span>
                    <span className="text-xs text-cyan-300">{m.meeting_date}</span>
                  </div>
                  <p className="text-xs text-slate-200">{m.discussion_summary}</p>
                  <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>Chairperson: {m.chairperson_name} ({m.chairperson_org_name})</span>
                    <span>Next Meeting: {m.next_meeting_date || "TBD"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Agreed Action Items Board */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Agreed Consortium Action Items</span>
                <span className="text-xs text-slate-400 font-normal">Check off when completed</span>
              </h3>

              <div className="space-y-2">
                {actionItems.map((act) => (
                  <div
                    key={act.id}
                    className={`surface p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                      act.status === "completed"
                        ? "border-emerald-500/30 bg-emerald-950/10"
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={act.status === "completed"}
                        onChange={() => handleToggleActionItemStatus(act)}
                        className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div
                          className={`font-semibold text-xs ${
                            act.status === "completed" ? "line-through text-slate-400" : "text-white"
                          }`}
                        >
                          {act.action_title}
                        </div>
                        {act.description && <p className="text-[11px] text-slate-400">{act.description}</p>}
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>Assigned: <strong>{act.assigned_org_name}</strong></span>
                          <span>•</span>
                          <span>Due: {act.due_date}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`pill text-[9px] uppercase ${
                        act.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {act.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 9: PARTICIPATING ORGANIZATION PORTAL (Screen I, Step 16)
         ===================================================================== */}
      {activeTab === "org_portal" && (
        <div className="card p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏢</span> Participating Organization Portal
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Tenant-isolated view for individual factory operators, property managers, or contracted service firms.
              </p>
            </div>

            {/* Organization Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Viewing Perspective:</span>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="input px-3 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 border-cyan-500/30"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.org_type?.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingOrgDashboard ? (
            <p className="text-xs text-slate-400 py-8 text-center animate-pulse">Loading organization records...</p>
          ) : !orgDashboard ? (
            <p className="text-xs text-slate-400 py-6 text-center">No organization records loaded.</p>
          ) : (
            <div className="space-y-6">
              {/* Org Details Bar */}
              <div className="surface p-4 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Representative:</span>{" "}
                  <span className="font-semibold text-white">{orgDashboard.organization.authorized_representative}</span>{" "}
                  <span className="text-slate-500">({orgDashboard.organization.representative_role})</span>
                </div>
                <div>
                  <span className="text-slate-400">Email:</span>{" "}
                  <span className="text-cyan-300">{orgDashboard.organization.contact_email}</span>
                </div>
                <div>
                  <span className="pill bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase text-[10px]">
                    {orgDashboard.organization.org_type?.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Grid: My Properties & My Hazard Locations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* My Properties */}
                <div className="surface p-4 rounded-xl border border-white/10 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>🏛️ My Managed Properties ({orgDashboard.properties?.length || 0})</span>
                  </h3>
                  {orgDashboard.properties?.length === 0 ? (
                    <p className="text-xs text-slate-400">No registered properties owned directly.</p>
                  ) : (
                    orgDashboard.properties.map((p) => (
                      <div key={p.id} className="surface-muted p-3 rounded-lg border border-white/5 text-xs space-y-1">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{p.address}</div>
                        <div className="text-[10px] text-cyan-300">Hazard Locations: {p.location_count || 0}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* My Hazard Locations */}
                <div className="surface p-4 rounded-xl border border-white/10 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>⚠️ My Hazard Locations ({orgDashboard.hazard_locations?.length || 0})</span>
                  </h3>
                  {orgDashboard.hazard_locations?.length === 0 ? (
                    <p className="text-xs text-slate-400">No active hazard locations recorded.</p>
                  ) : (
                    orgDashboard.hazard_locations.map((loc) => (
                      <div key={loc.id} className="surface-muted p-3 rounded-lg border border-white/5 text-xs space-y-1">
                        <div className="font-semibold text-white flex items-center justify-between">
                          <span>{loc.name}</span>
                          <span className="pill text-[9px] bg-slate-800 text-slate-300 uppercase">{loc.category}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{loc.written_directions || loc.floor_zone}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Work Orders Strip: Private Work Orders vs Permitted Shared Tasks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="surface p-4 rounded-xl border border-white/10 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    🛠️ My Private Work Orders ({orgDashboard.private_work_orders?.length || 0})
                  </h3>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {orgDashboard.private_work_orders?.length === 0 ? (
                      <p className="text-xs text-slate-400">No internal private tasks.</p>
                    ) : (
                      orgDashboard.private_work_orders.map((wo) => (
                        <div key={wo.id} className="surface-muted p-2.5 rounded-lg border border-white/5 text-xs">
                          <div className="font-semibold text-white">{wo.title}</div>
                          <div className="text-[10px] text-slate-400">Due: {wo.due_date} • Status: {wo.status}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="surface p-4 rounded-xl border border-white/10 space-y-3">
                  <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    🤝 My Assigned Shared Tasks ({orgDashboard.shared_work_orders?.length || 0})
                  </h3>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {orgDashboard.shared_work_orders?.length === 0 ? (
                      <p className="text-xs text-slate-400">No shared tasks currently assigned.</p>
                    ) : (
                      orgDashboard.shared_work_orders.map((wo) => (
                        <div key={wo.id} className="surface-muted p-2.5 rounded-lg border border-white/5 text-xs">
                          <div className="font-semibold text-white">{wo.title}</div>
                          <div className="text-[10px] text-cyan-300">Corridor: {wo.shared_area_name}</div>
                          <div className="text-[10px] text-slate-400">Deadline: {wo.due_date} • Worker: {wo.assigned_worker_name}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL: OFFICIAL REPORT VIEW & PRINT (Step 20)
         ===================================================================== */}
      {showReportView && reportData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card p-8 max-w-4xl w-full bg-[#0b1220] border border-cyan-500/30 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  Official Consortium Report
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">{reportData.group_name}</h2>
                <p className="text-xs text-slate-400">
                  Managing Entity: {reportData.managing_org_name} • Period: {reportData.reporting_period}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold"
                >
                  🖨️ Print / Save PDF
                </button>
                <button
                  onClick={() => setShowReportView(false)}
                  className="btn btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Executive Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="surface p-3 rounded-lg border border-white/10">
                <span className="text-slate-400">Inspections Completed</span>
                <div className="text-lg font-bold text-white mt-0.5">{reportData.inspections_completed_count}</div>
              </div>
              <div className="surface p-3 rounded-lg border border-white/10">
                <span className="text-slate-400">Inspections Overdue</span>
                <div className="text-lg font-bold text-red-400 mt-0.5">{reportData.inspections_overdue_count}</div>
              </div>
              <div className="surface p-3 rounded-lg border border-white/10">
                <span className="text-slate-400">Tasks Completed</span>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{reportData.shared_tasks_completed_count}</div>
              </div>
              <div className="surface p-3 rounded-lg border border-white/10">
                <span className="text-slate-400">Pending Boundary Reviews</span>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{reportData.pending_responsibility_handoffs_count}</div>
              </div>
            </div>

            {/* Participating Members Summary */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Participating Consortium Organizations</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {reportData.participating_orgs?.map((org) => (
                  <div key={org.org_id} className="surface p-2.5 rounded-lg border border-white/5">
                    <span className="font-semibold text-white">{org.name}</span>
                    <div className="text-[10px] text-cyan-300 capitalize">{org.role?.replace("_", " ")}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shared Corridors Status */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Shared Infrastructure Status</h3>
              <table className="w-full text-xs text-left">
                <thead className="bg-white/5 text-slate-400 text-[10px]">
                  <tr>
                    <th className="py-2 px-2.5">Corridor Name</th>
                    <th className="py-2 px-2.5">Type</th>
                    <th className="py-2 px-2.5">Accountable Owner</th>
                    <th className="py-2 px-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reportData.shared_areas_summary?.map((sa) => (
                    <tr key={sa.area_id}>
                      <td className="py-2 px-2.5 font-medium text-white">{sa.name}</td>
                      <td className="py-2 px-2.5 capitalize">{sa.type?.replace("_", " ")}</td>
                      <td className="py-2 px-2.5 text-emerald-300">{sa.responsible_org}</td>
                      <td className="py-2 px-2.5 uppercase text-[10px]">{sa.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Agreed Action Items */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Agreed Action Deliverables</h3>
              <div className="space-y-1.5 text-xs">
                {reportData.agreed_action_items?.map((act) => (
                  <div key={act.id} className="surface p-2.5 rounded-lg border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">{act.action_title}</span>
                      <div className="text-[10px] text-slate-400">Assigned: {act.assigned_org_name} • Due: {act.due_date}</div>
                    </div>
                    <span className="pill text-[9px] uppercase bg-slate-800 text-slate-300">{act.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 text-center pt-4 border-t border-white/5">
              Generated by {reportData.generated_by} on {reportData.generated_at} • DengueAI Pro Multi-Property Engine
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SEND INVITATION (Screen B)
         ===================================================================== */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>✉️</span> Invite Organization
              </h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Target Organization</label>
                <select
                  value={inviteForm.invited_org_id}
                  onChange={(e) => setInviteForm({ ...inviteForm, invited_org_id: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                >
                  <option value="">Select Organization...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.org_type?.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Invitation Message & Scope</label>
                <textarea
                  value={inviteForm.message}
                  onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-24"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Validity (Days)</label>
                <input
                  type="number"
                  value={inviteForm.expires_in_days}
                  onChange={(e) => setInviteForm({ ...inviteForm, expires_in_days: e.target.value })}
                  className="input w-full p-2 rounded-xl"
                  min={7}
                  max={90}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Dispatch Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: REGISTER SHARED AREA (Screen C)
         ===================================================================== */}
      {showSharedAreaModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-lg w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📐</span> Register Shared Space / Corridor
              </h3>
              <button onClick={() => setShowSharedAreaModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateSharedArea} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Area Name</label>
                <input
                  type="text"
                  placeholder="e.g. Northern Perimeter Stormwater Culvert"
                  value={sharedAreaForm.name}
                  onChange={(e) => setSharedAreaForm({ ...sharedAreaForm, name: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Area Type</label>
                  <select
                    value={sharedAreaForm.area_type}
                    onChange={(e) => setSharedAreaForm({ ...sharedAreaForm, area_type: e.target.value })}
                    className="input w-full p-2.5 rounded-xl"
                  >
                    <option value="drainage_corridor">Drainage Corridor</option>
                    <option value="service_road">Service Road</option>
                    <option value="waste_storage">Waste Storage Depot</option>
                    <option value="courtyard">Common Courtyard</option>
                    <option value="retention_pond">Retention Pond</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Accountable Org (Optional)</label>
                  <select
                    value={sharedAreaForm.responsible_org_id}
                    onChange={(e) => setSharedAreaForm({ ...sharedAreaForm, responsible_org_id: e.target.value })}
                    className="input w-full p-2.5 rounded-xl"
                  >
                    <option value="">Leave Unassigned ("Responsibility not assigned")</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Description</label>
                <textarea
                  value={sharedAreaForm.description}
                  onChange={(e) => setSharedAreaForm({ ...sharedAreaForm, description: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-20"
                  placeholder="Operational details, boundary markers, and access points..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={sharedAreaForm.latitude}
                    onChange={(e) => setSharedAreaForm({ ...sharedAreaForm, latitude: parseFloat(e.target.value) })}
                    className="input w-full p-2 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={sharedAreaForm.longitude}
                    onChange={(e) => setSharedAreaForm({ ...sharedAreaForm, longitude: parseFloat(e.target.value) })}
                    className="input w-full p-2 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSharedAreaModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Save Shared Area
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SCHEDULE JOINT INSPECTION (Screen D, Step 9)
         ===================================================================== */}
      {showInspectionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📅</span> Schedule Coordinated Joint Visit
              </h3>
              <button onClick={() => setShowInspectionModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleScheduleInspection} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Target Shared Corridor</label>
                <select
                  value={inspectionForm.shared_area_id}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, shared_area_id: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                >
                  {sharedAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name} ({sa.responsible_org_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={inspectionForm.scheduled_date}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, scheduled_date: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Assigned Inspector / Team</label>
                <input
                  type="text"
                  value={inspectionForm.assigned_inspector}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, assigned_inspector: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Inspection Notes / Scope</label>
                <textarea
                  value={inspectionForm.notes}
                  onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInspectionModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Confirm & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ASSIGN SHARED WORK ORDER (Screen E, Step 11)
         ===================================================================== */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-lg w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🛠️</span> Assign Shared Area Maintenance Task
              </h3>
              <button onClick={() => setShowWorkOrderModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateWorkOrder} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Target Shared Space</label>
                <select
                  value={workOrderForm.shared_area_id}
                  onChange={(e) => setWorkOrderForm({ ...workOrderForm, shared_area_id: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                >
                  {sharedAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name} ({sa.responsible_org_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Desilt Masonry Trap and Apply Bti Larvicide"
                  value={workOrderForm.title}
                  onChange={(e) => setWorkOrderForm({ ...workOrderForm, title: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Required Action</label>
                <textarea
                  value={workOrderForm.required_action}
                  onChange={(e) => setWorkOrderForm({ ...workOrderForm, required_action: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Contractor / Crew</label>
                  <input
                    type="text"
                    value={workOrderForm.assigned_contractor}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, assigned_contractor: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Lead Worker Name</label>
                  <input
                    type="text"
                    value={workOrderForm.assigned_worker_name}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, assigned_worker_name: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Priority</label>
                  <select
                    value={workOrderForm.priority}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, priority: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Deadline Date</label>
                  <input
                    type="date"
                    value={workOrderForm.due_date}
                    onChange={(e) => setWorkOrderForm({ ...workOrderForm, due_date: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWorkOrderModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Dispatch Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: REQUEST RESPONSIBILITY HANDOFF (Screen F, Step 12)
         ===================================================================== */}
      {showHandoffModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-lg w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔄</span> Request Responsibility Handoff
              </h3>
              <button onClick={() => setShowHandoffModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateHandoff} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Affected Shared Corridor / Boundary</label>
                <select
                  value={handoffForm.shared_area_id}
                  onChange={(e) => setHandoffForm({ ...handoffForm, shared_area_id: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                >
                  {sharedAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Originating Organization</label>
                  <select
                    value={handoffForm.originating_org_id}
                    onChange={(e) => setHandoffForm({ ...handoffForm, originating_org_id: e.target.value })}
                    className="input w-full p-2.5 rounded-xl"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Proposed Receiving Organization</label>
                  <select
                    value={handoffForm.proposed_receiving_org_id}
                    onChange={(e) => setHandoffForm({ ...handoffForm, proposed_receiving_org_id: e.target.value })}
                    className="input w-full p-2.5 rounded-xl"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Boundary Reason for Transfer</label>
                <textarea
                  placeholder="Explain why this problem crosses fence lines or belongs under proposed org's jurisdiction..."
                  value={handoffForm.reason}
                  onChange={(e) => setHandoffForm({ ...handoffForm, reason: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-20"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Supporting Physical Evidence</label>
                <textarea
                  value={handoffForm.boundary_evidence_summary}
                  onChange={(e) => setHandoffForm({ ...handoffForm, boundary_evidence_summary: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-16"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHandoffModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  File Handoff Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: REVIEW RESPONSIBILITY HANDOFF (Screen F, Step 12)
         ===================================================================== */}
      {showReviewHandoffModal && selectedHandoff && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚖️</span> Review Boundary Handoff
              </h3>
              <button
                onClick={() => {
                  setShowReviewHandoffModal(false);
                  setSelectedHandoff(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="surface p-3 rounded-lg text-xs space-y-1">
              <div className="text-slate-400">Request Reason:</div>
              <div className="text-white font-medium">{selectedHandoff.reason}</div>
              <div className="text-[11px] text-cyan-300 mt-1">
                From: {selectedHandoff.originating_org_name} ➔ To: {selectedHandoff.proposed_receiving_org_name}
              </div>
            </div>

            <form onSubmit={handleReviewHandoff} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Decision</label>
                <select
                  value={reviewHandoffForm.decision}
                  onChange={(e) => setReviewHandoffForm({ ...reviewHandoffForm, decision: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                >
                  <option value="accept">Accept Responsibility (Updates Area Owner)</option>
                  <option value="reject">Reject Transfer (Retains Original Owner)</option>
                  <option value="clarification_requested">Request Boundary Survey Clarification</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Review Notes & Decision Justification</label>
                <textarea
                  value={reviewHandoffForm.review_decision_notes}
                  onChange={(e) => setReviewHandoffForm({ ...reviewHandoffForm, review_decision_notes: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-24"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReviewHandoffModal(false);
                    setSelectedHandoff(null);
                  }}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Submit Official Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: GRANT EXPLICIT DATA SHARING PERMISSION (Screen G, Step 13)
         ===================================================================== */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔐</span> Grant Explicit Data Sharing
              </h3>
              <button onClick={() => setShowPermissionModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleGrantPermission} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Source Organization (Grantor)</label>
                <select
                  value={permissionForm.source_org_id}
                  onChange={(e) => setPermissionForm({ ...permissionForm, source_org_id: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Information Category</label>
                <select
                  value={permissionForm.information_category}
                  onChange={(e) => setPermissionForm({ ...permissionForm, information_category: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                >
                  <option value="shared_area_status">Shared Area Task Status</option>
                  <option value="reinspection_schedule">Reinspection Calendar Dates</option>
                  <option value="boundary_hazard_alert">Boundary Hazard Alerts</option>
                  <option value="service_verification_summary">Service Verification Summaries</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Permitted Access Level</label>
                <select
                  value={permissionForm.permitted_access_level}
                  onChange={(e) => setPermissionForm({ ...permissionForm, permitted_access_level: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                >
                  <option value="operational_status">Operational Status (Pass/Fail/Resolved)</option>
                  <option value="summary_only">Summary Metrics Only</option>
                  <option value="detailed_dates">Detailed Visit Dates</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Stated Sharing Purpose</label>
                <textarea
                  value={permissionForm.sharing_purpose}
                  onChange={(e) => setPermissionForm({ ...permissionForm, sharing_purpose: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Authorize Sharing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: RECORD TASKFORCE MEETING (Screen H)
         ===================================================================== */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>👥</span> Record Taskforce Meeting
              </h3>
              <button onClick={() => setShowMeetingModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordMeeting} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Meeting Title</label>
                <input
                  type="text"
                  value={meetingForm.meeting_title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meeting_title: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Meeting Date</label>
                  <input
                    type="date"
                    value={meetingForm.meeting_date}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Next Meeting Date</label>
                  <input
                    type="date"
                    value={meetingForm.next_meeting_date}
                    onChange={(e) => setMeetingForm({ ...meetingForm, next_meeting_date: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Discussion Summary & Key Minutes</label>
                <textarea
                  value={meetingForm.discussion_summary}
                  onChange={(e) => setMeetingForm({ ...meetingForm, discussion_summary: e.target.value })}
                  className="input w-full p-2.5 rounded-xl h-24"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Save Meeting Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ADD ACTION ITEM (Screen H)
         ===================================================================== */}
      {showActionItemModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full bg-[#0b1220] border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>➕</span> Add Consortium Action Item
              </h3>
              <button onClick={() => setShowActionItemModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateActionItem} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Action Title</label>
                <input
                  type="text"
                  placeholder="e.g. Inspect boundary culvert joint seal"
                  value={actionItemForm.action_title}
                  onChange={(e) => setActionItemForm({ ...actionItemForm, action_title: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Assigned Organization</label>
                <select
                  value={actionItemForm.assigned_org_id}
                  onChange={(e) => setActionItemForm({ ...actionItemForm, assigned_org_id: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Lead Name</label>
                  <input
                    type="text"
                    value={actionItemForm.assigned_lead_name}
                    onChange={(e) => setActionItemForm({ ...actionItemForm, assigned_lead_name: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Target Due Date</label>
                  <input
                    type="date"
                    value={actionItemForm.due_date}
                    onChange={(e) => setActionItemForm({ ...actionItemForm, due_date: e.target.value })}
                    className="input w-full p-2 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Linked Shared Area (Optional)</label>
                <select
                  value={actionItemForm.linked_shared_area_id}
                  onChange={(e) => setActionItemForm({ ...actionItemForm, linked_shared_area_id: e.target.value })}
                  className="input w-full p-2.5 rounded-xl"
                >
                  <option value="">None (Consortium-wide)</option>
                  {sharedAreas.map((sa) => (
                    <option key={sa.id} value={sa.id}>{sa.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActionItemModal(false)}
                  className="btn btn-secondary px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl font-bold">
                  Save Action Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
