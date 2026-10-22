#!/usr/bin/env node
// uat-record.mjs - `starci uat record`: walk one work/uat-flow@1 record in a real browser outside a Kernel workflow and file
// what the walk recorded as the flow's evidence, in the shape a uat.verify run files it (modules/ops/ops/uat.verify.yaml writes.evidence).
//
//   starci uat record --work <.starciwork> --flow <uat.id> [--cwd <app root>] [--environment local] [--base-url <url>] -- <Playwright command...>
//
// 1. The command runs holding one machine-wide UAT slot (uat-slots.mjs acquireUatSlot) and through the browser recorder
//    (playwright-recording.mjs withRecording: video, trace and screenshots on by default), exactly as a uat.verify step runs it,
//    with the SWC cache the runtime decides for a served Next app (gates/build-env.mjs).
// 2. It receives a fresh run folder and run id in the environment (UAT_RUN_DIR, UAT_RUN_ID, UAT_FLOW) and writes the run's own
//    files there: manifest.yaml (its per-step and per-check observations and an `outcome`), result.md and screens/*.png. The
//    recorder's video of the walk is added as videos/<flow>.webm. The folder's shape is checked by scripts/lib/uat-run-folder.mjs.
// 3. Every file of the folder becomes a blob of the default artifact store (engine/db/blob.mjs putBlob). For an example's own Work
//    tree the same verified bytes are also curated into the example's fixture store (example-refs.mjs exampleArtifactReadOptions),
//    the only store an example's evidence is read from.
// 4. The flow's evidence.yaml is written (actor uat-record); the outcome is pass only when the command exited 0 AND its own manifest
//    says pass. The record's own index.yaml (state, proves, blockedBy) is never touched: settling a record is a person's or a Kernel
//    operation's act.
// Exit 0 when the walk passed, 1 when it was recorded but did not pass, 2 on a refusal (nothing is written then).
import fs from 'node:fs';
import path from 'node:path';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { putBlob } from '../../engine/db/blob.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { loadRecords } from '../work/record-ownership.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { isMain } from '../lib/is-main.mjs';
import { invocationDir } from '../lib/roots.mjs';
import { exampleArtifactReadOptions, exampleCheckoutOf } from '../lib/example-refs.mjs';
import { startProgram } from '../api/process/start-program.mjs';
import { withSwcCache } from '../gates/build-env.mjs';
import { acquireUatSlot } from './uat-slots.mjs';
import { launchFor } from './launch.mjs';
import { recordingDirUnder, withRecording } from './playwright-recording.mjs';
import {
  UAT_RECORD_FLOW_UNKNOWN, curatedProblem, curationOf, evidenceOf, newRunId, readRunFolder, recordedOutcome, uatRecordRefusal,
} from '../lib/uat-run-folder.mjs';

/** The selected work/uat-flow@1 record of `workRoot`, or a refusal. */
function flowRecord(workRoot, flowId) {
  const record = loadRecords(workRoot, (root) => walkFiles(root)).get(flowId);
  if (record?.schema !== 'work/uat-flow@1') throw uatRecordRefusal(UAT_RECORD_FLOW_UNKNOWN, `${flowId} is not a work/uat-flow@1 record of ${workRoot}`);
  return record;
}

/** The recorder's videos of the walk: the .webm files under the recording folder (Playwright writes one per test). */
const recordedVideos = (outputDir) =>
  (outputDir && fs.existsSync(outputDir) ? walkFiles(outputDir).filter((file) => file.toLowerCase().endsWith('.webm')).sort(byCodeUnit) : []);

/** Run the walk holding a UAT slot and through the recorder; resolves to its exit code and the recorder's folder. */
async function walk(command, { cwd, env, runId }) {
  const slot = await acquireUatSlot({ runId, onQueued: ({ position, limit }) => console.error(`[uat-record] queued: position ${position}, ${limit} slots busy`) });
  try {
    const recording = withRecording(command, { cwd, outputDir: recordingDirUnder(path.join(tempRoot(), 'uat-record-recordings')) });
    const launch = launchFor(recording.command);
    const child = startProgram(launch.file, launch.args, { stdio: 'inherit', cwd, env, windowsHide: false });
    const code = await new Promise((resolve) => { child.once('exit', (c) => resolve(Number.isInteger(c) ? c : 1)); child.once('error', () => resolve(1)); });
    return { code, outputDir: recording.outputDir };
  } finally { slot.release(); }
}

/** Curates one verified blob into an example's fixture store: written only when absent, then re-hashed from disk. */
function curate(root, blob) {
  const plan = curationOf(root, blob);
  fs.mkdirSync(plan.dir, { recursive: true });
  if (!fs.existsSync(plan.file)) fs.writeFileSync(plan.file, blob.bytes);
  const problem = curatedProblem(blob.sha256, fs.readFileSync(plan.file));
  if (problem) throw problem;
  if (!fs.existsSync(plan.sidecar)) fs.writeFileSync(plan.sidecar, plan.sidecarText);
}

/** File one recorded run: blobs, the example's curated copy, and the flow's evidence.yaml. */
function fileRun({ workRoot, record, runId, runDir, exitCode, command, environment, capturedAt, baseUrl }) {
  const { manifest, files } = readRunFolder(runDir);
  const example = exampleArtifactReadOptions(exampleCheckoutOf(workRoot) ?? skillRoot, workRoot);
  const cited = files.map(({ name, file, mediaType }) => {
    const bytes = fs.readFileSync(file);
    const stored = putBlob(bytes, { mediaType });
    if (example.root) curate(example.root, { sha256: stored.sha, bytes, mediaType, createdAt: capturedAt });
    return { name, sha256: stored.sha };
  });
  const outcome = recordedOutcome(exitCode, manifest);
  const evidence = evidenceOf({ recordId: record.id, recordDigest: sha256File(path.join(record.dir, 'index.yaml')), runId, outcome, cited, command, environment, capturedAt, baseUrl });
  const stores = example.root ? 'the artifact store and of this example\'s fixture store' : 'the artifact store';
  const header = [
    `# Written by starci uat record (scripts/uat/uat-record.mjs): run ${runId} walked ${record.id} in a real browser outside`,
    `# a Kernel workflow; every cited file is a blob of ${stores}.`,
    '',
  ].join('\n');
  const evidenceFile = path.join(record.dir, 'evidence.yaml');
  fs.writeFileSync(evidenceFile, header + stringifyYaml(evidence));
  return { outcome, evidenceFile, files: cited.length, curated: Boolean(example.root) };
}

function parseArgs(argv) {
  const split = argv.indexOf('--');
  const flags = split === -1 ? argv : argv.slice(0, split), command = split === -1 ? [] : argv.slice(split + 1);
  const value = (name) => { const i = flags.indexOf(`--${name}`); return i === -1 ? undefined : flags[i + 1]; };
  return { work: value('work'), flow: value('flow'), cwd: value('cwd'), environment: value('environment') ?? 'local', baseUrl: value('base-url'), command };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.work || !args.flow || !args.command.length) {
    console.error('use: starci uat record --work <.starciwork> --flow <uat.id> [--cwd <dir>] [--environment <slug>] [--base-url <url>] -- <Playwright command...>');
    return 2;
  }
  const here = invocationDir();
  try {
    const workRoot = path.resolve(here, args.work), cwd = path.resolve(here, args.cwd ?? path.dirname(workRoot));
    const record = flowRecord(workRoot, args.flow);
    const runId = newRunId(), capturedAt = new Date().toISOString();
    const runDir = path.join(tempRoot(), 'uat-record', runId);
    fs.mkdirSync(path.join(runDir, 'screens'), { recursive: true });
    fs.mkdirSync(path.join(runDir, 'videos'), { recursive: true });
    const env = { ...withSwcCache(process.env), UAT_RUN_DIR: runDir, UAT_RUN_ID: runId, UAT_FLOW: record.id };
    const { code, outputDir } = await walk(args.command, { cwd, env, runId });
    const flowName = record.id.split('.').pop();
    recordedVideos(outputDir).forEach((video, index, all) => fs.copyFileSync(video, path.join(runDir, 'videos', all.length === 1 ? `${flowName}.webm` : `${flowName}-${index + 1}.webm`)));
    const filed = fileRun({ workRoot, record, runId, runDir, exitCode: code, command: args.command, environment: args.environment, capturedAt, baseUrl: args.baseUrl });
    console.log(JSON.stringify({ run: runId, flow: record.id, exit: code, ...filed, evidenceFile: path.relative(here, filed.evidenceFile).replaceAll('\\', '/') }, null, 2));
    return filed.outcome === 'pass' ? 0 : 1;
  } catch (error) {
    if (error?.code?.startsWith?.('UAT_RECORD_')) { console.error(error.message); return 2; }
    throw error;
  }
}

if (isMain(import.meta.url)) process.exitCode = await main();
