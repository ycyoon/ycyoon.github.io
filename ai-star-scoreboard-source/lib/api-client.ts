export const GITHUB_PAGES_ORIGIN = "https://ycyoon.github.io";
export const GITHUB_PAGES_BASE_PATH = "/ai-star-scoreboard/";

export function isGitHubPages() {
  return (
    typeof window !== "undefined" &&
    window.location.origin === GITHUB_PAGES_ORIGIN
  );
}

function isStaticPreview() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  if (isGitHubPages() || isStaticPreview()) {
    const { supabaseApiFetch } = await import("./supabase-api");
    return supabaseApiFetch(input, init);
  }
  return fetch(input, init);
}
