import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import AccessRequestClient from "../../app/access-request-client";
import ScoreboardClient from "../../app/scoreboard-client";
import type { AccessStatus } from "../../lib/access";
import { GITHUB_PAGES_BASE_PATH } from "../../lib/api-client";
import {
  getSupabaseAccessContext,
  getSupabaseClient,
} from "../../lib/supabase-client";
import AuthCard, { Brand } from "./auth-card";
import "../../app/globals.css";
import "./pages.css";

type AppSession = {
  user: { displayName: string; email: string };
  status: AccessStatus;
  isAdmin: boolean;
};

const APP_URL = GITHUB_PAGES_BASE_PATH;
const LOGOUT_URL = `${GITHUB_PAGES_BASE_PATH}?logout=1`;

function GitHubPagesApp() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const supabase = getSupabaseClient();
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get("logout") === "1") {
          await supabase.auth.signOut();
          window.history.replaceState(null, "", APP_URL);
          if (active) setSession(null);
          return;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
          if (active) setSession(null);
          return;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user?.email) {
          if (active) setSession(null);
          return;
        }

        const context = await getSupabaseAccessContext();
        if (active) {
          setSession({
            user: {
              displayName: context.displayName,
              email: userData.user.email,
            },
            status: context.status,
            isAdmin: context.isAdmin,
          });
        }
      } catch (initializationError) {
        if (active) {
          setError(
            initializationError instanceof Error
              ? initializationError.message
              : "로그인 상태를 확인하지 못했습니다.",
          );
          setSession(null);
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
          <p>Supabase 로그인과 사용자 승인 상태를 안전하게 확인하고 있습니다.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthCard
        initialError={error}
        onAuthenticated={() => window.location.assign(APP_URL)}
      />
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
      signInPath={APP_URL}
      signOutPath={LOGOUT_URL}
    />
  );
}

createRoot(document.getElementById("root")!).render(<GitHubPagesApp />);
