import { useState, type FormEvent } from "react";
import { GITHUB_PAGES_BASE_PATH } from "../../lib/api-client";
import { getSupabaseClient } from "../../lib/supabase-client";

export default function AuthCard({
  initialError,
  onAuthenticated,
}: {
  initialError?: string;
  onAuthenticated: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        onAuthenticated();
        return;
      }

      const name = displayName.trim();
      if (!name) throw new Error("이름을 입력해 주세요.");

      const redirectUrl = new URL(GITHUB_PAGES_BASE_PATH, window.location.origin).href;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { display_name: name },
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        const { error: requestError } = await supabase.rpc("request_access", {
          requested_display_name: name,
        });
        if (requestError) throw requestError;
        onAuthenticated();
        return;
      }

      setNotice("가입 확인 메일을 보냈습니다. 메일의 링크로 본인 확인을 마치면 승인 요청을 보낼 수 있습니다.");
    } catch (authenticationError) {
      setError(authErrorMessage(authenticationError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  return (
    <main className="access-shell">
      <section className="access-card auth-card" aria-labelledby="supabase-login-title">
        <Brand />
        <span className="access-status">보호된 스코어보드</span>
        <h1 id="supabase-login-title">{mode === "signin" ? "로그인" : "가입 승인 요청"}</h1>
        <p>
          {mode === "signin"
            ? "승인된 계정으로 로그인하면 공동 성과 데이터와 변경 이력을 확인할 수 있습니다."
            : "계정을 만든 뒤 이메일 본인 확인과 관리자 승인을 거쳐 스코어보드에 참여할 수 있습니다."}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="계정 작업 선택">
          <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => changeMode("signin")}>로그인</button>
          <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => changeMode("signup")}>가입 요청</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" ? (
            <label>
              <span>이름</span>
              <input
                autoComplete="name"
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="홍길동"
                required
                value={displayName}
              />
            </label>
          ) : null}
          <label>
            <span>이메일</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>비밀번호</span>
            <input
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상"
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="form-error access-error" role="alert">{error}</p> : null}
          {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "처리 중…" : mode === "signin" ? "로그인" : "계정 만들기"}
          </button>
        </form>
        <p className="auth-provider-note">인증은 Supabase Auth로 처리되며 비밀번호는 이 사이트나 GitHub에 저장되지 않습니다.</p>
      </section>
    </main>
  );
}

export function Brand() {
  return (
    <div className="access-brand">
      <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
      <span><b>AI STAR</b><small>성과 스코어보드</small></span>
    </div>
  );
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "로그인을 처리하지 못했습니다.";
  if (/invalid login credentials/i.test(message)) return "이메일 또는 비밀번호를 확인해 주세요.";
  if (/email not confirmed/i.test(message)) return "이메일 본인 확인이 필요합니다. 받은 메일의 링크를 먼저 열어 주세요.";
  if (/user already registered/i.test(message)) return "이미 가입된 이메일입니다. 로그인 탭을 이용해 주세요.";
  if (/password/i.test(message) && /characters|length|weak/i.test(message)) return "비밀번호는 8자 이상으로 입력해 주세요.";
  return message;
}
