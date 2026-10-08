// The package phase owns canon/example refresh; the final runtime phase publishes committed payload under the same host lock.
import fs from 'node:fs';
import path from 'node:path';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { canonContentDigest, packedFiles } from '../gates/canon-digest.mjs';
import { loadPins } from '../gates/canon-pins.mjs';
import { releasePublish } from '../gates/release-publish.mjs';
import { discoverExampleApps } from '../lib/example-refs.mjs';
import { findInOrder } from '../lib/in-order.mjs';
import { repinExample } from './example-repin.mjs';
import { resultDetail, resultOk } from '../lib/verb-call.mjs';
import { underHostLock } from '../machine/verb-lock.mjs';

const exampleNames = (value, root) => {
  let values;
  if (value === undefined) values = discoverExampleApps(root);
  else if (Array.isArray(value)) values = value;
  else values = [value];
  return values.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
};

function rebindCodePatterns(root, write, deps) {
  const file = path.join(root, 'modules', 'models', 'code-patterns.yaml');
  const original = fs.readFileSync(file, 'utf8');
  const profiles = parseYaml(original)?.profiles ?? {};
  const pins = (deps.loadPins ?? loadPins)(root)?.pins ?? {};
  const rows = canonRows(root, profiles, pins, deps);
  const changed = rows.filter((row) => row.from.version !== row.to.version || row.from.value !== row.to.value || row.from.files !== row.to.files);
  if (write && changed.length) writeCanonChanges(file, original, changed);
  return { changed: changed.length, rows };
}

function canonRows(root, profiles, pins, deps) {
  const rows = [];
  for (const [profile, value] of Object.entries(profiles)) {
    const canon = value?.canon, pin = pins[canon?.package];
    if (!canon || !pin?.source) throw new Error(`profile ${profile} names no pinned canon source`);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, pin.source), 'utf8'));
    const directory = path.dirname(path.join(root, pin.source));
    const digest = canonContentDigest(directory, canon.contentDigest, (deps.packedFiles ?? packedFiles)(directory));
    rows.push({ profile, package: canon.package, from: { version: canon.version, value: canon.contentDigest.value, files: canon.contentDigest.files }, to: { version: manifest.version, ...digest } });
  }
  return rows;
}

function writeCanonChanges(file, original, changed) {
  let output = original;
  for (const row of changed) {
    const at = output.indexOf(`package: '${row.package}'`), end = output.indexOf('sourceRuleRoots:', at);
    if (at < 0) throw new Error(`cannot find the canon block of ${row.package}`);
    const block = output.slice(at, end < 0 ? undefined : end)
      .replace(/(version: )\S+/, `$1${row.to.version}`)
      .replace(/(value: )[0-9a-f]{64}/, `$1${row.to.value}`)
      .replace(/(files: )\d+/, `$1${row.to.files}`);
    output = output.slice(0, at) + block + (end < 0 ? '' : output.slice(end));
  }
  fs.writeFileSync(file, output);
}

/** `starci release publish`: existing registry publication plus the final binding and example refresh flow. */
export async function releasePublishFlow(ctx, deps = {}) {
  const ok = (result) => resultOk(result, { acceptOk: false });
  const message = (result) => resultDetail(result, { limit: null, lastLine: true });
  if ((ctx.positionals ?? []).length) return { code: 2, stderr: 'starci release publish: no positional arguments are accepted' };
  const root = path.resolve(ctx.cwd ?? process.cwd());
  const runtimePackage = ctx.args?.['runtime-package'] === true;
  if (runtimePackage && ctx.args?.publish === true && !ctx.args?.['expect-sha']) return { code: 2, stderr: 'starci release publish: --runtime-package --publish requires --expect-sha' };
  if (runtimePackage && ctx.args?.examples !== undefined) return { code: 2, stderr: 'starci release publish: --runtime-package cannot re-pin examples' };
  const examples = runtimePackage ? [] : exampleNames(ctx.args?.examples, root);
  const lines = [];
  const data = { schema: 'starci/release-publish-flow@1', published: ctx.args?.publish === true, phase: runtimePackage ? 'runtime' : 'packages', rebind: null, examples: [], plan: null };
  const node = deps.runNode ?? runNode, npm = deps.runNpm ?? runNpm;
  const operation = async () => {
    const tracked = await (deps.status ?? porcelainStatus)(root, { untracked: 'no' });
    if (!tracked?.ok || String(tracked.stdout ?? '').trim()) return { code: 1, stderr: 'starci release publish: the worktree has tracked changes' };
    const revParse = deps.revParse ?? revParseQuery;
    const head = await revParse(['HEAD'], { cwd: root });
    const branch = await revParse(['--abbrev-ref', 'HEAD'], { cwd: root });
    if (!ok(head) || !ok(branch)) return { code: 1, stderr: 'starci release publish: Git could not read HEAD and branch' };
    data.head = String(head.stdout).trim(); data.branch = String(branch.stdout).trim();
    lines.push(`worktree ${root}, branch ${data.branch}, HEAD ${data.head}, tracked changes 0`);
    if (ctx.args?.['expect-sha']) {
      if (data.head !== String(ctx.args['expect-sha']).trim()) return { code: 2, stderr: 'starci release publish: --expect-sha is not HEAD' };
    }
    const publishCode = await runPublicationPlan(ctx, deps, root, runtimePackage, lines, data);
    if (publishCode.error) return publishCode.error;
    if (runtimePackage) return publishCode.value === 0 ? { code: 0 } : { code: 1, stderr: 'starci release publish: runtime phase must finish without an unbound canon' };
    if (!lines.some((line) => /@starci\/cli@/.test(line)) || !lines.some((line) => /@starci\/hfs@/.test(line))) {
      return { code: 1, stderr: 'starci release publish: publish set must contain @starci/cli and @starci/hfs' };
    }
    try { data.rebind = rebindCodePatterns(root, ctx.args?.publish === true, deps); }
    catch (error) { return { code: 1, stderr: `starci release publish: code-pattern rebind failed (${error.message})` }; }
    appendExampleRepins(root, ctx, deps, examples, data, lines);
    if (ctx.args?.publish !== true) return { code: 0 };
    return publishExampleBindings(root, ctx, data, node, npm, ok, message);
  };
  let result;
  try {
    const locked = await (deps.underHostLock ?? underHostLock)({ role: ctx.role ?? 'release', purpose: 'release-publish', env: ctx.env }, operation, deps);
    if (locked?.ok === true && Object.hasOwn(locked, 'value')) result = locked.value;
    else if (locked?.ok === false && locked?.code === undefined) result = { code: 1, stderr: `starci release publish: host lock refused (${locked.reason ?? 'held'})` };
    else result = locked;
  } catch (error) { result = { code: 1, stderr: `starci release publish: ${error.message}` }; }
  return { ...result, text: [...lines, `starci release publish: ${ctx.args?.publish ? 'flow completed' : 'plan only'}`].join('\n'), data };
}

async function runPublicationPlan(ctx, deps, root, runtimePackage, lines, data) {
  try {
    const value = await (deps.releasePublish ?? releasePublish)({
      root, publish: ctx.args?.publish === true, runtimePackage, env: ctx.env, npmUser: ctx.args?.['npm-user'] ?? null,
      pollMinutes: Number(ctx.args?.['poll-minutes'] ?? 15), preLandRef: ctx.args?.['pre-land-ref'] ?? null,
      deps: { ...deps.releaseDeps, out: (line) => lines.push(line), plan: (summary) => { data.plan = summary; } },
    });
    if (value === 2) return { error: { code: 2, stderr: lines.at(-1) ?? 'starci release publish: bad usage' } };
    if (![0, 3].includes(value)) return { error: { code: 1, stderr: lines.at(-1) ?? 'starci release publish: publication plan is blocked' } };
    return { value };
  } catch (error) {
    return { error: { code: 1, stderr: `starci release publish: plan failed (${error.message})` } };
  }
}

function appendExampleRepins(root, ctx, deps, examples, data, lines) {
  lines.push(`code-pattern rebind: ${data.rebind.changed} profile(s) ${ctx.args?.publish ? 'written' : 'would change'}`);
  const pins = (deps.loadPins ?? loadPins)(root)?.pins ?? {};
  for (const name of examples) {
    const example = repinExample(root, name, pins, ctx.args?.publish === true);
    data.examples.push(example);
    let status;
    if (example.present) {
      const action = ctx.args?.publish ? 'written' : 'would change';
      status = `${example.changed} pin(s) ${action}`;
    } else status = 'not present, skipped';
    lines.push(`example ${name}: ${status}`);
  }
}

async function publishExampleBindings(root, ctx, data, node, npm, ok, message) {
  let failure = null;
  await findInOrder(data.examples.filter((entry) => entry.present), async (example) => {
    const refused = (what, result) => { failure = { code: 1, stderr: `starci release publish: ${example.name} ${what} failed (${message(result)})` }; return true; };
    const install = await npm(['install', '--no-audit', '--no-fund'], { cwd: example.directory, timeout: 900_000, env: ctx.env });
    if (!ok(install)) return refused('npm install', install);
    const ci = await npm(['ci', '--no-audit', '--no-fund'], { cwd: example.directory, timeout: 900_000, env: ctx.env });
    if (!ok(ci)) return refused('npm ci', ci);
    const sync = await node([path.join(root, 'packages', 'cli', 'bin', 'starci.mjs'), 'app', 'sync', '--write', '--cwd', example.directory], { cwd: root, timeout: 900_000, env: ctx.env });
    if (!ok(sync)) return refused('sync', sync);
    const checked = await node([path.join(root, 'scripts', 'checks', 'check-canon-pins.mjs'), '--repo', example.directory], { cwd: root, timeout: 900_000, env: ctx.env });
    if (!ok(checked)) return refused('binding check', checked);
    return false;
  });
  if (failure) return failure;
  const final = await node([path.join(root, 'scripts', 'checks', 'check-canon-pins.mjs')], { cwd: root, timeout: 900_000, env: ctx.env });
  return ok(final) ? { code: 0 } : { code: 1, stderr: `starci release publish: final binding check failed (${message(final)})` };
}
