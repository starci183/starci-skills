/**
 * ui.audit.privacy coverage completeness check (lane v7-9, 2026-09-19).
 *
 * Every (state, viewport) pair this record's `ui.coverage.map` declares must have a running-page
 * capture kept beside the frontend implementation node it derives - schemas/work-layout.yaml's
 * frontendCaptures note puts the PNG and its markup there, and
 * scripts/check-example-work.mjs's renderProofProblems only runs the canon checks over the files
 * impl.audit.todo-app-frontend.privacy's own `captures:` list names. A declared state with no
 * capture is an uncovered state, whatever the record's `state:` claims.
 *
 * This asserts presence and pairing only. It deliberately does not claim the captures pass the
 * brand+grammar canon: impl.audit.todo-app-frontend.privacy is not `done`, so
 * scripts/example-render-proof.mjs answers vacuously for it, and this node's screenshots predate
 * the v7-9 capture convention (they were taken without the grayscale-antialiasing flags, so
 * checks/render.mjs's palette-off-brand reads LCD fringes as brand colours). Proving this screen's
 * palette is the render lane's open item, recorded in ex-testing/lint/v7-9-REPORT.md.
 *
 * Exit 0 when every declared pair resolves to a PNG with its markup beside it; exit 1 naming each
 * pair that does not.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../../../../../../core/yaml.mjs';

const assetDir = path.dirname(fileURLToPath(import.meta.url));
const nodeDir = path.dirname(assetDir);
const workRoot = path.resolve(assetDir, '../../../../..');

const record = parseYaml(fs.readFileSync(path.join(nodeDir, 'index.yaml'), 'utf8'));
const implDir = path.join(workRoot, 'features/audit/impl/todo-app-frontend/privacy/assets');
const files = fs.existsSync(implDir) ? fs.readdirSync(implDir) : [];

const VIEWPORT_TOKENS = { 'desktop-1280': 'desktop-1280', 'mobile-390': 'mobile-390' };
const missing = [];
for (const entry of record.ui?.coverage?.map ?? []) {
  const viewport = VIEWPORT_TOKENS[entry.viewport] ?? entry.viewport;
  // This node names its captures privacy-<state>-<viewport>.png; the audit lane's own convention.
  const png = files.filter(name => name.endsWith('.png')
    && name.includes(entry.state) && (viewport === entry.viewport || name.includes(viewport)));
  if (!png.length) {
    missing.push(`${entry.state}/${entry.viewport}`);
    continue;
  }
  const unpaired = png.filter(name => !fs.existsSync(path.join(implDir, name.replace(/\.png$/i, '.html'))));
  if (unpaired.length) missing.push(`${entry.state}/${entry.viewport} markup absent for ${unpaired.join(', ')}`);
}

if (missing.length) {
  console.error(`FAIL ${record.id}: ${missing.length} declared coverage entr(ies) have no capture beside ${path.relative(workRoot, implDir).replaceAll('\\', '/')}`);
  for (const item of missing) console.error(`  - ${item}`);
  process.exit(1);
}
console.log(`PASS ${record.id}: all ${(record.ui?.coverage?.map ?? []).length} declared (state, viewport) pairs have a capture and its markup beside the frontend implementation node`);
