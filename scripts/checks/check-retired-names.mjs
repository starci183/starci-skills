#!/usr/bin/env node
// check-retired-names.mjs — RT_RETIRED_NAME_LIVE (rule R207): a name the retired registry declares dead never appears
// in a live tracked file — not in prose, a comment, a string literal or a path. "One pattern, no legacy": the living
// text names what runs now, so a deleted name may survive only where history keeps it.
//
// The tokens come only from modules/kernel/retired-paths.yaml: every retired[].path and every moved[].from is a dead
// path (a directory row covers what is below it), and retiredNames[] declares the dead namings that are not paths (a
// deleted app, a layer naming, a verb prefix).
//
// Never scanned: history (modules/kernel/contract-changes/, CHANGELOG*.md, benchmark/, .starciwork/ records), the
// registry itself (it must name what it declares dead), the generated copy roots, and the two files of this check —
// like the one allowlist's own files, they carry the tokens they enforce. In the slot manifests a `forbids:` value and
// the `path:` of a `presence: forbidden` tombstone slot declare a refusal, not a use; those lines are not read.
//
// Exit 0 clean, 1 lists every live occurrence as file:line, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { isMain } from '../lib/is-main.mjs';
import { RETIRED_PATHS_FILE, generatedRootsOf, isHistoryPath, lineOf, runReportMain } from '../lib/check-scan.mjs';

const HELP = `Usage: check-retired-names [--root <tree>] [--json]

Refuses every retired name of modules/kernel/retired-paths.yaml (retired[].path,
moved[].from, retiredNames[].name) in a live tracked file. Exit 0 clean, 1 lists
the live occurrences, 2 is a bad argument.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RETIRED_NAME_LIVE = 'RT_RETIRED_NAME_LIVE';
/** The files of this check name the tokens they enforce. */
const SELF_FILES = new Set(['scripts/checks/check-retired-names.mjs', 'tests/checks/retired-names.spec.mjs']);
/** The slot manifests: refusal declarations there are enforcement, not use. */
const MANIFESTS = new Set(['knowledge/hfs/slots.yaml', 'knowledge/hfs/runtime-slots.yaml']);

/** The dead tokens `root`'s registry declares: [{token, kind, why}]. */
export function retiredNameTokens(root = DEFAULT_ROOT) {
  const file = path.join(root, RETIRED_PATHS_FILE);
  const doc = fs.existsSync(file) ? (parseYaml(fs.readFileSync(file, 'utf8')) ?? {}) : {};
  const tokens = [];
  for (const r of doc.retired ?? []) if (r?.path) tokens.push({ token: String(r.path), kind: 'retired path', why: r.replacedBy ? `replaced by ${r.replacedBy}` : 'retired' });
  for (const m of doc.moved ?? []) if (m?.from) tokens.push({ token: String(m.from), kind: 'moved path', why: `moved to ${m.to}` });
  for (const n of doc.retiredNames ?? []) if (n?.name) tokens.push({ token: String(n.name), kind: 'retired name', why: n.note ?? 'a retired name' });
  return tokens;
}

/**
 * A slot manifest's refusal declarations are not uses: blank every `forbids:` value and the `path:` value of a
 * `presence: forbidden` slot (a tombstone exists to refuse the name it lists). Line count is kept.
 */
const blankRefusals = (text) => {
  const lines = text.split('\n');
  let start = null;
  const blocks = [];
  for (let i = 0; i <= lines.length; i += 1) {
    if (i === lines.length || /^\s*-\s*(?:id\s*:|{\s*id\s*:)/.test(lines[i])) { if (start !== null) blocks.push([start, i]); start = i; }
  }
  for (const [a, b] of blocks) {
    if (!lines.slice(a, b).some((l) => /^\s*presence\s*:\s*forbidden\b/.test(l))) continue;
    for (let i = a; i < b; i += 1) if (/^\s*path\s*:/.test(lines[i])) lines[i] = lines[i].replace(/:.*/, ':');
  }
  return lines.map((line) => (/^\s*forbids\s*:/.test(line) ? line.replace(/:.*/, ':') : line)).join('\n');
};

/** The live tracked files of `root`: git ls-files, or the filesystem under a tree that is not a Git work tree (a spec fixture). */
export function retiredNameScan(root = DEFAULT_ROOT) {
  const generated = generatedRootsOf(root);
  const scoped = (rel) => !isHistoryPath(rel) && !SELF_FILES.has(rel) && !generated.some((g) => rel.startsWith(g));
  try {
    return gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 256 * 1024 * 1024 }), 'git ls-files').split('\0').filter(Boolean).map((f) => f.replaceAll('\\', '/')).filter((rel) => scoped(rel) && fs.existsSync(path.join(root, rel))).sort();
  } catch {
    return walkFiles(root, { sorted: true, exclude: (name) => name === '.git' || name === 'node_modules' }).map((f) => path.relative(root, f).replaceAll('\\', '/')).filter(scoped);
  }
}

/** The live occurrences of `tokens` under `root`: [{file, line, token, kind, why}]. */
export function checkRetiredNames(root = DEFAULT_ROOT, tokens = retiredNameTokens(root)) {
  const dead = [];
  for (const rel of retiredNameScan(root)) {
    // A file whose own path names a dead naming is a live occurrence.
    for (const t of tokens.filter((tk) => tk.kind === 'retired name' && rel.includes(tk.token))) {
      dead.push({ file: rel, line: 0, token: t.token, kind: t.kind, why: `the path itself names it — ${t.why}` });
    }
    const buffer = fs.readFileSync(path.join(root, rel));
    if (buffer.includes(0)) continue;
    const text = MANIFESTS.has(rel) ? blankRefusals(buffer.toString('utf8')) : buffer.toString('utf8');
    for (const t of tokens) {
      let at = text.indexOf(t.token);
      while (at !== -1) {
        dead.push({ file: rel, line: lineOf(text, at), token: t.token, kind: t.kind, why: t.why });
        at = text.indexOf(t.token, at + t.token.length);
      }
    }
  }
  return { schema: 'starci/retired-names@1', ok: dead.length === 0, filesScanned: retiredNameScan(root).length, dead };
}

/** RT_RETIRED_NAME_LIVE findings of the runtime's live tracked files under `root`. */
export function retiredNameFindings(root = DEFAULT_ROOT) {
  return checkRetiredNames(root).dead.map((d) => ({
    code: RETIRED_NAME_LIVE, level: 'error', path: d.file, line: d.line || undefined,
    message: `${d.file}${d.line ? `:${d.line}` : ''} names ${d.token} (${d.kind}: ${d.why}): a live file names what the registry declares dead`,
  }));
}

export const checkRetiredNamesMain = (argv) => runReportMain(argv, {
  name: 'check-retired-names', help: HELP, root: DEFAULT_ROOT, scan: checkRetiredNames,
  describe: (report) => ({
    okText: `check-retired-names: no retired name in ${report.filesScanned} live tracked files`,
    headline: `check-retired-names: ${report.dead.length} live occurrence(s) of a retired name`,
    rows: report.dead.map((entry) => `  ${entry.file}${entry.line ? `:${entry.line}` : ''}  ${entry.token} — ${entry.kind}: ${entry.why}`),
  }),
});

if (isMain(import.meta.url)) {
  const result = checkRetiredNamesMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
