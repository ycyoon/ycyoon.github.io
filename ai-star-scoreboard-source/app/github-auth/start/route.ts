import { chatGPTSignInPath } from "../../chatgpt-auth";
import { getAppUser } from "../../../lib/auth";
import { createBootstrapToken } from "../../../lib/external-session";
import {
  GITHUB_PAGES_BASE_PATH,
  GITHUB_PAGES_ORIGIN,
} from "../../../lib/api-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) {
    const signInUrl = new URL(chatGPTSignInPath("/github-auth/start"), request.url);
    return Response.redirect(signInUrl, 302);
  }

  const code = await createBootstrapToken(user);
  const target = new URL(GITHUB_PAGES_BASE_PATH, GITHUB_PAGES_ORIGIN);
  target.hash = new URLSearchParams({ code }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}
