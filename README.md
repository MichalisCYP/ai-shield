# AI Shield — Chrome Extension

A Chrome browser extension that guides employees toward safer AI usage by detecting unapproved AI tools, prompting confirmation, and logging metadata for security teams.

## Features

### 1. AI Domain Detection

Monitors 30+ AI-related domains including ChatGPT, Claude, Gemini, Copilot, DeepSeek, Perplexity, and more. Automatically detects when a user navigates to an unapproved AI tool.

### 2. AI Usage Detection

- **Paste detection** — identifies when users paste content into AI prompt fields (logs length only, never content)
- **Prompt field detection** — tracks focus events on AI input areas
- **Embedded AI widget detection** — identifies AI iframes embedded in other applications

### 3. User Intervention (Warning Overlay)

When an unapproved AI tool is detected, a full-screen warning overlay appears:

- **5-second delay** before the user can proceed (prevents quick dismissal)
- **Mandatory checkbox** — user must confirm they won't paste sensitive data
- **Redirect button** — prominent button to redirect to the approved AI tool (OpenRouter)
- **Continue button** — only enabled after delay + checkbox confirmation
- The overlay is designed to nudge users toward the approved tool

### 4. Metadata Logging (Privacy-First)

Captures signal-level logs only:

- Domain accessed & AI tool name
- Timestamp
- Type of interaction (visit, paste, input focus, redirect)
- Whether a warning was triggered
- Whether the user continued or was redirected
- User name and role

**Never captures:** prompt text, pasted content, keystrokes, or sensitive data.

## Architecture

```
ai-shield/
├── manifest.json        # MV3 manifest with permissions
├── config.js            # AI domain list, approved URL, settings
├── background.js        # Service worker: navigation monitoring, logging
├── content.js           # Content script: paste/input detection, warning overlay
├── content.css          # Warning overlay and paste toast styles
├── popup.html/js/css    # Extension popup: status, stats, quick actions
├── dashboard.html/js/css # Full analytics dashboard for security teams
└── images/              # Extension icons (16, 32, 48, 128px)
```

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `ai-shield` folder
5. The extension icon (shield) will appear in your toolbar

## Usage

### For Employees

- The extension runs automatically in the background
- When visiting an unapproved AI tool, a warning overlay appears
- Click **"Use Approved AI Instead"** to be redirected to the approved tool
- Or confirm you won't share sensitive data and continue
- Set your name and role in the popup for identification

### For Security Teams

- Click the extension icon → **"View Dashboard"** to open the analytics page
- **Overview tab** — summary cards, top AI tools accessed, compliance rate
- **Logs tab** — detailed event log with filters, JSON/CSV export
- **Settings tab** — configure user identity, approved AI URL, enable/disable

### Exporting Logs

- Dashboard → Logs tab → **Export JSON** or **Export CSV**
- Or from the popup → **Export Logs** link

## Configuration

Edit `config.js` to customise:

- `AI_DOMAINS` — add or remove monitored AI domains
- `APPROVED_AI_URL` — change the approved AI redirect URL (default: openrouter.ai)
- `APPROVED_DOMAINS` — domains that won't trigger the blocking overlay
- `WARNING_DELAY_MS` — how long users must wait before dismissing (default: 5000ms)
- `MAX_LOG_ENTRIES` — maximum stored log entries (default: 10,000)

## Privacy

This extension is designed with privacy as a core principle:

- **No content capture** — never reads prompt text, pasted content, or keystrokes
- **Metadata only** — logs domain, timestamp, interaction type, and user action
- **Local storage** — all data stays in the browser's local storage
- **No external transmission** — logs are not sent to any server
- **User-controlled** — can be disabled at any time via the popup toggle
