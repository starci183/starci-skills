// R280 safety net: the app-owned ledger of catalog keys the detector cannot see.
// A side (fe or be) declares them in <side>/i18n-dynamic-keys.yaml; a key the ledger names counts as read, a stale
// or malformed ledger is itself an HFS_UNUSED_SYMBOL finding, so the ledger cannot rot.
import { isPlainObject } from '../../../engine/plain-object.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { found, readText } from './read.mjs';

const LEDGER_FILE = 'i18n-dynamic-keys.yaml';
export const LEDGER_SCHEMA = 'starci/i18n-dynamic-keys@1';
const CODE = 'HFS_UNUSED_SYMBOL';
const MATCHERS = ['key', 'prefix', 'suffix'];
const FIELDS = new Set([...MATCHERS, 'reason']);
const SIDES = new Set(['fe', 'be']);
const text = value => typeof value === 'string' && value.trim() !== '';
const describe = entry => `${entry.kind} ${JSON.stringify(entry.value)}`;

/** The catalog namespace (the dotted path before the leaf; '' when none) and the leaf of a candidate name. */
function splitCatalogName(name) {
  const at = name.lastIndexOf('.');
  return at < 0 ? { namespace: '', leaf: name } : { namespace: name.slice(0, at), leaf: name.slice(at + 1) };
}

const MATCH = { key: (leaf, value) => leaf === value, prefix: (leaf, value) => leaf.startsWith(value), suffix: (leaf, value) => leaf.endsWith(value) };
const matches = (entry, leaf) => MATCH[entry.kind](leaf, entry.value);

function entryProblem(entry) {
  if (!isPlainObject(entry)) return 'is not a mapping';
  const unknown = Object.keys(entry).filter(field => !FIELDS.has(field));
  if (unknown.length) return `has unknown field ${unknown.map(field => JSON.stringify(field)).join(', ')} (allowed: key, prefix, suffix, reason)`;
  const given = MATCHERS.filter(field => field in entry);
  if (given.length !== 1) return `must have exactly one of key, prefix or suffix (has ${given.length ? given.join(' and ') : 'none'})`;
  if (!text(entry[given[0]])) return `${given[0]} must be a non-empty string`;
  if (!text(entry.reason)) return 'must have a non-empty string reason';
  return null;
}

/** Parse the ledger text: `{ entries, problems }`; a problem is one precise message about the file's shape. */
function parseLedger(source) {
  let doc;
  try { doc = parseYaml(source); } catch { return { entries: [], problems: ['is not valid YAML'] }; }
  if (!isPlainObject(doc)) return { entries: [], problems: ['must be a mapping with schema and namespaces'] };
  const problems = [];
  for (const field of Object.keys(doc)) if (!['schema', 'namespaces'].includes(field)) problems.push(`has unknown top-level field ${JSON.stringify(field)}`);
  if (doc.schema !== LEDGER_SCHEMA) problems.push(`schema must be ${LEDGER_SCHEMA}`);
  if (!isPlainObject(doc.namespaces)) { problems.push('namespaces must be a mapping of namespace to a list of entries'); return { entries: [], problems }; }
  const entries = [];
  for (const [namespace, list] of Object.entries(doc.namespaces)) {
    if (!Array.isArray(list)) { problems.push(`namespace ${JSON.stringify(namespace)} must be a list of entries`); continue; }
    list.forEach((entry, index) => {
      const problem = entryProblem(entry);
      if (problem) { problems.push(`namespace ${JSON.stringify(namespace)} entry ${index + 1} ${problem}`); return; }
      const kind = MATCHERS.find(field => field in entry);
      entries.push({ namespace, kind, value: entry[kind] });
    });
  }
  return { entries, problems };
}

/**
 * Mark every catalog key the side's ledger names as read, and return the ledger's own findings (malformed, or an entry
 * matching no catalog key). No file means no ledger. Only a fe side reads its fe ledger and a be side its be ledger.
 */
export function applyDynamicKeysLedger(state, profile) {
  if (!SIDES.has(profile)) return [];
  const source = readText(state.repoRoot, LEDGER_FILE);
  if (source === null) return [];
  const { entries, problems } = parseLedger(source);
  const own = (message, name) => found(CODE, LEDGER_FILE, `${LEDGER_FILE}: ${message}`, { line: 1, column: 1, kind: 'dynamic-keys ledger', name });
  const findings = problems.map(problem => own(`malformed dynamic-keys ledger: ${problem}.`, 'ledger'));
  const catalog = state.candidates.filter(candidate => candidate.kind === 'catalog key').map(candidate => ({ candidate, ...splitCatalogName(candidate.name) }));
  for (const entry of entries) {
    const hits = catalog.filter(({ namespace, leaf }) => namespace === entry.namespace && matches(entry, leaf));
    for (const { candidate } of hits) candidate.used = true;
    if (!hits.length) findings.push(own(`dynamic-keys ledger entry ${describe(entry)} in namespace ${JSON.stringify(entry.namespace)} matches no catalog key; delete it.`, `${entry.namespace}:${describe(entry)}`));
  }
  return findings;
}
