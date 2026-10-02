// rule-ids.mjs - RT_RULE_ID_UNKNOWN and RT_RULE_ID_GAP (knowledge/hfs/rules.yaml, gate runtime): every `R<digits>` the
// tracked prose, comments and arrays name is a rule of the catalog, and the ids of the catalog run from R01 to the last rule
// with no undeclared gap.
//   RT_RULE_ID_UNKNOWN  an id no rule has. A retired id (the catalog's `retired` list) is a history name: only the history files
//                       (contract changes and changelogs) may still spell it; live knowledge, docs and code may not.
//   RT_RULE_ID_GAP      an id between R01 and the last rule that is neither a rule nor listed as retired.
// Specs (tests/**) and generated copies are not read: a spec spells made-up ids as fixtures. Pure apart from ctx.read.
import { loadRuleCatalog } from '../slots.mjs';

export const UNKNOWN = 'RT_RULE_ID_UNKNOWN';
export const GAP = 'RT_RULE_ID_GAP';
const READ = /\.(?:mjs|cjs|js|ts|tsx|md|ya?ml|json)$/;
const SKIPPED = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json)$|^tests\//;
const HISTORY = /^modules\/kernel\/contract-changes\/|(?:^|\/)CHANGELOG\.md$|^knowledge\/hfs\/rules\.yaml$/;
const RULE_ID = /\bR\d{2,3}\b/g;

const idNumber = (id) => Number(id.slice(1));
const idName = (n) => `R${String(n).padStart(2, '0')}`;

/** The problems of the catalog's `retired` list: an entry with no id or reason, an id twice, an id that is also a rule (a retired id is never reused). */
export function retiredProblems(catalog) {
  const rules = new Set(catalog.rules.map((r) => r.id));
  const seen = new Set();
  const bad = [];
  for (const entry of catalog.retired) {
    if (!/^R[0-9]{2,3}$/.test(String(entry?.id)) || typeof entry.reason !== 'string' || !entry.reason.trim()) bad.push(`retired entry ${JSON.stringify(entry)} needs an id R<digits> and a reason`);
    else if (rules.has(entry.id)) bad.push(`${entry.id} is both a rule and retired: a retired id is never reused`);
    else if (seen.has(entry.id)) bad.push(`${entry.id} is retired twice`);
    seen.add(entry?.id);
  }
  return bad;
}

/** The ids the catalog's id run misses, as ['R03', ...]: neither a rule nor retired, up to the last rule. */
export function gapIds(catalog) {
  const known = new Set([...catalog.rules.map((r) => r.id), ...catalog.retired.map((r) => r.id)]);
  const last = Math.max(...catalog.rules.map((r) => idNumber(r.id)));
  const missing = [];
  for (let n = 1; n <= last; n += 1) if (!known.has(idName(n))) missing.push(idName(n));
  return missing;
}

/** RT_RULE_ID_UNKNOWN and RT_RULE_ID_GAP over the catalog and every tracked text file (ctx of scripts/hfs/runtime-check.mjs). */
export function ruleIdFindings(ctx) {
  const catalog = loadRuleCatalog({ root: ctx.root });
  const rules = new Set(catalog.rules.map((r) => r.id));
  const retired = new Set(catalog.retired.map((r) => r.id));
  const generated = (ctx.params.generated ?? []).map((entry) => `${entry.root}/`);
  const found = [];
  const gaps = gapIds(catalog);
  if (gaps.length) found.push({ code: GAP, level: 'error', path: 'knowledge/hfs/rules.yaml', message: `${GAP} knowledge/hfs/rules.yaml: ${gaps.join(', ')} ${gaps.length === 1 ? 'is' : 'are'} neither a rule nor listed under retired; declare each retired id with its reason, or restore the rule` });
  for (const problem of retiredProblems(catalog)) found.push({ code: GAP, level: 'error', path: 'knowledge/hfs/rules.yaml', message: `${GAP} knowledge/hfs/rules.yaml: ${problem}` });
  for (const file of ctx.files) {
    if (!READ.test(file) || SKIPPED.test(file) || generated.some((root) => file.startsWith(root))) continue;
    const text = ctx.read(file);
    if (text === null || text === undefined) continue;
    const history = HISTORY.test(file);
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(RULE_ID)) {
        const id = match[0];
        if (rules.has(id) || (history && retired.has(id))) continue;
        const why = retired.has(id) ? 'a retired rule, which only history files may name' : 'not a rule of knowledge/hfs/rules.yaml';
        found.push({ code: UNKNOWN, level: 'error', path: file, line: index + 1, message: `${UNKNOWN} ${file}:${index + 1}: ${id} is ${why}; cite a rule of the catalog or drop the id` });
      }
    });
  }
  return found;
}
