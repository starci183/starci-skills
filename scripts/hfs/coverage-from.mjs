// starci app check --coverage-from <lcov>: the optional, read-only coverage proof and its declared boundary (R273).
import path from 'node:path';
import { invocationDir } from '../lib/roots.mjs';
import { isMain } from '../lib/is-main.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { loadSlotManifest, readRepoDeclaration } from './slots.mjs';
import { coverageBelowReport } from './rules/coverage-below.mjs';

/** Report for the coordinator's dispatcher; supply its findings as checkRepository's extraFindings. */
export function coverageFrom({ repoRoot = invocationDir(), coverageFrom: reportPath, files, repo, manifest = loadSlotManifest(), lcov } = {}) {
  const declaration = repo ?? readRepoDeclaration(manifest, repoRoot);
  if (!['app', 'be'].includes(declaration.profile)) throw new Error('coverage proof requires an app root or its be side');
  const tracked = files ?? gitOutputOf(lsFiles(['-z', '--cached', '--exclude-standard'], { dir: repoRoot, maxBuffer: 256 * 1024 * 1024 }), 'git ls-files').split('\0').filter(Boolean);
  return coverageBelowReport({ repoRoot, files: tracked, repo: declaration, manifest, coverageFrom: reportPath, lcov });
}

function setValueOption(opts, flag, value) {
  const key = flag === '--cwd' ? 'cwd' : 'coverageFrom';
  if (value === undefined || !value || value.startsWith('--')) throw new Error(`${flag} needs a value`);
  if (Object.hasOwn(opts, key)) throw new Error(`${flag} may be given only once`);
  opts[key] = value;
}

function parse(argv) {
  const opts = {};
  for (let index = 0; index < argv.length; index += 1) {
    const [flag, inline] = argv[index].split(/=(.*)/su);
    if (flag === '--json' && inline === undefined) opts.json = true;
    else if (['--coverage-from', '--cwd'].includes(flag)) {
      const value = inline ?? argv[++index];
      setValueOption(opts, flag, value);
    } else throw new Error(`unknown argument ${argv[index]}`);
  }
  if (!opts.coverageFrom) throw new Error('usage: starci app check --coverage-from <lcov> [--cwd <app>] [--json]');
  return opts;
}

/** Human-readable measured scope, excluded scope and every unmeasured source file; suitable for normal check output. */
export function formatCoverageReport(report) {
  const roles = report.scope?.roles ?? [];
  const rolePattern = roles.length === 1 ? roles[0] : '{' + roles.join(',') + '}';
  const lines = [
    `coverage: ${report.ok ? 'passed' : 'refused'} (${report.measured.length} measured logic files; lines/functions/branches at 100% per file)`,
    'statement coverage is enforced by the unit runner; lcov does not carry statement counts',
    'measured scope:',
    ...(report.scope?.roots ?? []).map((root) => `  ${report.prefix ?? ''}${root}**/*.${rolePattern}.ts`),
    'unmeasured scope:',
    ...report.unmeasuredScopes.map((entry) => `  ${entry}${entry.endsWith('/') ? '**' : ''}`),
    'unmeasured source files:',
    ...(report.unmeasured.length ? report.unmeasured.map((file) => `  ${file}`) : ['  (none)']),
    ...report.findings.map((finding) => `${finding.code} ${finding.path}: ${finding.message}`),
  ];
  return `${lines.join('\n')}\n`;
}

/** Standalone coordinator entry point: exit 0 proof passed, 2 proof or invocation refused. */
export function coverageFromMain(argv, { cwd = invocationDir(), stdout = (text) => process.stdout.write(text), stderr = (text) => process.stderr.write(text), run = coverageFrom } = {}) {
  try {
    const opts = parse(argv);
    const report = run({ repoRoot: path.resolve(cwd, opts.cwd ?? '.'), coverageFrom: opts.coverageFrom });
    stdout(opts.json ? `${JSON.stringify(report, null, 2)}\n` : formatCoverageReport(report));
    return report.ok ? 0 : 2;
  } catch (error) {
    stderr(`starci app check --coverage-from: ${String(error.code ?? error.message).split('\n')[0]}\n`);
    return 2;
  }
}

if (isMain(import.meta.url)) process.exitCode = coverageFromMain(process.argv.slice(2));
