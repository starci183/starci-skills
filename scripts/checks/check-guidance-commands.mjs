#!/usr/bin/env node
// check-guidance-commands.mjs - agent-facing guidance never tells an agent to run a command the command guard refuses
// (RT_GUIDANCE_REFUSED_COMMAND; part of `npm run check`). The Supervisor's runtime-defect class once told it to open an
// "Opus lane (git worktree add ...)" while the guard refuses every raw `git worktree add`: the text and the enforcer
// disagreed. The refusal matcher is the guard's own (scripts/guards/command-guard.mjs commandVerdict, one home); this
// check only finds the commands and decides whether the text TELLS an agent to run them.
//   node scripts/checks/check-guidance-commands.mjs [--root <tree>] [--json]
//
// Read: every tracked string field of modules/**/*.yaml (the failure-code catalog, which is the refusal-message catalog
// itself, and the modules/kernel/contract-changes/ history excepted), the agent prompts modules/**/*.md, and
// skills/**/SKILL.md. A command is a backticked span, a double-quoted span (Markdown prose), a parenthesised span, a
// fenced code line, or the text after an imperative "run". Each is evaluated by commandVerdict with static deps: no git,
// no lock recovery, a cwd outside every repository, so only the command text decides.
// A refused command is NOT a finding when its sentence:
//   - forbids it: a negation (never, do not, don't, not, no, nor, without, instead of, rather than, avoid, plus the
//     Vietnamese negations of the source-phrases lexicon) before the command, or a refusal verb (refuses, is refused,
//     is blocked, and the lexicon's refused forms) after it;
//   - describes what happened or what the runtime itself does, not what the agent should do: a past-tense narrative
//     (was, were, ran, had in the command's own clause; ran, followed, deleted, emptied, restarted right after it), or
//     the runtime as the actor of the command's own clause (the runtime, a *.mjs script or a camelCase API name, then a
//     third-person verb within three words: "land.mjs fast-forwards ...", "the runtime runs ..."). A clause boundary
//     (, ; :) between them ends the excuse: "if land.mjs fails, run `git reset --hard`" is an instruction.
// The sentence is the unit, never the file: a "never" one sentence away does not excuse an instruction.
// Exit 0 clean, 1 findings, 2 bad arguments.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { commandVerdict } from '../guards/command-guard.mjs';
import * as gitPolicy from '../guards/git-policy.mjs';
import * as depsGuard from '../guards/deps-guard.mjs';
import { CATALOG_FILE } from './check-failure-codes.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { isMain } from '../lib/is-main.mjs';
import { altOf } from '../lib/source-phrases.mjs';

export const GUIDANCE_CODE = 'RT_GUIDANCE_REFUSED_COMMAND';
const HISTORY_DIR = 'modules/kernel/contract-changes/';

/** The guidance files of a tree: repository-relative POSIX paths. */
export const isGuidanceFile = (rel) => (rel.startsWith('modules/') && (rel.endsWith('.yaml') || rel.endsWith('.md'))
  && rel !== CATALOG_FILE && !rel.startsWith(HISTORY_DIR))
  || /^skills\/[^/]+\/SKILL\.md$/.test(rel);

/* ------------------------------------------------------------ sentences */

/** `text` cut into sentences; a backticked span never splits. */
export function sentencesOf(text) {
  const out = [];
  const s = String(text ?? '');
  let start = 0, tick = false;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '`') tick = !tick;
    else if (!tick && /[.!?]/.test(s[i]) && /\s/.test(s[i + 1] ?? '') && /[A-Z0-9`("']/.test(s.slice(i + 1).trimStart()[0] ?? '')) {
      out.push(s.slice(start, i + 1).trim()); start = i + 1;
    }
  }
  const last = s.slice(start).trim();
  if (last) out.push(last);
  return out.filter(Boolean);
}

/** The outermost parenthesised spans of `s` outside backticks: [{text, at}]. */
function parenSpans(s) {
  const out = [];
  let depth = 0, from = -1, tick = false;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '`') tick = !tick;
    else if (tick) continue;
    else if (s[i] === '(') { if (depth++ === 0) from = i; }
    else if (s[i] === ')' && depth > 0 && --depth === 0) out.push({ text: s.slice(from + 1, i), at: from });
  }
  return out;
}

/** The commands a sentence shows: [{text, at, end}] (at/end: the span's place in the sentence). */
export function commandSpans(sentence, { prose = true } = {}) {
  const s = String(sentence);
  const out = [];
  for (const m of s.matchAll(/`([^`]+)`/g)) out.push({ text: m[1], at: m.index, end: m.index + m[0].length });
  if (prose) for (const m of s.matchAll(/"([^"]+)"/g)) out.push({ text: m[1], at: m.index, end: m.index + m[0].length });
  for (const p of parenSpans(s)) out.push({ text: p.text.replace(/`/g, ''), at: p.at, end: p.at + p.text.length + 2 });
  for (const m of s.matchAll(/\brun\s+(?!`)([^,;:`]+?)(?=\s+-\s|[,;:]|\.(?:\s|$)|$)/gi)) out.push({ text: m[1], at: m.index, end: m.index + m[0].length });
  return out;
}

// The Vietnamese alternatives are matcher data, not source: modules/goal/source-phrases.yaml (source-phrases.mjs).
const NEGATION = new RegExp(`\\b(?:never|not|no|nor|without|avoid|instead of|rather than|don't|do not|must not|cannot|${altOf('guidance.negation')})\\b`, 'i');
const REFUSED_AFTER = new RegExp(`^[^.;]*?\\b(?:refuses?|is refused|are refused|is blocked|are blocked|${altOf('guidance.refused')})\\b`, 'i');
const PAST_BEFORE = /\b(?:was|were|ran|had)\b[^,;:]*$/i;
const PAST_AFTER = /^\W{0,3}(?:,?\s*which\s+)?(?:ran|followed|deleted|emptied|restarted|wiped)\b/i;
const RUNTIME_ACTOR = /(?:\bthe runtime\b|\bruntime's\b|[\w/.-]+\.mjs\b|\b[a-z]+[A-Z]\w*\b)(?:\s+\w+){0,3}?\s+(?:[\w-]+s|is the only)\b[^,;:]*$/;
// A clause whose SUBJECT is a runtime actor (the runtime, the host-side controller, the reconciler, the GC, the finish, a script
// file) describes what the runtime itself does, whatever punctuation follows: the clause is the text after the last . ; | or
// table cell break before the command.
const RUNTIME_SUBJECT = /^\s*(?:the\s+)?(?:runtime(?:'s)?|host-side controller|controller|reconciler|GC|garbage collector|finish|settle|land gate|[\w/.-]+\.mjs)\b/i;

/** Why the refused command at `span` of `sentence` is not an instruction, or null when it is one. */
export function excusedBy(sentence, span) {
  const before = sentence.slice(0, span.at);
  const after = sentence.slice(span.end);
  if (NEGATION.test(before) || REFUSED_AFTER.test(after)) return 'prohibition';
  if (PAST_BEFORE.test(before) || PAST_AFTER.test(after)) return 'narrative';
  if (RUNTIME_ACTOR.test(before)) return 'runtime-internal';
  const clause = before.split(/[.;|]/).pop();
  if (RUNTIME_SUBJECT.test(clause)) return 'runtime-internal';
  return null;
}

/* ------------------------------------------------------------ guard verdict */

// Static deps for the guard's own matcher: no git spawn, no index-lock recovery, nothing written.
const STATIC_DEPS = Object.freeze({
  policy: gitPolicy, npm: depsGuard,
  git: { lsFiles: () => ({ status: 1, stdout: '', stderr: '' }), revParseQuery: () => ({ status: 1, stdout: '', stderr: '' }), configGet: () => ({ ok: false, stdout: '', stderr: '' }) },
  indexLock: { preflightIndexLock: async () => {} },
  say: () => {},
});
const STATIC_CWD = path.join(os.tmpdir(), 'starci-guidance-check-no-repo');

/** The guard's refusal of one command text, or null. */
export async function refusalOf(command) {
  try { return await commandVerdict({ command, cwd: STATIC_CWD, guard: null, env: {}, deps: STATIC_DEPS }); }
  catch { return null; }
}

/** The findings of one text unit: [{command, code, sentence}]. `prose`: double-quoted spans count (Markdown, not YAML). */
export async function textFindings(text, { prose = true } = {}) {
  const out = [];
  for (const sentence of sentencesOf(text)) {
    for (const span of commandSpans(sentence, { prose })) {
      const verdict = await refusalOf(span.text);
      if (!verdict || excusedBy(sentence, span)) continue;
      out.push({ command: span.text.trim().slice(0, 200), code: verdict.code, sentence: sentence.slice(0, 300) });
    }
  }
  return out;
}

/* ------------------------------------------------------------ files */

/** The string leaves of a parsed YAML value: [{key, text}]. */
function stringLeaves(value, key = '', out = []) {
  if (typeof value === 'string') out.push({ key, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => stringLeaves(v, `${key}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) stringLeaves(v, key ? `${key}.${k}` : k, out);
  return out;
}

/** The text units of a Markdown document: [{key, text, fenced}] - prose paragraphs, table cells and fenced code lines. */
export function markdownUnits(text) {
  const out = [];
  let para = [], fence = false, lastSentence = '', line0 = 0;
  const flush = () => {
    if (para.length) { const t = para.join(' '); out.push({ key: `line ${line0}`, text: t }); lastSentence = sentencesOf(t).at(-1) ?? ''; }
    para = [];
  };
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(?:```|~~~)/.test(line)) { flush(); fence = !fence; return; }
    if (fence) { if (line.trim()) out.push({ key: `line ${i + 1}`, text: `${lastSentence} \`${line.trim().replace(/`/g, '')}\``, fenced: true }); return; }
    if (/^\s*\|/.test(line)) { flush(); line.split('|').map((c) => c.trim()).filter(Boolean).forEach((c) => out.push({ key: `line ${i + 1}`, text: c })); return; }
    if (!line.trim() || /^\s*(?:[-*+]|\d+\.|#+)\s/.test(line)) flush();
    if (line.trim()) { if (!para.length) line0 = i + 1; para.push(line.trim()); }
  });
  flush();
  return out;
}

/** {ok, findings: [{file, key, command, code, sentence}], files} over the tracked guidance of `root`. */
export async function scanGuidance(root = skillRoot, { files = null } = {}) {
  const listed = files ?? (() => { const r = lsFiles([], { cwd: root, maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : []; })();
  const findings = [];
  let count = 0;
  for (const rel of listed.map((f) => f.replace(/\\/g, '/')).filter(isGuidanceFile)) {
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    count += 1;
    let units;
    if (rel.endsWith('.md')) units = markdownUnits(text);
    else { try { units = stringLeaves(parseYaml(text)); } catch { continue; } }
    for (const u of units) for (const f of await textFindings(u.text, { prose: rel.endsWith('.md') })) findings.push({ file: rel, key: u.key, ...f });
  }
  return { ok: findings.length === 0, findings, files: count };
}

async function main(argv) {
  let root = skillRoot, asJson = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = path.resolve(argv[++i] ?? '');
    else if (argv[i] === '--json') asJson = true;
    else { console.error(`unknown argument ${argv[i]}`); return 2; }
  }
  const r = await scanGuidance(root);
  if (asJson) console.log(JSON.stringify({ code: r.ok ? null : GUIDANCE_CODE, ...r }, null, 2));
  else {
    for (const f of r.findings) console.log(`  ${GUIDANCE_CODE} ${f.file} ${f.key}: tells an agent to run \`${f.command}\`, which the command guard refuses (${f.code})`);
    console.log(r.ok ? `check-guidance-commands: no guidance tells an agent to run a refused command (${r.files} files)` : `check-guidance-commands: red (${r.findings.length} finding(s))`);
  }
  return r.ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
