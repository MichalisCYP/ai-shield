# AI Shield Chrome Extension

<p align="center">
  <strong>Empowering Organizations to Securely Navigate AI Usage</strong>
</p>

<p align="center">
  AI Shield is a Chrome extension that detects, monitors, and guides AI tool usage, ensuring compliance with organizational policies while preventing sensitive data exposure.
</p>

<br/>

## Overview

AI Shield addresses the challenges of managing AI usage in real-time. By integrating seamlessly into the browser, it provides:

- **Detection**: Identifies AI tools and domains accessed by users.
- **Guidance**: Displays contextual warnings and redirects users to approved AI environments.
- **Logging**: Captures metadata (never content) for security visibility.
- **Prevention**: Blocks sensitive data from being entered into unapproved AI tools.

## Key Features

### Real-Time AI Detection

- Monitors user interactions with popular AI tools like ChatGPT, Claude, Gemini, and more.
- Uses domain patterns and input field selectors to identify AI usage.

### Contextual Warnings

- Alerts users when accessing unapproved AI tools.
- Implements a delay before users can proceed, encouraging safer practices.

### Monitoring Levels

- **Low**: Tracks basic domain and interaction metadata.
- **High/Strict**: Monitors sensitive data patterns to prevent accidental exposure.

### Seamless Integration

- Works as a background service worker to manage state, handle logging, and enforce policies.
- Injects content scripts into AI domains to detect interactions and enforce monitoring.

### Role-Based Access

- Employees: View their own activity logs.
- Managers: Configure monitoring levels, approve domains, and access analytics.

### Domain Management

- Pre-configured with a list of approved and monitored AI domains.
- Allows organizations to customize domain approvals and monitoring levels.

## How It Works

1. **Background Service Worker**:
   - Initializes storage for logs, settings, and monitoring configurations.
   - Detects navigation events and applies monitoring policies.

2. **Content Script**:
   - Injected into AI domains to detect user interactions.
   - Monitors input fields for sensitive data patterns.

3. **Manifest Configuration**:
   - Defines permissions for active tabs, storage, and web navigation.
   - Specifies host permissions for popular AI tools.

## Tech Stack

- **Frontend**: Chrome Extension APIs, JavaScript
- **Backend**: Supabase (for logging and analytics)
- **Deployment**: Chrome Web Store

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/ai-shield.git
   cd ai-shield
   ```

2. Load the extension:
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable "Developer mode" and click "Load unpacked."
   - Select the `ai-shield` directory.

3. Configure settings:
   - Update `config.js` with your organization's Supabase URL and API keys.

## Feedback and Issues

Please file feedback and issues on the [GitHub repository](https://github.com/your-org/ai-shield/issues).
