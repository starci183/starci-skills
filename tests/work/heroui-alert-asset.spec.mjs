// Owner rulings 2026-09-27 (heroui-alert-asset): the Alert is the REAL HeroUI Alert (white bg-surface row, small toned
// glyph left of the title, title in the tone colour, the grammar Button secondary as its action - no tone fill, no
// IconTile: DRAW_ALERT_ANATOMY); a Meter track is the HeroUI h-2 (8px) track across the full width of its band, its
// segments equal with small gaps (DRAW_METER_TRACK); artwork is an interface.asset slot, never reused ad hoc
// (DRAW_ASSET_SLOT_UNDECLARED, scripts/work/asset-slot.mjs, starci kernel status assetSlotsOwed + an interface.asset nextAction);
// the Nivo seed direction records the owner's stated choices without accepting them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import {sha256} from '../../engine/digest.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import {
  DRAW_ALERT_ANATOMY, DRAW_OFF_GRAMMAR_COMPONENT, alertActionVariantFor, DRAW_ASSET_SLOT_UNDECLARED, DRAW_DNA_CODES, DRAW_METER_TRACK, anatomyFindings, dnaFindings, loadDna, surfaceBackground,
} from '../../scripts/work/draw/draw-dna.mjs';
import {
  ASSET_OP, ASSET_SLOT_FILLED, ASSET_SLOT_OWED, ASSET_SLOT_UNFILLED, assetRequestIdsFor, assetSlotsOf, openAssetSlots, readAssetRequests, recordAssetSlots, slotsOfHtml,
} from '../../scripts/work/asset-slot.mjs';
import { checkWorkTree } from '../../scripts/work/validate/check-example-work.mjs';
import { DEFAULT_RUBRIC } from '../../scripts/work/draw-critic.mjs';
import { directionReviewQuestion } from '../../scripts/work/brand-direction.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-alert-asset-')); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };
const codes = (list) => [...new Set(list.map((f) => f.code))].sort();
const kinds = (list, code) => list.filter((f) => f.code === code).map((f) => f.kind).sort();

/** The real HeroUI Alert as a drawing spells it: white surface, glyph left of the title, grammar Button secondary. */
const ALERT = (attrs = '', inner = null) => `<main data-grammar-component="PageContainer">
  <aside data-grammar-component="Alert" data-tone="warning" role="status"${attrs}>
    ${inner ?? `<span data-grammar-part="alert-indicator"><svg data-grammar-component="Icon"><path d="M0 0"/></svg></span>
    <div data-grammar-part="alert-content"><p data-grammar-part="alert-title">C\u1ea7n b\u1eadt tra c\u1ee9u</p><p data-grammar-part="alert-description">Sales Copilot thi\u1ebfu m\u1ed9t kh\u1ea3 n\u0103ng</p></div>
    <div data-grammar-part="alert-actions"><button data-grammar-component="Button" data-variant="secondary">B\u1eadt</button></div>`}
  </aside></main>`;

test('DRAW_ALERT_ANATOMY: the real HeroUI Alert passes; a tone fill, an IconTile, a late indicator or a hand-made action fails', () => {
  const dna = loadDna();
  assert.ok(DRAW_DNA_CODES.includes(DRAW_ALERT_ANATOMY));
  assert.deepEqual(dnaFindings(ALERT(), { dna }), [], 'white surface, glyph left of the title, Button secondary');
  assert.deepEqual(dnaFindings(ALERT(' style="background: var(--surface)"'), { dna }), [], 'the surface token is the Alert');
  // A tone fill, however it is declared.
  for (const fill of [' style="background-color: var(--warning-soft)"', ' class="bg-warning-soft"', ' style="background:#fff4e5"']) {
    assert.deepEqual(kinds(dnaFindings(ALERT(fill), { dna }), DRAW_ALERT_ANATOMY), ['tone-filled Alert'], fill);
  }
  const ruled = `<style>.notice{background:var(--warning-soft)}</style>${ALERT(' class="notice"')}`;
  assert.deepEqual(kinds(dnaFindings(ruled, { dna }), DRAW_ALERT_ANATOMY), ['tone-filled Alert'], 'a <style> rule on the Alert');
  assert.equal(surfaceBackground('white'), true);
  assert.equal(surfaceBackground('var(--danger)'), false);
  // An IconTile as the indicator (the r4/r5 "tile" notice).
  const tiled = ALERT('', `<span data-grammar-part="alert-indicator"><span data-grammar-component="IconTile" data-tone="warning" data-size="sm"><svg data-grammar-component="Icon"></svg></span></span>
    <div data-grammar-part="alert-content"><p data-grammar-part="alert-title">C\u1ea7n b\u1eadt</p></div>`);
  assert.deepEqual(kinds(dnaFindings(tiled, { dna }), DRAW_ALERT_ANATOMY), ['IconTile in an Alert']);
  const big = ALERT('', `<span data-grammar-part="alert-indicator" style="width:40px;height:40px"><svg data-grammar-component="Icon"></svg></span>
    <div data-grammar-part="alert-content"><p data-grammar-part="alert-title">C\u1ea7n b\u1eadt</p></div>`);
  assert.deepEqual(kinds(dnaFindings(big, { dna }), DRAW_ALERT_ANATOMY), ['Alert indicator as a tile']);
  // The indicator sits left of the title.
  const late = ALERT('', `<div data-grammar-part="alert-content"><p data-grammar-part="alert-title">C\u1ea7n b\u1eadt</p></div>
    <span data-grammar-part="alert-indicator"><svg data-grammar-component="Icon"></svg></span>`);
  assert.deepEqual(kinds(dnaFindings(late, { dna }), DRAW_ALERT_ANATOMY), ['Alert indicator not left of the title']);
  const bare = ALERT('', '<div data-grammar-part="alert-content"><p data-grammar-part="alert-title">C\u1ea7n b\u1eadt</p></div>');
  assert.deepEqual(kinds(dnaFindings(bare, { dna }), DRAW_ALERT_ANATOMY), ['Alert without its indicator']);
  // Its action is the grammar Button: a hand-made control or a variant off DNA fails; a secondary never does.
  const handmade = ALERT().replace('<button data-grammar-component="Button" data-variant="secondary">', '<button data-grammar-part="alert-actions" class="btn-warning">');
  assert.deepEqual(kinds(dnaFindings(handmade, { dna }), DRAW_ALERT_ANATOMY), ['hand-made Alert action']);
  const offDna = ALERT().replace('data-variant="secondary"', 'data-variant="warning-soft"');
  assert.deepEqual(kinds(dnaFindings(offDna, { dna }), DRAW_ALERT_ANATOMY), ['Alert action variant off DNA']);
  // Grammar 0.5.3: the action variant is the one the grammar Alert gives its tone (HeroUI's Alert examples):
  // informative/accent -> primary, negative/danger -> danger, every other tone -> secondary.
  const offTone = (tone, variant) => kinds(dnaFindings(ALERT().replace('data-tone="warning"', `data-tone="${tone}"`).replace('data-variant="secondary"', `data-variant="${variant}"`), { dna }), DRAW_ALERT_ANATOMY);
  for (const [tone, variant] of [['warning', 'secondary'], ['success', 'secondary'], ['neutral', 'secondary'], ['pending', 'secondary'], ['info', 'primary'], ['accent', 'primary'], ['informative', 'primary'], ['danger', 'danger'], ['negative', 'danger'], ['error', 'danger']]) {
    assert.deepEqual(offTone(tone, variant), [], `${tone} Alert with a ${variant} action`);
  }
  for (const [tone, variant] of [['warning', 'primary'], ['success', 'danger'], ['info', 'danger'], ['warning', 'danger'], ['danger', 'secondary'], ['accent', 'secondary'], ['warning', 'outline']]) {
    assert.deepEqual(offTone(tone, variant), ['Alert action variant off its tone'], `${tone} Alert with a ${variant} action`);
  }
  // The vendor class spells the variant when no data-variant does.
  const byClass = ALERT().replace('data-variant="secondary"', 'class="button button--primary"');
  assert.deepEqual(kinds(dnaFindings(byClass, { dna }), DRAW_ALERT_ANATOMY), ['Alert action variant off its tone']);
  assert.equal(alertActionVariantFor('cautionary'), 'secondary');
  assert.equal(alertActionVariantFor('informative'), 'primary');
  assert.equal(alertActionVariantFor('negative'), 'danger');
});

test('a status dot is the DNA Badge isDot dot (grammar 0.5.3): a hand-made dot or a haloed dot fails', () => {
  const dna = loadDna();
  assert.ok(dna.components.get('Badge').parts.has('badge-dot') && dna.components.get('Badge').parts.has('dot'), 'DNA Badge publishes its dot anatomy');
  const badge = (dot) => `<main data-grammar-component="PageContainer"><span data-grammar-component="Badge" data-tone="success">${dot}\u0110ang ch\u1ea1y</span></main>`;
  const DNA_DOT = '<svg data-grammar-part="badge-dot" class="starci-core-badge-dot" width="6" height="6" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8"/></svg>';
  assert.deepEqual(dnaFindings(badge(DNA_DOT), { dna }), [], 'the DNA dot passes');
  const kindsOf = (html) => dnaFindings(html, { dna }).filter((f) => f.code === DRAW_OFF_GRAMMAR_COMPONENT).map((f) => f.kind).sort();
  // A hand-made dot span (with or without a ring).
  assert.ok(kindsOf(badge('<span class="status-dot" style="width:6px;height:6px;border-radius:50%;background:currentColor"></span>')).length);
  assert.deepEqual(kindsOf(badge('<span data-grammar-part="alert-dot" class="dot"></span>')), ['hand-made status dot', 'unknown anatomy part']);
  // The DNA dot with a halo or ring, or off its 6px.
  assert.deepEqual(kindsOf(badge(DNA_DOT.replace('width="6"', 'style="box-shadow:0 0 0 3px rgba(0,160,0,.2)" width="6"'))), ['Badge dot with a halo']);
  assert.deepEqual(kindsOf(badge(DNA_DOT.replace('class="starci-core-badge-dot"', 'class="starci-core-badge-dot ring-2"'))), ['Badge dot with a halo']);
  assert.deepEqual(kindsOf(badge(DNA_DOT.replace('width="6" height="6"', 'width="10" height="10"'))), ['Badge dot off its size']);
  // A DNA dot outside a Badge is not a Badge dot.
  assert.deepEqual(kindsOf(`<main data-grammar-component="PageContainer"><p data-grammar-component="Text"><span data-grammar-part="dot"></span>Online</p></main>`).includes('hand-made status dot'), true);
});

test('DRAW_ALERT_ANATOMY on the capture: a rendered tone background, a tile-sized indicator or split tones fail', () => {
  const good = { alerts: [{ desc: 'aside', background: 'rgb(255, 255, 255)', surface: 'rgb(255, 255, 255)', indicator: { width: 24, height: 24 }, indicatorColor: 'rgb(150, 80, 0)', titleColor: 'rgb(150, 80, 0)' }], meters: [] };
  assert.deepEqual(anatomyFindings(good), []);
  assert.deepEqual(anatomyFindings({ alerts: [{ ...good.alerts[0], background: 'rgba(0, 0, 0, 0)', surface: 'rgba(0, 0, 0, 0)' }] }), [], 'no surface token, no fill: nothing to judge');
  const bad = anatomyFindings({ alerts: [{ ...good.alerts[0], background: 'rgb(255, 244, 229)', indicator: { width: 40, height: 40 }, tile: true, titleColor: 'rgb(20, 20, 20)' }] });
  assert.deepEqual(bad.map((f) => f.kind).sort(), ['IconTile in an Alert', 'indicator and title in different tones', 'tone-filled Alert', 'Alert indicator as a tile'].sort());
  assert.ok(bad.every((f) => f.code === DRAW_ALERT_ANATOMY));
});

test('DRAW_METER_TRACK: the h-2 track spans the full band; a stub, another height or unequal / gapped segments fail', () => {
  const dna = loadDna();
  const meter = (track = '', root = '') => `<main data-grammar-component="PageContainer"><div data-grammar-component="SurfaceCard">
    <div data-grammar-component="Meter" role="meter" aria-valuenow="2" aria-valuemax="3"${root}>
      <span data-grammar-part="meter-label">Kh\u1ea3 n\u0103ng</span><span data-grammar-part="meter-output">2/3</span>
      <div data-grammar-part="meter-track"${track}><div data-grammar-part="meter-fill"></div></div></div></div></main>`;
  assert.deepEqual(dnaFindings(meter(), { dna }), []);
  assert.deepEqual(dnaFindings(meter(' style="height:8px;width:100%"'), { dna }), [], 'h-2 at full width');
  assert.deepEqual(kinds(dnaFindings(meter(' style="height:4px"'), { dna }), DRAW_METER_TRACK), ['Meter track off its height']);
  // Grammar 0.5.2: the segmented Meter (DNA segments) track is h-1 (4px).
  const seg = (h) => meter(` style="height:${h}px"`).replace('<div data-grammar-part="meter-fill"></div>', '<span data-grammar-part="meter-segment"></span><span data-grammar-part="meter-segment"></span><span data-grammar-part="meter-segment"></span>')
    .replace('data-grammar-component="Meter"', 'data-grammar-component="Meter" data-segments="3"');
  assert.deepEqual(dnaFindings(seg(4), { dna }), [], 'DNA Meter segments on its h-1 track, no proposal needed');
  assert.deepEqual(kinds(dnaFindings(seg(8), { dna }), DRAW_METER_TRACK), ['Meter track off its height']);
  assert.deepEqual(kinds(dnaFindings(meter('', ' style="width:120px"'), { dna }), DRAW_METER_TRACK), ['Meter as a stub']);
  assert.deepEqual(kinds(dnaFindings(`<style>.cap [data-grammar-part="meter-track"]{max-width:96px}</style>${meter()}`, { dna }), DRAW_METER_TRACK), ['Meter as a stub'], 'a <style> rule');

  const full = { meters: [{ desc: 'div', segmented: true, track: { width: 500, height: 4 }, band: { width: 500 }, segments: [{ x: 0, width: 164 }, { x: 168, width: 164 }, { x: 336, width: 164 }] }] };
  assert.deepEqual(anatomyFindings(full), []);
  const stub = anatomyFindings({ meters: [{ desc: 'div', track: { width: 120, height: 6 }, band: { width: 500 }, segments: [] }] });
  assert.deepEqual(stub.map((f) => f.kind).sort(), ['Meter as a stub', 'Meter track off its height']);
  const uneven = anatomyFindings({ meters: [{ desc: 'div', segmented: true, track: { width: 500, height: 4 }, band: { width: 500 }, segments: [{ x: 0, width: 100 }, { x: 140, width: 60 }] }] });
  assert.deepEqual(uneven.map((f) => f.kind).sort(), ['Meter segments do not fill the track', 'unequal Meter segments']);
  assert.ok([...stub, ...uneven].every((f) => f.code === DRAW_METER_TRACK));
});

test('DRAW_ASSET_SLOT_UNDECLARED: artwork is a requested data-asset-slot, never a reused file', (t) => {
  const dna = loadDna();
  const art = (attrs) => `<main data-grammar-component="PageContainer"><div data-grammar-component="MediaFrame"${attrs}><img data-grammar-part="media-frame" src="../../brand/assets/mascot.png" alt=""></div></main>`;
  assert.deepEqual(kinds(dnaFindings(art(''), { dna }), DRAW_ASSET_SLOT_UNDECLARED), ['artwork without an asset slot']);
  assert.deepEqual(kinds(dnaFindings('<main data-grammar-component="PageContainer"><img data-grammar-component="Image" src="hero.webp" alt=""></main>', { dna }), DRAW_ASSET_SLOT_UNDECLARED), ['artwork without an asset slot']);
  assert.deepEqual(dnaFindings(art(' data-asset-slot="overview-mascot"'), { dna }).filter((f) => f.code === DRAW_ASSET_SLOT_UNDECLARED), [], 'without a request set the slot alone is judged');
  assert.deepEqual(kinds(dnaFindings(art(' data-asset-slot="overview-mascot"'), { dna, assetRequests: new Set() }), DRAW_ASSET_SLOT_UNDECLARED), ['asset slot without a request']);
  assert.deepEqual(dnaFindings(art(' data-asset-slot="overview-mascot"'), { dna, assetRequests: new Set(['overview-mascot']) }).filter((f) => f.code === DRAW_ASSET_SLOT_UNDECLARED), []);
  // Icons and avatars are not artwork.
  assert.deepEqual(dnaFindings('<main data-grammar-component="PageContainer"><span data-grammar-component="Avatar"><img data-grammar-part="avatar-image" src="a.png" alt=""></span></main>', { dna }).filter((f) => f.code === DRAW_ASSET_SLOT_UNDECLARED), []);

  const dir = tmp(t);
  fs.writeFileSync(path.join(dir, 'asset-request.md'), '# Asset requests\n\n## `overview-mascot`\nThe Nivo mascot, 360x240 png, right of the overview band, brand/assets/mascot master.\n\n## hero-illustration\nslot: empty-first-run\n');
  const reqs = readAssetRequests([path.join(dir, 'asset-request.md')]);
  assert.deepEqual(reqs.map((r) => r.id), ['overview-mascot', 'hero-illustration', 'empty-first-run']);
  assert.match(reqs[0].brief, /360x240/);
  fs.writeFileSync(path.join(dir, 'screen.html'), '<p></p>');
  assert.deepEqual([...assetRequestIdsFor(path.join(dir, 'screen.html'))].sort(), ['empty-first-run', 'hero-illustration', 'overview-mascot']);
});

test('asset slots: a placeholder is owed until data-asset-sha256 names the bytes of its src; the ledger folds owed and filled', (t) => {
  const repo = tmp(t);
  const ui = path.join(repo, '.starciwork', 'features', 'modules', 'ui', 'dashboard');
  const dirs = path.join(ui, 'assets', 'directions');
  fs.mkdirSync(path.join(dirs, 'draw-loop', 'Dash--ready', 'round-1'), { recursive: true });
  fs.writeFileSync(path.join(ui, 'index.yaml'), 'schema: work/ui-screen@1\n');
  fs.writeFileSync(path.join(dirs, 'asset-request.md'), '## overview-mascot\nThe mascot at right of the ink band.\n');
  const placeholder = '<main data-grammar-component="PageContainer"><div data-grammar-component="MediaFrame" data-asset-slot="overview-mascot"><img data-grammar-part="media-frame" src="placeholder.svg" alt=""></div></main>';
  fs.writeFileSync(path.join(dirs, 'Dash#ready--desktop--light.html'), placeholder);
  fs.writeFileSync(path.join(dirs, 'draw-loop', 'Dash--ready', 'round-1', 'source.html'), placeholder.replace('overview-mascot', 'stale-round-slot'));
  assert.deepEqual(slotsOfHtml(placeholder).map((s) => [s.id, s.src, s.filled]), [['overview-mascot', 'placeholder.svg', false]]);
  let slots = assetSlotsOf([ui], { repo });
  assert.deepEqual(slots.map((s) => [s.key, s.requested, s.filled]), [['.starciwork/features/modules/ui/dashboard#overview-mascot', true, false]], 'draw-loop rounds are not the record\'s slots');

  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, entity_type TEXT, entity_id TEXT, kind TEXT, payload_json TEXT, created_at INTEGER)');
  const ledger = { db, appendEvent: ({ workflowId, entityType, entityId, kind, payload, createdAt }) => db.prepare('INSERT INTO events(workflow_id,entity_type,entity_id,kind,payload_json,created_at) VALUES (?,?,?,?,?,?)').run(workflowId, entityType, entityId, kind, JSON.stringify(payload), createdAt) };
  const draw = { workflow_id: 'wf', job_id: 'op-interface.draw-1', op_id: 'interface.draw', attempt: 1 };
  assert.equal(recordAssetSlots(ledger, { job: draw, repo, files: [ui] }).owed.length, 1);
  assert.equal(recordAssetSlots(ledger, { job: draw, repo, files: [ui] }).owed.length, 0, 'once per job and bytes');
  assert.deepEqual(openAssetSlots(db, 'wf').map((s) => [s.id, s.jobId, s.requested]), [['overview-mascot', 'op-interface.draw-1', true]]);

  // The landing's unicorn master may stand in as the placeholder, but its bytes never fill a product slot.
  const master = Buffer.from('89504e47-landing-unicorn');
  fs.mkdirSync(path.join(repo, '.starciwork', 'brand', 'assets', 'mascot'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.starciwork', 'brand', 'index.yaml'), 'schema: work/brand@1\n');
  fs.writeFileSync(path.join(repo, '.starciwork', 'brand', 'assets', 'mascot', 'unicorn.png'), master);
  fs.writeFileSync(path.join(dirs, 'unicorn-copy.png'), master);
  fs.writeFileSync(path.join(dirs, 'unicorn-copy.prompt.txt'), 'copied');
  fs.writeFileSync(path.join(dirs, 'Dash#ready--desktop--light.html'), placeholder.replace('src="placeholder.svg"', `src="unicorn-copy.png" data-asset-sha256="${sha256(master)}"`));
  slots = assetSlotsOf([ui], { repo });
  assert.deepEqual([slots[0].filled, slots[0].master], [false, true], 'the bytes of a master are the landing art, never a product slot');
  // interface.asset fills it with a NEW generation: src the produced file, data-asset-sha256 its bytes, its prompt.
  const png = Buffer.from('89504e47-mascot-new-pose');
  fs.writeFileSync(path.join(dirs, 'overview-mascot.png'), png);
  const wrong = placeholder.replace('src="placeholder.svg"', `src="overview-mascot.png" data-asset-sha256="${'0'.repeat(64)}"`);
  fs.writeFileSync(path.join(dirs, 'Dash#ready--desktop--light.html'), wrong);
  assert.equal(assetSlotsOf([ui], { repo })[0].filled, false, 'a sha that is not the bytes is still owed');
  fs.writeFileSync(path.join(dirs, 'Dash#ready--desktop--light.html'), placeholder.replace('src="placeholder.svg"', `src="overview-mascot.png" data-asset-sha256="${sha256(png)}"`));
  assert.equal(assetSlotsOf([ui], { repo })[0].filled, false, 'no prompt: not an interface.asset generation');
  fs.writeFileSync(path.join(dirs, 'overview-mascot.prompt.txt'), 'the Nivo unicorn, new pose for the overview band');
  slots = assetSlotsOf([ui], { repo });
  assert.equal(slots[0].filled, true);
  assert.match(slots[0].prompt, /overview-mascot\.prompt\.txt$/);
  const asset = { workflow_id: 'wf', job_id: 'op-interface.asset-1', op_id: ASSET_OP, attempt: 1 };
  assert.equal(recordAssetSlots(ledger, { job: asset, repo, files: [ui] }).filled.length, 1);
  assert.deepEqual(openAssetSlots(db, 'wf'), []);
  assert.deepEqual(db.prepare('SELECT kind FROM events ORDER BY seq').all().map((r) => r.kind), [ASSET_SLOT_OWED, ASSET_SLOT_FILLED]);
});

test('a done ui record with an owed artwork slot is refused ASSET_SLOT_UNFILLED', (t) => {
  const repo = tmp(t);
  const work = path.join(repo, '.starciwork');
  const ui = path.join(work, 'features', 'modules', 'ui', 'dashboard');
  fs.mkdirSync(path.join(ui, 'assets', 'directions'), { recursive: true });
  fs.writeFileSync(path.join(ui, 'index.yaml'), 'schema: work/ui-screen@1\nid: ui.modules.dashboard\nkind: ui\nstate: done\n');
  fs.writeFileSync(path.join(ui, 'assets', 'directions', 'asset-request.md'), '## overview-mascot\nthe mascot\n');
  fs.writeFileSync(path.join(ui, 'assets', 'directions', 'Dash#ready--desktop--light.html'),
    '<main data-grammar-component="PageContainer"><div data-grammar-component="MediaFrame" data-asset-slot="overview-mascot"><img src="placeholder.svg" alt=""></div></main>');
  const problems = [];
  checkWorkTree(work, problems, []);
  const owed = problems.filter((p) => p.includes(`[${ASSET_SLOT_UNFILLED}]`));
  assert.equal(owed.length, 1, problems.join('\n'));
  assert.match(owed[0], /overview-mascot.*placeholder/);
});

test('starci kernel status lists assetSlotsOwed and proposes an interface.asset leg for them', async (t) => {
  const { openLedger, ledgerFileFor } = await import('../../engine/db/ledger.mjs');
  const repo = tmp(t);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.ensureWorkflow({ workflowId: 'wf-art', title: 'art' });
    ledger.appendEvent({ workflowId: 'wf-art', entityType: 'job', entityId: 'op-interface.draw-1', kind: ASSET_SLOT_OWED, createdAt: Date.now(),
      payload: { key: '.starciwork/features/modules/ui/dashboard#overview-mascot', id: 'overview-mascot', ui: '.starciwork/features/modules/ui/dashboard', html: 'x.html', requested: true, jobId: 'op-interface.draw-1', opId: 'interface.draw' } });
  } finally { ledger.close(); }
  const st = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'kernel', 'cli.mjs'), 'status', '--repo', repo, '--workflow', 'wf-art', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(st.status, 0, st.stderr);
  const body = JSON.parse(st.stdout);
  assert.deepEqual(body.assetSlotsOwed.map((s) => [s.id, s.jobId]), [['overview-mascot', 'op-interface.draw-1']]);
  const action = body.nextActions.find((a) => a.op === ASSET_OP);
  assert.ok(action, JSON.stringify(body.nextActions));
  assert.equal(action.kind, 'dispatch');
  assert.deepEqual(action.slots, ['.starciwork/features/modules/ui/dashboard#overview-mascot']);
  assert.match(action.reason, /starci kernel enqueue --op interface\.asset --paths \.starciwork\/features\/modules\/ui\/dashboard/);
});

test('the runtime text says the real HeroUI Alert everywhere: no "tone fill", secondary Button, full-width h-2 Meter, asset slots', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  for (const p of ['knowledge/ui/examples/brand-direction.example.yaml', 'modules/ops/ops/interface.draw.yaml', 'scripts/work/draw-critic.mjs', 'knowledge/ui/composition/accent.yaml']) {
    assert.doesNotMatch(read(p).replace(/wrongly said "tone fill"/, ''), /Alert[^\n]{0,80}tone fill|tone fill[^\n]{0,40}Alert/i, p);
  }
  const g2 = DEFAULT_RUBRIC.checks.find((c) => c.id === 'G2').test;
  assert.match(g2, /white surface/);
  assert.match(g2, /secondary Button/);
  assert.match(DEFAULT_RUBRIC.checks.find((c) => c.id === 'T3').test, /h-2 \(8px\) track spanning the full width.*h-1 \(4px\)/);
  const draw = read('modules/ops/ops/interface.draw.yaml');
  for (const code of [DRAW_ALERT_ANATOMY, DRAW_METER_TRACK, DRAW_ASSET_SLOT_UNDECLARED, 'assetSlotsOwed', 'asset-request.md']) assert.ok(draw.includes(code), code);
  const asset = parseYaml(read('modules/ops/ops/interface.asset.yaml'));
  assert.ok(asset.writes.some((w) => w.id === 'placeholder'), 'interface.asset fills the drawing\'s placeholder');
  assert.match(JSON.stringify(asset), /promptRules/);
  const accent = parseYaml(read('knowledge/ui/composition/accent.yaml'));
  assert.match(accent.rules.find((r) => r.id === 'ACCENT-5').cases.find((c) => c.id === 'case-5').assert, /never fills the Alert's background/);
});

test('the Nivo seed records the owner\'s stated choices without accepting them', () => {
  const direction = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'ui', 'examples', 'brand-direction.example.yaml'), 'utf8')).direction;
  const main = direction.pendingRulings.find((r) => r.id === 'main-colour');
  assert.equal(main.status, 'ruled', 'the owner ruled the main colour on 2026-09-27');
  assert.match(main.ruling, /#040d1c/);
  assert.match(main.receipt, /owner/);
  assert.equal(direction.archetypes.dashboard.status, 'proposed');
  const notes = direction.archetypes.dashboard.notes.join(' ');
  for (const w of ['r5 devin', 'r5 claude', 'eyebrow', 'tabular', 'real HeroUI Alert', '#040d1c', 'red #e3001f only for artwork and danger', '--background', 'IconTile = neutral', 'segments', 'pending formal acceptance']) assert.ok(notes.includes(w), w);
  assert.match(direction.vocabulary.notice.recipe, /Alert action = grammar Button variant by tone \(accent→primary, danger→danger, else secondary\)/);
  assert.doesNotMatch(direction.vocabulary.notice.recipe, /tone fill/);
  assert.match(direction.vocabulary.meter.recipe, /h-2 \(8px\), spanning the full width/);
  assert.match(direction.vocabulary.meter.recipe, /h-1 \(4px\)/);
  assert.match(direction.vocabulary.signatureBand.recipe, /interface\.asset/);
  assert.deepEqual(direction.golden, []);
});

test('the brand-direction-review ask carries the owner\'s stated choice beside the open ruling', (t) => {
  const root = tmp(t);
  const brandDir = path.join(root, '.starciwork', 'brand');
  fs.mkdirSync(path.join(brandDir, 'assets'), { recursive: true });
  const direction = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'ui', 'examples', 'brand-direction.example.yaml'), 'utf8')).direction;
  const png = Buffer.from('png-dashboard');
  fs.writeFileSync(path.join(brandDir, 'assets', 'dash.png'), png);
  direction.golden = [{ archetype: 'dashboard', html: 'assets/dash.html', png: 'assets/dash.png', sha256: sha256(png), breakpoint: 'desktop' }];
  fs.writeFileSync(path.join(brandDir, 'assets', 'dash.html'), '<main></main>');
  fs.writeFileSync(path.join(brandDir, 'index.yaml'), JSON.stringify({ schema: 'work/brand@1', id: 'brand', kind: 'brand', state: 'todo', rev: 1, brand: { identity: { name: 'Nivo', family: 'starci' }, direction } }));
  const q = directionReviewQuestion(path.join(root, '.starciwork'), { archetype: 'dashboard' });
  assert.doesNotMatch(q.text, /owner stated: black/);
  assert.equal(q.recommended, undefined, 'never auto-accepted');
});
