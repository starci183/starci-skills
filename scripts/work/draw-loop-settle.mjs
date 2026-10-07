// draw-loop-settle.mjs — what starci kernel settle re-runs for an interface.draw pass (owner ruling 2026-09-27: the draw loop's
// machine metrics are re-run by the runtime at settle, never trusted as self-reported). Every ui record the pass binds
// (scripts/work/draw/draw-acceptance.mjs judges which) has each live part re-rendered from its render source and every
// machine metric re-run (scripts/work/draw-loop.mjs verifyRecordParts). A failure is DRAW_METRICS_FAILED, a metric
// the runtime could not run DRAW_METRICS_UNVERIFIED - both refuse the pass; the job is blocked with the remaining
// failures and its loop's best round. An owner note the redraw does not address is DRAW_FEEDBACK_UNADDRESSED
// (scripts/work/draw-feedback.mjs): the part not redrawn, the note not in its brief, or the critic not passing it.
import path from 'node:path';
import { livePartsOf, loopFileOfRef, loopLabelOf } from './draw/draw-loop-coverage.mjs';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { drawAcceptanceFindings } from './draw/draw-acceptance.mjs';
import { verifyRecordParts } from './draw-loop.mjs';
import { feedbackFindings } from './draw-feedback.mjs';
import { eachInOrder } from '../lib/in-order.mjs';


function addUniqueLoops(parts, loops) {
  for (const part of parts) {
    const ref = loopLabelOf(part.asset.generation?.loop);
    if (!ref || loops.some((loop) => loop.loop === ref)) continue;
    let loop = null;
    try { loop = JSON.parse(fs.readFileSync(loopFileOfRef(part.asset.generation?.loop), 'utf8')); } catch { loop = null; }
    loops.push({ loop: ref, best: loop?.best ?? null, outcome: loop?.outcome ?? null });
  }
}

function settleRecordContext(repo, rel, loops) {
  const recordDir = path.dirname(path.resolve(repo, rel));
  let record = null;
  try { record = parseYaml(fs.readFileSync(path.join(recordDir, 'index.yaml'), 'utf8')); } catch { record = null; }
  if (!record) return null;
  const parts = livePartsOf(recordDir, record);
  if (!parts.length) return null;
  addUniqueLoops(parts, loops);
  return { recordDir, record };
}

function addFeedbackFindings(findings, repo, recordDir, record) {
  for (const finding of feedbackFindings(recordDir, record)) findings.push({ code: finding.code, path: path.relative(repo, recordDir).split(path.sep).join('/'), detail: finding.detail, note: finding.note });
}

/** {findings, records, loops:[{loop, best, outcome}]} for the files a pass binds. `verify` is injectable (tests). */
export async function settleDrawMetricFindings({ repo, files, verify = verifyRecordParts }) {
  const { records } = drawAcceptanceFindings({ repo, files });
  const findings = [], loops = [];
  await eachInOrder(records, async (rel) => {
    const context = settleRecordContext(repo, rel, loops);
    if (!context) return;
    const r = await verify({ ...context, repo });
    findings.push(...r.findings);
    // The owner's open notes (draw-feedback.mjs): a redraw that does not address one is DRAW_FEEDBACK_UNADDRESSED.
    addFeedbackFindings(findings, repo, context.recordDir, context.record);
  });
  return { findings, records, loops };
}
