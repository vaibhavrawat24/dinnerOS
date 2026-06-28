import type { SwiggyAuth } from "./types";

const AUTH_KEY = "dinnerOS_swiggyAuth";
const PKCE_KEY = "dinnerOS_pkce";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const auth = JSON.parse(raw) as SwiggyAuth;
    return auth.expiresAt > Date.now() + 60_000;
  } catch {
    return false;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw) as SwiggyAuth;
    if (auth.expiresAt <= Date.now() + 60_000) return null;
    return auth.accessToken;
  } catch {
    return null;
  }
}

export function saveAuth(accessToken: string): void {
  const auth: SwiggyAuth = {
    accessToken,
    expiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000, // 5 days
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(PKCE_KEY);
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { verifier, challenge };
}

export async function startOAuthFlow(): Promise<void> {
  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem(PKCE_KEY, verifier);

  const redirectUri = `${window.location.origin}/auth/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "mcp:tools",
    redirect_uri: redirectUri,
  });

  window.location.href = `https://mcp.swiggy.com/auth/authorize?${params}`;
}

export async function handleOAuthCallback(code: string): Promise<boolean> {
  const verifier = sessionStorage.getItem(PKCE_KEY);
  if (!verifier) return false;

  try {
    const res = await fetch("/api/swiggy/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        redirect_uri: `${window.location.origin}/auth/callback`,
      }),
    });

    if (!res.ok) return false;
    const { access_token } = await res.json();
    if (!access_token) return false;
    saveAuth(access_token);
    sessionStorage.removeItem(PKCE_KEY);
    return true;
  } catch {
    return false;
  }
}
