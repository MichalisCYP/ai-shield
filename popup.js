// ============================================================
// AI Shield — Popup Script
// Controls the popup UI interactions
// ============================================================

import {
  clearAuthStorage,
  ensureValidStoredSession,
  fetchSupabaseUser,
  getStoredUser,
  getStoredSession,
  signInWithPassword,
  signOutRemote,
  signUpWithPassword,
  storeSession,
  storeUser,
} from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const enabledToggle = document.getElementById("enabled-toggle");
  const userName = document.getElementById("user-name");
  const userRole = document.getElementById("user-role");
  const statusIcon = document.getElementById("status-icon");
  const statusTitle = document.getElementById("status-title");
  const statusDetail = document.getElementById("status-detail");
  const statusIndicator = document.getElementById("status-indicator");
  const statVisits = document.getElementById("stat-visits");
  const statRedirects = document.getElementById("stat-redirects");
  const statPastes = document.getElementById("stat-pastes");
  const statSensitive = document.getElementById("stat-sensitive");
  const popupMonitoringBadge = document.getElementById(
    "popup-monitoring-badge",
  );
  const popupManagerControls = document.getElementById(
    "popup-manager-controls",
  );
  const popupDefaultLevel = document.getElementById("popup-default-level");

  // ---- Auth UI ----
  const authStatus = document.getElementById("auth-status");
  const authEmail = document.getElementById("auth-email");
  const authPassword = document.getElementById("auth-password");
  const signInBtn = document.getElementById("signin-btn");
  const signUpBtn = document.getElementById("signup-btn");
  const logoutBtn = document.getElementById("logout-btn");

  // ---- Load settings ----
  const { settings } = await chrome.runtime.sendMessage({
    type: "GET_SETTINGS",
  });
  enabledToggle.checked = settings?.enabled !== false;
  userName.value = settings?.userName || "";
  userRole.value = settings?.userRole || "Employee";

  // ---- Check current tab ----
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    const response = await chrome.runtime.sendMessage({
      type: "CHECK_AI_DOMAIN",
      url: tab.url,
    });

    if (response.isAi) {
      if (response.approved) {
        statusIcon.textContent = "✅";
        statusTitle.textContent = "Approved AI";
        statusDetail.textContent = `${response.match.name} is an approved tool.`;
        statusIndicator.className = "status-card status-approved";
      } else {
        statusIcon.textContent = "⚠️";
        statusTitle.textContent = "Unapproved AI";
        statusDetail.textContent = `${response.match.name} is not approved for sensitive data.`;
        statusIndicator.className = "status-card status-warning";
      }
    } else {
      statusIcon.textContent = "✅";
      statusTitle.textContent = "Safe";
      statusDetail.textContent = "This page is not a known AI tool.";
      statusIndicator.className = "status-card status-safe";
    }
  }

  // ---- Load stats ----
  await loadStats();

  // ---- Load monitoring level ----
  await loadMonitoringInfo();

  // ---- Load auth state ----
  await loadAuthState();

  // ---- Event listeners ----

  enabledToggle.addEventListener("change", async () => {
    await chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      data: { enabled: enabledToggle.checked },
    });
  });

  userName.addEventListener("change", async () => {
    await chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      data: { userName: userName.value },
    });
  });

  userRole.addEventListener("change", async () => {
    await chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      data: { userRole: userRole.value },
    });
  });

  document
    .getElementById("redirect-btn")
    .addEventListener("click", async () => {
      const { settings } = await chrome.runtime.sendMessage({
        type: "GET_SETTINGS",
      });
      const url = settings?.approvedAiUrl || "https://openrouter.ai/";
      chrome.tabs.create({ url });
    });

  document
    .getElementById("export-logs-link")
    .addEventListener("click", async (e) => {
      e.preventDefault();
      const { logs } = await chrome.runtime.sendMessage({
        type: "EXPORT_LOGS",
      });
      const blob = new Blob([JSON.stringify(logs, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-shield-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

  signInBtn?.addEventListener("click", async () => {
    try {
      authStatus.textContent = "Signing in...";
      const email = String(authEmail?.value || "").trim();
      const password = String(authPassword?.value || "");
      if (!email || !password) {
        authStatus.textContent = "Enter email + password.";
        return;
      }

      const { session, user } = await signInWithPassword({ email, password });
      await storeSession(session);
      if (user) await storeUser(user);
      authPassword.value = "";

      // Reinitialize from Supabase to fetch allowed domains and monitoring level
      await chrome.runtime.sendMessage({ type: "REINITIALIZE_FROM_SUPABASE" });

      await loadAuthState();
    } catch (e) {
      authStatus.textContent = e?.message || "Sign-in failed.";
    }
  });

  signUpBtn?.addEventListener("click", async () => {
    try {
      authStatus.textContent = "Signing up...";
      const email = String(authEmail?.value || "").trim();
      const password = String(authPassword?.value || "");
      if (!email || !password) {
        authStatus.textContent = "Enter email + password.";
        return;
      }

      const { session, user } = await signUpWithPassword({ email, password });
      if (user) await storeUser(user);
      if (session) {
        await storeSession(session);
        authPassword.value = "";
        await loadAuthState();
      } else {
        authStatus.textContent =
          "Check your email to confirm your account, then sign in.";
      }
    } catch (e) {
      authStatus.textContent = e?.message || "Sign-up failed.";
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    const session = await getStoredSession();
    await signOutRemote(session?.access_token);
    await clearAuthStorage();
    await loadAuthState();
  });

  // ---- Helpers ----

  async function loadStats() {
    const { logs = [] } = await chrome.runtime.sendMessage({
      type: "GET_LOGS",
    });
    const today = new Date().toISOString().slice(0, 10);

    const todayLogs = logs.filter((l) => l.timestamp?.startsWith(today));
    const visits = todayLogs.filter((l) => l.type === "ai_domain_visit").length;
    const redirects = todayLogs.filter(
      (l) => l.type === "user_redirected",
    ).length;
    const pastes = todayLogs.filter((l) => l.type === "paste_detected").length;
    const sensitive = todayLogs.filter(
      (l) => l.type === "sensitive_data_detected",
    ).length;

    statVisits.textContent = visits;
    statRedirects.textContent = redirects;
    statPastes.textContent = pastes;
    statSensitive.textContent = sensitive;
  }

  async function loadMonitoringInfo() {
    const { monitoringConfig = {} } = await chrome.runtime.sendMessage({
      type: "GET_MONITORING_CONFIG",
    });
    const level = monitoringConfig.defaultLevel || "lowest";

    // Update badge
    if (level === "highest") {
      popupMonitoringBadge.textContent = "🔴 Highest";
      popupMonitoringBadge.className = "monitoring-badge monitoring-highest";
    } else {
      popupMonitoringBadge.textContent = "🟢 Lowest";
      popupMonitoringBadge.className = "monitoring-badge monitoring-lowest";
    }

    // If manager, show quick-change control
    const isManager = settings?.userRole === "Manager";
    if (isManager) {
      popupManagerControls.style.display = "flex";
      popupDefaultLevel.value = level;
      popupDefaultLevel.addEventListener("change", async () => {
        await chrome.runtime.sendMessage({
          type: "UPDATE_MONITORING_CONFIG",
          data: { defaultLevel: popupDefaultLevel.value },
        });
        await loadMonitoringInfo();
      });
    } else {
      popupManagerControls.style.display = "none";
    }
  }

  async function loadAuthState() {
    const { session } = await ensureValidStoredSession();
    const signupBtn = document.getElementById("signup-btn");
    const signinBtn = document.getElementById("signin-btn");
    const authEmail = document.getElementById("auth-email");
    const authPassword = document.getElementById("auth-password");
    const authEmailLabel = document.querySelector("label[for='auth-email']");
    const authPasswordLabel = document.querySelector(
      "label[for='auth-password'",
    );
    const authEmailGroup = document.querySelector(
      ".input-group:nth-of-type(1)",
    );
    const authPasswordGroup = document.querySelector(
      ".input-group:nth-of-type(2)",
    );

    if (session) {
      logoutBtn.style.display = "inline-flex";
      signupBtn.style.display = "none"; // Hide sign-up button when logged in
      signinBtn.style.display = "none"; // Hide sign-in button when logged in
      if (authEmailGroup) authEmailGroup.style.display = "none"; // Hide email input group when logged in
      if (authPasswordGroup) authPasswordGroup.style.display = "none"; // Hide password input group when logged in
      if (authEmail) authEmail.style.display = "none"; // Hide email input field when logged in
      if (authPassword) authPassword.style.display = "none"; // Hide password input field when logged in
      if (authEmailLabel) authEmailLabel.style.display = "none"; // Hide email label when logged in
      if (authPasswordLabel) authPasswordLabel.style.display = "none"; // Hide password label when logged in
    } else {
      authStatus.textContent = "Not logged in.";
      logoutBtn.style.display = "none";
      signupBtn.style.display = "inline-flex"; // Show sign-up button when logged out
      signinBtn.style.display = "inline-flex"; // Show sign-in button when logged out
      if (authEmailGroup) authEmailGroup.style.display = "block"; // Show email input group
      if (authPasswordGroup) authPasswordGroup.style.display = "block"; // Show password input group
      if (authEmail) authEmail.style.display = "block"; // Show email input field
      if (authPassword) authPassword.style.display = "block"; // Show password input field
      if (authEmailLabel) authEmailLabel.style.display = "block"; // Show email label when logged out
      if (authPasswordLabel) authPasswordLabel.style.display = "block"; // Show password label when logged out
    }

    // Try cached user first, else fetch
    let user = await getStoredUser();
    if (!user) {
      try {
        user = await fetchSupabaseUser(session.access_token);
        await storeUser(user);
      } catch {
        // If token is valid enough for refresh, keep session; otherwise user stays unknown
        user = null;
      }
    }

    const email = user?.email || user?.user_metadata?.email;
    authStatus.textContent = email ? `Logged in as ${email}` : "Logged in.";
  }
});
