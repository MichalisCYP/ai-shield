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

// ---- Wildcard TLD Patterns ----
// Any website whose hostname ends with one of these TLDs will be
// treated as an AI site, even if it is not explicitly listed above.
export const AI_TLD_PATTERNS = [
  { tld: ".ai", name: "Unknown .ai Site", category: "AI (TLD match)" },
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
// "low"  — logs visits, shows warnings, detects paste (length only)
// "high" — all of low + real-time input scanning for sensitive data via regex

export const MONITORING_LEVELS = {
  low: {
    label: "Low",
    description: "Logs visits and paste events. No input content scanning.",
    scanInput: false,
  },
  high: {
    label: "High",
    description:
      "All basic monitoring plus real-time scanning of input fields for sensitive data.",
    scanInput: true,
  },
};

export const DEFAULT_MONITORING_LEVEL = "low";

// ---- Sensitive Data Patterns ----
// Regular expressions used to detect sensitive data typed or pasted into
// AI tool input fields. At "low" monitoring level these are used only for
// paste scanning; at "high" they also cover real-time input scanning.
// The content itself is NEVER logged — only the *type* of match is recorded.

export const SENSITIVE_DATA_PATTERNS = [
  // ---- Identity ----
  {
    name: "Social Security Number (SSN)",
    // Handles: 123-45-6789  or  123 45 6789
    regex: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/,
    severity: "critical",
  },
  {
    name: "UK National Insurance Number",
    // e.g. AB 12 34 56 C  (spaces optional)
    regex: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/i,
    severity: "critical",
  },
  {
    name: "Passport Number",
    // 1–2 letters followed by 6–9 digits (covers many national formats)
    regex: /\b[A-Z]{1,2}[0-9]{6,9}\b/,
    severity: "high",
  },
  {
    name: "Date of Birth",
    // Requires explicit label to avoid matching arbitrary dates
    regex:
      /\b(?:dob|date\s+of\s+birth|birth(?:day|date)?)\s*[:=]?\s*(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})\b/i,
    severity: "high",
  },

  // ---- Financial ----
  {
    name: "Credit Card Number",
    // Covers Visa, MC, Amex, Discover, JCB, Diners with optional spaces/dashes
    regex:
      /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|2(?:2[2-9][1-9]|[3-6]\d{2}|7(?:[01]\d|20))[0-9]|3[47][0-9]{2}|3(?:0[0-5]|[68][0-9])[0-9]|6(?:011|5[0-9]{2})|(?:2131|1800|35\d{2}))(?:[-\s]?[0-9]{4}){2,3}(?:[-\s]?[0-9]{1,4})?\b/,
    severity: "critical",
  },
  {
    name: "IBAN",
    // Starts with 2-letter country code + 2 check digits + up to 30 alphanumeric chars
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/,
    severity: "critical",
  },

  // ---- Contact ----
  {
    name: "Email Address",
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,
    severity: "high",
  },
  {
    name: "Phone Number",
    // Handles international (+1, +44, etc.) and local formats
    regex:
      /(?<!\d)(?:\+?(\d{1,3})[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{3,9}(?!\d)/,
    severity: "medium",
  },

  // ---- Credentials & Secrets ----
  {
    name: "Password in Text",
    // Matches: password: s3cr3t  /  pwd=hunter2  etc.
    regex: /\b(?:password|passwd|pwd|pass)\s*[:=]\s*\S+/i,
    severity: "critical",
  },
  {
    name: "Private Key Block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    name: "AWS Access Key ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "critical",
  },
  {
    name: "AWS Secret Access Key",
    // 40-char base64 string — only flag when adjacent to "aws" context hint
    regex:
      /\b(?:aws[_\-.]?(?:secret|access)[_\-.]?key\s*[:=]\s*)[A-Za-z0-9/+]{40}\b/i,
    severity: "critical",
  },
  {
    name: "GitHub Personal Access Token",
    // Classic: ghp_  /  Fine-grained: github_pat_  /  App: ghs_ ghr_
    regex: /\b(?:ghp|ghs|ghr|gho|github_pat)_[A-Za-z0-9_]{20,255}\b/,
    severity: "critical",
  },
  {
    name: "Slack Token",
    regex: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/,
    severity: "critical",
  },
  {
    name: "JWT Token",
    // Header.Payload.Signature format
    regex: /\beyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/,
    severity: "critical",
  },
  {
    name: "Generic API Key / Secret",
    // Matches key=value patterns where value is sufficiently long and random
    regex:
      /\b(?:api[_\-]?key|api[_\-]?secret|client[_\-]?secret|access[_\-]?token|auth[_\-]?token|bearer|secret[_\-]?key|private[_\-]?key)\s*[:=]\s*[A-Za-z0-9_\-\.]{16,}/i,
    severity: "critical",
  },
  {
    name: "Connection String",
    // Database/message-broker URLs containing credentials
    regex:
      /\b(?:mongodb(?:\+srv)?|postgresql|postgres|mysql|mssql|redis|amqp|jdbc:[a-z]+):\/\/[^\s"']+/i,
    severity: "critical",
  },

  // ---- Network ----
  {
    name: "IPv4 Address",
    regex:
      /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/,
    severity: "medium",
  },
  {
    name: "IPv6 Address",
    regex:
      /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b|\b(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}\b/,
    severity: "medium",
  },

  // ---- Healthcare ----
  {
    name: "UK NHS Number",
    // 10 digits in groups of 3-3-4 with spaces or dashes
    regex: /\b\d{3}[-\s]\d{3}[-\s]\d{4}\b/,
    severity: "critical",
  },
];

// Roles that can manage monitoring levels
export const MANAGER_ROLES = ["Manager"];

// ---- Supabase Auth ----
// Mirrors dashboard/.env.local values.
// This is a publishable/anon key (safe to embed client-side).
export const SUPABASE_URL = "https://nbkyiseujgobcnbzwrid.supabase.co";
export const SUPABASE_ANON_KEY =
  "sb_publishable_dIIJIhTiykvGOmFqntFSlg_ee6qo-d7";
