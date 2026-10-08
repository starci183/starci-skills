// The evidence rules of the example Work standard (check-example-work.mjs): an evidence.yaml names the record
// beside it, stays current with that record's bytes and with the code its owners hold, and carries replayable
// commands.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { sha256File } from '../../../engine/digest.mjs';
import { resolveOwnedDirs, hashOwnedDirs, splitRef } from '../record-ownership.mjs';

/** sds id -> the done implementation records whose proves names it (trust concept 4). */
export function sdsProversOf(resolveMap) {
  const sdsProvers = new Map();
  for (const [implId, entry] of resolveMap) {
    if (entry.schema !== 'work/implementation@1' || entry.data?.state !== 'done') continue;
    for (const target of provenSdsIds(entry.data)) {
      if (!sdsProvers.has(target)) sdsProvers.set(target, []);
      sdsProvers.get(target).push(implId);
    }
  }
  return sdsProvers;
}

/** The sds ids a done implementation's `proves` names, in order (a ref that is not a string names none). */
function provenSdsIds(data) {
  const ids = [];
  for (const ref of Array.isArray(data.proves) ? data.proves : []) {
    const target = typeof ref === 'string' ? splitRef(ref.trim()).id : null;
    if (target?.startsWith('sds.')) ids.push(target);
  }
  return ids;
}

function checkRecordDigest({ problems }, { record, shown, siblingFile, sibling }) {
  if (fs.existsSync(siblingFile) && record.recordDigest) {
    const current = sha256File(siblingFile);
    if (current !== record.recordDigest && record.stale !== true) {
      problems.push(`${shown}: recordDigest ${record.recordDigest} no longer matches ${sibling.id}'s current digest ${current}; refused unless it carries stale: true`);
    }
  }
}

// ---- trust concept 1: codeDigest freshness ----
// A code change should be able to stale a proof without anyone editing the record. If capture-time
// codeDigest no longer matches what resolveOwnedDirs/hashOwnedDirs compute from the code on disk
// right now, the evidence is refused unless it already carries stale: true (the same escape valve
// recordDigest staleness above uses).
function checkCodeDigest({ problems, resolveMap, workspaceDoc, resolveRoot }, { record, shown, sibling }) {
  if (!record.codeDigest?.digest) return;
  const recEntry = resolveMap.get(record.record);
  if (!recEntry) return;
  const dirs = resolveOwnedDirs(record.record, recEntry, resolveMap, workspaceDoc, resolveRoot);
  const fresh = hashOwnedDirs(dirs);
  const freshDigest = fresh?.digest ?? null;
  if (freshDigest !== record.codeDigest.digest && record.stale !== true) {
    problems.push(`${shown}: codeDigest ${record.codeDigest.digest} no longer matches the code currently under ${sibling.id}'s owners/module (now ${freshDigest ?? '(no files found)'}); refused unless it carries stale: true [CODE_DIGEST_STALE]`);
  }
}

// ---- trust concept 2: replayable evidence ----
// Every assertion must carry the exact `command` that was run, not only a prose `observation`, so
// scripts/example/example-verify.mjs can re-run it later and compare outcomes. An assertion missing `command`
// is refused as not replayable.
function checkAssertionsReplayable({ problems }, { record, shown }) {
  for (const assertion of Array.isArray(record.assertions) ? record.assertions : []) {
    if (typeof assertion?.command !== 'string' || !assertion.command.trim()) {
      problems.push(`${shown}: assertion ${assertion?.id ?? '(unnamed)'} carries no command - evidence without a replayable command is refused [PROOF_NOT_REPLAYABLE]`);
    }
  }
}

function checkEvidenceFile(ctx, { record, shown, dir }) {
  const siblingFile = path.join(dir, 'index.yaml');
  const sibling = fs.existsSync(siblingFile) ? parseYaml(fs.readFileSync(siblingFile, 'utf8')) : null;
  if (record.record !== sibling?.id) {
    ctx.problems.push(`${shown}: evidence names ${record.record}, but the record beside it is ${sibling?.id}`);
    return;
  }
  checkRecordDigest(ctx, { record, shown, siblingFile, sibling });
  checkCodeDigest(ctx, { record, shown, sibling });
  checkAssertionsReplayable(ctx, { record, shown });
}

// ---- evidence: naming + staleness (concept: change/staleness) ----
export function checkEvidenceFiles(ctx) {
  for (const item of ctx.evidenceFiles) checkEvidenceFile(ctx, item);
}
