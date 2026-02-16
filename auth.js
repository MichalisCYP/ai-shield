import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const STORAGE_KEYS = {
  session: "supabaseSession",
  user: "supabaseUser",
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function parseUrlHash(url) {
  const hash = new URL(url).hash?.slice(1) || "";
  const parts = hash.split("&").filter(Boolean);
  return new Map(
    parts.map((part) => {
      const [rawKey, rawValue = ""] = part.split("=");
      const key = decodeURIComponent(rawKey || "");
      const value = decodeURIComponent(rawValue || "");
      return [key, value];
    }),
  );
}

export function buildSupabaseOAuthUrl({ provider, redirectTo }) {
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

export async function getStoredSession() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.session]);
  return stored[STORAGE_KEYS.session] || null;
}

export async function getStoredUser() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.user]);
  return stored[STORAGE_KEYS.user] || null;
}

export async function storeSession(session) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.session]: session,
  });
}

export async function storeUser(user) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.user]: user,
  });
}

export async function clearAuthStorage() {
  await chrome.storage.local.remove([STORAGE_KEYS.session, STORAGE_KEYS.user]);
}

export function sessionFromRedirectUrl(redirectUrl) {
  const hashMap = parseUrlHash(redirectUrl);

  const access_token = hashMap.get("access_token");
  const refresh_token = hashMap.get("refresh_token");
  const token_type = hashMap.get("token_type") || "bearer";
  const expires_in = Number(hashMap.get("expires_in") || 0);
  const expires_at = expires_in ? nowSeconds() + expires_in : null;

  if (!access_token || !refresh_token) {
    return { session: null, error: new Error("No supabase tokens found") };
  }

  return {
    session: {
      access_token,
      refresh_token,
      token_type,
      expires_in,
      expires_at,
      obtained_at: nowSeconds(),
    },
    error: null,
  };
}

export async function fetchSupabaseUser(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase /user failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function refreshSupabaseSession(refreshToken) {
  const url = new URL(`${SUPABASE_URL}/auth/v1/token`);
  url.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const expires_in = Number(data.expires_in || 0);
  const expires_at = expires_in ? nowSeconds() + expires_in : null;

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    token_type: data.token_type || "bearer",
    expires_in,
    expires_at,
    obtained_at: nowSeconds(),
    user: data.user || null,
  };
}

export async function signInWithPassword({ email, password }) {
  const url = new URL(`${SUPABASE_URL}/auth/v1/token`);
  url.searchParams.set("grant_type", "password");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase password sign-in failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const expires_in = Number(data.expires_in || 0);
  const expires_at = expires_in ? nowSeconds() + expires_in : null;

  return {
    session: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type || "bearer",
      expires_in,
      expires_at,
      obtained_at: nowSeconds(),
    },
    user: data.user || null,
  };
}

export async function signUpWithPassword({ email, password }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase sign-up failed: ${res.status} ${text}`);
  }

  // Depending on your Supabase settings, this may return a session or require email confirmation.
  const data = await res.json();
  return {
    user: data.user || null,
    session: data.session || null,
  };
}

export async function signOutRemote(accessToken) {
  if (!accessToken) return;
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  }).catch(() => {
    // Best-effort; local token removal is what matters for the extension.
  });
}

export async function ensureValidStoredSession({ leewaySeconds = 60 } = {}) {
  const session = await getStoredSession();
  if (!session) return { session: null, refreshed: false };

  if (!session.expires_at) return { session, refreshed: false };

  const secondsLeft = session.expires_at - nowSeconds();
  if (secondsLeft > leewaySeconds) {
    return { session, refreshed: false };
  }

  try {
    const refreshed = await refreshSupabaseSession(session.refresh_token);
    await storeSession(refreshed);
    if (refreshed.user) {
      await storeUser(refreshed.user);
    }
    return { session: refreshed, refreshed: true };
  } catch {
    await clearAuthStorage();
    return { session: null, refreshed: false };
  }
}
