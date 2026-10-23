import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { getCached, cachedGet, invalidateCache } from "../utils/apiCache";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function RepairPlanning() {
  // Authentication & Role Session State
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("dengue_auth_session");
      if (saved) return JSON.parse(saved);
      return {
        token: "dengue-authority-dev-2026",
        user: {
          username: "authority",
          display_name: "Nasir Uddin Ahmed",
          role: "manager",
          agency: "Dhaka North City Corporation / Facilities Directorate",
        },
      };
    } catch {
      return null;
    }
  });

  // Active Hub Tab: 'opportunities' | 'assessments' | 'proposals' | 'financial' | 'outcomes'
  const [activeTab, setActiveTab] = useState("opportunities");

  // Global Data initialized from client cache for instant 0ms mount render
  const [loading, setLoading] = useState(false);
  const [portfolioStats, setPortfolioStats] = useState(() => getCached(`${API_URL}/api/repair-planning/portfolio`));
  const [opportunities, setOpportunities] = useState(() => getCached(`${API_URL}/api/repair-planning/opportunities`) || []);
  const [properties, setProperties] = useState(() => getCached(`${API_URL}/api/sites/properties`) || []);
  const [assessments, setAssessments] = useState(() => getCached(`${API_URL}/api/repair-planning/assessments`) || []);
  const [proposals, setProposals] = useState(() => getCached(`${API_URL}/api/repair-planning/proposals`) || []);

  // Filters for Opportunities
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minRecurrences, setMinRecurrences] = useState(1);
  const [minSpend, setMinSpend] = useState(0);

  // Status message alerts
  const [alertSuccess, setAlertSuccess] = useState(null);
  const [alertError, setAlertError] = useState(null);

  // ==========================================================================
  // MODAL STATES
  // ==========================================================================
  // 1. Cost History Modal (Screen B)
  const [selectedLocationCost, setSelectedLocationCost] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [costHistoryData, setCostHistoryData] = useState(null);
  const [loadingCostHistory, setLoadingCostHistory] = useState(false);
  const [showNewCostForm, setShowNewCostForm] = useState(false);
  const [newCostForm, setNewCostForm] = useState({
    cost_category: "contractor_fee",
    amount: 2500,
    currency: "BDT",
    expense_date: new Date().toISOString().split("T")[0],
    description: "",
    invoice_ref: "",
    status: "verified",
  });

  // 2. Technical Assessment Modal (Screen C)
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    property_id: "",
    location_id: "",
    assessor_name: "Engr. Tariqul Islam",
    assessor_role: "Senior Drainage Systems Engineer",
    assessment_date: new Date().toISOString().split("T")[0],
    problem_description: "",
    suspected_root_cause: "",
    observations: "",
    recommended_action: "",
    feasibility: "repair_feasible",
    safety_considerations: "Standard fall arrest harness and PPE required for rooftop drain work.",
    additional_investigations: "",
  });

  // 3. Repair Proposal Modal (Screen D)
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    property_id: "",
    location_id: "",
    assessment_id: "",
    title: "",
    description: "",
    responsible_assessor: "Engr. Tariqul Islam",
    proposed_method: "",
    expected_service_life_years: 5.0,
    expected_maintenance_after_per_month: 200.0,
    safety_considerations: "Roof anchor tie-offs during installation.",
    operational_interruption_hours: 4.0,
  });

  // 4. Supplier Quotation Modal (Screen E)
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [targetProposalForQuote, setTargetProposalForQuote] = useState(null);
  const [quotationForm, setQuotationForm] = useState({
    supplier_name: "",
    quoted_amount: 10000,
    currency: "BDT",
    scope_of_work: "",
    included_materials: "",
    excluded_costs: "",
    lead_time_days: 7,
    valid_until: new Date(Date.now() + 45 * 86400000).toISOString().split("T")[0],
    warranty_months: 12,
  });

  // 5. Financial Comparison Workspace (Screen F & G)
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [evalPeriodMonths, setEvalPeriodMonths] = useState(12);
  const [financialCalcResult, setFinancialCalcResult] = useState(null);
  const [calculatingFinancials, setCalculatingFinancials] = useState(false);
  const [savedScenariosList, setSavedScenariosList] = useState([]);
  const [approvalHistoryList, setApprovalHistoryList] = useState([]);

  // Approval Form (Screen G)
  const [approvalDecision, setApprovalDecision] = useState("approved"); // 'approved' | 'rejected' | 'more_info_required'
  const [approvalBudget, setApprovalBudget] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // 6. Launch Implementation Work Order Modal (Screen H)
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [targetProposalForWO, setTargetProposalForWO] = useState(null);
  const [workOrderForm, setWorkOrderForm] = useState({
    assigned_worker_name: "Kamal Hossain",
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    responsible_supervisor: "Supervisor Tariqul Islam",
  });
  const [launchingWO, setLaunchingWO] = useState(false);

  // 7. Post-Repair Outcome Detail State (Screen H)
  const [postRepairOutcomes, setPostRepairOutcomes] = useState({});

  // Helper auth headers
  const authHeaders = useMemo(() => {
    return {
      headers: {
        "X-Authority-Key": authSession?.token || "dengue-authority-dev-2026",
        "Content-Type": "application/json",
      },
    };
  }, [authSession]);

  // Role Switcher helper
  const switchRole = (newRole) => {
    let name = "Nasir Uddin Ahmed";
    let agency = "Dhaka North City Corporation / Facilities Directorate";
    if (newRole === "worker") {
      name = "Kamal Hossain";
      agency = "Field Vector Maintenance Crew";
    } else if (newRole === "maintenance_assessor") {
      name = "Engr. Tariqul Islam";
      agency = "Structural & Drainage Engineering Unit";
    } else if (newRole === "supervisor") {
      name = "Supervisor Tariqul Islam";
      agency = "DNCC Field Operations Directorate";
    } else if (newRole === "approver") {
      name = "Dr. Aminul Haque";
      agency = "Municipal Finance & Public Works Directorate";
    }

    const updatedSession = {
      token: "dengue-authority-dev-2026",
      user: {
        username: "authority",
        display_name: name,
        role: newRole,
        agency: agency,
      },
    };
    sessionStorage.setItem("dengue_auth_session", JSON.stringify(updatedSession));
    setAuthSession(updatedSession);
  };

  // ==========================================================================
  // INITIAL DATA FETCHING with SWR client-side caching
  // ==========================================================================
  const fetchAllData = async (forceRefresh = false) => {
    if (!portfolioStats && opportunities.length === 0) {
      setLoading(true);
    }
    try {
      // 1. Portfolio economics
      const portRes = await cachedGet(`${API_URL}/api/repair-planning/portfolio`, authHeaders, undefined, forceRefresh).catch(() => null);
      if (portRes?.data) setPortfolioStats(portRes.data);

      // 2. Opportunities
      const oppRes = await cachedGet(
        `${API_URL}/api/repair-planning/opportunities?min_recurrences=${minRecurrences}&min_spend=${minSpend}`,
        authHeaders,
        undefined,
        forceRefresh
      ).catch(() => null);
      if (oppRes?.data) setOpportunities(oppRes.data);

      // 3. Properties from sites router
      const propRes = await cachedGet(`${API_URL}/api/sites/properties`, authHeaders, undefined, forceRefresh).catch(() => null);
      if (propRes?.data) setProperties(propRes.data);

      // 4. Assessments
      const assessRes = await cachedGet(`${API_URL}/api/repair-planning/assessments`, authHeaders, undefined, forceRefresh).catch(() => null);
      if (assessRes?.data) setAssessments(assessRes.data);

      // 5. Proposals
      const propListRes = await cachedGet(`${API_URL}/api/repair-planning/proposals`, authHeaders, undefined, forceRefresh).catch(() => null);
      if (propListRes?.data) {
        setProposals(propListRes.data);
        // Default selected proposal for financial workspace if none selected
        if (!selectedProposalId && propListRes.data.length > 0) {
          const firstProp = propListRes.data[0];
          setSelectedProposalId(firstProp.id);
          if (firstProp.quotations && firstProp.quotations.length > 0) {
            setSelectedQuotationId(firstProp.quotations[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error loading repair planning data:", err);
      if (err.response?.status === 401) {
        sessionStorage.removeItem("dengue_auth_session");
        setAuthSession(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [minRecurrences, minSpend]);

  // Load outcomes for implemented proposals
  useEffect(() => {
    const loadOutcomes = async () => {
      const implemented = proposals.filter((p) => p.status === "implemented" || p.implemented_work_order_id);
      for (const p of implemented) {
        try {
          const res = await axios.get(`${API_URL}/api/repair-planning/proposals/${p.id}/outcomes`, authHeaders);
          if (res.data) {
            setPostRepairOutcomes((prev) => ({ ...prev, [p.id]: res.data }));
          }
        } catch {
          // ignore
        }
      }
    };
    if (proposals.length > 0) {
      loadOutcomes();
    }
  }, [proposals]);

  // Sync selected proposal quotes when selection changes
  useEffect(() => {
    if (selectedProposalId) {
      const prop = proposals.find((p) => p.id === selectedProposalId);
      if (prop && prop.quotations && prop.quotations.length > 0) {
        // If current quote id not in this proposal, default to first quote
        const hasQuote = prop.quotations.some((q) => q.id === selectedQuotationId);
        if (!hasQuote) {
          setSelectedQuotationId(prop.quotations[0].id);
        }
      }
      // Load saved scenarios & approvals for this proposal
      fetchProposalDetails(selectedProposalId);
    }
  }, [selectedProposalId, proposals]);

  const fetchProposalDetails = async (pid) => {
    try {
      const [scenRes, apprRes] = await Promise.all([
        axios.get(`${API_URL}/api/repair-planning/proposals/${pid}/scenarios`, authHeaders).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/repair-planning/proposals/${pid}/approvals`, authHeaders).catch(() => ({ data: [] })),
      ]);
      setSavedScenariosList(scenRes.data || []);
      setApprovalHistoryList(apprRes.data || []);
    } catch {
      // ignore
    }
  };

  // Automatically calculate financials when proposal, quote, or window changes in Tab 4
  useEffect(() => {
    if (activeTab === "financial" && selectedProposalId && selectedQuotationId) {
      runFinancialCalculation(selectedProposalId, selectedQuotationId, evalPeriodMonths);
    }
  }, [activeTab, selectedProposalId, selectedQuotationId, evalPeriodMonths]);

  const runFinancialCalculation = async (pid, qid, months) => {
    if (!pid || !qid) return;
    setCalculatingFinancials(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/repair-planning/proposals/${pid}/calculate?quotation_id=${qid}&evaluation_period_months=${months}`,
        {},
        authHeaders
      );
      setFinancialCalcResult(res.data);
      setApprovalBudget(res.data.quoted_amount);
    } catch (err) {
      console.error("Financial calculation failed:", err);
      setFinancialCalcResult(null);
    } finally {
      setCalculatingFinancials(false);
    }
  };

  // ==========================================================================
  // HANDLERS FOR ACTIONS
  // ==========================================================================
  // Open Cost History for a location
  const handleOpenCostHistory = async (locationId, locCode, locName) => {
    setSelectedLocationCost({ id: locationId, code: locCode, name: locName });
    setShowCostModal(true);
    setLoadingCostHistory(true);
    setShowNewCostForm(false);
    try {
      const res = await axios.get(`${API_URL}/api/repair-planning/locations/${locationId}/costs`, authHeaders);
      setCostHistoryData(res.data);
      // prefill property id for cost logging form
      setNewCostForm((prev) => ({
        ...prev,
        property_id: res.data.property_id,
        location_id: locationId,
      }));
    } catch (err) {
      console.error("Failed to load cost history:", err);
    } finally {
      setLoadingCostHistory(false);
    }
  };

  // Submit a new cost entry
  const handleRecordCostEntry = async (e) => {
    e.preventDefault();
    if (!selectedLocationCost) return;
    try {
      const payload = {
        ...newCostForm,
        property_id: costHistoryData?.property_id,
        location_id: selectedLocationCost.id,
        amount: parseFloat(newCostForm.amount),
      };
      await axios.post(`${API_URL}/api/repair-planning/costs`, payload, authHeaders);
      setAlertSuccess(`Maintenance expense ৳${payload.amount.toLocaleString()} logged successfully.`);
      setShowNewCostForm(false);
      // refresh cost summary
      handleOpenCostHistory(selectedLocationCost.id, selectedLocationCost.code, selectedLocationCost.name);
      // refresh opportunities
      fetchAllData();
    } catch (err) {
      setAlertError(err.response?.data?.detail || "Failed to record expense.");
    }
  };

  // Record a technical assessment
  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    if (authSession?.user?.role === "worker") {
      setAlertError("Maintenance workers cannot submit engineering root-cause assessments. Switch to Assessor or Manager role.");
      return;
    }
    try {
      await axios.post(`${API_URL}/api/repair-planning/assessments`, assessmentForm, authHeaders);
      setAlertSuccess("Qualified technical engineering assessment recorded.");
      setShowAssessmentModal(false);
      fetchAllData();
    } catch (err) {
      setAlertError(err.response?.data?.detail || "Failed to record assessment.");
    }
  };

  // Create repair proposal
  const handleSaveProposal = async (e) => {
    e.preventDefault();
    if (authSession?.user?.role === "worker") {
      setAlertError("Field workers cannot register capital repair proposals. Switch to Assessor or Manager role.");
      return;
    }
    try {
      const payload = {
        ...proposalForm,
        expected_service_life_years: parseFloat(proposalForm.expected_service_life_years),
        expected_maintenance_after_per_month: parseFloat(proposalForm.expected_maintenance_after_per_month),
        operational_interruption_hours: parseFloat(proposalForm.operational_interruption_hours),
      };
      const res = await axios.post(`${API_URL}/api/repair-planning/proposals`, payload, authHeaders);
      setAlertSuccess(`Repair proposal '${payload.title}' registered.`);
      setShowProposalModal(false);
      await fetchAllData();
      if (res.data?.id) {
        setSelectedProposalId(res.data.id);
        setActiveTab("proposals");
      }
    } catch (err) {
      setAlertError(err.response?.data?.detail || "Failed to create proposal.");
    }
  };

  // Add quotation
  const handleAddQuotation = async (e) => {
    e.preventDefault();
    if (!targetProposalForQuote) return;
    try {
      const payload = {
        ...quotationForm,
        quoted_amount: parseFloat(quotationForm.quoted_amount),
        lead_time_days: parseInt(quotationForm.lead_time_days, 10),
        warranty_months: parseInt(quotationForm.warranty_months, 10),
      };
      await axios.post(`${API_URL}/api/repair-planning/proposals/${targetProposalForQuote.id}/quotations`, payload, authHeaders);
      setAlertSuccess(`Supplier quotation from '${payload.supplier_name}' attached.`);
      setShowQuotationModal(false);
      fetchAllData();
    } catch (err) {
      setAlertError(err.response?.data?.detail || "Failed to add quotation.");
    }
  };

  // Save financial scenario snapshot
  const handleSaveScenarioSnapshot = async () => {
    if (!selectedProposalId || !selectedQuotationId) return;
    try {
      await axios.post(
        `${API_URL}/api/repair-planning/proposals/${selectedProposalId}/save-scenario`,
        {
          quotation_id: selectedQuotationId,
          evaluation_period_months: evalPeriodMonths,
          assumptions_notes: `Modeled by ${authSession?.user?.display_name} (${authSession?.user?.role}) over ${evalPeriodMonths} months with supplier quote.`,
          is_approved_baseline: true,
        },
        authHeaders
      );
      setAlertSuccess("Auditable financial comparison snapshot saved successfully.");
      fetchProposalDetails(selectedProposalId);
    } catch (err) {
      setAlertError(err.response?.data?.detail || "Failed to save scenario snapshot.");
    }
  };

  // Submit Approval Decision
  const handleRecordApproval = async (e) => {
    e.preventDefault();
    if (["worker", "maintenance_assessor"].includes(authSession?.user?.role)) {
      setAlertError("Role not authorized to approve capital budgets or reject proposals. Property Manager or Finance Approver authorization required.");
      return;
    }
    setSubmittingApproval(true);
    try {
      await axios.post(
        `${API_URL}/api/repair-planning/proposals/${selectedProposalId}/approve`,
        {
          quotation_id: selectedQuotationId,
          decision: approvalDecision,
          decision_notes: approvalNotes || "Formal managerial decision recorded following multi-scenario cost review.",
          approved_budget: parseFloat(approvalBudget || 0),
        },
        authHeaders
      );
      setAlertSuccess(`Proposal decision '${approvalDecision.toUpperCase()}' recorded.`);
      setApprovalNotes("");
      await fetchAllData();
      fetchProposalDetails(selectedProposalId);
    } catch (err) {
      setAlertError(err.response?.data?.detail || "Failed to record approval decision.");
    } finally {
      setSubmittingApproval(false);
    }
  };

  // Launch Work Order
  const handleLaunchWorkOrder = async (e) => {
    e.preventDefault();
    if (!targetProposalForWO) return;
    setLaunchingWO(true);
    try {
      await axios.post(
        `${API_URL}/api/repair-planning/proposals/${targetProposalForWO.id}/create-work-order`,
        workOrderForm,
        authHeaders
      );
      setAlertSuccess(`Implementation Work Order successfully dispatched for '${targetProposalForWO.title}'.`);
      setShowWorkOrderModal(false);
      fetchAllData();
    } catch (err) {
      setAlertError(err.response?.data?.detail || "Failed to launch repair work order.");
    } finally {
      setLaunchingWO(false);
    }
  };

  // Filtered Opportunities List
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      if (propertyFilter !== "all" && opp.property_id !== propertyFilter) return false;
      if (categoryFilter !== "all" && opp.decision_support_category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          opp.location_code?.toLowerCase().includes(q) ||
          opp.location_name?.toLowerCase().includes(q) ||
          opp.property_name?.toLowerCase().includes(q) ||
          opp.explanation?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [opportunities, propertyFilter, categoryFilter, searchQuery]);

  // Selected proposal object in financial tab
  const activeProposalObj = useMemo(() => {
    return proposals.find((p) => p.id === selectedProposalId);
  }, [proposals, selectedProposalId]);

  return (
    <div className="text-slate-100 pb-16">
      {/* ==================================================================== */}
      {/* HEADER & GOVERNANCE BAR */}
      {/* ==================================================================== */}
      <div className="midnight-card p-5 mb-6 border border-[#1B3654]/80 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                💰
              </span>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  Permanent Repair &amp; Cost-Savings Recommendations
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                    Improvement 04
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Know when a lasting structural repair is more economical than paying for repeated emergency cleanup.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Hub Navigation & Role Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/authority/services"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition flex items-center gap-1"
            >
              <span>🛠️</span> Service Verification
            </Link>
            <Link
              to="/authority/scheduling"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition flex items-center gap-1"
            >
              <span>📅</span> Smart Scheduling
            </Link>
            <Link
              to="/authority/sites"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition flex items-center gap-1"
            >
              <span>🏛️</span> Site Registry
            </Link>

            {/* Role Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400">Role:</span>
              <select
                value={authSession?.user?.role || "manager"}
                onChange={(e) => switchRole(e.target.value)}
                className="bg-transparent text-xs text-amber-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="manager" className="bg-slate-900 text-slate-200">
                  Property Manager (Nasir)
                </option>
                <option value="approver" className="bg-slate-900 text-slate-200">
                  Finance Approver (Dr. Aminul)
                </option>
                <option value="maintenance_assessor" className="bg-slate-900 text-slate-200">
                  Technical Assessor (Engr. Tariqul)
                </option>
                <option value="supervisor" className="bg-slate-900 text-slate-200">
                  Operations Supervisor
                </option>
                <option value="worker" className="bg-slate-900 text-slate-200">
                  Field Worker (Kamal)
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Global Notifications */}
      {alertSuccess && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>✅</span> {alertSuccess}
          </span>
          <button onClick={() => setAlertSuccess(null)} className="text-emerald-300 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}
      {alertError && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>⚠️</span> {alertError}
          </span>
          <button onClick={() => setAlertError(null)} className="text-red-300 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* NAVIGATION TABS */}
      {/* ==================================================================== */}
      <div className="flex border-b border-slate-700/80 mb-6 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("opportunities")}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "opportunities"
              ? "bg-slate-800 text-emerald-300 border-t-2 border-emerald-400 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <span>🔍</span> Repair Opportunities
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
            {opportunities.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("assessments")}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "assessments"
              ? "bg-slate-800 text-cyan-300 border-t-2 border-cyan-400 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <span>📐</span> Technical Assessments
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
            {assessments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "proposals"
              ? "bg-slate-800 text-amber-300 border-t-2 border-amber-400 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <span>📋</span> Proposals &amp; Quotes
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
            {proposals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("financial")}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "financial"
              ? "bg-slate-800 text-emerald-400 border-t-2 border-emerald-400 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <span>📈</span> Financial Scenarios &amp; Approval
        </button>

        <button
          onClick={() => setActiveTab("outcomes")}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "outcomes"
              ? "bg-slate-800 text-purple-300 border-t-2 border-purple-400 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <span>🏁</span> Post-Repair Outcomes &amp; Portfolio
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: REPAIR OPPORTUNITIES & HISTORICAL COSTS (SCREEN A & B) */}
      {/* ==================================================================== */}
      {activeTab === "opportunities" && (
        <div className="space-y-6">
          {/* Portfolio Metric Overview Banner */}
          {portfolioStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 bg-slate-900/60 border border-slate-700/60">
                <div className="text-xs text-slate-400">Total Tracked Locations</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {portfolioStats.total_locations_tracked}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {portfolioStats.locations_with_recurring_costs} with recurring costs
                </div>
              </div>

              <div className="card p-4 bg-slate-900/60 border border-slate-700/60">
                <div className="text-xs text-slate-400">Historical Maintenance Spend</div>
                <div className="text-2xl font-bold text-amber-300 mt-1">
                  ৳{portfolioStats.total_historical_maintenance_spend.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Documented visit invoices</div>
              </div>

              <div className="card p-4 bg-slate-900/60 border border-slate-700/60">
                <div className="text-xs text-slate-400">Approved Repair Capital</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  ৳{portfolioStats.total_approved_repair_investment.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {portfolioStats.approved_repairs_count} projects approved
                </div>
              </div>

              <div className="card p-4 bg-slate-900/60 border border-slate-700/60">
                <div className="text-xs text-slate-400">Forecasted Annual Savings</div>
                <div className="text-2xl font-bold text-cyan-300 mt-1">
                  ৳{portfolioStats.total_forecasted_annual_savings.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Under documented assumptions</div>
              </div>
            </div>
          )}

          {/* Filters & Control Bar */}
          <div className="card p-4 bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <input
                type="text"
                placeholder="Search location, property, issue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 min-w-[200px]"
              />

              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none"
              >
                <option value="all">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none"
              >
                <option value="all">All Review Categories</option>
                <option value="financially_promising">Financially Promising</option>
                <option value="needs_technical_assessment">Needs Technical Assessment</option>
                <option value="ready_for_financial_review">Ready for Financial Review</option>
                <option value="needs_cost_data">Needs Cost Data</option>
                <option value="financially_unfavorable">Financially Unfavorable</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <span>Min Recurrences:</span>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={minRecurrences}
                  onChange={(e) => setMinRecurrences(parseInt(e.target.value, 10) || 0)}
                  className="w-10 bg-slate-900 text-center text-cyan-300 font-semibold focus:outline-none rounded"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAssessmentForm((prev) => ({
                    ...prev,
                    property_id: properties[0]?.id || "",
                  }));
                  setShowAssessmentModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow transition flex items-center gap-1"
              >
                <span>➕</span> New Assessment
              </button>
            </div>
          </div>

          {/* Opportunities Table */}
          <div className="card overflow-hidden border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-700 font-semibold">
                  <tr>
                    <th className="p-3.5">Location &amp; Property</th>
                    <th className="p-3.5 text-center">Recurrences</th>
                    <th className="p-3.5 text-center">Verified Visits</th>
                    <th className="p-3.5 text-right">Historical Spend</th>
                    <th className="p-3.5 text-center">Review Category</th>
                    <th className="p-3.5">System Explanation</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">
                        No recurring-cost opportunities match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOpportunities.map((opp) => (
                      <tr key={opp.location_id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3.5">
                          <div className="font-semibold text-white">{opp.location_name}</div>
                          <div className="text-[11px] text-cyan-400 font-mono">{opp.location_code}</div>
                          <div className="text-[11px] text-slate-400">{opp.property_name}</div>
                        </td>

                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              opp.confirmed_recurrence_count >= 3
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : opp.confirmed_recurrence_count >= 1
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {opp.confirmed_recurrence_count} repeats
                          </span>
                        </td>

                        <td className="p-3.5 text-center text-slate-300">
                          {opp.verified_service_visits} visits
                        </td>

                        <td className="p-3.5 text-right font-mono font-semibold">
                          <span className={opp.total_maintenance_spend > 0 ? "text-amber-300" : "text-slate-500"}>
                            ৳{opp.total_maintenance_spend.toLocaleString()}
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              opp.decision_support_category === "financially_promising"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : opp.decision_support_category === "ready_for_financial_review"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : opp.decision_support_category === "needs_technical_assessment"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : opp.decision_support_category === "needs_cost_data"
                                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {opp.decision_support_category.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="p-3.5 max-w-xs">
                          <p className="text-[11px] text-slate-300 leading-relaxed">{opp.explanation}</p>
                          {opp.missing_data_warnings?.length > 0 && (
                            <div className="mt-1">
                              {opp.missing_data_warnings.map((w, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.2 rounded mr-1"
                                >
                                  ⚠️ {w}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-right space-y-1">
                          <button
                            onClick={() =>
                              handleOpenCostHistory(opp.location_id, opp.location_code, opp.location_name)
                            }
                            className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-700 hover:bg-slate-600 text-amber-300 block w-full text-center"
                          >
                            Cost History (৳)
                          </button>

                          {!opp.has_technical_assessment && (
                            <button
                              onClick={() => {
                                setAssessmentForm((prev) => ({
                                  ...prev,
                                  property_id: opp.property_id,
                                  location_id: opp.location_id,
                                  problem_description: `Chronic recurrence of standing water observed at ${opp.location_code} (${opp.confirmed_recurrence_count} confirmed repeat issues).`,
                                }));
                                setShowAssessmentModal(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium rounded bg-cyan-700/80 hover:bg-cyan-600 text-cyan-100 block w-full text-center"
                            >
                              Assess Fix
                            </button>
                          )}

                          {opp.has_technical_assessment && !opp.has_repair_proposal && (
                            <button
                              onClick={() => {
                                setProposalForm((prev) => ({
                                  ...prev,
                                  property_id: opp.property_id,
                                  location_id: opp.location_id,
                                  assessment_id: opp.latest_assessment_id || "",
                                  title: `Permanent Solution for ${opp.location_code}`,
                                }));
                                setShowProposalModal(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium rounded bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 block w-full text-center"
                            >
                              Propose Repair
                            </button>
                          )}

                          {opp.has_repair_proposal && (
                            <button
                              onClick={() => {
                                if (opp.latest_proposal_id) {
                                  setSelectedProposalId(opp.latest_proposal_id);
                                  setActiveTab("financial");
                                }
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium rounded bg-purple-700/80 hover:bg-purple-600 text-purple-100 block w-full text-center"
                            >
                              Financial Model →
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: TECHNICAL ASSESSMENTS (SCREEN C) */}
      {/* ==================================================================== */}
      {activeTab === "assessments" && (
        <div className="space-y-6">
          <div className="card p-5 bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📐</span> Qualified Engineering Root-Cause Assessments
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                The software does not independently design engineering repairs. All proposed repairs must originate from
                in-person technical inspection by a qualified professional.
              </p>
            </div>
            <button
              onClick={() => setShowAssessmentModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow transition flex items-center gap-1.5"
            >
              <span>➕</span> Conduct Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessments.length === 0 ? (
              <div className="card p-8 col-span-2 text-center text-slate-400">
                No technical assessments recorded yet. Conduct an assessment from the button above or from an opportunity card.
              </div>
            ) : (
              assessments.map((a) => (
                <div key={a.id} className="card p-5 bg-slate-900/70 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono text-cyan-400">{a.id}</span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{a.location_name}</h3>
                      <div className="text-xs text-slate-400">
                        {a.location_code} • {a.property_name}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        a.feasibility === "repair_feasible"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : a.feasibility === "further_investigation_required"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-red-500/20 text-red-300 border border-red-500/40"
                      }`}
                    >
                      {a.feasibility.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="text-xs space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-slate-400 font-medium">Suspected Root Cause:</span>
                      <p className="text-slate-200 mt-0.5">{a.suspected_root_cause}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Recommended Action:</span>
                      <p className="text-slate-200 mt-0.5">{a.recommended_action}</p>
                    </div>
                    {a.safety_considerations && (
                      <div className="text-[11px] text-amber-400/90">
                        <span>⚠️ Safety: {a.safety_considerations}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                    <span>
                      Assessor: <span className="text-slate-200">{a.assessor_name}</span> ({a.assessor_role})
                    </span>
                    <span>Date: {a.assessment_date}</span>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setProposalForm((prev) => ({
                          ...prev,
                          property_id: a.property_id,
                          location_id: a.location_id,
                          assessment_id: a.id,
                          title: `Repair Solution for ${a.location_code}`,
                          responsible_assessor: a.assessor_name,
                          proposed_method: a.recommended_action,
                          safety_considerations: a.safety_considerations || "",
                        }));
                        setShowProposalModal(true);
                      }}
                      className="w-full py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
                    >
                      Create Proposal from this Assessment →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: PROPOSALS & QUOTATIONS (SCREEN D & E) */}
      {/* ==================================================================== */}
      {activeTab === "proposals" && (
        <div className="space-y-6">
          <div className="card p-5 bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📋</span> Capital Repair Proposals &amp; Supplier Quotations
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Store multi-contractor quotations with warranties, lead times, and scopes of work. The cheapest quote is
                not automatically the best option.
              </p>
            </div>
            <button
              onClick={() => setShowProposalModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition flex items-center gap-1.5"
            >
              <span>➕</span> New Repair Proposal
            </button>
          </div>

          <div className="space-y-4">
            {proposals.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                No repair proposals created yet. Create a proposal from a technical assessment.
              </div>
            ) : (
              proposals.map((prop) => (
                <div key={prop.id} className="card p-5 bg-slate-900/70 border border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-cyan-400">{prop.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            prop.status === "approved"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : prop.status === "implemented"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : prop.status === "ready_for_financial_review"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {prop.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">{prop.title}</h3>
                      <div className="text-xs text-slate-400">
                        Location: <span className="text-slate-200">{prop.location_code}</span> ({prop.location_name}) • {prop.property_name}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setTargetProposalForQuote(prop);
                          setShowQuotationModal(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
                      >
                        ➕ Attach Quote
                      </button>

                      <button
                        onClick={() => {
                          setSelectedProposalId(prop.id);
                          if (prop.quotations?.length > 0) {
                            setSelectedQuotationId(prop.quotations[0].id);
                          }
                          setActiveTab("financial");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow transition"
                      >
                        Model Scenarios →
                      </button>

                      {prop.status === "approved" && (
                        <button
                          onClick={() => {
                            setTargetProposalForWO(prop);
                            setShowWorkOrderModal(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded bg-purple-600 hover:bg-purple-500 text-white shadow transition"
                        >
                          🚀 Dispatch Work Order
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Proposal Specs Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-500">Proposed Method:</span>
                      <p className="text-slate-200 truncate">{prop.proposed_method}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Service Life:</span>
                      <p className="text-slate-200 font-semibold">{prop.expected_service_life_years} Years</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Maint. After Repair:</span>
                      <p className="text-emerald-400 font-semibold">৳{prop.expected_maintenance_after_per_month}/mo</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Downtime Interruption:</span>
                      <p className="text-slate-200">{prop.operational_interruption_hours} Hours</p>
                    </div>
                  </div>

                  {/* Competing Supplier Quotations */}
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                      <span>Verified Supplier Quotations ({prop.quotations?.length || 0})</span>
                      <span className="text-[11px] text-slate-500">ISO currency: BDT</span>
                    </div>

                    {prop.quotations?.length === 0 ? (
                      <div className="p-3 bg-slate-900/40 border border-dashed border-slate-800 rounded text-center text-xs text-slate-400">
                        No contractor quotes attached yet. Click &ldquo;Attach Quote&rdquo; to add verified pricing.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {prop.quotations.map((q) => (
                          <div
                            key={q.id}
                            className={`p-3 rounded-lg border text-xs space-y-2 transition ${
                              q.status === "selected"
                                ? "bg-emerald-950/20 border-emerald-500/50"
                                : "bg-slate-800/40 border-slate-700/60"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white truncate">{q.supplier_name}</span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                                  q.status === "selected"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-slate-700 text-slate-300"
                                }`}
                              >
                                {q.status}
                              </span>
                            </div>

                            <div className="text-lg font-mono font-bold text-amber-300">
                              ৳{q.quoted_amount.toLocaleString()}
                            </div>

                            <div className="text-[11px] text-slate-300 line-clamp-2">
                              {q.scope_of_work}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                              <span>Warranty: {q.warranty_months} Mo</span>
                              <span>Lead time: {q.lead_time_days} Days</span>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedProposalId(prop.id);
                                setSelectedQuotationId(q.id);
                                setActiveTab("financial");
                              }}
                              className="w-full py-1 text-[11px] font-semibold rounded bg-slate-700/80 hover:bg-cyan-700 text-slate-200 hover:text-white transition"
                            >
                              Run Comparison with this Quote
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: FINANCIAL COMPARISON & APPROVAL WORKFLOW (SCREEN F & G) */}
      {/* ==================================================================== */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          {/* Target Selector Bar */}
          <div className="card p-4 bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Select Repair Proposal:</label>
                <select
                  value={selectedProposalId}
                  onChange={(e) => setSelectedProposalId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none min-w-[240px]"
                >
                  {proposals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.location_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Contractor Quotation:</label>
                <select
                  value={selectedQuotationId}
                  onChange={(e) => setSelectedQuotationId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-amber-300 font-semibold focus:outline-none min-w-[220px]"
                >
                  {activeProposalObj?.quotations?.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.supplier_name} — ৳{q.quoted_amount.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Evaluation Period:</label>
                <div className="flex items-center gap-1">
                  {[6, 12, 24, 36].map((m) => (
                    <button
                      key={m}
                      onClick={() => setEvalPeriodMonths(m)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                        evalPeriodMonths === m
                          ? "bg-emerald-500 text-slate-950 shadow"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {m} Mo
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={handleSaveScenarioSnapshot}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition flex items-center gap-1.5"
              >
                <span>💾</span> Save Auditable Snapshot
              </button>
            </div>
          </div>

          {calculatingFinancials && (
            <div className="card p-8 text-center text-slate-400 animate-pulse">
              Computing 3-scenario financial comparison model...
            </div>
          )}

          {financialCalcResult && (
            <div className="space-y-6">
              {/* Baseline Summary Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Baseline Monthly Recurring Cost</div>
                  <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                    ৳{financialCalcResult.baseline_monthly_recurring_cost.toLocaleString()}/mo
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Based on {financialCalcResult.baseline_observation_months} months observed
                  </div>
                </div>

                <div className="card p-4 bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Quoted Capital Investment</div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    ৳{financialCalcResult.quoted_amount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{financialCalcResult.supplier_name}</div>
                </div>

                <div className="card p-4 bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Expected Simple Payback</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {financialCalcResult.expected_scenario.simple_payback_months
                      ? `${financialCalcResult.expected_scenario.simple_payback_months} Months`
                      : "No payback"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Under target engineering specs</div>
                </div>

                <div className="card p-4 bg-slate-900/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Total Status Quo Cost ({evalPeriodMonths} Mo)</div>
                  <div className="text-xl font-bold font-mono text-red-400 mt-1">
                    ৳{(financialCalcResult.baseline_monthly_recurring_cost * evalPeriodMonths).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">If continued without repair</div>
                </div>
              </div>

              {/* Mandatory Disclaimer Statement */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
                <span className="text-lg">⚖️</span>
                <p className="leading-relaxed">
                  <strong className="text-amber-100">DECISION-SUPPORT NOTICE:</strong> Estimated outcome — not guaranteed.
                  The calculations below use recorded visit invoices, human technical assessments, and contractor quotes.
                  Public safety and disease prevention obligations take priority over purely monetary payback.
                </p>
              </div>

              {/* 3 SCENARIO COMPARISON MATRIX (STEP 11) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* SCENARIO A: OPTIMISTIC */}
                <div className="card p-5 bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Scenario A
                      </span>
                      <h4 className="text-base font-bold text-white">Optimistic</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                      95% Reduction
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {financialCalcResult.optimistic_scenario.description}
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Monthly Savings:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ৳{financialCalcResult.optimistic_scenario.monthly_savings.toLocaleString()}/mo
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Simple Payback:</span>
                      <span className="font-bold text-white">
                        {financialCalcResult.optimistic_scenario.simple_payback_months} Months
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Total Spend with Fix ({evalPeriodMonths} Mo):</span>
                      <span className="font-mono text-slate-200">
                        ৳{financialCalcResult.optimistic_scenario.cumulative_cost_with_repair.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 bg-emerald-950/20 px-2 rounded font-semibold">
                      <span className="text-emerald-300">Net Estimated Savings:</span>
                      <span className="font-mono text-emerald-300">
                        ৳{financialCalcResult.optimistic_scenario.net_savings_over_period.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 italic">
                    {financialCalcResult.optimistic_scenario.assumptions_summary}
                  </div>
                </div>

                {/* SCENARIO B: EXPECTED */}
                <div className="card p-5 bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-500 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                        Scenario B (Target)
                      </span>
                      <h4 className="text-base font-bold text-white">Expected</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                      Target Specs
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {financialCalcResult.expected_scenario.description}
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Monthly Savings:</span>
                      <span className="font-mono font-bold text-cyan-400">
                        ৳{financialCalcResult.expected_scenario.monthly_savings.toLocaleString()}/mo
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Simple Payback:</span>
                      <span className="font-bold text-white">
                        {financialCalcResult.expected_scenario.simple_payback_months} Months
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Total Spend with Fix ({evalPeriodMonths} Mo):</span>
                      <span className="font-mono text-slate-200">
                        ৳{financialCalcResult.expected_scenario.cumulative_cost_with_repair.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 bg-cyan-950/20 px-2 rounded font-semibold">
                      <span className="text-cyan-300">Net Estimated Savings:</span>
                      <span className="font-mono text-cyan-300">
                        ৳{financialCalcResult.expected_scenario.net_savings_over_period.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 italic">
                    {financialCalcResult.expected_scenario.assumptions_summary}
                  </div>
                </div>

                {/* SCENARIO C: CAUTIOUS */}
                <div className="card p-5 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Scenario C
                      </span>
                      <h4 className="text-base font-bold text-white">Cautious</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                      Partial Fix
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {financialCalcResult.cautious_scenario.description}
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Monthly Savings:</span>
                      <span className="font-mono font-bold text-amber-400">
                        ৳{financialCalcResult.cautious_scenario.monthly_savings.toLocaleString()}/mo
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Simple Payback:</span>
                      <span className="font-bold text-white">
                        {financialCalcResult.cautious_scenario.simple_payback_months
                          ? `${financialCalcResult.cautious_scenario.simple_payback_months} Months`
                          : "N/A"}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Total Spend with Fix ({evalPeriodMonths} Mo):</span>
                      <span className="font-mono text-slate-200">
                        ৳{financialCalcResult.cautious_scenario.cumulative_cost_with_repair.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 bg-slate-800 px-2 rounded font-semibold">
                      <span className="text-slate-300">Net Estimated Savings:</span>
                      <span className="font-mono text-amber-400">
                        ৳{financialCalcResult.cautious_scenario.net_savings_over_period.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 italic">
                    {financialCalcResult.cautious_scenario.assumptions_summary}
                  </div>
                </div>
              </div>

              {/* VISUAL CUMULATIVE COMPARISON BAR CHART */}
              <div className="card p-5 bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Visual Spend Comparison Over {evalPeriodMonths} Months</span>
                  <span className="text-xs text-slate-400">BDT (৳)</span>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Status Quo */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Continued Cleanup (Status Quo)</span>
                      <span className="font-mono font-bold text-red-400">
                        ৳{(financialCalcResult.baseline_monthly_recurring_cost * evalPeriodMonths).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full rounded-full w-full" />
                    </div>
                  </div>

                  {/* Optimistic */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Scenario A (Optimistic Fix)</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ৳{financialCalcResult.optimistic_scenario.cumulative_cost_with_repair.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (financialCalcResult.optimistic_scenario.cumulative_cost_with_repair /
                                (financialCalcResult.baseline_monthly_recurring_cost * evalPeriodMonths || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Expected */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Scenario B (Expected Engineering Target)</span>
                      <span className="font-mono font-bold text-cyan-400">
                        ৳{financialCalcResult.expected_scenario.cumulative_cost_with_repair.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (financialCalcResult.expected_scenario.cumulative_cost_with_repair /
                                (financialCalcResult.baseline_monthly_recurring_cost * evalPeriodMonths || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Cautious */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Scenario C (Cautious Contingency)</span>
                      <span className="font-mono font-bold text-amber-400">
                        ৳{financialCalcResult.cautious_scenario.cumulative_cost_with_repair.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (financialCalcResult.cautious_scenario.cumulative_cost_with_repair /
                                (financialCalcResult.baseline_monthly_recurring_cost * evalPeriodMonths || 1)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================== */}
              {/* MANAGERIAL APPROVAL WORKFLOW PANEL (SCREEN G) */}
              {/* ========================================================== */}
              <div className="card p-5 bg-gradient-to-r from-slate-900/90 to-slate-900 border border-slate-700 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>⚖️</span> Managerial Review &amp; Budget Authorization
                    </h3>
                    <p className="text-xs text-slate-400">
                      The software cannot approve its own recommendations. An authorized manager must record the decision.
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                    Current Proposal: {activeProposalObj?.status}
                  </span>
                </div>

                {/* Role governance check alert */}
                {["worker", "maintenance_assessor"].includes(authSession?.user?.role) && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <span>⛔</span>
                    <span>
                      Your current role (<strong>{authSession?.user?.role}</strong>) is restricted from authorizing capital
                      expenditure. Switch to <strong>Property Manager</strong> or <strong>Finance Approver</strong> in the top
                      bar to approve budgets.
                    </span>
                  </div>
                )}

                <form onSubmit={handleRecordApproval} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Decision Action:</label>
                      <select
                        value={approvalDecision}
                        onChange={(e) => setApprovalDecision(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-xs text-white focus:outline-none"
                      >
                        <option value="approved">Approve Proposal &amp; Select Quote</option>
                        <option value="rejected">Reject Proposal</option>
                        <option value="more_info_required">Request Additional Info</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Approved Budget Ceiling (BDT):</label>
                      <input
                        type="number"
                        value={approvalBudget}
                        onChange={(e) => setApprovalBudget(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg text-xs font-mono text-amber-300 focus:outline-none"
                        placeholder="10000"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Reviewing Authority:</label>
                      <input
                        type="text"
                        disabled
                        value={`${authSession?.user?.display_name} (${authSession?.user?.role})`}
                        className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Mandatory Decision Rationale &amp; Audit Notes:
                    </label>
                    <textarea
                      rows="2"
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Explain the operational rationale, safety priority, and assumptions considered..."
                      className="w-full bg-slate-800 border border-slate-700 p-2.5 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-[11px] text-slate-400">
                      Approval records internal consent; procurement and purchase orders must adhere to local policy.
                    </div>
                    <button
                      type="submit"
                      disabled={submittingApproval}
                      className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition disabled:opacity-50"
                    >
                      {submittingApproval ? "Recording Decision..." : "Submit Formal Decision"}
                    </button>
                  </div>
                </form>

                {/* Decision History Audit Log */}
                {approvalHistoryList.length > 0 && (
                  <div className="pt-4 border-t border-slate-800">
                    <div className="text-xs font-semibold text-slate-300 mb-2">Managerial Audit Trail:</div>
                    <div className="space-y-2">
                      {approvalHistoryList.map((appr) => (
                        <div key={appr.id} className="p-3 bg-slate-950/60 rounded border border-slate-800 text-xs flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-white uppercase">{appr.decision}</span> by{" "}
                            <span className="text-cyan-300">{appr.reviewer_name}</span> ({appr.reviewer_role}) on{" "}
                            <span className="text-slate-400">{appr.decided_at?.slice(0, 10)}</span>
                            <p className="text-slate-300 mt-1">{appr.decision_notes}</p>
                          </div>
                          <div className="text-right font-mono text-amber-300 font-bold">
                            ৳{appr.approved_budget?.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: POST-REPAIR OUTCOMES & PORTFOLIO (SCREEN H & I) */}
      {/* ==================================================================== */}
      {activeTab === "outcomes" && (
        <div className="space-y-6">
          {/* POST-REPAIR TRACKING SECTION (SCREEN H) */}
          <div className="card p-5 bg-slate-900/60 border border-slate-800 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏁</span> After-Repair Outcome Monitoring
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                The feature does not stop at estimated savings. It tracks what actually happened using later follow-up
                inspections (Improvement 02) and actual post-repair maintenance expenses (Improvement 01 &amp; 03).
              </p>
            </div>

            <div className="space-y-4">
              {proposals.filter((p) => p.status === "implemented" || p.implemented_work_order_id).length === 0 ? (
                <div className="p-6 bg-slate-900/40 rounded border border-slate-800 text-center text-xs text-slate-400">
                  No implemented repairs found. When an approved proposal is dispatched and completed on site, post-repair
                  tracking is activated here.
                </div>
              ) : (
                proposals
                  .filter((p) => p.status === "implemented" || p.implemented_work_order_id)
                  .map((p) => {
                    const outcome = postRepairOutcomes[p.id];
                    return (
                      <div key={p.id} className="card p-5 bg-slate-950/70 border border-slate-800 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                          <div>
                            <span className="text-xs font-mono text-purple-400">Work Order: {p.implemented_work_order_id}</span>
                            <h3 className="text-base font-bold text-white">{p.title}</h3>
                            <div className="text-xs text-slate-400">
                              Location: <span className="text-slate-200">{p.location_code}</span> ({p.location_name}) • {p.property_name}
                            </div>
                          </div>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Completed &amp; Monitored
                          </span>
                        </div>

                        {outcome ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div className="p-3 bg-slate-900 rounded border border-slate-800">
                                <span className="text-slate-400">Approved Budget:</span>
                                <div className="text-sm font-bold font-mono text-white mt-0.5">
                                  ৳{outcome.approved_quote_amount?.toLocaleString()}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-900 rounded border border-slate-800">
                                <span className="text-slate-400">Actual Repair Spend:</span>
                                <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                                  ৳{outcome.actual_repair_cost?.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Variance: ৳{outcome.cost_variance > 0 ? `+${outcome.cost_variance}` : outcome.cost_variance}
                                </div>
                              </div>

                              <div className="p-3 bg-slate-900 rounded border border-slate-800">
                                <span className="text-slate-400">Follow-up Checks:</span>
                                <div className="text-sm font-bold text-cyan-300 mt-0.5">
                                  {outcome.post_repair_inspections_count} Inspected
                                </div>
                                <div className="text-[10px] text-emerald-400">
                                  {outcome.post_repair_recurrences_count} Recurrences
                                </div>
                              </div>

                              <div className="p-3 bg-slate-900 rounded border border-slate-800">
                                <span className="text-slate-400">Post-Repair Monthly Spend:</span>
                                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                                  ৳{outcome.observed_monthly_spend?.toLocaleString()}/mo
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Predicted: ~৳{outcome.predicted_monthly_savings}/mo saved
                                </div>
                              </div>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                              <span className="font-semibold text-slate-300">Operational Verification Status:</span>
                              <p className="text-slate-400 mt-1 leading-relaxed">{outcome.status_summary}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 animate-pulse">Loading outcome metrics...</div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* PORTFOLIO-LEVEL BREAKDOWN SECTION (SCREEN I) */}
          <div className="card p-5 bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🏛️</span> Organization &amp; Property Portfolio Economics
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Cross-property overview of maintenance spending, recurring opportunities, and capital allocations.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 border-b border-slate-700 font-semibold">
                  <tr>
                    <th className="p-3">Property Name</th>
                    <th className="p-3 text-center">Hazard Locations</th>
                    <th className="p-3 text-right">Historical Maintenance</th>
                    <th className="p-3 text-center">Intervention Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {portfolioStats?.property_breakdown?.map((pb) => (
                    <tr key={pb.property_id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-semibold text-white">{pb.property_name}</td>
                      <td className="p-3 text-center">{pb.location_count} locations</td>
                      <td className="p-3 text-right font-mono font-bold text-amber-300">
                        ৳{pb.maintenance_spend.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            pb.maintenance_spend > 5000
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {pb.maintenance_spend > 5000 ? "Active Capital Review" : "Routine Upkeep"}
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

      {/* ==================================================================== */}
      {/* MODAL 1: HISTORICAL MAINTENANCE COSTS & LOGGING (SCREEN B) */}
      {/* ==================================================================== */}
      {showCostModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card bg-slate-900 border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🧾</span> Maintenance Expense Records &amp; Breakdown
                </h3>
                <div className="text-xs text-slate-400">
                  {selectedLocationCost?.name} ({selectedLocationCost?.code})
                </div>
              </div>
              <button
                onClick={() => setShowCostModal(false)}
                className="text-slate-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            {loadingCostHistory ? (
              <div className="p-8 text-center text-slate-400 animate-pulse">Loading verified cost history...</div>
            ) : costHistoryData ? (
              <div className="space-y-4">
                {/* Cost KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500">Total Recorded Cost:</span>
                    <div className="text-base font-bold font-mono text-amber-300 mt-0.5">
                      ৳{costHistoryData.total_recorded_cost.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500">Service Visits:</span>
                    <div className="text-base font-bold text-white mt-0.5">
                      {costHistoryData.total_service_visits} Visits
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500">Avg Cost / Visit:</span>
                    <div className="text-base font-bold font-mono text-cyan-300 mt-0.5">
                      ৳{costHistoryData.average_cost_per_visit.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-500">Verified Portion:</span>
                    <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                      ৳{costHistoryData.verified_cost.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                {Object.keys(costHistoryData.cost_by_category || {}).length > 0 && (
                  <div className="p-3 bg-slate-950/40 rounded border border-slate-800/80">
                    <div className="text-xs font-semibold text-slate-400 mb-1.5">Expense Breakdown by Category:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(costHistoryData.cost_by_category).map(([cat, amt]) => (
                        <span
                          key={cat}
                          className="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-200 border border-slate-700"
                        >
                          <span className="capitalize">{cat.replace(/_/g, " ")}</span>:{" "}
                          <strong className="text-amber-300 font-mono">৳{amt.toLocaleString()}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action button to toggle new cost form */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-semibold text-white">Line Item Ledger ({costHistoryData.entries?.length || 0})</span>
                  <button
                    onClick={() => setShowNewCostForm(!showNewCostForm)}
                    className="px-3 py-1 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition"
                  >
                    {showNewCostForm ? "Cancel New Expense" : "➕ Log New Expense Line"}
                  </button>
                </div>

                {/* Form to log new cost entry */}
                {showNewCostForm && (
                  <form onSubmit={handleRecordCostEntry} className="p-4 bg-slate-950 rounded-lg border border-cyan-500/40 space-y-3 text-xs">
                    <div className="font-semibold text-cyan-300">Record Verified Maintenance Expense:</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Cost Category:</label>
                        <select
                          value={newCostForm.cost_category}
                          onChange={(e) => setNewCostForm({ ...newCostForm, cost_category: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                        >
                          <option value="labor">Labor</option>
                          <option value="contractor_fee">Contractor Fee</option>
                          <option value="materials">Materials &amp; Larvicide</option>
                          <option value="equipment_rental">Equipment Rental / Pump</option>
                          <option value="transportation">Transportation</option>
                          <option value="disposal">Disposal Costs</option>
                          <option value="other">Other Documented</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Amount (BDT):</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={newCostForm.amount}
                          onChange={(e) => setNewCostForm({ ...newCostForm, amount: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-amber-300 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Expense Date:</label>
                        <input
                          type="date"
                          required
                          value={newCostForm.expense_date}
                          onChange={(e) => setNewCostForm({ ...newCostForm, expense_date: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Invoice / Receipt Ref:</label>
                        <input
                          type="text"
                          placeholder="e.g. INV-2026-088"
                          value={newCostForm.invoice_ref}
                          onChange={(e) => setNewCostForm({ ...newCostForm, invoice_ref: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Verification Status:</label>
                        <select
                          value={newCostForm.status}
                          onChange={(e) => setNewCostForm({ ...newCostForm, status: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                        >
                          <option value="verified">Verified Invoice</option>
                          <option value="recorded">Recorded (Unverified)</option>
                          <option value="estimated">Estimated</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Description of Work / Billable Item:</label>
                      <input
                        type="text"
                        placeholder="Manual clearing, high pressure jetting, replacement parts..."
                        value={newCostForm.description}
                        onChange={(e) => setNewCostForm({ ...newCostForm, description: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition"
                    >
                      Save Expense Entry
                    </button>
                  </form>
                )}

                {/* Expense entries list */}
                <div className="overflow-x-auto max-h-60 border border-slate-800 rounded">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-400">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Description &amp; Inv Ref</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {costHistoryData.entries?.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-4 text-center text-slate-500">
                            No individual expense entries logged yet for this location.
                          </td>
                        </tr>
                      ) : (
                        costHistoryData.entries.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-800/40">
                            <td className="p-2.5 font-mono text-slate-300">{item.expense_date}</td>
                            <td className="p-2.5 capitalize">{item.cost_category.replace(/_/g, " ")}</td>
                            <td className="p-2.5">
                              <div>{item.description}</div>
                              {item.invoice_ref && (
                                <span className="text-[10px] text-cyan-400 font-mono">Ref: {item.invoice_ref}</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-amber-300">
                              ৳{item.amount.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  item.status === "verified"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-slate-700 text-slate-300"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: TECHNICAL ASSESSMENT FORM (SCREEN C) */}
      {/* ==================================================================== */}
      {showAssessmentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📐</span> Conduct Technical Engineering Assessment
                </h3>
                <p className="text-xs text-slate-400">
                  Assess physical root cause and determine if a permanent engineering repair is feasible.
                </p>
              </div>
              <button
                onClick={() => setShowAssessmentModal(false)}
                className="text-slate-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssessment} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Select Property:</label>
                  <select
                    value={assessmentForm.property_id}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, property_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                    required
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Location Code / ID:</label>
                  <input
                    type="text"
                    placeholder="e.g. LOC-MIR-01 or B-NORTH-DRAIN-07"
                    value={assessmentForm.location_id}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, location_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Assessor Name:</label>
                  <input
                    type="text"
                    value={assessmentForm.assessor_name}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, assessor_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Professional Role / Title:</label>
                  <input
                    type="text"
                    value={assessmentForm.assessor_role}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, assessor_role: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Inspection Date:</label>
                  <input
                    type="date"
                    value={assessmentForm.assessment_date}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, assessment_date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Current Problem Description:</label>
                <textarea
                  rows="2"
                  value={assessmentForm.problem_description}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, problem_description: e.target.value })}
                  placeholder="Chronic standing water ponding, recurring silt accumulation, etc..."
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Suspected Physical Root Cause:</label>
                <textarea
                  rows="2"
                  value={assessmentForm.suspected_root_cause}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, suspected_root_cause: e.target.value })}
                  placeholder="Structural sag, undersized drain pipe, negative slope gradient, lack of leaf guard..."
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Recommended Engineering Action:</label>
                <textarea
                  rows="2"
                  value={assessmentForm.recommended_action}
                  onChange={(e) => setAssessmentForm({ ...assessmentForm, recommended_action: e.target.value })}
                  placeholder="Re-grade gutter brackets to 1:50 slope, install UV PVC channel, replace trap..."
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Feasibility Outcome:</label>
                  <select
                    value={assessmentForm.feasibility}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, feasibility: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  >
                    <option value="repair_feasible">Repair May Be Feasible</option>
                    <option value="further_investigation_required">Further Investigation Required</option>
                    <option value="repair_not_recommended">Permanent Repair Not Currently Recommended</option>
                    <option value="no_feasible_repair">No Feasible Repair Identified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Safety Considerations:</label>
                  <input
                    type="text"
                    value={assessmentForm.safety_considerations}
                    onChange={(e) => setAssessmentForm({ ...assessmentForm, safety_considerations: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssessmentModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded shadow transition"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: REPAIR PROPOSAL FORM (SCREEN D) */}
      {/* ==================================================================== */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📋</span> Create Permanent Repair Proposal
                </h3>
                <p className="text-xs text-slate-400">
                  Register a structured permanent repair approach linked to a hazard location.
                </p>
              </div>
              <button
                onClick={() => setShowProposalModal(false)}
                className="text-slate-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProposal} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Property:</label>
                  <select
                    value={proposalForm.property_id}
                    onChange={(e) => setProposalForm({ ...proposalForm, property_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                    required
                  >
                    <option value="">-- Choose Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Hazard Location ID / Code:</label>
                  <input
                    type="text"
                    value={proposalForm.location_id}
                    onChange={(e) => setProposalForm({ ...proposalForm, location_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Proposal Title:</label>
                <input
                  type="text"
                  placeholder="e.g. Re-grade Parapet Gutter & Install Leaf Strainer"
                  value={proposalForm.title}
                  onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Proposed Engineering Method:</label>
                <textarea
                  rows="2"
                  value={proposalForm.proposed_method}
                  onChange={(e) => setProposalForm({ ...proposalForm, proposed_method: e.target.value })}
                  placeholder="Specific technical steps proposed by qualified engineer..."
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Expected Service Life (Years):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={proposalForm.expected_service_life_years}
                    onChange={(e) =>
                      setProposalForm({ ...proposalForm, expected_service_life_years: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Expected Ongoing Maint (৳/mo):</label>
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={proposalForm.expected_maintenance_after_per_month}
                    onChange={(e) =>
                      setProposalForm({
                        ...proposalForm,
                        expected_maintenance_after_per_month: e.target.value,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-emerald-400 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Operational Interruption (Hrs):</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={proposalForm.operational_interruption_hours}
                    onChange={(e) =>
                      setProposalForm({
                        ...proposalForm,
                        operational_interruption_hours: e.target.value,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Detailed Description:</label>
                <textarea
                  rows="2"
                  value={proposalForm.description}
                  onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })}
                  placeholder="Scope, structural requirements, objectives..."
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded shadow transition"
                >
                  Register Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: ATTACH SUPPLIER QUOTATION (SCREEN E) */}
      {/* ==================================================================== */}
      {showQuotationModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card bg-slate-900 border border-slate-700 w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📑</span> Attach Contractor / Supplier Quotation
                </h3>
                <div className="text-xs text-slate-400">Proposal: {targetProposalForQuote?.title}</div>
              </div>
              <button
                onClick={() => setShowQuotationModal(false)}
                className="text-slate-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddQuotation} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Contractor / Supplier Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Rapid Drainage & Vector Solutions Ltd."
                    value={quotationForm.supplier_name}
                    onChange={(e) => setQuotationForm({ ...quotationForm, supplier_name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Quoted Price (BDT):</label>
                  <input
                    type="number"
                    step="100"
                    min="1"
                    value={quotationForm.quoted_amount}
                    onChange={(e) => setQuotationForm({ ...quotationForm, quoted_amount: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-amber-300 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Scope of Work:</label>
                <textarea
                  rows="2"
                  value={quotationForm.scope_of_work}
                  onChange={(e) => setQuotationForm({ ...quotationForm, scope_of_work: e.target.value })}
                  placeholder="Material specifications, installation procedures..."
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Warranty (Months):</label>
                  <input
                    type="number"
                    min="0"
                    value={quotationForm.warranty_months}
                    onChange={(e) => setQuotationForm({ ...quotationForm, warranty_months: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Lead Time (Days):</label>
                  <input
                    type="number"
                    min="1"
                    value={quotationForm.lead_time_days}
                    onChange={(e) => setQuotationForm({ ...quotationForm, lead_time_days: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Validity Deadline:</label>
                  <input
                    type="date"
                    value={quotationForm.valid_until}
                    onChange={(e) => setQuotationForm({ ...quotationForm, valid_until: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuotationModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded shadow transition"
                >
                  Attach Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: LAUNCH WORK ORDER (SCREEN H) */}
      {/* ==================================================================== */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card bg-slate-900 border border-slate-700 w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🚀</span> Launch Implementation Work Order
                </h3>
                <div className="text-xs text-slate-400">
                  Connects to Improvement 03 Service Verification Engine
                </div>
              </div>
              <button
                onClick={() => setShowWorkOrderModal(false)}
                className="text-slate-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLaunchWorkOrder} className="space-y-4 text-xs">
              <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded text-purple-200">
                Approved Repair: <strong>{targetProposalForWO?.title}</strong>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Assigned Lead Technician / Worker:</label>
                <input
                  type="text"
                  value={workOrderForm.assigned_worker_name}
                  onChange={(e) =>
                    setWorkOrderForm({ ...workOrderForm, assigned_worker_name: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Responsible Supervisor:</label>
                <input
                  type="text"
                  value={workOrderForm.responsible_supervisor}
                  onChange={(e) =>
                    setWorkOrderForm({ ...workOrderForm, responsible_supervisor: e.target.value })
                  }
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Target Completion Due Date:</label>
                <input
                  type="date"
                  value={workOrderForm.due_date}
                  onChange={(e) => setWorkOrderForm({ ...workOrderForm, due_date: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWorkOrderModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={launchingWO}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded shadow transition"
                >
                  {launchingWO ? "Dispatching..." : "Dispatch Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
