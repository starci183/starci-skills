// The per-record checks of check-work-deep.mjs: an authored provenBy, a composes path that is not there, a proof
// command that names nothing real, an unbound repository, an event nothing emits and a settled uat run older
// than the code it proves. Each rule is `(ctx, id, rec)` over the tree context built by checkTree.
import fs from 'node:fs';
import path from 'node:path';
import { log as gitLog } from '../../api/git/log.mjs';
import { gitOutputOf } from '../../lib/git.mjs';
import { repoRootFor, resolveOwnedDirs, moduleRootOf } from '../record-ownership.mjs';
import { walk } from './check-example-work.mjs';
import { fromRoot } from './work-consistency-shared.mjs';
import { eventClassOf, eventClasses, srcFiles } from './work-deep-surface-scan.mjs';

const PROOF_SPEC_PATH_PART = String.raw`(?<![\w./-])[\w./-]+`;
const PROOF_SPEC_KIND_PART = '(?:spec|e2e-spec|test)';
const proofSpecExpression = () => new RegExp(PROOF_SPEC_PATH_PART + String.raw`\.` + PROOF_SPEC_KIND_PART + String.raw`\.ts`, 'g');
const SPEC_TOKEN_FLAG_PREFIX = new RegExp(['^--', String.raw`\S+`, String.raw`\s+`].join(''));

/** The instant a work/evidence@1 run object was minted, from its id (`20260919T155312Z-5c10a673`); null when there is none. */
export function runTimeOf(run) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/.exec(run && typeof run === 'object' ? String(run.id ?? '') : '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

/** The files under `dirs` that a commit after `since` touched (repository-relative, unique); [] outside a Git work tree. */
function committedSince(cwd, since, dirs) {
  let out = '';
  try { out = gitOutputOf(gitLog([`--since=${since.toISOString()}`, '--format=', '--name-only', '--', ...dirs], { cwd })); } catch { return []; }
  return [...new Set(out.split(/\r?\n/).filter(Boolean))];
}

// PROVENBY_AUTHORED: provenBy is a derived field; an authored one is a claim speaking for another record
function checkProvenByAuthored({ recOf, refuse }, id, rec) {
  const data = rec.data ?? {};
  if (!data.provenBy) return;
  const indexFile = path.join(rec.dir, 'index.yaml');
  refuse(indexFile, 'PROVENBY_AUTHORED', `${id} carries a hand-authored provenBy - provenance is derived from done records' proves edges, never written down by hand`);
  const targets = Object.values(data.provenBy).flat().filter(t => typeof t === 'string');
  for (const t of targets) {
    const target = recOf(t);
    if (target && target.data?.state !== 'done') {
      refuse(indexFile, 'PROVENBY_TARGET_NOT_DONE', `${id} claims proof by ${t}, which is ${target.data?.state ?? '(no state)'} - a false proof claim`);
    }
  }
}

// COMPOSES_PATH_DANGLING: composes[].module is a path field the base gate never checks
function checkComposesPaths({ workRoot, refuse, suspect }, id, rec) {
  const data = rec.data ?? {};
  const indexFile = path.join(rec.dir, 'index.yaml');
  for (const c of Array.isArray(data.composes) ? data.composes : []) {
    if (!c || typeof c !== 'object' || !c.module) continue;
    // composes[].module is an owner path: app-relative, under the app root (OWNER_PATH_NOT_APP_RELATIVE otherwise).
    const abs = path.join(path.dirname(path.resolve(workRoot)), moduleRootOf(c.module));
    if (!fs.existsSync(abs)) {
      const msg = `${id} composes[].module names ${c.module}, which does not exist on disk`;
      if (data.state === 'done') refuse(indexFile, 'COMPOSES_PATH_DANGLING', msg); else suspect(indexFile, 'COMPOSES_PATH_DANGLING', msg);
    }
  }
}

// A proof command runs from the app root: its npm script is the app root package.json's, a spec path is
// app-relative (be/src/tests/...), and a bare spec basename is a jest pattern, not a path - searched over the
// sides, not resolved literally.
const specExists = ({ appRoot, sideRoots }, p) => p.includes('/')
  ? fs.existsSync(path.join(appRoot, p))
  : sideRoots.some(r => srcFiles(r, '.ts').some(f => path.basename(f) === p));

// jest-style filter args like `-- tasks/complete` should match a real spec dir/file prefix;
// separators vary (`tasks/complete` vs `task/task-lifecycle.e2e-spec.ts`), so normalise both to
// word sequences before comparing - still heuristic, which is why it is SUSPECT not REFUSE
function checkProofFilter({ beRoot, suspect }, { command, indexFile, label }) {
  const filter = /--\s+([\w/-]+)$/.exec(command)?.[1];
  if (!filter || filter.includes('*')) return;
  const testsRoot = path.join(beRoot, 'src', 'tests');
  const words = filter.toLowerCase().split(/[\s/.\\_-]+/).filter(Boolean);
  const hit = fs.existsSync(testsRoot) && walk(testsRoot).some(f => {
    const fwords = new Set(f.toLowerCase().replaceAll('\\', '/').split(/[\s/.\\_-]+/).filter(Boolean));
    return words.every(w => fwords.has(w));
  });
  if (!hit) suspect(indexFile, 'PROOF_FILTER_EMPTY', `${label}: filter "-- ${filter}" matches no spec under be/src/tests`);
}

function checkCommand(ctx, { command, file, label, indexFile }) {
  if (typeof command !== 'string') return;
  const { appScripts, refuse } = ctx;
  const npmRun = /npm run ([\w:-]+)/.exec(command);
  if (npmRun && appScripts?.[npmRun[1]] == null) {
    refuse(file, 'PROOF_COMMAND_DEAD', `${label}: npm script "${npmRun[1]}" does not exist in the app root package.json`);
  }
  for (const [token] of command.matchAll(proofSpecExpression())) {
    const p = token.replace(SPEC_TOKEN_FLAG_PREFIX, '');
    if (!specExists(ctx, p)) {
      refuse(file, 'PROOF_COMMAND_DEAD', `${label}: spec "${p}" matches no file of the app`);
    }
  }
  checkProofFilter(ctx, { command, indexFile, label });
}

// PROOF_COMMAND_DEAD: requiresProof + evidence assertion commands must name real specs/scripts.
// Only the commands that must run now are judged: every requiresProof.<kind>.command, and the assertion commands of
// evidence that is not `stale: true`. Stale evidence is a true statement about a past moment (work/evidence@1): its
// commands are history, never rewritten, and a fresh run replaces them.
function checkProofCommands(ctx, id, rec) {
  const data = rec.data ?? {};
  const indexFile = path.join(rec.dir, 'index.yaml');
  const proofKinds = data.requiresProof && typeof data.requiresProof === 'object' ? Object.entries(data.requiresProof) : [];
  for (const [kind, proof] of proofKinds) checkCommand(ctx, { command: proof?.command, file: indexFile, label: `requiresProof.${kind}`, indexFile });
  const evEntry = ctx.evidenceByRecord.get(id);
  const liveAssertions = evEntry?.ev?.stale === true ? [] : evEntry?.ev?.assertions;
  for (const a of Array.isArray(liveAssertions) ? liveAssertions : []) {
    checkCommand(ctx, { command: a?.command, file: evEntry.file, label: `assertion ${a?.id ?? '(unnamed)'}`, indexFile });
  }
}

// REPO_UNBOUND: a repository that is not a side workspace.yaml declares, or whose side folder is not there = evidence that will false-stale
function checkRepositoryBound({ workRoot, workspaceDoc, refuse }, id, rec) {
  const data = rec.data ?? {};
  if (!data.repository) return;
  const indexFile = path.join(rec.dir, 'index.yaml');
  const repoRoot = repoRootFor(workRoot, data.repository, workspaceDoc);
  if (!repoRoot) refuse(indexFile, 'REPO_UNBOUND', `${id} names repository "${data.repository}", which is not a side (be, fe) workspace.yaml declares - evidence under it will report (no files found), not the truth`);
  else if (!fs.existsSync(repoRoot)) refuse(indexFile, 'REPO_UNBOUND', `${id} names repository "${data.repository}" which resolves to ${fromRoot(repoRoot)} - nothing there; evidence under it will report (no files found), not the truth`);
}

// EVENT_PRODUCER_KIND + EVENT_UNPRODUCED
function checkEventRecord(ctx, id, rec) {
  const data = rec.data ?? {};
  if (data.schema !== 'work/event@1') return;
  const { recOf, suspect, beRoot } = ctx;
  const indexFile = path.join(rec.dir, 'index.yaml');
  const producer = recOf(data.producer);
  if (producer?.schema === 'work/business-rule@1') {
    suspect(indexFile, 'EVENT_PRODUCER_IS_RULE', `${id} producer is ${data.producer}, a business-rule - rules do not emit events; the real producer (handler/impl) has no record`);
  }
  const emitted = ctx.emittedEvents ??= eventClasses(beRoot);
  // the codebase names classes inconsistently (TaskDeletedEvent keeps the feature segment,
  // SignedInEvent drops it) - try the id's full class name and the feature-stripped one
  const withFeature = eventClassOf(id);
  const withoutFeature = eventClassOf(id.split('.').filter((s, i) => i !== 1).join('.'));
  if (!emitted.has(withFeature) && !emitted.has(withoutFeature)) {
    suspect(indexFile, 'EVENT_UNPRODUCED', `${id} maps to event class ${withFeature}/${withoutFeature}, neither declared under src/ - record may describe an event nothing emits`);
  }
}

// UAT_RUN_AGING: settled run older than the code it proves. The run is the work/evidence@1 run object (its files
// are blobs, never a runs/ directory); its time is the one its id was minted at, and the code's is its commit time.
function checkUatRunAging({ workRoot, records, workspaceDoc, appRoot, evidenceByRecord, suspect }, id, rec) {
  const data = rec.data ?? {};
  if (data.schema !== 'work/uat-flow@1' || data.state !== 'done') return;
  const runAt = runTimeOf(evidenceByRecord.get(id)?.ev?.run);
  if (!runAt) return;
  const dirs = resolveOwnedDirs(id, rec, records, workspaceDoc, workRoot).filter(d => fs.existsSync(d.abs));
  const newer = dirs.length ? committedSince(appRoot, runAt, dirs.map(d => d.abs)) : [];
  if (newer.length) suspect(path.join(rec.dir, 'index.yaml'), 'UAT_RUN_AGING', `${id}'s settled run predates ${newer.length} code file(s) committed since (e.g. ${newer[0]}) - the pass may no longer describe the code`);
}

/** The per-record rules in the order they run for each record. */
export const recordRules = [checkProvenByAuthored, checkComposesPaths, checkProofCommands, checkRepositoryBound, checkEventRecord, checkUatRunAging];
