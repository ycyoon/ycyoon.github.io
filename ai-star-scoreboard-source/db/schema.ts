import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const annualTargets = sqliteTable("annual_targets", {
  year: integer("year").primaryKey(),
  stage: integer("stage").notNull(),
  paperSci: integer("paper_sci").notNull(),
  paperTop: integer("paper_top").notNull(),
  patentApplicationDomestic: integer("patent_application_domestic").notNull(),
  patentApplicationInternational: integer("patent_application_international").notNull(),
  patentRegistrationDomestic: integer("patent_registration_domestic").notNull(),
  patentRegistrationInternational: integer("patent_registration_international").notNull(),
  openSource: integer("open_source").notNull(),
  beneficiaryBachelor: integer("beneficiary_bachelor").notNull().default(0),
  beneficiaryMaster: integer("beneficiary_master").notNull().default(0),
  beneficiaryDoctor: integer("beneficiary_doctor").notNull().default(0),
  graduateMaster: integer("graduate_master").notNull().default(0),
  graduateDoctor: integer("graduate_doctor").notNull().default(0),
});

export const performanceRecords = sqliteTable(
  "performance_records",
  {
    id: text("id").primaryKey(),
    metricType: text("metric_type").notNull(),
    acknowledgementCount: integer("acknowledgement_count").notNull().default(1),
    year: integer("year").notNull(),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    project: text("project").notNull().default(""),
    achievementDate: text("achievement_date").notNull().default(""),
    identifier: text("identifier").notNull().default(""),
    url: text("url").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdByEmail: text("created_by_email").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedByEmail: text("updated_by_email").notNull(),
    updatedByName: text("updated_by_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("performance_records_year_idx").on(table.year),
    index("performance_records_metric_idx").on(table.metricType),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recordId: text("record_id").notNull(),
    entityType: text("entity_type").notNull().default("performance"),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    changedByEmail: text("changed_by_email").notNull(),
    changedByName: text("changed_by_name").notNull(),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_logs_record_idx").on(table.recordId),
    index("audit_logs_created_idx").on(table.createdAt),
  ],
);

export const trainingParticipants = sqliteTable(
  "training_participants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    school: text("school").notNull(),
    degreeCourse: text("degree_course").notNull(),
    participationStart: text("participation_start").notNull(),
    participationEnd: text("participation_end").notNull().default(""),
    graduationDate: text("graduation_date").notNull().default(""),
    project: text("project").notNull().default(""),
    role: text("role").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdByEmail: text("created_by_email").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedByEmail: text("updated_by_email").notNull(),
    updatedByName: text("updated_by_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("training_participants_school_idx").on(table.school),
    index("training_participants_degree_idx").on(table.degreeCourse),
  ],
);

export const accessRequests = sqliteTable(
  "access_requests",
  {
    email: text("email").primaryKey(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("pending"),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at").notNull().default(""),
    reviewedByEmail: text("reviewed_by_email").notNull().default(""),
    reviewedByName: text("reviewed_by_name").notNull().default(""),
  },
  (table) => [index("access_requests_status_idx").on(table.status)],
);
