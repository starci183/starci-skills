// Cold proof of the root runtime archive through its shipped dispatcher and installer.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sha256 } from '../../engine/digest.mjs';
import { SECRET_ENV_FILE } from '../../engine/secrets.mjs';
import { LOCAL_ROOT_ENV, TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { PROJECTS_ROOT_ENV } from '../../engine/db/ledger.mjs';
import { ARTIFACT_ROOT_ENV } from '../../engine/db/blob.mjs';
import { pack } from '../api/npm/pack.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { tarFiles } from '../lib/tar-files.mjs';
import { cleanEnv, gitTrackedUnder, PROOF_CODES, verifyPackedDependencies } from './package-clean-test.mjs';

const PROBE = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [root, host] = process.argv.slice(1);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const load = file => import(pathToFileURL(path.join(root, file)).href);
const [{ RUNTIME_VERSION }, installer] = await Promise.all([
  load('packages/cli/src/runtime-install.mjs'), load('scripts/install/install.mjs'),
  load('scripts/reconciler/start.mjs'),
]);
if (RUNTIME_VERSION !== manifest.version) throw new Error('installed CLI fetch version differs from root runtime version');
const plan = installer.entrySkillsPlan(host);
if (plan.skipped.length || plan.preserved.length || !plan.write.length) throw new Error('fresh host discovery projection is incomplete');
process.stdout.write(JSON.stringify({ name: manifest.name, version: manifest.version,
  payload: installer.payloadFiles(root),
  entries: plan.write.map(item => ({ relative: item.relative, source: path.relative(root, item.source).split(path.sep).join('/') })) }));
`;

/** Real archive/install proof; seams replace only owned process APIs in focused fixtures. Scratch and receipts are retained. */
export function proveRuntimePackage({ root, sourceSha, expectedShasum, env = process.env, deps = {} }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const result = { name: manifest.name, version: manifest.version, status: 'unrun', code: PROOF_CODES.unrun,
    schema: 'starci/runtime-package-clean@1', inputRoot: path.resolve(root), inputSha: sourceSha ?? null, stages: [] };
  let attempt;
  const finish = (status, code, detail) => {
    Object.assign(result, { status, code, detail });
    if (attempt) fs.writeFileSync(path.join(attempt, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    return result;
  };
  try {
    if (manifest.name !== 'starci' || manifest.private || !/^[0-9a-f]{40}$/.test(String(sourceSha ?? '')) || typeof expectedShasum !== 'string' || !/^[0-9a-f]{40}$/.test(expectedShasum)) return finish('unrun', PROOF_CODES.unrun, 'public root identity, committed input SHA and an actual npm pack shasum are required');
    attempt = fs.mkdtempSync(path.join(os.tmpdir(), 'release-runtime-'));
    result.attempt = attempt;
    for (let cursor = attempt; ; cursor = path.dirname(cursor)) {
      if (isLinkLike(cursor) || fs.existsSync(path.join(cursor, 'node_modules'))) return finish('unrun', PROOF_CODES.unrun, 'scratch has a linked ancestor or an ambient node_modules');
      if (path.dirname(cursor) === cursor) break;
    }
    const archives = path.join(attempt, 'archives'), installRoot = path.join(attempt, 'install'), host = path.join(attempt, 'host');
    for (const dir of [archives, installRoot, host, 'home', 'local', 'projects', 'artifacts', 'temp'].map((dir) => path.isAbsolute(dir) ? dir : path.join(attempt, dir))) fs.mkdirSync(dir);
    const baseEnv = Object.fromEntries(Object.entries(cleanEnv(env)).filter(([key]) => !/^(STARCI_|ORCA_)/i.test(key) && key !== 'NODE_OPTIONS'));
    const childEnv = { ...baseEnv, HOME: path.join(attempt, 'home'), USERPROFILE: path.join(attempt, 'home'),
      [LOCAL_ROOT_ENV]: path.join(attempt, 'local'), [TEST_REGISTRY_ENV]: path.join(attempt, 'local', 'machine.sqlite'),
      [PROJECTS_ROOT_ENV]: path.join(attempt, 'projects'), [ARTIFACT_ROOT_ENV]: path.join(attempt, 'artifacts'),
      TEMP: path.join(attempt, 'temp'), TMP: path.join(attempt, 'temp'), TMPDIR: path.join(attempt, 'temp'), STARCI_ROLE: 'owner' };
    const stage = (name, callback) => {
      const value = callback();
      fs.writeFileSync(path.join(attempt, `${name}.stdout.txt`), String(value.stdout ?? ''), { flag: 'wx' });
      fs.writeFileSync(path.join(attempt, `${name}.stderr.txt`), String(value.stderr ?? value.detail ?? ''), { flag: 'wx' });
      result.stages.push({ name, status: value.status ?? null, ok: value.ok ?? null, signal: value.signal ?? null,
        error: value.error ? { code: value.error.code ?? null, message: value.error.message } : null });
      return value;
    };
    let packProcess;
    const packed = stage('pack', () => {
      const value = (deps.pack ?? pack)(path.resolve(root), archives, { cwd: root,
        run: (args, options) => (packProcess = (deps.runNpm ?? runNpm)(args, { ...options, env: childEnv })) });
      return { ...value, ...(packProcess ? { status: packProcess.status, stdout: packProcess.stdout, stderr: packProcess.stderr, error: packProcess.error, signal: packProcess.signal } : {}) };
    });
    if (!packed.ok || path.basename(packed.file ?? '') !== packed.file) return finish('unrun', PROOF_CODES.unrun, `root pack failed: ${packed.detail ?? 'invalid archive path'}`);
    const archive = path.join(archives, packed.file), archiveStat = fs.lstatSync(archive, { throwIfNoEntry: false });
    if (!archiveStat?.isFile() || isLinkLike(archive, { stat: archiveStat })) return finish('unrun', PROOF_CODES.unrun, 'pack did not produce a regular archive');
    const bytes = fs.readFileSync(archive), files = tarFiles(bytes);
    const shasum = createHash('sha1').update(bytes).digest('hex');
    result.archive = { file: archive, sha256: sha256(bytes), shasum, bytes: bytes.length, packedFiles: [...files.keys()].sort() };
    if (shasum !== expectedShasum) return finish('red', PROOF_CODES.install, 'actual archive differs from the frozen publish pack');
    const identity = JSON.parse(files.get('package/package.json')?.toString() ?? '{}');
    if (identity.name !== manifest.name || identity.version !== manifest.version) return finish('red', PROOF_CODES.install, 'packed root package identity differs');
    // Consumer archives never carry local credentials or the releasing host's encrypted Sonar custody.
    const privateFile = [...files.keys()].find((file) => file.replaceAll('\\', '/').split('/').at(-1).toLowerCase() === SECRET_ENV_FILE.toLowerCase() || /^package[\\/]ext[\\/]sonar[\\/]secrets(?:[\\/]|$)/i.test(file));
    if (privateFile) return finish('red', PROOF_CODES.install, `root archive contains private host configuration or custody: ${privateFile}`);
    const required = ['skills/starci/SKILL.md', 'skills/starci/agents/openai.yaml', 'skills/starci/references/host-startup.md', 'skills/starci/references/host-maintenance.md',
      'ui/server.mjs', 'ui/api/index.mjs', 'ui/package.json', 'ui/package-lock.json'];
    const uiFiles = (deps.trackedUnder ?? gitTrackedUnder)(path.join(root, 'ui'));
    if (!uiFiles?.some((file) => file.startsWith('src/'))) return finish('unrun', PROOF_CODES.unrun, 'tracked UI source inventory is unavailable or empty');
    required.push(...uiFiles.filter((file) => /^(src|api)\//.test(file)).map((file) => `ui/${file}`));
    if (required.some((file) => !files.has(`package/${file}`))) return finish('red', PROOF_CODES.install, 'root archive omits an owning prompt or UI source input');
    const payload = { name: manifest.name, version: manifest.version, files };
    const sourceFailure = verifyPackedDependencies([payload], root, { packageRoots: new Map([[manifest.name, root]]) });
    if (sourceFailure) return finish('red', PROOF_CODES.install, sourceFailure);
    const installed = stage('install', () => (deps.runNpm ?? runNpm)(['install', '--prefix', installRoot, archive, '--no-save', '--package-lock=false', '--omit=dev', '--no-audit', '--no-fund'],
      { cwd: installRoot, env: childEnv, timeout: 1_200_000, maxBuffer: 256 * 1024 * 1024 }));
    if (installed.error || installed.status === null) return finish('unrun', PROOF_CODES.unrun, 'archive install did not complete');
    if (installed.status !== 0) return finish('red', PROOF_CODES.install, 'archive install failed; see immutable stderr');
    const installFailure = verifyPackedDependencies([payload], installRoot);
    if (installFailure) return finish('red', PROOF_CODES.install, installFailure);
    const installedRoot = path.join(installRoot, 'node_modules', manifest.name);
    const node = deps.runNode ?? runNode;
    const probed = stage('installed-graph', () => node(['--input-type=module', '-e', PROBE, installedRoot, host],
      { cwd: host, env: childEnv, timeout: 300_000, maxBuffer: 64 * 1024 * 1024 }));
    if (probed.error || probed.status === null) return finish('unrun', PROOF_CODES.unrun, 'installed graph process did not complete');
    if (probed.status !== 0) return finish('red', PROOF_CODES.test, 'installed runtime graph or fetch version failed');
    const probe = JSON.parse(String(probed.stdout));
    if (probe.name !== manifest.name || probe.version !== manifest.version || !probe.payload?.length || !probe.entries?.length) return finish('red', PROOF_CODES.test, 'installed payload owner returned an incomplete identity or projection');
    const projected = new Map(probe.payload.map((file) => [`package/${file}`, files.get(`package/${file}`)]));
    if ([...projected.values()].some((value) => !Buffer.isBuffer(value)) || required.some((file) => !projected.has(`package/${file}`))) return finish('red', PROOF_CODES.test, 'native installer omits an owning packed prompt or UI input');
    const dispatched = stage('runtime-install', () => node([path.join(installedRoot, 'scripts', 'cli', 'main.mjs'), 'runtime', 'install', '--cwd', host, '--no-bootstrap'],
      { cwd: host, env: childEnv, timeout: 300_000, maxBuffer: 64 * 1024 * 1024 }));
    if (dispatched.error || dispatched.status === null) return finish('unrun', PROOF_CODES.unrun, 'runtime install process did not complete');
    if (dispatched.status !== 0) return finish('red', PROOF_CODES.test, 'shipped runtime install dispatch failed');
    const target = path.join(host, '.claude');
    const projectionFailure = verifyPackedDependencies([{ ...payload, files: projected }], host, { packageRoots: new Map([[manifest.name, target]]) });
    if (projectionFailure) return finish('red', PROOF_CODES.test, projectionFailure);
    const entryFiles = new Map(probe.entries.map((entry) => [`package/${entry.relative}`, files.get(`package/${entry.source}`)]));
    if ([...entryFiles.values()].some((value) => !Buffer.isBuffer(value))) return finish('red', PROOF_CODES.test, 'discovery owner names a source outside the archive');
    const entryFailure = verifyPackedDependencies([{ ...payload, files: entryFiles }], host, { packageRoots: new Map([[manifest.name, host]]) });
    if (entryFailure) return finish('red', PROOF_CODES.test, entryFailure);
    const custody = JSON.parse(fs.readFileSync(path.join(target, '.starci-skills.json'), 'utf8'));
    if (custody.name !== manifest.name || custody.version !== manifest.version ||
      Object.keys(custody.files ?? {}).sort().join('\0') !== [...probe.payload].sort().join('\0') ||
      probe.entries.some((entry) => custody.hostSkills?.files?.[entry.relative] !== sha256(entryFiles.get(`package/${entry.relative}`)))) return finish('red', PROOF_CODES.test, 'native installer custody does not bind the actual payload and discovery bytes');
    if (fs.existsSync(path.join(host, 'AGENTS.md')) || fs.existsSync(path.join(host, '.gitignore'))) return finish('red', PROOF_CODES.test, 'no-bootstrap dispatch changed host bootstrap files');
    fs.writeFileSync(path.join(attempt, 'install-custody.json'), `${JSON.stringify(custody, null, 2)}\n`, { flag: 'wx' });
    const updated = stage('runtime-update', () => node([path.join(installedRoot, 'scripts', 'cli', 'main.mjs'), 'runtime', 'update', '--cwd', host, '--no-bootstrap'],
      { cwd: host, env: childEnv, timeout: 300_000, maxBuffer: 64 * 1024 * 1024 }));
    if (updated.error || updated.status === null) return finish('unrun', PROOF_CODES.unrun, 'runtime custody update process did not complete');
    if (updated.status !== 0) return finish('red', PROOF_CODES.test, 'native installer refused its fresh custody');
    const refreshedCustody = JSON.parse(fs.readFileSync(path.join(target, '.starci-skills.json'), 'utf8'));
    if (refreshedCustody.keptLocal?.length || refreshedCustody.preservedStale?.length) return finish('red', PROOF_CODES.test, 'native installer detects changed or unowned payload custody on the fresh host');
    const refreshedFailure = verifyPackedDependencies([{ ...payload, files: projected }], host, { packageRoots: new Map([[manifest.name, target]]) });
    if (refreshedFailure) return finish('red', PROOF_CODES.test, refreshedFailure);
    const diagnosed = stage('runtime-doctor', () => node([path.join(target, 'scripts', 'cli', 'main.mjs'), 'runtime', 'doctor', '--cwd', host],
      { cwd: host, env: childEnv, timeout: 300_000, maxBuffer: 64 * 1024 * 1024 }));
    if (diagnosed.error || diagnosed.signal || !Number.isInteger(diagnosed.status)) return finish('unrun', PROOF_CODES.unrun, 'full installed runtime doctor did not complete');
    if (diagnosed.status !== 0) return finish('red', PROOF_CODES.test, 'full installed runtime doctor failed; see immutable diagnostics');
    const diagnosedFailure = verifyPackedDependencies([{ ...payload, files: projected }], host, { packageRoots: new Map([[manifest.name, target]]) });
    if (diagnosedFailure) return finish('red', PROOF_CODES.test, diagnosedFailure);
    result.projectedFiles = probe.payload; result.discoveryFiles = probe.entries.map((entry) => entry.relative);
    return finish('green', null, 'actual root archive, private native projection and full installed runtime doctor match');
  } catch (error) {
    return finish('unrun', PROOF_CODES.unrun, String(error?.stack ?? error));
  }
}
