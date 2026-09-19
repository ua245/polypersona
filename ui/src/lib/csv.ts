// Reading a customer data file in the browser, and choosing which customers become agents.
export interface CsvTable { filename: string; columns: string[]; rows: Record<string, string>[] }

/** RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string, filename = 'upload.csv'): CsvTable {
  const src = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let field = '', record: string[] = [], quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      record.push(field); field = '';
      if (record.some((v) => v.trim() !== '')) records.push(record);
      record = [];
    } else field += c;
  }
  record.push(field);
  if (record.some((v) => v.trim() !== '')) records.push(record);
  const [header, ...body] = records;
  const columns = (header ?? []).map((h) => h.trim());
  const rows = body.map((r) => Object.fromEntries(columns.map((col, i) => [col, (r[i] ?? '').trim()])));
  return { filename, columns, rows };
}

/** Columns the server maps straight onto a persona. With name and bio present no model call is needed. */
export const PERSONA_COLUMNS = ['name', 'bio', 'goals', 'frustrations', 'tech_savviness', 'patience_steps', 'viewport', 'reading_style', 'products_bought', 'address'];
export const recognisedColumns = (t: CsvTable) => t.columns.filter((c) => PERSONA_COLUMNS.includes(c.toLowerCase()));
export const mapsDirectly = (t: CsvTable) => ['name', 'bio'].every((c) => t.columns.some((x) => x.toLowerCase() === c));

/** Counts per value of a column, largest first. Used to show who is in the file. */
export function breakdown(t: CsvTable, column: string): { value: string; count: number }[] {
  const key = t.columns.find((c) => c.toLowerCase() === column.toLowerCase());
  if (!key) return [];
  const counts = new Map<string, number>();
  // "Very High" and "Very high" are the same answer: group case-insensitively, show the first spelling seen.
  const label = new Map<string, string>();
  for (const r of t.rows) {
    const raw = r[key] || 'unknown';
    const k = raw.toLowerCase();
    if (!label.has(k)) label.set(k, raw);
    counts.set(label.get(k)!, (counts.get(label.get(k)!) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/**
 * A representative sample: group customers by the given columns, then take from each group in turn
 * (largest groups first) so the panel mirrors the mix in the file. Deterministic for a given file.
 * Returns 0-based row indexes.
 */
export function representativeSample(t: CsvTable, n: number, by: string[] = ['tech_savviness', 'viewport']): number[] {
  const keys = by.map((b) => t.columns.find((c) => c.toLowerCase() === b)).filter((k): k is string => !!k);
  const groups = new Map<string, number[]>();
  t.rows.forEach((r, i) => {
    const g = keys.map((k) => r[k]).join('|');
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(i);
  });
  const queues = [...groups.values()].sort((a, b) => b.length - a.length);
  const seenNames = new Set<string>();
  const nameKey = t.columns.find((c) => c.toLowerCase() === 'name');
  const picked: number[] = [];
  for (let round = 0; picked.length < Math.min(n, t.rows.length) && round < t.rows.length; round++) {
    for (const q of queues) {
      if (picked.length >= n) break;
      // prefer a customer whose name is not already in the panel, so agents are easy to tell apart
      const at = q.findIndex((i) => !nameKey || !seenNames.has(t.rows[i]![nameKey]!));
      const [idx] = q.splice(at >= 0 ? at : 0, 1);
      if (idx == null) continue;
      picked.push(idx);
      if (nameKey) seenNames.add(t.rows[idx]![nameKey]!);
    }
  }
  return picked.sort((a, b) => a - b);
}
