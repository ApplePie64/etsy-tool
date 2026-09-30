import { parseCsvRecords, parseMoney } from "../csv";
import { analyzeListing, type SeoReport } from "./analyzer";

export interface BulkListingRow {
  title: string;
  price: number;
  quantity: number;
  sku: string;
  tagCount: number;
  photoCount: number;
  report: SeoReport;
}

export interface BulkAuditSummary {
  listings: number;
  averageScore: number;
  gradeCounts: Record<SeoReport["grade"], number>;
  /** How many listings fail each check, most common first. */
  commonIssues: { id: string; label: string; count: number; fix?: string }[];
  rows: BulkListingRow[];
}

export interface BulkOptions {
  freeShipping: boolean;
  attributesComplete: boolean;
  isDigital: boolean;
}

/**
 * Reads the CSV from Shop Manager → Settings → Options → Download Data →
 * "Currently for sale listings". Columns used: TITLE, DESCRIPTION, PRICE,
 * QUANTITY, TAGS, IMAGE1..IMAGE20, SKU. Video, shipping and attributes are
 * not in the export, so they come from `opts`.
 */
export function auditListingsCsv(csv: string, opts: BulkOptions): BulkAuditSummary {
  const records = parseCsvRecords(csv).filter((r) => r.TITLE);
  if (records.length === 0) {
    throw new Error("No listings found. Use Etsy's \"Currently for sale listings\" CSV — it needs a TITLE column.");
  }

  const rows: BulkListingRow[] = records.map((r) => {
    const tags = (r.TAGS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    const photoCount = Object.keys(r).filter((k) => /^IMAGE\d+$/.test(k) && r[k]).length;
    const report = analyzeListing({
      title: r.TITLE ?? "",
      description: r.DESCRIPTION ?? "",
      tags,
      photoCount,
      hasVideo: false,
      freeShipping: opts.freeShipping,
      attributesComplete: opts.attributesComplete,
      isDigital: opts.isDigital,
    });
    return {
      title: r.TITLE ?? "",
      price: parseMoney(r.PRICE),
      quantity: Number(r.QUANTITY) || 0,
      sku: r.SKU ?? "",
      tagCount: tags.length,
      photoCount,
      report,
    };
  });

  rows.sort((a, b) => a.report.score - b.report.score);

  const gradeCounts: BulkAuditSummary["gradeCounts"] = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const issueMap = new Map<string, { id: string; label: string; count: number; fix?: string }>();
  for (const row of rows) {
    gradeCounts[row.report.grade]++;
    for (const c of row.report.checks) {
      // Video/attributes/shipping come from the shared options, so they'd flag every row.
      if (c.status === "pass" || c.id === "video" || c.id === "attributes" || c.id === "free-shipping") continue;
      const cur = issueMap.get(c.id) ?? { id: c.id, label: c.label, count: 0, fix: c.fix };
      cur.count++;
      issueMap.set(c.id, cur);
    }
  }

  return {
    listings: rows.length,
    averageScore: Math.round(rows.reduce((s, r) => s + r.report.score, 0) / rows.length),
    gradeCounts,
    commonIssues: [...issueMap.values()].sort((a, b) => b.count - a.count),
    rows,
  };
}
