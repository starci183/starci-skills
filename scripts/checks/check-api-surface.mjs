#!/usr/bin/env node
// check-api-surface.mjs — the kernel api verb list has one authority and four
// mirrors. This check proves the mirrors still say what the code implements.
//
//   authority  scripts/kernel/cli.mjs   main()'s `case '<verb>': return ...`
//   mirrors    modules/kernel/api.yaml  top-level keys under `commands:`
//              scripts/kernel/cli.mjs   the verbs usage() prints
//              bin/starci.mjs           the `starci api <verb>` help line
//
// An extension verb (scripts/kernel/api-extensions.mjs) is a file scripts/kernel/verbs/<verb>.mjs: it is
// implemented by that file, its contract is modules/kernel/api-commands/<verb>.yaml (a map), its usage is the
// module's own `usage:` (printed by `api --help`), and the bin help line points at `api --help` for it.
//
// Exit 0 when all four agree, 1 with a per-source diff when they do not,
// 2 on bad arguments or an unreadable source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const HELP = `Usage: node scripts/checks/check-api-surface.mjs [--root <tree>] [--json]

Compares the kernel api verb surface across scripts/kernel/cli.mjs (dispatch
switch + usage text), modules/kernel/api.yaml and bin/starci.mjs.
Exit 0 agrees, 1 reports the diff, 2 is a bad argument or unreadable source.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

class SurfaceInputError extends Error {}

const read = (file) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    throw new SurfaceInputError(`unreadable source: ${file}`);
  }
};

/** The dispatch switch in main() — the verbs the process can actually run. */
export function verbsFromSwitch(source) {
  return [...source.matchAll(/^\s*case '([a-z][a-z0-9-]*)':\s*return\b/gm)].map((m) => m[1]);
}

/** The verb column of the usage() heredoc: two-space indent, then the verb. */
export function verbsFromUsage(source) {
  const start = source.indexOf('const usage = ');
  if (start < 0) throw new SurfaceInputError('cli.mjs has no usage() definition');
  const open = source.indexOf('`', start);
  const close = source.indexOf('`', open + 1);
  if (open < 0 || close < 0) throw new SurfaceInputError('cli.mjs usage() has no template literal');
  return source.slice(open + 1, close).split('\n')
    .map((line) => /^ {2}([a-z][a-z0-9-]*)(?:\s|$)/.exec(line))
    .filter(Boolean).map((m) => m[1]);
}

/** Top-level keys under `commands:` in modules/kernel/api.yaml. */
export function verbsFromContract(source) {
  const doc = parseYaml(source);
  const commands = doc?.commands;
  if (!commands || typeof commands !== 'object') throw new SurfaceInputError('api.yaml has no commands: map');
  return Object.keys(commands);
}

/** The pipe-separated list on the `starci api <verb>` help line. */
export function verbsFromCliHelp(source) {
  const m = /kernel ledger gate:\s*([a-z0-9|-]+)/.exec(source);
  if (!m) throw new SurfaceInputError('bin/starci.mjs has no `kernel ledger gate:` help line');
  return m[1].split('|').filter(Boolean);
}

const filesIn = (dir, rx) => { try { return fs.readdirSync(dir).filter((n) => rx.test(n) && !n.startsWith('_')).sort(); } catch { return []; } };

/** Extension verbs: {verbs, documented, withUsage, badDocs} from scripts/kernel/verbs and modules/kernel/api-commands. */
export function extensionSurface(root = DEFAULT_ROOT) {
  const verbsDir = path.join(root, 'scripts', 'kernel', 'verbs');
  const docsDir = path.join(root, 'modules', 'kernel', 'api-commands');
  const verbs = filesIn(verbsDir, /^[a-z][a-z0-9-]*\.mjs$/).map((n) => n.slice(0, -4));
  const withUsage = verbs.filter((v) => /\busage\s*:/.test(read(path.join(verbsDir, `${v}.mjs`))));
  const documented = [], badDocs = [];
  for (const n of filesIn(docsDir, /^[a-z][a-z0-9-]*\.ya?ml$/)) {
    const verb = n.replace(/\.ya?ml$/, '');
    let doc = null;
    try { doc = parseYaml(read(path.join(docsDir, n))); } catch { doc = null; }
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) documented.push(verb); else badDocs.push(verb);
  }
  return { verbs, documented, withUsage, badDocs };
}

export function collectApiSurface(root = DEFAULT_ROOT) {
  const apiFile = path.join(root, 'scripts', 'kernel', 'cli.mjs');
  const yamlFile = path.join(root, 'modules', 'kernel', 'api.yaml');
  const binFile = path.join(root, 'bin', 'starci.mjs');
  const apiSource = read(apiFile);
  const ext = extensionSurface(root);
  return {
    implemented: [...verbsFromSwitch(apiSource), ...ext.verbs],
    sources: {
      'modules/kernel/api.yaml': [...verbsFromContract(read(yamlFile)), ...ext.documented],
      'scripts/kernel/cli.mjs usage()': [...verbsFromUsage(apiSource), ...ext.withUsage],
      'bin/starci.mjs help': [...verbsFromCliHelp(read(binFile)), ...ext.verbs],
    },
    badDocs: ext.badDocs,
  };
}

const missingFrom = (reference, list) => reference.filter((v) => !list.includes(v));

export function checkApiSurface(root = DEFAULT_ROOT) {
  const { implemented, sources, badDocs = [] } = collectApiSurface(root);
  const report = {
    schema: 'starci/api-surface@1',
    implemented: [...implemented].sort(),
    implementedCount: implemented.length,
    drift: [],
  };
  if (implemented.length === 0) throw new SurfaceInputError('cli.mjs dispatch switch lists no verbs');
  const duplicates = implemented.filter((v, i) => implemented.indexOf(v) !== i);
  if (duplicates.length) report.drift.push({ source: 'scripts/kernel/cli.mjs switch', duplicated: [...new Set(duplicates)] });
  for (const [source, listed] of Object.entries(sources)) {
    const missing = missingFrom(implemented, listed);
    const extra = missingFrom(listed, implemented);
    if (missing.length || extra.length) report.drift.push({ source, missing, extra });
  }
  if (badDocs.length) report.drift.push({ source: 'modules/kernel/api-commands', missing: [], extra: [], unparsable: badDocs });
  report.ok = report.drift.length === 0;
  return report;
}

export function checkApiSurfaceMain(argv) {
  let root = DEFAULT_ROOT;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { exitCode: 0, text: `${HELP}\n` };
    if (key === '--json') { json = true; continue; }
    if (key === '--root') {
      const value = argv[++i];
      if (value === undefined) return { exitCode: 2, text: 'check-api-surface: --root needs a path\n' };
      root = path.resolve(value);
      continue;
    }
    return { exitCode: 2, text: `check-api-surface: unknown argument ${key}\n${HELP}\n` };
  }
  let report;
  try {
    report = checkApiSurface(root);
  } catch (error) {
    if (error instanceof SurfaceInputError) return { exitCode: 2, text: `check-api-surface: ${error.message}\n` };
    throw error;
  }
  if (json) return { exitCode: report.ok ? 0 : 1, text: `${JSON.stringify(report, null, 2)}\n` };
  if (report.ok) return { exitCode: 0, text: `check-api-surface: ${report.implementedCount} verbs, all surfaces agree\n` };
  const lines = [`check-api-surface: verb surface drift (cli.mjs implements ${report.implementedCount}: ${report.implemented.join(' ')})`];
  for (const entry of report.drift) {
    if (entry.duplicated) { lines.push(`  ${entry.source}: duplicated ${entry.duplicated.join(' ')}`); continue; }
    if (entry.unparsable) { lines.push(`  ${entry.source}: not a map ${entry.unparsable.join(' ')}`); continue; }
    if (entry.missing.length) lines.push(`  ${entry.source}: missing ${entry.missing.join(' ')}`);
    if (entry.extra.length) lines.push(`  ${entry.source}: undocumented-in-code ${entry.extra.join(' ')}`);
  }
  return { exitCode: 1, text: `${lines.join('\n')}\n` };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = checkApiSurfaceMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
