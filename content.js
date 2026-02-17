// ============================================================
// AI Shield — Content Script
// Injected into AI domains to detect interactions and show warnings
// ============================================================

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__aiShieldInjected) return;
  window.__aiShieldInjected = true;

  const DOMAIN = window.location.hostname;
  let aiToolName = "Unknown AI Tool";
  let warningShown = false;
  let warningDismissed = false;
  const WARNING_DELAY_MS = 5000; // 5 seconds before user can proceed

  // ---- Monitoring Level State ----
  let currentMonitoringLevel = "low";
  let sensitivePatterns = []; // [{name, regex: RegExp, severity}]
  let sensitiveCheckTimer = null;
  let lastSensitiveAlert = 0; // throttle alerts
  const SENSITIVE_ALERT_COOLDOWN = 5000; // ms

  // ---- AI Input Selectors ----
  // Common selectors for AI prompt input areas across popular tools
  const AI_INPUT_SELECTORS = [
    // ChatGPT / OpenAI
    'textarea[data-id="root"]',
    "textarea#prompt-textarea",
    "div#prompt-textarea",
    'div[contenteditable="true"][data-placeholder]',
    // Claude
    'div[contenteditable="true"].ProseMirror',
    'div.ProseMirror[contenteditable="true"]',
    // Gemini
    'div[contenteditable="true"][aria-label]',
    'textarea[aria-label*="prompt"]',
    "rich-textarea textarea",
    // Generic patterns
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="ask"]',
    'textarea[placeholder*="Type"]',
    'textarea[placeholder*="type"]',
    'textarea[placeholder*="chat"]',
    'textarea[placeholder*="Chat"]',
    'textarea[placeholder*="prompt"]',
    'textarea[placeholder*="Prompt"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    "textarea",
  ];

  // ---- Warning Overlay ----

  function createWarningOverlay(data) {
    if (warningShown) return;
    warningShown = true;

    aiToolName = data.aiToolName || aiToolName;
    const approvedUrl = data.approvedAiUrl || "https://openrouter.ai/";
    const isApproved = !!data.approved;

    // Create fullscreen overlay
    const overlay = document.createElement("div");
    overlay.id = "ai-shield-overlay";
    overlay.innerHTML = `
      <div id="ai-shield-warning-card">
          <div class="ai-shield-header">
          <div class="ai-shield-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${isApproved ? "#2e7d32" : "#e74c3c"}" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h1>${isApproved ? "ℹ️ Approved AI Tool — Reminder" : "⚠️ Unapproved AI Tool Detected"}</h1>
        </div>

        <div class="ai-shield-body">
          <p class="ai-shield-tool-name">You are accessing <strong>${escapeHtml(aiToolName)}</strong></p>
          <p class="ai-shield-domain">${escapeHtml(DOMAIN)}</p>

          <div class="ai-shield-warning-box">
            <p><strong>This AI tool is not approved for use with sensitive or confidential data.</strong></p>
            <p>Pasting company data, personal information, intellectual property, or confidential documents into unapproved AI tools may violate organisational policy and create data security risks.</p>
          </div>

          <div class="ai-shield-actions">
            ${
              isApproved
                ? ""
                : `
            <button id="ai-shield-redirect-btn" class="ai-shield-btn ai-shield-btn-primary">
              🔒 Use Approved AI Instead
            </button>
            `
            }

            <div class="ai-shield-continue-section">
              <div class="ai-shield-checkbox-row">
                <input type="checkbox" id="ai-shield-confirm-checkbox" />
                <label for="ai-shield-confirm-checkbox">
                  I confirm I will <strong>not</strong> paste or enter any sensitive, confidential, or personal data into this tool.
                </label>
              </div>
              <button id="ai-shield-continue-btn" class="ai-shield-btn ai-shield-btn-secondary" disabled>
                ${isApproved ? "Acknowledge" : `Continue Anyway (<span id="ai-shield-countdown">${WARNING_DELAY_MS / 1000}</span>s)`}
              </button>
            </div>
          </div>

          <p class="ai-shield-footer-note">
            This interaction is being logged for security compliance. No content or keystrokes are recorded.
          </p>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    // ---- Countdown / acknowledge handling ----
    let countdown = WARNING_DELAY_MS / 1000;
    const countdownEl = document.getElementById("ai-shield-countdown");
    const continueBtn = document.getElementById("ai-shield-continue-btn");
    const confirmCheckbox = document.getElementById(
      "ai-shield-confirm-checkbox",
    );

    // If there's no countdown element (approved flow), behave as immediate acknowledge
    if (!countdownEl) countdown = 0;

    const timer = setInterval(() => {
      countdown--;
      if (countdownEl) countdownEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(timer);
        updateContinueButton();
      }
    }, 1000);

    function updateContinueButton() {
      // For approved flows, enable once checkbox is checked
      if (!countdownEl) {
        if (confirmCheckbox && confirmCheckbox.checked) {
          continueBtn.disabled = false;
          continueBtn.textContent = isApproved ? "Acknowledge" : "Continue";
          continueBtn.classList.add("ai-shield-btn-enabled");
        } else {
          continueBtn.disabled = true;
          continueBtn.classList.remove("ai-shield-btn-enabled");
        }
        return;
      }

      if (countdown <= 0 && confirmCheckbox && confirmCheckbox.checked) {
        continueBtn.disabled = false;
        continueBtn.textContent = "Continue Anyway";
        continueBtn.classList.add("ai-shield-btn-enabled");
      } else if (countdown <= 0) {
        continueBtn.textContent = "Continue Anyway (check the box above)";
        continueBtn.disabled = true;
        continueBtn.classList.remove("ai-shield-btn-enabled");
      }
    }

    if (confirmCheckbox)
      confirmCheckbox.addEventListener("change", updateContinueButton);

    // ---- Redirect button (only for unapproved) ----
    const redirectBtn = document.getElementById("ai-shield-redirect-btn");
    if (redirectBtn) {
      redirectBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          type: "USER_REDIRECTED",
          domain: DOMAIN,
          aiToolName: aiToolName,
          redirectedTo: approvedUrl,
        });
        window.location.href = approvedUrl;
      });
    }

    // ---- Continue / Acknowledge button ----
    if (continueBtn) {
      continueBtn.addEventListener("click", () => {
        if (continueBtn.disabled) return;
        warningDismissed = true;
        chrome.runtime.sendMessage({
          type: "USER_CONTINUED",
          domain: DOMAIN,
          aiToolName: aiToolName,
          confirmed: true,
        });
        overlay.classList.add("ai-shield-fade-out");
        setTimeout(() => overlay.remove(), 300);
      });
    }

    // Block scrolling while overlay is visible
    document.body.style.overflow = "hidden";
    overlay.addEventListener("transitionend", () => {
      if (overlay.classList.contains("ai-shield-fade-out")) {
        document.body.style.overflow = "";
      }
    });

    // Prevent interaction with the page behind
    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  // ---- Paste Detection ----

  function setupPasteDetection() {
    document.addEventListener(
      "paste",
      (e) => {
        // Ensure we have an Element to inspect (could be a text node)
        let targetEl = e.target;
        if (!(targetEl instanceof Element)) {
          targetEl =
            targetEl && targetEl.parentElement
              ? targetEl.parentElement
              : document.activeElement;
        }

        // Find the nearest input-like ancestor (or self)
        const inputAncestor =
          targetEl &&
          (targetEl.closest('textarea, input, [contenteditable="true"]') ||
            null);

        const isInput = !!inputAncestor;
        const isAiInput = isInput && isLikelyAiInput(inputAncestor);

        // Extract clipboard text — we only measure length and scan for patterns,
        // the raw content is never logged or sent anywhere.
        const clipboardData = e.clipboardData;
        let pasteText = "";
        let contentLength = 0;
        if (clipboardData) {
          pasteText = clipboardData.getData("text/plain") || "";
          contentLength = pasteText.length;
        }

        if (isAiInput) {
          // Always scan paste content for sensitive data patterns, regardless
          // of the current monitoring level.
          if (pasteText.length > 0) {
            scanPasteContent(pasteText);
          }

          // Show a generic paste reminder for any paste into an AI input.
          // Delay slightly so the sensitive warning (if any) gets priority and
          // suppresses this generic one.
          setTimeout(() => {
            const sensitiveWarning = document.getElementById(
              "ai-shield-sensitive-warning",
            );
            if (!sensitiveWarning) {
              showPasteWarning(contentLength);
            }
          }, 50);
        }

        chrome.runtime.sendMessage({
          type: "PASTE_DETECTED",
          domain: DOMAIN,
          aiToolName: aiToolName,
          fieldType: isAiInput ? "ai_prompt" : "other_input",
          contentLength: contentLength,
        });
      },
      true,
    );
  }

  function isLikelyAiInput(element) {
    if (!element) return false;
    try {
      for (const selector of AI_INPUT_SELECTORS) {
        try {
          if (element.closest && element.closest(selector)) return true;
        } catch (err) {
          // ignore invalid selector
        }
      }
    } catch (err) {}
    return false;
  }

  // ---- Paste Warning Overlay ----

  function showPasteWarning(contentLength) {
    // Remove existing paste warning if any
    const existing = document.getElementById("ai-shield-paste-warning");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "ai-shield-paste-warning";
    overlay.innerHTML = `
      <div class="ai-shield-paste-content">
        <span class="ai-shield-paste-icon">📋</span>
        <div>
          <strong>Paste detected</strong> (${contentLength.toLocaleString()} characters)
          <br />
          <small>Please ensure you are not pasting sensitive or confidential data.</small>
        </div>
        <button id="ai-shield-paste-dismiss">✕</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const dismissButton = document.getElementById("ai-shield-paste-dismiss");
    dismissButton.addEventListener("click", () => {
      overlay.classList.add("ai-shield-fade-out");
      setTimeout(() => overlay.remove(), 300);
    });

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      if (overlay.parentElement) {
        overlay.classList.add("ai-shield-fade-out");
        setTimeout(() => overlay.remove(), 300);
      }
    }, 8000);
  }

  // ---- AI Input Field Detection ----

  function detectAiInputFields() {
    const observer = new MutationObserver(() => {
      for (const selector of AI_INPUT_SELECTORS.slice(0, 10)) {
        // only specific selectors
        let elements = [];
        try {
          elements = document.querySelectorAll(selector);
        } catch (err) {
          // invalid selector — skip
          continue;
        }
        elements.forEach((el) => {
          if (el.dataset.aiShieldTracked) return;
          el.dataset.aiShieldTracked = "true";

          // Detect focus on AI input
          el.addEventListener("focus", () => {
            chrome.runtime.sendMessage({
              type: "AI_INPUT_DETECTED",
              domain: DOMAIN,
              aiToolName: aiToolName,
              interactionType: "focus_prompt_field",
            });
          });
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial scan
    for (const selector of AI_INPUT_SELECTORS.slice(0, 10)) {
      let elements = [];
      try {
        elements = document.querySelectorAll(selector);
      } catch (err) {
        continue;
      }
      elements.forEach((el) => {
        if (el.dataset.aiShieldTracked) return;
        el.dataset.aiShieldTracked = "true";
        el.addEventListener("focus", () => {
          chrome.runtime.sendMessage({
            type: "AI_INPUT_DETECTED",
            domain: DOMAIN,
            aiToolName: aiToolName,
            interactionType: "focus_prompt_field",
          });
        });
      });
    }
  }

  // ---- Embedded AI Widget Detection ----

  function detectEmbeddedAiWidgets() {
    // Look for iframes pointing to AI services
    const AI_IFRAME_PATTERNS = [
      "openai.com",
      "claude.ai",
      "gemini.google",
      "copilot",
      "huggingface",
      "mistral",
      "perplexity",
      "deepseek",
    ];

    const observer = new MutationObserver(() => {
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        if (iframe.dataset.aiShieldChecked) return;
        iframe.dataset.aiShieldChecked = "true";

        const src = iframe.src || "";
        const matchesAi = AI_IFRAME_PATTERNS.some((pattern) =>
          src.includes(pattern),
        );
        if (matchesAi) {
          chrome.runtime.sendMessage({
            type: "AI_INPUT_DETECTED",
            domain: DOMAIN,
            aiToolName: "Embedded AI Widget",
            interactionType: "embedded_ai_iframe",
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---- Utility ----

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Message Handling ----

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SHOW_WARNING") {
      createWarningOverlay(message);
      sendResponse({ success: true });
    }
    if (message.type === "SET_MONITORING_LEVEL") {
      setMonitoringLevel(message.monitoringLevel);
      sendResponse({ success: true });
    }
  });

  // ---- Monitoring Level Handling ----

  function setMonitoringLevel(level) {
    currentMonitoringLevel = level || "low";
    if (currentMonitoringLevel === "high") {
      loadSensitivePatterns();
      attachInputScanners();
    }
  }

  function loadSensitivePatterns() {
    if (sensitivePatterns.length > 0) return; // already loaded
    chrome.runtime.sendMessage(
      { type: "GET_SENSITIVE_PATTERNS" },
      (response) => {
        if (response && response.patterns) {
          sensitivePatterns = response.patterns.map((p) => ({
            name: p.name,
            // Patterns are sent as serialised strings from the background
            regex:
              p.regex instanceof RegExp
                ? p.regex
                : new RegExp(p.regex, p.flags || ""),
            severity: p.severity,
          }));
        }
      },
    );
  }

  // ---- Paste-specific sensitive data scan (works at any monitoring level) ----

  function scanPasteContent(text) {
    if (!text || text.length === 0) return;
    if (sensitivePatterns.length === 0) return;

    const matches = [];
    let highestSeverity = "medium";
    const severityRank = { medium: 0, high: 1, critical: 2 };

    for (const pattern of sensitivePatterns) {
      try {
        // Use a fresh regex each call to avoid lastIndex issues with global flags
        const re = new RegExp(
          pattern.regex.source,
          pattern.regex.flags.replace("g", ""),
        );
        if (re.test(text)) {
          matches.push(pattern.name);
          if (severityRank[pattern.severity] > severityRank[highestSeverity]) {
            highestSeverity = pattern.severity;
          }
        }
      } catch (err) {
        /* ignore bad regex */
      }
    }

    if (matches.length === 0) return;

    // Show the warning overlay immediately (not throttled for paste events)
    showSensitiveDataWarning(matches, highestSeverity);

    chrome.runtime.sendMessage({
      type: "SENSITIVE_DATA_DETECTED",
      domain: DOMAIN,
      aiToolName: aiToolName,
      detectedTypes: matches,
      severity: highestSeverity,
      source: "paste",
    });
  }

  // ---- Real-time Input Scanning (High level) ----

  function attachInputScanners() {
    // Watch for input events on AI prompt fields
    document.addEventListener("input", onInputChange, true);
    // Also intercept paste at high level with content scanning
    document.addEventListener("paste", onPasteHigh, true);
  }

  function onInputChange(e) {
    if (currentMonitoringLevel !== "high") return;
    const target = e.target;
    if (!isLikelyAiInput(target)) return;

    // Debounce: scan after user stops typing for 400ms
    clearTimeout(sensitiveCheckTimer);
    sensitiveCheckTimer = setTimeout(() => {
      const text = getElementText(target);
      if (text.length > 3) {
        scanForSensitiveData(text);
      }
    }, 400);
  }

  function onPasteHigh(e) {
    if (currentMonitoringLevel !== "high") return;
    // Ensure we inspect a nearest input element (handle text nodes and shadow cases)
    let targetEl = e.target;
    if (!(targetEl instanceof Element)) {
      targetEl =
        targetEl && targetEl.parentElement
          ? targetEl.parentElement
          : document.activeElement;
    }
    const inputAncestor =
      targetEl &&
      (targetEl.closest('textarea, input, [contenteditable="true"]') || null);
    if (!inputAncestor) return;

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;
    const text = clipboardData.getData("text/plain");
    if (text && text.length > 3) {
      scanForSensitiveData(text);
    }
  }

  function getElementText(el) {
    if (el.value !== undefined) return el.value;
    if (el.textContent !== undefined) return el.textContent;
    return el.innerText || "";
  }

  function scanForSensitiveData(text) {
    if (sensitivePatterns.length === 0) return;

    const matches = [];
    let highestSeverity = "medium";
    const severityRank = { medium: 0, high: 1, critical: 2 };

    for (const pattern of sensitivePatterns) {
      if (pattern.regex.test(text)) {
        matches.push(pattern.name);
        if (severityRank[pattern.severity] > severityRank[highestSeverity]) {
          highestSeverity = pattern.severity;
        }
      }
    }

    if (matches.length === 0) return;

    // Throttle alerts
    const now = Date.now();
    if (now - lastSensitiveAlert < SENSITIVE_ALERT_COOLDOWN) return;
    lastSensitiveAlert = now;

    // Show in-page warning
    showSensitiveDataWarning(matches, highestSeverity);

    // Log via background (no actual content is sent — only type names)
    chrome.runtime.sendMessage({
      type: "SENSITIVE_DATA_DETECTED",
      domain: DOMAIN,
      aiToolName: aiToolName,
      detectedTypes: matches,
      severity: highestSeverity,
    });
  }

  function showSensitiveDataWarning(matchedTypes, severity) {
    // Remove existing warning if any
    const existing = document.getElementById("ai-shield-sensitive-warning");
    if (existing) existing.remove();

    const severityColors = {
      medium: {
        bg: "#fff3cd",
        border: "#ffc107",
        icon: "⚠️",
        label: "Warning",
      },
      high: {
        bg: "#ffe0b2",
        border: "#ff9800",
        icon: "🔶",
        label: "High Risk",
      },
      critical: {
        bg: "#ffebee",
        border: "#f44336",
        icon: "🚨",
        label: "CRITICAL",
      },
    };
    const style = severityColors[severity] || severityColors.medium;
    const isCritical = severity === "critical";

    const warning = document.createElement("div");
    warning.id = "ai-shield-sensitive-warning";
    // For critical findings use a centred modal-style banner; otherwise use the toast
    warning.className = isCritical
      ? "ai-shield-sensitive-modal"
      : "ai-shield-sensitive-toast";

    warning.innerHTML = isCritical
      ? `
        <div class="ai-shield-sensitive-modal-card" style="border-top: 4px solid ${style.border} !important;">
          <div class="ai-shield-sensitive-modal-header">
            <span style="font-size:28px;">${style.icon}</span>
            <div>
              <strong style="color:${style.border} !important; font-size:15px;">${style.label}: Sensitive Data Detected</strong>
              <p style="margin:4px 0 0 0; font-size:13px; color:#555;">
                The text you are about to paste appears to contain:
              </p>
              <ul style="margin:6px 0 0 16px; padding:0; font-size:13px; color:#333;">
                ${matchedTypes.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
              </ul>
            </div>
          </div>
          <p class="ai-shield-sensitive-modal-advice">
            Please remove or anonymise sensitive information before submitting to an AI tool.
          </p>
          <div style="display:flex; gap:10px; margin-top:12px;">
            <button id="ai-shield-sensitive-dismiss" class="ai-shield-sensitive-btn-dismiss">Dismiss</button>
          </div>
        </div>
      `
      : `
        <div class="ai-shield-sensitive-content" style="
          background: ${style.bg} !important;
          border: 1px solid ${style.border} !important;
          border-left: 4px solid ${style.border} !important;
        ">
          <span class="ai-shield-sensitive-icon">${style.icon}</span>
          <div>
            <strong>Sensitive data detected</strong>
            <br />
            <small>Detected: ${matchedTypes.map(escapeHtml).join(", ")}</small>
            <br />
            <small style="color:#c62828 !important;">Please remove sensitive information before submitting.</small>
          </div>
          <button id="ai-shield-sensitive-dismiss">✕</button>
        </div>
      `;

    document.documentElement.appendChild(warning);

    document
      .getElementById("ai-shield-sensitive-dismiss")
      .addEventListener("click", () => {
        warning.classList.add("ai-shield-fade-out");
        setTimeout(() => warning.remove(), 300);
      });

    // Auto-dismiss: longer timeout for critical so user has time to read it
    const dismissMs = isCritical ? 15000 : 10000;
    setTimeout(() => {
      if (warning.parentElement) {
        warning.classList.add("ai-shield-fade-out");
        setTimeout(() => warning.remove(), 300);
      }
    }, dismissMs);
  }

  // ---- Attachment prevention ----

  function attachAttachmentPrevention() {
    // Prevent file drops
    document.addEventListener(
      "dragover",
      (e) => {
        try {
          if (
            e.dataTransfer &&
            Array.from(e.dataTransfer.types || []).includes("Files")
          ) {
            e.preventDefault();
          }
        } catch (err) {}
      },
      true,
    );

    document.addEventListener(
      "drop",
      (e) => {
        try {
          if (
            e.dataTransfer &&
            e.dataTransfer.files &&
            e.dataTransfer.files.length > 0
          ) {
            e.preventDefault();
            showAttachWarning("drop");
          }
        } catch (err) {}
      },
      true,
    );

    // Prevent pasting files from clipboard
    document.addEventListener(
      "paste",
      (e) => {
        try {
          const items = e.clipboardData && e.clipboardData.items;
          if (items) {
            for (const it of items) {
              if (it && it.kind === "file") {
                e.preventDefault();
                showAttachWarning("paste");
                return;
              }
            }
          }
        } catch (err) {}
      },
      true,
    );

    // Disable file inputs and intercept attach/upload buttons
    function disableFileInputs(root = document) {
      try {
        const inputs = root.querySelectorAll('input[type="file"]');
        inputs.forEach((input) => {
          if (input.dataset.aiShieldFileBlocked) return;
          input.dataset.aiShieldFileBlocked = "1";
          input.addEventListener(
            "click",
            (e) => {
              e.preventDefault();
              showAttachWarning("click");
            },
            true,
          );
          input.addEventListener(
            "change",
            (e) => {
              e.preventDefault();
              try {
                input.value = "";
              } catch (err) {}
              showAttachWarning("change");
            },
            true,
          );
          try {
            input.disabled = true;
            input.style.pointerEvents = "none";
            input.style.opacity = "0.6";
          } catch (err) {}
        });

        const buttons = root.querySelectorAll(
          "button, a, input[type=button], input[type=submit]",
        );
        const re =
          /\b(attach|attachment|upload|choose file|browse|add file)\b/i;
        buttons.forEach((btn) => {
          if (btn.dataset.aiShieldAttachBlocked) return;
          const text = (
            btn.innerText ||
            btn.value ||
            btn.getAttribute("aria-label") ||
            ""
          ).trim();
          if (re.test(text)) {
            btn.dataset.aiShieldAttachBlocked = "1";
            btn.addEventListener(
              "click",
              (e) => {
                e.preventDefault();
                showAttachWarning("click");
              },
              true,
            );
          }
        });
      } catch (err) {}
    }

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) disableFileInputs(node);
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial disable
    disableFileInputs();
  }

  function showAttachWarning(reason) {
    const existing = document.getElementById("ai-shield-attach-warning");
    if (existing) return;
    const el = document.createElement("div");
    el.id = "ai-shield-attach-warning";
    el.innerHTML = `
      <div class="ai-shield-paste-content">
        <span class="ai-shield-paste-icon">📎</span>
        <div>
          <strong>File attachment blocked</strong>
          <br />
          <small>Uploading files is disabled on unapproved AI tools.</small>
        </div>
        <button id="ai-shield-attach-dismiss">✕</button>
      </div>
    `;
    document.documentElement.appendChild(el);
    try {
      chrome.runtime.sendMessage({
        type: "ATTACHMENT_BLOCKED",
        domain: DOMAIN,
        interactionType: reason || "unknown",
      });
    } catch (err) {}
    document
      .getElementById("ai-shield-attach-dismiss")
      .addEventListener("click", () => {
        el.classList.add("ai-shield-fade-out");
        setTimeout(() => el.remove(), 300);
      });
    setTimeout(() => {
      if (el.parentElement) {
        el.classList.add("ai-shield-fade-out");
        setTimeout(() => el.remove(), 300);
      }
    }, 4000);
  }

  // ---- Initialise ----

  setupPasteDetection();
  detectAiInputFields();
  detectEmbeddedAiWidgets();
  attachAttachmentPrevention();

  // Always pre-load sensitive patterns so paste scanning works at any level
  loadSensitivePatterns();

  // Request monitoring level for this domain from the background
  chrome.runtime.sendMessage(
    { type: "GET_MONITORING_LEVEL_FOR_DOMAIN", domain: DOMAIN },
    (response) => {
      if (response && response.level) {
        setMonitoringLevel(response.level);
      }
    },
  );

  // Also show warning on initial load if we're on an AI site
  chrome.runtime.sendMessage(
    {
      type: "CHECK_AI_DOMAIN",
      url: window.location.href,
    },
    (response) => {
      if (response && response.isAi && !response.approved) {
        aiToolName = response.match?.name || aiToolName;
      }
    },
  );
})();
