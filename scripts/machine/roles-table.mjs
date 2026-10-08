// roles-table.mjs — the owner-facing table generated from the roles contract (modules/kernel/roles.yaml): the five roles by
// scope, function, the happy errors each handles and what each does on a bug. No document restates it by hand; the
// roles-contract check keeps the copy between its markers in docs/workflow-kernel.md equal to this rendering.
const TABLE_BEGIN = '<!-- roles:table:begin -->';
const TABLE_END = '<!-- roles:table:end -->';

const cell = (text) => String(text).replaceAll('|', '/').replaceAll('\n', ' ');

/** The pending entry of `role` that covers `requirement`, or null. */
export const pendingFor = (role, requirement) => (role.pending ?? []).find((entry) => entry.requirements?.includes(requirement)) ?? null;

function happyCell(role) {
  if (role.happyErrors?.length) return role.happyErrors.map((error) => `${error.id} (${error.row})`).join('; ');
  const pending = pendingFor(role, 'happy-errors');
  return pending ? `pending, lane ${pending.lane}` : 'none declared';
}

const bugCell = (doc, role) => (role.id === 'debug' ? doc.standard.onBug.debug : doc.standard.onBug.chain);

/** The Markdown table of the five roles of `doc.standard.roles`. */
export function renderRolesTable(doc) {
  const rows = doc.standard.roles.map((id) => doc.roles.find((role) => role.id === id)).map((role) => [role.label, role.scope,
    `Owns ${role.owns}; decides alone ${role.decidesAlone}`, happyCell(role), bugCell(doc, role)]);
  const head = ['Role', 'Scope', 'Function', 'Happy errors it handles', 'On a bug'];
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n');
}

/** The text with the table section replaced between its markers; the markers must exist. */
export function withRolesTable(text, doc) {
  const from = text.indexOf(TABLE_BEGIN);
  const to = text.indexOf(TABLE_END);
  if (from < 0 || to < from) throw new Error(`the document lacks ${TABLE_BEGIN} ... ${TABLE_END}`);
  return `${text.slice(0, from + TABLE_BEGIN.length)}\n${renderRolesTable(doc)}\n${text.slice(to)}`;
}

/** The table currently between the markers of `text`, or null. */
export function tableOf(text) {
  const from = text.indexOf(TABLE_BEGIN);
  const to = text.indexOf(TABLE_END);
  return from < 0 || to < from ? null : text.slice(from + TABLE_BEGIN.length + 1, to - 1);
}
