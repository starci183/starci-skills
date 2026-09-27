// draw-loop-coverage.mjs — whether a drawn part came out of the draw loop (scripts/work/draw-loop.mjs, owner rulings
// 2026-09-27): every live part of a ui record carries generation.loop {path, round} naming the loop record
// (starci/draw-loop@1) that installed exactly its bytes. A part drawn outside the loop, or edited after the loop
// installed it, is DRAW_LOOP_MISSING (run by scripts/checks/draw-quality.mjs, so by api settle).
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/index.mjs';
import { assetsOf, list, slash } from '../work/work-io.mjs';

export const LOOP_SCHEMA = 'starci/draw-loop@1';
export const DRAW_LOOP_MISSING = 'DRAW_LOOP_MISSING';

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const shaOfFile = (f) => sha256(fs.readFileSync(f));

const PART_ROLES = new Set(['direction-content', 'direction']);
const viewportFromName = (file) => { const m = /--(\d{2,5})x(\d{2,5})--/.exec(path.basename(file)); return m ? { width: Number(m[1]), height: Number(m[2]) } : null; };

/** The live parts of a ui record: [{asset, png, html, viewport}] (composites are not parts). */
export function livePartsOf(recordDir, record) {
  return assetsOf(record).filter((a) => !a.retired && a.selected !== false && PART_ROLES.has(a.role) && a.generation?.tool === 'draw-render' && !a.composite && a.generation?.mode !== 'composite')
    .map((a) => {
      const png = path.resolve(recordDir, a.path);
      const html = png.replace(/\.(png|jpe?g|webp)$/i, '.html');
      const rec = readJson(png.replace(/\.png$/i, '.json'));
      const viewport = rec?.schema === 'starci/draw-render@1' ? { width: rec.viewport.width, height: rec.viewport.height } : viewportFromName(png);
      // A real-component part (owner ruling 2026-09-27): its draw source and fixture beside it (draw-loop finish).
      const source = png.replace(/\.(png|jpe?g|webp)$/i, '.draw.tsx'), fixture = png.replace(/\.(png|jpe?g|webp)$/i, '.fixture.json');
      return { asset: a, png, html: isFile(html) ? html : null, viewport, ...(isFile(source) ? { source, fixture: isFile(fixture) ? fixture : null } : {}) };
    });
}

/**
 * DRAW_LOOP_MISSING findings of a record: a live part whose generation.loop names no loop.json, or whose loop did not
 * install these bytes. [{code, path, detail}]
 */
export function loopCoverageFindings(recordDir, record, repo) {
  const out = [];
  for (const p of livePartsOf(recordDir, record)) {
    const at = slash(path.relative(repo, p.png));
    const ref = p.asset.generation?.loop;
    if (!ref?.path) { out.push({ code: DRAW_LOOP_MISSING, path: at, detail: `${p.asset.path} was not drawn through the draw loop (no generation.loop): node scripts/work/draw-loop.mjs round ... then finish, and record the asset entries it prints` }); continue; }
    const loop = readJson(path.resolve(recordDir, ref.path));
    if (loop?.schema !== LOOP_SCHEMA) { out.push({ code: DRAW_LOOP_MISSING, path: at, detail: `${p.asset.path} names the loop ${ref.path}, which is not a draw-loop record` }); continue; }
    let sha = null;
    try { sha = shaOfFile(p.png); } catch { sha = null; }
    if (!list(loop.installed).some((i) => i.sha256 === sha)) out.push({ code: DRAW_LOOP_MISSING, path: at, detail: `${p.asset.path} is not a part its loop ${ref.path} installed (finish installs the best round's parts; a part edited after is redrawn through the loop)` });
  }
  return out;
}
