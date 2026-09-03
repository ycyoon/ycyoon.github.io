import { eq } from "drizzle-orm";
import { getAuthorizedRequestUser } from "../../../lib/access";
import {
  creditedAmountLabel,
  isPaperMetric,
  isMetricType,
  isSelectableMetricType,
  metricLabels,
  type RecordInput,
} from "../../../lib/scoreboard";
import { ensureDatabase } from "../../../db/bootstrap";
import { getD1, getDb } from "../../../db";
import { performanceRecords } from "../../../db/schema";
import { jsonResponse, optionsResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

const allowedOrganizations = ["제주대학교", "건국대학교", "공동", "기타"];

type MutationBody = Partial<RecordInput> & {
  id?: string;
};

export async function POST(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as MutationBody;
    const input = validateInput(body);
    if (input instanceof Response) return input;

    await ensureDatabase();
    const d1 = await getD1();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const snapshot = {
      id,
      ...input,
      createdByEmail: user.email,
      createdByName: user.displayName,
      updatedByEmail: user.email,
      updatedByName: user.displayName,
      createdAt: now,
      updatedAt: now,
      archived: false,
    };

    await d1.batch([
      d1.prepare(`INSERT INTO performance_records (
        id, metric_type, acknowledgement_count, year, title, organization, project, achievement_date,
        identifier, url, notes, created_by_email, created_by_name,
        updated_by_email, updated_by_name, created_at, updated_at, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).bind(
        id,
        input.metricType,
        input.acknowledgementCount,
        input.year,
        input.title,
        input.organization,
        input.project,
        input.achievementDate,
        input.identifier,
        input.url,
        input.notes,
        user.email,
        user.displayName,
        user.email,
        user.displayName,
        now,
        now,
      ),
      d1.prepare(`INSERT INTO audit_logs (
        record_id, entity_type, action, summary, changed_by_email, changed_by_name, snapshot, created_at
      ) VALUES (?, 'performance', 'created', ?, ?, ?, ?, ?)`).bind(
        id,
        `${metricLabels[input.metricType]} 성과를 등록했습니다. (${creditedAmountLabel(input)} 인정)`,
        user.email,
        user.displayName,
        JSON.stringify(snapshot),
        now,
      ),
    ]);

    return jsonResponse({ record: snapshot }, { status: 201 });
  } catch (error) {
    console.error("record create error", error);
    return serverError();
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as MutationBody;
    if (!body.id || typeof body.id !== "string") {
      return jsonResponse({ error: "수정할 성과를 확인할 수 없습니다." }, { status: 400 });
    }
    const input = validateInput(body);
    if (input instanceof Response) return input;

    await ensureDatabase();
    const db = await getDb();
    const [current] = await db
      .select()
      .from(performanceRecords)
      .where(eq(performanceRecords.id, body.id))
      .limit(1);

    if (!current || current.archived) {
      return jsonResponse({ error: "성과를 찾을 수 없습니다." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const changedFields = changedFieldLabels(current, input);
    const snapshot = {
      ...current,
      ...input,
      updatedByEmail: user.email,
      updatedByName: user.displayName,
      updatedAt: now,
    };
    const summary = changedFields.length
      ? `${changedFields.join(", ")} 항목을 수정했습니다.`
      : "성과 정보를 다시 저장했습니다.";

    const d1 = await getD1();
    await d1.batch([
      d1.prepare(`UPDATE performance_records SET
        metric_type = ?, acknowledgement_count = ?, year = ?, title = ?, organization = ?, project = ?,
        achievement_date = ?, identifier = ?, url = ?, notes = ?,
        updated_by_email = ?, updated_by_name = ?, updated_at = ?
      WHERE id = ? AND archived = 0`).bind(
        input.metricType,
        input.acknowledgementCount,
        input.year,
        input.title,
        input.organization,
        input.project,
        input.achievementDate,
        input.identifier,
        input.url,
        input.notes,
        user.email,
        user.displayName,
        now,
        body.id,
      ),
      d1.prepare(`INSERT INTO audit_logs (
        record_id, entity_type, action, summary, changed_by_email, changed_by_name, snapshot, created_at
      ) VALUES (?, 'performance', 'updated', ?, ?, ?, ?, ?)`).bind(
        body.id,
        summary,
        user.email,
        user.displayName,
        JSON.stringify(snapshot),
        now,
      ),
    ]);

    return jsonResponse({ record: snapshot });
  } catch (error) {
    console.error("record update error", error);
    return serverError();
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as { id?: string };
    if (!body.id || typeof body.id !== "string") {
      return jsonResponse({ error: "삭제할 성과를 확인할 수 없습니다." }, { status: 400 });
    }

    await ensureDatabase();
    const db = await getDb();
    const [current] = await db
      .select()
      .from(performanceRecords)
      .where(eq(performanceRecords.id, body.id))
      .limit(1);

    if (!current || current.archived) {
      return jsonResponse({ error: "성과를 찾을 수 없습니다." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const snapshot = {
      ...current,
      updatedByEmail: user.email,
      updatedByName: user.displayName,
      updatedAt: now,
      archived: true,
    };
    const d1 = await getD1();

    await d1.batch([
      d1.prepare(`UPDATE performance_records SET
        archived = 1, updated_by_email = ?, updated_by_name = ?, updated_at = ?
      WHERE id = ? AND archived = 0`).bind(
        user.email,
        user.displayName,
        now,
        body.id,
      ),
      d1.prepare(`INSERT INTO audit_logs (
        record_id, entity_type, action, summary, changed_by_email, changed_by_name, snapshot, created_at
      ) VALUES (?, 'performance', 'deleted', ?, ?, ?, ?, ?)`).bind(
        body.id,
        `${metricLabels[current.metricType as keyof typeof metricLabels]} 성과를 삭제했습니다.`,
        user.email,
        user.displayName,
        JSON.stringify(snapshot),
        now,
      ),
    ]);

    return jsonResponse({ deleted: true, id: body.id });
  } catch (error) {
    console.error("record delete error", error);
    return jsonResponse(
      { error: "성과를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

function validateInput(body: MutationBody): RecordInput | Response {
  if (!isMetricType(body.metricType)) {
    return jsonResponse({ error: "성과 유형을 선택해 주세요." }, { status: 400 });
  }

  if (!isSelectableMetricType(body.metricType)) {
    return jsonResponse(
      { error: "기존 논문 성과의 세부 분류를 새 기준에 맞게 선택해 주세요." },
      { status: 400 },
    );
  }

  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 2026 || year > 2031) {
    return jsonResponse({ error: "성과 연차를 선택해 주세요." }, { status: 400 });
  }

  const title = clean(body.title, 300);
  if (!title) {
    return jsonResponse({ error: "성과명을 입력해 주세요." }, { status: 400 });
  }

  const organization = clean(body.organization, 50);
  if (!allowedOrganizations.includes(organization)) {
    return jsonResponse({ error: "수행기관을 선택해 주세요." }, { status: 400 });
  }

  const url = clean(body.url, 500);
  if (url && !isValidHttpUrl(url)) {
    return jsonResponse({ error: "증빙 링크는 http 또는 https 주소로 입력해 주세요." }, { status: 400 });
  }

  const requestedAcknowledgementCount = Number(body.acknowledgementCount ?? 1);
  if (
    isPaperMetric(body.metricType) &&
    (!Number.isInteger(requestedAcknowledgementCount) ||
      requestedAcknowledgementCount < 1 ||
      requestedAcknowledgementCount > 10)
  ) {
    return jsonResponse(
      { error: "논문의 사사 과제 수는 1개부터 10개까지 선택해 주세요." },
      { status: 400 },
    );
  }

  return {
    metricType: body.metricType,
    acknowledgementCount: isPaperMetric(body.metricType)
      ? requestedAcknowledgementCount
      : 1,
    year,
    title,
    organization,
    project: clean(body.project, 80),
    achievementDate: clean(body.achievementDate, 20),
    identifier: clean(body.identifier, 200),
    url,
    notes: clean(body.notes, 2000),
  };
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function changedFieldLabels(
  current: typeof performanceRecords.$inferSelect,
  input: RecordInput,
) {
  const fields: Array<[keyof RecordInput, string]> = [
    ["metricType", "성과 유형"],
    ["acknowledgementCount", "사사 과제 수"],
    ["year", "연차"],
    ["title", "성과명"],
    ["organization", "수행기관"],
    ["project", "연구 프로젝트"],
    ["achievementDate", "성과일"],
    ["identifier", "식별번호"],
    ["url", "증빙 링크"],
    ["notes", "메모"],
  ];
  return fields
    .filter(([field]) => String(current[field]) !== String(input[field]))
    .map(([, label]) => label);
}

function unauthorized() {
  return jsonResponse(
    { error: "성과를 관리하려면 사용자 승인이 필요합니다." },
    { status: 403 },
  );
}

function serverError() {
  return jsonResponse(
    { error: "성과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
    { status: 500 },
  );
}
