"use client";

import { useState } from "react";
import type { AccessStatus } from "../lib/access";
import { apiFetch } from "../lib/api-client";

export default function AccessRequestClient({
  user,
  initialStatus,
  signOutPath,
}: {
  user: { displayName: string; email: string };
  initialStatus: AccessStatus;
  signOutPath: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function requestAccess() {
    setError("");
    setIsSubmitting(true);
    try {
      const response = await apiFetch("/api/access", { method: "POST" });
      const payload = (await response.json()) as { status?: AccessStatus; error?: string };
      if (!response.ok) throw new Error(payload.error || "승인 요청을 보내지 못했습니다.");
      setStatus(payload.status ?? "pending");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "승인 요청을 보내지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPending = status === "pending";
  return (
    <main className="access-shell">
      <section className="access-card" aria-labelledby="access-title">
        <div className="access-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span><b>AI STAR</b><small>성과 스코어보드</small></span></div>
        <span className={`access-status status-${status}`}>{isPending ? "승인 대기" : status === "rejected" ? "재요청 가능" : "접근 권한 필요"}</span>
        <h1 id="access-title">관리자 승인이 필요합니다</h1>
        <p>사업 성과와 참여인력 정보 보호를 위해 승인된 사용자만 스코어보드에 접속할 수 있습니다.</p>
        <div className="request-user"><span>{Array.from(user.displayName)[0]}</span><div><b>{user.displayName}</b><small>{user.email}</small></div></div>
        {isPending ? (
          <div className="pending-callout"><b>가입 승인 요청을 보냈습니다.</b><span>관리자가 승인한 뒤 아래 버튼으로 상태를 다시 확인해 주세요.</span></div>
        ) : status === "rejected" ? (
          <div className="rejected-callout"><b>이전 요청이 승인되지 않았습니다.</b><span>필요한 경우 관리자에게 확인한 뒤 다시 요청할 수 있습니다.</span></div>
        ) : null}
        {error ? <p className="form-error access-error" role="alert">{error}</p> : null}
        <div className="access-actions">
          {isPending ? <button className="primary-button" type="button" onClick={() => window.location.reload()}>승인 상태 확인</button> : <button className="primary-button" type="button" disabled={isSubmitting} onClick={() => void requestAccess()}>{isSubmitting ? "요청 중…" : "가입 승인 요청"}</button>}
          <a href={signOutPath}>다른 계정으로 로그인</a>
        </div>
      </section>
    </main>
  );
}
