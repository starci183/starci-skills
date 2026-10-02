// raw-command-scan.mjs - classify command-shaped guidance with the shared R223 policy evaluator.
// This module only extracts explicit command spans; command admission remains command-policy.yaml plus policyVerdict().
import { policyVerdict } from '../../guards/command-policy.mjs';
import { maskTextRange } from '../../lib/text-mask.mjs';
import { lineTextAt, sentenceRanges, sentenceTextAt } from '../../lib/tracked-text-scan.mjs';
import { sentencesOf } from '../check-guidance-commands.mjs';

const POLICY_PROGRAMS = new Set([
  'git', 'npm', 'npx', 'pnpm', 'yarn',
  'docker', 'docker-compose', 'podman', 'supabase', 'gh', 'schtasks',
  'jest', 'vitest', 'mocha', 'pytest', 'playwright', 'cypress',
]);
const NPX_PROGRAMS = new Set(['jest', 'vitest', 'mocha', 'playwright', 'cypress']);
const PROHIBITION = /\b(?:forbidden|refused|removed|retired|never|denied|raw)\b/i;
const HISTORY = /(?:^|\/)CHANGELOG[^/]*$/i;
const CATALOG_TEXT_FIELDS = new Set(['conventions', 'removed']);

const posix = (value) => String(value).replace(/\\/g, '/');
const programName = (value) => {
  const word = posix(value).toLowerCase().replace(/\.(?:exe|cmd|bat|ps1)$/, '');
  return word.includes('/') ? null : word;
};
const lineAt = (text, at) => text.slice(0, at).split('\n').length;

/** Whether a tracked path is agent-facing guidance in the R201 raw-command scope. */
function isRawGuidanceFile(file) {
  const rel = posix(file);
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  return rel.startsWith('docs/')
    || (!rel.includes('/') && /^README/i.test(base))
    || (!rel.includes('/') && /^CONTEXT/i.test(base))
    || rel.startsWith('skills/')
    || rel.startsWith('knowledge/')
    || /(?:^|\/)prompts?(?:\/|$)/i.test(rel)
    || (rel.startsWith('modules/') && /\.(?:md|ya?ml)$/i.test(rel));
}

/** Whole-file exemptions shared by the raw-guidance pass. */
function isRawGuidanceExempt(file) {
  const rel = posix(file);
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  return rel.startsWith('tests/')
    || HISTORY.test(base)
    || rel.startsWith('modules/kernel/contract-changes/')
    || rel === 'modules/kernel/command-policy.yaml'
    || /^packages\/[^/]+\/runtime\//.test(rel);
}

/** Mask catalog `conventions` and `removed` values without changing source offsets. */
function maskCatalogGuidanceFields(text, file) {
  const rel = posix(file);
  if (!rel.startsWith('modules/cli/commands/') || !/\.ya?ml$/i.test(rel)) return String(text);
  let result = String(text);
  let blockIndent = null;
  for (const match of result.matchAll(/.*(?:\n|$)/g)) {
    if (!match[0]) continue;
    const line = match[0];
    const content = line.replace(/[\r\n]+$/, '');
    const indent = /^\s*/.exec(content)[0].length;
    const key = /^\s*([A-Za-z][A-Za-z0-9-]*)\s*:/.exec(content)?.[1] ?? null;
    const starts = key && CATALOG_TEXT_FIELDS.has(key);
    const continues = blockIndent !== null && (!content.trim() || indent > blockIndent);
    if (starts || continues) result = maskTextRange(result, match.index, match.index + line.length);
    if (starts) blockIndent = /:\s*$/.test(content) ? indent : null;
    else if (blockIndent !== null && content.trim() && indent <= blockIndent) blockIndent = null;
  }
  return result;
}

const addCandidate = (out, seen, text, at) => {
  const value = String(text).trim();
  if (!value) return;
  const key = `${at}\0${value}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ text: value, at });
};

/** Explicit command spans: fenced lines, inline code, and shell/PowerShell prompt lines. */
function rawCommandSpans(text) {
  const source = String(text);
  const out = [], seen = new Set();
  let fenced = false;
  for (const match of source.matchAll(/.*(?:\n|$)/g)) {
    if (!match[0]) continue;
    const line = match[0].replace(/[\r\n]+$/, '');
    if (/^\s*(?:```|~~~)/.test(line)) { fenced = !fenced; continue; }
    const prompt = /^\s*(?:[-*]\s+)?(?:\$|PS>|>)\s+(.+)$/i.exec(line);
    if (fenced) addCandidate(out, seen, line, match.index + (/^\s*/.exec(line)?.[0].length ?? 0));
    else if (prompt) addCandidate(out, seen, prompt[1], match.index + prompt.index + prompt[0].indexOf(prompt[1]));
  }
  for (const match of source.matchAll(/`([^`\r\n]+)`/g)) addCandidate(out, seen, match[1], match.index + 1);
  return out.sort((a, b) => a.at - b.at || a.text.localeCompare(b.text));
}

const shellWords = (text) => [...String(text).matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)]
  .map((match) => match[1] ?? match[2] ?? match[3]).filter(Boolean);

const npxProgram = (args) => {
  let index = 0;
  while (index < args.length && args[index].startsWith('-')) {
    const option = args[index].split('=', 1)[0];
    if (['-p', '--package'].includes(option) && !args[index].includes('=')) index += 1;
    index += 1;
  }
  return programName(args[index]);
};

/** Split the permitted simple shell separators; command text is guidance, never executed. */
function commandsFromSpan(text) {
  const out = [];
  for (let segment of String(text).replace(/^\s*(?:\$|PS>|>)\s*/i, '').split(/&&|[;|]/)) {
    segment = segment.trim();
    if (!segment) continue;
    const words = shellWords(segment);
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
    if (!words.length || words[0].toLowerCase() === 'cd') continue;
    const program = programName(words.shift());
    if (!program) continue;
    const args = words;
    if (program === 'node' && !args.some((arg) => arg === '--test' || arg.startsWith('--test='))) continue;
    if (program === 'npx' && !NPX_PROGRAMS.has(npxProgram(args))) continue;
    if (program !== 'node' && !POLICY_PROGRAMS.has(program)) continue;
    out.push({ program, args, text: segment });
  }
  return out;
}

/** Raw side-effecting command findings in one guidance file. */
export function rawCommandFindingsInText(text, file, { policy, cwd = process.cwd() } = {}) {
  const rel = posix(file);
  if (!policy || !isRawGuidanceFile(rel) || isRawGuidanceExempt(rel)) return [];
  const original = String(text);
  const source = maskCatalogGuidanceFields(original, rel);
  const ranges = sentenceRanges(original, sentencesOf(original));
  const findings = [];
  for (const span of rawCommandSpans(source)) {
    const context = /\.ya?ml$/i.test(rel) ? lineTextAt(original, span.at) : sentenceTextAt(ranges, span.at, original);
    if (PROHIBITION.test(context)) continue;
    for (const command of commandsFromSpan(span.text)) {
      const verdict = policyVerdict({ role: 'op', command: { ...command, cwd }, policy });
      if (!verdict) continue;
      findings.push({
        code: 'CLI_ONLY_ENTRY',
        file: rel,
        line: lineAt(original, span.at),
        kind: 'raw-guidance',
        program: command.program,
        sub: command.args[0] ?? '',
        spelling: command.text.replace(/[ \t]+/g, ' ').trim(),
        use: verdict.use,
        text: lineTextAt(original, span.at),
      });
    }
  }
  const unique = [...new Map(findings.map((finding) => [
    `${finding.file}\0${finding.line}\0${finding.program}\0${finding.sub}\0${finding.spelling}`,
    finding,
  ])).values()];
  return unique.sort((a, b) => a.line - b.line || a.spelling.localeCompare(b.spelling));
}

/** Stable summary of raw findings keyed by their policy-provided replacement text. */
export function rawUseCounts(findings) {
  const counts = new Map();
  for (const finding of findings.filter((item) => item.kind === 'raw-guidance')) {
    counts.set(finding.use, (counts.get(finding.use) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
}
