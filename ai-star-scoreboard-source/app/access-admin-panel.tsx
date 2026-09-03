"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api-client";

type AccessRequestRow = {
  email: string;
  displayName: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt: string;
  reviewedByName: string;
};

export default function AccessAdminPanel() {
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingEmail, setProcessingEmail] = useState("");
  const [error, setError] = useState("");

  async function loadRequests() {
    setError("");
    try {
      const response = await apiFetch("/api/access", { cache: "no-store" });
      const payload = (await response.json()) as { requests?: AccessRequestRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "가입 요청을 불러오지 못했습니다.");
      setRequests(payload.requests ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "가입 요청을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequests(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function review(email: string, status: "approved" | "rejected") {
    setError("");
    setProcessingEmail(email);
    try {
      const response = await apiFetch("/api/access", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, status }),
      });
      const payload = (await response.json()) as { request?: AccessRequestRow; error?: string };
      if (!response.ok || !payload.request) throw new Error(payload.error || "가입 요청을 처리하지 못했습니다.");
      setRequests((current) => current.map((item) => item.email === email ? payload.request! : item));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "가입 요청을 처리하지 못했습니다.");
    } finally {
      setProcessingEmail("");
    }
  }

  const pending = useMemo(() => requests.filter((item) => item.status === "pending"), [requests]);
  const approved = useMemo(() => requests.filter((item) => item.status === "approved"), [requests]);

  return (
    <section className="panel access-admin-panel" id="access-approval">
      <div className="section-heading">
        <div><span className="section-kicker">USER ACCESS</span><h2>사용자 가입 승인</h2><p>가입 요청자의 이름과 계정을 확인한 뒤 스코어보드 접근을 승인합니다.</p></div>
        <span className={`approval-count ${pending.length ? "has-pending" : ""}`}>대기 {pending.length}명</span>
      </div>
      {error ? <p className="form-error admin-error" role="alert">{error}</p> : null}
      {isLoading ? (
        <div className="admin-request-empty">가입 요청을 확인하는 중입니다.</div>
      ) : pending.length ? (
        <div className="approval-list">
          {pending.map((item) => (
            <article className="approval-item" key={item.email}>
              <span className="request-avatar">{Array.from(item.displayName)[0]}</span>
              <div><b>{item.displayName}</b><span>{item.email}</span><small>{formatDateTime(item.requestedAt)} 요청</small></div>
              <div className="approval-actions"><button type="button" disabled={processingEmail === item.email} onClick={() => void review(item.email, "rejected")}>거절</button><button className="approve-button" type="button" disabled={processingEmail === item.email} onClick={() => void review(item.email, "approved")}>{processingEmail === item.email ? "처리 중…" : "승인"}</button></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-request-empty"><b>대기 중인 가입 요청이 없습니다.</b><span>새 요청이 들어오면 이곳에서 바로 승인할 수 있습니다.</span></div>
      )}
      <div className="approved-users"><span>현재 승인 사용자</span><b>{approved.length}명</b>{approved.length ? <small>{approved.map((item) => item.displayName).join(" · ")}</small> : <small>아직 승인된 추가 사용자가 없습니다.</small>}</div>
    </section>
  );
}

function formatDateTime(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
