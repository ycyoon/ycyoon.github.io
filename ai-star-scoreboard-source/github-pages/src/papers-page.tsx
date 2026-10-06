import { useEffect, useState } from "react";
import PaperSharing from "../../app/paper-sharing";
import { apiFetch, GITHUB_PAGES_BASE_PATH } from "../../lib/api-client";
import type { DashboardPayload, PerformanceRecord } from "../../lib/scoreboard";

export default function PapersPage({
  user,
  isAdmin,
  signOutPath,
}: {
  user: { displayName: string; email: string };
  isAdmin: boolean;
  signOutPath: string;
}) {
  const [records, setRecords] = useState<PerformanceRecord[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await apiFetch("/api/dashboard", { cache: "no-store" });
        const data = (await r.json()) as DashboardPayload & { error?: string };
        if (!r.ok)
          throw new Error(data.error || "기존 성과를 불러오지 못했습니다.");
        if (active) setRecords(data.records);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "기존 성과를 불러오지 못했습니다.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="site-shell paper-page">
      <header className="paper-page-header">
        <a className="brand" href={GITHUB_PAGES_BASE_PATH}>
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <b>AI STAR</b>
            <small>논문 공유</small>
          </span>
        </a>
        <nav aria-label="페이지 이동">
          <a className="secondary-button" href={GITHUB_PAGES_BASE_PATH}>
            ← 성과 스코어보드
          </a>
          <span>{user.displayName}</span>
          <a className="text-button" href={signOutPath}>
            로그아웃
          </a>
        </nav>
      </header>
      <div className="paper-page-content">
        {error && (
          <p className="paper-error" role="alert">
            {error} 공유 논문은 직접 등록할 수 있습니다.
          </p>
        )}
        <PaperSharing
          userEmail={user.email}
          isAdmin={isAdmin}
          records={records}
        />
      </div>
    </main>
  );
}
