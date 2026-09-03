import { getAccessStatus } from "../../../lib/access";
import { getRequestAppUser } from "../../../lib/auth";
import {
  createExternalSessionToken,
  verifyBootstrapToken,
} from "../../../lib/external-session";
import { jsonResponse, optionsResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code : "";
    const user = await verifyBootstrapToken(code);
    if (!user) {
      return jsonResponse(
        { error: "로그인 확인 정보가 만료되었습니다. 다시 로그인해 주세요." },
        { status: 401 },
      );
    }

    const [token, status] = await Promise.all([
      createExternalSessionToken(user),
      getAccessStatus(user.email),
    ]);
    return jsonResponse({
      token,
      user: { displayName: user.displayName, email: user.email },
      status,
      isAdmin: status === "owner",
    });
  } catch (error) {
    console.error("github session exchange error", error);
    return jsonResponse(
      { error: "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await getRequestAppUser(request);
    if (!user) {
      return jsonResponse({ error: "로그인이 만료되었습니다." }, { status: 401 });
    }
    const status = await getAccessStatus(user.email);
    return jsonResponse({
      user: { displayName: user.displayName, email: user.email },
      status,
      isAdmin: status === "owner",
    });
  } catch (error) {
    console.error("github session status error", error);
    return jsonResponse(
      { error: "로그인 상태를 확인하지 못했습니다." },
      { status: 500 },
    );
  }
}
