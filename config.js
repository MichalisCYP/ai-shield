// ============================================================
// AI Shield — Configuration
// Central list of monitored AI domains and settings
// ============================================================

export const AI_DOMAINS = [
  // Major chatbots
  { domain: "chat.openai.com", name: "ChatGPT", category: "Chatbot" },
  { domain: "chatgpt.com", name: "ChatGPT", category: "Chatbot" },
  { domain: "claude.ai", name: "Claude", category: "Chatbot" },
  { domain: "gemini.google.com", name: "Gemini", category: "Chatbot" },
  { domain: "bard.google.com", name: "Bard", category: "Chatbot" },
  { domain: "copilot.microsoft.com", name: "Copilot", category: "Chatbot" },
  { domain: "chat.mistral.ai", name: "Mistral Chat", category: "Chatbot" },
  { domain: "poe.com", name: "Poe", category: "Aggregator" },
  { domain: "perplexity.ai", name: "Perplexity", category: "Search AI" },
  { domain: "www.perplexity.ai", name: "Perplexity", category: "Search AI" },
  { domain: "you.com", name: "You.com", category: "Search AI" },
  { domain: "pi.ai", name: "Pi", category: "Chatbot" },
  { domain: "deepseek.com", name: "DeepSeek", category: "Chatbot" },
  { domain: "chat.deepseek.com", name: "DeepSeek", category: "Chatbot" },
  { domain: "grok.x.ai", name: "Grok", category: "Chatbot" },

  // Writing & content AI
  { domain: "writesonic.com", name: "Writesonic", category: "Writing AI" },
  { domain: "jasper.ai", name: "Jasper", category: "Writing AI" },
  { domain: "app.jasper.ai", name: "Jasper", category: "Writing AI" },
  { domain: "rytr.me", name: "Rytr", category: "Writing AI" },

  // AI platforms
  { domain: "huggingface.co", name: "Hugging Face", category: "AI Platform" },
  { domain: "labs.google", name: "Google AI Labs", category: "AI Platform" },
  {
    domain: "aistudio.google.com",
    name: "Google AI Studio",
    category: "AI Platform",
  },

  // Social/character AI
  { domain: "character.ai", name: "Character.AI", category: "Social AI" },
  { domain: "beta.character.ai", name: "Character.AI", category: "Social AI" },
  { domain: "replika.com", name: "Replika", category: "Social AI" },
  { domain: "inflection.ai", name: "Inflection", category: "Social AI" },

  // Notion (has AI features)
  { domain: "notion.so", name: "Notion AI", category: "Productivity AI" },
  { domain: "www.notion.so", name: "Notion AI", category: "Productivity AI" },
];

// The approved AI route – users will be redirected here
export const APPROVED_AI_URL = "https://openrouter.ai/";

// Domains that are approved (won't trigger blocking overlay, just logging)
export const APPROVED_DOMAINS = ["openrouter.ai"];

// Log retention (max entries)
export const MAX_LOG_ENTRIES = 10000;

// How long the user must wait before they can dismiss the warning (ms)
export const WARNING_DELAY_MS = 5000;

// ---- Monitoring Levels ----
// "lowest"  — logs visits, shows warnings, detects paste (length only)
// "highest" — all of lowest + real-time input scanning for sensitive data via regex

export const MONITORING_LEVELS = {
  lowest: {
    label: "Lowest",
    description: "Logs visits and paste events. No input content scanning.",
    scanInput: false,
  },
  highest: {
    label: "Highest",
    description:
      "All basic monitoring plus real-time scanning of input fields for sensitive data.",
    scanInput: true,
  },
};

export const DEFAULT_MONITORING_LEVEL = "lowest";

// ---- Sensitive Data Patterns ----
// Regular expressions used at the "Highest" monitoring level to detect
// sensitive data typed or pasted into AI tool input fields.
// The content itself is NOT logged — only the *type* of match is recorded.

export const SENSITIVE_DATA_PATTERNS = [
  {
    name: "Social Security Number",
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    severity: "critical",
  },
  {
    name: "Credit Card Number",
    regex: /\b(?:\d[ -]*?){13,19}\b/,
    // Luhn-style loose match for 13-19 digit card numbers
    severity: "critical",
  },
  {
    name: "Email Address",
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,
    severity: "high",
  },
  {
    name: "Phone Number",
    regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/,
    severity: "medium",
  },
  {
    name: "API Key / Secret",
    regex:
      /\b(?:sk|pk|api[_-]?key|secret|token|bearer)[_\-]?[A-Za-z0-9]{16,}\b/i,
    severity: "critical",
  },
  {
    name: "AWS Access Key",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "critical",
  },
  {
    name: "Private Key Block",
    regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    name: "IP Address",
    regex:
      /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/,
    severity: "medium",
  },
  {
    name: "Password Pattern",
    regex: /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/i,
    severity: "critical",
  },
];

// Roles that can manage monitoring levels
export const MANAGER_ROLES = ["Manager"];
