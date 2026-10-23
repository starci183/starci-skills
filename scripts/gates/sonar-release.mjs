import fs from 'node:fs';
import path from 'node:path';
import {sha256 as digest} from '../../engine/digest.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {resolveProvisionTarget} from './provision-target.mjs';
import {runProvisionOperation, provisionNativeChildEnvironment} from './provision-operation.mjs';
import {nextBuildEnv} from './build-env.mjs';
import {sonarManagedRequest, sonarSourceMatches, readSonarBrowse} from './sonar-manage.mjs';
import {qualityServices} from '../hfs/ci-declaration.mjs';
import {readProperties} from '../lib/properties.mjs';
import {requestJson} from '../api/http/request-json.mjs';
import {manage} from '../api/sonar/manage.mjs';
import {sonarRelease} from '../api/process/sonar-release.mjs';
import {revParseQuery} from '../api/git/rev-parse-query.mjs';
import {revParse} from '../api/git/rev-parse.mjs';
import {catFile} from '../api/git/cat-file.mjs';

const codes = new Set(['sonar-release-source-drift', 'sonar-release-native-unknown', 'sonar-release-process-unknown',
  'sonar-release-native-record-unverified', 'sonar-release-processed', 'sonar-release-readback-held']);
const held = (code, proof, writeAck = false) => ({outcome: writeAck ? 'partial' : 'unknown', code, writeAck,
  publicReadback: false, consumerVerified: false, ...(proof ? {proof} : {})});
const publicFile = (file, bound) => {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > bound) throw new Error('Sonar release public file unavailable');
  return fs.readFileSync(file);
};

/** The installed native gate and this target must name the same required Sonar service. */
function nativeConfiguration(target, request) {
  const doc = parseYaml(publicFile(target.declaration.path, 2 * 1024 * 1024).toString('utf8'));
  const quality = qualityServices(doc).sonar;
  if (!quality || quality.provider !== 'sonarqube'
      || quality.host?.replace(/\/$/, '') !== target.origin || quality.projectKey !== request.projectKey
      || !/^SONAR_(?:[A-Z0-9_]*_)?TOKEN$/.test(quality.token)
      || (quality.organization && quality.organization !== request.organization)
      || (quality.organizationVar && quality.organizationVar !== 'SONAR_ORGANIZATION'))
    throw new Error('Native Sonar declaration differs from the selected operation target');
  const properties = readProperties(path.join(target.repoRoot, 'sonar-project.properties'));
  if (Object.keys(properties).some(key => /^sonar\.(?:login$|password$|token$|branch\.|pullrequest\.|scanner\.|userHome$|working\.directory$|projectBaseDir$)/.test(key))
      || properties['sonar.projectKey'] !== request.projectKey
      || (properties['sonar.host.url'] && properties['sonar.host.url'].replace(/\/$/, '') !== target.origin)
      || (properties['sonar.organization'] && properties['sonar.organization'] !== request.organization))
    throw new Error('Native scanner properties may not override target, credential or executable routing');
  const files = ['package.json', 'package-lock.json', 'hfs.json', 'sonar-project.properties'];
  return {tokenEnv: quality.token, ...(quality.organizationVar ? {organizationEnv: quality.organizationVar} : {}),
    files: Object.fromEntries(files.map(file => [file, digest(publicFile(path.join(target.repoRoot, file), 16 * 1024 * 1024))])),
    gateSha256: digest(publicFile(path.join(skillRoot, 'packages/hfs/release/gate.mjs'), 1024 * 1024))};
}

function releaseDirectory(repoRoot) {
  const result = revParseQuery(['--git-common-dir'], {cwd: repoRoot});
  if (result.status !== 0 || !String(result.stdout).trim()) throw new Error('Native release directory unavailable');
  return path.join(path.resolve(repoRoot, String(result.stdout).trim()), 'starci-release');
}

/** L4 and the annotated tag remain native authority. Their bytes are never rewritten by this adapter. */
function nativeRecord(target, request) {
  try {
    const common = releaseDirectory(target.repoRoot), file = path.join(common, `${request.revision}.l4.json`);
    const bytes = publicFile(file, 2 * 1024 * 1024), record = JSON.parse(bytes.toString('utf8'));
    const rows = record.gates, tag = record.tag;
    if (record.schema !== 'starci-app-l4-record/1' || record.producedBy !== 'starci app release gate'
        || record.head !== request.revision || typeof tag !== 'string' || !/^[A-Za-z0-9._/-]{1,128}$/.test(tag)
        || !Array.isArray(rows) || !rows.length || rows.some(row => row.pass !== true)
        || rows.filter(row => row.name === 'sonar' && row.pass === true).length !== 1) return null;
    const type = catFile(['-t', `refs/tags/${tag}`], {cwd: target.repoRoot});
    if (type.status !== 0 || String(type.stdout).trim() !== 'tag'
        || revParse(target.repoRoot, `refs/tags/${tag}`) !== request.revision) return null;
    for (const row of rows) {
      const expected = path.join(common, request.revision.slice(0, 12), `${row.name}.log`);
      if (!/^[a-z][a-z0-9-]*$/.test(row.name) || path.resolve(row.log) !== path.resolve(expected)
          || digest(publicFile(expected, 32 * 1024 * 1024)) !== row.logSha256) return null;
    }
    return {nativeGateVerified: true, nativeTag: tag, nativeRecordSha256: digest(bytes), nativeGates: rows.length};
  } catch {return null;}
}

function reportTask(target, request) {
  try {
    const file = path.join(target.repoRoot, '.scannerwork/report-task.txt');
    publicFile(file, 32768);
    const report = readProperties(file);
    if (report.projectKey !== request.projectKey || report.serverUrl?.replace(/\/$/, '') !== target.origin
        || !/^[A-Za-z0-9_-]{1,100}$/.test(report.ceTaskId ?? '')) return null;
    return report.ceTaskId;
  } catch {return null;}
}

/** Browse credentials inspect the native scanner's own processed task, then the same exact analysis. */
async function processedRelease(client, request, native, ceTaskId) {
  const ce = await client.ceTask(ceTaskId);
  const task = ce.data?.task;
  if (!ce.ok || task?.id !== ceTaskId || task.status !== 'SUCCESS' || task.componentKey !== request.projectKey || !task.analysisId)
    return held('sonar-release-readback-held', native, true);
  const browse = await readSonarBrowse(client, request);
  const ownGate = await client.qualityGateForAnalysis(task.analysisId);
  const latest = await client.analyses(request.projectKey);
  if (browse.outcome !== 'verified' || browse.proof.analysisId !== task.analysisId || browse.proof.issues !== 0
      || browse.proof.metrics.violations !== 0 || browse.proof.qualityGate !== 'OK' || !ownGate.ok
      || ownGate.data?.projectStatus?.status !== 'OK' || latest.data?.analyses?.[0]?.key !== task.analysisId)
    return held('sonar-release-readback-held', {...native, ceTaskId}, true);
  return {...browse, outcome: 'verified', code: 'sonar-release-processed', writeAck: true, consumerVerified: true,
    proof: {...browse.proof, ...native, ceTaskId}};
}

async function reconcileRelease(client, target, request, callbacks) {
  const metadata = callbacks.operation.metadata ?? {}, native = nativeRecord(target, request);
  if (metadata.phase === 'native-release-process-unknown') return held('sonar-release-process-unknown', native, Boolean(native));
  if (!native || native.nativeRecordSha256 !== metadata.nativeRecordSha256 || native.nativeTag !== metadata.nativeTag || !metadata.ceTaskId)
    return held('sonar-release-native-record-unverified', native, Boolean(native));
  return processedRelease(client, request, native, metadata.ceTaskId);
}

/** Persist the native L4/tag/task identity before provider readback. A still-live tree stays held. */
function recordNativeResult(result, target, request, before, priorTask, callbacks) {
  const observed = nativeRecord(target, request);
  const native = observed?.nativeRecordSha256 !== before?.nativeRecordSha256 ? observed : null;
  const ceTaskId = reportTask(target, request);
  if (!result.processClosed) {
    if (native) callbacks.acknowledge({phase: 'native-release-process-unknown', nativeRecordSha256: native.nativeRecordSha256,
      nativeTag: native.nativeTag, ...(ceTaskId ? {ceTaskId} : {})});
    else callbacks.checkpoint({phase: 'native-release-process-unknown'});
    return {failure: held('sonar-release-process-unknown', native, Boolean(native))};
  }
  if (!native || !ceTaskId || ceTaskId === priorTask) return {failure: held('sonar-release-native-unknown', native, Boolean(native))};
  callbacks.acknowledge({phase: 'native-release-recorded', nativeRecordSha256: native.nativeRecordSha256,
    nativeTag: native.nativeTag, ceTaskId});
  return {native, ceTaskId};
}

async function executeRelease({ctx, target, request, installed, configuration, before, callbacks, reconcile}) {
  if (!sonarSourceMatches(target.repoRoot, request.revision)) return held('sonar-release-source-drift');
  const client = manage({target, credentials: callbacks.credentials, request: requestJson});
  if (reconcile) return reconcileRelease(client, target, request, callbacks);
  callbacks.assertAuthority();
  // Resolve both selected roles before the first effect checkpoint. Only analysis enters the native child.
  const analysis = callbacks.credentials.analysis, browse = callbacks.credentials.browse;
  if (!analysis || !browse) throw new Error('Required release credentials unavailable');
  const env = nextBuildEnv(provisionNativeChildEnvironment(ctx.env, ctx.provisionNativeContext(), {age: false}));
  env.SONAR_TOKEN = analysis;
  env[configuration.tokenEnv] = analysis;
  env.SONAR_HOST_URL = target.origin;
  if (configuration.organizationEnv) env[configuration.organizationEnv] = request.organization;
  env.SONAR_SCANNER_JSON_PARAMS = JSON.stringify({'sonar.projectKey': request.projectKey,
    'sonar.scm.revision': request.revision, 'sonar.qualitygate.wait': 'true',
    'sonar.qualitygate.timeout': String(request.release.qualityGateTimeoutSeconds), 'sonar.working.directory': '.scannerwork',
    'sonar.scanner.apiBaseUrl': `${target.origin}/api/v2`,
    'sonar.scanner.metadataFilePath': path.join(target.repoRoot, '.scannerwork/report-task.txt')});
  if (JSON.stringify(nativeConfiguration(target, request)) !== JSON.stringify(configuration)) return held('sonar-release-source-drift');
  const priorTask = reportTask(target, request);
  callbacks.checkpoint({phase: 'native-release-launch-intent', resourceId: request.projectKey});
  const result = await sonarRelease({repoRoot: target.repoRoot, mode: 'run', expectedIdentity: installed,
    revision: request.revision, env, timeoutMs: request.release.timeoutMs, gateSha256: configuration.gateSha256});
  const {native, ceTaskId, failure} = recordNativeResult(result, target, request, before, priorTask, callbacks);
  if (failure) return failure;
  if (!result.ok || !sonarSourceMatches(target.repoRoot, request.revision)) return held('sonar-release-native-unknown', {...native, ceTaskId}, true);
  return processedRelease(client, request, native, ceTaskId);
}

/** Prepare or execute the package-safe native gate with private declared Sonar roles. Never pushes or publishes. */
export async function runSonarRelease(ctx) {
  try {
    if (ctx.positionals?.[0] !== 'gate' || ctx.operationPolicy?.action !== 'sonar.release.gate') throw new Error('Release action mismatch');
    const target = resolveProvisionTarget({cwd: ctx.cwd, targetId: ctx.args.target, provider: ['sonar-server', 'sonar-community']});
    if (!target.actions.includes('sonar.release.gate')) throw new Error('Native release effects must be explicitly declared');
    const request = sonarManagedRequest(target, 'release', ctx.args);
    if (!request.revision || !sonarSourceMatches(target.repoRoot, request.revision)) throw new Error('Native release needs the exact clean App HEAD');
    const configuration = nativeConfiguration(target, request);
    const installed = await sonarRelease({repoRoot: target.repoRoot, gateSha256: configuration.gateSha256});
    const before = nativeRecord(target, request);
    return await runProvisionOperation(ctx, {action: 'sonar.release.gate', target, requestId: ctx.args.operation,
      execute: ctx.args.execute, credentialRefs: {analysis: target.credentials.analysis, browse: target.credentials.browse}, destination: null,
      publicResource: request, resultCodes: codes, plan: {installed, configuration,
        effects: {nativeGates: true, nativeL4Record: true, nativeAnnotatedTag: true, remoteAnalysis: true, push: false, publish: false},
        privateConsumer: 'The installed native gate receives the selected Analysis credential; Browse stays in the Source process.',
        proof: {processedRevision: request.revision, qualityGate: 'OK', unresolvedIssues: 0}},
      apply: callbacks => executeRelease({ctx, target, request, installed, configuration, before, callbacks, reconcile: false}),
      reconcile: callbacks => executeRelease({ctx, target, request, installed, configuration, before, callbacks, reconcile: true})});
  } catch (error) {
    const upgrade = error?.message === 'SONAR_RELEASE_NATIVE_UPGRADE_REQUIRED';
    return {code: 2, data: {ok: false, code: upgrade ? 'sonar-release-native-upgrade-required' : 'sonar-release-declaration-refused'},
      text: upgrade ? 'Install the native HFS package from this Source release before preparing the private Sonar consumer; no custody was opened.'
        : 'Declare the required matching Sonar service, private Analysis/Browse roles, native installed package and release bounds before preparing this operation.'};
  }
}
