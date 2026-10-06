// rule-ids.mjs - RT_RULE_ID_UNKNOWN and RT_RULE_UNCITED (knowledge/hfs/rules.yaml, gate runtime): every `R<digits>` the
// tracked prose, comments and arrays name is a rule of the catalog (the catalog loader refuses a duplicate or malformed id),
// and every rule of the catalog is named by at least one `hfsRules:` of a knowledge/patterns topic or carries `scope: runtime`.
// Rule ids are unique names, not a counted run: a gap between two ids is fine.
//   RT_RULE_ID_UNKNOWN  an id no rule has.
//   RT_RULE_UNCITED     a rule no pattern topic cites and that is not marked `scope: runtime`: product law exists to be taught.
// History paths (isHistoryPath: changelogs, benchmark findings, .starciwork records) record the rules of their day, so a deleted rule keeps its id there; specs (tests/**) and generated copies are not read. Pure apart from ctx.read.
import { isHistoryPath } from '../../lib/check-scan.mjs';
import { loadRuleCatalog } from '../slots.mjs';

export const UNKNOWN = 'RT_RULE_ID_UNKNOWN';
const UNCITED = 'RT_RULE_UNCITED';
const READ = /\.(?:mjs|cjs|js|ts|tsx|md|ya?ml|json)$/;
const SKIPPED = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json)$|^tests\//;
const RULE_ID = /\bR\d{2,3}\b/g;
const PATTERN_FILE = /^knowledge\/patterns\/.*\.yaml$/;
const HFS_RULES = /hfsRules:\s*\[([^\]]*)\]/g;

/** RT_RULE_ID_UNKNOWN and RT_RULE_UNCITED over the catalog and every tracked text file (ctx of scripts/hfs/runtime-check.mjs). */
export function ruleIdFindings(ctx) {
  const catalog = loadRuleCatalog({ root: ctx.root });
  const rules = new Set(catalog.rules.map((r) => r.id));
  const generated = (ctx.params.generated ?? []).map((entry) => `${entry.root}/`);
  const found = [];
  for (const file of ctx.files) {
    if (!READ.test(file) || SKIPPED.test(file) || isHistoryPath(file) || generated.some((root) => file.startsWith(root))) continue;
    const text = ctx.read(file);
    if (text === null || text === undefined) continue;
    text.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(RULE_ID)) {
        const id = match[0];
        if (rules.has(id)) continue;
        found.push({ code: UNKNOWN, level: 'error', path: file, line: index + 1, message: `${UNKNOWN} ${file}:${index + 1}: ${id} is not a rule of knowledge/hfs/rules.yaml; cite a rule of the catalog or drop the id` });
      }
    });
  }
  // The other direction: every product rule is taught by a pattern topic that names it in `hfsRules:`; a rule that governs
  // this repository itself carries `scope: runtime` instead. Not judged when the patterns are not in view.
  const cited = new Set();
  let patterns = 0;
  for (const file of ctx.files) {
    if (!PATTERN_FILE.test(file)) continue;
    const text = ctx.read(file);
    if (text === null || text === undefined) continue;
    patterns += 1;
    for (const match of text.matchAll(HFS_RULES)) for (const id of match[1].matchAll(RULE_ID)) cited.add(id[0]);
  }
  if (patterns) for (const rule of catalog.rules) {
    if (rule.scope === 'runtime' || cited.has(rule.id)) continue;
    found.push({ code: UNCITED, level: 'error', path: 'knowledge/hfs/rules.yaml', message: `${UNCITED} knowledge/hfs/rules.yaml: ${rule.id} (${rule.code}) is named by no hfsRules of a knowledge/patterns/** topic and carries no scope: runtime; cite it from the topic that teaches it, or mark it scope: runtime` });
  }
  return found;
}
