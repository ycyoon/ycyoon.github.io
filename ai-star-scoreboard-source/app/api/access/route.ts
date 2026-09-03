import { desc, eq } from "drizzle-orm";
import { getRequestAppUser } from "../../../lib/auth";
import { getAuthorizedRequestUser, getAccessStatus, isSiteAdmin } from "../../../lib/access";
import { ensureDatabase } from "../../../db/bootstrap";
import { getD1, getDb } from "../../../db";
import { accessRequests } from "../../../db/schema";
import { jsonResponse, optionsResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const user = await getRequestAppUser(request);
    if (!user) return jsonResponse({ error: "로그인이 필요합니다." }, { status: 401 });
    await ensureDatabase();

    if (isSiteAdmin(user.email)) {
      const db = await getDb();
      const requests = await db
        .select()
        .from(accessRequests)
        .orderBy(desc(accessRequests.requestedAt));
      return jsonResponse({ status: "owner", isAdmin: true, requests });
    }

    return jsonResponse({ status: await getAccessStatus(user.email), isAdmin: false });
  } catch (error) {
    console.error("access status error", error);
    return jsonResponse({ error: "승인 상태를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestAppUser(request);
    if (!user) return jsonResponse({ error: "로그인이 필요합니다." }, { status: 401 });
    if (isSiteAdmin(user.email)) return jsonResponse({ status: "owner" });

    await ensureDatabase();
    const email = user.email.trim().toLowerCase();
    const db = await getDb();
    const [existing] = await db
      .select({ status: accessRequests.status })
      .from(accessRequests)
      .where(eq(accessRequests.email, email))
      .limit(1);
    if (existing?.status === "approved") return jsonResponse({ status: "approved" });

    const now = new Date().toISOString();
    const d1 = await getD1();
    await d1.prepare(`INSERT INTO access_requests (
      email, display_name, status, requested_at, reviewed_at, reviewed_by_email, reviewed_by_name
    ) VALUES (?, ?, 'pending', ?, '', '', '')
    ON CONFLICT(email) DO UPDATE SET
      display_name = excluded.display_name,
      status = 'pending',
      requested_at = excluded.requested_at,
      reviewed_at = '',
      reviewed_by_email = '',
      reviewed_by_name = ''`).bind(email, user.displayName, now).run();

    return jsonResponse({ status: "pending" });
  } catch (error) {
    console.error("access request error", error);
    return jsonResponse({ error: "승인 요청을 보내지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await getAuthorizedRequestUser(request);
    if (!admin?.isAdmin) return jsonResponse({ error: "관리자 권한이 필요합니다." }, { status: 403 });

    const body = (await request.json()) as { email?: string; status?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || (body.status !== "approved" && body.status !== "rejected")) {
      return jsonResponse({ error: "처리할 요청과 상태를 확인해 주세요." }, { status: 400 });
    }

    await ensureDatabase();
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.email, email))
      .limit(1);
    if (!existing) return jsonResponse({ error: "가입 요청을 찾을 수 없습니다." }, { status: 404 });

    const now = new Date().toISOString();
    const d1 = await getD1();
    await d1.prepare(`UPDATE access_requests SET
      status = ?, reviewed_at = ?, reviewed_by_email = ?, reviewed_by_name = ?
    WHERE email = ?`).bind(
      body.status,
      now,
      admin.email,
      admin.displayName,
      email,
    ).run();

    return jsonResponse({
      request: {
        ...existing,
        status: body.status,
        reviewedAt: now,
        reviewedByEmail: admin.email,
        reviewedByName: admin.displayName,
      },
    });
  } catch (error) {
    console.error("access review error", error);
    return jsonResponse({ error: "가입 요청을 처리하지 못했습니다." }, { status: 500 });
  }
}
