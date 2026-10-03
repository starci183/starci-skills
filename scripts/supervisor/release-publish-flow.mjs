// release-publish-flow.mjs - extend package publication with final canon rebind, example re-pin/install/sync, and checks.
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
import { resultDetail, resultOk } from '../lib/verb-call.mjs';
import { underHostLock } from '../machine/verb-lock.mjs';

const exampleNames = (value, root) => {
  const values = value === undefined ? discoverExampleApps(root) : Array.isArray(value) ? value : [value];
  return values.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
};

function rebindCodePatterns(root, write, deps) {
  const file = path.join(root, 'modules', 'models', 'code-patterns.yaml');
  const original = fs.readFileSync(file, 'utf8');
  const profiles = parseYaml(original)?.profiles ?? {};
  const pins = (deps.loadPins ?? loadPins)(root)?.pins ?? {};
  const rows = [];
  for (const [profile, value] of Object.entries(profiles)) {
    const canon = value?.canon, pin = pins[canon?.package];
    if (!canon || !pin?.source) throw new Error(`profile ${profile} names no pinned canon source`);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, pin.source), 'utf8'));
    const directory = path.dirname(path.join(root, pin.source));
    const digest = canonContentDigest(directory, canon.contentDigest, (deps.packedFiles ?? packedFiles)(directory));
    rows.push({ profile, package: canon.package, from: { version: canon.version, value: canon.contentDigest.value, files: canon.contentDigest.files }, to: { version: manifest.version, ...digest } });
  }
  const changed = rows.filter((row) => row.from.version !== row.to.version || row.from.value !== row.to.value || row.from.files !== row.to.files);
  if (write && changed.length) {
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
  return { changed: changed.length, rows };
}

function repinExample(root, name, pins, write) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`invalid example name ${name}`);
  const directory = path.join(root, 'examples', name);
  if (!fs.existsSync(path.join(directory, 'package.json'))) return { name, directory, present: false, changed: 0 };
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', 'coverage']);
  const visit = (dir, depth) => {
    if (depth > 6) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(target, depth + 1); else if (entry.name === 'package.json') files.push(target);
    }
  };
  visit(directory, 0);
  let changed = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8'), pkg = JSON.parse(original);
    let output = original;
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [dependency, spec] of Object.entries(pkg[key] ?? {})) {
        const pin = pins[dependency];
        if (!pin || spec === pin.version || /^(workspace:|file:)/.test(String(spec))) continue;
        changed += 1;
        const escaped = dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const version = String(spec).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output.replace(new RegExp(`("${escaped}"\\s*:\\s*")${version}(")`), `$1${pin.version}$2`);
      }
    }
    if (write && output !== original) fs.writeFileSync(file, output);
  }
  return { name, directory, present: true, changed };
}

/** `starci release publish`: existing registry publication plus the final binding and example refresh flow. */
export async function releasePublishFlow(ctx, deps = {}) {
  const ok = (result) => resultOk(result, { acceptOk: false });
  const message = (result) => resultDetail(result, { limit: null, lastLine: true });
  if ((ctx.positionals ?? []).length) return { code: 2, stderr: 'starci release publish: no positional arguments are accepted' };
  const root = path.resolve(ctx.cwd ?? process.cwd());
  const examples = exampleNames(ctx.args?.examples, root);
  const lines = [];
  const data = { schema: 'starci/release-publish-flow@1', published: ctx.args?.publish === true, rebind: null, examples: [] };
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
    let publishCode;
    try {
      publishCode = await (deps.releasePublish ?? releasePublish)({
        root, publish: ctx.args?.publish === true, npmUser: ctx.args?.['npm-user'] ?? null,
        pollMinutes: Number(ctx.args?.['poll-minutes'] ?? 15), preLandRef: ctx.args?.['pre-land-ref'] ?? null,
        deps: { ...(deps.releaseDeps ?? {}), out: (line) => lines.push(line) },
      });
    } catch (error) { return { code: 1, stderr: `starci release publish: plan failed (${error.message})` }; }
    if (publishCode === 2) return { code: 2, stderr: lines.at(-1) ?? 'starci release publish: bad usage' };
    if (![0, 3].includes(publishCode)) return { code: 1, stderr: lines.at(-1) ?? 'starci release publish: publication plan is blocked' };
    if (!lines.some((line) => /@starci\/cli@/.test(line)) || !lines.some((line) => /@starci\/hfs@/.test(line))) {
      return { code: 1, stderr: 'starci release publish: publish set must contain @starci/cli and @starci/hfs' };
    }
    try { data.rebind = rebindCodePatterns(root, ctx.args?.publish === true, deps); }
    catch (error) { return { code: 1, stderr: `starci release publish: code-pattern rebind failed (${error.message})` }; }
    lines.push(`code-pattern rebind: ${data.rebind.changed} profile(s) ${ctx.args?.publish ? 'written' : 'would change'}`);
    const pins = (deps.loadPins ?? loadPins)(root)?.pins ?? {};
    for (const name of examples) {
      const example = repinExample(root, name, pins, ctx.args?.publish === true);
      data.examples.push(example);
      lines.push(`example ${name}: ${example.present ? `${example.changed} pin(s) ${ctx.args?.publish ? 'written' : 'would change'}` : 'not present, skipped'}`);
    }
    if (ctx.args?.publish !== true) return { code: 0 };
    for (const example of data.examples.filter((entry) => entry.present)) {
      const install = await npm(['install', '--no-audit', '--no-fund'], { cwd: example.directory, timeout: 900_000, env: ctx.env });
      if (!ok(install)) return { code: 1, stderr: `starci release publish: ${example.name} npm install failed (${message(install)})` };
      const ci = await npm(['ci', '--no-audit', '--no-fund'], { cwd: example.directory, timeout: 900_000, env: ctx.env });
      if (!ok(ci)) return { code: 1, stderr: `starci release publish: ${example.name} npm ci failed (${message(ci)})` };
      const sync = await node([path.join(root, 'packages', 'cli', 'bin', 'starci.mjs'), 'app', 'sync', '--write', '--cwd', example.directory], { cwd: root, timeout: 900_000, env: ctx.env });
      if (!ok(sync)) return { code: 1, stderr: `starci release publish: ${example.name} sync failed (${message(sync)})` };
      const checked = await node([path.join(root, 'scripts', 'checks', 'check-canon-pins.mjs'), '--repo', example.directory], { cwd: root, timeout: 900_000, env: ctx.env });
      if (!ok(checked)) return { code: 1, stderr: `starci release publish: ${example.name} binding check failed (${message(checked)})` };
    }
    const final = await node([path.join(root, 'scripts', 'checks', 'check-canon-pins.mjs')], { cwd: root, timeout: 900_000, env: ctx.env });
    return ok(final) ? { code: 0 } : { code: 1, stderr: `starci release publish: final binding check failed (${message(final)})` };
  };
  let result;
  try {
    const locked = await (deps.underHostLock ?? underHostLock)({ role: ctx.role ?? 'release', purpose: 'release-publish', env: ctx.env }, operation, deps);
    result = locked?.ok === true && Object.hasOwn(locked, 'value') ? locked.value
      : locked?.ok === false && locked?.code === undefined ? { code: 1, stderr: `starci release publish: host lock refused (${locked.reason ?? 'held'})` }
        : locked;
  } catch (error) { result = { code: 1, stderr: `starci release publish: ${error.message}` }; }
  return { ...result, text: [...lines, `starci release publish: ${ctx.args?.publish ? 'flow completed' : 'plan only'}`].join('\n'), data };
}
