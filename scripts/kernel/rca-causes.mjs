// rca-causes.mjs - how one failed or blocked attempt is classified: by the TYPED fields of its report first (the blocker kind, the exit code of a recorded check), by its wording only as the
// fallback for a report that names no kind. progress-rca.mjs (causesOf) calls these in that order.
import { MISSING_PATHS_RE, GRANT_NARROW_RE, TOOL_TIMEOUT_RE, TEST_GAP_RE, CHECKER_UNAVAILABLE_RE } from './rca-matchers.mjs';

// The blocker kinds of the report schema (modules/models/kinds.yaml blockers) that name a cause by themselves; the report's words never overrule them.
const KIND_CAUSES = Object.freeze({ 'shared-change': 'grant-too-narrow', 'test-gap': 'test-gap', 'grammar-gap': 'canon-conflict', 'srs-gap': 'record-gap', 'sds-gap': 'record-gap',
  'interface-gap': 'record-gap', 'brand-gap': 'record-gap', 'checker-unavailable': 'checker-unavailable' });
// A check that exited 124 was killed by the agent's command window: a typed fact, no wording involved.
const TIMEOUT_EXIT = 124;

/**
 * The causes a TYPED field of the attempt names: the blocker kind (KIND_CAUSES) and the exit code of a recorded check. Returns [] when the report carries no typed
 * field that classifies it.
 */
export const typedCauses = ({ kind, report }) => {
  const causes = [];
  if (KIND_CAUSES[kind]) causes.push(KIND_CAUSES[kind]);
  if ((report?.checks ?? []).some((c) => Number(c.exitCode) === TIMEOUT_EXIT)) causes.push('tool-timeout');
  return causes;
};

/**
 * The text-matched causes of one attempt, appended via `add`: the FALLBACK for a report whose blocker kind is absent or names nothing ('other', 'environment', 'authority').
 * A typed kind is never overruled by its prose. What remains matched by text, and why: the runtime's own refusal strings (binding-defect), identifier tokens of a
 * checker's output (IMPORTS_BROKEN_AFTER_MOVE, TS2307, MONOREPO_TIER), and the free-text phrases of reports that name no kind (missing paths, grant too narrow, test gap, checker unavailable).
 */
export const textCauses = ({ text, kind, causes, add }) => {
  if (/guard file|bind(?:s|ing)? owned|role be, repo ledger|wrong repository/i.test(text)) add('binding-defect');
  if (/MONOREPO_TIER|monorepo-tier|canon rule .* forbids/i.test(text)) add('canon-conflict');
  if (/IMPORTS_BROKEN_AFTER_MOVE|broken-import|Cannot find module ['"]?[@./]|Module not found: (?:Error: )?Can't resolve|TS2307|unresolved import|Failed to resolve import/i.test(text)) add('broken-import');
  if (KIND_CAUSES[kind]) return;
  if (MISSING_PATHS_RE.test(text)) add('missing-paths');
  if (GRANT_NARROW_RE.test(text)) add('grant-too-narrow');
  if (TOOL_TIMEOUT_RE.test(text)) add('tool-timeout');
  if (TEST_GAP_RE.test(text)) add('test-gap');
  if (!causes.includes('broken-import') && CHECKER_UNAVAILABLE_RE.test(text) && kind === 'environment') add('checker-unavailable');
};

/** The causes in their order of weight: an unresolved import leads even when the attempt also reads as something else, and partial work (a secondary fact) trails the blocker that stopped the unit. */
export function primaryFirst(causes) {
  if (causes.includes('broken-import') && causes[0] !== 'broken-import') causes.unshift(...causes.splice(causes.indexOf('broken-import'), 1));
  if (causes[0] === 'partial-work' && causes.length > 1) causes.push(causes.shift());
  return causes;
}

