/**
 * Small RFC 4180 CSV parser: quoted fields, escaped quotes, commas and
 * newlines inside quotes, CRLF, and a leading byte-order mark. Etsy's
 * "Download data" exports are all in this format.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Parses CSV into objects keyed by upper-cased, trimmed header names. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toUpperCase());
  return body.map((r) => {
    const rec: Record<string, string> = {};
    keys.forEach((k, i) => {
      rec[k] = (r[i] ?? "").trim();
    });
    return rec;
  });
}

/** Parses "$1,234.50", "1.234,50", "£12" etc. into a number (NaN if empty). */
export function parseMoney(v: string | undefined): number {
  if (!v) return NaN;
  let s = v.replace(/[^\d.,-]/g, "");
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  return s === "" ? NaN : Number(s);
}
