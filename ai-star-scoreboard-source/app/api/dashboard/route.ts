import { asc, desc, eq } from "drizzle-orm";
import { ensureDatabase } from "../../../db/bootstrap";
import { getDb } from "../../../db";
import { annualTargets, auditLogs, performanceRecords, trainingParticipants } from "../../../db/schema";
import { getAuthorizedRequestUser } from "../../../lib/access";
import { jsonResponse, optionsResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) {
      return jsonResponse({ error: "승인된 사용자만 이용할 수 있습니다." }, { status: 403 });
    }
    await ensureDatabase();
    const db = await getDb();
    const [targets, records, participants, activity] = await Promise.all([
      db.select().from(annualTargets).orderBy(asc(annualTargets.year)),
      db
        .select()
        .from(performanceRecords)
        .where(eq(performanceRecords.archived, false))
        .orderBy(desc(performanceRecords.updatedAt)),
      db
        .select()
        .from(trainingParticipants)
        .where(eq(trainingParticipants.archived, false))
        .orderBy(desc(trainingParticipants.updatedAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(30),
    ]);

    return jsonResponse({ targets, records, participants, activity });
  } catch (error) {
    console.error("dashboard data error", error);
    return jsonResponse(
      { error: "성과 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
