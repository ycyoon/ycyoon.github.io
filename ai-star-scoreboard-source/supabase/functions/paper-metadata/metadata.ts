export type Metadata = {
  title: string;
  authors: string;
  publication_name: string;
  publication_year: number | null;
  doi: string;
  url: string;
  abstract: string;
  keywords: string[];
  bibtex: string;
  metadata_source: string;
};
const allowed = new Set([
  "api.crossref.org",
  "export.arxiv.org",
  "arxiv.org",
  "aclanthology.org",
  "api2.openreview.net",
  "api.openreview.net",
  "proceedings.neurips.cc",
  "openaccess.thecvf.com",
  "proceedings.mlr.press",
  "link.springer.com",
  "www.sciencedirect.com",
  "ieeexplore.ieee.org",
]);
export function safeLink(raw: string) {
  try {
    const u = new URL(raw);
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function text(raw: unknown): string {
  return String(raw ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const c =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : "";
    })
    .replace(
      /&(amp|quot|apos|lt|gt|nbsp);/g,
      (_, s) =>
        (
          ({
            amp: "&",
            quot: '"',
            apos: "'",
            lt: "<",
            gt: ">",
            nbsp: " ",
          }) as Record<string, string>
        )[s] ?? "",
    )
    .replace(/\s+/g, " ")
    .trim();
}
export function extractDOI(raw: string) {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {}
  return (
    s
      .match(/10\.\d{4,9}\/[^\s?#<>"]+/i)?.[0]
      .replace(/[.,;]+$/, "")
      .toLowerCase() ?? ""
  );
}
export async function fetchText(
  url: string,
  accept = "application/json",
): Promise<string> {
  const u = new URL(url);
  if (
    u.protocol !== "https:" ||
    !allowed.has(u.hostname) ||
    u.port ||
    u.username ||
    u.password
  )
    throw new Error(
      "지원하지 않는 링크입니다. DOI 또는 지원되는 논문 링크를 입력해 주세요.",
    );
  const res = await fetch(u, {
    redirect: "manual",
    headers: { Accept: accept, "User-Agent": "AI-Star-Paper-Library/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok)
    throw new Error(
      "논문 제공처에서 정보를 가져오지 못했습니다. DOI로 다시 시도하거나 직접 입력해 주세요.",
    );
  if (Number(res.headers.get("content-length") ?? 0) > 2_000_000)
    throw new Error("응답이 너무 큽니다. DOI로 입력해 주세요.");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("빈 응답입니다.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2_000_000)
        throw new Error("응답이 너무 큽니다. DOI로 입력해 주세요.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(bytes);
}
function empty(url: string, source: string): Metadata {
  return {
    title: "",
    authors: "",
    publication_name: "",
    publication_year: null,
    doi: "",
    url,
    abstract: "",
    keywords: [],
    bibtex: "",
    metadata_source: source,
  };
}
export function makeBibtex(
  m: Metadata,
  type = "article",
  authorField?: string,
) {
  const esc = (s: string) =>
    s.replace(
      /[\\{}&%$#_^~]/g,
      (c) =>
        (
          ({
            "\\": "\\textbackslash{}",
            "^": "\\textasciicircum{}",
            "~": "\\textasciitilde{}",
          }) as Record<string, string>
        )[c] ?? "\\" + c,
    );
  const key =
    (
      (m.authors.split(/[,; ]/)[0] || "paper") +
      (m.publication_year || "") +
      m.title.split(" ").slice(0, 2).join("")
    ).replace(/[^a-zA-Z0-9]/g, "") || "paper";
  const fields: Record<string, string> = {
    title: m.title,
    author:
      authorField ??
      m.authors
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .join(" and "),
    year: String(m.publication_year ?? ""),
    [type === "inproceedings" ? "booktitle" : "journal"]: m.publication_name,
    doi: m.doi,
    url: m.url,
  };
  return `@${type}{${key},\n${Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k} = {${esc(v)}}`)
    .join(",\n")}\n}`;
}
async function crossref(doi: string): Promise<Metadata> {
  const { message: m } = JSON.parse(
    await fetchText(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    ),
  );
  if (!m?.title?.[0]) throw new Error("DOI에 연결된 제목을 찾지 못했습니다.");
  const p = empty(`https://doi.org/${doi}`, "Crossref");
  p.title = text(m.title[0]);
  p.authors = (m.author ?? [])
    .map(
      (a: { given?: string; family?: string; name?: string }) =>
        [a.given, a.family].filter(Boolean).join(" ") || a.name || "",
    )
    .filter(Boolean)
    .join("; ");
  p.publication_name = text(m["container-title"]?.[0]);
  p.publication_year = m.published?.["date-parts"]?.[0]?.[0] ?? null;
  p.doi = doi;
  p.abstract = text(m.abstract);
  p.keywords = (m.subject ?? []).map(text).slice(0, 30);
  p.bibtex = makeBibtex(
    p,
    m.type === "proceedings-article" ? "inproceedings" : "article",
  );
  return p;
}
function tag(xml: string, name: string) {
  return text(
    xml.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"),
    )?.[1],
  );
}
export function parseArxiv(xml: string, id: string): Metadata {
  const entry = xml.match(/<entry[\s>][\s\S]*?<\/entry>/)?.[0] ?? "";
  const p = empty(`https://arxiv.org/abs/${id}`, "arXiv");
  p.title = tag(entry, "title");
  if (!p.title || p.title === "Error")
    throw new Error("arXiv 논문을 찾지 못했습니다.");
  p.authors = [...entry.matchAll(/<author>([\s\S]*?)<\/author>/g)]
    .map((x) => tag(x[1], "name"))
    .join("; ");
  p.abstract = tag(entry, "summary");
  p.publication_year = Number(tag(entry, "published").slice(0, 4)) || null;
  p.publication_name = tag(entry, "arxiv:journal_ref") || "arXiv (프리프린트)";
  p.doi = tag(entry, "arxiv:doi");
  p.keywords = [...entry.matchAll(/<category\b[^>]*term="([^"]+)"/g)].map(
    (x) => x[1],
  );
  p.bibtex = makeBibtex(p, "misc").replace(
    /\n}$/,
    `,\n  eprint = {${id}},\n  archivePrefix = {arXiv}\n}`,
  );
  return p;
}
export function parseHTML(html: string, url: string): Metadata {
  const p = empty(url, new URL(url).hostname);
  const meta: Record<string, string[]> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const a of m[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      attrs[a[1].toLowerCase()] = a[2] ?? a[3];
    const k = (attrs.name ?? attrs.property ?? "").toLowerCase();
    if (k && attrs.content) (meta[k] ??= []).push(text(attrs.content));
  }
  const get = (...ks: string[]) =>
    ks.map((k) => meta[k]?.[0]).find(Boolean) ?? "";
  p.title = get("citation_title", "dc.title");
  p.authors = (meta.citation_author ?? meta["dc.creator"] ?? []).join("; ");
  p.publication_name = get(
    "citation_conference_title",
    "citation_journal_title",
    "citation_inbook_title",
  );
  p.publication_year =
    Number(
      get("citation_publication_date", "citation_date", "dc.date").match(
        /(?:19|20)\d{2}/,
      )?.[0],
    ) || null;
  p.doi = extractDOI(get("citation_doi", "dc.identifier"));
  p.abstract = get("citation_abstract", "description", "og:description");
  p.keywords = get("keywords", "citation_keywords")
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
  p.bibtex = makeBibtex(
    p,
    meta.citation_conference_title ? "inproceedings" : "article",
  );
  return p;
}
export async function extractMetadata(raw: string): Promise<Metadata> {
  const value = raw.trim();
  if (value.length > 2000) throw new Error("링크가 너무 깁니다.");
  const doi = extractDOI(value);
  if (doi) return crossref(doi);
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error("DOI 또는 https 논문 링크를 입력해 주세요.");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw new Error("https 논문 링크를 입력해 주세요.");
  if (["arxiv.org", "www.arxiv.org", "export.arxiv.org"].includes(u.hostname)) {
    const id = u.pathname
      .replace(/^\/(abs|pdf|html)\//, "")
      .replace(/\.pdf$/, "");
    if (!/^(\d{4}\.\d{4,5}|[a-z.-]+\/\d{7})(v\d+)?$/i.test(id))
      throw new Error("arXiv 논문 링크를 확인해 주세요.");
    return parseArxiv(
      await fetchText(
        `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
        "application/atom+xml",
      ),
      id,
    );
  }
  if (u.hostname === "openreview.net") {
    const id = u.searchParams.get("id");
    if (!id || !/^[\w-]+$/.test(id))
      throw new Error("OpenReview forum 링크를 확인해 주세요.");
    const { notes } = JSON.parse(
      await fetchText(
        `https://api2.openreview.net/notes?id=${encodeURIComponent(id)}`,
      ),
    );
    const n = notes?.[0];
    if (!n) throw new Error("공개된 OpenReview 논문을 찾지 못했습니다.");
    const v = (k: string) => n.content[k]?.value ?? n.content[k];
    const p = empty(`https://openreview.net/forum?id=${id}`, "OpenReview");
    p.title = text(v("title"));
    p.authors = (v("authors") ?? []).map(text).join("; ");
    p.publication_name = text(v("venue"));
    p.publication_year = n.pdate ? new Date(n.pdate).getUTCFullYear() : null;
    p.abstract = text(v("abstract"));
    p.keywords = (
      Array.isArray(v("keywords"))
        ? v("keywords")
        : String(v("keywords") ?? "").split(",")
    )
      .map(text)
      .filter(Boolean)
      .slice(0, 30);
    p.bibtex = makeBibtex(p, "misc");
    return p;
  }
  if (!allowed.has(u.hostname))
    throw new Error(
      "이 사이트는 자동 추출을 지원하지 않습니다. DOI를 입력하거나 아래 정보를 직접 작성해 주세요.",
    );
  if (u.hostname === "aclanthology.org")
    u.pathname = u.pathname.replace(/\.(pdf|bib)$/, "").replace(/\/?$/, "/");
  const p = parseHTML(await fetchText(u.href, "text/html"), u.href);
  if (p.doi) {
    try {
      return await crossref(p.doi);
    } catch {
      /* preserve HTML metadata */
    }
  }
  if (!p.title)
    throw new Error(
      "논문 정보를 찾지 못했습니다. DOI 또는 직접 입력을 이용해 주세요.",
    );
  if (u.hostname === "aclanthology.org") {
    try {
      p.bibtex = await fetchText(
        u.href.replace(/\/$/, "") + ".bib",
        "text/plain",
      );
    } catch {
      /* generated bibtex retained */
    }
  }
  return p;
}
