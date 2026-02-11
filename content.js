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

    // Create fullscreen overlay
    const overlay = document.createElement("div");
    overlay.id = "ai-shield-overlay";
    overlay.innerHTML = `
      <div id="ai-shield-warning-card">
        <div class="ai-shield-header">
          <div class="ai-shield-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h1>⚠️ Unapproved AI Tool Detected</h1>
        </div>

        <div class="ai-shield-body">
          <p class="ai-shield-tool-name">You are accessing <strong>${escapeHtml(aiToolName)}</strong></p>
          <p class="ai-shield-domain">${escapeHtml(DOMAIN)}</p>

          <div class="ai-shield-warning-box">
            <p><strong>This AI tool is not approved for use with sensitive or confidential data.</strong></p>
            <p>Pasting company data, personal information, intellectual property, or confidential documents into unapproved AI tools may violate organisational policy and create data security risks.</p>
          </div>

          <div class="ai-shield-actions">
            <button id="ai-shield-redirect-btn" class="ai-shield-btn ai-shield-btn-primary">
              🔒 Use Approved AI Instead
            </button>

            <div class="ai-shield-continue-section">
              <div class="ai-shield-checkbox-row">
                <input type="checkbox" id="ai-shield-confirm-checkbox" />
                <label for="ai-shield-confirm-checkbox">
                  I confirm I will <strong>not</strong> paste or enter any sensitive, confidential, or personal data into this tool.
                </label>
              </div>
              <button id="ai-shield-continue-btn" class="ai-shield-btn ai-shield-btn-secondary" disabled>
                Continue Anyway (<span id="ai-shield-countdown">${WARNING_DELAY_MS / 1000}</span>s)
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

    // ---- Countdown timer ----
    let countdown = WARNING_DELAY_MS / 1000;
    const countdownEl = document.getElementById("ai-shield-countdown");
    const continueBtn = document.getElementById("ai-shield-continue-btn");
    const confirmCheckbox = document.getElementById(
      "ai-shield-confirm-checkbox",
    );

    const timer = setInterval(() => {
      countdown--;
      if (countdownEl) countdownEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(timer);
        updateContinueButton();
      }
    }, 1000);

    function updateContinueButton() {
      if (countdown <= 0 && confirmCheckbox.checked) {
        continueBtn.disabled = false;
        continueBtn.textContent = "Continue Anyway";
        continueBtn.classList.add("ai-shield-btn-enabled");
      } else if (countdown <= 0) {
        continueBtn.textContent = "Continue Anyway (check the box above)";
        continueBtn.disabled = true;
        continueBtn.classList.remove("ai-shield-btn-enabled");
      }
    }

    confirmCheckbox.addEventListener("change", updateContinueButton);

    // ---- Redirect button ----
    document
      .getElementById("ai-shield-redirect-btn")
      .addEventListener("click", () => {
        chrome.runtime.sendMessage({
          type: "USER_REDIRECTED",
          domain: DOMAIN,
          aiToolName: aiToolName,
          redirectedTo: approvedUrl,
        });
        window.location.href = approvedUrl;
      });

    // ---- Continue button ----
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
        const target = e.target;
        const isInput = target.matches(
          'textarea, input, [contenteditable="true"]',
        );
        const isAiInput = isInput && isLikelyAiInput(target);

        // We only measure length — never capture content
        const clipboardData = e.clipboardData;
        let contentLength = 0;
        if (clipboardData) {
          const text = clipboardData.getData("text/plain");
          contentLength = text ? text.length : 0;
        }

        if (isAiInput && contentLength > 50) {
          // Large paste into AI input — show a mini-reminder
          showPasteWarning(contentLength);
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
    for (const selector of AI_INPUT_SELECTORS) {
      try {
        if (element.matches(selector)) return true;
      } catch {
        /* invalid selector */
      }
    }
    return false;
  }

  function showPasteWarning(contentLength) {
    // Remove existing paste warning if any
    const existing = document.getElementById("ai-shield-paste-warning");
    if (existing) existing.remove();

    const warning = document.createElement("div");
    warning.id = "ai-shield-paste-warning";
    warning.innerHTML = `
      <div class="ai-shield-paste-content">
        <span class="ai-shield-paste-icon">📋</span>
        <div>
          <strong>Large paste detected</strong> (${contentLength.toLocaleString()} characters)
          <br />
          <small>Please ensure you are not pasting sensitive or confidential data.</small>
        </div>
        <button id="ai-shield-paste-dismiss">✕</button>
      </div>
    `;
    document.documentElement.appendChild(warning);

    document
      .getElementById("ai-shield-paste-dismiss")
      .addEventListener("click", () => {
        warning.classList.add("ai-shield-fade-out");
        setTimeout(() => warning.remove(), 300);
      });

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      if (warning.parentElement) {
        warning.classList.add("ai-shield-fade-out");
        setTimeout(() => warning.remove(), 300);
      }
    }, 8000);
  }

  // ---- AI Input Field Detection ----

  function detectAiInputFields() {
    const observer = new MutationObserver(() => {
      for (const selector of AI_INPUT_SELECTORS.slice(0, 10)) {
        // only specific selectors
        const elements = document.querySelectorAll(selector);
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
      const elements = document.querySelectorAll(selector);
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
  });

  // ---- Initialise ----

  setupPasteDetection();
  detectAiInputFields();
  detectEmbeddedAiWidgets();

  // Also show warning on initial load if we're on an AI site
  // (the background script will send SHOW_WARNING, but just in case)
  chrome.runtime.sendMessage(
    {
      type: "CHECK_AI_DOMAIN",
      url: window.location.href,
    },
    (response) => {
      if (response && response.isAi && !response.approved) {
        aiToolName = response.match?.name || aiToolName;
        // The background will send SHOW_WARNING after navigation completes
      }
    },
  );
})();
