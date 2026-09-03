export const METRIC_TYPES = [
  "paper_jcr_top10",
  "conference_top_tier",
  "paper_scie_q1",
  "paper_scie_other",
  "conference_other_top_tier",
  // Legacy values remain readable so previously registered papers can be
  // reclassified without guessing their new evidence tier.
  "paper_sci",
  "paper_top",
  "patent_application_domestic",
  "patent_application_international",
  "patent_registration_domestic",
  "patent_registration_international",
  "open_source",
] as const;

export type MetricType = (typeof METRIC_TYPES)[number];

export const COUNTED_PAPER_METRICS = [
  "paper_jcr_top10",
  "conference_top_tier",
] as const satisfies readonly MetricType[];

export const OTHER_PAPER_METRICS = [
  "paper_scie_q1",
  "paper_scie_other",
  "conference_other_top_tier",
] as const satisfies readonly MetricType[];

export const LEGACY_PAPER_METRICS = [
  "paper_sci",
  "paper_top",
] as const satisfies readonly MetricType[];

export const SELECTABLE_METRIC_TYPES = [
  ...COUNTED_PAPER_METRICS,
  ...OTHER_PAPER_METRICS,
  "patent_application_domestic",
  "patent_application_international",
  "patent_registration_domestic",
  "patent_registration_international",
  "open_source",
] as const satisfies readonly MetricType[];

export const metricLabels: Record<MetricType, string> = {
  paper_jcr_top10: "JCR 상위 10% 논문",
  conference_top_tier: "Top-tier 학술대회 (인정 기준 충족)",
  paper_scie_q1: "SCIE Q1 논문 (JCR 상위 10% 제외)",
  paper_scie_other: "그 외 SCIE 논문",
  conference_other_top_tier: "그 외 Top-tier 학술대회",
  paper_sci: "기존 SCI 분류 (재분류 필요)",
  paper_top: "기존 Top conference 분류 (재분류 필요)",
  patent_application_domestic: "국내 특허 출원",
  patent_application_international: "국외 특허 출원",
  patent_registration_domestic: "국내 특허 등록",
  patent_registration_international: "국외 특허 등록",
  open_source: "공개SW",
};

export const metricGroups: Record<
  "paper" | "otherPaper" | "application" | "registration" | "software",
  MetricType[]
> = {
  paper: [...COUNTED_PAPER_METRICS],
  otherPaper: [...OTHER_PAPER_METRICS, ...LEGACY_PAPER_METRICS],
  application: [
    "patent_application_domestic",
    "patent_application_international",
  ],
  registration: [
    "patent_registration_domestic",
    "patent_registration_international",
  ],
  software: ["open_source"],
};

export type AnnualTarget = {
  year: number;
  stage: number;
  paperSci: number;
  paperTop: number;
  patentApplicationDomestic: number;
  patentApplicationInternational: number;
  patentRegistrationDomestic: number;
  patentRegistrationInternational: number;
  openSource: number;
  beneficiaryBachelor: number;
  beneficiaryMaster: number;
  beneficiaryDoctor: number;
  graduateMaster: number;
  graduateDoctor: number;
};

export const DEGREE_COURSES = ["bachelor", "master", "doctor"] as const;
export type DegreeCourse = (typeof DEGREE_COURSES)[number];

export const degreeLabels: Record<DegreeCourse, string> = {
  bachelor: "학사과정",
  master: "석사과정",
  doctor: "박사과정",
};

export type PerformanceRecord = {
  id: string;
  metricType: MetricType;
  acknowledgementCount: number;
  year: number;
  title: string;
  organization: string;
  project: string;
  achievementDate: string;
  identifier: string;
  url: string;
  notes: string;
  createdByEmail: string;
  createdByName: string;
  updatedByEmail: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export type AuditLog = {
  id: number;
  recordId: string;
  entityType: "performance" | "training_participant";
  action: "created" | "updated" | "deleted";
  summary: string;
  changedByEmail: string;
  changedByName: string;
  snapshot: string;
  createdAt: string;
};

export type TrainingParticipant = {
  id: string;
  name: string;
  school: string;
  degreeCourse: DegreeCourse;
  participationStart: string;
  participationEnd: string;
  graduationDate: string;
  project: string;
  role: string;
  notes: string;
  createdByEmail: string;
  createdByName: string;
  updatedByEmail: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export type DashboardPayload = {
  targets: AnnualTarget[];
  records: PerformanceRecord[];
  participants: TrainingParticipant[];
  activity: AuditLog[];
};

export type ParticipantInput = Pick<
  TrainingParticipant,
  | "name"
  | "school"
  | "degreeCourse"
  | "participationStart"
  | "participationEnd"
  | "graduationDate"
  | "project"
  | "role"
  | "notes"
>;

export type RecordInput = Pick<
  PerformanceRecord,
  | "metricType"
  | "acknowledgementCount"
  | "year"
  | "title"
  | "organization"
  | "project"
  | "achievementDate"
  | "identifier"
  | "url"
  | "notes"
>;

export function isMetricType(value: unknown): value is MetricType {
  return typeof value === "string" && METRIC_TYPES.includes(value as MetricType);
}

export function isSelectableMetricType(value: unknown): value is MetricType {
  return (
    typeof value === "string" &&
    (SELECTABLE_METRIC_TYPES as readonly string[]).includes(value)
  );
}

export function isDegreeCourse(value: unknown): value is DegreeCourse {
  return typeof value === "string" && DEGREE_COURSES.includes(value as DegreeCourse);
}

export function participantActiveInYear(participant: TrainingParticipant, year: number) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  return (
    participant.participationStart <= yearEnd &&
    (!participant.participationEnd || participant.participationEnd >= yearStart)
  );
}

export function participantGraduatedInYear(participant: TrainingParticipant, year: number) {
  return (
    (participant.degreeCourse === "master" || participant.degreeCourse === "doctor") &&
    participant.graduationDate.startsWith(`${year}-`)
  );
}

export function isPaperMetric(metric: MetricType) {
  return (
    (COUNTED_PAPER_METRICS as readonly string[]).includes(metric) ||
    (OTHER_PAPER_METRICS as readonly string[]).includes(metric) ||
    (LEGACY_PAPER_METRICS as readonly string[]).includes(metric)
  );
}

export function isCountedPaperMetric(metric: MetricType) {
  return (COUNTED_PAPER_METRICS as readonly string[]).includes(metric);
}

export function isOtherPaperMetric(metric: MetricType) {
  return (
    (OTHER_PAPER_METRICS as readonly string[]).includes(metric) ||
    isLegacyPaperMetric(metric)
  );
}

export function isLegacyPaperMetric(metric: MetricType) {
  return (LEGACY_PAPER_METRICS as readonly string[]).includes(metric);
}

export function countsTowardScoreboard(metric: MetricType) {
  return !isPaperMetric(metric) || isCountedPaperMetric(metric);
}

export function creditedAmount(
  record: Pick<PerformanceRecord, "metricType" | "acknowledgementCount">,
) {
  if (!isPaperMetric(record.metricType)) return 1;
  const count = Number.isInteger(record.acknowledgementCount)
    ? Math.max(1, record.acknowledgementCount)
    : 1;
  return 1 / count;
}

export function creditedAmountLabel(
  record: Pick<PerformanceRecord, "metricType" | "acknowledgementCount">,
) {
  if (!isPaperMetric(record.metricType) || record.acknowledgementCount <= 1) return "1건";
  if (record.acknowledgementCount === 2) return "0.5건";
  return `1/${record.acknowledgementCount}건`;
}

export function targetForMetric(target: AnnualTarget, metric: MetricType) {
  const map: Record<MetricType, number> = {
    paper_jcr_top10: target.paperSci,
    conference_top_tier: target.paperTop,
    paper_scie_q1: 0,
    paper_scie_other: 0,
    conference_other_top_tier: 0,
    paper_sci: 0,
    paper_top: 0,
    patent_application_domestic: target.patentApplicationDomestic,
    patent_application_international: target.patentApplicationInternational,
    patent_registration_domestic: target.patentRegistrationDomestic,
    patent_registration_international: target.patentRegistrationInternational,
    open_source: target.openSource,
  };
  return map[metric];
}
