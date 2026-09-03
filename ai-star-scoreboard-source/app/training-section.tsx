"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api-client";
import {
  DEGREE_COURSES,
  degreeLabels,
  participantActiveInYear,
  participantGraduatedInYear,
  type AnnualTarget,
  type DegreeCourse,
  type ParticipantInput,
  type TrainingParticipant,
} from "../lib/scoreboard";

const projectOptions = [
  ["", "선택 안 함"],
  ["프로젝트 1", "프로젝트 1 · 공통원천"],
  ["프로젝트 2", "프로젝트 2 · 보안실증"],
  ["프로젝트 3", "프로젝트 3 · 의료실증"],
  ["공통 운영", "공통 운영"],
];

function emptyInput(selectedYear: number | "all"): ParticipantInput {
  const year = selectedYear === "all" ? 2026 : selectedYear;
  return {
    name: "",
    school: "제주대학교",
    degreeCourse: "bachelor",
    participationStart: year === 2026 ? "2026-07-01" : `${year}-01-01`,
    participationEnd: "",
    graduationDate: "",
    project: "",
    role: "",
    notes: "",
  };
}

export default function TrainingSection({
  participants,
  targets,
  selectedYear,
  isLoading,
  userName,
  onReload,
  onToast,
  onHistory,
}: {
  participants: TrainingParticipant[];
  targets: AnnualTarget[];
  selectedYear: number | "all";
  isLoading: boolean;
  userName: string;
  onReload: () => Promise<void>;
  onToast: (message: string) => void;
  onHistory: (entity: { id: string; title: string; entityType: "training_participant" }) => void;
}) {
  const [search, setSearch] = useState("");
  const [degreeFilter, setDegreeFilter] = useState<"all" | DegreeCourse>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingParticipant | null>(null);
  const [form, setForm] = useState<ParticipantInput>(emptyInput(selectedYear));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<TrainingParticipant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const visibleTargets = useMemo(
    () => targets.filter((target) => selectedYear === "all" || target.year === selectedYear),
    [targets, selectedYear],
  );

  const visibleParticipants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ko");
    return participants.filter((participant) => {
      const yearMatch = selectedYear === "all" || participantActiveInYear(participant, selectedYear) || participantGraduatedInYear(participant, selectedYear);
      const degreeMatch = degreeFilter === "all" || participant.degreeCourse === degreeFilter;
      const queryMatch = !query || [participant.name, participant.school, participant.project, participant.role].some((value) => value.toLocaleLowerCase("ko").includes(query));
      return yearMatch && degreeMatch && queryMatch;
    });
  }, [degreeFilter, participants, search, selectedYear]);

  const beneficiaryActual = selectedYear === "all"
    ? visibleTargets.reduce((sum, target) => sum + beneficiaryCount(participants, target.year), 0)
    : beneficiaryCount(participants, selectedYear);
  const beneficiaryTarget = visibleTargets.reduce((sum, target) => sum + target.beneficiaryBachelor + target.beneficiaryMaster + target.beneficiaryDoctor, 0);
  const graduateActual = selectedYear === "all"
    ? visibleTargets.reduce((sum, target) => sum + graduateCount(participants, target.year), 0)
    : graduateCount(participants, selectedYear);
  const graduateTarget = visibleTargets.reduce((sum, target) => sum + target.graduateMaster + target.graduateDoctor, 0);

  function openCreate() {
    setEditing(null);
    setForm(emptyInput(selectedYear));
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(participant: TrainingParticipant) {
    setEditing(participant);
    setForm({
      name: participant.name,
      school: participant.school,
      degreeCourse: participant.degreeCourse,
      participationStart: participant.participationStart,
      participationEnd: participant.participationEnd,
      graduationDate: participant.graduationDate,
      project: participant.project,
      role: participant.role,
      notes: participant.notes,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function saveParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setIsSaving(true);
    try {
      const response = await apiFetch("/api/participants", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "참여인력을 저장하지 못했습니다.");
      setModalOpen(false);
      setEditing(null);
      onToast(editing ? "참여인력 정보와 변경 이력을 업데이트했습니다." : "새 참여인력을 등록했습니다.");
      await onReload();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "참여인력을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteParticipant() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const response = await apiFetch("/api/participants", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: deleting.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "참여인력을 삭제하지 못했습니다.");
      setDeleting(null);
      onToast("참여인력을 삭제하고 인재양성 지표를 갱신했습니다.");
      await onReload();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "참여인력을 삭제하지 못했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  function exportCsv() {
    const header = ["이름", "학교", "학위과정", "참여 시작일", "참여 종료일", "졸업(배출)일", "프로젝트", "참여 역할", "메모", "최종 수정자", "최종 수정일"];
    const rows = visibleParticipants.map((participant) => [participant.name, participant.school, degreeLabels[participant.degreeCourse], participant.participationStart, participant.participationEnd, participant.graduationDate, participant.project, participant.role, participant.notes, `${participant.updatedByName} (${participant.updatedByEmail})`, participant.updatedAt]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `AI_Star_참여인력_${selectedYear === "all" ? "전체" : selectedYear}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel training-panel" id="training">
      <div className="section-heading training-heading">
        <div><span className="section-kicker">TALENT DEVELOPMENT</span><h2>인재양성 · 배출</h2><p>참여기간을 기준으로 수혜인원을 연차별 집계하고, 졸업일이 입력된 석·박사과정 참여자를 배출인원으로 집계합니다.</p></div>
        <div className="training-heading-actions"><button className="secondary-button" type="button" disabled={!visibleParticipants.length} onClick={exportCsv}>CSV 내보내기</button><button className="primary-button" type="button" onClick={openCreate}><span aria-hidden="true">＋</span> 참여인력 등록</button></div>
      </div>

      <div className="training-kpis">
        <TrainingKpi label="수혜인원" actual={beneficiaryActual} target={beneficiaryTarget} description="학사 · 석사 · 박사과정 참여인력" accent="beneficiary" />
        <TrainingKpi label="배출인원" actual={graduateActual} target={graduateTarget} description="졸업일이 등록된 석사 · 박사과정" accent="graduate" />
        <div className="training-rule"><span>사업계획서 기준</span><b>수혜 330명 · 배출 150명</b><small>배출은 당해연도 수행기간 1/2 이상 참여한 졸업자를 등록해 주세요.</small></div>
      </div>

      <div className="training-target-wrap">
        <table className="training-target-table">
          <thead><tr><th>연차</th><th>수혜인원 · 학사</th><th>수혜인원 · 석사</th><th>수혜인원 · 박사</th><th>배출인원 · 석사</th><th>배출인원 · 박사</th></tr></thead>
          <tbody>{visibleTargets.map((target) => <tr key={target.year}><td><span className={`stage-badge stage-${target.stage}`}>{target.stage}단계</span><b>{target.year}</b></td><TrainingTargetCell actual={beneficiaryCount(participants, target.year, "bachelor")} target={target.beneficiaryBachelor} /><TrainingTargetCell actual={beneficiaryCount(participants, target.year, "master")} target={target.beneficiaryMaster} /><TrainingTargetCell actual={beneficiaryCount(participants, target.year, "doctor")} target={target.beneficiaryDoctor} /><TrainingTargetCell actual={graduateCount(participants, target.year, "master")} target={target.graduateMaster} /><TrainingTargetCell actual={graduateCount(participants, target.year, "doctor")} target={target.graduateDoctor} /></tr>)}</tbody>
        </table>
      </div>

      <div className="training-list-head"><div><h3>참여인력 명부</h3><span>등록 인원 {participants.length}명</span></div><div className="training-filters"><label className="search-box"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름, 학교, 역할 검색" aria-label="참여인력 검색" /></label><select value={degreeFilter} onChange={(event) => setDegreeFilter(event.target.value as "all" | DegreeCourse)} aria-label="학위과정 필터"><option value="all">전체 학위과정</option>{DEGREE_COURSES.map((degree) => <option key={degree} value={degree}>{degreeLabels[degree]}</option>)}</select></div></div>
      {isLoading ? <div className="records-loading"><span /><p>참여인력을 불러오는 중입니다.</p></div> : visibleParticipants.length ? (
        <div className="records-table-wrap"><table className="records-table training-records-table"><thead><tr><th>이름 · 학위과정</th><th>학교</th><th>참여기간</th><th>배출 현황</th><th>프로젝트 · 역할</th><th>최종 수정</th><th><span className="sr-only">관리</span></th></tr></thead><tbody>{visibleParticipants.map((participant) => <tr key={participant.id}><td><button className="record-title" type="button" onClick={() => openEdit(participant)}>{participant.name}</button><small>{degreeLabels[participant.degreeCourse]}</small></td><td>{participant.school}</td><td><b className="participation-period">{formatDate(participant.participationStart)} — {participant.participationEnd ? formatDate(participant.participationEnd) : "참여 중"}</b></td><td>{participant.graduationDate ? <span className="graduate-badge">{formatDate(participant.graduationDate)} 배출</span> : <span className="muted">미배출</span>}</td><td>{participant.project || <span className="muted">미지정</span>}{participant.role ? <small>{participant.role}</small> : null}</td><td><b className="editor-name">{participant.updatedByName}</b><small>{formatDateTime(participant.updatedAt)}</small></td><td><div className="row-actions"><button type="button" onClick={() => onHistory({ id: participant.id, title: `${participant.name} · ${degreeLabels[participant.degreeCourse]}`, entityType: "training_participant" })}>이력</button><button className="danger-row-button" type="button" onClick={() => setDeleting(participant)}>삭제</button><button type="button" onClick={() => openEdit(participant)}>수정</button></div></td></tr>)}</tbody></table></div>
      ) : <div className="records-empty"><span className="empty-plus" aria-hidden="true">＋</span><div><h3>{search || degreeFilter !== "all" ? "조건에 맞는 참여인력이 없습니다" : "참여인력을 등록해 주세요"}</h3><p>참여기간과 학위과정을 입력하면 수혜·배출 지표가 자동으로 계산됩니다.</p></div>{!search && degreeFilter === "all" ? <button className="secondary-button" type="button" onClick={openCreate}>참여인력 등록</button> : null}</div>}

      {modalOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="participant-modal-title"><div className="modal-header"><div><span className="section-kicker">TRAINING PARTICIPANT</span><h2 id="participant-modal-title">{editing ? "참여인력 수정" : "새 참여인력 등록"}</h2><p>참여기간은 연차별 수혜인원, 졸업일은 석·박사 배출인원에 반영됩니다.</p></div><button className="close-button" type="button" aria-label="닫기" onClick={() => setModalOpen(false)}>×</button></div><form onSubmit={saveParticipant}><div className="form-grid"><label><span>이름 <b>*</b></span><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} required placeholder="참여자 이름" /></label><label><span>학교 <b>*</b></span><input list="school-options" value={form.school} onChange={(event) => setForm({ ...form, school: event.target.value })} maxLength={100} required placeholder="소속 대학" /><datalist id="school-options"><option value="제주대학교" /><option value="건국대학교" /></datalist></label><label><span>학위과정 <b>*</b></span><select value={form.degreeCourse} onChange={(event) => setForm({ ...form, degreeCourse: event.target.value as DegreeCourse })}>{DEGREE_COURSES.map((degree) => <option key={degree} value={degree}>{degreeLabels[degree]}</option>)}</select></label><label><span>연구 프로젝트</span><select value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}>{projectOptions.map(([value, label]) => <option key={value || "none"} value={value}>{label}</option>)}</select></label><label><span>참여 시작일 <b>*</b></span><input type="date" min="2026-07-01" max="2031-12-31" value={form.participationStart} onChange={(event) => setForm({ ...form, participationStart: event.target.value })} required /></label><label><span>참여 종료일</span><input type="date" min={form.participationStart || "2026-07-01"} max="2031-12-31" value={form.participationEnd} onChange={(event) => setForm({ ...form, participationEnd: event.target.value })} /></label><label><span>졸업(배출)일</span><input type="date" min={form.participationStart || "2026-07-01"} max={form.participationEnd || "2031-12-31"} value={form.graduationDate} onChange={(event) => setForm({ ...form, graduationDate: event.target.value })} /></label><label><span>참여 역할</span><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} maxLength={100} placeholder="학생연구원, 연구보조 등" /></label><label className="field-wide"><span>메모</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={2000} rows={3} placeholder="전공, 담당 연구, 배출 인정 확인사항 등" /></label></div>{form.degreeCourse === "bachelor" && form.graduationDate ? <p className="form-note">학사과정 졸업은 명부에 기록되지만 사업계획서의 배출인원 목표에는 포함되지 않습니다.</p> : null}{formError ? <p className="form-error" role="alert">{formError}</p> : null}<div className="modal-footer"><span>저장 시 <b>{userName}</b> 님의 수정 이력이 남습니다.</span><div>{editing ? <button className="danger-button" type="button" onClick={() => { setModalOpen(false); setDeleting(editing); }}>참여인력 삭제</button> : null}<button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>취소</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "저장 중…" : editing ? "수정 내용 저장" : "참여인력 등록"}</button></div></div></form></section></div> : null}

      {deleting ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (!isDeleting && event.currentTarget === event.target) setDeleting(null); }}><section className="modal delete-modal" role="alertdialog" aria-modal="true"><div className="delete-confirm-icon" aria-hidden="true">!</div><h2>이 참여인력을 삭제할까요?</h2><p className="delete-record-title">{deleting.name} · {degreeLabels[deleting.degreeCourse]}</p><p>삭제하면 수혜·배출 실적에서 즉시 제외되며, 삭제 이력은 보존됩니다.</p>{formError ? <p className="form-error" role="alert">{formError}</p> : null}<div className="delete-modal-actions"><button className="secondary-button" type="button" disabled={isDeleting} onClick={() => setDeleting(null)}>취소</button><button className="danger-confirm-button" type="button" disabled={isDeleting} onClick={() => void deleteParticipant()}>{isDeleting ? "삭제 중…" : "참여인력 삭제"}</button></div></section></div> : null}
    </section>
  );
}

function TrainingKpi({ label, actual, target, description, accent }: { label: string; actual: number; target: number; description: string; accent: string }) {
  const percentage = target ? Math.min((actual / target) * 100, 100) : 0;
  return <article className={`training-kpi ${accent}`}><span>{label}</span><div><strong>{actual}</strong><i>/ {target}명</i></div><p>{description}</p><em><b style={{ width: `${percentage}%` }} /></em></article>;
}

function TrainingTargetCell({ actual, target }: { actual: number; target: number }) {
  return <td><strong className={actual >= target && target > 0 ? "target-met" : ""}>{actual}</strong><span>/ {target}명</span></td>;
}

function beneficiaryCount(participants: TrainingParticipant[], year: number, degree?: DegreeCourse) {
  return participants.filter((participant) => (!degree || participant.degreeCourse === degree) && participantActiveInYear(participant, year)).length;
}

function graduateCount(participants: TrainingParticipant[], year: number, degree?: "master" | "doctor") {
  return participants.filter((participant) => (!degree || participant.degreeCourse === degree) && participantGraduatedInYear(participant, year)).length;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}

function formatDateTime(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}
