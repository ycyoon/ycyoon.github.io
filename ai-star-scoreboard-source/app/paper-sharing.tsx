"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseClient } from "../lib/supabase-client";
import { isPaperMetric, type PerformanceRecord } from "../lib/scoreboard";
import {
  makeBibtex,
  safeLink,
  type Metadata,
} from "../supabase/functions/paper-metadata/metadata";
import "./paper-sharing.css";

type PaperForm = Metadata & {
  professors: string;
  notes: string;
  source_record_id: string | null;
};
type Paper = PaperForm & {
  id: string;
  created_by_email: string;
  created_by_name: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
};
type Citation = {
  id: string;
  paper_id: string;
  citing_title: string;
  citing_url: string;
  citation_status: "draft" | "submitted" | "published";
  citation_date: string;
  notes: string;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  archived: boolean;
};
type CitationForm = Pick<
  Citation,
  "citing_title" | "citing_url" | "citation_status" | "citation_date" | "notes"
>;
type Activity = {
  id: number;
  actor_name: string;
  entity_type: string;
  action: string;
  created_at: string;
  snapshot: Record<string, unknown>;
};
const blank = (): PaperForm => ({
  title: "",
  authors: "",
  publication_name: "",
  publication_year: null,
  doi: "",
  url: "",
  abstract: "",
  keywords: [],
  bibtex: "",
  metadata_source: "직접 입력",
  professors: "",
  notes: "",
  source_record_id: null,
});
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const blankCitation = (): CitationForm => ({
  citing_title: "",
  citing_url: "",
  citation_status: "draft",
  citation_date: today(),
  notes: "",
});
const statusNames = { draft: "작성 중", submitted: "투고", published: "게재" };
function errorMessage(e: unknown) {
  const err = e as { code?: string; message?: string };
  if (err.code === "23505")
    return "같은 DOI·링크·기존 성과 또는 인용 기록이 이미 등록되어 있습니다.";
  if (err.code === "42501")
    return "승인된 사용자만 이용할 수 있으며, 수정·삭제는 등록자 또는 관리자만 가능합니다.";
  if (err.code === "23514")
    return "입력 길이·연도·링크 또는 삭제된 논문 여부를 확인해 주세요.";
  return err.message || "요청을 처리하지 못했습니다.";
}
async function allRows(table: string) {
  const rows: unknown[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await getSupabaseClient()
      .from(table)
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .order("id")
      .range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}
function bibDownload(content: string, name: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PaperSharing({
  userEmail,
  isAdmin,
  records,
}: {
  userEmail: string;
  isAdmin: boolean;
  records: PerformanceRecord[];
}) {
  const [papers, setPapers] = useState<Paper[]>([]),
    [citations, setCitations] = useState<Citation[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [query, setQuery] = useState(""),
    [professor, setProfessor] = useState(""),
    [limit, setLimit] = useState(20);
  const [editing, setEditing] = useState<Paper | null>(null),
    [editor, setEditor] = useState(false),
    [form, setForm] = useState<PaperForm>(blank),
    [inputUrl, setInputUrl] = useState(""),
    [keywords, setKeywords] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const [citationPaper, setCitationPaper] = useState<Paper | null>(null),
    [editingCitation, setEditingCitation] = useState<Citation | null>(null),
    [citationForm, setCitationForm] = useState<CitationForm>(blankCitation);
  const [history, setHistory] = useState<{
    paper: Paper;
    rows: Activity[];
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    table: string;
    id: string;
    label: string;
  } | null>(null);
  const canEdit = (p: { created_by_email: string }) =>
    isAdmin || p.created_by_email.toLowerCase() === userEmail.toLowerCase();
  async function load() {
    setError("");
    try {
      const [p, c] = await Promise.all([
        allRows("shared_papers"),
        allRows("paper_citations"),
      ]);
      setPapers(p as Paper[]);
      setCitations(c as Citation[]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setEditor(false);
        setCitationPaper(null);
        setHistory(null);
        setConfirm(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy]);
  const professorNames = useMemo(
    () =>
      Array.from(
        new Set(
          papers.flatMap((p) =>
            p.professors
              .split(/[,;]/)
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ),
      ).sort(),
    [papers],
  );
  const filtered = useMemo(
    () =>
      papers.filter(
        (p) =>
          (!professor ||
            p.professors
              .split(/[,;]/)
              .map((x) => x.trim())
              .includes(professor)) &&
          [
            p.title,
            p.authors,
            p.professors,
            p.publication_name,
            p.doi,
            ...p.keywords,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [papers, professor, query],
  );
  function openPaper(p?: Paper) {
    setEditing(p ?? null);
    setForm(
      p
        ? {
            title: p.title,
            authors: p.authors,
            professors: p.professors,
            publication_name: p.publication_name,
            publication_year: p.publication_year,
            doi: p.doi,
            url: p.url,
            abstract: p.abstract,
            keywords: p.keywords,
            bibtex: p.bibtex,
            metadata_source: p.metadata_source,
            notes: p.notes,
            source_record_id: p.source_record_id,
          }
        : blank(),
    );
    setInputUrl(p?.url ?? "");
    setKeywords(p?.keywords.join(", ") ?? "");
    setFormError("");
    setEditor(true);
  }
  function seedRecord(id: string) {
    const r = records.find((r) => r.id === id);
    if (!r) return;
    setForm({
      ...blank(),
      title: r.title,
      url: r.url ?? "",
      publication_year: r.year,
      professors: r.createdByName,
      source_record_id: r.id,
      metadata_source: "기존 성과",
    });
    setInputUrl(r.url ?? "");
    setKeywords("");
  }
  async function extract() {
    setBusy(true);
    setFormError("");
    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        "paper-metadata",
        { body: { url: inputUrl } },
      );
      if (error) {
        let detail = "";
        try {
          const body = await (error as { context?: Response }).context?.json();
          detail = body?.error ?? "";
        } catch {}
        throw new Error(detail || error.message);
      }
      if (!data?.paper?.title)
        throw new Error(
          data?.error || "제목을 가져오지 못했습니다. 직접 입력해 주세요.",
        );
      setForm((f) => ({ ...f, ...data.paper }));
      setKeywords((data.paper.keywords ?? []).join(", "));
      setMessage(
        "자동 추출했습니다. 학회·저널명과 키워드를 확인한 뒤 저장해 주세요.",
      );
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function savePaper(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      if (form.url && !safeLink(form.url))
        throw new Error("논문 링크는 http 또는 https 주소여야 합니다.");
      const row = {
        ...form,
        title: form.title.trim(),
        doi: form.doi
          .trim()
          .replace(/^https?:\/\/(dx\.)?doi.org\//i, "")
          .toLowerCase(),
        url: safeLink(form.url),
        keywords: keywords
          .split(/[,;]/)
          .map((x) => x.trim())
          .filter(Boolean),
      };
      row.bibtex = row.bibtex.trim() || makeBibtex(row);
      const client = getSupabaseClient();
      const result = editing
        ? await client
            .from("shared_papers")
            .update(row)
            .eq("id", editing.id)
            .select("id")
            .single()
        : await client.from("shared_papers").insert(row).select("id").single();
      if (result.error) throw result.error;
      setEditor(false);
      setMessage("논문을 저장했습니다.");
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function openCitation(p: Paper, c?: Citation) {
    setCitationPaper(p);
    setEditingCitation(c ?? null);
    setCitationForm(
      c
        ? {
            citing_title: c.citing_title,
            citing_url: c.citing_url,
            citation_status: c.citation_status,
            citation_date: c.citation_date,
            notes: c.notes,
          }
        : blankCitation(),
    );
    setFormError("");
  }
  async function saveCitation(e: FormEvent) {
    e.preventDefault();
    if (!citationPaper) return;
    setBusy(true);
    setFormError("");
    try {
      if (citationForm.citing_url && !safeLink(citationForm.citing_url))
        throw new Error("인용한 논문 링크를 확인해 주세요.");
      const row = {
        ...citationForm,
        citing_title: citationForm.citing_title.trim(),
        citing_url: safeLink(citationForm.citing_url),
        paper_id: citationPaper.id,
      };
      const c = getSupabaseClient();
      const result = editingCitation
        ? await c
            .from("paper_citations")
            .update(row)
            .eq("id", editingCitation.id)
            .select("id")
            .single()
        : await c.from("paper_citations").insert(row).select("id").single();
      if (result.error) throw result.error;
      setCitationPaper(null);
      setMessage("인용 기록을 저장했습니다.");
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!confirm) return;
    setBusy(true);
    setFormError("");
    try {
      const { error } = await getSupabaseClient()
        .from(confirm.table)
        .update({ archived: true })
        .eq("id", confirm.id)
        .select("id")
        .single();
      if (error) throw error;
      setConfirm(null);
      setMessage("목록에서 삭제했습니다. 변경 이력은 보존됩니다.");
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(p: Paper) {
    setError("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("paper_activity")
        .select("*")
        .eq("paper_id", p.id)
        .order("id", { ascending: false })
        .limit(100);
      if (error) throw error;
      setHistory({ paper: p, rows: data });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s);
      setMessage("BibTeX를 복사했습니다.");
    } catch {
      setError(
        "클립보드를 사용할 수 없습니다. BibTeX 영역에서 직접 복사하거나 내려받아 주세요.",
      );
    }
  }
  const field = (name: keyof PaperForm, value: unknown) =>
    setForm((f) => ({ ...f, [name]: value }));
  return (
    <section
      id="papers"
      className="panel paper-sharing"
      aria-labelledby="paper-heading"
    >
      <div className="section-heading">
        <div>
          <span className="section-kicker">RESEARCH LIBRARY</span>
          <h2 id="paper-heading">논문 공유</h2>
          <p>
            참여 교수의 논문을 찾아보고, 연구에 참고한 인용 기록을 함께
            남깁니다.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => openPaper()}
        >
          + 논문 공유하기
        </button>
      </div>
      <div className="paper-toolbar">
        <input
          aria-label="공유 논문 검색"
          type="search"
          placeholder="논문 제목, 저자, 학회·저널명, 키워드 검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(20);
          }}
        />
        <select
          aria-label="참여 교수 필터"
          value={professor}
          onChange={(e) => {
            setProfessor(e.target.value);
            setLimit(20);
          }}
        >
          <option value="">참여 교수 전체</option>
          {professorNames.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button
          className="secondary-button"
          disabled={!filtered.length}
          onClick={() =>
            bibDownload(
              filtered
                .map((p) => p.bibtex)
                .filter(Boolean)
                .join("\n\n"),
              "ai-star-papers.bib",
            )
          }
        >
          BibTeX 내보내기
        </button>
        <button className="text-button" onClick={() => void load()}>
          새로고침
        </button>
      </div>
      <p className="paper-help">
        공유 {filtered.length}편 · 공유 등록은 성과 점수에 영향을 주지 않습니다.
        인용 기록은 연구진이 직접 남긴 사용 이력입니다.
      </p>
      {error && (
        <p role="alert" className="paper-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="paper-message">
          {message}
        </p>
      )}
      {loading ? (
        <p className="paper-empty">논문을 불러오는 중입니다.</p>
      ) : !filtered.length ? (
        <p className="paper-empty">
          {papers.length
            ? "검색 결과가 없습니다."
            : "아직 공유된 논문이 없습니다. 논문 링크를 넣거나 기존 성과에서 가져와 첫 논문을 공유해 주세요."}
        </p>
      ) : (
        <div className="paper-list">
          {filtered.slice(0, limit).map((p) => {
            const uses = citations.filter((c) => c.paper_id === p.id);
            return (
              <article className="paper-item" key={p.id}>
                <div className="paper-item-top">
                  <div>
                    <p className="paper-publication">
                      {p.publication_name || "학회·저널명 미입력"}
                      {p.publication_year ? ` · ${p.publication_year}` : ""}
                    </p>
                    <h3>
                      {safeLink(p.url) ? (
                        <a
                          href={safeLink(p.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {p.title} ↗
                        </a>
                      ) : (
                        p.title
                      )}
                    </h3>
                    <p className="paper-authors">
                      {p.authors || "저자 미입력"}
                    </p>
                    <p className="paper-help">
                      참여 교수: {p.professors || "미입력"} · 등록:{" "}
                      {p.created_by_name} ·{" "}
                      {new Date(p.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <span className="paper-count">인용 기록 {uses.length}</span>
                </div>
                <div className="paper-keywords">
                  {p.keywords.map((k, i) => (
                    <button
                      key={`${k}-${i}`}
                      onClick={() => {
                        setQuery(k);
                        setLimit(20);
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="paper-actions">
                  <button
                    className="primary-button"
                    onClick={() => openCitation(p)}
                  >
                    내 인용 기록 추가
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!p.bibtex}
                    onClick={() => void copy(p.bibtex)}
                  >
                    BibTeX 복사
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void showHistory(p)}
                  >
                    변경 이력
                  </button>
                  {canEdit(p) && (
                    <>
                      <button
                        className="text-button"
                        onClick={() => openPaper(p)}
                      >
                        수정
                      </button>
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          setFormError("");
                          setConfirm({
                            table: "shared_papers",
                            id: p.id,
                            label: p.title,
                          });
                        }}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
                <details className="paper-details">
                  <summary>초록 · BibTeX · 메모</summary>
                  {p.abstract ? (
                    <p className="paper-abstract">{p.abstract}</p>
                  ) : (
                    <p className="paper-help">초록이 등록되지 않았습니다.</p>
                  )}
                  <textarea
                    aria-label={`${p.title} BibTeX`}
                    readOnly
                    rows={7}
                    value={p.bibtex}
                  />
                  <button
                    className="text-button"
                    disabled={!p.bibtex}
                    onClick={() => bibDownload(p.bibtex, "paper.bib")}
                  >
                    .bib 파일 내려받기
                  </button>
                  {p.notes && <p className="paper-abstract">{p.notes}</p>}
                  <p className="paper-help">
                    정보 출처: {p.metadata_source || "직접 입력"} · 최종 수정:{" "}
                    {p.updated_by_name}
                  </p>
                </details>
                <details className="paper-details" open={uses.length > 0}>
                  <summary>누가 이 논문을 인용했나요? ({uses.length})</summary>
                  {!uses.length ? (
                    <p className="paper-help">
                      아직 기록이 없습니다. 논문을 인용한 연구에서 직접 기록해
                      주세요.
                    </p>
                  ) : (
                    uses.map((c) => (
                      <div className="paper-citation" key={c.id}>
                        <p>
                          <strong>{c.created_by_name}</strong>
                          <span>
                            {statusNames[c.citation_status]} · {c.citation_date}
                          </span>
                        </p>
                        <p>
                          {safeLink(c.citing_url) ? (
                            <a
                              href={safeLink(c.citing_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {c.citing_title} ↗
                            </a>
                          ) : (
                            c.citing_title
                          )}
                        </p>
                        {c.notes && <p className="paper-abstract">{c.notes}</p>}
                        {canEdit(c) && (
                          <div>
                            <button
                              className="text-button"
                              onClick={() => openCitation(p, c)}
                            >
                              기록 수정
                            </button>
                            <button
                              className="text-button danger-text"
                              onClick={() => {
                                setFormError("");
                                setConfirm({
                                  table: "paper_citations",
                                  id: c.id,
                                  label: c.citing_title,
                                });
                              }}
                            >
                              기록 삭제
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
      {filtered.length > limit && (
        <button
          className="secondary-button paper-more"
          onClick={() => setLimit((n) => n + 20)}
        >
          논문 더 보기 ({filtered.length - limit}편)
        </button>
      )}
      {editor && (
        <div className="paper-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="paper-editor-title"
            className="paper-dialog"
          >
            <div className="paper-dialog-heading">
              <h2 id="paper-editor-title">
                {editing ? "공유 논문 수정" : "논문 공유하기"}
              </h2>
              <button
                autoFocus
                type="button"
                disabled={busy}
                onClick={() => setEditor(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <form onSubmit={savePaper}>
              {!editing && (
                <label>
                  기존 성과에서 가져오기
                  <select
                    value={form.source_record_id ?? ""}
                    disabled={busy}
                    onChange={(e) => seedRecord(e.target.value)}
                  >
                    <option value="">직접 등록 또는 링크로 가져오기</option>
                    {records
                      .filter((r) => isPaperMetric(r.metricType))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                논문 링크 또는 DOI
                <div className="paper-import">
                  <input
                    value={inputUrl}
                    disabled={busy}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      if (safeLink(e.target.value))
                        field("url", e.target.value);
                    }}
                    placeholder="https://doi.org/… 또는 arXiv·ACL·OpenReview 링크"
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy || !inputUrl.trim()}
                    onClick={() => void extract()}
                  >
                    {busy ? "처리 중…" : "정보 가져오기"}
                  </button>
                </div>
              </label>
              <p className="paper-help">
                제공처에 없는 정보는 비어 있을 수 있습니다. 자동 추출 후 내용을
                확인해 주세요. 키워드는 제공처의 키워드·분류를 사용합니다.
              </p>
              {formError && (
                <p role="alert" className="paper-error">
                  {formError}
                </p>
              )}
              <label>
                논문 제목 *
                <input
                  required
                  maxLength={1000}
                  value={form.title}
                  disabled={busy}
                  onChange={(e) => field("title", e.target.value)}
                />
              </label>
              <div className="paper-form-grid">
                <label>
                  학회·저널명
                  <input
                    maxLength={1000}
                    value={form.publication_name}
                    disabled={busy}
                    onChange={(e) => field("publication_name", e.target.value)}
                  />
                </label>
                <label>
                  발표·게재 연도
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    value={form.publication_year ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      field(
                        "publication_year",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </label>
              </div>
              <label>
                저자 (세미콜론으로 구분)
                <textarea
                  rows={2}
                  maxLength={5000}
                  value={form.authors}
                  disabled={busy}
                  onChange={(e) => field("authors", e.target.value)}
                />
              </label>
              <label>
                참여 교수 (여러 명은 쉼표로 구분)
                <input
                  maxLength={1000}
                  value={form.professors}
                  disabled={busy}
                  onChange={(e) => field("professors", e.target.value)}
                  placeholder="윤여찬, 서재형"
                />
              </label>
              <div className="paper-form-grid">
                <label>
                  논문 링크
                  <input
                    type="url"
                    maxLength={2000}
                    value={form.url}
                    disabled={busy}
                    onChange={(e) => field("url", e.target.value)}
                  />
                </label>
                <label>
                  DOI
                  <input
                    maxLength={500}
                    value={form.doi}
                    disabled={busy}
                    onChange={(e) => field("doi", e.target.value)}
                  />
                </label>
              </div>
              <label>
                키워드 (쉼표로 구분, 최대 30개)
                <input
                  maxLength={2500}
                  value={keywords}
                  disabled={busy}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </label>
              <label>
                초록
                <textarea
                  rows={5}
                  maxLength={30000}
                  value={form.abstract}
                  disabled={busy}
                  onChange={(e) => field("abstract", e.target.value)}
                />
              </label>
              <label>
                BibTeX
                <textarea
                  rows={7}
                  maxLength={30000}
                  value={form.bibtex}
                  disabled={busy}
                  onChange={(e) => field("bibtex", e.target.value)}
                />
              </label>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() =>
                  field(
                    "bibtex",
                    makeBibtex(
                      form,
                      form.publication_name.toLowerCase().includes("conference")
                        ? "inproceedings"
                        : "article",
                    ),
                  )
                }
              >
                현재 입력 내용으로 BibTeX 생성
              </button>
              <label>
                공유 메모
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={form.notes}
                  disabled={busy}
                  onChange={(e) => field("notes", e.target.value)}
                  placeholder="함께 참고하면 좋은 내용, 연구 관련성 등"
                />
              </label>
              <div className="paper-dialog-footer">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setEditor(false)}
                >
                  취소
                </button>
                <button className="primary-button" disabled={busy}>
                  {busy ? "처리 중…" : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {citationPaper && (
        <div className="paper-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="citation-title"
            className="paper-dialog"
          >
            <div className="paper-dialog-heading">
              <h2 id="citation-title">
                {editingCitation ? "인용 기록 수정" : "내 인용 기록"}
              </h2>
              <button
                autoFocus
                disabled={busy}
                onClick={() => setCitationPaper(null)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <p className="paper-help">인용 대상: {citationPaper.title}</p>
            <p className="paper-help">
              인용자는 로그인한 계정으로 자동 기록됩니다. 실제로 인용한 연구의
              정보를 남겨 주세요.
            </p>
            <form onSubmit={saveCitation}>
              {formError && (
                <p className="paper-error" role="alert">
                  {formError}
                </p>
              )}
              <label>
                이 논문을 인용한 내 논문 제목 *
                <input
                  required
                  maxLength={1000}
                  disabled={busy}
                  value={citationForm.citing_title}
                  onChange={(e) =>
                    setCitationForm((f) => ({
                      ...f,
                      citing_title: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                내 논문 링크
                <input
                  type="url"
                  maxLength={2000}
                  disabled={busy}
                  value={citationForm.citing_url}
                  onChange={(e) =>
                    setCitationForm((f) => ({
                      ...f,
                      citing_url: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="paper-form-grid">
                <label>
                  진행 상태
                  <select
                    disabled={busy}
                    value={citationForm.citation_status}
                    onChange={(e) =>
                      setCitationForm((f) => ({
                        ...f,
                        citation_status: e.target
                          .value as Citation["citation_status"],
                      }))
                    }
                  >
                    {Object.entries(statusNames).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  인용 기록일
                  <input
                    type="date"
                    required
                    disabled={busy}
                    value={citationForm.citation_date}
                    onChange={(e) =>
                      setCitationForm((f) => ({
                        ...f,
                        citation_date: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                메모
                <textarea
                  rows={4}
                  maxLength={5000}
                  disabled={busy}
                  value={citationForm.notes}
                  onChange={(e) =>
                    setCitationForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="인용한 부분, 참고한 방법 등"
                />
              </label>
              <div className="paper-dialog-footer">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setCitationPaper(null)}
                >
                  취소
                </button>
                <button className="primary-button" disabled={busy}>
                  {busy ? "처리 중…" : "인용 기록 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirm && (
        <div className="paper-overlay">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="paper-delete-title"
            className="paper-dialog paper-small"
          >
            <h2 id="paper-delete-title">이 기록을 삭제할까요?</h2>
            <p>{confirm.label}</p>
            <p className="paper-help">
              목록에서 제외되며 변경 이력은 보존됩니다.
            </p>
            {formError && (
              <p className="paper-error" role="alert">
                {formError}
              </p>
            )}
            <div className="paper-dialog-footer">
              <button
                autoFocus
                className="secondary-button"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                취소
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void archive()}
              >
                {busy ? "처리 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
      {history && (
        <div className="paper-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="paper-history-title"
            className="paper-dialog"
          >
            <div className="paper-dialog-heading">
              <h2 id="paper-history-title">변경 이력</h2>
              <button
                autoFocus
                onClick={() => setHistory(null)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <p>{history.paper.title}</p>
            <p className="paper-help">최근 100건</p>
            {history.rows.map((h) => (
              <details key={h.id} className="paper-details">
                <summary>
                  {h.actor_name} · {h.entity_type === "paper" ? "논문" : "인용"}{" "}
                  {{ created: "등록", updated: "수정", deleted: "삭제" }[
                    h.action
                  ] ?? h.action}{" "}
                  · {new Date(h.created_at).toLocaleString("ko-KR")}
                </summary>
                <p>
                  {String(h.snapshot.title ?? h.snapshot.citing_title ?? "")}
                </p>
                <p className="paper-abstract">
                  {String(h.snapshot.notes ?? "")}
                </p>
                {h.entity_type === "paper" && (
                  <p className="paper-help">
                    {String(h.snapshot.publication_name ?? "")} ·{" "}
                    {String(h.snapshot.authors ?? "")}
                  </p>
                )}
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
