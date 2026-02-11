// ============================================================
// AI Shield — Popup Script
// Controls the popup UI interactions
// ============================================================

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
    .getElementById("open-dashboard-btn")
    .addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
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
});
