// start-render.mjs — the human renderings of the host checklist: the full listing and the brief (the per-invocation status).
// Both are pure over the rows `gather` returns; the JSON result is never shaped here.
const GROUPS = ['preflight', 'config', 'engine', 'controllers', 'services', 'seats', 'sla'];
const MARK = { green: '[GREEN]', red: '[RED]  ', warn: '[WARN] ', idle: '[IDLE] ' };

const rowLine = (mark, row) => `  ${mark} ${row.name}${row.detail ? ` - ${row.detail}` : ''}`;
const fixLine = (row) => (row.fix && row.status !== 'green' ? [`           fix: ${row.fix}`] : []);

/** The full listing: every row under its group, then APPLIED and the verdict line (`summary` from summarize). */
export function renderText(items, { applied = [], summary } = {}) {
  const lines = [];
  for (const group of GROUPS) {
    const rows = items.filter((i) => i.group === group);
    if (!rows.length) continue;
    lines.push(group.toUpperCase());
    for (const r of rows) lines.push(rowLine(MARK[r.status], r), ...fixLine(r));
  }
  if (applied.length) lines.push('APPLIED', ...applied.map((a) => `  ${a}`));
  lines.push(`START ${summary.ok ? 'GREEN' : 'RED'}: ${summary.green} green, ${summary.red} red, ${summary.warn} warn`);
  return lines.join('\n');
}

const countOf = (items, status) => items.filter((i) => i.status === status).length;

const briefHeader = (items) => {
  const red = countOf(items, 'red'), warn = countOf(items, 'warn'), green = countOf(items, 'green');
  if (!red && !warn) return `HOST all green: ${green} rows`;
  const idle = items.filter((i) => i.idle).length;
  return `HOST ${red ? 'RED' : 'WARN'}: ${red} red, ${warn} warn, ${green} green${idle ? ` (${idle} idle)` : ''}`;
};

/**
 * The brief: one verdict line, then — grouped — one line per row that is not green (each red or warn row with its fix) and one
 * line per idle agent seat, then what was applied. A host with nothing to report is the single "all green" line.
 */
export function renderBrief(items, { applied = [] } = {}) {
  const lines = [briefHeader(items)];
  for (const group of GROUPS) {
    const rows = items.filter((i) => i.group === group && (i.status !== 'green' || i.idle));
    if (!rows.length) continue;
    lines.push(group.toUpperCase());
    for (const r of rows) lines.push(rowLine(r.status === 'green' ? MARK.idle : MARK[r.status], r), ...fixLine(r));
  }
  if (applied.length) lines.push('APPLIED', ...applied.map((a) => `  ${a}`));
  return lines.join('\n');
}
