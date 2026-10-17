// gate.mjs - `starci app release gate`: the honest release gate. It runs the app's own gates on a clean HEAD and ONLY when every one is green it
// writes the L4 record <git-common-dir>/starci-release/<HEAD sha>.l4.json (head, tag, per-gate log path and sha256) and creates the annotated tag.
// The canon pre-push hook lets main and v* tags through only for a HEAD with that tag and that record. Nothing is pushed here (see push.mjs).
// The gate list comes from the optional `release:` block of .starcistacks/application-stacks.yaml, else from the app's managed package scripts.
// Commands are argument arrays (never shell strings) run through ctx.spawn; a git tool call always goes through the same seam.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isPlainObject as plain } from '../runtime/engine/plain-object.mjs';
import { qualityServices } from '../runtime/scripts/hfs/ci-declaration.mjs';
import { firstLine, lines, tool } from '../stack/context.mjs';
import { failure, refusal } from '../stack/errors.mjs';
import { latestDefaultBranchCi, requireGreenCi } from './ci-red.mjs';

export const RELEASE_CODE = 'RELEASE_CONFIG_INVALID';

const FIELDS = new Set(['gates', 'tagPrefix', 'defaultBranch', 'tagMatchesVersion']);
const GATE_FIELDS = new Set(['name', 'command', 'summary', 'env']);
const GATE_NAME = /^[a-z][a-z0-9-]*$/u;
const TOKEN = /^[A-Za-z0-9_@%+=:,./\\-]+$/u;
const ENV_KEY = /^[A-Z][A-Z0-9_]*$/u;
const REF_NAME = /^[A-Za-z0-9._/][A-Za-z0-9._/-]*$/u;
const PREFIX = /^[A-Za-z][A-Za-z0-9._-]{0,19}$/u;
export const VERSION = /^(\d+)\.(\d+)\.(\d+)$/u;
const THRESHOLD_MISS = /coverage threshold .* not met/gu;
const WRAPPED = new Set(['npm', 'npx']);
const SCRIPT_GATES = ['typecheck', 'build:be', 'lint', 'build:fe', 'test'];
const MAX_PATCH = 100;

/** True for a branch or remote name git can take as one argument (no leading dash, only path-like characters). */
export const refName = (value) => typeof value === 'string' && REF_NAME.test(value);

const scriptGate = (script) => ({
  name: script.replaceAll(':', '-'),
  command: ['npm', 'run', script],
  summary: script === 'test' ? 'jest' : null,
  env: {},
});

/** Default gates run app-check, the enabled audit, then every managed script present in the app. */
function defaultGates(scripts, audit) {
  const present = SCRIPT_GATES.filter((script) => typeof scripts?.[script] === 'string');
  return [{ name: 'app-check', command: ['npx', 'starci', 'app', 'check'], summary: null, env: {} }, ...(audit ? [audit] : []), ...present.map(scriptGate)];
}

/** Shared quality settings retain the release reader's audit validation, disabled mode and legacy string host compatibility. */
function releaseServices(services, options) {
  const audit = services?.audit ?? {};
  if (!plain(audit) || (audit.in !== undefined && (!Array.isArray(audit.in) || !audit.in.every((scope) => typeof scope === 'string'))) || (audit.omitDev !== undefined && typeof audit.omitDev !== 'boolean')) throw refusal(RELEASE_CODE, 'services.audit must be a mapping with a string-list in and boolean omitDev');
  const sonar = services?.sonar;
  const compatible = typeof sonar?.host === 'string' ? { ...sonar, host: { public: sonar.host } } : sonar;
  const quality = qualityServices({ services: { ...services, sonar: compatible } }, options);
  if (audit.mode === 'disabled') quality.audit = null;
  return quality;
}

/** The shared audit settings preserve release scope, level and development-dependency selection. */
function auditGate(audit) {
  if (!audit || !audit.in.includes('release-gate')) return null;
  if (!['info', 'low', 'moderate', 'high', 'critical'].includes(audit.level)) throw refusal(RELEASE_CODE, 'services.audit.level must be an npm audit level');
  return { name: 'audit', command: ['npm', 'audit', ...(audit.omitDev ? ['--omit=dev'] : []), `--audit-level=${audit.level}`], summary: null, env: {} };
}

/** A requested local Sonar scan uses only the declared host and token variable; the token never enters argv. */
function sonarGate(services, env) {
  const sonar = services?.sonar;
  const tokenName = sonar?.token;
  if (!sonar?.host || !ENV_KEY.test(tokenName) || !env[tokenName]) throw refusal('RELEASE_SONAR_UNAVAILABLE', 'declare an enabled services.sonar host and set its ci.token environment variable');
  const command = ['npx', '--yes', '@sonar/scan@4.3.0', `-Dsonar.host.url=${sonar.host}`];
  const organization = sonar.organization ?? (sonar.organizationVar ? env[sonar.organizationVar] : null);
  if (organization) command.push(`-Dsonar.organization=${organization}`);
  if (!command.every((word) => TOKEN.test(word))) throw refusal('RELEASE_SONAR_UNAVAILABLE', 'Sonar host and organization must be plain command arguments');
  return { name: 'sonar', command, summary: null, env: { SONAR_TOKEN: env[tokenName] } };
}

function gateProblems(entry, at, seen) {
  const found = [];
  for (const key of Object.keys(entry)) if (!GATE_FIELDS.has(key)) found.push(`${at}.${key}: is not a field of a gate`);
  if (typeof entry.name !== 'string' || !GATE_NAME.test(entry.name)) found.push(`${at}.name: must match ${GATE_NAME}`);
  else if (seen.has(entry.name)) found.push(`${at}.name: ${entry.name} is declared twice`);
  const command = entry.command;
  if (!Array.isArray(command) || command.length === 0 || !command.every((word) => typeof word === 'string' && TOKEN.test(word))) found.push(`${at}.command: must be a non-empty list of plain words (no shell strings)`);
  if (entry.summary !== undefined && entry.summary !== 'jest') found.push(`${at}.summary: must be jest`);
  const env = entry.env ?? {};
  if (!plain(env) || !Object.entries(env).every(([key, value]) => ENV_KEY.test(key) && typeof value === 'string')) found.push(`${at}.env: must map UPPER_CASE names to string values`);
  return found;
}

function gatesOf(list, problems) {
  if (!Array.isArray(list) || list.length === 0) {
    problems.push('release.gates: must be a non-empty list');
    return [];
  }
  const seen = new Set();
  const gates = [];
  list.forEach((entry, index) => {
    const at = `release.gates[${index}]`;
    const found = plain(entry) ? gateProblems(entry, at, seen) : [`${at}: must be a mapping`];
    problems.push(...found);
    if (found.length === 0) {
      seen.add(entry.name);
      gates.push({ name: entry.name, command: entry.command, summary: entry.summary ?? null, env: entry.env ?? {} });
    }
  });
  return gates;
}

/** Judges the optional `release:` block. Absence is fine (defaults). Returns { config } or { problems }. */
export function normalizeRelease(block, scripts = {}, services = {}, options = {}) {
  const raw = block ?? {};
  if (!plain(raw)) return { problems: ['release: must be a mapping'] };
  const problems = Object.keys(raw).filter((key) => !FIELDS.has(key)).map((key) => `release.${key}: is not a field of the release block`);
  const tagPrefix = raw.tagPrefix ?? 'v';
  const defaultBranch = raw.defaultBranch ?? 'main';
  const tagMatchesVersion = raw.tagMatchesVersion ?? false;
  if (typeof tagPrefix !== 'string' || !PREFIX.test(tagPrefix)) problems.push(`release.tagPrefix: must match ${PREFIX}`);
  if (!refName(defaultBranch)) problems.push(`release.defaultBranch: must match ${REF_NAME}`);
  if (typeof tagMatchesVersion !== 'boolean') problems.push('release.tagMatchesVersion: must be true or false');
  const quality = releaseServices(services, options);
  const audit = auditGate(quality.audit);
  const gates = raw.gates === undefined ? defaultGates(scripts, audit) : gatesOf(raw.gates, problems);
  if (raw.gates !== undefined && audit && !gates.some((gate) => gate.name === 'audit')) gates.push(audit);
  return problems.length === 0 ? { config: { gates, tagPrefix, defaultBranch, tagMatchesVersion, services: quality } } : { problems };
}

/* ---- git through the seam */

/** Runs git in the app root; a missing git or (unless allowFail) a non-zero exit is a failure whose message names the first stderr line. */
export function git(ctx, args, { allowFail = false } = {}) {
  const run = tool(ctx, 'git', args, { cwd: ctx.cwd });
  if (run.error) throw failure('RELEASE_GIT_MISSING', `cannot run git (${run.error.message})`);
  if (run.status !== 0 && !allowFail) throw failure('RELEASE_GIT_FAILED', `git ${args.slice(0, 2).join(' ')}: ${firstLine(run.stderr)}`);
  return { code: run.status, stdout: String(run.stdout ?? '').trim(), stderr: String(run.stderr ?? '') };
}

/** The directory that holds the L4 records: <git common dir>/starci-release. */
export const releaseDir = (ctx) => path.join(path.resolve(ctx.cwd, git(ctx, ['rev-parse', '--git-common-dir']).stdout), 'starci-release');

/** Annotated tags `<prefix><digit>*` that point at HEAD (lightweight tags do not count: the hook ignores them). */
export function annotatedOnHead(ctx, prefix) {
  const names = lines(git(ctx, ['tag', '--points-at', 'HEAD', '--list', `${prefix}[0-9]*`]).stdout);
  return names.filter((name) => git(ctx, ['cat-file', '-t', `refs/tags/${name}`], { allowFail: true }).stdout === 'tag');
}

const dirtyPaths = (ctx) => lines(git(ctx, ['status', '--porcelain', '--untracked-files=normal']).stdout);

/** Tag names that exist locally or on the remote. */
function takenTags(ctx, prefix, remote) {
  const local = lines(git(ctx, ['tag', '--list', `${prefix}*`]).stdout);
  const listed = lines(git(ctx, ['ls-remote', '--tags', remote], { allowFail: true }).stdout);
  const remoteNames = listed.map((line) => line.split('refs/tags/')[1]?.replace(/\^\{\}$/u, '')).filter(Boolean);
  return new Set([...local, ...remoteNames]);
}

/** Next free `<prefix><major>.<minor>.<n>` for the package version. */
function nextFree(prefix, version, taken) {
  const [, major, minor] = VERSION.exec(version);
  for (let patch = 0; patch < MAX_PATCH; patch += 1) {
    const candidate = `${prefix}${major}.${minor}.${patch}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw refusal('RELEASE_NO_FREE_TAG', `no free tag ${prefix}${major}.${minor}.0 to ${prefix}${major}.${minor}.${MAX_PATCH - 1}`);
}

/** The tag this release uses and its state: on-head (reused), free (will be created) or taken (exists on another commit). */
function chooseTag(ctx, config, { prefix, remote }) {
  const onHead = annotatedOnHead(ctx, prefix);
  const taken = takenTags(ctx, prefix, remote);
  const exact = `${prefix}${config.version}`;
  const tag = config.tagMatchesVersion ? exact : (onHead[0] ?? nextFree(prefix, config.version, taken));
  if (onHead.includes(tag)) return { tag, state: 'on-head' };
  return { tag, state: taken.has(tag) ? 'taken' : 'free' };
}

/* ---- gate results */

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const lineAfter = (text, label) => {
  const found = text.split('\n').find((line) => line.startsWith(label));
  return found === undefined ? null : found.slice(label.length).trim();
};

/** The jest summary lines of a log: { suites, failedSuites, tests, failed, passed } or null when jest printed none. */
function jestSummary(text) {
  const suites = lineAfter(text, 'Test Suites:');
  const tests = lineAfter(text, 'Tests:');
  if (suites === null || tests === null) return null;
  const count = (line, word) => Number(new RegExp(String.raw`(\d+) ${word}`, 'u').exec(line)?.[1] ?? 0);
  return {
    suites: count(suites, 'total'), failedSuites: count(suites, 'failed'),
    tests: count(tests, 'total'), failed: count(tests, 'failed'), passed: count(tests, 'passed'),
  };
}

/** Judges a jest-style gate from its log: green needs suites that all passed, every test passed and no coverage threshold miss. */
function judgeJest(text) {
  const summary = jestSummary(text);
  const misses = (text.match(THRESHOLD_MISS) ?? []).length;
  if (!summary) return { pass: false, detail: 'no jest summary in the log', summary: null, misses };
  const pass = summary.suites > 0 && summary.failedSuites === 0 && summary.failed === 0 && summary.passed === summary.tests && misses === 0;
  const detail = `suites ${summary.suites - summary.failedSuites}/${summary.suites}, tests ${summary.passed}/${summary.tests}, coverage-threshold misses ${misses}`;
  return { pass, detail, summary, misses };
}

/** [command, args] to start an argv; on Windows npm and npx are .cmd files, so they start through cmd.exe (words are validated, never a shell string). */
export function launch(argv, platform) {
  if (platform === 'win32' && WRAPPED.has(argv[0])) return ['cmd.exe', ['/d', '/s', '/c', ...argv]];
  return [argv[0], argv.slice(1)];
}

function runGate(ctx, gate, { dir, platform }) {
  const log = path.join(dir, `${gate.name}.log`);
  const started = ctx.now();
  const [command, args] = launch(gate.command, platform);
  const run = tool(ctx, command, args, { cwd: ctx.cwd, env: { ...ctx.env, ...gate.env } });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  const text = gate.name === 'sonar' && gate.env.SONAR_TOKEN ? output.replaceAll(gate.env.SONAR_TOKEN, '[REDACTED]') : output;
  fs.writeFileSync(log, text);
  const verdict = judgeVerdict(run, gate, text);
  if (gate.name === 'sonar' && gate.env.SONAR_TOKEN) verdict.detail = verdict.detail.replaceAll(gate.env.SONAR_TOKEN, '[REDACTED]');
  const seconds = Math.round((ctx.now() - started) / 1000);
  return {
    name: gate.name, command: gate.command.join(' '), pass: verdict.pass, detail: verdict.detail, seconds,
    summary: verdict.summary ?? null, log: path.resolve(log), logSha256: sha256(log), env: Object.keys(gate.env),
  };
}

function judgeVerdict(run, gate, text) {
  if (run.error) return { pass: false, detail: `cannot run (${run.error.message})` };
  if (run.status !== 0) return { pass: false, detail: `exit ${run.status}` };
  if (gate.summary === 'jest') return judgeJest(text);
  return { pass: true, detail: 'exit 0' };
}

/* ---- the gate */

function sourceProblem(ctx, source, head) {
  if (source === 'HEAD') return null;
  if (!refName(source)) return `--source ${source} is not a ref name`;
  const resolved = git(ctx, ['rev-parse', '--verify', `${source}^{commit}`], { allowFail: true });
  if (resolved.code !== 0) return `cannot resolve --source ${source}`;
  if (resolved.stdout !== head) return `--source ${source} is ${resolved.stdout.slice(0, 10)} but HEAD is ${head.slice(0, 10)}: the hook and the L4 record are about HEAD; check the candidate out first`;
  return null;
}

function tagLine({ tag, state }) {
  if (state === 'on-head') return `tag            ${tag} (annotated, already on HEAD)`;
  if (state === 'taken') return `tag            ${tag} (TAKEN by another commit)`;
  return `tag            ${tag} (free: will be created, annotated)`;
}

/** Everything that can be known without running a gate: the facts, the red preconditions and the lines that describe them. */
function inspect(ctx, config, options) {
  const head = git(ctx, ['rev-parse', 'HEAD']).stdout;
  const branch = git(ctx, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }).stdout;
  const out = [`checkout       ${ctx.cwd}`, `HEAD           ${head} (${branch})`];
  const red = [];
  const problem = sourceProblem(ctx, options.source ?? 'HEAD', head);
  if (problem) red.push(problem);
  const dirty = dirtyPaths(ctx);
  if (dirty.length > 0) red.push(`working tree is not clean (${dirty.length} path(s), first: ${dirty[0].slice(0, 100)}): the record would vouch for files that are not in HEAD`);
  else out.push('worktree       clean');
  const prefix = options.tagPrefix ?? config.tagPrefix;
  if (!PREFIX.test(prefix)) throw refusal('RELEASE_USAGE', `--tag-prefix must match ${PREFIX}`);
  const chosen = chooseTag(ctx, config, { prefix, remote: 'origin' });
  if (chosen.state === 'taken') red.push(`tag ${chosen.tag} already exists on another commit (local or remote)`);
  out.push(tagLine(chosen));
  return { head, chosen, red, out };
}

function planLines(config, facts, dir, recordPath) {
  const out = [`L4 record      ${recordPath}`, `logs           ${dir}`, '', 'gates (all must pass, in this order):'];
  for (const gate of config.gates) {
    const summary = gate.summary ? ` (summary: ${gate.summary})` : '';
    out.push(`  ${gate.name.padEnd(17)} ${gate.command.join(' ')}${summary}`);
  }
  out.push(`then: write ${path.basename(recordPath)} and \`git tag -a ${facts.chosen.tag}\` on ${facts.head.slice(0, 10)}; push it with \`starci app release push\`.`);
  return out;
}

function assertUnmoved(ctx, head) {
  const now = git(ctx, ['rev-parse', 'HEAD']).stdout;
  if (now !== head) throw failure('RELEASE_HEAD_MOVED', `HEAD moved during the gates (${head.slice(0, 10)} -> ${now.slice(0, 10)}). No record.`);
  const dirty = dirtyPaths(ctx);
  if (dirty.length > 0) throw failure('RELEASE_TREE_DIRTY', `the gates left ${dirty.length} changed or untracked path(s) (first: ${dirty[0].slice(0, 100)}): generated files differ from HEAD. Commit or ignore them properly, then rerun. No record.`);
}

function writeRecord(ctx, { head, tag, results, recordPath }) {
  const record = {
    schema: 'starci-app-l4-record/1', head, tag, createdAt: new Date(ctx.now()).toISOString(), producedBy: 'starci app release gate',
    note: 'The full gates ran on a clean HEAD; every entry links the real log and its sha256.',
    gates: results,
  };
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
}

function runAll(ctx, config, { dir, platform }) {
  fs.mkdirSync(dir, { recursive: true });
  const results = [];
  for (const gate of config.gates) {
    const result = runGate(ctx, gate, { dir, platform });
    results.push(result);
    if (!result.pass) break;
  }
  return results;
}

const summaryOf = (result) => `${result.pass ? 'PASS' : 'FAIL'} ${result.name} (${result.detail}, ${result.seconds}s) log ${result.log}`;

/**
 * `starci app release gate`: dry run prints the preconditions, the gate list, the head and the tag; --execute runs every gate and, only if all are green,
 * writes the L4 record and creates the annotated tag. options: { execute, sonar, source, tagPrefix, platform }.
 */
export async function releaseGate(ctx, config, options = {}) {
  if (options.sonar) config = { ...config, gates: [...config.gates.filter((gate) => gate.name !== 'sonar'), sonarGate(config.services, ctx.env)] };
  const ci = latestDefaultBranchCi({ spawn: ctx.spawn, cwd: ctx.cwd, defaultBranch: config.defaultBranch });
  const ciLines = requireGreenCi(ctx, ci);
  const facts = inspect(ctx, config, options);
  const common = releaseDir(ctx);
  const recordPath = path.join(common, `${facts.head}.l4.json`);
  const dir = path.join(common, facts.head.slice(0, 12));
  const plan = [...ciLines, ...facts.out, ...planLines(config, facts, dir, recordPath)];
  const base = { head: facts.head, tag: facts.chosen.tag, record: recordPath, gates: config.gates.map((gate) => gate.name), ci: { state: ci.state, notices: ciLines } };
  if (facts.red.length > 0) return { ok: false, lines: [...plan, ...facts.red.map((item) => `RED: ${item}`), 'nothing was run.'], data: { ...base, red: facts.red, executed: false } };
  if (options.execute !== true) return { ok: true, lines: [...plan, '', 'dry run: no gate was run, nothing written. preconditions OK.'], data: { ...base, red: [], executed: false } };
  const results = runAll(ctx, config, { dir, platform: options.platform ?? process.platform });
  const report = results.map(summaryOf);
  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) return { ok: false, lines: [...plan, ...report, `gate(s) red: ${failed.map((item) => item.name).join(', ')}. No L4 record, no tag.`], data: { ...base, executed: true, results } };
  assertUnmoved(ctx, facts.head);
  writeRecord(ctx, { head: facts.head, tag: facts.chosen.tag, results, recordPath });
  const created = facts.chosen.state !== 'on-head';
  if (created) git(ctx, ['tag', '-a', facts.chosen.tag, '-m', `release ${facts.chosen.tag}: gates green on ${facts.head.slice(0, 12)} (L4 record ${path.basename(recordPath)})`, facts.head]);
  const tagged = created ? `annotated tag ${facts.chosen.tag} created on ${facts.head.slice(0, 10)}` : `annotated tag ${facts.chosen.tag} already on ${facts.head.slice(0, 10)}`;
  return { ok: true, lines: [...plan, ...report, `L4 record written: ${recordPath}`, tagged], data: { ...base, executed: true, results, tagCreated: created } };
}
