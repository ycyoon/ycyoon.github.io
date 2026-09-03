import { GITHUB_PAGES_ORIGIN } from "./api-client";

const corsHeaders = {
  "access-control-allow-origin": GITHUB_PAGES_ORIGIN,
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-max-age": "86400",
  vary: "Origin",
};

export function withGitHubCors(response: Response) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  response.headers.set("cache-control", "no-store");
  return response;
}

export function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
) {
  return withGitHubCors(Response.json(data, init));
}

export function optionsResponse() {
  return withGitHubCors(new Response(null, { status: 204 }));
}
