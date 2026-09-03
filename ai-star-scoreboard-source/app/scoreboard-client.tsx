"use client";

import { useEffect, useMemo, useState } from "react";
import AccessAdminPanel from "./access-admin-panel";
import TrainingSection from "./training-section";
import { apiFetch } from "../lib/api-client";
import {
  COUNTED_PAPER_METRICS,
  OTHER_PAPER_METRICS,
  creditedAmount,
  creditedAmountLabel,
  countsTowardScoreboard,
  isCountedPaperMetric,
  isLegacyPaperMetric,
  isOtherPaperMetric,
  isPaperMetric,
  METRIC_TYPES,
  metricGroups,
  metricLabels,
  targetForMetric,
  type AnnualTarget,
  type AuditLog,
  type DashboardPayload,
  type MetricType,
  type PerformanceRecord,
  type RecordInput,
} from "../lib/scoreboard";

type UserInfo = { displayName: string; email: string } | null;
type GroupKey = keyof typeof metricGroups;
type HistoryEntity = {
  id: string;
  title: string;
  entityType: "performance" | "training_participant";
};

const fallbackTargets: AnnualTarget[] = [
  { year: 2026, stage: 1, paperSci: 0, paperTop: 8, patentApplicationDomestic: 10, patentApplicationInternational: 0, patentRegistrationDomestic: 0, patentRegistrationInternational: 0, openSource: 10, beneficiaryBachelor: 10, beneficiaryMaster: 20, beneficiaryDoctor: 10, graduateMaster: 0, graduateDoctor: 0 },
  { year: 2027, stage: 1, paperSci: 6, paperTop: 16, patentApplicationDomestic: 12, patentApplicationInternational: 4, patentRegistrationDomestic: 0, patentRegistrationInternational: 0, openSource: 15, beneficiaryBachelor: 15, beneficiaryMaster: 30, beneficiaryDoctor: 10, graduateMaster: 20, graduateDoctor: 2 },
  { year: 2028, stage: 2, paperSci: 9, paperTop: 20, patentApplicationDomestic: 15, patentApplicationInternational: 6, patentRegistrationDomestic: 6, patentRegistrationInternational: 0, openSource: 20, beneficiaryBachelor: 15, beneficiaryMaster: 30, beneficiaryDoctor: 10, graduateMaster: 25, graduateDoctor: 4 },
  { year: 2029, stage: 2, paperSci: 15, paperTop: 26, patentApplicationDomestic: 18, patentApplicationInternational: 8, patentRegistrationDomestic: 8, patentRegistrationInternational: 2, openSource: 25, beneficiaryBachelor: 20, beneficiaryMaster: 30, beneficiaryDoctor: 10, graduateMaster: 25, graduateDoctor: 6 },
  { year: 2030, stage: 3, paperSci: 20, paperTop: 30, patentApplicationDomestic: 20, patentApplicationInternational: 10, patentRegistrationDomestic: 10, patentRegistrationInternational: 4, openSource: 30, beneficiaryBachelor: 20, beneficiaryMaster: 30, beneficiaryDoctor: 10, graduateMaster: 25, graduateDoctor: 8 },
  { year: 2031, stage: 3, paperSci: 24, paperTop: 40, patentApplicationDomestic: 20, patentApplicationInternational: 12, patentRegistrationDomestic: 12, patentRegistrationInternational: 6, openSource: 40, beneficiaryBachelor: 20, beneficiaryMaster: 30, beneficiaryDoctor: 10, graduateMaster: 25, graduateDoctor: 10 },
];

const summaryMeta: Array<{
  key: GroupKey;
  eyebrow: string;
  label: string;
  accent: string;
  details: Array<{ label: string; metric: MetricType }>;
}> = [
  {
    key: "paper",
    eyebrow: "PAPERS",
    label: "목표 반영 논문",
    accent: "mint",
    details: [
      { label: "JCR 상위 10%", metric: "paper_jcr_top10" },
      { label: "인정 Top-tier", metric: "conference_top_tier" },
    ],
  },
  {
    key: "application",
    eyebrow: "PATENT APPLICATIONS",
    label: "특허 출원",
    accent: "blue",
    details: [
      { label: "국내", metric: "patent_application_domestic" },
      { label: "국외", metric: "patent_application_international" },
    ],
  },
  {
    key: "registration",
    eyebrow: "PATENT REGISTRATIONS",
    label: "특허 등록",
    accent: "violet",
    details: [
      { label: "국내", metric: "patent_registration_domestic" },
      { label: "국외", metric: "patent_registration_international" },
    ],
  },
  {
    key: "software",
    eyebrow: "OPEN SOURCE",
    label: "공개SW",
    accent: "coral",
    details: [{ label: "공개 릴리스", metric: "open_source" }],
  },
];

const groupLabels: Record<"all" | GroupKey, string> = {
  all: "전체",
  paper: "목표 반영 논문",
  otherPaper: "기타 논문",
  application: "특허 출원",
  registration: "특허 등록",
  software: "공개SW",
};

const organizationOptions = ["제주대학교", "건국대학교", "공동", "기타"];
const projectOptions = [
  ["", "선택 안 함"],
  ["프로젝트 1", "프로젝트 1 · 공통원천"],
  ["프로젝트 2", "프로젝트 2 · 보안실증"],
  ["프로젝트 3", "프로젝트 3 · 의료실증"],
  ["공통 운영", "공통 운영"],
];
const acknowledgementOptions = Array.from({ length: 10 }, (_, index) => index + 1);

const otherPaperBoardMeta: Array<{
  label: string;
  shortLabel: string;
  metric: (typeof OTHER_PAPER_METRICS)[number];
}> = [
  { label: "SCIE Q1 논문", shortLabel: "SCIE Q1", metric: "paper_scie_q1" },
  { label: "그 외 SCIE 논문", shortLabel: "기타 SCIE", metric: "paper_scie_other" },
  { label: "그 외 Top-tier 학술대회", shortLabel: "그 외 Top-tier", metric: "conference_other_top_tier" },
];

function emptyInput(year = 2026): RecordInput {
  return {
    metricType: "conference_top_tier",
    acknowledgementCount: 1,
    year,
    title: "",
    organization: "제주대학교",
    project: "",
    achievementDate: "",
    identifier: "",
    url: "",
    notes: "",
  };
}

function MetricCell({
  primary,
  secondary,
  primaryActual = 0,
  secondaryActual = 0,
  primaryLabel,
  secondaryLabel,
}: {
  primary: number;
  secondary?: number;
  primaryActual?: number;
  secondaryActual?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const total = primary + (secondary ?? 0);
  const actual = primaryActual + (secondary === undefined ? 0 : secondaryActual);
  return (
    <div className="metric-cell">
      <strong><b>{formatAmount(actual)}</b><i>/</i>{total}</strong>
      {secondary !== undefined ? (
        <span>
          {primaryLabel} {formatAmount(primaryActual)}/{primary}
          <i>·</i>
          {secondaryLabel} {formatAmount(secondaryActual)}/{secondary}
        </span>
      ) : (
        <span>실적 / 목표</span>
      )}
    </div>
  );
}

export default function ScoreboardClient({
  user,
  isAdmin,
  signInPath,
  signOutPath,
}: {
  user: UserInfo;
  isAdmin: boolean;
  signInPath: string;
  signOutPath: string;
}) {
  const [data, setData] = useState<DashboardPayload>({
    targets: fallbackTargets,
    records: [],
    participants: [],
    activity: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedGroup, setSelectedGroup] = useState<"all" | GroupKey>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceRecord | null>(null);
  const [form, setForm] = useState<RecordInput>(emptyInput());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [historyEntity, setHistoryEntity] = useState<HistoryEntity | null>(null);
  const [historyItems, setHistoryItems] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [deletingRecord, setDeletingRecord] = useState<PerformanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function loadDashboard() {
    setLoadError("");
    try {
      const response = await apiFetch("/api/dashboard", { cache: "no-store" });
      const payload = (await response.json()) as DashboardPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "데이터를 불러오지 못했습니다.");
      setData(payload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!modalOpen && !historyEntity && !deletingRecord) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalOpen(false);
        setHistoryEntity(null);
        if (!isDeleting) setDeletingRecord(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalOpen, historyEntity, deletingRecord, isDeleting]);

  const visibleTargets = useMemo(
    () => data.targets.filter((target) => selectedYear === "all" || target.year === selectedYear),
    [data.targets, selectedYear],
  );

  const recordsForYear = useMemo(
    () => data.records.filter((record) => selectedYear === "all" || record.year === selectedYear),
    [data.records, selectedYear],
  );

  const otherPaperRecordsForYear = useMemo(
    () => recordsForYear.filter((record) => isOtherPaperMetric(record.metricType)),
    [recordsForYear],
  );

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ko");
    return recordsForYear.filter((record) => {
      const groupMatch =
        selectedGroup === "all" || metricGroups[selectedGroup].includes(record.metricType);
      const queryMatch =
        !query ||
        [record.title, record.identifier, record.organization, record.project, record.updatedByName]
          .some((value) => value.toLocaleLowerCase("ko").includes(query));
      return groupMatch && queryMatch;
    });
  }, [recordsForYear, search, selectedGroup]);

  const summary = useMemo(() => {
    return summaryMeta.map((meta) => {
      const target = visibleTargets.reduce(
        (sum, row) => sum + metricGroups[meta.key].reduce((subtotal, metric) => subtotal + targetForMetric(row, metric), 0),
        0,
      );
      const actual = sumCreditedAmount(
        recordsForYear.filter((record) => metricGroups[meta.key].includes(record.metricType)),
      );
      return { ...meta, target, actual };
    });
  }, [recordsForYear, visibleTargets]);

  const targetGrandTotal = visibleTargets.reduce((sum, target) => {
    return sum + METRIC_TYPES.reduce((subtotal, metric) => subtotal + targetForMetric(target, metric), 0);
  }, 0);

  const legacyPaperActual = sumCreditedAmount(
    otherPaperRecordsForYear.filter((record) => isLegacyPaperMetric(record.metricType)),
  );

  function actualForMetric(year: number, metric: MetricType) {
    return sumCreditedAmount(
      data.records.filter((record) => record.year === year && record.metricType === metric),
    );
  }

  function actualForSelectedYears(metric: MetricType) {
    return sumCreditedAmount(recordsForYear.filter((record) => record.metricType === metric));
  }

  function openCreate() {
    if (!user) {
      window.location.assign(signInPath);
      return;
    }
    setEditing(null);
    setForm(emptyInput(selectedYear === "all" ? 2026 : selectedYear));
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(record: PerformanceRecord) {
    if (!user) {
      window.location.assign(signInPath);
      return;
    }
    setEditing(record);
    setForm({
      metricType: record.metricType,
      acknowledgementCount: record.acknowledgementCount,
      year: record.year,
      title: record.title,
      organization: record.organization,
      project: record.project,
      achievementDate: record.achievementDate,
      identifier: record.identifier,
      url: record.url,
      notes: record.notes,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function openHistory(entity: HistoryEntity) {
    setHistoryEntity(entity);
    setHistoryItems([]);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await apiFetch(`/api/history?recordId=${encodeURIComponent(entity.id)}`, { cache: "no-store" });
      const payload = (await response.json()) as { history?: AuditLog[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "변경 이력을 불러오지 못했습니다.");
      setHistoryItems(payload.history ?? []);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "변경 이력을 불러오지 못했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);
    try {
      const response = await apiFetch("/api/records", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "저장하지 못했습니다.");
      setModalOpen(false);
      setEditing(null);
      setToast(editing ? "성과 정보와 변경 이력을 업데이트했습니다." : "새 성과를 등록했습니다.");
      await loadDashboard();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function askDelete(record: PerformanceRecord) {
    setModalOpen(false);
    setHistoryEntity(null);
    setEditing(null);
    setDeleteError("");
    setDeletingRecord(record);
  }

  async function deleteRecord() {
    if (!deletingRecord) return;
    setDeleteError("");
    setIsDeleting(true);
    try {
      const response = await apiFetch("/api/records", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: deletingRecord.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "삭제하지 못했습니다.");
      setDeletingRecord(null);
      setToast("성과를 삭제했습니다. 목표 달성 건수와 변경 이력이 갱신되었습니다.");
      await loadDashboard();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  function exportCsv() {
    const header = ["연차", "성과 유형", "성과 보드", "목표 스코어보드 반영", "공동사사 과제 수", "인정 실적(건)", "성과명", "수행기관", "프로젝트", "성과일", "식별번호", "증빙 링크", "최종 수정자", "최종 수정일"];
    const rows = visibleRecords.map((record) => [
      record.year,
      metricLabels[record.metricType],
      isOtherPaperMetric(record.metricType) ? "기타 논문" : "정량성과",
      countsTowardScoreboard(record.metricType) ? "반영" : "미반영",
      isPaperMetric(record.metricType) ? record.acknowledgementCount : "",
      formatAmount(creditedAmount(record), 6),
      record.title,
      record.organization,
      record.project,
      record.achievementDate,
      record.identifier,
      record.url,
      `${record.updatedByName} (${record.updatedByEmail})`,
      record.updatedAt,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `AI_Star_성과_${selectedYear === "all" ? "전체" : selectedYear}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const recentActivity = activityExpanded ? data.activity : data.activity.slice(0, 5);
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AI Star 성과 스코어보드 홈">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span><b>AI STAR</b><small>성과 스코어보드</small></span>
        </a>
        <nav className="main-nav" aria-label="주요 메뉴">
          <a className="active" href="#dashboard">대시보드</a>
          <a href="#other-papers">기타 논문</a>
          <a href="#training">인재양성</a>
          <a href="#records">성과 목록</a>
          <a href="#history">변경 이력</a>
          {isAdmin ? <a href="#access-approval">사용자 승인</a> : null}
        </nav>
        <div className="account-wrap">
          {user ? (
            <>
              <button
                className="account-button"
                type="button"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <span className="account-avatar">{Array.from(user.displayName)[0]}</span>
                <span className="account-copy"><b>{user.displayName}</b><small>편집자</small></span>
                <span className="chevron" aria-hidden="true">⌄</span>
              </button>
              {accountOpen ? (
                <div className="account-menu">
                  <span>로그인 계정</span>
                  <b>{user.email}</b>
                  <a href={signOutPath}>로그아웃</a>
                </div>
              ) : null}
            </>
          ) : (
            <a className="login-button" href={signInPath}>로그인</a>
          )}
        </div>
      </header>

      <div className="content" id="top">
        {loadError ? (
          <div className="error-banner" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => void loadDashboard()}>다시 시도</button>
          </div>
        ) : null}

        <section className="hero" id="dashboard">
          <div className="hero-copy">
            <div className="project-kicker">
              <span>AI최고급신진연구자지원사업</span>
              <i>RS-2026-25615817</i>
            </div>
            <h1>AI스타펠로우십지원 <span>성과관리</span></h1>
            <p>제주대학교와 건국대학교가 함께 만드는 6개년 연구 성과를 목표부터 증빙까지 한곳에서 관리합니다.</p>
            <div className="project-meta">
              <span><b>수행기간</b> 2026.07.01 — 2031.12.31</span>
              <span><b>주관</b> 제주대학교 산학협력단</span>
              <span><b>공동</b> 건국대학교 산학협력단</span>
            </div>
          </div>
          <div className="hero-actions">
            <label className="year-selector">
              <span>현재 조회</span>
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value === "all" ? "all" : Number(event.target.value))}
                aria-label="조회 연도"
              >
                <option value="all">전체 연차</option>
                {data.targets.map((target) => <option key={target.year} value={target.year}>{target.year}년</option>)}
              </select>
            </label>
            <button className="primary-button" type="button" onClick={openCreate}><span aria-hidden="true">＋</span> 성과 등록</button>
          </div>
        </section>

        {isAdmin ? <AccessAdminPanel /> : null}

        <section className="summary-grid" aria-label="전체 목표 요약">
          {summary.map((card) => {
            const percentage = card.target ? (card.actual / card.target) * 100 : 0;
            return (
              <article className={`summary-card ${card.accent}`} key={card.key}>
                <div className="card-head"><span>{card.eyebrow}</span><i aria-hidden="true">↗</i></div>
                <div className="card-number"><strong>{formatAmount(card.actual)}</strong><span>/ {card.target}</span></div>
                <div className="card-title-row"><h2>{card.label}</h2><span>{formatPercent(percentage)}</span></div>
                <div className="progress-track"><span style={{ width: `${Math.min(percentage, 100)}%` }} /></div>
                <div className="card-details">
                  {card.details.map((detail) => {
                    const actual = sumCreditedAmount(recordsForYear.filter((record) => record.metricType === detail.metric));
                    const target = visibleTargets.reduce((sum, row) => sum + targetForMetric(row, detail.metric), 0);
                    return <span key={detail.metric}><i>{detail.label}</i><b>{formatAmount(actual)} / {target}</b></span>;
                  })}
                </div>
              </article>
            );
          })}
        </section>

        <section className="dashboard-grid">
          <article className="panel target-panel">
            <div className="section-heading">
              <div><span className="section-kicker">ANNUAL TARGETS</span><h2>연차별 목표</h2><p>논문 실적은 JCR 상위 10%와 인정 기준을 충족한 Top-tier 학술대회만 반영합니다.</p></div>
              <div className="legend"><span><i className="legend-dot target" /> 목표</span><span><i className="legend-dot actual" /> 달성</span></div>
            </div>
            <div className="target-table-wrap">
              <table className="target-table">
                <thead><tr><th>연차</th><th>논문</th><th>특허 출원</th><th>특허 등록</th><th>공개SW</th><th>달성률</th></tr></thead>
                <tbody>
                  {visibleTargets.map((row) => {
                    const rowTarget = METRIC_TYPES.reduce((sum, metric) => sum + targetForMetric(row, metric), 0);
                    const rowActual = sumCreditedAmount(data.records.filter((record) => record.year === row.year && countsTowardScoreboard(record.metricType)));
                    const percentage = rowTarget ? (rowActual / rowTarget) * 100 : 0;
                    return (
                      <tr key={row.year}>
                        <td><span className={`stage-badge stage-${row.stage}`}>{row.stage}단계</span><b>{row.year}</b></td>
                        <td><MetricCell primary={row.paperSci} primaryActual={actualForMetric(row.year, "paper_jcr_top10")} primaryLabel="JCR 10%" secondary={row.paperTop} secondaryActual={actualForMetric(row.year, "conference_top_tier")} secondaryLabel="Top-tier" /></td>
                        <td><MetricCell primary={row.patentApplicationDomestic} primaryActual={actualForMetric(row.year, "patent_application_domestic")} primaryLabel="국내" secondary={row.patentApplicationInternational} secondaryActual={actualForMetric(row.year, "patent_application_international")} secondaryLabel="국외" /></td>
                        <td><MetricCell primary={row.patentRegistrationDomestic} primaryActual={actualForMetric(row.year, "patent_registration_domestic")} primaryLabel="국내" secondary={row.patentRegistrationInternational} secondaryActual={actualForMetric(row.year, "patent_registration_international")} secondaryLabel="국외" /></td>
                        <td><MetricCell primary={row.openSource} primaryActual={actualForMetric(row.year, "open_source")} /></td>
                        <td><div className="row-progress"><span><b>{formatAmount(rowActual)}</b> / {rowTarget}</span><i><em style={{ width: `${Math.min(percentage, 100)}%` }} /></i></div></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><b>{selectedYear === "all" ? "6개년 총계" : `${selectedYear}년 합계`}</b></td>
                    <td><MetricCell primary={sumTarget(visibleTargets, "paper_jcr_top10")} primaryActual={actualForSelectedYears("paper_jcr_top10")} primaryLabel="JCR 10%" secondary={sumTarget(visibleTargets, "conference_top_tier")} secondaryActual={actualForSelectedYears("conference_top_tier")} secondaryLabel="Top-tier" /></td>
                    <td><MetricCell primary={sumTarget(visibleTargets, "patent_application_domestic")} primaryActual={actualForSelectedYears("patent_application_domestic")} primaryLabel="국내" secondary={sumTarget(visibleTargets, "patent_application_international")} secondaryActual={actualForSelectedYears("patent_application_international")} secondaryLabel="국외" /></td>
                    <td><MetricCell primary={sumTarget(visibleTargets, "patent_registration_domestic")} primaryActual={actualForSelectedYears("patent_registration_domestic")} primaryLabel="국내" secondary={sumTarget(visibleTargets, "patent_registration_international")} secondaryActual={actualForSelectedYears("patent_registration_international")} secondaryLabel="국외" /></td>
                    <td><MetricCell primary={sumTarget(visibleTargets, "open_source")} primaryActual={actualForSelectedYears("open_source")} /></td>
                    <td><strong className="grand-total">{formatAmount(sumCreditedAmount(recordsForYear.filter((record) => countsTowardScoreboard(record.metricType))))} / {targetGrandTotal}건</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <aside className="panel activity-panel" id="history">
            <div className="section-heading compact">
              <div><span className="section-kicker">ACTIVITY</span><h2>최근 변경</h2></div>
              {data.activity.length > 5 ? <button type="button" className="text-button" onClick={() => setActivityExpanded((value) => !value)}>{activityExpanded ? "접기" : "전체 보기"}</button> : null}
            </div>
            {recentActivity.length ? (
              <div className="activity-list">
                {recentActivity.map((item) => {
                  const record = data.records.find((candidate) => candidate.id === item.recordId);
                  const participant = data.participants.find((candidate) => candidate.id === item.recordId);
                  const entity: HistoryEntity | null = record
                    ? { id: record.id, title: record.title, entityType: "performance" }
                    : participant
                      ? { id: participant.id, title: participant.name, entityType: "training_participant" }
                      : null;
                  return (
                    <button className="activity-item" type="button" key={item.id} disabled={!entity} onClick={() => { if (entity) void openHistory(entity); }}>
                      <span className={`activity-icon ${item.action}`} aria-hidden="true">{activitySymbol(item.action)}</span>
                      <span className="activity-copy"><b>{item.changedByName}</b><span>{item.summary}</span><small>{formatDateTime(item.createdAt)}</small></span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="activity-empty">
                <div className="empty-orbit" aria-hidden="true"><span /><i /></div>
                <h3>아직 변경 이력이 없습니다</h3>
                <p>성과를 등록하거나 수정하면 담당자와 변경 시각이 자동으로 기록됩니다.</p>
              </div>
            )}
            <div className="audit-note"><span aria-hidden="true">✓</span><p><b>모든 변경은 안전하게 기록됩니다.</b><br />작성자, 변경 내용, 시각을 확인할 수 있습니다.</p></div>
          </aside>
        </section>

        <section className="panel other-paper-panel" id="other-papers">
          <div className="section-heading other-paper-heading">
            <div>
              <span className="section-kicker">OTHER PAPERS · NO TARGET</span>
              <h2>기타 논문 보드</h2>
              <p>SCIE Q1, 그 외 SCIE, 그 외 Top-tier 학술대회 실적을 별도로 집계합니다. 이 보드는 목표치와 달성률에 반영하지 않습니다.</p>
            </div>
            <span className="no-target-badge">목표치 없음</span>
          </div>
          <div className="other-paper-cards">
            <article className="other-paper-total-card">
              <span>선택 연차 기타 논문</span>
              <strong>{formatAmount(sumCreditedAmount(otherPaperRecordsForYear))}<small>건</small></strong>
              <p>공동사사 비율 반영</p>
            </article>
            {otherPaperBoardMeta.map((item) => (
              <article className="other-paper-card" key={item.metric}>
                <span>{item.label}</span>
                <strong>{formatAmount(actualForSelectedYears(item.metric))}<small>건</small></strong>
                <p>목표 스코어보드 미반영</p>
              </article>
            ))}
            <article className={`other-paper-card legacy ${legacyPaperActual ? "needs-review" : ""}`}>
              <span>기존 분류 · 확인 필요</span>
              <strong>{formatAmount(legacyPaperActual)}<small>건</small></strong>
              <p>{legacyPaperActual ? "수정 화면에서 새 분류를 선택해 주세요" : "재분류할 기존 논문이 없습니다"}</p>
            </article>
          </div>
          <div className="other-paper-table-wrap">
            <table className="other-paper-table">
              <thead>
                <tr><th>연차</th>{otherPaperBoardMeta.map((item) => <th key={item.metric}>{item.shortLabel}</th>)}<th>분류 확인 필요</th><th>합계</th></tr>
              </thead>
              <tbody>
                {visibleTargets.map((row) => {
                  const yearOtherRecords = data.records.filter((record) => record.year === row.year && isOtherPaperMetric(record.metricType));
                  const yearLegacy = sumCreditedAmount(yearOtherRecords.filter((record) => isLegacyPaperMetric(record.metricType)));
                  return (
                    <tr key={row.year}>
                      <td><span className={`stage-badge stage-${row.stage}`}>{row.stage}단계</span><b>{row.year}</b></td>
                      {otherPaperBoardMeta.map((item) => <td key={item.metric}><strong>{formatAmount(actualForMetric(row.year, item.metric))}</strong><span>건</span></td>)}
                      <td className={yearLegacy ? "review-count" : ""}><strong>{formatAmount(yearLegacy)}</strong><span>건</span></td>
                      <td><strong>{formatAmount(sumCreditedAmount(yearOtherRecords))}</strong><span>건</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td><b>{selectedYear === "all" ? "6개년 총계" : `${selectedYear}년 합계`}</b></td>
                  {otherPaperBoardMeta.map((item) => <td key={item.metric}><strong>{formatAmount(actualForSelectedYears(item.metric))}</strong><span>건</span></td>)}
                  <td className={legacyPaperActual ? "review-count" : ""}><strong>{formatAmount(legacyPaperActual)}</strong><span>건</span></td>
                  <td><strong>{formatAmount(sumCreditedAmount(otherPaperRecordsForYear))}</strong><span>건</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <TrainingSection
          participants={data.participants}
          targets={data.targets}
          selectedYear={selectedYear}
          isLoading={isLoading}
          userName={user?.displayName ?? "사용자"}
          onReload={loadDashboard}
          onToast={setToast}
          onHistory={(entity) => void openHistory(entity)}
        />

        <section className="panel records-panel" id="records">
          <div className="section-heading">
            <div><span className="section-kicker">PERFORMANCE RECORDS</span><h2>등록 성과</h2><p>세부 논문 등급과 목표 반영 여부, 특허·공개SW 증빙을 함께 관리합니다.</p></div>
            <button type="button" className="secondary-button" onClick={exportCsv} disabled={!visibleRecords.length}>CSV 내보내기</button>
          </div>
          <div className="record-toolbar">
            <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="성과명, DOI, 특허번호 검색" aria-label="성과 검색" /></label>
            <div className="filter-buttons">
              {(Object.keys(groupLabels) as Array<"all" | GroupKey>).map((group) => <button className={selectedGroup === group ? "selected" : ""} type="button" key={group} onClick={() => setSelectedGroup(group)}>{groupLabels[group]}</button>)}
            </div>
            <span className="result-count">{visibleRecords.length}건</span>
          </div>
          {isLoading ? (
            <div className="records-loading" aria-live="polite"><span /><p>성과 정보를 불러오는 중입니다.</p></div>
          ) : visibleRecords.length ? (
            <div className="records-table-wrap">
              <table className="records-table">
                <thead><tr><th>유형 · 인정실적</th><th>성과명</th><th>연차</th><th>수행기관</th><th>식별번호 · 증빙</th><th>최종 수정</th><th><span className="sr-only">관리</span></th></tr></thead>
                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.id}>
                      <td><span className={`metric-badge metric-${metricGroupFor(record.metricType)}`}>{metricLabels[record.metricType]}</span><small className={`credit-badge ${isOtherPaperMetric(record.metricType) ? "other-credit" : ""}`}>{isPaperMetric(record.metricType) ? (isCountedPaperMetric(record.metricType) ? `목표 반영 ${creditedAmountLabel(record)}` : `기타 논문 ${creditedAmountLabel(record)} · 목표 미반영`) : `인정 ${creditedAmountLabel(record)}`}{isPaperMetric(record.metricType) && record.acknowledgementCount > 1 ? ` · ${record.acknowledgementCount}개 과제 공동사사` : ""}</small></td>
                      <td><button className="record-title" type="button" onClick={() => openEdit(record)}>{record.title}</button>{record.project ? <small>{record.project}</small> : null}</td>
                      <td>{record.year}</td>
                      <td>{record.organization}</td>
                      <td>{record.identifier ? <b className="identifier">{record.identifier}</b> : <span className="muted">미입력</span>}{record.url ? <a className="evidence-link" href={record.url} target="_blank" rel="noreferrer">증빙 보기 ↗</a> : null}</td>
                      <td><b className="editor-name">{record.updatedByName}</b><small>{formatDateTime(record.updatedAt)}</small></td>
                      <td><div className="row-actions"><button type="button" onClick={() => void openHistory({ id: record.id, title: record.title, entityType: "performance" })}>이력</button><button className="danger-row-button" type="button" onClick={() => askDelete(record)}>삭제</button><button type="button" onClick={() => openEdit(record)}>수정</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="records-empty">
              <span className="empty-plus" aria-hidden="true">＋</span>
              <div><h3>{search || selectedGroup !== "all" ? "조건에 맞는 성과가 없습니다" : "첫 번째 성과를 등록해 보세요"}</h3><p>{search || selectedGroup !== "all" ? "검색어나 필터를 바꾸면 다른 성과를 확인할 수 있습니다." : "성과를 등록하면 목표 달성률과 변경 이력이 즉시 갱신됩니다."}</p></div>
              {!search && selectedGroup === "all" ? <button className="secondary-button" type="button" onClick={openCreate}>성과 등록</button> : null}
            </div>
          )}
        </section>
      </div>

      <footer><p>AI스타펠로우십지원(제주대학교, 학제연계형)</p><span>논문 세부 집계 기준 적용 2026.08.09</span></footer>

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="record-modal-title">
            <div className="modal-header">
              <div><span className="section-kicker">PERFORMANCE RECORD</span><h2 id="record-modal-title">{editing ? "성과 수정" : "새 성과 등록"}</h2><p>{isPaperMetric(form.metricType) ? (isCountedPaperMetric(form.metricType) ? "목표 반영 논문입니다. 공동사사 비율에 따라 인정 실적을 자동 환산합니다." : "기타 논문 보드에만 집계되며 목표 달성률에는 반영되지 않습니다.") : "입력한 성과는 해당 연차의 달성 실적 1건으로 반영됩니다."}</p></div>
              <button className="close-button" type="button" aria-label="닫기" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={saveRecord}>
              <div className="form-grid">
                <label className="field-wide metric-type-field"><span>성과 유형 · 논문 세부 분류 <b>*</b></span><select value={form.metricType} onChange={(event) => { const metricType = event.target.value as MetricType; setForm({ ...form, metricType, acknowledgementCount: isPaperMetric(metricType) ? form.acknowledgementCount : 1 }); }}>
                  {isLegacyPaperMetric(form.metricType) ? <option value={form.metricType} disabled>{metricLabels[form.metricType]}</option> : null}
                  <optgroup label="목표 지표 반영 논문">
                    {COUNTED_PAPER_METRICS.map((metric) => <option key={metric} value={metric}>{metricLabels[metric]}</option>)}
                  </optgroup>
                  <optgroup label="기타 논문 · 목표 미반영">
                    {OTHER_PAPER_METRICS.map((metric) => <option key={metric} value={metric}>{metricLabels[metric]}</option>)}
                  </optgroup>
                  <optgroup label="특허 · 공개SW">
                    {METRIC_TYPES.filter((metric) => !isPaperMetric(metric)).map((metric) => <option key={metric} value={metric}>{metricLabels[metric]}</option>)}
                  </optgroup>
                </select></label>
                <label><span>성과 연차 <b>*</b></span><select value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}>{fallbackTargets.map((target) => <option key={target.year} value={target.year}>{target.year}년 · {target.stage}단계</option>)}</select></label>
                {isPaperMetric(form.metricType) ? (
                  <>
                    <label className="credit-field"><span>논문 사사 과제 수 <b>*</b></span><select value={form.acknowledgementCount} onChange={(event) => setForm({ ...form, acknowledgementCount: Number(event.target.value) })}>{acknowledgementOptions.map((count) => <option key={count} value={count}>{count === 1 ? "1개 과제 사사" : `${count}개 과제 공동사사`}</option>)}</select></label>
                    <div className={`credit-preview field-wide ${isCountedPaperMetric(form.metricType) ? "counted" : "other"}`}><span>{isCountedPaperMetric(form.metricType) ? "목표 스코어보드 반영" : isLegacyPaperMetric(form.metricType) ? "새 세부 분류 선택 필요" : "기타 논문 보드 집계"}</span><strong>{isLegacyPaperMetric(form.metricType) ? "—" : creditedAmountLabel(form)}</strong><small>{isLegacyPaperMetric(form.metricType) ? "기존 분류는 그대로 저장할 수 없습니다" : isCountedPaperMetric(form.metricType) ? `1 ÷ ${form.acknowledgementCount}개 과제` : "목표 달성률에는 미반영"}</small></div>
                    <div className="paper-classification-note field-wide">
                      <b>목표 반영 기준</b>
                      <span><strong>학술지</strong> JCR 상위 10%만 반영</span>
                      <span><strong>학술대회</strong> 한국정보과학회 우수등급 이상 또는 BK21 우수학술대회 IF 3 이상만 반영</span>
                      <small>SCIE Q1·그 외 SCIE·그 외 Top-tier 학술대회는 기타 논문 보드에서 별도 집계합니다.</small>
                    </div>
                  </>
                ) : null}
                <label className="field-wide"><span>성과명 <b>*</b></span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={300} placeholder="논문명, 특허명 또는 공개SW 이름" required /></label>
                <label><span>수행기관 <b>*</b></span><select value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })}>{organizationOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                <label><span>연구 프로젝트</span><select value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}>{projectOptions.map(([value, label]) => <option key={value || "none"} value={value}>{label}</option>)}</select></label>
                <label><span>성과일</span><input type="date" value={form.achievementDate} onChange={(event) => setForm({ ...form, achievementDate: event.target.value })} /></label>
                <label><span>식별번호</span><input value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} maxLength={200} placeholder="DOI, 특허번호, 저장소명 등" /></label>
                <label className="field-wide"><span>증빙 링크</span><input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} maxLength={500} placeholder="https://" /></label>
                <label className="field-wide"><span>메모</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={2000} rows={3} placeholder="성과 확인에 필요한 설명이나 담당자 메모" /></label>
              </div>
              {formError ? <p className="form-error" role="alert">{formError}</p> : null}
              <div className="modal-footer"><span>저장 시 <b>{user?.displayName}</b> 님의 수정 이력이 남습니다.</span><div>{editing ? <button className="danger-button" type="button" onClick={() => askDelete(editing)}>성과 삭제</button> : null}<button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>취소</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "저장 중…" : editing ? "수정 내용 저장" : "성과 등록"}</button></div></div>
            </form>
          </section>
        </div>
      ) : null}

      {historyEntity ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setHistoryEntity(null); }}>
          <section className="modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
            <div className="modal-header"><div><span className="section-kicker">AUDIT TRAIL</span><h2 id="history-modal-title">변경 이력</h2><p className="history-record-title">{historyEntity.title}</p></div><button className="close-button" type="button" aria-label="닫기" onClick={() => setHistoryEntity(null)}>×</button></div>
            <div className="history-list">
              {historyLoading ? <div className="history-empty">변경 이력을 불러오는 중입니다.</div> : historyError ? <div className="history-empty history-error">{historyError}</div> : historyItems.length ? historyItems.map((item) => <HistoryItem key={item.id} item={item} />) : <div className="history-empty">표시할 변경 이력이 없습니다.</div>}
            </div>
            <div className="modal-footer"><span>이력은 최신순으로 표시됩니다.</span><div><button className="secondary-button" type="button" onClick={() => setHistoryEntity(null)}>닫기</button>{historyEntity.entityType === "performance" ? <button className="primary-button" type="button" onClick={() => { const record = data.records.find((item) => item.id === historyEntity.id); setHistoryEntity(null); if (record) openEdit(record); }}>현재 정보 수정</button> : <a className="primary-button history-anchor" href="#training" onClick={() => setHistoryEntity(null)}>참여인력 명부</a>}</div></div>
          </section>
        </div>
      ) : null}

      {deletingRecord ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (!isDeleting && event.currentTarget === event.target) setDeletingRecord(null); }}>
          <section className="modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-modal-title" aria-describedby="delete-modal-description">
            <div className="delete-confirm-icon" aria-hidden="true">!</div>
            <h2 id="delete-modal-title">이 성과를 삭제할까요?</h2>
            <p className="delete-record-title">{deletingRecord.title}</p>
            <p id="delete-modal-description">삭제하면 대시보드 실적과 달성률에서 즉시 제외됩니다. 삭제한 사용자와 시각은 변경 이력에 계속 보존됩니다.</p>
            {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
            <div className="delete-modal-actions"><button className="secondary-button" type="button" disabled={isDeleting} onClick={() => setDeletingRecord(null)}>취소</button><button className="danger-confirm-button" type="button" disabled={isDeleting} onClick={() => void deleteRecord()}>{isDeleting ? "삭제 중…" : "성과 삭제"}</button></div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="toast" role="status"><span>✓</span>{toast}</div> : null}
    </main>
  );
}

function HistoryItem({ item }: { item: AuditLog }) {
  return (
    <article className="history-item">
      <span className={`activity-icon ${item.action}`} aria-hidden="true">{activitySymbol(item.action)}</span>
      <div><div className="history-meta"><b>{item.changedByName}</b><span>{item.changedByEmail}</span><time>{formatDateTime(item.createdAt)}</time></div><p>{item.summary}</p></div>
    </article>
  );
}

function activitySymbol(action: AuditLog["action"]) {
  if (action === "created") return "+";
  if (action === "deleted") return "×";
  return "↻";
}

function metricGroupFor(metric: MetricType): GroupKey {
  return (Object.entries(metricGroups) as Array<[GroupKey, MetricType[]]>).find(([, metrics]) => metrics.includes(metric))?.[0] ?? "paper";
}

function sumTarget(targets: AnnualTarget[], metric: MetricType) {
  return targets.reduce((sum, target) => sum + targetForMetric(target, metric), 0);
}

function sumCreditedAmount(records: PerformanceRecord[]) {
  return records.reduce((sum, record) => sum + creditedAmount(record), 0);
}

function formatAmount(value: number, maximumFractionDigits = 3) {
  const rounded = Math.abs(value) < 0.0000001 ? 0 : value;
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits,
  }).format(rounded);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatDateTime(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
