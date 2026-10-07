// Land result text formatting, kept separate from the gate and Git flow.
import { selfUpgradeNote } from './self-upgrade-ref.mjs';

export const failList = (list) => list.map((f) => `${f.file} :: ${f.name}`).join('; ');

/** The "specs red on main (k)" advisory of a land result, or null. */
export const specsRedOnMainOf = (r) => (r?.checks ?? []).find((c) => c.specsRedOnMain && c.inherited?.length) ?? null;

const checkText = (c) => c.name + (c.output ? `: ${String(c.output).split(/\r?\n/).slice(-3).join(' / ').slice(0, 300)}` : '');
const hunkText = (h) => '    @ line ' + h.line + '\n' + h.text.split('\n').map((line) => '      ' + line).join('\n');
const conflictText = (c) => 'CONFLICT ' + c.file + (c.hunks?.length ? `\n${c.hunks.map(hunkText).join('\n')}` : '');
const pushText = (push) => {
  if (!push) return '';
  const status = push.pushed ? 'ok' : push.skipped ?? `OWED: ${push.refused ?? push.error}`;
  return ` (push ${status})`;
};
const rebuildText = (rebuild) => {
  if (!rebuild) return '';
  const status = rebuild.ok ? 'ok' : `FAILED at ${rebuild.step}: ${rebuild.detail}`;
  const owed = rebuild.owed?.length ? `; owed ${rebuild.owed.join(', ')}` : '';
  return `; grammar rebuild ${status}${owed}`;
};

export function describe(r, { jobId = null } = {}) {
  const inherited = specsRedOnMainOf(r);
  const redOnMain = inherited ? `; ${inherited.name} (advisory, fix main): ${failList(inherited.inherited).slice(0, 400)}` : '';
  const who = jobId ?? (r.commits ?? []).map((c) => String(c).slice(0, 9)).join(',');
  if (r.ok && r.alreadyLanded) return `LAND already-landed ${who}: main has it at ${String(r.alreadyLanded).slice(0, 9)}, nothing moved`;
  if (r.ok) {
    return `LAND passed ${who}: main -> ${String(r.landed).slice(0, 9)}${pushText(r.push)}${rebuildText(r.grammarRebuild)}${selfUpgradeNote(r)}${redOnMain}`;
  }
  const red = (r.checks ?? []).filter((c) => !c.ok).map(checkText);
  const conflicts = (r.conflicts ?? []).map(conflictText);
  const preflight = r.preflight ? ' (preflight, before the queue)' : '';
  const detail = r.detail ? ` (${String(r.detail).slice(0, 300)})` : '';
  const dirty = r.dirty ? ` dirty: ${r.dirty.join(', ')}` : '';
  const redText = red.length ? `\n  ${red.join('\n  ')}` : '';
  const conflictsText = conflicts.length ? `\n  ${conflicts.join('\n  ')}` : '';
  const hint = r.hint ? `\n  next: ${r.hint}` : '';
  return `LAND FAILED ${who}: ${r.reason}${preflight}${detail}${dirty}${redText}${conflictsText}${hint}`;
}
