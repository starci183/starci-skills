// Owner ruling 2026-09-27 ("chốt"): interface.draw DRAWS WITH THE REAL GRAMMAR COMPONENTS - <XBase>.draw.tsx composing
// only @starci/grammar, type-checked (DRAW_TYPECHECK_FAILED) and gated at AST level (draw-source.mjs), rendered against
// the grammar the product will ship (draw-grammar.mjs: product install, else claude-dist with an owed upgrade), judged
// on its rendered DOM, and kept round by round for interface.implement to start from.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../engine/index.mjs';
import { parseYaml } from '../engine/yaml.mjs';
import { blankImage, encodePng } from '../scripts/work/png.mjs';
import {
  DRAW_BASE_SIGNATURE, DRAW_IMPORT_OFF_GRAMMAR, DRAW_LAYOUT_VALUE_UNJUSTIFIED, DRAW_OFF_GRAMMAR_COMPONENT, DRAW_RAW_STYLED_HTML, DRAW_TYPECHECK_FAILED,
  LAYOUT_ATTR, checkDrawSource, classifyClass, fixtureFindings, markLayoutElements, sourceFindings, typecheckDraw,
} from '../scripts/checks/draw-source.mjs';
import { resolveDrawGrammar, satisfiesRange, grammarEntry } from '../scripts/work/draw-grammar.mjs';
import { UsageError, parseArgs } from '../scripts/work/draw-render.mjs';
import { finishLoop, fixturesByWidth, runRound } from '../scripts/work/draw-loop.mjs';
import { DEFAULT_RUBRIC } from '../scripts/work/draw-critic.mjs';
import { resolveGrammarContext, grammarInputsOf } from '../scripts/kernel/grammar-context.mjs';
import { withRationale } from './_draw-rationale-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-real-')); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); return path.join(root, rel); };
const codes = (list) => [...new Set(list.map((f) => f.code))].sort();

/** A minimal JSX world (no @types/react needed): the grammar declarations carry the global JSX namespace. */
const JSX_GLOBAL = `declare global { namespace JSX { interface Element { readonly __el: true } interface ElementChildrenAttribute { children: {} }
  interface IntrinsicElements { div: { className?: string; children?: unknown; style?: object }; section: { className?: string; children?: unknown }; p: { children?: unknown } } } }`;
/** A built grammar package root: dist/core/index.{d.ts,js}. `segments` exists only when asked (0.5.2 Meter segments). */
const grammarPackage = (root, { version, segments }) => {
  write(root, 'package.json', JSON.stringify({ name: '@starci/grammar', version, type: 'module', exports: { './core': { types: './dist/core/index.d.ts', import: './dist/core/index.js' }, './common.css': './dist/common/styles.css', './package.json': './package.json' } }));
  write(root, 'dist/core/index.d.ts', `${JSX_GLOBAL}
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export declare const Button: (p: { readonly children: string; readonly variant?: ButtonVariant }) => JSX.Element;
export declare const Meter: (p: { readonly label: string; readonly value: number; readonly maxValue?: number${segments ? '; readonly segments?: 2 | 3 | 4' : ''} }) => JSX.Element;
export declare const Text: (p: { readonly children?: unknown; readonly tone?: "default" | "muted" }) => JSX.Element;
`);
  write(root, 'dist/core/index.js', 'export const Button = () => null; export const Meter = () => null; export const Text = () => null;\n');
  write(root, 'dist/common/styles.css', ':root{}\n');
  return root;
};
/** A product app: tsconfig (jsx preserve, the global namespace above), a grammar install, a declared range. */
const productApp = (t, { installed = '0.5.0', segments = false, range = '^0.5.0' } = {}) => {
  const dir = tmp(t);
  write(dir, 'package.json', JSON.stringify({ name: 'app', dependencies: { '@starci/grammar': range } }));
  write(dir, 'tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, jsx: 'preserve', module: 'esnext', moduleResolution: 'bundler', target: 'es2020', skipLibCheck: true, noEmit: true } }));
  grammarPackage(path.join(dir, 'node_modules', '@starci', 'grammar'), { version: installed, segments });
  return dir;
};

const GOOD_DRAW = `import { Button, Meter, Text } from "@starci/grammar/core"
export type LedgerBaseProps = { readonly state: "installed"; readonly props: { readonly title: string }; readonly on: { readonly open: () => void } }
const Row = ({ label }: { readonly label: string }) => <div className="flex gap-2"><Text tone="muted">{label}</Text></div>
export const LedgerBase = ({ props }: LedgerBaseProps) => (
  <section className="grid gap-4 md:grid-cols-2 p-6">
    <Row label={props.title} />
    <Meter label="Capabilities" value={2} maxValue={3} />
    <Button variant="secondary">Open</Button>
  </section>
)
`;

test('classifyClass: grammar-scale layout passes, a free step needs a rationale, anything that paints is raw styling', () => {
  assert.deepEqual(classifyClass('gap-4'), { kind: 'token', rule: 'GAP-4' });
  assert.deepEqual(classifyClass('md:gap-6'), { kind: 'token', rule: 'GAP-5' });
  assert.deepEqual(classifyClass('px-4'), { kind: 'token', rule: 'PADDING-4' });
  assert.equal(classifyClass('gap-5').kind, 'free');
  assert.equal(classifyClass('p-[13px]').kind, 'free');
  for (const c of ['grid', 'md:grid-cols-2', 'grid-cols-[auto_1fr_auto]', 'items-end', 'flex-col', 'col-span-2', 'mx-auto', 'max-w-xs', 'w-full']) assert.equal(classifyClass(c).kind, 'layout', c);
  for (const c of ['bg-surface', 'text-sm', 'rounded-3xl', 'shadow-surface', 'border', 'font-medium', 'text-danger']) assert.equal(classifyClass(c).kind, 'paint', c);
});

test('the AST gate: only grammar components and layout HTML; raw styled HTML, foreign imports, raw icons and free spacing are refused', () => {
  assert.deepEqual(sourceFindings(GOOD_DRAW, { file: 'LedgerBase.draw.tsx' }).findings, []);
  const bad = `import { Button } from "@starci/grammar/core"
import { motion } from "framer-motion"
import { PlusIcon } from "@heroicons/react/24/outline"
import "./local.css"
export const Ledger = () => (
  <div className="flex gap-5 bg-surface rounded-3xl" style={{ padding: 13 }}>
    <p>Hand-made text</p>
    <Card />
    <PlusIcon />
    <Button variant="primary">Go</Button>
  </div>
)
`;
  const r = sourceFindings(bad, { file: 'Ledger.draw.tsx' });
  assert.deepEqual(codes(r.findings), [DRAW_BASE_SIGNATURE, DRAW_IMPORT_OFF_GRAMMAR, DRAW_LAYOUT_VALUE_UNJUSTIFIED, DRAW_OFF_GRAMMAR_COMPONENT, DRAW_RAW_STYLED_HTML].sort());
  const detail = r.findings.map((f) => f.detail).join('\n');
  assert.match(detail, /<p> is raw HTML/);
  assert.match(detail, /<Card> is neither a @starci\/grammar export/);
  assert.match(detail, /<PlusIcon> renders an icon module raw/);
  assert.match(detail, /framer-motion/);
  assert.match(detail, /local\.css for its side effects/);
  assert.match(detail, /className="bg-surface"> paints/);
  assert.match(detail, /<div style> hand-styles/);
  assert.match(detail, /gap-5"> is a free spacing value/);
  // A rationale decision naming the free value with a rule id justifies it.
  const why = [{ id: 'L-kpi', kind: 'spacing', decision: 'KPI rhythm gap-5', value: 'gap-5 (1.25rem)', rules: ['GAP-4', 'direction:P2'] }];
  assert.ok(!sourceFindings(bad, { file: 'Ledger.draw.tsx', rationale: why }).findings.some((f) => f.code === DRAW_LAYOUT_VALUE_UNJUSTIFIED));
  assert.ok(sourceFindings(bad, { file: 'Ledger.draw.tsx', rationale: [{ ...why[0], rules: [] }] }).findings.some((f) => f.code === DRAW_LAYOUT_VALUE_UNJUSTIFIED), 'a decision without a rule id justifies nothing');
  // A non-literal className cannot be read by the gate.
  assert.match(sourceFindings('export const XBase = ({ c }: { c: string }) => <div className={c} />\n', { file: 'X.draw.tsx' }).findings[0].detail, /not a string literal/);
  // Art is a relative raster import; a type-only import is free.
  assert.deepEqual(sourceFindings('import hero from "./assets/hero.png"\nimport type { X } from "../types"\nimport { Image } from "@starci/grammar/core"\nexport const XBase = () => <Image src={hero} alt="" />\n', { file: 'X.draw.tsx' }).findings, []);
});

test('fixtures are exactly {state, props, on}; layout elements are stamped for the rendered-DOM ownership probe', () => {
  assert.deepEqual(fixtureFindings([{ file: 'a.json', value: { state: 'installed', props: {}, on: {} } }]), []);
  assert.match(fixtureFindings([{ file: 'b.json', value: { title: 'x' } }])[0].detail, /exactly \{state, props, on\}/);
  const marked = markLayoutElements(GOOD_DRAW);
  assert.equal(marked.split(`${LAYOUT_ATTR}=""`).length - 1, 2, 'div and section');
  assert.match(marked, /<section data-draw-layout="" className/);
  assert.doesNotMatch(marked, /<Button data-draw-layout/);
});

test('TypeScript is the first gate: a variant or prop the grammar does not publish fails DRAW_TYPECHECK_FAILED', (t) => {
  const app = productApp(t);
  const dir = tmp(t);
  const good = write(dir, 'LedgerBase.draw.tsx', GOOD_DRAW);
  const grammarRoot = path.join(app, 'node_modules', '@starci', 'grammar');
  assert.deepEqual(typecheckDraw({ file: good, productDir: app, grammarRoot }).errors, []);
  const badVariant = write(dir, 'Bad.draw.tsx', GOOD_DRAW.replace('variant="secondary"', 'variant="danger"'));
  const r = typecheckDraw({ file: badVariant, productDir: app, grammarRoot });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'TS2322' && /danger/.test(e.message)), JSON.stringify(r.errors));
  const badProp = write(dir, 'Prop.draw.tsx', GOOD_DRAW.replace('<Meter label="Capabilities"', '<Meter tone="loud" label="Capabilities"'));
  assert.equal(typecheckDraw({ file: badProp, productDir: app, grammarRoot }).ok, false);
});

test('grammar resolution: the product install when it type-checks the draw, else claude-dist with an owed upgrade, else refused', async (t) => {
  const app = productApp(t, { installed: '0.5.0', segments: false, range: '^0.5.0' });
  const dist = grammarPackage(path.join(tmp(t), 'grammar'), { version: '0.5.2', segments: true });
  const dir = tmp(t);
  const plain = write(dir, 'LedgerBase.draw.tsx', GOOD_DRAW);
  const product = resolveDrawGrammar({ file: plain, productDir: app, grammarDist: dist });
  assert.equal(product.grammarSource, 'product@0.5.0');
  assert.equal(product.upgradeOwed, null);

  const segmented = write(dir, 'Seg.draw.tsx', GOOD_DRAW.replace('maxValue={3} />', 'maxValue={3} segments={3} />'));
  const claude = resolveDrawGrammar({ file: segmented, productDir: app, grammarDist: dist });
  assert.equal(claude.ok, true);
  assert.equal(claude.grammarSource, 'claude-dist@0.5.2');
  assert.deepEqual({ ...claude.upgradeOwed, why: undefined }, { status: 'owed', package: '@starci/grammar', from: '0.5.0', to: '0.5.2', range: '^0.5.0', inRange: true, why: undefined });
  assert.deepEqual(claude.attempts.map((a) => [a.source, a.ok]), [['product', false], ['claude-dist', true]]);
  assert.equal(resolveDrawGrammar({ file: segmented, productDir: app, grammarDist: dist, prefer: 'product' }).ok, false, 'pinned to the product, the draw does not type-check');

  const nowhere = write(dir, 'None.draw.tsx', GOOD_DRAW.replace('variant="secondary"', 'variant="danger"'));
  const gate = await checkDrawSource({ file: nowhere, productDir: app, grammarDist: dist });
  assert.equal(gate.grammar.ok, false);
  assert.deepEqual(codes(gate.findings), [DRAW_TYPECHECK_FAILED]);
  assert.match(gate.findings[0].detail, /does not type-check against the grammar it renders with/);

  assert.equal(grammarEntry(dist, 'core'), path.join(dist, 'dist/core/index.js'));
  assert.equal(grammarEntry(dist, 'common.css'), path.join(dist, 'dist/common/styles.css'));
  assert.equal(satisfiesRange('0.5.2', '^0.5.0'), true);
  assert.equal(satisfiesRange('0.6.0', '^0.5.0'), false);
  assert.equal(satisfiesRange('1.4.0', '^1.2.0'), true);
  assert.equal(satisfiesRange('0.5.1', '~0.5.0'), true);
});

test('draw-render: the draw flags belong to fixture mode', () => {
  const base = ['--out', 'o', '--viewports', '1184x900,390x844'];
  const o = parseArgs(['--component', 'X.draw.tsx', '--export', 'XBase', '--props', 'f.json', '--product', 'app', '--grammar', 'claude-dist', '--grammar-dist', 'g', '--harness-out', 'h', ...base]);
  assert.equal(o.grammar, 'claude-dist');
  assert.equal(o.product, path.resolve('app'));
  assert.equal(o.grammarDist, path.resolve('g'));
  assert.equal(o.harnessOut, path.resolve('h'));
  assert.throws(() => parseArgs(['--html', 'a.html', '--product', 'app', ...base]), UsageError);
  assert.throws(() => parseArgs(['--component', 'X.draw.tsx', '--export', 'XBase', '--props', 'f.json', '--grammar', 'newest', ...base]), /--grammar must be one of/);
});

test('interface.draw takes grammar SOURCE, never captures or reference renders; interface.implement starts from the accepted draw source', (t) => {
  const draw = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/ops/ops/interface.draw.yaml'), 'utf8'));
  assert.equal(grammarInputsOf(draw), 'component-source');
  assert.equal(grammarInputsOf(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/ops/ops/interface.implement.yaml'), 'utf8'))), 'reference');
  const text = JSON.stringify(draw);
  assert.doesNotMatch(text, /reference-renders|capture-refs|storybook capture harness|grammar-captures/);
  assert.match(text, /<XBase>\.draw\.tsx/);
  assert.match(text, /DRAW_TYPECHECK_FAILED/);
  const implement = fs.readFileSync(path.join(ROOT, 'modules/ops/ops/interface.implement.yaml'), 'utf8');
  assert.match(implement, /THE ACCEPTED DRAW SOURCE IS THE BASE/);
  assert.match(implement, /upgradeOwed/);

  const repo = tmp(t);
  write(repo, '.starciwork/brand/index.yaml', 'schema: work/brand@1\nkind: brand\nbrand:\n  identity:\n    family: starci\n  sources:\n    - {path: "src/globals.css", kind: "css"}\n');
  write(repo, 'src/globals.css', ':root{}');
  write(repo, '.starciwork/_resources/grammar-captures/index.json', '{}');
  grammarPackage(path.join(repo, 'node_modules', '@starci', 'grammar'), { version: '0.5.2', segments: true });
  write(repo, 'node_modules/@heroui/styles/package.json', '{"name":"@heroui/styles"}');
  const ref = resolveGrammarContext({ skillRoot: ROOT, repo, binding: null });
  assert.ok(ref.sources.some((s) => s.role === 'grammar-captures'));
  const src = resolveGrammarContext({ skillRoot: ROOT, repo, binding: null, inputs: 'component-source' });
  assert.ok(!src.sources.some((s) => s.role === 'grammar-captures'), 'no capture reaches a drawing');
  assert.deepEqual(src.sources.filter((s) => s.role === 'grammar-source').map((s) => path.basename(s.path)), ['dist', 'src']);
  assert.ok(src.sources.some((s) => s.role === 'heroui-styles'));
});

test('a component round keeps source.tsx, fixtures and the grammar resolution, judges the rendered DOM, and finish installs the draw source', async (t) => {
  const out = tmp(t);
  const dir = tmp(t);
  const source = write(dir, 'LedgerBase.draw.tsx', GOOD_DRAW);
  const fixture = write(dir, 'LedgerBase.installed.fixture.json', JSON.stringify({ state: 'installed', props: { title: 'Mô-đun' }, on: { open: '[Function]' } }));
  const grammar = { ok: true, pick: { source: 'claude-dist', version: '0.5.2', root: '/g' }, grammarSource: 'claude-dist@0.5.2', productVersion: '0.5.0', productRange: '^0.5.0',
    upgradeOwed: { status: 'owed', from: '0.5.0', to: '0.5.2', range: '^0.5.0', inRange: true }, attempts: [{ source: 'product', ok: false, errors: [{}] }, { source: 'claude-dist', ok: true, errors: [] }] };
  // The decision evidence (lane draw-devin-rationale) rides beside the draw source and binds by selector.
  const DOM = '<!doctype html><html><body><div id="root"><section data-draw-layout=""><span data-component="Badge" data-grammar-component="Badge" data-tone="success">Đang chạy</span></section></div></body></html>';
  const why = withRationale(DOM);
  fs.writeFileSync(path.join(dir, 'LedgerBase.draw.rationale.json'), JSON.stringify(why.entries));
  let unowned = 1;
  const render = async ({ out: roundDir, viewports, name, grammar: g }) => viewports.map((v) => {
    assert.equal(g.pick.source, 'claude-dist', 'the render uses the resolved grammar');
    const file = path.join(roundDir, `${name}--${v.width}x${v.height}--light.png`);
    fs.writeFileSync(file, encodePng(blankImage(v.width, v.height)));
    const dom = file.replace(/\.png$/, '.dom.html');
    fs.writeFileSync(dom, why.html);
    const redline = file.replace(/.png$/, '.redline.png');
    fs.writeFileSync(redline, encodePng(blankImage(v.width, v.height)));
    const rec = { schema: 'starci/draw-render@1', ok: !unowned, failures: unowned ? ['off-grammar-dom'] : [], viewport: { ...v, deviceScaleFactor: 1 }, image: { path: file, sha256: sha256(fs.readFileSync(file)) },
      layout: { accentExempt: [] }, ownership: { components: ['Badge'], layoutElements: 1, unownedCount: unowned, unowned: unowned ? ['p "hand text" (layout)'] : [] }, dom: { path: dom },
      rationale: why.measure(v), redline: { path: redline } };
    fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(rec));
    return rec;
  });
  const probes = { geometry: async () => ({ findings: [] }), score: async (html, viewport) => ({ schema: 'starci/ui-proof-score@1', viewport, summary: { pass: 5, fail: 0, unmeasurable: 0 }, cases: [], spacing: [] }) };
  const critic = async () => ({ code: 0, lastMessage: JSON.stringify({ checks: DEFAULT_RUBRIC.checks.map((c) => ({ id: c.id, pass: true, evidence: 'ok' })), beauty: 9 }) });
  const base = { source, fixtures: fixturesByWidth([fixture]), product: dir, base: 'LedgerBase', state: 'installed', viewports: [{ width: 1184, height: 60 }, { width: 390, height: 60 }],
    repo: dir, out, render, probes, criticRunner: critic, sourceCheck: async () => ({ findings: [], grammar }) };
  const r1 = await runRound(base);
  assert.equal(r1.round.mode, 'component');
  assert.equal(r1.round.grammarSource, 'claude-dist@0.5.2');
  assert.deepEqual(r1.round.codes, [DRAW_OFF_GRAMMAR_COMPONENT], 'rendered paint owned by a layout element fails the DNA metric');
  assert.match(r1.metrics.metrics.find((m) => m.id === 'dna').findings[0].detail, /rendered DOM: 1 painting element/);
  assert.equal(r1.metrics.metrics.find((m) => m.id === 'render').ok, true, 'ownership is judged once, by the DNA metric');
  for (const f of ['source.tsx', 'fixture.json', 'grammar.json', 'rationale.json', 'metrics.json', 'critique.json']) assert.ok(fs.existsSync(path.join(out, 'round-1', f)), f);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'round-1', 'grammar.json'), 'utf8')).upgradeOwed.to, '0.5.2');
  assert.equal(r1.metrics.metrics.find((m) => m.id === 'source').measured.grammarSource, 'claude-dist@0.5.2');

  // A failing source gate is a finding of its own metric.
  unowned = 0;
  const r2 = await runRound({ ...base, sourceCheck: async () => ({ findings: [{ code: DRAW_RAW_STYLED_HTML, detail: 'x:1 <p> is raw HTML' }], grammar }) });
  assert.deepEqual(r2.round.codes, [DRAW_RAW_STYLED_HTML]);
  const r3 = await runRound(base);
  assert.equal(r3.stop.reason, 'passed');
  const done = finishLoop({ out, parts: path.join(dir, 'parts') });
  assert.equal(done.outcome, 'passed');
  const roles = done.assets.map((a) => a.role);
  assert.deepEqual(roles, ['direction-content', 'render-source', 'render-fixture', 'rationale', 'direction-redline', 'direction-content', 'render-source', 'render-fixture', 'rationale', 'direction-redline']);
  assert.equal(done.assets[0].generation.grammarSource, 'claude-dist@0.5.2');
  assert.equal(done.assets[0].generation.grammarUpgradeOwed.to, '0.5.2');
  assert.ok(fs.existsSync(path.join(dir, 'parts', 'LedgerBase#installed--1184x60--light.draw.tsx')));
  assert.equal(fs.readFileSync(path.join(dir, 'parts', 'LedgerBase#installed--1184x60--light.draw.tsx'), 'utf8'), GOOD_DRAW);
  assert.ok(fs.existsSync(path.join(dir, 'parts', 'LedgerBase#installed--390x60--light.fixture.json')));
});
