import ExcelJS from "exceljs";

type Row = Record<string, unknown>;
const labels: Record<string, string> = {
  item: "항목",
  detail: "설명",
  id: "기록 ID",
  title: "논문 제목",
  authors: "저자",
  professors: "참여 교수",
  publication_name: "학회·저널명",
  publication_year: "발표·게재 연도",
  doi: "DOI",
  url: "논문 링크",
  abstract: "초록",
  keywords: "키워드",
  bibtex: "BibTeX",
  notes: "메모",
  metadata_source: "정보 출처",
  source_record_id: "연결된 성과 ID",
  created_by_user_id: "등록자 ID",
  created_by_email: "등록자 이메일",
  created_by_name: "등록자",
  updated_by_user_id: "수정자 ID",
  updated_by_email: "수정자 이메일",
  updated_by_name: "최종 수정자",
  created_at: "등록 시각 (UTC)",
  updated_at: "수정 시각 (UTC)",
  archived: "삭제 여부",
  paper_id: "공유 논문 ID",
  paper_title: "공유 논문 제목",
  citing_title: "인용한 논문 제목",
  citing_url: "인용한 논문 링크",
  citation_status: "진행 상태",
  citation_date: "인용 기록일",
  entity_id: "대상 기록 ID",
  entity_type: "대상 구분",
  action: "작업",
  actor_id: "작업자 ID",
  actor_name: "작업자",
  snapshot: "변경 후 데이터",
};
const paperFields = [
  "id",
  "title",
  "authors",
  "professors",
  "publication_name",
  "publication_year",
  "doi",
  "url",
  "keywords",
  "abstract",
  "bibtex",
  "notes",
  "metadata_source",
  "source_record_id",
  "created_by_user_id",
  "created_by_email",
  "created_by_name",
  "created_at",
  "updated_by_user_id",
  "updated_by_email",
  "updated_by_name",
  "updated_at",
  "archived",
];
const citationFields = [
  "id",
  "paper_id",
  "paper_title",
  "citing_title",
  "citing_url",
  "citation_status",
  "citation_date",
  "notes",
  "created_by_user_id",
  "created_by_email",
  "created_by_name",
  "created_at",
  "updated_by_user_id",
  "updated_by_email",
  "updated_by_name",
  "updated_at",
  "archived",
];
function flatten(row: Row): Row {
  const result: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      key === "snapshot" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      for (const [k, v] of Object.entries(value))
        result[`snapshot.${k}`] = Array.isArray(v) ? JSON.stringify(v) : v;
    } else result[key] = Array.isArray(value) ? JSON.stringify(value) : value;
  }
  // Excel limits a cell to 32,767 UTF-16 characters. Preserve long values in numbered columns.
  for (const [key, value] of Object.entries(result))
    if (typeof value === "string" && value.length > 30000) {
      const points = Array.from(value);
      let part = "",
        index = 1;
      delete result[key];
      for (const ch of points) {
        if (part.length + ch.length > 30000) {
          result[`${key} [${index++}]`] = part;
          part = "";
        }
        part += ch;
      }
      result[`${key} [${index}]`] = part;
    }
  return result;
}
export async function createPaperWorkbook(
  papers: Row[],
  citations: Row[],
  activity: Row[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Star 성과 스코어보드";
  workbook.created = new Date();
  const titles = new Map(papers.map((p) => [p.id, p.title]));
  const addSheet = (name: string, input: Row[], initial: string[]) => {
    const rows = input.map(flatten);
    const keys = [...new Set([...initial, ...rows.flatMap(Object.keys)])];
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = keys.map((key) => ({
      key,
      header: key.startsWith("snapshot.")
        ? `변경 후 · ${labels[key.slice(9)] ?? key.slice(9)}`
        : (labels[key] ?? key),
      width: /title|abstract|bibtex|notes/.test(key) ? 55 : 25,
    }));
    for (const row of rows) {
      const values = keys.map((key) => {
        const v = row[key];
        return v == null
          ? ""
          : typeof v === "number" ||
              typeof v === "boolean" ||
              typeof v === "string"
            ? v
            : JSON.stringify(v);
      });
      const r = sheet.addRow(values);
      r.height = 45;
      r.alignment = { vertical: "top", wrapText: true };
    }
    const header = sheet.getRow(1);
    header.height = 30;
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF153B4B" },
    };
    header.alignment = { vertical: "middle", wrapText: true };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(sheet.rowCount, 1), column: keys.length },
    };
  };
  addSheet("공유 논문", papers, paperFields);
  addSheet(
    "인용 기록",
    citations.map((c) => ({ ...c, paper_title: titles.get(c.paper_id) ?? "" })),
    citationFields,
  );
  addSheet(
    "변경 이력",
    activity.map((a) => ({ ...a, paper_title: titles.get(a.paper_id) ?? "" })),
    [
      "id",
      "paper_id",
      "paper_title",
      "entity_id",
      "entity_type",
      "action",
      "actor_id",
      "actor_name",
      "created_at",
    ],
  );
  addSheet(
    "내려받기 안내",
    [
      {
        item: "범위",
        detail:
          "논문 공유의 전체 논문·인용 기록·변경 이력. 검색·교수 필터와 관계없이 삭제된 기록까지 포함합니다.",
      },
      {
        item: "삭제 여부",
        detail: "TRUE는 삭제된 기록, FALSE는 현재 사용 중인 기록입니다.",
      },
      {
        item: "기록 연결",
        detail:
          "공유 논문의 기록 ID와 인용·변경 이력의 공유 논문 ID로 연결합니다.",
      },
      {
        item: "진행 상태",
        detail: "draft: 작성 중 / submitted: 투고 / published: 게재",
      },
      {
        item: "작업",
        detail:
          "created: 등록 / updated: 수정 / deleted: 삭제. paper: 논문 / citation: 인용",
      },
      {
        item: "변경 이력",
        detail:
          "각 변경 시점의 전체 필드가 변경 후 열에 기록됩니다. 긴 내용은 번호가 붙은 열에 이어집니다.",
      },
      {
        item: "시각",
        detail: "등록·수정 시각은 UTC 원본 값입니다. 한국 시각은 UTC+9입니다.",
      },
      {
        item: "키워드",
        detail: "원본 구분을 보존하기 위해 JSON 배열로 저장합니다.",
      },
      { item: "생성 시각", detail: new Date().toISOString() },
    ],
    ["item", "detail"],
  );
  return workbook.xlsx.writeBuffer();
}
