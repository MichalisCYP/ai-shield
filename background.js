// ============================================================
// AI Shield — Background Service Worker
// Monitors navigation, manages state, handles logging
// ============================================================

import {
  AI_DOMAINS,
  APPROVED_DOMAINS,
  APPROVED_AI_URL,
  MAX_LOG_ENTRIES,
} from "./config.js";

// ---- Initialisation ----

chrome.runtime.onInstalled.addListener(async () => {
  // Initialise storage
  const existing = await chrome.storage.local.get(["logs", "settings"]);
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

  // Set badge
  chrome.action.setBadgeBackgroundColor({ color: "#1a73e8" });
  chrome.action.setBadgeText({ text: "ON" });
});

// ---- Helpers ----

function matchAiDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return AI_DOMAINS.find(
      (d) => hostname === d.domain || hostname.endsWith("." + d.domain),
    );
  } catch {
    return null;
  }
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

  const approved = isApprovedDomain(details.url);

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

  // If unapproved, inject the warning overlay via content script message
  if (!approved) {
    try {
      await chrome.tabs.sendMessage(details.tabId, {
        type: "SHOW_WARNING",
        aiToolName: aiMatch.name,
        aiCategory: aiMatch.category,
        domain: aiMatch.domain,
        approvedAiUrl: settings.approvedAiUrl || APPROVED_AI_URL,
      });
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
            await chrome.tabs.sendMessage(details.tabId, {
              type: "SHOW_WARNING",
              aiToolName: aiMatch.name,
              aiCategory: aiMatch.category,
              domain: aiMatch.domain,
              approvedAiUrl: settings.approvedAiUrl || APPROVED_AI_URL,
            });
          } catch (e) {
            console.warn("AI Shield: Could not show warning", e);
          }
        }, 500);
      } catch (e) {
        console.warn("AI Shield: Could not inject content script", e);
      }
    }
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
    const match = matchAiDomain(message.url);
    const approved = match ? isApprovedDomain(message.url) : false;
    sendResponse({ isAi: !!match, match, approved });
    return false;
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
    }).then(() => sendResponse({ success: true }));
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
});
