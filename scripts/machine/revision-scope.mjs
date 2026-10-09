// revision-scope.mjs — the declared table of modules/kernel/revision-scope.yaml: which path of the runtime tree concerns which role, and the
// action each role takes when that path changes. Pure over the table and a file name; the git side (what changed between two revisions) is
// revision-change.mjs, the per-seat notice is revision-notice.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { braceVariants, globExpression } from '../lib/glob.mjs';

export const SCOPE_FILE = 'modules/kernel/revision-scope.yaml';
/** The action of a seat whose contract lost or reversed a rule, or whose boot prompt changed: heavier than every table action. */
export const REPLACE = 'replace';
const DERIVED = 'derived';
const regexes = new WeakMap();

/** The table of the tree at `root`. */
export const loadScope = (root) => parseYaml(fs.readFileSync(path.join(root, SCOPE_FILE), 'utf8'));

const patternsOf = (row) => {
  if (!regexes.has(row)) regexes.set(row, row.paths.flatMap(braceVariants).map(globExpression));
  return regexes.get(row);
};

/** The rows whose paths match `file`. */
export const rowsOf = (doc, file) => doc.rows.filter((row) => patternsOf(row).some((rx) => rx.test(file)));

const rankOf = (doc, action) => (action === REPLACE ? doc.order.length : doc.order.indexOf(action));

const derivedAction = (engineLoaded, file) => {
  if (!engineLoaded(file)) return 'none';
  return 'restart';
};

/**
 * The action of every role for a changed `file`: the heaviest of the rows it matches (a path no row matches takes `default`). The
 * engine's derived action is `restart` when `engineLoaded(file)` and `none` otherwise.
 */
export function actionsFor(doc, file, { engineLoaded = () => false } = {}) {
  const rows = rowsOf(doc, file);
  const out = {};
  for (const roles of rows.length ? rows.map((row) => row.roles) : [doc.default]) {
    for (const [role, declared] of Object.entries(roles)) {
      const action = declared === DERIVED ? derivedAction(engineLoaded, file) : declared;
      if (rankOf(doc, action) > rankOf(doc, out[role] ?? 'none')) out[role] = action;
    }
  }
  return { actions: out, rows: rows.map((row) => row.id) };
}

/** The op kinds a changed file concerns: ['*'] for a shared file, the kind a brief names, [] when the file is no op contract. */
export function opKindsOf(doc, file) {
  const rows = rowsOf(doc, file).filter((row) => row.opKinds);
  if (!rows.length) return [];
  const match = rows.map((row) => new RegExp(`^${row.opKinds.from}$`).exec(file)).find(Boolean);
  return match?.groups?.kind ? [match.groups.kind] : ['*'];
}
