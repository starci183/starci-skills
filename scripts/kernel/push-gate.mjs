// settle's push-gate half. A job's scoped lint (check-scoped-lint.mjs) proves its files under the
// runtime's code-pattern profile, but the repository's OWN push gate - the lint its husky pre-push
// hook runs, or its package `lint:check` script (knowledge/repository-baseline.yaml common.hooks /
// scripts) - runs later, over the whole configured glob, and one landed file it rejects blocks every
// push of that repository (nivo-backend 2026-09-24: 63 errors in nine landed files). So a pass whose
// commitPolicy commits also runs that declared lint, with the repository's own ESLint and config,
// over the files the job changed; a red result refuses the settle (push-gate-red) while the job
// keeps its status. Contract: modules/kernel/api.yaml commands.settle; registered as
// settle-push-gate-lint in modules/kernel/contract-changes.yaml (new legs only).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { specBatches } from './settle-landed.mjs';

export const PUSH_GATE_CHANGE = 'settle-push-gate-lint';
const HOOK = '.husky/pre-push';
const FALLBACK_SCRIPT = 'lint:check';
const MAX_FINDINGS = 40;
// ESLint options that take a value; every other --flag is a switch.
const VALUED = new Set(['-c', '--config', '--ext', '--rulesdir', '-f', '--format', '-o', '--output-file', '--cache-location',
  '--cache-strategy', '--resolve-plugins-relative-to', '--parser', '--parser-options', '--plugin', '--rule', '--env',
  '--global', '--ignore-path', '--ignore-pattern', '--max-warnings', '--report-unused-disable-directives-severity',
  '--flag', '--concurrency', '--report-unused-inline-configs']);
// Options the gate drops: a push gate is check-only, and the settle reads ESLint's JSON itself.
const DROPPED = new Set(['--fix', '--fix-dry-run', '--fix-type', '-f', '--format', '-o', '--output-file', '--max-warnings',
  '--cache', '--cache-location', '--cache-strategy', '--quiet', '--color', '--no-color']);

const clean = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '');

/** Shell-ish words of one command: quotes grouped, `&&`/`||`/`;`/`|` split into their own words. */
export function shellWords(line) {
  const words = [];
  let word = null, quote = null;
  const push = () => { if (word !== null) words.push(word); word = null; };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === quote) quote = null; else word += c; continue; }
    if (c === '"' || c === "'") { quote = c; word ??= ''; continue; }
    if (/\s/.test(c)) { push(); continue; }
    if (c === '&' || c === '|' || c === ';') {
      push();
      const two = line.slice(i, i + 2);
      if (two === '&&' || two === '||') { words.push(two); i++; } else words.push(c);
      continue;
    }
    word = (word ?? '') + c;
  }
  push();
  return words;
}

// The commands of a script body or hook file: comments and the shebang dropped, split on && || ; |
// and newlines, each a list of words.
const commandsOf = (text) => String(text ?? '').split(/\r?\n/)
  .map((line) => line.replace(/^\s*#.*$/, ''))
  .flatMap((line) => {
    const out = [[]];
    for (const word of shellWords(line)) {
      if (['&&', '||', ';', '|', '&'].includes(word)) out.push([]);
      else out[out.length - 1].push(word);
    }
    return out;
  })
  .filter((words) => words.length);

// Leading environment assignments and launchers stripped: `npx eslint`, `cross-env A=1 eslint`.
const bare = (words) => {
  let i = 0;
  while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || ['npx', 'cross-env', 'exec', 'env'].includes(words[i])
    || (words[i - 1] === 'npx' && /^--?(no-install|yes|no|y)$/.test(words[i])))) i++;
  return words.slice(i);
};

// The package script a command runs: `npm run x`, `npm run-script x`, `pnpm [run] x`, `yarn [run] x`.
const scriptOf = (words) => {
  const [tool, first, second] = words;
  if (tool === 'npm' && (first === 'run' || first === 'run-script')) return second ?? null;
  if ((tool === 'pnpm' || tool === 'yarn') && first === 'run') return second ?? null;
  if ((tool === 'pnpm' || tool === 'yarn') && first && !first.startsWith('-') && !['install', 'add', 'exec', 'dlx'].includes(first)) return first;
  return null;
};

/** One eslint command's words parsed: {patterns, options (kept), maxWarnings}. Null when not eslint. */
export function parseEslintCommand(words) {
  const argv = bare(words);
  if (!argv.length || !/(^|\/)eslint(\.js)?$/.test(clean(argv[0]))) return null;
  const patterns = [], options = [];
  let maxWarnings = null;
  for (let i = 1; i < argv.length; i++) {
    const word = argv[i];
    if (word === '--') { patterns.push(...argv.slice(i + 1)); break; }
    if (!word.startsWith('-')) { patterns.push(word); continue; }
    const eq = word.indexOf('=');
    const name = eq > 0 ? word.slice(0, eq) : word;
    const value = eq > 0 ? word.slice(eq + 1) : (VALUED.has(name) ? argv[++i] : undefined);
    if (name === '--max-warnings') { const n = Number(value); maxWarnings = Number.isInteger(n) && n >= 0 ? n : null; }
    if (DROPPED.has(name)) continue;
    options.push(...(value === undefined ? [name] : [`${name}=${value}`]));
  }
  return { patterns: patterns.length ? patterns : ['.'], options, maxWarnings };
}

const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

/**
 * The lint a repository declares for its pushes: every eslint command its `.husky/pre-push` runs,
 * directly or through a package script (followed through nested `npm run`), else its `lint:check`
 * script. {source, commands:[{script, command, patterns, options, maxWarnings}]} or null when it
 * declares none.
 */
export function declaredPushGateLint(root) {
  const scripts = readJson(path.join(root, 'package.json'))?.scripts ?? {};
  const commands = [];
  const walk = (text, via, seen) => {
    for (const words of commandsOf(text)) {
      const eslint = parseEslintCommand(words);
      if (eslint) { commands.push({ script: via, command: bare(words).join(' '), ...eslint }); continue; }
      const script = scriptOf(bare(words));
      if (script && typeof scripts[script] === 'string' && !seen.has(script)) walk(scripts[script], script, new Set([...seen, script]));
    }
  };
  let source = null;
  const hook = path.join(root, HOOK);
  if (fs.existsSync(hook)) {
    source = HOOK;
    walk(fs.readFileSync(hook, 'utf8'), null, new Set());
  } else if (typeof scripts[FALLBACK_SCRIPT] === 'string') {
    source = `package.json#scripts.${FALLBACK_SCRIPT}`;
    walk(scripts[FALLBACK_SCRIPT], FALLBACK_SCRIPT, new Set([FALLBACK_SCRIPT]));
  }
  return source && commands.length ? { source, commands } : null;
}

function braceVariants(value) {
  const match = /\{([^{}]+)\}/.exec(value);
  return match ? match[1].split(',').flatMap((part) => braceVariants(`${value.slice(0, match.index)}${part}${value.slice(match.index + match[0].length)}`)) : [value];
}
function globExpression(value) {
  let source = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '*' && value[i + 1] === '*') { i++; if (value[i + 1] === '/') { i++; source += '(?:.*/)?'; } else source += '.*'; }
    else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${source}$`);
}

/** Whether ESLint, given `pattern` on its command line at the repository root, would reach `file`. */
export function patternReaches(pattern, file) {
  const target = clean(file);
  return braceVariants(clean(pattern)).some((variant) => {
    const p = variant.replace(/\/+$/, '');
    if (p === '' || p === '.') return true;
    if (/[*?]/.test(p)) return globExpression(p).test(target);
    return target === p || target.startsWith(`${p}/`);
  });
}

const underSpec = (file, specs) => specs.some((spec) => {
  const s = clean(spec).replace(/\/+$/, '');
  return s === '' || s === '.' || file === s || file.startsWith(`${s}/`);
});

const git = (cwd, args, timeout) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, stdout: r.stdout ?? '', error: (r.stderr ?? '').trim() || String(r.error?.message ?? `exit ${r.status}`) };
};

/**
 * The files a job changed inside one checkout: its report's `files` and every file a commit since
 * its admission touched under its owned pathspecs (the paths are leased to it, so those commits are
 * its own), limited to its owned paths and to files that still exist. Posix, relative to `root`.
 */
export function changedFilesOf({ root, specs, reportFiles = [], sinceMs, timeoutMs }) {
  const files = new Set();
  for (const raw of reportFiles) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
    const rel = clean(path.relative(root, abs));
    if (!rel.startsWith('../') && rel !== '..' && !path.isAbsolute(rel)) files.add(rel);
  }
  if (Number.isFinite(sinceMs)) {
    const since = new Date(sinceMs).toISOString();
    // batched: a Work-debt repair owns hundreds of exact files, past one argv's Windows limit
    for (const batch of specBatches(specs)) {
      const log = git(root, ['log', `--since=${since}`, '--format=', '--name-only', '--diff-filter=d', 'HEAD', '--', ...batch.map((s) => `:(literal)${s}`)], timeoutMs);
      if (log.ok) for (const line of log.stdout.split('\n')) if (line.trim()) files.add(clean(line.trim()));
    }
  }
  return [...files].filter((rel) => underSpec(rel, specs)).filter((rel) => {
    try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; }
  }).sort();
}

// The repository's own ESLint: its package's bin, run by this Node.
function eslintOf(root) {
  const require = createRequire(path.join(root, 'package.json'));
  let manifest;
  try { manifest = require.resolve('eslint/package.json'); } catch {
    const fallback = path.join(root, 'node_modules', 'eslint', 'package.json');
    if (!fs.existsSync(fallback)) return null;
    manifest = fallback;
  }
  const pkg = readJson(manifest);
  const bin = typeof pkg?.bin === 'string' ? pkg.bin : pkg?.bin?.eslint;
  if (!bin) return null;
  return { bin: path.resolve(path.dirname(manifest), bin), major: Number(String(pkg.version ?? '').split('.')[0]) || null, version: pkg.version ?? null };
}

// A file ESLint was handed but its config ignores: not a finding (the repo gate never lints it).
const ignoredNotice = (message) => message?.ruleId == null && message?.fatal !== true && /^File ignored\b/.test(String(message?.message ?? ''));

/**
 * Runs one repository's declared push-gate lint over the files a job changed in it.
 * {checked:false, why} when the repository declares no push-gate lint or the job changed no file it
 * reaches; else {checked:true, ok, reason?, detail}. reason push-gate-red carries the findings;
 * landed-unverifiable (step push-gate) when the repository's ESLint is missing or cannot answer.
 */
export function pushGateProof({ root, specs, reportFiles, sinceMs, timeoutMs, commandMs = 15000 }) {
  const gate = declaredPushGateLint(root);
  if (!gate) return { checked: false, why: 'no-declared-push-gate-lint', repo: root };
  const changed = changedFilesOf({ root, specs, reportFiles, sinceMs, timeoutMs: commandMs });
  const detail = { repo: root, source: gate.source, commands: gate.commands.map((c) => c.command), changed, linted: [], errorCount: 0, warningCount: 0, findings: [] };
  const runs = gate.commands.map((command) => ({ command, files: changed.filter((file) => command.patterns.some((p) => patternReaches(p, file))) }))
    .filter((run) => run.files.length);
  if (!runs.length) return { checked: false, why: 'no-changed-file-in-gate', detail };
  const eslint = eslintOf(root);
  if (!eslint) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { ...detail, step: 'push-gate', error: 'the repository declares a push-gate lint but its own eslint package is not installed' } };
  detail.eslint = eslint.version;
  let overWarnings = false;
  for (const { command, files } of runs) {
    detail.linted.push(...files.filter((file) => !detail.linted.includes(file)));
    let warnings = 0;
    for (const batch of specBatches(files)) {
      const args = [eslint.bin, ...command.options, '--format', 'json', ...(eslint.major >= 9 ? ['--no-warn-ignored'] : []), '--', ...batch];
      const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
      let results = null;
      try { results = JSON.parse(r.stdout); } catch { /* below */ }
      if (r.error || !Array.isArray(results)) {
        const why = r.error ? String(r.error.message ?? r.error) : (String(r.stderr ?? '').trim().split('\n').slice(0, 6).join(' | ') || `exit ${r.status}`);
        return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { ...detail, step: 'push-gate', command: command.command, error: why.slice(0, 600) } };
      }
      for (const result of results) {
        const rel = clean(path.relative(root, result.filePath ?? ''));
        for (const message of result.messages ?? []) {
          if (ignoredNotice(message)) continue;
          const error = message.fatal === true || message.severity === 2;
          if (error) detail.errorCount++; else { detail.warningCount++; warnings++; }
          if (detail.findings.length < MAX_FINDINGS) detail.findings.push({ file: rel, line: message.line ?? null, rule: message.ruleId ?? null, severity: error ? 'error' : 'warning', message: String(message.message ?? '').split('\n')[0].slice(0, 240) });
        }
      }
    }
    if (command.maxWarnings !== null && warnings > command.maxWarnings) { overWarnings = true; detail.maxWarnings = command.maxWarnings; }
  }
  // Errors first. A warning fails the gate only past a --max-warnings cap, as it does ESLint's.
  detail.findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  const ok = detail.errorCount === 0 && !overWarnings;
  return ok ? { checked: true, ok: true, detail } : { checked: true, ok: false, reason: 'push-gate-red', detail };
}
