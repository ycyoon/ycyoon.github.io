import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";
import { verifyExternalSessionToken } from "./external-session";

export async function getAppUser(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (user) return user;

  if (process.env.NODE_ENV === "development") {
    return {
      displayName: "미리보기 관리자",
      email: "preview@local",
      fullName: "미리보기 관리자",
    };
  }

  return null;
}

export async function getRequestAppUser(
  request: Request,
): Promise<ChatGPTUser | null> {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    return verifyExternalSessionToken(match[1]);
  }

  return getAppUser();
}
