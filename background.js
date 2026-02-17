// ============================================================
// AI Shield — Background Service Worker
// Monitors navigation, manages state, handles logging
// ============================================================

import {
  AI_DOMAINS,
  AI_TLD_PATTERNS,
  APPROVED_DOMAINS,
  APPROVED_AI_URL,
  MAX_LOG_ENTRIES,
  DEFAULT_MONITORING_LEVEL,
  MONITORING_LEVELS,
  MANAGER_ROLES,
  SENSITIVE_DATA_PATTERNS,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "./config.js";

import { getStoredSession, getStoredUser } from "./auth.js";

// ---- Initialisation ----

chrome.runtime.onInstalled.addListener(async () => {
  // Initialise storage
  const existing = await chrome.storage.local.get([
    "logs",
    "settings",
    "monitoringConfig",
  ]);
  if (!existing.logs) {
    await chrome.storage.local.set({ logs: [] });
  }
  if (!existing.settings) {
    await chrome.storage.local.set({
      settings: {
        enabled: true,
        userName: "Unknown User",
        userRole: "Employee",
        approvedAiUrl: APPROVED_AI_URL,
      },
    });
  }
  if (!existing.monitoringConfig) {
    await chrome.storage.local.set({
      monitoringConfig: {
        defaultLevel: DEFAULT_MONITORING_LEVEL,
        siteOverrides: {}, // { "domain.com": "highest" }
      },
    });
  }

  // Set badge
  chrome.action.setBadgeBackgroundColor({ color: "#1a73e8" });
  chrome.action.setBadgeText({ text: "ON" });

  // Fetch data from Supabase
  await initializeFromSupabase();
});

// Fetch allowed domains and user monitoring level from Supabase
async function initializeFromSupabase() {
  try {
    const session = await getStoredSession();
    if (!session?.access_token) return;

    const user = await getStoredUser();
    if (!user?.id) return;

    // Fetch allowed domains
    const domainsRes = await fetch(`${SUPABASE_URL}/rest/v1/domains?select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (domainsRes.ok) {
      const domains = await domainsRes.json();
      await chrome.storage.local.set({ allowedDomains: domains });
    }

    // Fetch user's monitoring level from profile
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=monitoring_level`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );

    if (profileRes.ok) {
      const profiles = await profileRes.json();
      if (profiles.length > 0) {
        const rawLevel =
          profiles[0].monitoring_level || DEFAULT_MONITORING_LEVEL;
        const monitoringLevel = normalizeMonitoringLevel(rawLevel);
        await chrome.storage.local.set({
          monitoringConfig: {
            defaultLevel: monitoringLevel,
            siteOverrides: {},
          },
        });
      }
    }
  } catch (error) {
    console.error("AI Shield: Failed to initialize from Supabase", error);
  }
}

// Send log to Supabase
async function sendLogToSupabase(logEntry) {
  try {
    const session = await getStoredSession();
    if (!session?.access_token) return;

    const user = await getStoredUser();
    const userId = user?.id || null;

    const supabaseLog = {
      user_id: userId,
      domain: logEntry.domain || null,
      ai_tool_name: logEntry.aiToolName || null,
      ai_category: logEntry.aiCategory || null,
      url: logEntry.url || null,
      log_type: logEntry.type || null,
      action: logEntry.action || null,
      metadata: {
        userName: logEntry.userName,
        userRole: logEntry.userRole,
        approved: logEntry.approved,
        tabId: logEntry.tabId,
        popupTriggered: logEntry.popupTriggered,
        confirmed: logEntry.confirmed,
        redirectedTo: logEntry.redirectedTo,
        fieldType: logEntry.fieldType,
        contentLength: logEntry.contentLength,
        interactionType: logEntry.interactionType,
        detectedTypes: logEntry.detectedTypes,
        severity: logEntry.severity,
      },
    };

    await fetch(`${SUPABASE_URL}/rest/v1/logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(supabaseLog),
    });
  } catch (error) {
    console.error("AI Shield: Failed to send log to Supabase", error);
  }
}

// ---- Helpers ----

function matchAiDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    // Merge custom domains from storage
    // This is async, so we need to handle it in the message handler
    // For sync use, fallback to AI_DOMAINS only
    const explicit = AI_DOMAINS.find(
      (d) => hostname === d.domain || hostname.endsWith("." + d.domain),
    );
    if (explicit) return explicit;

    // 2. Fall back to TLD wildcard patterns (e.g. any .ai domain)
    const tldMatch = AI_TLD_PATTERNS.find((p) => hostname.endsWith(p.tld));
    if (tldMatch) {
      return {
        domain: hostname,
        name: tldMatch.name,
        category: tldMatch.category,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Normalize monitoring level values coming from DB or older clients
function normalizeMonitoringLevel(level) {
  if (!level) return DEFAULT_MONITORING_LEVEL;
  const l = String(level).toLowerCase();
  // Accept both DB-side values (e.g. 'low') and extension keys ('lowest')
  if (l === "low" || l === "lowest") return "lowest";
  if (l === "high" || l === "highest") return "highest";
  if (l === "medium") return "medium";
  // Fallback to configured default
  return DEFAULT_MONITORING_LEVEL;
}

function isApprovedDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return APPROVED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
  } catch {
    return false;
  }
}

// Check if domain is approved (checks both hardcoded and Supabase domains)
async function isApprovedDomainAsync(url) {
  try {
    const hostname = new URL(url).hostname;

    // Check hardcoded approved domains
    const hardcodedApproved = APPROVED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith("." + d),
    );
    if (hardcodedApproved) return true;

    // Check Supabase allowed domains
    const { allowedDomains = [] } =
      await chrome.storage.local.get("allowedDomains");
    return allowedDomains.some(
      (d) => hostname === d.domain || hostname.endsWith("." + d.domain),
    );
  } catch {
    return false;
  }
}

// Get effective monitoring level for a domain
async function getMonitoringLevelForDomain(domain) {
  const { monitoringConfig = {} } =
    await chrome.storage.local.get("monitoringConfig");
  const overrides = monitoringConfig.siteOverrides || {};
  const raw =
    overrides[domain] ||
    monitoringConfig.defaultLevel ||
    DEFAULT_MONITORING_LEVEL;
  return normalizeMonitoringLevel(raw);
}

// Check whether the current user has manager privileges
async function isManager() {
  const { settings = {} } = await chrome.storage.local.get("settings");
  return MANAGER_ROLES.includes(settings.userRole);
}

// ---- Logging ----

async function addLog(entry) {
  const { logs = [] } = await chrome.storage.local.get("logs");
  const { settings = {} } = await chrome.storage.local.get("settings");

  const logEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userName: settings.userName || "Unknown",
    userRole: settings.userRole || "Employee",
    ...entry,
  };

  logs.push(logEntry);

  // Trim to max
  while (logs.length > MAX_LOG_ENTRIES) {
    logs.shift();
  }

  await chrome.storage.local.set({ logs });

  // Send to Supabase
  await sendLogToSupabase(logEntry);

  return logEntry;
}

// ---- Navigation Monitoring ----

chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only main frame
  if (details.frameId !== 0) return;

  const { settings = {} } = await chrome.storage.local.get("settings");
  if (!settings.enabled) return;

  const aiMatch = matchAiDomain(details.url);
  if (!aiMatch) return;

  const approved = await isApprovedDomainAsync(details.url);

  // Log the visit
  await addLog({
    type: "ai_domain_visit",
    domain: aiMatch.domain,
    aiToolName: aiMatch.name,
    aiCategory: aiMatch.category,
    url: new URL(details.url).origin + new URL(details.url).pathname, // strip query params
    approved,
    tabId: details.tabId,
    popupTriggered: !approved,
    action: approved ? "allowed" : "pending",
  });

  // Determine monitoring level for this domain
  const monitoringLevel = await getMonitoringLevelForDomain(aiMatch.domain);

  // If unapproved, inject the warning overlay via content script message
  if (!approved) {
    const warningPayload = {
      type: "SHOW_WARNING",
      aiToolName: aiMatch.name,
      aiCategory: aiMatch.category,
      domain: aiMatch.domain,
      approvedAiUrl: settings.approvedAiUrl || APPROVED_AI_URL,
      monitoringLevel,
    };
    try {
      await chrome.tabs.sendMessage(details.tabId, warningPayload);
    } catch {
      // Content script may not be ready yet; try injecting it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ["content.js"],
        });
        await chrome.scripting.insertCSS({
          target: { tabId: details.tabId },
          files: ["content.css"],
        });
        // Try again after brief delay
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(details.tabId, warningPayload);
          } catch (e) {
            console.warn("AI Shield: Could not show warning", e);
          }
        }, 500);
      } catch (e) {
        console.warn("AI Shield: Could not inject content script", e);
      }
    }
  }

  // Send monitoring level to content script (also for approved domains)
  try {
    await chrome.tabs.sendMessage(details.tabId, {
      type: "SET_MONITORING_LEVEL",
      monitoringLevel,
      domain: aiMatch.domain,
    });
  } catch {
    // Content script not yet ready — it will request level on init
  }
});

// ---- Message Handling ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOG_EVENT") {
    addLog(message.data).then((entry) =>
      sendResponse({ success: true, entry }),
    );
    return true; // async
  }

  if (message.type === "GET_LOGS") {
    chrome.storage.local.get("logs").then(({ logs = [] }) => {
      sendResponse({ logs });
    });
    return true;
  }

  if (message.type === "CLEAR_LOGS") {
    chrome.storage.local.set({ logs: [] }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "EXPORT_LOGS") {
    chrome.storage.local.get("logs").then(({ logs = [] }) => {
      sendResponse({ logs });
    });
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    chrome.storage.local.get("settings").then(({ settings = {} }) => {
      sendResponse({ settings });
    });
    return true;
  }

  if (message.type === "UPDATE_SETTINGS") {
    chrome.storage.local.get("settings").then(async ({ settings = {} }) => {
      const updated = { ...settings, ...message.data };
      await chrome.storage.local.set({ settings: updated });

      // Update badge
      chrome.action.setBadgeText({ text: updated.enabled ? "ON" : "OFF" });
      sendResponse({ success: true, settings: updated });
    });
    return true;
  }

  if (message.type === "CHECK_AI_DOMAIN") {
    (async () => {
      const { customDomains = [] } =
        await chrome.storage.local.get("customDomains");
      const allDomains = [...AI_DOMAINS, ...customDomains];
      const hostname = (() => {
        try {
          return new URL(message.url).hostname;
        } catch {
          return null;
        }
      })();
      let match = null;
      if (hostname) {
        match = allDomains.find(
          (d) => hostname === d.domain || hostname.endsWith("." + d.domain),
        );
        if (!match) {
          const tldMatch = AI_TLD_PATTERNS.find((p) =>
            hostname.endsWith(p.tld),
          );
          if (tldMatch) {
            match = {
              domain: hostname,
              name: tldMatch.name,
              category: tldMatch.category,
            };
          }
        }
      }
      const approved = match ? await isApprovedDomainAsync(message.url) : false;
      sendResponse({ isAi: !!match, match, approved });
    })();
    return true;
  }

  if (message.type === "USER_CONTINUED") {
    addLog({
      type: "user_continued_unapproved",
      domain: message.domain,
      aiToolName: message.aiToolName,
      confirmed: message.confirmed,
      tabId: sender.tab?.id,
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "USER_REDIRECTED") {
    addLog({
      type: "user_redirected",
      domain: message.domain,
      aiToolName: message.aiToolName,
      redirectedTo: message.redirectedTo,
      tabId: sender.tab?.id,
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "PASTE_DETECTED") {
    addLog({
      type: "paste_detected",
      domain: message.domain,
      aiToolName: message.aiToolName,
      fieldType: message.fieldType,
      contentLength: message.contentLength, // length only, no content
      tabId: sender.tab?.id,
    }).then((entry) => {
      try {
        if (
          message.fieldType === "ai_prompt" &&
          (message.contentLength || 0) > 0
        ) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "images/icon-48.png",
            title: "AI Shield — Paste Detected",
            message: `Paste detected into AI prompt (${message.contentLength} characters).`,
          });
        }
      } catch (err) {}
      sendResponse({ success: true, entry });
    });
    return true;
  }

  if (message.type === "ATTACHMENT_BLOCKED") {
    addLog({
      type: "attachment_blocked",
      domain: message.domain,
      interactionType: message.interactionType,
      tabId: sender.tab?.id,
    }).then((entry) => {
      try {
        const reason = message.interactionType || "attachment";
        chrome.notifications.create({
          type: "basic",
          iconUrl: "images/icon-48.png",
          title: "AI Shield — Attachment Blocked",
          message: `File attachment blocked (${reason}). Uploads disabled on unapproved AI tools.`,
        });
      } catch (err) {}
      sendResponse({ success: true, entry });
    });
    return true;
  }

  if (message.type === "AI_INPUT_DETECTED") {
    addLog({
      type: "ai_input_interaction",
      domain: message.domain,
      aiToolName: message.aiToolName,
      interactionType: message.interactionType,
      tabId: sender.tab?.id,
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  // ---- Sensitive data detection (Highest level) ----
  if (message.type === "SENSITIVE_DATA_DETECTED") {
    addLog({
      type: "sensitive_data_detected",
      domain: message.domain,
      aiToolName: message.aiToolName,
      detectedTypes: message.detectedTypes, // e.g. ["Email Address", "SSN"]
      severity: message.severity,
      tabId: sender.tab?.id,
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  // ---- Monitoring Config ----
  if (message.type === "GET_MONITORING_CONFIG") {
    chrome.storage.local
      .get("monitoringConfig")
      .then(({ monitoringConfig = {} }) => {
        sendResponse({ monitoringConfig });
      });
    return true;
  }

  if (message.type === "UPDATE_MONITORING_CONFIG") {
    // Only managers can update monitoring config
    isManager().then(async (allowed) => {
      if (!allowed) {
        sendResponse({
          success: false,
          error: "Only managers can change monitoring settings.",
        });
        return;
      }
      const { monitoringConfig = {} } =
        await chrome.storage.local.get("monitoringConfig");
      const updated = { ...monitoringConfig, ...message.data };
      await chrome.storage.local.set({ monitoringConfig: updated });
      sendResponse({ success: true, monitoringConfig: updated });
    });
    return true;
  }

  if (message.type === "SET_SITE_MONITORING_LEVEL") {
    isManager().then(async (allowed) => {
      if (!allowed) {
        sendResponse({
          success: false,
          error: "Only managers can change monitoring settings.",
        });
        return;
      }
      const { monitoringConfig = {} } =
        await chrome.storage.local.get("monitoringConfig");
      const overrides = { ...(monitoringConfig.siteOverrides || {}) };
      if (
        message.level === "default" ||
        message.level === monitoringConfig.defaultLevel
      ) {
        delete overrides[message.domain];
      } else {
        overrides[message.domain] = message.level;
      }
      const updated = { ...monitoringConfig, siteOverrides: overrides };
      await chrome.storage.local.set({ monitoringConfig: updated });
      sendResponse({ success: true, monitoringConfig: updated });
    });
    return true;
  }

  if (message.type === "GET_MONITORING_LEVEL_FOR_DOMAIN") {
    getMonitoringLevelForDomain(message.domain).then((level) => {
      sendResponse({ level });
    });
    return true;
  }

  if (message.type === "GET_SENSITIVE_PATTERNS") {
    // Send serialisable pattern list (regexes as strings)
    const patterns = SENSITIVE_DATA_PATTERNS.map((p) => ({
      name: p.name,
      regex: p.regex.source,
      flags: p.regex.flags,
      severity: p.severity,
    }));
    sendResponse({ patterns });
    return false;
  }

  if (message.type === "GET_AI_DOMAINS") {
    chrome.storage.local.get("customDomains").then(({ customDomains = [] }) => {
      sendResponse({ domains: [...AI_DOMAINS, ...customDomains] });
    });
    return true;
  }

  if (message.type === "REINITIALIZE_FROM_SUPABASE") {
    initializeFromSupabase().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "CHECK_AI_DOMAIN_ASYNC") {
    (async () => {
      const allDomains = [...AI_DOMAINS];
      const { customDomains = [] } =
        await chrome.storage.local.get("customDomains");
      allDomains.push(...customDomains);

      const hostname = (() => {
        try {
          return new URL(message.url).hostname;
        } catch {
          return null;
        }
      })();

      let match = null;
      if (hostname) {
        match = allDomains.find(
          (d) => hostname === d.domain || hostname.endsWith("." + d.domain),
        );
        if (!match) {
          const tldMatch = AI_TLD_PATTERNS.find((p) =>
            hostname.endsWith(p.tld),
          );
          if (tldMatch) {
            match = {
              domain: hostname,
              name: tldMatch.name,
              category: tldMatch.category,
            };
          }
        }
      }
      const approved = match ? await isApprovedDomainAsync(message.url) : false;
      sendResponse({ isAi: !!match, match, approved });
    })();
    return true;
  }
});
