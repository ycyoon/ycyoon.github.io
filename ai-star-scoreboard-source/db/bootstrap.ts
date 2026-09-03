import { getD1 } from ".";

let initialization: Promise<void> | null = null;

const targetRows = [
  [2026, 1, 0, 8, 10, 0, 0, 0, 10, 10, 20, 10, 0, 0],
  [2027, 1, 6, 16, 12, 4, 0, 0, 15, 15, 30, 10, 20, 2],
  [2028, 2, 9, 20, 15, 6, 6, 0, 20, 15, 30, 10, 25, 4],
  [2029, 2, 15, 26, 18, 8, 8, 2, 25, 20, 30, 10, 25, 6],
  [2030, 3, 20, 30, 20, 10, 10, 4, 30, 20, 30, 10, 25, 8],
  [2031, 3, 24, 40, 20, 12, 12, 6, 40, 20, 30, 10, 25, 10],
] as const;

export async function ensureDatabase() {
  if (!initialization) {
    initialization = initializeDatabase().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function initializeDatabase() {
  const d1 = await getD1();

  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS annual_targets (
      year integer PRIMARY KEY NOT NULL,
      stage integer NOT NULL,
      paper_sci integer NOT NULL,
      paper_top integer NOT NULL,
      patent_application_domestic integer NOT NULL,
      patent_application_international integer NOT NULL,
      patent_registration_domestic integer NOT NULL,
      patent_registration_international integer NOT NULL,
      open_source integer NOT NULL,
      beneficiary_bachelor integer DEFAULT 0 NOT NULL,
      beneficiary_master integer DEFAULT 0 NOT NULL,
      beneficiary_doctor integer DEFAULT 0 NOT NULL,
      graduate_master integer DEFAULT 0 NOT NULL,
      graduate_doctor integer DEFAULT 0 NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS performance_records (
      id text PRIMARY KEY NOT NULL,
      metric_type text NOT NULL,
      acknowledgement_count integer DEFAULT 1 NOT NULL,
      year integer NOT NULL,
      title text NOT NULL,
      organization text NOT NULL,
      project text DEFAULT '' NOT NULL,
      achievement_date text DEFAULT '' NOT NULL,
      identifier text DEFAULT '' NOT NULL,
      url text DEFAULT '' NOT NULL,
      notes text DEFAULT '' NOT NULL,
      created_by_email text NOT NULL,
      created_by_name text NOT NULL,
      updated_by_email text NOT NULL,
      updated_by_name text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      archived integer DEFAULT false NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS audit_logs (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      record_id text NOT NULL,
      entity_type text DEFAULT 'performance' NOT NULL,
      action text NOT NULL,
      summary text NOT NULL,
      changed_by_email text NOT NULL,
      changed_by_name text NOT NULL,
      snapshot text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS training_participants (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      school text NOT NULL,
      degree_course text NOT NULL,
      participation_start text NOT NULL,
      participation_end text DEFAULT '' NOT NULL,
      graduation_date text DEFAULT '' NOT NULL,
      project text DEFAULT '' NOT NULL,
      role text DEFAULT '' NOT NULL,
      notes text DEFAULT '' NOT NULL,
      created_by_email text NOT NULL,
      created_by_name text NOT NULL,
      updated_by_email text NOT NULL,
      updated_by_name text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      archived integer DEFAULT false NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS access_requests (
      email text PRIMARY KEY NOT NULL,
      display_name text NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      requested_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      reviewed_at text DEFAULT '' NOT NULL,
      reviewed_by_email text DEFAULT '' NOT NULL,
      reviewed_by_name text DEFAULT '' NOT NULL
    )`),
    d1.prepare("CREATE INDEX IF NOT EXISTS performance_records_year_idx ON performance_records (year)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS performance_records_metric_idx ON performance_records (metric_type)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS audit_logs_record_idx ON audit_logs (record_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS training_participants_school_idx ON training_participants (school)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS training_participants_degree_idx ON training_participants (degree_course)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests (status)"),
  ]);

  await d1.batch(
    targetRows.map((row) =>
      d1.prepare(`INSERT INTO annual_targets (
        year, stage, paper_sci, paper_top,
        patent_application_domestic, patent_application_international,
        patent_registration_domestic, patent_registration_international,
        open_source, beneficiary_bachelor, beneficiary_master, beneficiary_doctor,
        graduate_master, graduate_doctor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(year) DO UPDATE SET
        stage = excluded.stage,
        paper_sci = excluded.paper_sci,
        paper_top = excluded.paper_top,
        patent_application_domestic = excluded.patent_application_domestic,
        patent_application_international = excluded.patent_application_international,
        patent_registration_domestic = excluded.patent_registration_domestic,
        patent_registration_international = excluded.patent_registration_international,
        open_source = excluded.open_source,
        beneficiary_bachelor = excluded.beneficiary_bachelor,
        beneficiary_master = excluded.beneficiary_master,
        beneficiary_doctor = excluded.beneficiary_doctor,
        graduate_master = excluded.graduate_master,
        graduate_doctor = excluded.graduate_doctor`).bind(...row),
    ),
  );
}
