import { eq } from "drizzle-orm";
import { getAuthorizedRequestUser } from "../../../lib/access";
import {
  degreeLabels,
  isDegreeCourse,
  type ParticipantInput,
} from "../../../lib/scoreboard";
import { ensureDatabase } from "../../../db/bootstrap";
import { getD1, getDb } from "../../../db";
import { trainingParticipants } from "../../../db/schema";
import { jsonResponse, optionsResponse } from "../../../lib/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

type MutationBody = Partial<ParticipantInput> & { id?: string };

export async function POST(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as MutationBody;
    const input = validateInput(body);
    if (input instanceof Response) return input;

    await ensureDatabase();
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
    const d1 = await getD1();

    await d1.batch([
      d1.prepare(`INSERT INTO training_participants (
        id, name, school, degree_course, participation_start, participation_end,
        graduation_date, project, role, notes, created_by_email, created_by_name,
        updated_by_email, updated_by_name, created_at, updated_at, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).bind(
        id,
        input.name,
        input.school,
        input.degreeCourse,
        input.participationStart,
        input.participationEnd,
        input.graduationDate,
        input.project,
        input.role,
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
      ) VALUES (?, 'training_participant', 'created', ?, ?, ?, ?, ?)`).bind(
        id,
        `${input.name} ${degreeLabels[input.degreeCourse]} 참여인력을 등록했습니다.`,
        user.email,
        user.displayName,
        JSON.stringify(snapshot),
        now,
      ),
    ]);

    return jsonResponse({ participant: snapshot }, { status: 201 });
  } catch (error) {
    console.error("participant create error", error);
    return serverError();
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as MutationBody;
    if (!body.id || typeof body.id !== "string") {
      return jsonResponse({ error: "수정할 참여인력을 확인할 수 없습니다." }, { status: 400 });
    }
    const input = validateInput(body);
    if (input instanceof Response) return input;

    await ensureDatabase();
    const db = await getDb();
    const [current] = await db
      .select()
      .from(trainingParticipants)
      .where(eq(trainingParticipants.id, body.id))
      .limit(1);
    if (!current || current.archived) {
      return jsonResponse({ error: "참여인력을 찾을 수 없습니다." }, { status: 404 });
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
      ? `${input.name} 참여인력의 ${changedFields.join(", ")} 항목을 수정했습니다.`
      : `${input.name} 참여인력 정보를 다시 저장했습니다.`;
    const d1 = await getD1();

    await d1.batch([
      d1.prepare(`UPDATE training_participants SET
        name = ?, school = ?, degree_course = ?, participation_start = ?, participation_end = ?,
        graduation_date = ?, project = ?, role = ?, notes = ?, updated_by_email = ?,
        updated_by_name = ?, updated_at = ?
      WHERE id = ? AND archived = 0`).bind(
        input.name,
        input.school,
        input.degreeCourse,
        input.participationStart,
        input.participationEnd,
        input.graduationDate,
        input.project,
        input.role,
        input.notes,
        user.email,
        user.displayName,
        now,
        body.id,
      ),
      d1.prepare(`INSERT INTO audit_logs (
        record_id, entity_type, action, summary, changed_by_email, changed_by_name, snapshot, created_at
      ) VALUES (?, 'training_participant', 'updated', ?, ?, ?, ?, ?)`).bind(
        body.id,
        summary,
        user.email,
        user.displayName,
        JSON.stringify(snapshot),
        now,
      ),
    ]);

    return jsonResponse({ participant: snapshot });
  } catch (error) {
    console.error("participant update error", error);
    return serverError();
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthorizedRequestUser(request);
    if (!user) return unauthorized();
    const body = (await request.json()) as { id?: string };
    if (!body.id || typeof body.id !== "string") {
      return jsonResponse({ error: "삭제할 참여인력을 확인할 수 없습니다." }, { status: 400 });
    }

    await ensureDatabase();
    const db = await getDb();
    const [current] = await db
      .select()
      .from(trainingParticipants)
      .where(eq(trainingParticipants.id, body.id))
      .limit(1);
    if (!current || current.archived) {
      return jsonResponse({ error: "참여인력을 찾을 수 없습니다." }, { status: 404 });
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
      d1.prepare(`UPDATE training_participants SET
        archived = 1, updated_by_email = ?, updated_by_name = ?, updated_at = ?
      WHERE id = ? AND archived = 0`).bind(user.email, user.displayName, now, body.id),
      d1.prepare(`INSERT INTO audit_logs (
        record_id, entity_type, action, summary, changed_by_email, changed_by_name, snapshot, created_at
      ) VALUES (?, 'training_participant', 'deleted', ?, ?, ?, ?, ?)`).bind(
        body.id,
        `${current.name} 참여인력을 삭제했습니다.`,
        user.email,
        user.displayName,
        JSON.stringify(snapshot),
        now,
      ),
    ]);

    return jsonResponse({ deleted: true, id: body.id });
  } catch (error) {
    console.error("participant delete error", error);
    return jsonResponse({ error: "참여인력을 삭제하지 못했습니다." }, { status: 500 });
  }
}

function validateInput(body: MutationBody): ParticipantInput | Response {
  const name = clean(body.name, 80);
  if (!name) return jsonResponse({ error: "이름을 입력해 주세요." }, { status: 400 });

  const school = clean(body.school, 100);
  if (!school) return jsonResponse({ error: "학교를 입력해 주세요." }, { status: 400 });

  if (!isDegreeCourse(body.degreeCourse)) {
    return jsonResponse({ error: "학위과정을 선택해 주세요." }, { status: 400 });
  }

  const participationStart = clean(body.participationStart, 10);
  const participationEnd = clean(body.participationEnd, 10);
  const graduationDate = clean(body.graduationDate, 10);
  if (!isProjectDate(participationStart)) {
    return jsonResponse({ error: "참여 시작일을 과제 수행기간 안에서 선택해 주세요." }, { status: 400 });
  }
  if (participationEnd && (!isProjectDate(participationEnd) || participationEnd < participationStart)) {
    return jsonResponse({ error: "참여 종료일은 시작일 이후로 선택해 주세요." }, { status: 400 });
  }
  if (
    graduationDate &&
    (!isProjectDate(graduationDate) ||
      graduationDate < participationStart ||
      (participationEnd && graduationDate > participationEnd))
  ) {
    return jsonResponse({ error: "졸업(배출)일은 참여기간 안에서 선택해 주세요." }, { status: 400 });
  }

  return {
    name,
    school,
    degreeCourse: body.degreeCourse,
    participationStart,
    participationEnd,
    graduationDate,
    project: clean(body.project, 80),
    role: clean(body.role, 100),
    notes: clean(body.notes, 2000),
  };
}

function isProjectDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "2026-07-01" && value <= "2031-12-31";
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function changedFieldLabels(
  current: typeof trainingParticipants.$inferSelect,
  input: ParticipantInput,
) {
  const fields: Array<[keyof ParticipantInput, string]> = [
    ["name", "이름"],
    ["school", "학교"],
    ["degreeCourse", "학위과정"],
    ["participationStart", "참여 시작일"],
    ["participationEnd", "참여 종료일"],
    ["graduationDate", "졸업(배출)일"],
    ["project", "연구 프로젝트"],
    ["role", "참여 역할"],
    ["notes", "메모"],
  ];
  return fields
    .filter(([field]) => String(current[field]) !== String(input[field]))
    .map(([, label]) => label);
}

function unauthorized() {
  return jsonResponse({ error: "참여인력을 관리하려면 사용자 승인이 필요합니다." }, { status: 403 });
}

function serverError() {
  return jsonResponse({ error: "참여인력을 저장하지 못했습니다." }, { status: 500 });
}
