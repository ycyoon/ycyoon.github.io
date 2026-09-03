import { getSupabaseClient } from "./supabase-client";

type JsonRecord = Record<string, unknown>;

export async function supabaseApiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  if (typeof input !== "string") {
    return jsonResponse({ error: "지원하지 않는 요청입니다." }, 400);
  }

  const url = new URL(input, window.location.origin);
  const method = (init.method ?? "GET").toUpperCase();

  try {
    if (url.pathname === "/api/dashboard" && method === "GET") {
      return await getDashboard();
    }
    if (url.pathname === "/api/history" && method === "GET") {
      return await getHistory(url.searchParams.get("recordId") ?? "");
    }
    if (url.pathname === "/api/records") {
      return await mutateRecord(method, init.body);
    }
    if (url.pathname === "/api/participants") {
      return await mutateParticipant(method, init.body);
    }
    if (url.pathname === "/api/access") {
      return await handleAccess(method, init.body);
    }

    return jsonResponse({ error: "지원하지 않는 API 경로입니다." }, 404);
  } catch (error) {
    console.error("Supabase API error", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." },
      500,
    );
  }
}

async function getDashboard() {
  const supabase = getSupabaseClient();
  const [targets, records, participants, activity] = await Promise.all([
    supabase.from("annual_targets").select("*").order("year", { ascending: true }),
    supabase
      .from("performance_records")
      .select("*")
      .eq("archived", false)
      .order("updated_at", { ascending: false }),
    supabase
      .from("training_participants")
      .select("*")
      .eq("archived", false)
      .order("updated_at", { ascending: false }),
    supabase.from("audit_logs").select("*").order("id", { ascending: false }).limit(30),
  ]);

  const error = targets.error ?? records.error ?? participants.error ?? activity.error;
  if (error) return databaseError(error, "성과 데이터를 불러오지 못했습니다.");

  return jsonResponse({
    targets: (targets.data ?? []).map(mapTarget),
    records: (records.data ?? []).map(mapRecord),
    participants: (participants.data ?? []).map(mapParticipant),
    activity: (activity.data ?? []).map(mapAuditLog),
  });
}

async function getHistory(recordId: string) {
  if (!recordId) return jsonResponse({ error: "성과 식별자가 필요합니다." }, 400);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("record_id", recordId)
    .order("id", { ascending: false })
    .limit(500);
  if (error) return databaseError(error, "변경 이력을 불러오지 못했습니다.");
  return jsonResponse({ history: (data ?? []).map(mapAuditLog) });
}

async function mutateRecord(method: string, rawBody: BodyInit | null | undefined) {
  const body = await parseBody(rawBody);
  if (body instanceof Response) return body;
  const supabase = getSupabaseClient();

  if (method === "POST") {
    const id = crypto.randomUUID();
    const { data, error } = await supabase
      .from("performance_records")
      .insert({ id, ...recordRow(body) })
      .select("*")
      .single();
    if (error) return databaseError(error, "성과를 저장하지 못했습니다.");
    return jsonResponse({ record: mapRecord(data) }, 201);
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return jsonResponse({ error: "대상 성과를 확인할 수 없습니다." }, 400);

  if (method === "PATCH") {
    const { data, error } = await supabase
      .from("performance_records")
      .update(recordRow(body))
      .eq("id", id)
      .eq("archived", false)
      .select("*")
      .single();
    if (error) return databaseError(error, "성과를 수정하지 못했습니다.");
    return jsonResponse({ record: mapRecord(data) });
  }

  if (method === "DELETE") {
    const { data, error } = await supabase
      .from("performance_records")
      .update({ archived: true })
      .eq("id", id)
      .eq("archived", false)
      .select("id")
      .single();
    if (error) return databaseError(error, "성과를 삭제하지 못했습니다.");
    return jsonResponse({ deleted: true, id: data.id });
  }

  return jsonResponse({ error: "지원하지 않는 요청입니다." }, 405);
}

async function mutateParticipant(method: string, rawBody: BodyInit | null | undefined) {
  const body = await parseBody(rawBody);
  if (body instanceof Response) return body;
  const supabase = getSupabaseClient();

  if (method === "POST") {
    const id = crypto.randomUUID();
    const { data, error } = await supabase
      .from("training_participants")
      .insert({ id, ...participantRow(body) })
      .select("*")
      .single();
    if (error) return databaseError(error, "참여인력을 저장하지 못했습니다.");
    return jsonResponse({ participant: mapParticipant(data) }, 201);
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return jsonResponse({ error: "대상 참여인력을 확인할 수 없습니다." }, 400);

  if (method === "PATCH") {
    const { data, error } = await supabase
      .from("training_participants")
      .update(participantRow(body))
      .eq("id", id)
      .eq("archived", false)
      .select("*")
      .single();
    if (error) return databaseError(error, "참여인력을 수정하지 못했습니다.");
    return jsonResponse({ participant: mapParticipant(data) });
  }

  if (method === "DELETE") {
    const { data, error } = await supabase
      .from("training_participants")
      .update({ archived: true })
      .eq("id", id)
      .eq("archived", false)
      .select("id")
      .single();
    if (error) return databaseError(error, "참여인력을 삭제하지 못했습니다.");
    return jsonResponse({ deleted: true, id: data.id });
  }

  return jsonResponse({ error: "지원하지 않는 요청입니다." }, 405);
}

async function handleAccess(method: string, rawBody: BodyInit | null | undefined) {
  const supabase = getSupabaseClient();

  if (method === "GET") {
    const { data, error } = await supabase
      .from("access_requests")
      .select("email, display_name, status, requested_at, reviewed_at, reviewed_by_name")
      .order("requested_at", { ascending: false });
    if (error) return databaseError(error, "가입 요청을 불러오지 못했습니다.");
    return jsonResponse({ requests: (data ?? []).map(mapAccessRequest) });
  }

  if (method === "POST") {
    const { data, error } = await supabase.rpc("request_access", {
      requested_display_name: null,
    });
    if (error) return databaseError(error, "가입 승인 요청을 보내지 못했습니다.");
    const request = mapAccessRequest(data as JsonRecord);
    return jsonResponse({ status: request.status, request });
  }

  if (method === "PATCH") {
    const body = await parseBody(rawBody);
    if (body instanceof Response) return body;
    const email = typeof body.email === "string" ? body.email : "";
    const status = body.status === "approved" || body.status === "rejected" ? body.status : "";
    if (!email || !status) return jsonResponse({ error: "승인 요청 정보를 확인해 주세요." }, 400);

    const { data, error } = await supabase.rpc("review_access_request", {
      target_email: email,
      new_status: status,
    });
    if (error) return databaseError(error, "가입 요청을 처리하지 못했습니다.");
    return jsonResponse({ request: mapAccessRequest(data as JsonRecord) });
  }

  return jsonResponse({ error: "지원하지 않는 요청입니다." }, 405);
}

function recordRow(body: JsonRecord) {
  return {
    metric_type: body.metricType,
    acknowledgement_count: body.acknowledgementCount,
    year: body.year,
    title: body.title,
    organization: body.organization,
    project: body.project || "",
    achievement_date: body.achievementDate || null,
    identifier: body.identifier || "",
    url: body.url || null,
    notes: body.notes || "",
  };
}

function participantRow(body: JsonRecord) {
  return {
    name: body.name,
    school: body.school,
    degree_course: body.degreeCourse,
    participation_start: body.participationStart || null,
    participation_end: body.participationEnd || null,
    graduation_date: body.graduationDate || null,
    project: body.project || "",
    role: body.role || "",
    notes: body.notes || "",
  };
}

function mapTarget(row: JsonRecord) {
  return {
    year: row.year,
    stage: row.stage,
    paperSci: row.paper_sci,
    paperTop: row.paper_top,
    patentApplicationDomestic: row.patent_application_domestic,
    patentApplicationInternational: row.patent_application_international,
    patentRegistrationDomestic: row.patent_registration_domestic,
    patentRegistrationInternational: row.patent_registration_international,
    openSource: row.open_source,
    beneficiaryBachelor: row.beneficiary_bachelor,
    beneficiaryMaster: row.beneficiary_master,
    beneficiaryDoctor: row.beneficiary_doctor,
    graduateMaster: row.graduate_master,
    graduateDoctor: row.graduate_doctor,
  };
}

function mapRecord(row: JsonRecord) {
  return {
    id: row.id,
    metricType: row.metric_type,
    acknowledgementCount: row.acknowledgement_count,
    year: row.year,
    title: row.title,
    organization: row.organization,
    project: row.project ?? "",
    achievementDate: row.achievement_date ?? "",
    identifier: row.identifier ?? "",
    url: row.url ?? "",
    notes: row.notes ?? "",
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    updatedByEmail: row.updated_by_email,
    updatedByName: row.updated_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: row.archived,
  };
}

function mapParticipant(row: JsonRecord) {
  return {
    id: row.id,
    name: row.name,
    school: row.school,
    degreeCourse: row.degree_course,
    participationStart: row.participation_start ?? "",
    participationEnd: row.participation_end ?? "",
    graduationDate: row.graduation_date ?? "",
    project: row.project ?? "",
    role: row.role ?? "",
    notes: row.notes ?? "",
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    updatedByEmail: row.updated_by_email,
    updatedByName: row.updated_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archived: row.archived,
  };
}

function mapAuditLog(row: JsonRecord) {
  return {
    id: row.id,
    recordId: row.record_id,
    entityType: row.entity_type,
    action: row.action,
    summary: row.summary,
    changedByEmail: row.changed_by_email,
    changedByName: row.changed_by_name,
    snapshot: typeof row.snapshot === "string" ? row.snapshot : JSON.stringify(row.snapshot ?? {}),
    createdAt: row.created_at,
  };
}

function mapAccessRequest(row: JsonRecord) {
  return {
    email: String(row.email ?? ""),
    displayName: String(row.display_name ?? "사용자"),
    status: String(row.status ?? "none"),
    requestedAt: String(row.requested_at ?? ""),
    reviewedAt: String(row.reviewed_at ?? ""),
    reviewedByName: String(row.reviewed_by_name ?? ""),
  };
}

async function parseBody(rawBody: BodyInit | null | undefined): Promise<JsonRecord | Response> {
  if (typeof rawBody !== "string") {
    return jsonResponse({ error: "요청 본문을 확인할 수 없습니다." }, 400);
  }
  try {
    const value = JSON.parse(rawBody) as unknown;
    return value && typeof value === "object" ? (value as JsonRecord) : jsonResponse({ error: "요청 본문이 올바르지 않습니다." }, 400);
  } catch {
    return jsonResponse({ error: "요청 본문이 올바르지 않습니다." }, 400);
  }
}

function databaseError(error: { code?: string; message?: string }, fallback: string) {
  console.error("Supabase database error", error);
  if (error.code === "42501" || error.code === "PGRST301") {
    return jsonResponse({ error: "이 작업을 수행할 권한이 없습니다." }, 403);
  }
  if (error.code === "PGRST116") {
    return jsonResponse({ error: "대상을 찾을 수 없습니다." }, 404);
  }
  return jsonResponse({ error: fallback }, 400);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
