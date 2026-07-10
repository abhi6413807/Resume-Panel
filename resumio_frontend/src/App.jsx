import { useEffect, useMemo, useRef, useState } from "react";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { API_BASE, apiRequest } from "./api";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  roleApplied: "",
  totalExperience: "",
  currentCompany: "",
  expectedCTC: "",
  currentLocation: "",
  summary: "",
  skills: "",
  resumeUrl: "",
  status: "Applied",
};

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function resolveResumeUrl(candidateId) {
  if (!candidateId) {
    return "";
  }

  return `${API_BASE.replace(/\/api$/, "")}/api/public/candidates/${candidateId}/resume`;
}

function createHeading(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 220 },
  });
}

function createKeyValueParagraph(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value || "-" }),
    ],
    spacing: { after: 120 },
  });
}

async function exportCandidateListDocx(candidates) {
  const header = new TableRow({
    children: ["Name", "Role", "Email", "Phone", "Location", "Experience", "Skills"].map(
      (title) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: title, bold: true })] })],
        })
    ),
  });

  const rows = candidates.map(
    (candidate) =>
      new TableRow({
        children: [
          candidate.fullName,
          candidate.roleApplied,
          candidate.email,
          candidate.phone,
          candidate.currentLocation || "-",
          String(candidate.totalExperience || 0),
          (candidate.skills || []).join(", ") || "-",
        ].map(
          (text) =>
            new TableCell({
              children: [new Paragraph(String(text))],
            })
        ),
      })
  );

  const table = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: [header, ...rows],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          createHeading("Candidate List Export"),
          new Paragraph({ text: `Total candidates: ${candidates.length}`, spacing: { after: 220 } }),
          table,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob("candidate-list.docx", blob);
}

async function exportSingleCandidateDocx(candidate) {
  const interviewHeading = new Paragraph({
    text: "Interviews",
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120 },
  });

  const interviewParagraphs =
    (candidate.interviews || []).length > 0
      ? candidate.interviews.map(
          (item) =>
            new Paragraph({
              text: `${new Date(item.dateTime).toLocaleString()} | ${item.mode} | ${item.interviewer} | ${item.status}`,
              bullet: { level: 0 },
              spacing: { after: 80 },
            })
        )
      : [new Paragraph("No interviews available.")];

  const doc = new Document({
    sections: [
      {
        children: [
          createHeading("Candidate Profile"),
          createKeyValueParagraph("Full Name", candidate.fullName),
          createKeyValueParagraph("Role Applied", candidate.roleApplied),
          createKeyValueParagraph("Email", candidate.email),
          createKeyValueParagraph("Phone", candidate.phone),
          createKeyValueParagraph("Experience", `${candidate.totalExperience || 0} years`),
          createKeyValueParagraph("Current Company", candidate.currentCompany || "-"),
          createKeyValueParagraph("Expected CTC", candidate.expectedCTC || "-"),
          createKeyValueParagraph("Current Location", candidate.currentLocation || "-"),
          createKeyValueParagraph("Skills", (candidate.skills || []).join(", ") || "-"),
          createKeyValueParagraph("Summary", candidate.summary || "-"),
          interviewHeading,
          ...interviewParagraphs,
        ],
      },
    ],
  });

  const safeName = (candidate.fullName || "candidate").replace(/[^a-zA-Z0-9-_]/g, "-");
  const blob = await Packer.toBlob(doc);
  downloadBlob(`${safeName}.docx`, blob);
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [loginType, setLoginType] = useState("data_entry_operator"); // "admin" or "data_entry_operator"
  const [activeTab, setActiveTab] = useState("dashboard");
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    roleApplied: "Data Entry Operator",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [candidateProfile, setCandidateProfile] = useState(null);
  const [candidateInterviews, setCandidateInterviews] = useState([]);
  const [candidateNotifications, setCandidateNotifications] = useState([]);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [newEdu, setNewEdu] = useState({ degree: "", institute: "", year: "", grade: "" });
  const [newExp, setNewExp] = useState({ company: "", role: "", from: "", to: "", description: "" });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [candidateResumeFile, setCandidateResumeFile] = useState(null);

  const [loginForm, setLoginForm] = useState({
    email: "admin@example.com",
    password: "Admin@123",
  });
  const [candidateForm, setCandidateForm] = useState(initialForm);
  const [editingCandidateId, setEditingCandidateId] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [allCandidates, setAllCandidates] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const searchBoxRef = useRef(null);
  const [filters, setFilters] = useState({ role: "All", minExp: "", location: "All" });
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [interviewForm, setInterviewForm] = useState({
    dateTime: "",
    mode: "Online",
    interviewer: "",
    notes: "",
  });
  const [interviews, setInterviews] = useState([]);
  const [interviewStatusDrafts, setInterviewStatusDrafts] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [parsedCandidateData, setParsedCandidateData] = useState(null);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [isOperatorSettingsModalOpen, setIsOperatorSettingsModalOpen] = useState(false);
  const [operatorForm, setOperatorForm] = useState({ email: "", password: "" });

  const selectedCandidateName = useMemo(() => {
    const found = allCandidates.find((item) => item._id === selectedCandidate);
    return found ? found.fullName : "";
  }, [allCandidates, selectedCandidate]);

  const roleOptions = useMemo(() => {
    const roles = [...new Set(candidates.map((item) => item.roleApplied).filter(Boolean))];
    return ["All", ...roles];
  }, [candidates]);

  const locationOptions = useMemo(() => {
    const locations = [...new Set(candidates.map((item) => item.currentLocation).filter(Boolean))];
    return ["All", ...locations];
  }, [candidates]);

  // Build autocomplete suggestions from the full candidate pool, matching the
  // current query against names, roles, skills, companies and locations.
  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    const seen = new Set();
    const results = [];

    const addSuggestion = (value, type) => {
      if (!value) return;
      const label = String(value).trim();
      if (!label || !label.toLowerCase().includes(term)) return;
      const key = `${type}:${label.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ label, type });
    };

    allCandidates.forEach((candidate) => {
      addSuggestion(candidate.fullName, "Name");
      addSuggestion(candidate.roleApplied, "Role");
      addSuggestion(candidate.currentCompany, "Company");
      addSuggestion(candidate.currentLocation, "Location");
      (candidate.skills || []).forEach((skill) => addSuggestion(skill, "Skill"));
    });

    // Prefer matches that start with the term, then shorter labels.
    results.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(term) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(term) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.label.length - b.label.length;
    });

    return results.slice(0, 8);
  }, [search, allCandidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const byRole = filters.role === "All" || candidate.roleApplied === filters.role;
      const byLocation =
        filters.location === "All" || (candidate.currentLocation || "") === filters.location;
      const byExp =
        !filters.minExp || Number(candidate.totalExperience || 0) >= Number(filters.minExp);
      return byRole && byLocation && byExp;
    });
  }, [candidates, filters]);

  async function fetchCandidates(query = "") {
    const data = await apiRequest(`/candidates?search=${encodeURIComponent(query)}`);
    setCandidates(data);
    // Keep a stable, unfiltered pool to power search suggestions.
    if (!query.trim()) {
      setAllCandidates(data);
    }
    return data;
  }

  async function refreshSuggestionPool() {
    try {
      const data = await apiRequest(`/candidates?search=`);
      setAllCandidates(data);
    } catch {
      // Suggestions are non-critical; ignore failures.
    }
  }

  async function fetchInterviews() {
    const data = await apiRequest("/interviews");
    setInterviews(data);
  }

  const fetchCandidatePortalData = async () => {
    if (!token || role !== "candidate_portal_unused") return;
    try {
      setError("");
      const profile = await apiRequest("/data-entry-operator/profile");
      setCandidateProfile(profile);
      
      const interviewsList = await apiRequest("/data-entry-operator/interviews");
      setCandidateInterviews(interviewsList);

      const notifs = await apiRequest("/data-entry-operator/notifications");
      setCandidateNotifications(notifs);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        if (role === "admin" || role === "manager") {
          await Promise.all([fetchCandidates(), fetchInterviews()]);
        } else if (role === "data_entry_operator") {
          await fetchCandidates();
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, role]);

  useEffect(() => {
    const draftMap = {};
    interviews.forEach((item) => {
      draftMap[item._id] = item.status;
    });
    setInterviewStatusDrafts(draftMap);
  }, [interviews]);

  // Debounced live search: refetch from the backend as the user types.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!token || (role !== "admin" && role !== "manager")) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return; // Skip the initial render; data is loaded by the token effect.
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        setError("");
        await fetchCandidates(search);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [search, token]);

  // Close the suggestions dropdown when clicking outside the search box.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (loginType === "admin") {
      setLoginForm({ email: "admin@example.com", password: "Admin@123" });
    } else if (loginType === "manager") {
      setLoginForm({ email: "manager@example.com", password: "Manager@123" });
    } else {
      setLoginForm({ email: "", password: "" });
    }
  }, [loginType]);

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", "admin");
      setRole("admin");
      setToken(data.token);
      setMessage("Login successful");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleManagerLogin = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      const data = await apiRequest("/auth/manager-login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", "manager");
      setRole("manager");
      setToken(data.token);
      setMessage("Login successful");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOperatorLogin = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      const data = await apiRequest("/data-entry-operator/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", "data_entry_operator");
      setRole("data_entry_operator");
      setToken(data.token);
      setMessage("Login successful");
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchOperatorSettings = async () => {
    try {
      setError("");
      const data = await apiRequest("/auth/operator-settings");
      setOperatorForm({ email: data.email || "", password: "" });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateOperatorSettings = async (event) => {
    event.preventDefault();
    try {
      setError("");
      setMessage("");
      await apiRequest("/auth/operator-settings", {
        method: "POST",
        body: JSON.stringify(operatorForm),
      });
      setMessage("Operator credentials updated successfully");
      setIsOperatorSettingsModalOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendProfilesToManager = async () => {
    try {
      setError("");
      setMessage("");
      const response = await apiRequest("/candidates/send-to-manager", {
        method: "POST"
      });
      setMessage(response.message || "Profiles sent to the Manager successfully.");
      await fetchCandidates();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setToken("");
    setRole("");
    setCandidates([]);
    setInterviews([]);
    setCandidateProfile(null);
    setCandidateInterviews([]);
    setCandidateNotifications([]);
    setMessage("Logged out");
  };

  // Registration disabled

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setMessage("");
      const res = await apiRequest("/data-entry-operator/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      setMessage(`Reset token generated: ${res.resetToken}. Copy this token to reset your password.`);
      setResetToken(res.resetToken);
      setShowForgot(false);
      setShowReset(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setMessage("");
      await apiRequest(`/data-entry-operator/auth/reset-password/${resetToken}`, {
        method: "POST",
        body: JSON.stringify({ password: resetPasswordVal }),
      });
      setMessage("Password reset successful. Please login.");
      setShowReset(false);
      setResetToken("");
      setResetPasswordVal("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setMessage("");
      const response = await apiRequest("/data-entry-operator/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...candidateProfile,
          skills: Array.isArray(candidateProfile.skills) ? candidateProfile.skills.join(", ") : candidateProfile.skills
        }),
      });
      setCandidateProfile(response.candidate);
      setMessage("Profile saved successfully");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleProfilePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setError("");
        const photoUrl = reader.result;
        await apiRequest("/data-entry-operator/profile/photo", {
          method: "POST",
          body: JSON.stringify({ profilePhoto: photoUrl }),
        });
        setCandidateProfile((prev) => ({ ...prev, profilePhoto: photoUrl }));
        setMessage("Profile photo updated successfully");
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCandidateResumeUpload = async (e) => {
    e.preventDefault();
    if (!candidateResumeFile) {
      setError("Please select a resume file");
      return;
    }
    try {
      setError("");
      setMessage("");
      setIsUploadingResume(true);
      setUploadProgress(10);

      const formData = new FormData();
      formData.append("resume", candidateResumeFile);

      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 150);

      const response = await apiRequest("/data-entry-operator/resume/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);
      setUploadProgress(100);
      setCandidateProfile(response.candidate);
      setMessage("Resume uploaded and details auto-filled successfully!");
      setCandidateResumeFile(null);
      await fetchCandidatePortalData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploadingResume(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setMessage("");
      await apiRequest("/data-entry-operator/settings/password", {
        method: "PUT",
        body: JSON.stringify(changePasswordForm),
      });
      setMessage("Password changed successfully");
      setChangePasswordForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddEducation = () => {
    if (!newEdu.degree || !newEdu.institute) {
      alert("Degree and Institute are required");
      return;
    }
    setCandidateProfile((prev) => ({
      ...prev,
      education: [...(prev.education || []), newEdu],
    }));
    setNewEdu({ degree: "", institute: "", year: "", grade: "" });
  };

  const handleRemoveEducation = (index) => {
    setCandidateProfile((prev) => ({
      ...prev,
      education: (prev.education || []).filter((_, idx) => idx !== index),
    }));
  };

  const handleAddExperience = () => {
    if (!newExp.company || !newExp.role) {
      alert("Company and Role are required");
      return;
    }
    setCandidateProfile((prev) => ({
      ...prev,
      experience: [...(prev.experience || []), newExp],
    }));
    setNewExp({ company: "", role: "", from: "", to: "", description: "" });
  };

  const handleRemoveExperience = (index) => {
    setCandidateProfile((prev) => ({
      ...prev,
      experience: (prev.experience || []).filter((_, idx) => idx !== index),
    }));
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await apiRequest(`/data-entry-operator/notifications/${id}/read`, {
        method: "PATCH",
      });
      setCandidateNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      // Ignore
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const unread = candidateNotifications.filter((n) => !n.read);
      await Promise.all(
        unread.map((n) =>
          apiRequest(`/data-entry-operator/notifications/${n._id}/read`, {
            method: "PATCH",
          })
        )
      );
      setCandidateNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setMessage("All notifications marked as read");
    } catch (err) {
      setError(err.message);
    }
  };

  // ---------------- Render Views for Candidate Portal ----------------

  const renderCandidateDashboard = (completionPercentage) => {
    const upcomingInterviews = candidateInterviews.filter((i) => i.status === "Scheduled");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Welcome Banner */}
        <section className="card action-card">
          <h2>Dashboard Overview</h2>
          <p className="hint">View your application status, upcoming interviews, and keep your profile updated.</p>
        </section>

        {/* Metric Boxes */}
        <div className="stats-row">
          <article className="metric-box">
            <p>Profile Completion</p>
            <strong>{completionPercentage}%</strong>
            <div style={{ background: "var(--line)", height: "6px", borderRadius: "3px", marginTop: "8px", overflow: "hidden" }}>
              <div style={{ background: "var(--brand)", width: `${completionPercentage}%`, height: "100%" }}></div>
            </div>
          </article>
          <article className="metric-box">
            <p>Application Status</p>
            <strong style={{ fontSize: "18px", color: "var(--brand)" }}>
              {candidateProfile ? candidateProfile.status || "Applied" : "Applied"}
            </strong>
          </article>
          <article className="metric-box">
            <p>Upcoming Interviews</p>
            <strong>{upcomingInterviews.length}</strong>
          </article>
          <article className="metric-box">
            <p>Unread Notifications</p>
            <strong style={{ color: "var(--danger)" }}>
              {candidateNotifications.filter((n) => !n.read).length}
            </strong>
          </article>
        </div>

        {/* Main Dashboard Layout Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "var(--dashboard-grid-cols, 1fr 1fr)", gap: "16px" }} className="dashboard-layout">
          {/* Upcoming Interview Card */}
          <section className="card">
            <h3>Upcoming Interview</h3>
            {upcomingInterviews.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {upcomingInterviews.slice(0, 1).map((interview) => (
                  <div key={interview._id} style={{ background: "var(--bg-soft)", padding: "12px", borderRadius: "12px", border: "1px solid var(--line)" }}>
                    <p style={{ margin: "0 0 6px 0", fontWeight: "bold", fontSize: "15px" }}>{interview.interviewer} (Interviewer)</p>
                    <p style={{ margin: "0 0 6px 0", fontSize: "13px" }}>📅 {new Date(interview.dateTime).toLocaleString()}</p>
                    <p style={{ margin: "0 0 6px 0", fontSize: "13px" }}>📍 Mode: {interview.mode}</p>
                    {interview.notes && <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "var(--muted)", fontStyle: "italic" }}>Note: "{interview.notes}"</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">No interviews scheduled yet. Admin will update here.</p>
            )}
          </section>

          {/* Recent Activity / Notifications Preview */}
          <section className="card">
            <h3>Recent Notifications</h3>
            {candidateNotifications.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {candidateNotifications.slice(0, 3).map((n) => (
                  <div key={n._id} onClick={() => handleMarkNotificationRead(n._id)} style={{ display: "flex", gap: "8px", alignItems: "flex-start", cursor: "pointer", fontSize: "13px", padding: "6px 0", borderBottom: "1px solid #eee" }}>
                    <span style={{ height: "8px", width: "8px", borderRadius: "50%", background: n.read ? "transparent" : "var(--danger)", marginTop: "5px", flexShrink: 0 }}></span>
                    <div>
                      <p style={{ margin: 0, fontWeight: n.read ? "normal" : "bold" }}>{n.message}</p>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">No notifications yet.</p>
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderCandidateProfileTab = () => {
    if (!candidateProfile) return <p className="hint">Loading profile...</p>;

    return (
      <section className="card">
        <h2>My Professional Profile</h2>
        <form onSubmit={handleSaveProfile} className="form-grid" style={{ gridTemplateColumns: "var(--form-grid-cols, 1fr 1fr)" }}>
          <div className="form-field">
            <span>Full Name *</span>
            <input
              value={candidateProfile.fullName || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, fullName: e.target.value })}
              required
            />
          </div>
          <div className="form-field">
            <span>Email (Disabled)</span>
            <input
              type="email"
              value={candidateProfile.email || ""}
              disabled
              style={{ background: "var(--bg-soft)", cursor: "not-allowed" }}
            />
          </div>
          <div className="form-field">
            <span>Mobile Number *</span>
            <input
              value={candidateProfile.phone || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, phone: e.target.value })}
              required
            />
          </div>
          <div className="form-field">
            <span>Role Applied For</span>
            <input
              value={candidateProfile.roleApplied || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, roleApplied: e.target.value })}
            />
          </div>
          <div className="form-field">
            <span>Total Experience (Yrs)</span>
            <input
              type="number"
              value={candidateProfile.totalExperience || 0}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, totalExperience: Number(e.target.value) })}
            />
          </div>
          <div className="form-field">
            <span>Current Company</span>
            <input
              value={candidateProfile.currentCompany || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, currentCompany: e.target.value })}
            />
          </div>
          <div className="form-field">
            <span>Expected CTC</span>
            <input
              value={candidateProfile.expectedCTC || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, expectedCTC: e.target.value })}
            />
          </div>
          <div className="form-field">
            <span>Current Location</span>
            <input
              value={candidateProfile.currentLocation || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, currentLocation: e.target.value })}
            />
          </div>

          {/* Social Links */}
          <div className="form-field">
            <span>LinkedIn URL</span>
            <input
              placeholder="https://linkedin.com/in/username"
              value={candidateProfile.linkedin || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, linkedin: e.target.value })}
            />
          </div>
          <div className="form-field">
            <span>GitHub URL</span>
            <input
              placeholder="https://github.com/username"
              value={candidateProfile.github || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, github: e.target.value })}
            />
          </div>
          <div className="form-field form-field-full">
            <span>Portfolio Website</span>
            <input
              placeholder="https://myportfolio.com"
              value={candidateProfile.portfolio || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, portfolio: e.target.value })}
            />
          </div>

          <div className="form-field form-field-full">
            <span>Address</span>
            <input
              value={candidateProfile.address || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, address: e.target.value })}
            />
          </div>
          <div className="form-field">
            <span>City</span>
            <input
              value={candidateProfile.city || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, city: e.target.value })}
            />
          </div>
          <div className="form-field">
            <span>State</span>
            <input
              value={candidateProfile.state || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, state: e.target.value })}
            />
          </div>
          <div className="form-field form-field-full">
            <span>Country</span>
            <input
              value={candidateProfile.country || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, country: e.target.value })}
            />
          </div>

          <div className="form-field form-field-full">
            <span>Professional Summary</span>
            <textarea
              rows="4"
              value={candidateProfile.summary || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, summary: e.target.value })}
            />
          </div>

          <div className="form-field form-field-full">
            <span>Skills (comma separated, e.g. React, Node.js)</span>
            <input
              value={Array.isArray(candidateProfile.skills) ? candidateProfile.skills.join(", ") : candidateProfile.skills || ""}
              onChange={(e) => setCandidateProfile({ ...candidateProfile, skills: e.target.value })}
            />
          </div>

          {/* Education Sub-form */}
          <div className="form-field form-field-full" style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "12px" }}>
            <h3>Education History</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {(candidateProfile.education || []).map((edu, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", background: "var(--bg-soft)", padding: "8px 12px", borderRadius: "8px" }}>
                  <div>
                    <strong>{edu.degree}</strong> - <span>{edu.institute}</span> ({edu.year}) | Grade: {edu.grade || "-"}
                  </div>
                  <button type="button" className="danger-btn" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleRemoveEducation(idx)}>
                    Remove
                  </button>
                </div>
              ))}
              {(candidateProfile.education || []).length === 0 && <p className="hint">No education records added yet.</p>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "var(--edu-grid-cols, 1fr 1fr 80px 80px 80px)", gap: "8px" }} className="form-grid">
              <input placeholder="Degree" value={newEdu.degree} onChange={(e) => setNewEdu({ ...newEdu, degree: e.target.value })} />
              <input placeholder="Institute" value={newEdu.institute} onChange={(e) => setNewEdu({ ...newEdu, institute: e.target.value })} />
              <input placeholder="Year" value={newEdu.year} onChange={(e) => setNewEdu({ ...newEdu, year: e.target.value })} />
              <input placeholder="Grade" value={newEdu.grade} onChange={(e) => setNewEdu({ ...newEdu, grade: e.target.value })} />
              <button type="button" onClick={handleAddEducation}>Add</button>
            </div>
          </div>

          {/* Experience Sub-form */}
          <div className="form-field form-field-full" style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "12px" }}>
            <h3>Work Experience</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {(candidateProfile.experience || []).map((exp, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", background: "var(--bg-soft)", padding: "8px 12px", borderRadius: "8px" }}>
                  <div>
                    <strong>{exp.role}</strong> at <span>{exp.company}</span> ({exp.from} - {exp.to || "Present"})
                    {exp.description && <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>{exp.description}</p>}
                  </div>
                  <button type="button" className="danger-btn" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleRemoveExperience(idx)}>
                    Remove
                  </button>
                </div>
              ))}
              {(candidateProfile.experience || []).length === 0 && <p className="hint">No experience records added yet.</p>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "var(--exp-grid-cols, 1fr 1fr 100px 100px 1fr 80px)", gap: "8px" }} className="form-grid">
              <input placeholder="Company" value={newExp.company} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} />
              <input placeholder="Role" value={newExp.role} onChange={(e) => setNewExp({ ...newExp, role: e.target.value })} />
              <input placeholder="From" value={newExp.from} onChange={(e) => setNewExp({ ...newExp, from: e.target.value })} />
              <input placeholder="To" value={newExp.to} onChange={(e) => setNewExp({ ...newExp, to: e.target.value })} />
              <input placeholder="Desc" value={newExp.description} onChange={(e) => setNewExp({ ...newExp, description: e.target.value })} />
              <button type="button" onClick={handleAddExperience}>Add</button>
            </div>
          </div>

          <div className="form-field form-field-full" style={{ marginTop: "16px" }}>
            <button type="submit" style={{ width: "100%", padding: "14px" }}>Save Full Profile</button>
          </div>
        </form>
      </section>
    );
  };

  const renderCandidateResumeTab = () => {
    return (
      <section className="card">
        <h2>My Resume / CV Document</h2>
        <p className="hint">Upload a PDF or DOCX resume. Our parser will extract candidate details to automatically fill out your profile below.</p>
        
        {candidateProfile && candidateProfile.resumeUrl ? (
          <div style={{ background: "var(--bg-soft)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)", marginBottom: "20px" }}>
            <p style={{ margin: "0 0 10px 0", fontWeight: "bold" }}>Uploaded Resume File:</p>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "28px" }}>📄</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--ink)", wordBreak: "break-all" }}>
                  {candidateProfile.resumeUrl.replace("/uploads/resumes/", "")}
                </p>
              </div>
              <a 
                href={`${API_BASE.replace(/\/api$/, "")}/api/public/candidates/${candidateProfile._id}/resume`} 
                target="_blank" 
                rel="noreferrer"
                className="ghost-btn" 
                style={{ padding: "8px 12px", textDecoration: "none", fontSize: "13px", borderRadius: "10px" }}
              >
                Download Resume
              </a>
            </div>
          </div>
        ) : (
          <div style={{ padding: "20px", border: "2px dashed var(--line)", borderRadius: "12px", textAlign: "center", background: "#fafafa", marginBottom: "20px" }}>
            <p className="hint">No resume uploaded yet. Select a file below to upload.</p>
          </div>
        )}

        <form onSubmit={handleCandidateResumeUpload} className="form-grid">
          <div className="form-field">
            <span>Select PDF/DOCX Resume</span>
            <input 
              type="file" 
              accept=".pdf,.docx" 
              onChange={(e) => setCandidateResumeFile(e.target.files[0])} 
              required 
            />
          </div>

          {isUploadingResume && (
            <div style={{ margin: "10px 0" }}>
              <p className="hint" style={{ marginBottom: "6px" }}>Uploading and automatically extracting information... ({uploadProgress}%)</p>
              <div style={{ background: "var(--line)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ background: "var(--brand)", width: `${uploadProgress}%`, height: "100%", transition: "width 0.2s ease" }}></div>
              </div>
            </div>
          )}

          <button type="submit" disabled={isUploadingResume}>
            {candidateProfile && candidateProfile.resumeUrl ? "Replace Resume & Auto-fill Profile" : "Upload Resume & Auto-fill Profile"}
          </button>
        </form>
      </section>
    );
  };

  const renderCandidateInterviewsTab = () => {
    return (
      <section className="card">
        <h2>My Interviews Timeline</h2>
        {candidateInterviews.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Interviewer</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {candidateInterviews.map((interview) => (
                  <tr key={interview._id}>
                    <td data-label="Date & Time">{new Date(interview.dateTime).toLocaleString()}</td>
                    <td data-label="Interviewer">{interview.interviewer}</td>
                    <td data-label="Mode">
                      <span className="suggestion-type" style={{ background: "var(--bg-soft)", borderColor: "var(--line)" }}>
                        {interview.mode}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span style={{ 
                        fontWeight: "bold", 
                        color: interview.status === "Scheduled" ? "var(--brand)" : interview.status === "Completed" ? "var(--success)" : "var(--danger)" 
                      }}>
                        {interview.status}
                      </span>
                    </td>
                    <td data-label="Notes">{interview.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No interviews scheduled yet.</p>
        )}
      </section>
    );
  };

  const renderCandidateNotificationsTab = (unreadCount) => {
    return (
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2>My Notifications Center</h2>
          {unreadCount > 0 && (
            <button className="ghost-btn" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={handleMarkAllNotificationsRead}>
              Mark all as read
            </button>
          )}
        </div>

        {candidateNotifications.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {candidateNotifications.map((n) => (
              <div 
                key={n._id} 
                onClick={() => !n.read && handleMarkNotificationRead(n._id)}
                style={{ 
                  background: n.read ? "var(--surface)" : "var(--bg-soft)", 
                  padding: "12px", 
                  borderRadius: "12px", 
                  border: "1px solid var(--line)", 
                  cursor: n.read ? "default" : "pointer",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center"
                }}
              >
                <span style={{ 
                  height: "10px", 
                  width: "10px", 
                  borderRadius: "50%", 
                  background: n.read ? "transparent" : "var(--danger)",
                  flexShrink: 0
                }}></span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: n.read ? "normal" : "bold", fontSize: "14px" }}>{n.message}</p>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">No notifications yet.</p>
        )}
      </section>
    );
  };

  const renderCandidateSettingsTab = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Profile Picture Settings */}
        <section className="card">
          <h3>Change Profile Picture</h3>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", margin: "10px 0" }}>
            {candidateProfile && candidateProfile.profilePhoto ? (
              <img 
                src={candidateProfile.profilePhoto} 
                alt="Profile" 
                style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "3px solid var(--brand)" }} 
              />
            ) : (
              <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--bg-soft)", border: "2px dashed var(--line)", display: "grid", placeItems: "center", fontSize: "28px" }}>
                👤
              </div>
            )}
            <div className="form-field">
              <span>Select Profile Image</span>
              <input type="file" accept="image/*" onChange={handleProfilePhotoChange} />
            </div>
          </div>
        </section>

        {/* Change Password Form */}
        <section className="card">
          <h3>Update Account Password</h3>
          <form onSubmit={handleChangePassword} className="form-grid">
            <div className="form-field">
              <span>Current Password</span>
              <input
                type="password"
                value={changePasswordForm.currentPassword}
                onChange={(e) => setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <span>New Password</span>
              <input
                type="password"
                value={changePasswordForm.newPassword}
                onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                required
              />
            </div>
            <button type="submit">Update Password</button>
          </form>
        </section>
      </div>
    );
  };

  function openCreateModal() {
    setEditingCandidateId("");
    setCandidateForm(initialForm);
    setResumeFile(null);
    setIsCreateModalOpen(true);
  }

  function openEditModal(candidate) {
    setEditingCandidateId(candidate._id);
    setCandidateForm({
      fullName: candidate.fullName || "",
      email: candidate.email || "",
      phone: candidate.phone || "",
      roleApplied: candidate.roleApplied || "",
      totalExperience: String(candidate.totalExperience ?? ""),
      currentCompany: candidate.currentCompany || "",
      expectedCTC: candidate.expectedCTC || "",
      currentLocation: candidate.currentLocation || "",
      summary: candidate.summary || "",
      skills: (candidate.skills || []).join(", "),
      resumeUrl: candidate.resumeUrl || "",
      status: candidate.status || "Applied",
    });
    setResumeFile(null);
    setIsCreateModalOpen(true);
  }

  async function uploadResumeForCandidate(candidateId) {
    if (!resumeFile) return;

    const formData = new FormData();
    formData.append("resume", resumeFile);

    await apiRequest(`/candidates/${candidateId}/resume`, {
      method: "POST",
      body: formData,
    });
  }

  const handleCandidateSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");
      const payload = {
        ...candidateForm,
        totalExperience:
          candidateForm.totalExperience === "" ? 0 : Number(candidateForm.totalExperience),
      };

      let savedCandidate;

      if (editingCandidateId) {
        savedCandidate = await apiRequest(`/candidates/${editingCandidateId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        savedCandidate = await apiRequest("/candidates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await uploadResumeForCandidate(savedCandidate._id);

      setMessage(editingCandidateId ? "Candidate updated successfully" : "Candidate added successfully");
      setCandidateForm(initialForm);
      setEditingCandidateId("");
      setResumeFile(null);
      setIsCreateModalOpen(false);

      await Promise.all([fetchCandidates(search), fetchInterviews(), refreshSuggestionPool()]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCandidate = async (candidateId) => {
    const shouldDelete = window.confirm("Are you sure you want to delete this candidate profile?");
    if (!shouldDelete) return;

    try {
      setError("");
      await apiRequest(`/candidates/${candidateId}`, { method: "DELETE" });
      setMessage("Candidate deleted successfully");
      if (selectedCandidate === candidateId) {
        setSelectedCandidate("");
      }
      const promises = [fetchCandidates(search), refreshSuggestionPool()];
      if (role === "admin" || role === "manager") {
        promises.push(fetchInterviews());
      }
      await Promise.all(promises);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    try {
      setError("");
      await fetchCandidates(search);
    } catch (err) {
      setError(err.message);
    }
  };

  const applySuggestion = (label) => {
    setSearch(label);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  };

  const handleSearchKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === "Enter") {
      if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
        event.preventDefault();
        applySuggestion(suggestions[activeSuggestion].label);
      }
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
  };

  const handleScheduleInterview = async (event) => {
    event.preventDefault();
    if (!selectedCandidate) {
      setError("Please select a candidate");
      return;
    }

    try {
      setError("");
      await apiRequest(`/candidates/${selectedCandidate}/interviews`, {
        method: "POST",
        body: JSON.stringify(interviewForm),
      });
      setMessage("Interview scheduled successfully");
      setInterviewForm({ dateTime: "", mode: "Online", interviewer: "", notes: "" });
      setSelectedCandidate("");
      setIsScheduleModalOpen(false);
      await fetchInterviews();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateInterviewStatus = async (candidateId, interviewId) => {
    try {
      setError("");
      const status = interviewStatusDrafts[interviewId];
      await apiRequest(`/candidates/${candidateId}/interviews/${interviewId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Interview status updated successfully");
      await fetchInterviews();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportList = async () => {
    try {
      setError("");
      await exportCandidateListDocx(filteredCandidates);
    } catch (err) {
      setError("List export failed");
    }
  };

  const handleExportSingleCandidate = async (candidateId) => {
    try {
      setError("");
      const candidate = await apiRequest(`/candidates/${candidateId}`);
      await exportSingleCandidateDocx(candidate);
    } catch (err) {
      setError("Candidate export failed");
    }
  };

  const handleParseDocument = async (event) => {
    event.preventDefault();
    if (!documentFile) {
      setError("Please select a document");
      return;
    }

    try {
      setError("");
      setIsParsingDocument(true);
      const formData = new FormData();
      formData.append("document", documentFile);

      const response = await apiRequest("/documents/parse", {
        method: "POST",
        body: formData,
      });

      setParsedCandidateData(response.extractedData);
      setMessage("Document parsed successfully. Review and submit.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsingDocument(false);
    }
  };

  const handleCreateFromParsedDocument = async () => {
    if (!parsedCandidateData) return;

    try {
      setError("");
      await apiRequest("/documents/create-from-parsed", {
        method: "POST",
        body: JSON.stringify(parsedCandidateData),
      });
      setMessage("Candidate created from document successfully");
      setParsedCandidateData(null);
      setDocumentFile(null);
      setIsDocumentModalOpen(false);
      await fetchCandidates();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!token) {
    if (showReset) {
      return (
        <div className="page login-page">
          <div className="card login-card">
            <h1>Reset Password</h1>
            <form onSubmit={handleResetPassword} className="form-grid">
              <input
                type="password"
                placeholder="New Password"
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                required
              />
              <button type="submit">Reset Password</button>
            </form>
            <button className="ghost-btn" style={{marginTop: "8px", width: "100%"}} onClick={() => { setShowReset(false); setResetToken(""); }}>Back to Login</button>
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="success">{message}</p> : null}
          </div>
        </div>
      );
    }

    if (showForgot) {
      return (
        <div className="page login-page">
          <div className="card login-card">
            <h1>Forgot Password</h1>
            <p className="hint">Enter your email to request a reset token.</p>
            <form onSubmit={handleForgotPassword} className="form-grid">
              <input
                type="email"
                placeholder="Enter Email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              <button type="submit">Submit</button>
            </form>
            <button className="ghost-btn" style={{marginTop: "8px", width: "100%"}} onClick={() => setShowForgot(false)}>Back to Login</button>
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="success">{message}</p> : null}
          </div>
        </div>
      );
    }

    // Registration view removed

    // Default Login view with toggle between Admin and Operator
    return (
      <div className="page login-page">
        <div className="card login-card">
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", background: "var(--bg-soft)", padding: "4px", borderRadius: "10px" }}>
            <button
              type="button"
              className={loginType === "data_entry_operator" ? "" : "ghost-btn"}
              style={{ flex: 1, border: "none" }}
              onClick={() => { setLoginType("data_entry_operator"); setError(""); setMessage(""); }}
            >
              Data Entry Operator Login
            </button>
            <button
              type="button"
              className={loginType === "admin" ? "" : "ghost-btn"}
              style={{ flex: 1, border: "none" }}
              onClick={() => { setLoginType("admin"); setError(""); setMessage(""); }}
            >
              Admin Login
            </button>
            <button
              type="button"
              className={loginType === "manager" ? "" : "ghost-btn"}
              style={{ flex: 1, border: "none" }}
              onClick={() => { setLoginType("manager"); setError(""); setMessage(""); }}
            >
              Manager Login
            </button>
          </div>

          <h1>{loginType === "admin" ? "Resume Admin Login" : loginType === "manager" ? "Resume Manager Login" : "Data Entry Operator Login"}</h1>
          {loginType === "admin" ? (
            <p className="hint">Use default: admin@example.com / Admin@123</p>
          ) : loginType === "manager" ? (
            <p className="hint">Use default: manager@example.com / Manager@123</p>
          ) : (
            <p className="hint">Access your Data Entry Operator Dashboard</p>
          )}

          <form onSubmit={loginType === "admin" ? handleLogin : loginType === "manager" ? handleManagerLogin : handleOperatorLogin} className="form-grid">
            <input
              type="email"
              placeholder="Email Address"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
            />
            <button type="submit">Login</button>
          </form>

          {loginType === "data_entry_operator" && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", fontSize: "13px" }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowForgot(true); setError(""); setMessage(""); }}>Forgot Password?</a>
            </div>
          )}

          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
        </div>
      </div>
    );
  }

  if (role === "candidate_portal_unused") {
    const unreadCount = candidateNotifications.filter(n => !n.read).length;
    
    // Calculate profile completion %
    let filled = 0;
    let totalFields = 14;
    if (candidateProfile) {
      if (candidateProfile.fullName) filled++;
      if (candidateProfile.email) filled++;
      if (candidateProfile.phone) filled++;
      if (candidateProfile.address) filled++;
      if (candidateProfile.city) filled++;
      if (candidateProfile.state) filled++;
      if (candidateProfile.country) filled++;
      if (candidateProfile.skills && candidateProfile.skills.length > 0) filled++;
      if (candidateProfile.education && candidateProfile.education.length > 0) filled++;
      if (candidateProfile.experience && candidateProfile.experience.length > 0) filled++;
      if (candidateProfile.linkedin) filled++;
      if (candidateProfile.github) filled++;
      if (candidateProfile.portfolio) filled++;
      if (candidateProfile.profilePhoto) filled++;
    }
    const completionPercentage = Math.round((filled / totalFields) * 100);

    return (
      <div className="page dashboard-shell">
        <header className="topbar dashboard-topbar">
          <div>
            <p className="eyebrow">Candidate Portal</p>
            <h1>Welcome, {candidateProfile ? candidateProfile.fullName : "User"}</h1>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {candidateProfile && candidateProfile.profilePhoto && (
              <img 
                src={candidateProfile.profilePhoto} 
                alt="Profile" 
                style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--brand)" }} 
              />
            )}
            <button className="ghost-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {loading ? <p className="hint">Loading data...</p> : null}

        <main className="dashboard-layout candidate-main-layout">
          {/* Sidebar Menu */}
          <section className="card" style={{ height: "fit-content", padding: "12px" }}>
            <h3 style={{ padding: "0 10px", color: "var(--muted)", fontSize: "12px", textTransform: "uppercase" }}>Navigation</h3>
            <div className="nav-flex-container" style={{ gap: "6px" }}>
              <button
                type="button"
                className={activeTab === "dashboard" ? "tab-btn active" : "tab-btn"}
                onClick={() => { setActiveTab("dashboard"); setMessage(""); setError(""); }}
                style={{ textAlign: "left", width: "100%" }}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={activeTab === "profile" ? "tab-btn active" : "tab-btn"}
                onClick={() => { setActiveTab("profile"); setMessage(""); setError(""); }}
                style={{ textAlign: "left", width: "100%" }}
              >
                My Profile
              </button>
              <button
                type="button"
                className={activeTab === "resume" ? "tab-btn active" : "tab-btn"}
                onClick={() => { setActiveTab("resume"); setMessage(""); setError(""); }}
                style={{ textAlign: "left", width: "100%" }}
              >
                Resume Upload
              </button>
              <button
                type="button"
                className={activeTab === "interviews" ? "tab-btn active" : "tab-btn"}
                onClick={() => { setActiveTab("interviews"); setMessage(""); setError(""); }}
                style={{ textAlign: "left", width: "100%" }}
              >
                Interviews
              </button>
              <button
                type="button"
                className={activeTab === "notifications" ? "tab-btn active" : "tab-btn"}
                onClick={() => { setActiveTab("notifications"); setMessage(""); setError(""); }}
                style={{ textAlign: "left", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span style={{ background: "var(--danger)", color: "#fff", borderRadius: "50%", padding: "2px 6px", fontSize: "10px" }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                className={activeTab === "settings" ? "tab-btn active" : "tab-btn"}
                onClick={() => { setActiveTab("settings"); setMessage(""); setError(""); }}
                style={{ textAlign: "left", width: "100%" }}
              >
                Settings
              </button>
            </div>
          </section>

          {/* Active Tab View */}
          <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {activeTab === "dashboard" && renderCandidateDashboard(completionPercentage)}
            {activeTab === "profile" && renderCandidateProfileTab()}
            {activeTab === "resume" && renderCandidateResumeTab()}
            {activeTab === "interviews" && renderCandidateInterviewsTab()}
            {activeTab === "notifications" && renderCandidateNotificationsTab(unreadCount)}
            {activeTab === "settings" && renderCandidateSettingsTab()}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page dashboard-shell">
      
      <header className="topbar dashboard-topbar">
        <div>
          <p className="eyebrow">{role === "admin" ? "Recruitment Control Center" : role === "manager" ? "Management Control Center" : "Data Entry Control Center"}</p>
          <h1>{role === "admin" ? "Interview Resume Admin Panel" : role === "manager" ? "Interview Resume Manager Panel" : "Data Entry Operator Dashboard"}</h1>
        </div>
        <button className="ghost-btn" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="hint">Loading data...</p> : null}

      <main className="dashboard-layout">
        <section className="card action-card">
          <h2>Quick Actions</h2>
          <p className="hint">Create, schedule, edit, and export candidates from one dashboard.</p>
          <div className="action-grid">
            <button className="tab-btn active" type="button">
              Home & Candidate List
            </button>
            {role === "data_entry_operator" && (
              <button className={isCreateModalOpen ? "tab-btn active" : "tab-btn"} type="button" onClick={openCreateModal}>
                Create Candidate
              </button>
            )}
            {role === "manager" && (
              <button
                className={isScheduleModalOpen ? "tab-btn active" : "tab-btn"}
                type="button"
                onClick={() => {
                  fetchCandidates();
                  setIsScheduleModalOpen(true);
                }}
              >
                Schedule Interview
              </button>
            )}
            {role === "data_entry_operator" && (
              <button className={isDocumentModalOpen ? "tab-btn active" : "tab-btn"} type="button" onClick={() => setIsDocumentModalOpen(true)}>
                Import from Document (PDF/DOCX)
              </button>
            )}
            <button type="button" className="tab-btn" onClick={handleExportList}>
              Export Visible List (Word)
            </button>
            {role === "admin" && (
              <button
                className={isOperatorSettingsModalOpen ? "tab-btn active" : "tab-btn"}
                type="button"
                onClick={() => {
                  fetchOperatorSettings();
                  setIsOperatorSettingsModalOpen(true);
                }}
              >
                Operator Settings
              </button>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Home</h2>
          <form className="search-row" onSubmit={handleSearch} autoComplete="off">
            <div className="search-input-wrap" ref={searchBoxRef}>
              <input
                placeholder="Search by name, email, phone, role, company, location, skill"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleSearchKeyDown}
                role="combobox"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-autocomplete="list"
              />
              {search ? (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch("");
                    setShowSuggestions(false);
                    setActiveSuggestion(-1);
                  }}
                >
                  ×
                </button>
              ) : null}
              {showSuggestions && suggestions.length > 0 ? (
                <ul className="suggestions" role="listbox">
                  {suggestions.map((item, index) => (
                    <li
                      key={`${item.type}-${item.label}`}
                      role="option"
                      aria-selected={index === activeSuggestion}
                      className={index === activeSuggestion ? "suggestion active" : "suggestion"}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(item.label);
                      }}
                      onMouseEnter={() => setActiveSuggestion(index)}
                    >
                      <span className="suggestion-label">{item.label}</span>
                      <span className="suggestion-type">{item.type}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button type="submit">{isSearching ? "Searching…" : "Search"}</button>
          </form>

          <div className="filter-row">
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  Role: {role}
                </option>
              ))}
            </select>
            <select
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            >
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  Location: {location}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              placeholder="Min Experience"
              value={filters.minExp}
              onChange={(e) => setFilters({ ...filters, minExp: e.target.value })}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setFilters({ role: "All", minExp: "", location: "All" })}
            >
              Reset Filters
            </button>
            {role === "admin" && (
              <button
                type="button"
                onClick={handleSendProfilesToManager}
                style={{
                  background: "var(--brand)",
                  color: "#fff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "500",
                  marginLeft: "auto",
                }}
              >
                Send Profiles to the Manager
              </button>
            )}
          </div>

          <div className="stats-row">
            <article className="metric-box">
              <p>Total Candidates</p>
              <strong>{allCandidates.length}</strong>
            </article>
            <article className="metric-box">
              <p>{search.trim() ? "Matching Search" : "After Filters"}</p>
              <strong>{filteredCandidates.length}</strong>
            </article>
            {role === "manager" && (
              <article className="metric-box">
                <p>Total Interviews</p>
                <strong>{interviews.length}</strong>
              </article>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Experience</th>
                  <th>Location</th>
                  <th>Resume</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((candidate) => (
                  <tr key={candidate._id}>
                    <td data-label="Name">{candidate.fullName}</td>
                    <td data-label="Role">{candidate.roleApplied}</td>
                    <td data-label="Email">{candidate.email}</td>
                    <td data-label="Experience">{candidate.totalExperience || 0} yrs</td>
                    <td data-label="Location">{candidate.currentLocation || "-"}</td>
                    <td data-label="Resume">
                      {candidate.resumeUrl ? (
                        <a href={resolveResumeUrl(candidate._id)} target="_blank" rel="noreferrer">
                          View PDF
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        <button type="button" onClick={() => openEditModal(candidate)}>
                          {role === "data_entry_operator" ? "Edit" : "View"}
                        </button>
                        {(role === "admin" || role === "data_entry_operator") && (
                          <button type="button" className="danger-btn" onClick={() => handleDeleteCandidate(candidate._id)}>
                            Delete
                          </button>
                        )}
                        <button type="button" className="ghost-btn" onClick={() => handleExportSingleCandidate(candidate._id)}>
                          Export Word
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No candidates found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {role === "manager" && (
            <div className="upcoming-panel">
              <h3>Interview Tracker</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Date & Time</th>
                      <th>Mode</th>
                      <th>Interviewer</th>
                      <th>Status</th>
                      <th>Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.map((item) => (
                      <tr key={item._id}>
                        <td data-label="Candidate">{item.candidateName}</td>
                        <td data-label="Date & Time">{new Date(item.dateTime).toLocaleString()}</td>
                        <td data-label="Mode">{item.mode}</td>
                        <td data-label="Interviewer">{item.interviewer}</td>
                        <td data-label="Status">
                          <select
                            value={interviewStatusDrafts[item._id] || item.status}
                            onChange={(e) =>
                              setInterviewStatusDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))
                            }
                          >
                            <option value="Scheduled">Scheduled</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td data-label="Update">
                          <button
                            type="button"
                            onClick={() => handleUpdateInterviewStatus(item.candidateId, item._id)}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {interviews.length === 0 ? (
                      <tr>
                        <td colSpan={6}>No interviews scheduled.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {isCreateModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <h2>{role === "data_entry_operator" ? (editingCandidateId ? "Edit Candidate" : "Add Candidate") : "Candidate Details"}</h2>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingCandidateId("");
                  setResumeFile(null);
                }}
              >
                Close
              </button>
            </div>
            <form className="form-grid" onSubmit={handleCandidateSubmit}>
              <fieldset disabled={role !== "data_entry_operator"} style={{ border: "none", padding: 0, margin: 0, display: "contents" }}>
                {editingCandidateId && candidateForm.status && (
                  <div style={{ gridColumn: "span 2", marginBottom: "10px", padding: "8px", background: "var(--bg-soft)", borderRadius: "6px", fontSize: "14px" }}>
                    <strong>Status:</strong> {candidateForm.status}
                  </div>
                )}
                <label className="form-field">
                  <span>Full Name</span>
                  <input
                    value={candidateForm.fullName}
                    onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Phone</span>
                  <input
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Role Applied</span>
                  <input
                    value={candidateForm.roleApplied}
                    onChange={(e) => setCandidateForm({ ...candidateForm, roleApplied: e.target.value })}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Total Experience (Years)</span>
                  <input
                    type="number"
                    min="0"
                    value={candidateForm.totalExperience}
                    onChange={(e) => setCandidateForm({ ...candidateForm, totalExperience: e.target.value })}
                    placeholder="e.g. 3"
                  />
                </label>
                <label className="form-field">
                  <span>Current Company</span>
                  <input
                    value={candidateForm.currentCompany}
                    onChange={(e) => setCandidateForm({ ...candidateForm, currentCompany: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Expected CTC</span>
                  <input
                    value={candidateForm.expectedCTC}
                    onChange={(e) => setCandidateForm({ ...candidateForm, expectedCTC: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Current Location</span>
                  <input
                    value={candidateForm.currentLocation}
                    onChange={(e) => setCandidateForm({ ...candidateForm, currentLocation: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Skills (comma separated)</span>
                  <input
                    value={candidateForm.skills}
                    onChange={(e) => setCandidateForm({ ...candidateForm, skills: e.target.value })}
                    placeholder="React, Node.js, MongoDB"
                  />
                </label>
                {role === "data_entry_operator" && (
                  <label className="form-field">
                    <span>Upload Resume (PDF, max 5 MB)</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
                <label className="form-field form-field-full">
                  <span>Professional Summary</span>
                  <textarea
                    value={candidateForm.summary}
                    onChange={(e) => setCandidateForm({ ...candidateForm, summary: e.target.value })}
                    rows={4}
                  />
                </label>
              </fieldset>
              {role === "data_entry_operator" && (
                <button type="submit">{editingCandidateId ? "Update Candidate" : "Save Candidate"}</button>
              )}
            </form>
          </section>
        </div>
      ) : null}

      {isScheduleModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <h2>Schedule Interview</h2>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setIsScheduleModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form className="form-grid" onSubmit={handleScheduleInterview}>
              <label className="form-field form-field-full">
                <span>Candidate</span>
                <select
                  value={selectedCandidate}
                  onChange={(e) => setSelectedCandidate(e.target.value)}
                  required
                >
                  <option value="">Select Candidate</option>
                  {allCandidates.map((candidate) => (
                    <option key={candidate._id} value={candidate._id}>
                      {candidate.fullName} - {candidate.roleApplied}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Interview Date & Time</span>
                <input
                  type="datetime-local"
                  value={interviewForm.dateTime}
                  onChange={(e) => setInterviewForm({ ...interviewForm, dateTime: e.target.value })}
                  required
                />
              </label>
              <label className="form-field">
                <span>Mode</span>
                <select
                  value={interviewForm.mode}
                  onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Phone">Phone</option>
                </select>
              </label>
              <label className="form-field form-field-full">
                <span>Interviewer Name</span>
                <input
                  value={interviewForm.interviewer}
                  onChange={(e) => setInterviewForm({ ...interviewForm, interviewer: e.target.value })}
                  required
                />
              </label>
              <label className="form-field form-field-full">
                <span>Interview Notes</span>
                <textarea
                  rows={3}
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                />
              </label>
              <button type="submit">Schedule for {selectedCandidateName || "Candidate"}</button>
            </form>
          </section>
        </div>
      ) : null}

      {isDocumentModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <h2>{parsedCandidateData ? "Review Parsed Data" : "Import Candidate from Document"}</h2>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setIsDocumentModalOpen(false);
                  setParsedCandidateData(null);
                  setDocumentFile(null);
                }}
              >
                Close
              </button>
            </div>

            {!parsedCandidateData ? (
              <form onSubmit={handleParseDocument}>
                <label className="form-field form-field-full">
                  <span>Upload Document (PDF or DOCX)</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                    required
                  />
                </label>
                <p className="hint">We'll automatically extract candidate information from your document.</p>
                <button type="submit" disabled={isParsingDocument}>
                  {isParsingDocument ? "Parsing..." : "Parse Document"}
                </button>
              </form>
            ) : (
              <form>
                <p className="hint">Review extracted data and edit as needed:</p>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Full Name</span>
                    <input
                      value={parsedCandidateData.fullName}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          fullName: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={parsedCandidateData.email}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          email: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Phone</span>
                    <input
                      value={parsedCandidateData.phone}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          phone: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Role Applied</span>
                    <input
                      value={parsedCandidateData.roleApplied}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          roleApplied: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Experience (Years)</span>
                    <input
                      type="number"
                      min="0"
                      value={parsedCandidateData.totalExperience}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          totalExperience: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Current Company</span>
                    <input
                      value={parsedCandidateData.currentCompany}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          currentCompany: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Location</span>
                    <input
                      value={parsedCandidateData.currentLocation}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          currentLocation: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="form-field">
                    <span>Expected CTC</span>
                    <input
                      value={parsedCandidateData.expectedCTC}
                      onChange={(e) =>
                        setParsedCandidateData({
                          ...parsedCandidateData,
                          expectedCTC: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label className="form-field form-field-full">
                  <span>Skills (comma separated)</span>
                  <input
                    value={
                      Array.isArray(parsedCandidateData.skills)
                        ? parsedCandidateData.skills.join(", ")
                        : parsedCandidateData.skills
                    }
                    onChange={(e) =>
                      setParsedCandidateData({
                        ...parsedCandidateData,
                        skills: e.target.value.split(",").map((s) => s.trim()),
                      })
                    }
                  />
                </label>
                <label className="form-field form-field-full">
                  <span>Professional Summary</span>
                  <textarea
                    rows={3}
                    value={parsedCandidateData.summary}
                    onChange={(e) =>
                      setParsedCandidateData({
                        ...parsedCandidateData,
                        summary: e.target.value,
                      })
                    }
                  />
                </label>
                <div className="form-grid">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedCandidateData(null);
                      setDocumentFile(null);
                    }}
                    className="ghost-btn"
                  >
                    Upload Different Document
                  </button>
                  <button type="button" onClick={handleCreateFromParsedDocument}>
                    Save Candidate
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}

      {isOperatorSettingsModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <h2>Data Entry Operator Credentials</h2>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setIsOperatorSettingsModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form className="form-grid" onSubmit={handleUpdateOperatorSettings}>
              <label className="form-field form-field-full">
                <span>Email Address</span>
                <input
                  type="email"
                  value={operatorForm.email}
                  onChange={(e) => setOperatorForm({ ...operatorForm, email: e.target.value })}
                  required
                />
              </label>
              <label className="form-field form-field-full">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="Enter new password to update/reset"
                  value={operatorForm.password}
                  onChange={(e) => setOperatorForm({ ...operatorForm, password: e.target.value })}
                />
              </label>
              <button type="submit">Save Credentials</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
