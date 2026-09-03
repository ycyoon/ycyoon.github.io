import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import AccessRequestClient from "../../app/access-request-client";
import ScoreboardClient from "../../app/scoreboard-client";
import type { AccessStatus } from "../../lib/access";
import {
  apiFetch,
  clearExternalSession,
  EXTERNAL_API_ORIGIN,
  GITHUB_PAGES_BASE_PATH,
  getStoredExternalSession,
  storeExternalSession,
} from "../../lib/api-client";
import "../../app/globals.css";
import "./pages.css";

type ExternalSession = {
  user: { displayName: string; email: string };
  status: AccessStatus;
  isAdmin: boolean;
};

const AUTH_URL = `${EXTERNAL_API_ORIGIN}/github-auth/start`;
const LOGOUT_URL = `${GITHUB_PAGES_BASE_PATH}logout.html`;

function GitHubPagesApp() {
  const [session, setSession] = useState<ExternalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const code = hash.get("code");
        if (code) {
          window.history.replaceState(null, "", GITHUB_PAGES_BASE_PATH);
          const response = await fetch(`${EXTERNAL_API_ORIGIN}/api/github-session`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const payload = (await response.json()) as ExternalSession & {
            token?: string;
            error?: string;
          };
          if (!response.ok || !payload.token) {
            throw new Error(payload.error || "로그인을 완료하지 못했습니다.");
          }
          storeExternalSession(payload.token);
          if (active) {
            setSession({
              user: payload.user,
              status: payload.status,
              isAdmin: payload.isAdmin,
            });
          }
          return;
        }

        if (!getStoredExternalSession()) return;
        const response = await apiFetch("/api/github-session", { cache: "no-store" });
        const payload = (await response.json()) as ExternalSession & { error?: string };
        if (!response.ok) {
          clearExternalSession();
          throw new Error(payload.error || "로그인이 만료되었습니다.");
        }
        if (active) setSession(payload);
      } catch (initializationError) {
        if (active) {
          setError(
            initializationError instanceof Error
              ? initializationError.message
              : "로그인을 확인하지 못했습니다.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="access-shell">
        <section className="access-card github-status-card" aria-live="polite">
          <Brand />
          <span className="github-spinner" aria-hidden="true" />
          <h1>스코어보드를 불러오는 중입니다</h1>
          <p>로그인과 사용자 승인 상태를 안전하게 확인하고 있습니다.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="access-shell">
        <section className="access-card" aria-labelledby="github-login-title">
          <Brand />
          <span className="access-status">보호된 스코어보드</span>
          <h1 id="github-login-title">로그인이 필요합니다</h1>
          <p>
            등록 성과와 참여인력 정보는 승인된 사용자에게만 공개됩니다.
            ChatGPT 계정으로 본인 확인 후 기존 승인 상태를 그대로 사용할 수 있습니다.
          </p>
          {error ? <p className="form-error access-error" role="alert">{error}</p> : null}
          <div className="access-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => window.location.assign(AUTH_URL)}
            >
              ChatGPT 계정으로 로그인
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (session.status !== "owner" && session.status !== "approved") {
    return (
      <AccessRequestClient
        user={session.user}
        initialStatus={session.status}
        signOutPath={LOGOUT_URL}
      />
    );
  }

  return (
    <ScoreboardClient
      user={session.user}
      isAdmin={session.isAdmin}
      signInPath={AUTH_URL}
      signOutPath={LOGOUT_URL}
    />
  );
}

function Brand() {
  return (
    <div className="access-brand">
      <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
      <span><b>AI STAR</b><small>성과 스코어보드</small></span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<GitHubPagesApp />);
