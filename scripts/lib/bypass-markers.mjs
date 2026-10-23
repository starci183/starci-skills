// bypass-markers.mjs - what a BYPASS of a check looks like in text (owner ruling loosening-always-red: any bypass is red, always).
// One table serves both sides of the no-bypass law:
//   product   scripts/hfs/rules/bypass-markers.mjs (HFS_BYPASS_MARKER, `starci app check`) and `starci app hygiene` (the pre-commit
//             hook) read a whole file and refuse every marker in it;
//   runtime   scripts/lib/gate-loosening.mjs reads the ADDED lines of a diff of a watched check, canon template or workflow.
// A marker is a way to make a check pass without satisfying it: an inline disable of any tool, a type-check escape, a Sonar or
// coverage exclusion comment, a skipped or focused test, a failure swallowed in a hook or a workflow step.
// The patterns are assembled from fragments (joined) so that this file never spells a marker itself: the runtime detector watches
// its own library like every other check script.
const join = (...parts) => parts.join('');
const COMMENT_OPEN = /\/\/|\/\*/g;

const SUPPRESSION_WORDS = [
  join('eslint', '-disable'), join('stylelint', '-disable'), join('tslint', ':disable'), join('prettier', '-ignore'), join('biome', '-ignore'),
  join('@ts', '-ignore'), join('@ts', '-expect-error'), join('@ts', '-nocheck'), join('NO', 'SONAR'),
  join('istanbul', ' ignore'), join('c8', ' ignore'), join('v8', ' ignore'), join('jscpd', ':ignore'),
];
const escaped = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const COMMENT_MARKER = new RegExp(`(${SUPPRESSION_WORDS.map(escaped).join('|')})`);

const TEST_MARKERS = [
  [new RegExp(String.raw`\b(?:it|test|describe|suite|context)\.(?:skip|only|todo|failing)\b`), 'a skipped or focused test'],
  [new RegExp(String.raw`\b(?:xit|xtest|xdescribe|fit|fdescribe)\(`), 'a skipped or focused test'],
  [new RegExp(String.raw`\.skipIf\(|\.runIf\(`), 'a conditionally skipped test'],
  [new RegExp(String.raw`\bskip\s*:\s*(?!false\b)\S`), 'a skip option'],
  [new RegExp(String.raw`\bpending\(\)`), 'a pending test'],
];

const SWALLOW = [
  [/\|\|\s*(?:true|:)(?![\w-])/, 'a failure swallowed with `|| true`'],
  [/\bcontinue-on-error\s*:\s*(?!false\b)\S/, join('continue', '-on-error')],
  [/\bset\s+\+e\b/, 'set +e'],
  [/\bHUSKY\s*=\s*0\b/, 'HUSKY=0'],
  [/--no-verify\b/, '--no-verify'],
  [/\bfail_ci_if_error\s*:\s*false\b/, 'fail_ci_if_error: false'],
];

// A weakening of the run itself that today's rendered canon still spells in places (the CI template runs jest with it); the runtime
// detector refuses it as an ADDED line, the product rule waits until the canon is rid of it.
const PENDING = [
  [/--passWithNoTests\b/, '--passWithNoTests'],
  [/--coverageThreshold\b/, '--coverageThreshold'],
];

const CODE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|css|scss|less)$/;
const SHELL_FILE = /(?:^|\/)(?:\.husky\/(?!_\/)[^/]+|[^/]+\.sh|hooks\/husky\/[^/]+)$/;
const WORKFLOW_FILE = /(?:^|\/)(?:\.github|github)\/(?:workflows|actions)\/.+\.ya?ml$/;
const MANIFEST_FILE = /(?:^|\/)package\.json$/;
const SKIPPED_TREE = /(?:^|\/)(?:node_modules|dist|coverage|\.next|build)\//;
const GENERATED_NAME = /(?:^|\/)(?:package-lock\.json|[^/]+\.generated\.[^/]+|[^/]+\.min\.[^/]+)$/;

/** The kind of text `file` holds for the markers: 'code', 'shell' (hooks, scripts), 'workflow', 'manifest', or null for a file no marker is read in. */
export function bypassFileKind(file) {
  if (SKIPPED_TREE.test(file) || GENERATED_NAME.test(file)) return null;
  if (SHELL_FILE.test(file)) return 'shell';
  if (WORKFLOW_FILE.test(file)) return 'workflow';
  if (MANIFEST_FILE.test(file)) return 'manifest';
  if (CODE_FILE.test(file)) return 'code';
  return null;
}

/** Whether `index` of `line` is outside every quoted string (a marker spelled inside a string is data, not a directive). */
function outsideQuotes(line, index) {
  let quote = null;
  for (let at = 0; at < index; at += 1) {
    const char = line[at];
    if (quote) {
      if (char === '\\') at += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === '`') quote = char;
  }
  return quote === null;
}

/** The text of a shell line without its `$(...)` and backtick substitutions: `|| true` inside one is a query, not a bypass. */
const withoutSubstitutions = (line) => line.replace(/\$\([^()]*\)/g, '').replace(/`[^`]*`/g, '');

const hitsOf = (pairs, line) => pairs.filter(([pattern]) => pattern.test(line)).map(([, label]) => label);

function commentHit(line) {
  for (const open of line.matchAll(COMMENT_OPEN)) {
    if (!outsideQuotes(line, open.index)) continue;
    const marker = COMMENT_MARKER.exec(line.slice(open.index));
    if (marker) return marker[1];
  }
  return null;
}

/** The labels of the bypass markers on one `line` of a file of `kind` ([] when none). `pending` also reads the markers the canon still spells. */
export function bypassLabelsOf(kind, line, { pending = false } = {}) {
  if (kind === 'code') {
    const comment = commentHit(line);
    const tests = TEST_MARKERS.filter(([pattern]) => {
      const hit = pattern.exec(line);
      return hit && outsideQuotes(line, hit.index);
    }).map(([, label]) => label);
    return [...(comment ? [comment] : []), ...tests];
  }
  if (kind === 'shell' || kind === 'workflow' || kind === 'manifest') {
    const text = withoutSubstitutions(line);
    if (kind === 'manifest' && !/"[^"]+"\s*:\s*"/.test(line)) return [];
    if (/^\s*#/.test(text)) return [];
    return [...hitsOf(SWALLOW, text), ...(pending ? hitsOf(PENDING, text) : [])];
  }
  return [];
}

/**
 * Every bypass marker of the text of one file: [{line, label, text}] (line numbers from 1). The file's kind decides the patterns;
 * a file of no kind has none.
 */
export function bypassesIn(file, text, options = {}) {
  const kind = bypassFileKind(file);
  if (!kind || typeof text !== 'string') return [];
  return text.split(/\r?\n/).flatMap((content, index) => bypassLabelsOf(kind, content, options).map((label) => ({ line: index + 1, label, text: content.trim() })));
}
