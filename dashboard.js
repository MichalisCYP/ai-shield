// ============================================================
// AI Shield — Dashboard Script
// Renders analytics, logs table, and settings
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // ---- Tab Navigation ----
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      navItems.forEach((n) => n.classList.remove("active"));
      tabContents.forEach((t) => t.classList.remove("active"));
      item.classList.add("active");
      document.getElementById(`tab-${tab}`).classList.add("active");

      if (tab === "logs") renderLogs();
      if (tab === "overview") renderOverview();
      if (tab === "settings") loadSettings();
    });
  });

  // ---- Initial Load ----
  await loadUserInfo();
  await renderOverview();
  setupSettingsListeners();
  setupLogListeners();

  // ---- Time filter ----
  document
    .getElementById("time-filter")
    .addEventListener("change", () => renderOverview());
  document
    .getElementById("log-type-filter")
    .addEventListener("change", () => renderLogs());
});

// ============================================================
// User Info
// ============================================================

async function loadUserInfo() {
  const { settings } = await chrome.runtime.sendMessage({
    type: "GET_SETTINGS",
  });
  const name = settings?.userName || "Unknown";
  const role = settings?.userRole || "Employee";

  document.getElementById("sidebar-user-name").textContent = name;
  document.getElementById("sidebar-user-role").textContent = role;
  document.getElementById("sidebar-avatar").textContent = name
    .charAt(0)
    .toUpperCase();
}

// ============================================================
// Overview
// ============================================================

async function renderOverview() {
  const { logs = [] } = await chrome.runtime.sendMessage({ type: "GET_LOGS" });
  const filtered = filterByTime(logs);

  // Summary stats
  const visits = filtered.filter((l) => l.type === "ai_domain_visit");
  const warnings = filtered.filter((l) => l.popupTriggered === true);
  const redirects = filtered.filter((l) => l.type === "user_redirected");
  const pastes = filtered.filter((l) => l.type === "paste_detected");
  const continued = filtered.filter(
    (l) => l.type === "user_continued_unapproved",
  );

  document.getElementById("total-visits").textContent = visits.length;
  document.getElementById("total-warnings").textContent = warnings.length;
  document.getElementById("total-redirects").textContent = redirects.length;
  document.getElementById("total-pastes").textContent = pastes.length;
  document.getElementById("total-continued").textContent = continued.length;

  // Compliance rate: redirected / (redirected + continued)
  const totalDecisions = redirects.length + continued.length;
  const rate =
    totalDecisions > 0
      ? Math.round((redirects.length / totalDecisions) * 100)
      : 100;
  document.getElementById("compliance-rate").textContent = rate + "%";

  // Top tools chart (bar chart using CSS)
  renderTopToolsChart(filtered);

  // Category chart
  renderCategoryChart(filtered);

  // Recent activity
  renderRecentActivity(filtered.slice(-10).reverse());
}

function filterByTime(logs) {
  const filter = document.getElementById("time-filter").value;
  const now = new Date();

  return logs.filter((l) => {
    if (!l.timestamp) return false;
    const date = new Date(l.timestamp);
    if (filter === "today") {
      return date.toDateString() === now.toDateString();
    } else if (filter === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    } else if (filter === "month") {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return date >= monthAgo;
    }
    return true; // all
  });
}

function renderTopToolsChart(logs) {
  const container = document.getElementById("top-tools-chart");
  const visitLogs = logs.filter((l) => l.type === "ai_domain_visit");

  const toolCounts = {};
  visitLogs.forEach((l) => {
    const name = l.aiToolName || l.domain || "Unknown";
    toolCounts[name] = (toolCounts[name] || 0) + 1;
  });

  const sorted = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-chart">No data yet</div>';
    return;
  }

  container.innerHTML = sorted
    .map(
      ([name, count]) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(name)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
      </div>
      <div class="bar-count">${count}</div>
    </div>
  `,
    )
    .join("");
}

function renderCategoryChart(logs) {
  const container = document.getElementById("category-chart");
  const visitLogs = logs.filter((l) => l.type === "ai_domain_visit");

  const categoryCounts = {};
  visitLogs.forEach((l) => {
    const cat = l.aiCategory || "Unknown";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, c]) => sum + c, 0) || 1;

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-chart">No data yet</div>';
    return;
  }

  const colors = [
    "#1a73e8",
    "#e67e22",
    "#2ecc71",
    "#e74c3c",
    "#9b59b6",
    "#1abc9c",
    "#f39c12",
    "#34495e",
  ];

  container.innerHTML = `
    <div class="category-bars">
      ${sorted
        .map(
          ([name, count], i) => `
        <div class="category-row">
          <div class="category-color" style="background: ${colors[i % colors.length]}"></div>
          <div class="category-name">${escapeHtml(name)}</div>
          <div class="category-count">${count} (${Math.round((count / total) * 100)}%)</div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderRecentActivity(logs) {
  const container = document.getElementById("recent-activity");

  if (logs.length === 0) {
    container.innerHTML = '<div class="empty-chart">No recent activity</div>';
    return;
  }

  const typeLabels = {
    ai_domain_visit: "🌐 Domain Visit",
    paste_detected: "📋 Paste Detected",
    user_redirected: "🔀 Redirected",
    user_continued_unapproved: "🚫 Continued Unapproved",
    ai_input_interaction: "🎯 Input Interaction",
  };

  container.innerHTML = logs
    .map(
      (l) => `
    <div class="activity-item">
      <div class="activity-type">${typeLabels[l.type] || l.type}</div>
      <div class="activity-detail">
        <strong>${escapeHtml(l.aiToolName || l.domain || "")}</strong>
        ${l.domain ? `<span class="activity-domain">${escapeHtml(l.domain)}</span>` : ""}
      </div>
      <div class="activity-time">${formatTime(l.timestamp)}</div>
    </div>
  `,
    )
    .join("");
}

// ============================================================
// Logs Table
// ============================================================

async function renderLogs() {
  const { logs = [] } = await chrome.runtime.sendMessage({ type: "GET_LOGS" });
  const typeFilter = document.getElementById("log-type-filter").value;

  let filtered = logs;
  if (typeFilter !== "all") {
    filtered = logs.filter((l) => l.type === typeFilter);
  }

  // Reverse chronological
  filtered = [...filtered].reverse();

  const tbody = document.getElementById("logs-tbody");

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="empty-state">No logs match the filter.</td></tr>';
    return;
  }

  const typeLabels = {
    ai_domain_visit: "Domain Visit",
    paste_detected: "Paste Detected",
    user_redirected: "Redirected",
    user_continued_unapproved: "Continued",
    ai_input_interaction: "Input Interaction",
  };

  const typeBadgeClass = {
    ai_domain_visit: "badge-blue",
    paste_detected: "badge-orange",
    user_redirected: "badge-green",
    user_continued_unapproved: "badge-red",
    ai_input_interaction: "badge-purple",
  };

  tbody.innerHTML = filtered
    .map((l) => {
      const details = [];
      if (l.approved !== undefined)
        details.push(l.approved ? "Approved" : "Unapproved");
      if (l.confirmed !== undefined)
        details.push(l.confirmed ? "Confirmed" : "Not confirmed");
      if (l.fieldType) details.push(`Field: ${l.fieldType}`);
      if (l.contentLength) details.push(`${l.contentLength} chars`);
      if (l.interactionType) details.push(l.interactionType);
      if (l.redirectedTo) details.push(`→ ${l.redirectedTo}`);

      return `
      <tr>
        <td class="td-timestamp">${formatTimeFull(l.timestamp)}</td>
        <td><span class="badge ${typeBadgeClass[l.type] || "badge-gray"}">${typeLabels[l.type] || l.type}</span></td>
        <td>${escapeHtml(l.aiToolName || "-")}</td>
        <td class="td-domain">${escapeHtml(l.domain || "-")}</td>
        <td>${escapeHtml(l.userName || "-")}</td>
        <td class="td-details">${details.join(" · ")}</td>
      </tr>
    `;
    })
    .join("");
}

function setupLogListeners() {
  document.getElementById("export-btn").addEventListener("click", async () => {
    const { logs = [] } = await chrome.runtime.sendMessage({
      type: "EXPORT_LOGS",
    });
    downloadJson(
      logs,
      `ai-shield-logs-${new Date().toISOString().slice(0, 10)}.json`,
    );
  });

  document
    .getElementById("export-csv-btn")
    .addEventListener("click", async () => {
      const { logs = [] } = await chrome.runtime.sendMessage({
        type: "EXPORT_LOGS",
      });
      downloadCsv(
        logs,
        `ai-shield-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    });

  document
    .getElementById("clear-logs-btn")
    .addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure you want to clear all logs? This cannot be undone.",
        )
      ) {
        await chrome.runtime.sendMessage({ type: "CLEAR_LOGS" });
        renderLogs();
        renderOverview();
      }
    });
}

// ============================================================
// Settings
// ============================================================

async function loadSettings() {
  const { settings = {} } = await chrome.runtime.sendMessage({
    type: "GET_SETTINGS",
  });
  const { logs = [] } = await chrome.runtime.sendMessage({ type: "GET_LOGS" });

  document.getElementById("setting-enabled").checked =
    settings.enabled !== false;
  document.getElementById("setting-user-name").value = settings.userName || "";
  document.getElementById("setting-user-role").value =
    settings.userRole || "Employee";
  document.getElementById("setting-approved-url").value =
    settings.approvedAiUrl || "https://openrouter.ai/";
  document.getElementById("log-count-display").textContent =
    `Current entries: ${logs.length}`;
}

function setupSettingsListeners() {
  const save = async (data) => {
    await chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", data });
    await loadUserInfo();
  };

  document.getElementById("setting-enabled").addEventListener("change", (e) => {
    save({ enabled: e.target.checked });
  });

  document
    .getElementById("setting-user-name")
    .addEventListener("change", (e) => {
      save({ userName: e.target.value });
    });

  document
    .getElementById("setting-user-role")
    .addEventListener("change", (e) => {
      save({ userRole: e.target.value });
    });

  document
    .getElementById("setting-approved-url")
    .addEventListener("change", (e) => {
      save({ approvedAiUrl: e.target.value });
    });

  document
    .getElementById("setting-clear-logs")
    .addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure you want to clear all logs? This cannot be undone.",
        )
      ) {
        await chrome.runtime.sendMessage({ type: "CLEAR_LOGS" });
        await loadSettings();
      }
    });
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function formatTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function formatTimeFull(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString();
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(logs, filename) {
  if (logs.length === 0) return;

  const headers = [
    "timestamp",
    "type",
    "aiToolName",
    "domain",
    "userName",
    "userRole",
    "approved",
    "action",
  ];
  const rows = logs.map((l) =>
    headers.map((h) => `"${String(l[h] || "").replace(/"/g, '""')}"`).join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
