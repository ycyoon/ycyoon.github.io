import { desc, eq } from "drizzle-orm";
import { getAuthorizedRequestUser } from "../../../lib/access";
import { ensureDatabase } from "../../../db/bootstrap";
import { getDb } from "../../../db";
import { auditLogs } from "../../../db/schema";
import { jsonResponse, optionsResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) return jsonResponse({ error: "승인된 사용자만 이용할 수 있습니다." }, { status: 403 });

    const recordId = new URL(request.url).searchParams.get("recordId")?.trim();
    if (!recordId) {
      return jsonResponse({ error: "성과 식별자가 필요합니다." }, { status: 400 });
    }

    await ensureDatabase();
    const db = await getDb();
    const history = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.recordId, recordId))
      .orderBy(desc(auditLogs.id))
      .limit(500);

    return jsonResponse({ history });
  } catch (error) {
    console.error("history data error", error);
    return jsonResponse(
      { error: "변경 이력을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
