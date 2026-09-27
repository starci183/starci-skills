// Owner rulings 2026-09-27 (draw = codex, content region only, HeroUI/Grammar defaults first, ONLY grammar DNA
// components, anything DNA lacks is a grammar proposal, draw -> shoot -> evaluate -> fix up to 10 rounds until every
// metric passes, the owner gives the final acceptance): the DNA gate (draw-dna.mjs), the taste metrics
// (draw-taste.mjs), grammar proposals (grammar-proposal.mjs), the draw loop and its independent critic
// (draw-loop.mjs, draw-critic.mjs), the settle re-run (draw-loop-settle.mjs), ui.archetype and the direction
// prerequisite (ui-archetype.mjs, prerequisites.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sha256 } from '../engine/index.mjs';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { allocationSettings } from '../engine/config.mjs';
import { blankImage, drawOver, encodePng } from '../scripts/work/png.mjs';
import {
  DRAW_NOTICE_NOT_ALERT, DRAW_OFF_GRAMMAR_COMPONENT, DRAW_RATIO_NOT_METER, dnaFindings, loadDna, parseHtml, presentationStateOf, proposalNamesIn, walkElements,
} from '../scripts/checks/draw-dna.mjs';
import {
  DRAW_ACCENT_BUDGET, DRAW_TOO_MANY_BADGES, DRAW_TOO_MANY_BANDS, accentBudgetOf, accentOf, accentShareOf, drawLoopSettings, htmlTasteFindings,
} from '../scripts/checks/draw-taste.mjs';
import { parseColor } from '../scripts/checks/brand.mjs';
import { GRAMMAR_PROPOSAL_FILED, GRAMMAR_PROPOSAL_RESOLVED, openGrammarProposals, readProposals, recordGrammarProposals } from '../scripts/work/grammar-proposal.mjs';
import {
  DRAW_LOOP_MISSING, DRAW_METRICS_FAILED, DRAW_METRICS_UNVERIFIED, STOP, bestRound, finishLoop, loopCoverageFindings, progressed, readLoop, runRound, stopOf, verifyRecordParts,
} from '../scripts/work/draw-loop.mjs';
import { DEFAULT_RUBRIC, criticArgv, normaliseVerdict, parseVerdict, rubricFor, runCritic } from '../scripts/work/draw-critic.mjs';
import { settleDrawMetricFindings, DRAW_LOOP_CHANGE } from '../scripts/work/draw-loop-settle.mjs';
import { ARCHETYPES, archetypeOf, directionReadiness } from '../scripts/work/ui-archetype.mjs';
import { DIRECTION_ARCHETYPES } from '../scripts/checks/brand.mjs';
import { checkPrerequisites, directionPrerequisiteOn, directionVerdicts } from '../scripts/kernel/prerequisites.mjs';
import { evidenceDirOf } from '../scripts/kernel/job-artifacts.mjs';
import { loadContractChanges } from '../scripts/kernel/contract-version.mjs';
import { drawQualityFindings } from '../scripts/checks/draw-quality.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-loop-')); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };
const codes = (list) => [...new Set(list.map((f) => f.code))].sort();
const WHITE = [255, 255, 255, 255], RED = [227, 0, 31, 255], INK = [4, 13, 28, 255];

/** A DNA-only drawing: an Alert with tone and actions, one Meter with its value, Buttons, a Badge. */
const GOOD = `<!doctype html><html><head><style>:root{--brand-red:#e3001f;--accent:var(--brand-red)}</style></head><body>
<main data-grammar-component="PageContainer">
  <h1 data-grammar-component="Heading">Mô-đun đã cài</h1>
  <div data-grammar-component="PageContainer">
    <aside data-grammar-component="Alert" data-tone="warning" role="status">
      <span data-grammar-part="alert-indicator"><svg data-grammar-component="Icon"><path d="M0 0"/></svg></span>
      <div data-grammar-part="alert-content"><p data-grammar-part="alert-title">Cần bật <strong>tra cứu</strong></p></div>
      <div data-grammar-part="alert-actions"><button data-grammar-component="Button" data-variant="primary">Bật</button></div>
    </aside>
  </div>
  <article data-grammar-component="SurfaceCard">
    <div data-grammar-component="Meter" role="meter" aria-valuenow="2" aria-valuemax="3">
      <span data-grammar-part="meter-label">Khả năng</span><span data-grammar-part="meter-output">2/3</span>
      <div data-grammar-part="meter-track"><div data-grammar-part="meter-fill"></div></div>
    </div>
    <span data-grammar-component="Badge" data-tone="success">Đang chạy</span>
    <button data-grammar-component="Button" data-variant="outline">Mở</button>
  </article>
</main></body></html>`;

test('the DNA gate: a DNA-only drawing passes; every element maps, names, parts and closed values are DNA', () => {
  const dna = loadDna();
  assert.ok(dna.components.size >= 90, 'the starci DNA publishes its renderers');
  assert.ok(dna.components.get('Alert').parts.has('alert-actions') && dna.components.get('Alert').parts.has('actions'));
  assert.deepEqual(dnaFindings(GOOD, { dna }), []);
  const bad = GOOD
    .replace('<h1 data-grammar-component="Heading">', '<h1>')
    .replace('data-grammar-component="SurfaceCard"', 'data-grammar-component="FancyCard"')
    .replace('data-grammar-part="meter-label"', 'data-grammar-part="meter-caption"')
    .replace('data-variant="outline"', 'data-variant="loud"')
    .replace('<span data-grammar-component="Badge"', '<span data-grammar-proposal="Badge.halo" data-grammar-component="Badge"');
  const found = dnaFindings(bad, { dna });
  assert.deepEqual(codes(found), [DRAW_OFF_GRAMMAR_COMPONENT]);
  assert.deepEqual(found.map((f) => f.kind).sort(), ['closed value off DNA', 'proposal without an entry', 'unknown DNA component', 'unknown anatomy part', 'unmapped element']);
  // A complete proposal entry is an entry.
  assert.equal(dnaFindings(bad, { dna, proposals: new Set(['Badge.halo']) }).some((f) => f.kind === 'proposal without an entry'), false);
  assert.equal(presentationStateOf('warning'), 'cautionary');
  assert.equal(presentationStateOf('purple'), null);
});

test('notices are Alert with a tone; a white card with an outcome IconTile posing as a notice fails', () => {
  const dna = loadDna();
  const untoned = GOOD.replace(' data-tone="warning" role="status"', '');
  assert.deepEqual(codes(dnaFindings(untoned, { dna })), [DRAW_NOTICE_NOT_ALERT]);
  const posing = `<main data-grammar-component="PageContainer"><article data-grammar-component="SurfaceCard">
    <span data-grammar-component="IconTile" data-tone="warning"><svg data-grammar-component="Icon"></svg></span>
    <p data-grammar-component="Text">Sales Copilot thiếu một khả năng</p>
    <button data-grammar-component="Button">Bật</button></article></main>`;
  const f = dnaFindings(posing, { dna });
  assert.deepEqual(codes(f), [DRAW_NOTICE_NOT_ALERT]);
  assert.match(f[0].detail, /warning-toned IconTile beside an action/);
  const box = '<main data-grammar-component="PageContainer"><div class="callout" data-grammar-component="SurfaceCopyGroup" role="alert"><p data-grammar-component="Text">Lỗi</p></div></main>';
  assert.deepEqual(codes(dnaFindings(box, { dna })), [DRAW_NOTICE_NOT_ALERT]);
  // A neutral entity card with an identity tile and actions is not a notice.
  assert.deepEqual(dnaFindings(posing.replace('data-tone="warning"', 'data-tone="neutral"'), { dna }), []);
});

test('ratios are one Meter: hand-made bars, Progress ratios, hand-segmented Meters and Meters without a value fail', () => {
  const dna = loadDna();
  const bar = '<main data-grammar-component="PageContainer"><div data-grammar-component="SurfaceCard"><p data-grammar-component="Text">Khả năng 2/3</p><div class="cap-bar" data-grammar-proposal="X"><div class="cap-fill" data-grammar-proposal="X"></div></div></div></main>';
  assert.ok(dnaFindings(bar, { dna, proposals: new Set(['X']) }).some((f) => f.code === DRAW_RATIO_NOT_METER && f.kind === 'hand-made bar'));
  const progress = '<main data-grammar-component="PageContainer"><div data-grammar-component="SurfaceCard"><span data-grammar-component="Text">3/3</span><div data-grammar-component="Progress" role="progressbar"></div></div></main>';
  assert.ok(dnaFindings(progress, { dna }).some((f) => f.kind === 'ratio as Progress'));
  // Grammar 0.5.2: DNA Meter segments - segments with the DNA anatomy are the Meter, no proposal needed.
  const segmented = GOOD.replace('<div data-grammar-part="meter-fill"></div>', '<span data-grammar-part="meter-segment"></span><span data-grammar-part="meter-segment"></span>')
    .replace('data-grammar-component="Meter"', 'data-grammar-component="Meter" data-segments="2"');
  assert.equal(dnaFindings(segmented, { dna }).some((f) => f.code === DRAW_RATIO_NOT_METER || f.code === DRAW_OFF_GRAMMAR_COMPONENT), false);
  const handCut = GOOD.replace('<div data-grammar-part="meter-fill"></div>', '<span data-grammar-part="meter-fill" class="cap-segment"></span><span data-grammar-part="meter-fill" class="cap-segment"></span>');
  assert.ok(dnaFindings(handCut, { dna }).some((f) => f.kind === 'hand-segmented Meter'));
  const valueless = GOOD.replace(' role="meter" aria-valuenow="2" aria-valuemax="3"', '');
  assert.ok(dnaFindings(valueless, { dna }).some((f) => f.kind === 'Meter without role=meter'));
});

test('the HTML reader keeps ancestry through void, raw-text and svg elements', () => {
  const tree = parseHtml('<div a="1"><br><style>p>b{}</style><svg><path d="x"/></svg><p>t<img src=x></p></div>');
  assert.deepEqual(walkElements(tree).map((e) => e.tag), ['div', 'br', 'style', 'svg', 'path', 'p', 'img']);
  assert.equal(walkElements(tree).find((e) => e.tag === 'img').parent.tag, 'p');
});

test('taste: bands per card, badges per entity, accent share of fills only, the art band exempt', () => {
  const settings = drawLoopSettings();
  assert.deepEqual(settings, allocationSettings().drawLoop, 'thresholds live in runtimes.yaml allocation.drawLoop only');
  const card = (bands) => `<article data-grammar-component="SurfaceCard">${Array.from({ length: bands }, (_, i) => `${i ? '<hr data-grammar-component="Divider">' : ''}<div class="band" data-grammar-part="surface-content"><p data-grammar-component="Text">x</p></div>`).join('')}</article>`;
  assert.deepEqual(htmlTasteFindings(`<main>${card(3)}</main>`, { settings }), []);
  assert.deepEqual(codes(htmlTasteFindings(`<main>${card(4)}</main>`, { settings })), [DRAW_TOO_MANY_BANDS]);
  const badges = (n) => `<article data-grammar-component="SurfaceCard">${'<span data-grammar-component="Badge" data-tone="success">ok</span>'.repeat(n)}</article>`;
  assert.deepEqual(htmlTasteFindings(badges(2), { settings }), []);
  assert.deepEqual(codes(htmlTasteFindings(badges(3), { settings })), [DRAW_TOO_MANY_BADGES]);
  // Rows of a list inside a card are their own entities.
  assert.deepEqual(htmlTasteFindings(`<article data-grammar-component="SurfaceCard"><ul>${`<li>${'<span class="badge" data-tone="success">a</span>'.repeat(2)}</li>`.repeat(3)}</ul></article>`, { settings }), []);

  const accent = parseColor('#e3001f');
  assert.equal(accentOf(GOOD).hex, '#e3001f', 'var() chains resolve');
  const img = blankImage(100, 100, WHITE);
  drawOver(img, blankImage(40, 40, RED), 0, 0); // a 16% fill
  for (let x = 50; x < 100; x += 3) drawOver(img, blankImage(1, 100, RED), x, 0); // 1px strokes: never a fill
  const share = accentShareOf(img, accent).share;
  assert.ok(Math.abs(share - 0.16) < 0.005, `the fill counts, the strokes do not (${share})`);
  assert.equal(accentShareOf(img, accent, { exempt: [{ x: 0, y: 0, width: 40, height: 40 }] }).share, 0, 'the brand art band is exempt');
});

test('accent budget over a part image reads the render record exemptions and the source accent', (t) => {
  const dir = tmp(t);
  const img = blankImage(100, 100, WHITE);
  drawOver(img, blankImage(40, 40, RED), 0, 0);
  const png = path.join(dir, 'B#s--100x100--light.png');
  fs.writeFileSync(png, encodePng(img));
  const settings = drawLoopSettings();
  assert.equal(accentBudgetOf(png, { html: GOOD, settings }).finding.code, DRAW_ACCENT_BUDGET);
  fs.writeFileSync(png.replace('.png', '.json'), JSON.stringify({ schema: 'starci/draw-render@1', viewport: { width: 50, height: 50, deviceScaleFactor: 2 }, layout: { accentExempt: [{ x: 0, y: 0, width: 20, height: 20 }] } }));
  assert.equal(accentBudgetOf(png, { html: GOOD, settings }).finding, null, 'the art band rect (CSS px x DPR) is exempt');
  assert.equal(accentBudgetOf(png, { html: '<main></main>', settings }).share, null, 'no accent declared: unmeasured, never guessed');
});

test('grammar proposals: complete entries in md and yaml; an incomplete one is no entry; filed and listed, never accepted', (t) => {
  const dir = tmp(t);
  fs.writeFileSync(path.join(dir, 'grammar-proposal.md'), [
    '# Grammar proposals', '', '## 1. `Meter` variant `segments` — `data-grammar-proposal="Meter.segments"`',
    '**Why:** DNA Meter has no segmented variant.', '**Anatomy:** one role=meter root, N presentational segments.', '**Tokens:** `--accent`, `--default`, 4px gap.',
    '**Claims:** A11Y-3, ACCENT-4.', '```html', '<div data-grammar-component="Meter"></div>', '```', '',
    '## 2. `PageContainer` slot `pinnedAction`', '**Why:** no DNA pinned slot.', '**Anatomy:** a bar.', '**Tokens:** --surface.', '**Claims:** UX-9.',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'grammar-proposal.yaml'), stringifyYaml({ schema: 'starci/grammar-proposal@1', proposals: [
    { name: 'ArtworkBand', gap: 'no decorative art slot', anatomy: ['band', 'art'], tokens: ['--accent'], claims: ['BRAND-2'], render: 'artwork-band.html' },
    { name: 'Half', gap: 'x' },
  ] }));
  const files = [path.join(dir, 'grammar-proposal.md'), path.join(dir, 'grammar-proposal.yaml')];
  const all = readProposals(files);
  assert.deepEqual(all.map((p) => [p.name, p.complete]), [['Meter.segments', true], ['PageContainer.pinnedAction', false], ['ArtworkBand', true], ['Half', false]]);
  assert.deepEqual(all.find((p) => p.name === 'PageContainer.pinnedAction').missing, ['render']);
  assert.deepEqual([...proposalNamesIn(files)].filter((n) => ['Meter.segments', 'ArtworkBand', 'PageContainer.pinnedAction', 'Half'].includes(n)).sort(), ['ArtworkBand', 'Meter.segments']);

  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, entity_type TEXT, entity_id TEXT, kind TEXT, payload_json TEXT, created_at INTEGER)');
  const ledger = { db, appendEvent: ({ workflowId, entityType, entityId, kind, payload, createdAt }) => db.prepare('INSERT INTO events(workflow_id,entity_type,entity_id,kind,payload_json,created_at) VALUES (?,?,?,?,?,?)').run(workflowId, entityType, entityId, kind, JSON.stringify(payload), createdAt) };
  const job = { workflow_id: 'wf-draw', job_id: 'op-interface.draw-1', op_id: 'interface.draw', attempt: 1 };
  const filed = recordGrammarProposals(ledger, { job, repo: dir, files: [dir] });
  assert.deepEqual(filed.map((p) => [p.name, p.status]), [['Meter.segments', 'proposed'], ['PageContainer.pinnedAction', 'proposed'], ['ArtworkBand', 'proposed'], ['Half', 'proposed']]);
  assert.equal(recordGrammarProposals(ledger, { job, repo: dir, files: [dir] }).length, 0, 'once per name and bytes');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM events WHERE kind=?').get(GRAMMAR_PROPOSAL_FILED).n, 4);
  ledger.appendEvent({ workflowId: 'wf-draw', entityType: 'grammar', entityId: 'Half', kind: GRAMMAR_PROPOSAL_RESOLVED, payload: { name: 'Half' }, createdAt: 2 });
  assert.deepEqual(openGrammarProposals(db, 'wf-draw').map((p) => `${p.name}:${p.status}`), ['Meter.segments:proposed', 'PageContainer.pinnedAction:proposed', 'ArtworkBand:proposed']);
});

test('the critic: the product rubric or the default, a verdict parsed and gate-capped, a clean read-only codex session', async (t) => {
  const work = path.join(tmp(t), '.starciwork');
  assert.equal(rubricFor({ workRoot: work }).source, 'default');
  fs.mkdirSync(path.join(work, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(work, 'brand', 'index.yaml'), stringifyYaml({ schema: 'work/brand@1', brand: { direction: { status: 'accepted',
    rubric: { checks: [{ id: 'P1', group: 'action', gate: true, test: 'One red thing to press', cites: ['composition/taste.yaml DISCIPLINE-3'] }, { id: 'P2', group: 'hierarchy', test: 'Summary first', cites: ['composition/hierarchy.yaml HIERARCHY-6'] }], gateCap: 5, beautyAnchors: [{ score: 8, anchor: 'all pass' }] },
    archetypes: { list: { status: 'accepted', order: ['header', 'summary'] } } } } }));
  const r = rubricFor({ workRoot: work, archetype: 'list' });
  assert.equal(r.source, 'brand.direction.rubric');
  assert.deepEqual(r.rubric.checks.map((c) => c.id), ['P1', 'P2']);
  assert.equal(r.rubric.archetype.name, 'list');
  const v = normaliseVerdict(parseVerdict('thinking...\n{"schema":"starci/draw-critique@1","checks":[{"id":"P1","pass":false,"evidence":"two red fills"}],"beauty":8}'), r.rubric);
  assert.deepEqual(v.failed, ['P1', 'P2'], 'a check the critic skipped fails');
  assert.equal(v.beauty, 5, 'a failed gate caps the beauty');
  const argv = criticArgv({ critic: { model: 'gpt-6-sol', effort: 'high' }, dir: 'C:/clean', images: [{ file: 'render-1.png' }], lastMessage: 'C:/clean/last.txt' });
  assert.deepEqual(argv.slice(0, 9), ['exec', '--skip-git-repo-check', '--ephemeral', '-C', 'C:/clean', '-s', 'read-only', '-m', 'gpt-6-sol']);
  assert.ok(argv.includes('model_reasoning_effort=high') && argv.includes('-i') && argv.at(-1) === '-');

  const dir = tmp(t);
  const png = path.join(dir, 'a.png');
  fs.writeFileSync(png, encodePng(blankImage(4, 4, WHITE)));
  fs.writeFileSync(path.join(dir, 'a.html'), GOOD);
  let seen = null;
  const critique = await runCritic({ images: [{ path: png, label: 'desktop' }], html: path.join(dir, 'a.html'), rubric: DEFAULT_RUBRIC, critic: allocationSettings().drawLoop.critic, tmpRoot: dir,
    runner: async ({ dir: clean, prompt }) => { seen = { files: fs.readdirSync(clean).sort(), prompt }; return { code: 0, lastMessage: JSON.stringify({ checks: DEFAULT_RUBRIC.checks.map((c) => ({ id: c.id, pass: true })), beauty: 9, anchor: '9' }) }; } });
  assert.deepEqual(seen.files, ['render-1.png', 'rubric.yaml', 'screen.html'], 'the critic sees only the PNGs, the HTML and the rubric');
  assert.match(seen.prompt, /did NOT draw this screen/);
  assert.equal(critique.verdict.beauty, 9);
  assert.equal(critique.critic.model, 'gpt-6-sol');
  assert.equal(critique.critic.promptSha256, sha256(critique.critic.prompt));
  assert.equal(critique.critic.independent, false, 'a stubbed runner is never recorded as the independent critic');
  assert.deepEqual(fs.readdirSync(dir).filter((n) => n.startsWith('starci-draw-critic-')), [], 'the clean dir is removed');
});

test('loop bookkeeping: progress, stop reasons and the best round', () => {
  const s = { maxRounds: 10, stallRounds: 2, beautyMin: 8 };
  const r = (n, failures, beauty, allPass = failures === 0) => ({ n, failures, beauty, allPass });
  assert.equal(progressed(r(2, 3, 6), [r(1, 4, 6)]), true);
  assert.equal(progressed(r(2, 4, 7), [r(1, 4, 6)]), true);
  assert.equal(progressed(r(2, 4, 6), [r(1, 4, 6)]), false);
  assert.equal(stopOf([{ ...r(1, 0, 8), progress: true }], s).reason, STOP.passed);
  assert.equal(stopOf([{ ...r(1, 0, 7), progress: true }], s), null, 'all metrics pass but beauty is under the bar');
  assert.equal(stopOf([{ ...r(1, 2, 6), progress: true }, { ...r(2, 2, 6), progress: false }, { ...r(3, 2, 6), progress: false }], s).reason, STOP.noProgress);
  assert.equal(stopOf(Array.from({ length: 10 }, (_, i) => ({ ...r(i + 1, 10 - i, 5), progress: true })), s).reason, STOP.maxRounds);
  assert.equal(bestRound([r(1, 3, 9), r(2, 0, 6), r(3, 0, 8), r(4, 1, 10)]).n, 3, 'all-pass first, then beauty');
});

/** A product with a ui record under .starciwork, a stub renderer and stub browser metrics. */
function product(t) {
  const repo = tmp(t);
  const ui = path.join(repo, '.starciwork', 'features', 'modules', 'ui', 'ledger');
  const directions = path.join(ui, 'assets', 'directions');
  fs.mkdirSync(directions, { recursive: true });
  fs.writeFileSync(path.join(ui, 'index.yaml'), stringifyYaml({ schema: 'work/ui-screen@1', id: 'ui.modules.ledger', title: 'Installed modules', surface: 'page', route: '/[locale]/(console)/modules',
    ui: { shapes: [{ base: 'LedgerBase', state: 'installed' }] }, assets: [] }));
  const source = path.join(directions, 'LedgerBase#installed.html');
  fs.writeFileSync(source, GOOD);
  const render = async ({ out, viewports, name }) => viewports.map((v) => {
    const img = blankImage(v.width, v.height, WHITE);
    drawOver(img, blankImage(10, 10, RED), 0, 0);
    const file = path.join(out, `${name}--${v.width}x${v.height}--light.png`);
    fs.writeFileSync(file, encodePng(img));
    const rec = { schema: 'starci/draw-render@1', ok: true, failures: [], viewport: { ...v, deviceScaleFactor: 1 }, image: { path: file, sha256: sha256(fs.readFileSync(file)) }, layout: { accentExempt: [] } };
    fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(rec));
    return rec;
  });
  const probes = { geometry: async () => ({ findings: [] }), score: async (html, viewport) => ({ schema: 'starci/ui-proof-score@1', htmlSha256: sha256(fs.readFileSync(html)), viewport, summary: { pass: 5, fail: 0, unmeasurable: 0 }, cases: [], spacing: [] }) };
  const critic = (beauty) => async () => ({ code: 0, lastMessage: JSON.stringify({ checks: DEFAULT_RUBRIC.checks.map((c) => ({ id: c.id, pass: true, evidence: 'ok' })), beauty }) });
  return { repo, ui, directions, source, render, probes, critic };
}
const VIEWPORTS = [{ width: 800, height: 60 }, { width: 390, height: 60 }];

test('a loop that never passes stops without progress and finishes blocked with the remaining failures and its best round', async (t) => {
  const p = product(t);
  fs.writeFileSync(p.source, GOOD.replace('<h1 data-grammar-component="Heading">', '<h1>'));
  const base = { ui: p.ui, html: p.source, base: 'LedgerBase', state: 'installed', viewports: VIEWPORTS, repo: p.repo, render: p.render, probes: p.probes };
  const r1 = await runRound({ ...base, criticRunner: p.critic(6) });
  assert.equal(r1.round.n, 1);
  assert.deepEqual(r1.round.codes, [DRAW_OFF_GRAMMAR_COMPONENT]);
  for (const f of ['source.html', 'metrics.json', 'critique.json', 'LedgerBase#installed--800x60--light.png', 'LedgerBase#installed--800x60--light.json', 'LedgerBase#installed--800x60--light.score.json']) {
    assert.ok(fs.existsSync(path.join(r1.out, 'round-1', f)), f);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(r1.out, 'round-1', 'critique.json'), 'utf8')).critic.model, 'gpt-6-sol');
  assert.throws(() => finishLoop({ out: r1.out }), /has not stopped/);
  await runRound({ ...base, criticRunner: p.critic(6) });
  const r3 = await runRound({ ...base, criticRunner: p.critic(6) });
  assert.equal(r3.stop.reason, STOP.noProgress);
  await assert.rejects(runRound({ ...base, criticRunner: p.critic(6) }), /stopped/);
  const done = finishLoop({ out: r3.out });
  assert.equal(done.outcome, 'blocked');
  assert.ok(done.remaining.some((f) => f.code === DRAW_OFF_GRAMMAR_COMPONENT));
  assert.ok(done.remaining.some((f) => f.code === 'DRAW_BEAUTY_BELOW'));
  assert.equal(readLoop(r3.out).outcome, 'blocked');
  assert.equal(evidenceDirOf(path.relative(p.repo, path.join(r3.out, 'round-2', 'metrics.json')).replace(/\\/g, '/')), path.relative(p.repo, r3.out).replace(/\\/g, '/'), 'the loop directory is an evidence directory: every round is indexed');
});

test('a passing loop installs its best round; the record binds generation.loop; settle re-measures every part itself', async (t) => {
  const p = product(t);
  const r = await runRound({ ui: p.ui, html: p.source, base: 'LedgerBase', state: 'installed', viewports: VIEWPORTS, repo: p.repo, render: p.render, probes: p.probes, criticRunner: p.critic(9) });
  assert.equal(r.stop.reason, STOP.passed);
  const done = finishLoop({ out: r.out });
  assert.equal(done.outcome, 'passed');
  assert.deepEqual(done.remaining, []);
  const parts = done.assets.filter((a) => a.role === 'direction-content');
  assert.deepEqual(parts.map((a) => [a.path, a.breakpoint]), [['assets/directions/LedgerBase#installed--800x60--light.png', 'desktop'], ['assets/directions/LedgerBase#installed--390x60--light.png', 'mobile']]);
  assert.deepEqual(parts[0].generation.loop, { path: 'assets/directions/draw-loop/LedgerBase--installed/loop.json', round: 1 });
  for (const ext of ['.png', '.json', '.html', '.score.json']) assert.ok(fs.existsSync(path.join(p.directions, `LedgerBase#installed--800x60--light${ext}`)), ext);

  const record = parseYaml(fs.readFileSync(path.join(p.ui, 'index.yaml'), 'utf8'));
  record.assets = done.assets;
  fs.writeFileSync(path.join(p.ui, 'index.yaml'), stringifyYaml(record));
  assert.deepEqual(loopCoverageFindings(p.ui, record, p.repo), []);
  const q = drawQualityFindings(p.ui, record, p.repo).map((f) => f.code);
  assert.deepEqual(q.filter((c) => c !== 'DRAW_NOT_OWNER_ACCEPTED'), [], 'DNA, taste, score and loop all hold on the installed parts');

  const verify = (extra) => (args) => verifyRecordParts({ ...args, render: p.render, probes: p.probes, ...extra });
  const files = [path.join(p.ui, 'index.yaml')];
  assert.deepEqual((await settleDrawMetricFindings({ repo: p.repo, files, verify: verify({}) })).findings, []);
  const failing = await settleDrawMetricFindings({ repo: p.repo, files, verify: verify({ probes: { ...p.probes, geometry: async () => ({ findings: [{ code: 'GEOMETRY_OFF_GRAMMAR', element: 'button', property: 'height', got: '36px', expected: '40px' }] }) } }) });
  assert.deepEqual(codes(failing.findings), [DRAW_METRICS_FAILED]);
  assert.deepEqual(failing.loops, [{ loop: 'assets/directions/draw-loop/LedgerBase--installed/loop.json', best: 1, outcome: 'passed' }]);
  const unverified = await settleDrawMetricFindings({ repo: p.repo, files, verify: verify({ probes: { geometry: async () => ({ error: 'no chromium' }), score: async () => ({ error: 'no chromium' }) } }) });
  assert.deepEqual(codes(unverified.findings), [DRAW_METRICS_UNVERIFIED], 'a metric the runtime cannot run fails closed');

  // A part edited after finish is no longer the loop's.
  fs.appendFileSync(path.join(p.directions, 'LedgerBase#installed--800x60--light.png'), 'x');
  assert.deepEqual(codes(loopCoverageFindings(p.ui, record, p.repo)), [DRAW_LOOP_MISSING]);
  delete record.assets[2].generation.loop;
  assert.equal(loopCoverageFindings(p.ui, record, p.repo).filter((f) => /no generation.loop/.test(f.detail)).length, 1);
});

test('ui.archetype: explicit wins, else derived; the direction prerequisite reads brand.direction and is off by default', (t) => {
  assert.deepEqual(archetypeOf({ ui: { archetype: 'dashboard' } }), { archetype: 'dashboard', derived: false, why: 'ui.archetype' });
  assert.equal(archetypeOf({ surface: 'layout' }).archetype, 'layout');
  assert.equal(archetypeOf({ surface: { desktop: 'drawer', mobile: 'modal' } }).archetype, 'form');
  assert.equal(archetypeOf({ route: '/[locale]/(console)/agentos/[id]' }).archetype, 'detail');
  assert.equal(archetypeOf({ route: '/[locale]/(console)/overview' }).archetype, 'dashboard');
  assert.equal(archetypeOf({ route: '/[locale]/(console)/onboarding/setup' }).archetype, 'wizard');
  assert.equal(archetypeOf({ route: '/[locale]/(console)/modules' }).archetype, 'list');
  assert.equal(archetypeOf({ ui: { archetype: 'empty' } }).archetype, 'empty');
  assert.deepEqual(ARCHETYPES, [...DIRECTION_ARCHETYPES, 'layout'], 'lane ui-discipline-brand names the archetypes');
  const repo = tmp(t);
  const rec = (name, doc) => { const d = path.join(repo, '.starciwork', 'features', 'f', 'ui', name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.yaml'), stringifyYaml(doc)); return `.starciwork/features/f/ui/${name}`; };
  const list = rec('modules', { schema: 'work/ui-screen@1', route: '/modules' });
  const layout = rec('app-layout', { schema: 'work/ui-screen@1', surface: 'layout' });
  const brand = path.join(repo, '.starciwork', 'brand');
  fs.mkdirSync(brand, { recursive: true });
  const brandRecord = (direction) => stringifyYaml({ schema: 'work/brand@1', id: 'brand', kind: 'brand', title: 'Brand', state: 'done', brand: { identity: { family: 'starci' }, direction } });
  assert.equal(directionReadiness(path.join(repo, '.starciwork'), 'list').ready, false, 'no brand record: not ready');
  fs.writeFileSync(path.join(brand, 'index.yaml'), brandRecord({ rev: 1, status: 'proposed', archetypes: { list: { status: 'proposed' } } }));
  assert.deepEqual(directionVerdicts(repo, [list, layout]).map((v) => [v.record, v.archetype, Boolean(v.unaccepted)]), [[list, 'list', true]], 'a layout record owes no direction');
  // `status: accepted` with no owner receipt behind it is never ready (brand.mjs checkDirection).
  fs.writeFileSync(path.join(brand, 'index.yaml'), brandRecord({ rev: 1, status: 'accepted', archetypes: { list: { status: 'accepted', acceptance: { acceptedBy: 'ctx_nobody', rev: 1 } } } }));
  const verdict = directionVerdicts(repo, [list])[0];
  assert.equal(verdict.unaccepted, true);
  assert.match(verdict.why, /receipt|golden/);
  // brand.decide's directionArchetype param landed (e380e4c27): the gate is on, and dispatch refuses until the owner accepts.
  assert.equal(directionPrerequisiteOn(), true);
  const brief = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'ops', 'ops', 'interface.draw.yaml'), 'utf8'));
  assert.equal(brief.reads.find((r) => r.id === 'brand').directionArchetype, true);
  const pre = checkPrerequisites({ brief: { reads: brief.reads.filter((r) => r.id === 'brand') }, payload: { records: [list, layout] }, repo });
  assert.deepEqual(pre.unmet.map((u) => [u.kind, u.record, u.archetype]), [['direction-unaccepted', list, 'list']]);
});

test('the contract change registers every code the draw loop adds and reaches running interface.draw legs', () => {
  const change = loadContractChanges(ROOT).changes.find((c) => c.id === DRAW_LOOP_CHANGE);
  assert.ok(change, `${DRAW_LOOP_CHANGE} is registered`);
  assert.equal(change.reach, 'follow-up');
  assert.deepEqual(change.followUp.op, 'interface.draw');
  for (const code of [DRAW_OFF_GRAMMAR_COMPONENT, DRAW_NOTICE_NOT_ALERT, DRAW_RATIO_NOT_METER, DRAW_ACCENT_BUDGET, DRAW_TOO_MANY_BANDS, DRAW_TOO_MANY_BADGES, DRAW_LOOP_MISSING, DRAW_METRICS_FAILED, DRAW_METRICS_UNVERIFIED]) {
    assert.ok(change.adds.codes.includes(code), code);
  }
});

test('api settle re-measures the drawn parts itself: a loop-passed draw the runtime cannot verify is refused draw-metrics-failed; an older leg settles as admitted', async (t) => {
  const { spawnSync } = await import('node:child_process');
  const { openLedger, ledgerFileFor } = await import('../engine/ledger-db.mjs');
  const p = product(t);
  const git = (...args) => { const r = spawnSync('git', ['-C', p.repo, ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '--quiet', '-b', 'main'); git('config', 'user.email', 'lane@starci.test'); git('config', 'user.name', 'lane'); git('config', 'core.autocrlf', 'false');
  fs.mkdirSync(path.join(p.repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(p.repo, 'src', 'a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(p.repo, '.gitignore'), '.starciwork/\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'init');
  const r = await runRound({ ui: p.ui, html: p.source, base: 'LedgerBase', state: 'installed', viewports: VIEWPORTS, repo: p.repo, render: p.render, probes: p.probes, criticRunner: p.critic(9) });
  const done = finishLoop({ out: r.out });
  const record = parseYaml(fs.readFileSync(path.join(p.ui, 'index.yaml'), 'utf8'));
  record.assets = done.assets;
  record.ui.review = { owner: { decision: 'accepted', answeredBy: 'owner', dispatchId: 'ctx_owner', at: '2026-09-27T12:00:00Z', parts: done.installed.map((i) => ({ path: i.path, sha256: i.sha256 })) } };
  fs.writeFileSync(path.join(p.ui, 'index.yaml'), stringifyYaml(record));
  const files = ['.starciwork/features/modules/ui/ledger/index.yaml', ...done.installed.map((i) => `.starciwork/features/modules/ui/ledger/${i.path}`), path.relative(p.repo, path.join(r.out, 'loop.json')).split(path.sep).join('/')];
  fs.writeFileSync(path.join(r.out, 'grammar-proposal.yaml'), stringifyYaml({ schema: 'starci/grammar-proposal@1', proposals: [
    { name: 'Meter.segments', gap: 'DNA Meter has no segmented variant', anatomy: ['root', 'segments'], tokens: ['--accent'], claims: ['A11Y-3'], render: 'meter.html' }] }));
  const at = loadContractChanges(ROOT).changes.find((c) => c.id === DRAW_LOOP_CHANGE).effectiveAt;
  const seed = (jobId, wf, admittedAt) => {
    const ledger = openLedger({ file: ledgerFileFor(p.repo) });
    try {
      ledger.ensureWorkflow({ workflowId: wf, title: 'draw' });
      ledger.enqueueJob({ jobId, workflowId: wf, opId: 'interface.draw', kind: 'op', payload: { opId: 'interface.draw', owned_paths: ['src/'], orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } });
      ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
      ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)').run(wf, 'interface.draw', 1, `ctx-${jobId}`, '# contract', JSON.stringify({ worktree: p.repo }), admittedAt);
      ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
        .run(wf, `ctx-${jobId}`, 'interface.draw', 1, 0, 'done', JSON.stringify({ outcome: 'done', summary: 'drawn through the loop', files }), null, Date.now());
      ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)').run(wf, 'interface.draw', 1,
        JSON.stringify({ checks: [{ name: 'owned-paths-committed', command: 'git show', exitCode: 0 }, { name: 'owned-paths-clean', command: 'git status', exitCode: 0 }, { name: 'head-ancestor', command: 'git merge-base', exitCode: 0 }] }), Date.now());
    } finally { ledger.close(); }
    return jobId;
  };
  const settle = (jobId) => { const s = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'kernel', 'api.mjs'), 'settle', '--repo', p.repo, '--job', jobId, '--verdict', 'pass', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 300000 }); let body = null; try { body = JSON.parse(s.stdout); } catch { body = null; } return { s, body }; };
  const fresh = settle(seed('op-interface.draw-loop', 'wf-draw', at + 1000));
  assert.equal(fresh.s.status, 1, fresh.s.stdout || fresh.s.stderr);
  assert.equal(fresh.body.reason, 'draw-metrics-failed', 'the stubbed loop said pass; the runtime re-ran the metrics itself and could not verify them on this host');
  assert.ok(fresh.body.codes.some((c) => [DRAW_METRICS_FAILED, DRAW_METRICS_UNVERIFIED].includes(c)));
  assert.deepEqual(fresh.body.loops, [{ loop: 'assets/directions/draw-loop/LedgerBase--installed/loop.json', best: 1, outcome: 'passed' }]);
  const old = settle(seed('op-interface.draw-old', 'wf-draw-old', at - 1000));
  assert.equal(old.s.status, 0, old.s.stderr || old.s.stdout);
  // The settle files the drawing's grammar proposal for the owner - proposed, never accepted - and status lists it.
  assert.deepEqual(old.body.grammarProposals.map((g) => g.name), ['Meter.segments']);
  const st = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'kernel', 'api.mjs'), 'status', '--repo', p.repo, '--workflow', 'wf-draw-old', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(st.status, 0, st.stderr);
  assert.deepEqual(JSON.parse(st.stdout).grammarProposals.map((g) => [g.name, g.status, g.jobId]), [['Meter.segments', 'proposed', 'op-interface.draw-old']]);
});
