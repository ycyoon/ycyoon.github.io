export const EXTERNAL_API_ORIGIN =
  "https://ai-star-scoreboard.saintrv.chatgpt.site";
export const GITHUB_PAGES_ORIGIN = "https://ycyoon.github.io";
export const GITHUB_PAGES_BASE_PATH = "/ai-star-scoreboard/";
export const EXTERNAL_SESSION_STORAGE_KEY = "ai-star-scoreboard.session";

function isGitHubPages() {
  return (
    typeof window !== "undefined" &&
    window.location.origin === GITHUB_PAGES_ORIGIN
  );
}

export function getStoredExternalSession() {
  if (!isGitHubPages()) return null;
  return window.localStorage.getItem(EXTERNAL_SESSION_STORAGE_KEY);
}

export function storeExternalSession(token: string) {
  if (!isGitHubPages()) return;
  window.localStorage.setItem(EXTERNAL_SESSION_STORAGE_KEY, token);
}

export function clearExternalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EXTERNAL_SESSION_STORAGE_KEY);
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const external = isGitHubPages();
  const target =
    external && typeof input === "string" && input.startsWith("/")
      ? `${EXTERNAL_API_ORIGIN}${input}`
      : input;
  const headers = new Headers(init.headers);
  const session = getStoredExternalSession();
  if (external && session) headers.set("authorization", `Bearer ${session}`);

  return fetch(target, { ...init, headers });
}
