// draw-loop-settle.mjs — what api settle re-runs for an interface.draw pass (owner ruling 2026-09-27: the draw loop's
// machine metrics are re-run by the runtime at settle, never trusted as self-reported). Every ui record the pass binds
// (scripts/checks/draw-acceptance.mjs judges which) has each live part re-rendered from its render source and every
// machine metric re-run (scripts/work/draw-loop.mjs verifyRecordParts). A failure is DRAW_METRICS_FAILED, a metric
// the runtime could not run DRAW_METRICS_UNVERIFIED - both refuse the pass; the job is blocked with the remaining
// failures and its loop's best round.
import path from 'node:path';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { drawAcceptanceFindings } from '../checks/draw-acceptance.mjs';
import { livePartsOf } from '../checks/draw-loop-coverage.mjs';
import { verifyRecordParts } from './draw-loop.mjs';

/** The contract change that added the draw loop, the DNA gate and the taste metrics (modules/kernel/contract-changes.yaml). */
export const DRAW_LOOP_CHANGE = 'draw-loop-dna';

/** {findings, records, loops:[{loop, best, outcome}]} for the files a pass binds. `verify` is injectable (tests). */
export async function settleDrawMetricFindings({ repo, files, verify = verifyRecordParts }) {
  const { records } = drawAcceptanceFindings({ repo, files });
  const findings = [], loops = [];
  for (const rel of records) {
    const recordDir = path.dirname(path.resolve(repo, rel));
    let record = null;
    try { record = parseYaml(fs.readFileSync(path.join(recordDir, 'index.yaml'), 'utf8')); } catch { record = null; }
    if (!record) continue;
    const parts = livePartsOf(recordDir, record);
    if (!parts.length) continue;
    for (const p of parts) {
      const ref = p.asset.generation?.loop?.path;
      if (!ref || loops.some((l) => l.loop === ref)) continue;
      let loop = null;
      try { loop = JSON.parse(fs.readFileSync(path.resolve(recordDir, ref), 'utf8')); } catch { loop = null; }
      loops.push({ loop: ref, best: loop?.best ?? null, outcome: loop?.outcome ?? null });
    }
    const r = await verify({ recordDir, record, repo });
    findings.push(...r.findings);
  }
  return { findings, records, loops };
}
