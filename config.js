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
