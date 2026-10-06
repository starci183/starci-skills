#!/usr/bin/env node
// CLI_ONLY_ENTRY (R201): tracked actions enter runtime code through
// `starci <group> <verb>`, never by executing a handler or internal entry.
// Generated package-lock.json files are exempt because pinned dependencies can name retired bins.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lsFiles } from '../api/git/ls-files.mjs';
import { loadCatalog } from '../cli/catalog.mjs';
import { isMain } from '../lib/is-main.mjs';
import { lineTextAt, readTrackedTextFiles, runTrackedTextCheckCli, sentenceRanges, sentenceTextAt, sentencesOf } from '../lib/tracked-text-scan.mjs';
import { codexGuardBlock, toolGuardCommand } from '../agent/trust.mjs';
import { historyHookBody, workHookCheck } from '../guards/hook-install.mjs';
import { taskScript as reconcilerTaskScript } from '../reconciler/boot.mjs';
import { tunnelTaskScript } from '../reconciler/tunnel-task.mjs';
import { escapeRegExp } from '../lib/regex.mjs';
import { loadCommandPolicy } from '../guards/command-policy.mjs';

import { loadInternalRegistry } from './check-cli-parity.mjs';
import { rawCommandFindingsInText, rawUseCounts } from './lib/raw-command-scan.mjs';

export const CODE = 'CLI_ONLY_ENTRY';
export const EXEMPTIONS = Object.freeze({
  dispatcher: Object.freeze(['packages/cli/src/**', 'scripts/cli/main.mjs']),
  testSpawnHelpers: Object.freeze(['tests/**/*.spec.mjs', 'tests/helpers/**']),
  catalogDeclarations: Object.freeze(['modules/cli/commands/_internal.yaml']),
  history: Object.freeze(['CHANGELOG*.md']),
  generatedRuntimeCopies: 'packages/*/runtime/**',
  generatedLockfiles: '**/package-lock.json',
  variableScriptPaths: 'node spawns whose script path is held only in a variable',
  retirementSentences: 'sentences saying an invocation was removed, retired, or replaced',
});

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RETIREMENT_WORD = /\b(?:removed|retired|replaced)\b/i;
const GENERATED_LOCKFILE = /(?:^|\/)package-lock\.json$/;
const HELP = `Usage: check-cli-only-entry [--root <tree>] [--json]

${CODE}: actions invoke runtime entries only through starci <group> <verb>.
Exit 0 is clean, 1 reports findings, and 2 is bad usage or unreadable input.`;

class CliOnlyEntryInputError extends Error {}

const posix = (file) => String(file).replaceAll('\\', '/');
const slashPattern = (value) => posix(value).split('/').map(escapeRegExp).join(String.raw`[\\/]`);
const lineAt = (text, at) => text.slice(0, at).split('\n').length;

const fullyExempt = (file) => file.startsWith('packages/cli/src/')
  || file === 'scripts/cli/main.mjs'
  || file === 'modules/cli/commands/_internal.yaml'
  || /(?:^|\/)CHANGELOG[^/]*\.md$/i.test(file)
  || /^packages\/.+\/runtime\//.test(file)
  || GENERATED_LOCKFILE.test(file);

const isTestSpawnHelper = (text, file, at) => {
  if (!/^tests\/(?:.*\.spec\.mjs|helpers\/)/.test(file)) return false;
  const start = Math.max(text.lastIndexOf('\n', at - 1), text.lastIndexOf(';', at - 1)) + 1;
  const endLine = text.indexOf('\n', at);
  const endSemi = text.indexOf(';', at);
  const ends = [endLine, endSemi].filter((value) => value >= 0);
  const end = ends.length ? Math.min(...ends) : text.length;
  return /\b(?:spawn|spawnSync|exec|execFile|execFileSync|execSync|fork)\s*\(/.test(text.slice(start, end));
};

/** Catalog routes keyed by their actual implementation script. */
function entryRoutes(catalog) {
  const routes = new Map();
  const add = (script, route) => {
    const list = routes.get(script) ?? [];
    if (!list.some((item) => item.use === route.use && JSON.stringify(item.args) === JSON.stringify(route.args))) list.push(route);
    routes.set(script, list);
  };
  for (const group of catalog.groups ?? []) for (const verb of group.verbs ?? []) {
    const script = verb.impl?.script ? posix(verb.impl.script) : null;
    const use = `starci ${group.group} ${verb.verb}`;
    if (script) add(script, { use, args: verb.impl.args ?? [] });
  }
  return routes;
}

const routeFor = (routes, script, rest) => {
  const choices = routes.get(script) ?? [];
  if (choices.length <= 1) return choices[0]?.use ?? null;
  const tokens = [...String(rest).matchAll(/(?:"([^"]*)"|'([^']*)'|([^\s;&|)]+))/g)].map((match) => match[1] ?? match[2] ?? match[3]);
  const exact = choices.find((choice) => choice.args.every((arg, index) => tokens[index] === arg));
  return exact?.use ?? null;
};

const nodeMatcher = (scripts) => {
  const body = [...scripts].sort((a, b) => b.length - a.length || a.localeCompare(b)).map(slashPattern).join('|');
  if (!body) return null;
  const variable = String.raw`(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?[\\/]|%[A-Za-z_][A-Za-z0-9_]*%[\\/])?`;
  return new RegExp(String.raw`(?<![\w.-])["']?node(?:\.exe)?["']?[ \t]+["']?${variable}(?:\.claude[\\/])?(?<script>${body})["']?`, 'gi');
};

/** Direct node and npm-run calls in one file. Pure; context is built once per scan. */
function cliOnlyCallsInText(text, file, context) {
  const rel = posix(file);
  if (fullyExempt(rel)) return [];
  const source = String(text);
  const ranges = sentenceRanges(source, sentencesOf(source));
  const findings = [];
  const add = (candidate) => {
    if (!rel.startsWith('modules/cli/commands/') && RETIREMENT_WORD.test(sentenceTextAt(ranges, candidate.at, source))) return;
    if (isTestSpawnHelper(source, rel, candidate.at)) return;
    const finding = {
      code: CODE,
      file: rel,
      line: lineAt(source, candidate.at),
      kind: candidate.kind,
      spelling: candidate.spelling.replace(/[ \t]+/g, ' ').trim(),
      script: candidate.script,
      use: candidate.use,
      internal: candidate.internal,
      text: lineTextAt(source, candidate.at),
    };
    findings.push(finding);
  };

  const matcher = context.nodeMatcher;
  if (matcher) {
    matcher.lastIndex = 0;
    for (const match of source.matchAll(matcher)) {
      const script = posix(match.groups.script);
      const end = source.indexOf('\n', match.index);
      const rest = source.slice(match.index + match[0].length, end < 0 ? source.length : end);
      const use = routeFor(context.routes, script, rest);
      const internal = context.internal.has(script);
      if (!use && !internal) continue;
      add({ at: match.index, kind: 'node', spelling: match[0], script, use, internal });
    }
  }

  const npm = /(?<![\w.-])npm[ \t]+run(?:-script)?[ \t]+([A-Za-z0-9:_-]+)/g;
  for (const match of source.matchAll(npm)) {
    const wrapped = context.packageScripts.get(match[1]);
    if (!wrapped) continue;
    add({ at: match.index, kind: 'npm-run', spelling: match[0], script: wrapped.script, use: wrapped.use, internal: wrapped.internal });
  }
  return findings;
}

const readValue = (root, file, read) => read ? read(file) : fs.readFileSync(path.join(root, ...file.split('/')));

const packageScriptMap = (root, files, read, baseContext) => {
  const out = new Map();
  for (const file of files.filter((name) => /(?:^|\/)package\.json$/.test(name))) {
    let doc;
    try { doc = JSON.parse(String(readValue(root, file, read))); } catch { continue; }
    for (const [name, command] of Object.entries(doc.scripts ?? {})) {
      if (typeof command !== 'string') continue;
      const context = { ...baseContext, packageScripts: new Map() };
      const call = cliOnlyCallsInText(command, file, context).find((finding) => finding.kind === 'node');
      if (call && !out.has(name)) out.set(name, call);
    }
  }
  return out;
};

/** Render command builders through deterministic seams so generated hooks/tasks are scanned too. */
export function generatedEntrySources() {
  return [
    { file: 'scripts/guards/hook-install.mjs', text: historyHookBody({ branches: [], root: '.', nodePath: 'node', terminals: '.starci/guards/terminals' }) },
    { file: 'scripts/guards/hook-install.mjs', text: workHookCheck({ root: '.', nodePath: 'node' }) },
    { file: 'scripts/reconciler/boot.mjs', text: reconcilerTaskScript({ starci: 'starci', workdir: '.', every: 5 }) },
    { file: 'scripts/reconciler/tunnel-task.mjs', text: tunnelTaskScript({ task: 'StarCi Harness Tunnel', starci: 'starci', workdir: '.' }) },
    { file: 'scripts/agent/trust.mjs', text: toolGuardCommand() },
    { file: 'scripts/agent/trust.mjs', text: codexGuardBlock(toolGuardCommand()) },
  ];
}

/** Scan every tracked text file and the rendered command builders. */
export function scanCliOnlyEntry(root = DEFAULT_ROOT, { files = null, read = null, catalog = null, internal = null, generated = null, policy = undefined } = {}) {
  let parsedCatalog;
  let parsedInternal;
  try {
    parsedCatalog = catalog ?? loadCatalog(root);
    parsedInternal = internal ?? loadInternalRegistry(root);
  } catch (error) { throw new CliOnlyEntryInputError(error.message); }
  let tracked;
  try { tracked = files ?? readTrackedTextFiles(root, { listFiles: lsFiles }); } catch (error) { throw new CliOnlyEntryInputError(error.message); }
  const routes = entryRoutes(parsedCatalog);
  const internalPaths = new Set(parsedInternal.map((item) => posix(item.path)));
  const scripts = new Set([...routes.keys(), ...internalPaths]);
  const baseContext = {
    routes,
    internal: internalPaths,
    nodeMatcher: nodeMatcher(scripts),
  };
  const context = { ...baseContext, packageScripts: packageScriptMap(root, tracked, read, baseContext) };
  const commandPolicy = policy === undefined ? loadCommandPolicy({ root }) : policy;
  const findings = [];
  let checked = 0;
  for (const raw of tracked) {
    const file = posix(raw);
    if (fullyExempt(file)) continue;
    let value;
    try { value = readValue(root, file, read); } catch { continue; }
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    if (bytes.includes(0)) continue;
    checked += 1;
    const text = bytes.toString('utf8');
    findings.push(...cliOnlyCallsInText(text, file, context), ...rawCommandFindingsInText(text, file, { policy: commandPolicy, cwd: root }));
  }
  for (const source of generated ?? generatedEntrySources()) findings.push(...cliOnlyCallsInText(source.text, source.file, context));
  const unique = [...new Map(findings.map((finding) => [`${finding.file}\0${finding.line}\0${finding.kind}\0${finding.spelling}`, finding])).values()];
  unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.spelling.localeCompare(b.spelling));
  return {
    schema: 'starci/cli-only-entry-check@1',
    ok: unique.length === 0,
    code: unique.length ? CODE : null,
    files: checked,
    rawUseCounts: rawUseCounts(unique),
    findings: unique,
  };
}

/** CLI entry point; io and the scan are injectable for the spec. */
export function main(argv = [], io = process, deps = {}) {
  return runTrackedTextCheckCli(argv, io, {
    command: 'check-cli-only-entry',
    help: HELP,
    defaultRoot: DEFAULT_ROOT,
    scan: deps.scan ?? scanCliOnlyEntry,
    cleanText: (report) => `check-cli-only-entry: no direct entry calls or raw side-effecting guidance in ${report.files} tracked text file(s)`,
    findingText: (finding) => {
      if (finding.kind === 'raw-guidance') return `  ${finding.file}:${finding.line} raw ${finding.program}${finding.sub ? ' ' + finding.sub : ''} in guidance: use ${finding.use}`;
      const replacement = finding.use
        ? `use "${finding.use}"`
        : 'internal script: not invokable; use "starci <group> <verb>" of its owner';
      return `  ${finding.file}:${finding.line} ${CODE}: "${finding.spelling}" is a direct entry invocation; ${replacement}`;
    },
    redText: (report) => {
      const counts = Object.entries(report.rawUseCounts ?? {});
      const lines = counts.map(([use, count]) => `  ${count} ${use}`).join('\n');
      const summary = counts.length ? `\nraw guidance by use:\n${lines}` : '';
      return `check-cli-only-entry: red (${report.findings.length} finding(s))${summary}`;
    },
  });
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
