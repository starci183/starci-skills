#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../core/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {readWorkspace, repoRootFor, loadRecords, indexInlineCriteria, resolveRecordRef} from '../example/example-ownership.mjs';

/**
 * The v6 audits' core complaint about the work tree's trust model: an evidence.yaml pins a
 * recordDigest, a codeDigest and per-assertion exit codes, but nothing in the tooling layer can
 * re-execute a single one of those commands - "stale" and "pass" were verdicts with no replay
 * button, and the only way to know whether `npx jest src/modules/bussiness/audit -t "..."` still
 * does what the evidence claims was to run it by hand and hope the cwd was the obvious one.
 *
 * This is the replay layer. Its default pass (--dry-run, side-effect-free) parses every assertion
 * `command` into an executable spec - {command, cwd} - and reports whether the pieces the command
 * names still exist: the executable on PATH or on disk, the npm script in the resolved
 * repository's package.json, the spec path under the resolved cwd. `--run <id|--all>` actually
 * re-executes through child_process.spawn and compares exit codes against the recorded ones. Both
 * passes are strictly read-only against the tree: a captured `>` redirect is stripped before
 * execution (its stdout is captured into this report instead), because re-running a command
 * verbatim would overwrite the very artifact the evidence cited - re-capture belongs to
 * scripts/example/example-evidence.mjs, never to a check.
 *
 * cwd resolution is the part the audits showed every shortcut gets wrong: one .starciwork tree
 * owns records for every bound repository, so a `npm run build` on a `repository:
 * todo-app-frontend` record is a *frontend* command and dead-or-alive is decided by the
 * frontend's package.json, not the backend's. The resolution order is assertion.cwd ->
 * evidence.cwd -> the record's `repository` (via repoRootFor) -> the backend root; reaching that
 * last step means the evidence carries no hint of where it ran, reported as ASSERTION_NO_CWD
 * (SUSPECT) rather than silently trusted - a verdict computed under a guessed cwd is a heuristic,
 * not a fact.
 *
 * Severity model follows check-work-deep.mjs: REFUSE only when the verdict is deterministic
 * (a dead path under a known cwd, a recorded-pass assertion whose replay fails), SUSPECT when it
 * rests on a guess or an environment (dead under the fallback cwd, a timeout), INFO for the
 * replayable census and replay confirmations.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const isWin = process.platform === 'win32';

const relOf = abs => {
  const rel = path.relative(root, abs);
  if (rel === '') return '.';
  return (rel.startsWith('..') ? abs : rel).replaceAll('\\', '/');
};

// ---------- concept 1: a command string is a plan, not a string ----------

/** Quote-aware tokenizer that also breaks on shell operators (`&&`, `||`, `|`, `>`, `>>`, `;`).
 * Quotes are stripped from the tokens that survive, so `-t "drives sign-in"` yields one token. */
export function tokenize(line) {
  const tokens = [];
  let text = '', quote = null, has = false;
  const push = () => { if (has) tokens.push(text); text = ''; has = false; };
  const pushOp = op => { push(); tokens.push(op); };
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && line[i + 1] === '"') { text += '"'; i += 1; }
      else text += ch;
      has = true;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; has = true; continue; }
    if (/\s/.test(ch)) { push(); continue; }
    if (ch === '&' && line[i + 1] === '&') { pushOp('&&'); i += 1; continue; }
    if (ch === '|') { pushOp(line[i + 1] === '|' ? '||' : '|'); if (line[i + 1] === '|') i += 1; continue; }
    if (ch === ';') { pushOp(';'); continue; }
    if (ch === '>') { pushOp(line[i + 1] === '>' ? '>>' : '>'); if (line[i + 1] === '>') i += 1; continue; }
    text += ch; has = true;
  }
  push();
  return tokens;
}

/** Flags whose next token is never a filesystem path (a name filter, an inline eval payload, a
 * module specifier, a curl/psql option). `--config` is deliberately NOT here - its value is a
 * real path and earns the existence check like any other token. */
const VALUE_FLAGS = new Set([
  '-t', '--testNamePattern', '-e', '--eval', '-p', '--print', '-r', '--require',
  '-w', '--write-out', '-X', '--request', '-H', '--header', '-d', '--data', '-U', '--user',
  '-u', '--maxWorkers', '--grep', '-g', '--record', '--work', '--cwd',
  '--tree', '--run', '--timeout', '--filter', '-o', '--output', '-A', '--user-agent',
]);
const SHELL_EXES = new Set(['bash', 'bash.exe', 'sh', 'sh.exe', 'cmd', 'cmd.exe',
  'powershell', 'powershell.exe', 'pwsh', 'pwsh.exe']);
const TEST_RUNNERS = new Set(['jest', 'vitest', 'mocha', 'ava']);
const PATH_EXT = /\.(ts|tsx|js|mjs|cjs|cts|mts|sh|ps1|bat|cmd|json|ya?ml|md|html|png|txt)$/i;
const ENV_ASSIGN = /^[A-Za-z_][\w]*=/;

const baseName = p => path.basename(p).toLowerCase();
const isAbsPath = t => /^([A-Za-z]:[\\/]|\/|~[\\/])/.test(t);
/** A token that can only mean a filesystem reference: a separator, an absolute path, or a file
 * extension. Bare words like `order-lifecycle` or `custody` are test patterns/subcommands, not paths. */
const isPathish = t => !t.startsWith('-') && !t.includes('://') && !t.startsWith('%')
  && (isAbsPath(t) || /[\\/]/.test(t) || PATH_EXT.test(t));

/**
 * Turns a raw assertion command into an executable plan under `baseCwd`:
 *   - leading KEY=VALUE assignments are peeled into `env` (passed to spawn's env, so they never
 *     force a shell even on Windows where cmd has no env-prefix syntax)
 *   - `>`/`>>` redirects are recorded in `redirects` and REMOVED from what runs - the redirect
 *     target is a captured artifact; replay captures stdout itself rather than re-writing it
 *   - `cd <dir>` steps fold into the cwd of everything after them
 *   - `steps` is the flat list of real simple commands left, each with its resolved argv and cwd
 *   - needsShell is true when pipes or multi-command sequencing remain that no argv can express
 *   - runString re-quotes the surviving tokens for the shell path, so `-t "drives sign-in"`
 *     survives reconstruction as one argument
 */
export function planCommand(raw, baseCwd) {
  const tokens = tokenize(raw);
  const env = {};
  const redirects = [];
  while (tokens.length && ENV_ASSIGN.test(tokens[0])) {
    const [key, ...rest] = tokens.shift().split('=');
    env[key] = rest.join('=');
  }
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (tokens[i] === '>' || tokens[i] === '>>') {
      redirects.unshift({op: tokens[i], target: tokens[i + 1] ?? ''});
      tokens.splice(i, 2);
    }
  }

  const steps = [];
  let cwd = baseCwd;
  let piped = false;
  let step = [];
  const flushStep = () => {
    const stages = [[]];
    for (const t of step) {
      if (t === '|') { piped = true; stages.push([]); } else stages[stages.length - 1].push(t);
    }
    for (const argv of stages) {
      if (!argv.length) continue;
      if (argv[0] === 'cd' && argv[1]) cwd = path.resolve(cwd, argv[1]);
      else steps.push({argv, cwd});
    }
    step = [];
  };
  for (const t of tokens) {
    if (t === '&&' || t === '||' || t === ';') flushStep(); else step.push(t);
  }
  flushStep();

  const requote = t => (/\s/.test(t) ? `"${t.replaceAll('"', '\\"')}"` : t);
  return {raw, env, redirects, steps, needsShell: piped || steps.length > 1, runString: tokens.map(requote).join(' ')};
}

// ---------- concept 2: what the plan's pieces must exist as ----------

const whichCache = new Map();
/** Ambient executable resolution: `where` on Windows, `which` elsewhere; cached per name. Returns
 * the resolved path or null. Host-relative on purpose - replayability is a fact about this host. */
export function which(name) {
  if (whichCache.has(name)) return whichCache.get(name);
  let found = null;
  try {
    const out = execFileSync(isWin ? 'where.exe' : 'which', [name], {stdio: ['ignore', 'pipe', 'ignore']})
      .toString().split(/\r?\n/).filter(Boolean)[0];
    found = out || null;
  } catch { found = null; }
  whichCache.set(name, found);
  return found;
}

const pkgCache = new Map();
const pkgScriptsAt = dir => {
  if (pkgCache.has(dir)) return pkgCache.get(dir);
  const file = path.join(dir, 'package.json');
  let scripts = null;
  if (fs.existsSync(file)) {
    try { scripts = JSON.parse(fs.readFileSync(file, 'utf8'))?.scripts ?? null; } catch { scripts = null; }
  }
  pkgCache.set(dir, scripts);
  return scripts;
};

/** `npx <tool>` resolves the tool from the nearest node_modules/.bin walking up from cwd, then the
 * ambient PATH - the same order npx itself tries before it would fetch (a fetch is a fresh binary,
 * not the pinned tool the evidence ran, so "would download" counts as dead). */
function npxToolAt(tool, cwd) {
  for (let dir = cwd, prev = null; dir !== prev; prev = dir, dir = path.dirname(dir)) {
    const bin = path.join(dir, 'node_modules', '.bin');
    if (fs.existsSync(bin) && fs.readdirSync(bin).some(f => f.replace(/\.(cmd|ps1|bat)$/i, '') === tool)) {
      return bin;
    }
  }
  return which(tool);
}

// ---------- concept 3: probing what a command's tokens point at ----------

const repoFileCache = new Map();
/** Every file under a repo root as normalized relative paths, for jest-style positional patterns
 * (`order-lifecycle`, `buyer.controller.spec`) that are regexes over paths, not literals. */
function repoFiles(repoRoot) {
  if (repoFileCache.has(repoRoot)) return repoFileCache.get(repoRoot);
  const SKIP = new Set(['node_modules', 'dist', '.next', '.git', '.starciwork', 'coverage']);
  const files = [];
  const descend = dir => {
    let entries;
    try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) descend(abs); }
      else files.push(path.relative(repoRoot, abs).replaceAll('\\', '/'));
    }
  };
  descend(repoRoot);
  repoFileCache.set(repoRoot, files);
  return files;
}

/** Whether a test-runner positional pattern names something real: a literal path under cwd, or a
 * substring/basename-prefix match anywhere in the repository (jest's own semantics are regex-over-
 * path; substring on normalized paths is the honest approximation that avoids evaluating regexes). */
function patternHitsRepo(token, cwd, repoRoot) {
  if (fs.existsSync(path.resolve(cwd, token))) return true;
  const probe = token.replaceAll('\\', '/').replace(/\/$/, '');
  return repoFiles(repoRoot).some(f => f === probe || f.endsWith(`/${probe}`) || f.includes(probe)
    || path.basename(f).startsWith(probe));
}

/**
 * Checks one simple command ({argv, cwd}) in `ctx` = {recordRepoRoot, altBases, out},
 * pushing {ok:false, detail} onto out for each dead piece. `altBases` are where a relative path is
 * probed when it misses under cwd - they turn "dead" into "dead under the resolved cwd but present
 * under X", the diagnostic that says the evidence actually ran somewhere else.
 *
 * `altNote` is the shared tail for those findings: where the token DOES resolve.
 */
const altNote = alt => alt ? ` - resolves under ${relOf(alt)} instead, so the recorded cwd was probably there` : '';

function checkSimpleCommand(step, ctx) {
  const {recordRepoRoot, altBases, out} = ctx;
  const argv = [...step.argv];
  const {cwd} = step;
  while (argv.length && ENV_ASSIGN.test(argv[0])) argv.shift(); // `bash -c "KEY=V cmd"` payloads
  if (!argv.length) return;
  const dead = detail => out.push({ok: false, detail});
  const exe = argv[0];
  const exeBase = baseName(exe);

  // -- the executable itself --
  if (isAbsPath(exe) || /[\\/]/.test(exe)) {
    const resolved = isAbsPath(exe) ? exe : path.resolve(cwd, exe);
    if (!fs.existsSync(resolved)) {
      const alt = altBases.find(b => fs.existsSync(path.resolve(b, exe)));
      dead(`executable ${exe} not found under ${relOf(cwd)}${altNote(alt)}`);
      return;
    }
  } else if (/\.(exe|cmd|bat|sh|ps1|mjs|cjs|js)$/i.test(exe)) {
    // a bare name carrying an executable extension may be a cwd-local script (`verify.mjs`) or a
    // PATH binary (`curl.exe`): local file wins, exactly as a shell resolves `./x` before PATH
    if (!fs.existsSync(path.resolve(cwd, exe)) && !which(exe)) {
      dead(`executable ${exe} is neither a file under ${relOf(cwd)} nor on PATH`);
      return;
    }
  } else if (exeBase === 'npm' && argv[1] === 'run' && argv[2]) {
    if (!which('npm')) return dead('npm is not on PATH');
    const scripts = pkgScriptsAt(cwd);
    if (!scripts) return dead(`npm run ${argv[2]} but no package.json under ${relOf(cwd)}`);
    if (!(argv[2] in scripts)) return dead(`npm script "${argv[2]}" does not exist in ${relOf(cwd)}/package.json`);
  } else if (exeBase === 'npm' && argv[1] === 'test') {
    if (!which('npm')) return dead('npm is not on PATH');
    if (!pkgScriptsAt(cwd)?.test) return dead(`npm test but ${relOf(cwd)}/package.json has no test script`);
  } else if (exeBase === 'npx') {
    if (!which('npx')) return dead(`npx is not on PATH`);
    const tool = argv.slice(1).find(t => !t.startsWith('-'));
    if (tool && !npxToolAt(tool, cwd)) {
      return dead(`npx tool "${tool}" is not installed under ${relOf(cwd)} or on PATH`
        + ' - npx would fetch a fresh copy, not the binary the evidence ran');
    }
  } else if (!which(exe)) {
    return dead(`executable ${exe} not found on PATH`);
  }

  // -- argument path checks --
  const npxTool = exeBase === 'npx' ? argv.slice(1).find(t => !t.startsWith('-')) : null;
  const npmScript = exeBase === 'npm' && argv[1] === 'run' ? (pkgScriptsAt(cwd)?.[argv[2]] ?? '') : '';
  const runner = TEST_RUNNERS.has(exeBase) || TEST_RUNNERS.has(npxTool)
    || /\b(jest|vitest|mocha|ava)\b/.test(npmScript);
  // docker exec's tail runs inside the container: nothing past the container name is a host path
  const dockerCap = (exeBase === 'docker' || exeBase === 'docker.exe') && argv[1] === 'exec'
    ? argv.findIndex((t, i) => i > 1 && !t.startsWith('-')) : argv.length;
  const passthrough = argv.indexOf('--'); // args after `--` belong to the wrapped command

  for (let i = 1; i < argv.length && (dockerCap < 0 || i <= dockerCap); i += 1) {
    const prev = argv[i - 1];
    const token = argv[i];
    if ((prev === '-c' || prev === '/c') && SHELL_EXES.has(exeBase)) {
      checkSimpleCommand({argv: tokenize(token), cwd}, ctx); // recurse into `bash -c "..."`
      continue;
    }
    if (VALUE_FLAGS.has(prev) || prev === '-c' || prev === '/c') continue;
    if (!isPathish(token)) continue;
    if (passthrough >= 0 && i > passthrough) {
      if (runner && !patternHitsRepo(token, cwd, recordRepoRoot)) {
        dead(`passthrough pattern "${token}" matches no path or file under ${relOf(recordRepoRoot)}`);
      }
      continue;
    }
    if (fs.existsSync(isAbsPath(token) ? token : path.resolve(cwd, token))) continue;
    if (runner) {
      if (!patternHitsRepo(token, cwd, recordRepoRoot)) {
        dead(`test pattern "${token}" matches no path or file under ${relOf(recordRepoRoot)}`);
      }
      continue;
    }
    const alt = altBases.find(b => fs.existsSync(path.resolve(b, token)));
    dead(`path ${token} not found under ${relOf(cwd)}${altNote(alt)}`);
  }
}

// ---------- concept 4: one assertion -> one executable spec ----------

/** The cwd an assertion's command ran in, per the lane order: assertion.cwd -> evidence.cwd ->
 * the record's `repository` (resolved through workspace.yaml's repositories) -> the backend root.
 * `stamped` is false on that last step: the evidence carries no hint of where it ran, so the
 * resolved cwd is a guess and every verdict derived from it is heuristic. */
export function resolveSpecCwd({assertion, evidence, recordData, workRoot, workspaceDoc}) {
  const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
  const recordRepoRoot = repoRootFor(workRoot, recordData?.repository, workspaceDoc);
  const stamp = raw => {
    if (isAbsPath(raw)) return {cwd: path.normalize(raw)};
    const base = [recordRepoRoot, root, path.dirname(workRoot)].find(b => fs.existsSync(path.resolve(b, raw)));
    return base ? {cwd: path.resolve(base, raw)} : {cwd: null, deadStamp: raw};
  };
  if (typeof assertion?.cwd === 'string' && assertion.cwd.trim()) {
    return {...stamp(assertion.cwd.trim()), via: 'assertion.cwd', recordRepoRoot, stamped: true};
  }
  if (typeof evidence?.cwd === 'string' && evidence.cwd.trim()) {
    return {...stamp(evidence.cwd.trim()), via: 'evidence.cwd', recordRepoRoot, stamped: true};
  }
  if (recordData?.repository && repos.some(r => r?.name === recordData.repository)) {
    return {cwd: recordRepoRoot, via: 'repository', recordRepoRoot, stamped: true};
  }
  return {cwd: path.dirname(workRoot), via: 'fallback', recordRepoRoot, stamped: false};
}

/** Every {evidence file, assertion, spec} triple in a tree, joined to its owning record's data. */
export function collectAssertions(workRoot) {
  const records = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  // Compact format: an evidence `record:` may still name a collapsed criterion's old `ac.*` id or a
  // `parent#frag` form - join it to the record that carries the criterion today.
  const inline = indexInlineCriteria(records);
  const assertions = [];
  for (const file of walk(workRoot).filter(f => f.endsWith('evidence.yaml'))) {
    let ev;
    try { ev = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!ev || typeof ev !== 'object') continue;
    const recordData = records.get(resolveRecordRef(records, ev.record, inline) ?? ev.record)?.data ?? null;
    for (const a of Array.isArray(ev.assertions) ? ev.assertions : []) {
      assertions.push({
        file, dir: path.dirname(file), evidence: ev, recordId: ev.record ?? null, recordData,
        assertion: a ?? {},
        spec: resolveSpecCwd({assertion: a, evidence: ev, recordData, workRoot, workspaceDoc}),
      });
    }
  }
  return {records, workspaceDoc, assertions};
}

/** Dry-run verdict for one assertion: REPLAYABLE when its executable and every path its command
 * names still exist under the resolved cwd, NOT_REPLAYABLE with the dead piece named otherwise. */
export function analyzeAssertion(item) {
  const {assertion, spec, dir} = item;
  if (typeof assertion.command !== 'string' || !assertion.command.trim()) {
    return {verdict: 'NOT_REPLAYABLE', detail: 'no command recorded - nothing to replay'};
  }
  if (spec.deadStamp) {
    return {verdict: 'NOT_REPLAYABLE', detail: `stamped cwd "${spec.deadStamp}" resolves under no known base`};
  }
  const plan = planCommand(assertion.command, spec.cwd);
  if (!plan.steps.length) {
    return {verdict: 'NOT_REPLAYABLE', detail: 'command leaves no executable step after parsing', plan};
  }
  const problems = [];
  const ctx = {recordRepoRoot: spec.recordRepoRoot, altBases: [dir, root], out: problems};
  for (const step of plan.steps) checkSimpleCommand(step, ctx);
  if (problems.length) return {verdict: 'NOT_REPLAYABLE', detail: problems.map(p => p.detail).join('; '), plan};
  return {verdict: 'REPLAYABLE', detail: `cwd ${relOf(spec.cwd)}${spec.via === 'fallback' ? ' (guessed)' : ''}`, plan};
}

// ---------- concept 5: --run executes, capturing only what it captures ----------

const TAIL_BYTES = 4000;

/** Executes one assertion's command. Never throws: spawn errors, non-zero exits and timeouts are
 * outcomes, not crashes. `cmd /c` on Windows when the resolved executable is a .cmd/.bat shim
 * (npm/npx are .cmd files there - CreateProcess cannot exec them directly) or the plan keeps
 * sequencing/pipes only a shell can express; plain argv spawn otherwise. */
export function runAssertion(item, timeoutMs) {
  const {assertion, spec} = item;
  const plan = planCommand(assertion.command, spec.cwd);
  const first = plan.steps[0];
  if (!first) return Promise.resolve({status: 'REPLAY_FAIL', exit: null, tail: 'no executable step'});
  const exe = first.argv[0];
  const bare = !isAbsPath(exe) && !/[\\/]/.test(exe);
  const resolved = bare ? (which(exe) ?? exe) : (isAbsPath(exe) ? exe : path.resolve(first.cwd, exe));
  // anything that does not resolve to a real .exe (npm/npx are .cmd or extensionless shims -
  // `where` reports the extensionless file first, which CreateProcess cannot exec) goes through
  // cmd /c under the BARE name: cmd applies its own PATH+PATHEXT lookup and finds npx.cmd itself
  const cmdShim = isWin && !/\.exe$/i.test(resolved);
  const requote = t => (/\s/.test(t) ? `"${t.replaceAll('"', '\\"')}"` : t);
  const exeWord = bare ? exe : `"${resolved}"`;
  const [file, args] = plan.needsShell
    ? (isWin ? ['cmd.exe', ['/d', '/s', '/c', plan.runString]] : ['/bin/sh', ['-c', plan.runString]])
    : cmdShim ? ['cmd.exe', ['/d', '/s', '/c', [exeWord, ...first.argv.slice(1).map(requote)].join(' ')]]
              : [resolved, first.argv.slice(1)];

  return new Promise(resolve => {
    let child;
    try {
      child = spawn(file, args, {
        cwd: first.cwd, env: {...process.env, ...plan.env}, stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({status: 'REPLAY_FAIL', exit: null, tail: `spawn failed: ${error.message}`});
      return;
    }
    let buf = '';
    const keep = chunk => { buf = (buf + chunk.toString()).slice(-TAIL_BYTES); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* already gone */ } }, 2000).unref();
    }, timeoutMs);
    child.on('error', error => {
      clearTimeout(killTimer);
      resolve({status: 'REPLAY_FAIL', exit: null, tail: `spawn failed: ${error.message}`});
    });
    child.on('close', code => {
      clearTimeout(killTimer);
      if (timedOut) resolve({status: 'REPLAY_TIMEOUT', exit: null, tail: buf.slice(-500)});
      else resolve({status: code === 0 ? 'REPLAY_PASS' : 'REPLAY_FAIL', exit: code, tail: buf.slice(-500)});
    });
  });
}

// ---------- the check ----------

/** Dry-run pass over one tree: resolves every assertion's spec, verdicts it, appends findings to
 * `out` ({refuse, suspect, info} plus the replayability counters). `items` may carry a precomputed
 * collectAssertions() result so --run does not walk the tree twice. */
export function checkTree(workRoot, out, opts = {}) {
  const {assertions} = opts.items ?? collectAssertions(workRoot);
  const picked = opts.record ? assertions.filter(a => a.recordId === opts.record) : assertions;
  const noCwdFiles = new Map(); // evidence file -> affected assertion count

  for (const item of picked) {
    const rel = relOf(item.file);
    const aid = item.assertion.id ?? '(unnamed)';
    if (!item.spec.stamped) noCwdFiles.set(rel, (noCwdFiles.get(rel) ?? 0) + 1);
    const analysis = analyzeAssertion(item);
    item.analysis = analysis;
    if (analysis.verdict === 'REPLAYABLE') {
      out.replayable += 1;
      out.info.push(`${rel}: assertion ${aid} REPLAYABLE - ${analysis.detail}`);
    } else {
      out.dead += 1;
      const line = `${rel}: assertion ${aid} NOT_REPLAYABLE - ${analysis.detail} [NOT_REPLAYABLE]`;
      (item.spec.stamped ? out.refuse : out.suspect).push(line);
    }
  }
  for (const [rel, count] of noCwdFiles) {
    out.suspect.push(`${rel}: ${count} assertion(s) resolve cwd by backend-root fallback - no assertion.cwd,`
      + ' evidence.cwd or record repository stamp, so replayability is judged against a guess [ASSERTION_NO_CWD]');
  }
  return {evidenceFiles: new Set(picked.map(a => a.file)).size, assertions: picked.length};
}

/** Sequential replay - assertion commands share ports, databases and temp dirs, so parallel
 * execution would manufacture failures the evidence never claimed. */
async function replayTree(items, out, timeoutMs) {
  for (const item of items) {
    if (typeof item.assertion.command !== 'string' || !item.assertion.command.trim()) continue;
    const rel = relOf(item.file);
    const aid = item.assertion.id ?? '(unnamed)';
    const result = await runAssertion(item, timeoutMs);
    out.executed += 1;
    const recorded = item.assertion.outcome;
    const tail = result.tail?.trim().split(/\r?\n/).filter(Boolean).pop()?.slice(0, 120);
    if (result.status === 'REPLAY_PASS') {
      out.pass += 1;
      const drift = recorded === 'fail' ? ' - recorded outcome was fail; it passes now (evidence drift)' : '';
      out.info.push(`${rel}: assertion ${aid} REPLAY_PASS (exit 0)${drift}`);
    } else if (result.status === 'REPLAY_TIMEOUT') {
      out.suspect.push(`${rel}: assertion ${aid} exceeded the timeout - killed cleanly;`
        + ' a hang and a slow environment look alike from here [REPLAY_TIMEOUT]');
    } else if (recorded === 'fail') {
      out.info.push(`${rel}: assertion ${aid} still fails as recorded (exit ${result.exit ?? 'none'}) [REPLAY_FAIL]`);
    } else {
      out.fail += 1;
      out.refuse.push(`${rel}: assertion ${aid} replay exited ${result.exit ?? '(none)'}`
        + `${tail ? ` - last output: ${tail}` : ''} [REPLAY_FAIL]`);
    }
  }
}

// ---------- main ----------
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const take = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const treeArg = take('--tree');
  const record = take('--record');
  const runTarget = take('--run');
  const timeoutMs = Math.max(1, Number(take('--timeout') ?? 120)) * 1000;

  if (args.includes('--run') && !runTarget) {
    console.error('REFUSED --run needs a record id or --all');
    process.exit(1);
  }

  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);

  const out = {refuse: [], suspect: [], info: [], replayable: 0, dead: 0, executed: 0, pass: 0, fail: 0};
  for (const workRoot of trees) {
    const {assertions} = collectAssertions(workRoot);
    const counts = checkTree(workRoot, out, {record, items: {assertions}});
    out.info.push(`${relOf(workRoot)}: ${counts.evidenceFiles} evidence file(s),`
      + ` ${counts.assertions} assertion(s) surveyed`);
    if (runTarget) {
      const items = record ? assertions.filter(a => a.recordId === record) : assertions;
      const runItems = runTarget === '--all' ? items : items.filter(a => a.recordId === runTarget);
      if (runTarget !== '--all' && !runItems.length) {
        console.error(`REFUSED --run ${runTarget}: no evidence record by that id under ${relOf(workRoot)}`);
        process.exit(1);
      }
      await replayTree(runItems, out, timeoutMs);
    }
  }

  for (const l of out.refuse) console.log(`REFUSE  ${l}`);
  for (const l of out.suspect) console.log(`SUSPECT ${l}`);
  for (const l of out.info) console.log(`INFO    ${l}`);
  console.log(`\n${out.replayable} replayable, ${out.dead} dead,`
    + ` ${out.executed} executed (${out.pass} pass / ${out.fail} fail)`);
  console.log(`${out.refuse.length} refused, ${out.suspect.length} suspect, ${out.info.length} info`);
  process.exitCode = out.refuse.length ? 1 : 0;
}
