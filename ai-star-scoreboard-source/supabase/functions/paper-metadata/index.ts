import { extractMetadata } from "./metadata.ts";
const origins = new Set([
  "https://ycyoon.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origins.has(origin)
      ? origin
      : "https://ycyoon.github.io",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin))
    return reply({ error: "허용되지 않은 요청입니다." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply({ error: "POST 요청이 필요합니다." }, 405);
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    return reply({ error: "로그인이 필요합니다." }, 401);
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeaders = { Authorization: authorization, apikey: key };
  try {
    const verified = await fetch(`${base}/auth/v1/user`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(8000),
    });
    if (!verified.ok) return reply({ error: "다시 로그인해 주세요." }, 401);
    const user = await verified.json();
    if (!user.id) return reply({ error: "로그인이 필요합니다." }, 401);
    const access = await fetch(`${base}/rest/v1/rpc/get_access_context`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    const context = access.ok ? await access.json() : null;
    if (!["owner", "approved"].includes(context?.status))
      return reply({ error: "가입 승인이 필요합니다." }, 403);
    if (Number(req.headers.get("content-length") ?? 0) > 4096)
      return reply({ error: "요청이 너무 큽니다." }, 413);
    const raw = await req.text();
    if (raw.length > 4096) return reply({ error: "요청이 너무 큽니다." }, 413);
    const { url } = JSON.parse(raw);
    if (typeof url !== "string")
      return reply({ error: "논문 링크를 입력해 주세요." }, 400);
    const paper = await extractMetadata(url);
    return reply({
      paper,
      message:
        "자동 추출한 정보입니다. 학회·저널명과 키워드를 확인한 뒤 저장해 주세요.",
    });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof Error
            ? e.message
            : "정보를 가져오지 못했습니다. 직접 입력할 수 있습니다.",
      },
      400,
    );
  }
});
