#!/usr/bin/env node
// ui-proof-brief.mjs — every knowledge/ui case a surface's elements bring into play, with the numbers the
// product's CSS resolves them to, and a scorer that marks each case on a render.
//
//   starci work ui-proof-brief --surface <ui record path> --repo <repo> [--family <name>]
//        [--elements field,card,...] [--json]
//   starci work ui-proof-brief --surface <ui record path> --repo <repo> --score <html>
//        [--viewport 390x844] [--json]
//
// Elements come from the ui record (coverage components, intent, states, surfaces) plus `--elements`.
// A case applies when every element kind its `when` (else its rule's `governs`) names is present, and
// when its `owner` components (presentation) are among the surface's components. Cases that only a
// running UAT or an evaluation lens can observe are listed as not applicable, never dropped silently.
// Presentation cases carry their numbers: the scale step, every spacing/radius/type class in `render`,
// the composite-insets and side-contact guidance, and the component-owned values Grammar's CSS binds
// (grammar-geometry.mjs resolves them from the product's cascade). A knowledge value the CSS does not
// bind, and two rules claiming one component element, are named as conflicts - never silently picked.
// A family token the CSS declares and never reads is a geometry fact (the CSS wins), printed with the geometry.
//
// --score renders the html (grammar-geometry.mjs snapshot) and marks each applicable case pass, fail or
// unmeasurable with evidence, with a spacing section (closed-scale values, page inset, card and band
// insets, field and badge gaps). Thresholds are read from the case text itself.
// Exit 0 brief printed / nothing failed, 1 a scored case failed, 2 bad argument or unavailable source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import {sha256} from '../../../engine/digest.mjs';
import {
  DEFAULT_VIEWPORT, alphaOf, firstFamily, geometryProbes, normalizeShadowText, parseViewport, readSnapshot,
  resolveGeometry, sameColor, snapshotFiles,
} from './grammar-geometry.mjs';
import { KIND_IDS, classifyCase, surfaceElements } from './ui-proof-elements.mjs';
import { classValue, classesIn, describeClass, fmtPx, remPx, tokenScope, withPx } from './ui-proof-numbers.mjs';
import { r1, scalePx, spacingChecks, tag } from './ui-proof-spacing.mjs';
export { classValue, classifyCase, spacingChecks, surfaceElements };
import { contrastRatio as wcagRatio } from '../brand/brand.mjs';
import { flag as argOf } from '../work-io.mjs';
import { squash } from '../../lib/clip.mjs'; import { isMain } from '../../lib/is-main.mjs';
import { alphaOver } from '../../lib/color.mjs'; import { byCodeUnit } from '../../lib/list.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const KNOWLEDGE = path.join(ROOT, 'knowledge', 'ui');
const LAYERS = ['proof', 'presentation', 'composition'];

/** The ui record file for a path (the index.yaml itself or its directory). */
function surfaceFile(p) {
  const abs = path.resolve(p);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return path.join(abs, 'index.yaml');
  return abs;
}
// ---------------------------------------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------------------------------------

/** Every knowledge/ui/{proof,presentation,composition}/*.yaml topic (index files excluded). */
export function loadKnowledge(root = KNOWLEDGE) {
  const out = [];
  for (const layer of LAYERS) {
    const dir = path.join(root, layer);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.yaml') && x !== 'index.yaml').sort(byCodeUnit)) {
      const file = path.join(dir, f);
      out.push({ layer, file, rel: path.relative(ROOT, file).split(path.sep).join('/'), doc: parseYaml(fs.readFileSync(file, 'utf8')) });
    }
  }
  return out;
}
/** The CSS each component-owned knowledge row can be checked against (selectors only). */
const OWNED_CSS = (chains) => [
  { component: 'SurfaceCard', element: /^content, composition!="joined", frame!="frameless"/, chain: chains.surfaceContent('stacked'), prop: 'padding-top' },
  { component: 'SurfaceCard', element: /^content, composition="joined"/, chain: chains.surfaceContent('joined'), prop: 'padding-top', gapProp: 'row-gap' },
  { component: 'SurfaceCard', element: /^label/, chain: [...chains.cardRoot(true), ['header', '.card__header', '.starci-core-surface-label', '[data-grammar-surface-label=true]']], prop: 'column-gap' },
  { component: 'Input', element: /^root$/, chain: [chains.html, chains.root, ['div', '.starci-core-input', '[data-component=Input]']], prop: 'row-gap' },
  { component: 'Tabs', element: /tab$/, chain: [chains.html, chains.root, ['div', '.tabs', '.starci-core-tabs'], ['div', '.tabs__list'], ['button', '.tabs__tab']], prop: 'padding-left' },
  ...[1, 2, 3, 4].map((level) => ({ component: 'Heading', element: new RegExp(`level=${level}$`), chain: [chains.html, chains.root, [`h${level}`, '[data-component=Heading]', '[data-scale=standard]', `[data-level=${level}]`]], prop: 'font-size' })),
];

// ---------------------------------------------------------------------------------------------------------
// The brief
// ---------------------------------------------------------------------------------------------------------

/** The report line for a presentation rule's scale step (its value, its px, its token). */
const stepScaleNumber = (rule, step, stepPx) => (step?.value != null ? [{ what: `${rule.id} scale step`, text: String(step.value) + (stepPx != null ? ' = ' + fmtPx(stepPx) : '') + (step.token ? ' (' + step.token + ')' : '') }] : []);

/** The step token resolved at every width; a conflict is named when the CSS binds another px than the knowledge. */
function tokenNumber(k, rule, step, stepPx, scopes, conflicts) {
  const vals = scopes.map((s) => ({ width: s.width, v: s.variable(step.token) }));
  const text = vals.map(({ width, v }) => `${v?.px != null ? fmtPx(v.px) : v?.value ?? 'unbound'} at ${width}px`).join(', ');
  const bound = vals[0].v?.px;
  if (stepPx != null && bound != null && Math.abs(bound - stepPx) > 0.5) conflicts.push({ kind: 'knowledge-vs-css', text: `${k.rel} ${rule.id} scale step is ${step.value} (${fmtPx(stepPx)}), but ${step.token} binds ${fmtPx(bound)} in the product CSS` });
  return { what: `${step.token} in the product CSS`, text };
}

/** The numbers a presentation case carries: the scale step, every class in `render`, the step token in the CSS. */
function presentationNumbers(k, rule, c, steps, scopes, conflicts) {
  const step = steps.get(rule.id);
  const stepPx = remPx(step?.value);
  const numbers = [
    ...stepScaleNumber(rule, step, stepPx),
    ...classesIn(`${rule.title ?? ''} ${c.render ?? ''}`, scopes[0]).map((v) => ({ what: 'class', text: describeClass(v), value: v })),
  ];
  if (step?.token && scopes[0]) numbers.push(tokenNumber(k, rule, step, stepPx, scopes, conflicts));
  return numbers;
}

const caseEntry = (k, rule, c, cls) => ({ path: k.rel, rule: rule.id, case: c.id, title: rule.title, when: c.when, observe: c.observe ?? null, assert: c.assert ?? null, owner: c.owner ?? null, render: c.render ?? null, kinds: cls.kinds });

/** The applicable and skipped cases of one knowledge topic. */
function topicCases(k, steps, elements, scopes, conflicts) {
  const cases = [];
  const skipped = [];
  for (const rule of k.doc.rules ?? []) {
    for (const c of rule.cases ?? []) {
      const cls = classifyCase(rule, c, elements);
      if (!cls.applies) { skipped.push({ id: `${rule.id} ${c.id}`, reason: cls.reason }); continue; }
      const entry = caseEntry(k, rule, c, cls);
      if (k.layer === 'presentation') entry.numbers = presentationNumbers(k, rule, c, steps, scopes, conflicts);
      cases.push(entry);
    }
  }
  return { cases, skipped };
}

function topicOf(k, cases, skipped) {
  const doc = k.doc;
  const guidance = (doc.guidance ?? []).map((gd) => ({ id: gd.id, title: gd.title, requirement: withPx(gd.requirement) }));
  const scaleNotes = doc.scale?.notes ? withPx(doc.scale.notes) : null;
  return { path: k.rel, layer: k.layer, id: doc.id, title: doc.title, cases, skipped, guidance: cases.length ? guidance : [], scaleNotes: cases.length ? scaleNotes : null };
}

/** The component-owned knowledge rows of one topic whose component is on the surface. */
function ownedRowsOf(k, steps, elements) {
  return (k.doc.componentOwnership?.rows ?? []).filter((r) => r.component && elements.components.has(r.component)).map((r) => {
    const step = r.rule ? steps.get(r.rule) : null;
    return { path: k.rel, component: r.component, element: r.element, rule: r.rule ?? null, value: step?.value ?? null, px: remPx(step?.value) };
  });
}

const ownerLabel = (rows, id) => {
  const px = rows.find((r) => r.rule === id)?.px;
  return px != null ? `${id} (${fmtPx(px)})` : id;
};

/** Two rules claiming one component element. */
function twoOwnerConflicts(ownedRows) {
  const byElement = new Map();
  for (const r of ownedRows) {
    const key = `${r.path} ${r.component} | ${r.element}`;
    if (!byElement.has(key)) byElement.set(key, []);
    byElement.get(key).push(r);
  }
  const conflicts = [];
  for (const [key, rows] of byElement) {
    const rules = [...new Set(rows.map((r) => r.rule).filter(Boolean))];
    if (rules.length > 1) conflicts.push({ kind: 'two-owners', text: `${key.split(' ')[0]}: ${rows[0].component} "${rows[0].element}" is owned by ${rules.map((id) => ownerLabel(rows, id)).join(' and ')} - the knowledge row does not say which condition selects each` });
  }
  return conflicts;
}

/** A component-owned knowledge value against what Grammar's CSS binds (one row, one CSS property). */
function cssFactOf(r, spec, v, knowledge, scope, conflicts) {
  const want = r.px ?? (r.rule?.startsWith('FONT-') ? fontPx(knowledge, r.rule, scope) : null);
  if (want != null && v?.px != null && Math.abs(want - v.px) > 0.5) conflicts.push({ kind: 'knowledge-vs-css', text: `${r.path} ${r.component} "${r.element}" is ${r.rule} (${fmtPx(want)}), but Grammar's CSS binds ${spec.prop} ${fmtPx(v.px)} (\`${v.declared}\`) - the CSS renders; the knowledge row needs the owner's correction` });
  return { path: r.path, component: r.component, element: r.element, rule: r.rule, knowledge: want, css: v?.px ?? null, declared: v?.declared ?? null, file: v?.file ?? null, prop: spec.prop };
}

function cssFactsOf(g, widths, ownedRows, knowledge, scope, conflicts) {
  const cssFacts = [];
  if (!g.ok) return cssFacts;
  for (const spec of OWNED_CSS(g.chains)) {
    const rows = ownedRows.filter((r) => r.component === spec.component && spec.element.test(r.element));
    if (!rows.length) continue;
    const el = g.resolver.element(spec.chain, widths[0]);
    const v = el.get(spec.prop);
    for (const r of rows) cssFacts.push(cssFactOf(r, spec, v, knowledge, scope, conflicts));
  }
  return cssFacts;
}

/**
 * The brief for one surface: applicable and not-applicable cases per topic, presentation numbers,
 * component-owned values, guidance, and the conflicts between rules and between a rule and the CSS.
 */
export function buildBrief({ record, recordFile = null, repo = null, family = null, extra = [], widths = [390, 1280], knowledge = loadKnowledge(), grammarDist = null, extraCss = [] } = {}) {
  const elements = surfaceElements(record, { extra });
  const g = repo ? resolveGeometry({ repo, family, widths, grammarDist, extraCss }) : { ok: false, errors: ['no --repo: numbers are the knowledge values at a 16px root'] };
  const scopes = g.ok ? widths.map((w) => tokenScope(g, w)) : [null];
  const scope = scopes[0];
  const topics = [];
  const conflicts = [];
  const ownedRows = [];
  for (const k of knowledge) {
    const steps = new Map((k.doc.scale?.steps ?? []).filter((s) => s.id && s.id !== '—').map((s) => [s.id, s]));
    const { cases, skipped } = topicCases(k, steps, elements, scopes, conflicts);
    ownedRows.push(...ownedRowsOf(k, steps, elements));
    topics.push(topicOf(k, cases, skipped));
  }
  conflicts.push(...twoOwnerConflicts(ownedRows));
  const cssFacts = cssFactsOf(g, widths, ownedRows, knowledge, scope, conflicts);
  return { schema: 'starci/ui-proof-brief@1', surface: recordFile, record: record?.id ?? null, elements: { kinds: Object.fromEntries(elements.kinds), components: [...elements.components].sort(byCodeUnit) }, geometry: g, topics, ownedRows, cssFacts, conflicts };
}

function fontPx(knowledge, ruleId, scope) {
  const font = knowledge.find((k) => k.rel.endsWith('presentation/font.yaml'));
  const rule = font?.doc.rules?.find((r) => r.id === ruleId);
  const v = classesIn(rule?.title, scope).find((x) => x.cls.replace(/^([a-z0-9-]+:)+/, '').startsWith('text-'));
  return v?.px ?? null;
}

const relToCwd = (file) => path.relative(process.cwd(), file).split(path.sep).join('/');

function numbersSourceLine(g) {
  if (!g.ok) return `Numbers: knowledge values only (${g.errors.join('; ')}).`;
  const entry = g.sources.entry ? path.relative(g.sources.repo, g.sources.entry).split(path.sep).join('/') : 'installed packages';
  return `Numbers resolved through the product CSS (family ${g.family}, ${entry}).`;
}

function briefHeadLines(b) {
  const surface = b.surface ? ' (' + relToCwd(b.surface) + ')' : '';
  const lines = [
    `UI PROOF BRIEF - ${b.record ?? 'surface'}${surface}`,
    `Elements: ${Object.entries(b.elements.kinds).map(([k, why]) => k + ' [' + why + ']').join('; ')}.`,
    `Components: ${b.elements.components.join(', ') || 'none named'}.`,
    numbersSourceLine(b.geometry),
    '',
    `CONFLICTS (${b.conflicts.length}) - named, not resolved here:`,
  ];
  for (const c of b.conflicts) lines.push(`- [${c.kind}] ${c.text}`);
  if (!b.conflicts.length) lines.push('- none found');
  return lines;
}

function caseLines(t, c) {
  const lines = [`- ${t.path} ${c.rule} ${c.case} [${c.title ? squash(c.title) : ''}] when: ${squash(c.when)}`];
  if (c.observe) lines.push(`    observe: ${squash(c.observe)}`);
  if (c.assert) lines.push(`    assert: ${squash(c.assert)}`);
  if (c.owner || c.render) lines.push(`    owner ${squash(c.owner) || '-'}; render: ${squash(c.render) || '-'}`);
  if (c.numbers?.length) lines.push(`    numbers: ${c.numbers.map((n) => n.text).join('; ')}`);
  return lines;
}

function topicLines(t) {
  if (!t.cases.length && !t.skipped.length) return [];
  const lines = ['', `# ${t.path} - ${t.title} (${t.cases.length} applicable, ${t.skipped.length} not)`];
  if (t.scaleNotes) lines.push(`  scale: ${squash(t.scaleNotes)}`);
  for (const c of t.cases) lines.push(...caseLines(t, c));
  for (const gd of t.guidance) lines.push(`- ${t.path} guidance ${gd.id}: ${squash(gd.requirement)}`);
  if (t.skipped.length) lines.push(`  not applicable: ${t.skipped.map((s) => s.id + ' (' + s.reason + ')').join('; ')}`);
  return lines;
}

function ownedValueLines(b) {
  if (!b.ownedRows.length) return [];
  const lines = ['', '== COMPONENT-OWNED VALUES (compose the component; never restate them in app classes) =='];
  for (const r of b.ownedRows) {
    const fact = b.cssFacts.find((f) => f.path === r.path && f.component === r.component && f.element === r.element);
    lines.push('- ' + r.path + ' ' + r.component + ' "' + r.element + '": ' + (r.rule ?? '(no rule)') + (r.px != null ? ' = ' + fmtPx(r.px) : '') + (fact?.css != null ? '; CSS ' + fact.prop + ' ' + fmtPx(fact.css) + ' (`' + fact.declared + '`)' : ''));
  }
  return lines;
}

function geometryLines(b) {
  if (!b.geometry.ok) return [];
  const a = b.geometry.at[0];
  const lines = ['',
    '== GRAMMAR GEOMETRY (grammar-geometry.mjs) ==',
    `- button radius ${fmtPx(a.button['border-radius']?.px)}, height ${fmtPx(a.button.heightPx)} (full width min ${fmtPx(a.button.fill['min-height']?.px)}), padding-inline ${fmtPx(a.button['padding-left']?.px)}; input radius ${fmtPx(a.input.primary['border-radius']?.px)}, height ${fmtPx(a.input.primary.heightPx)}, padding ${fmtPx(a.input.primary['padding-top']?.px)} ${fmtPx(a.input.primary['padding-left']?.px)}, no border, secondary fill ${a.input.secondary['background-color']?.value} inside a surface.`,
    `- card radius ${fmtPx(a.card.top['border-radius']?.px)}, no border, shadow ${normalizeShadowText(a.card.top['box-shadow']?.value)}; content inset ${fmtPx(a.card.content['padding-top']?.px)}; joined inset ${fmtPx(a.card.joined['padding-top']?.px)} gap ${fmtPx(a.card.joined['row-gap']?.px)}; external label to card ${fmtPx(a.card.labelGap?.px)}; badge radius ${fmtPx(a.badge['border-radius']?.px)} height ${fmtPx(a.badge.heightPx)}; font ${b.geometry.font.binding?.value}.`];
  const inset = b.geometry.resolver.memo('inset-root', [b.geometry.chains.html, b.geometry.chains.root], 390).variable('--grammar-page-inset');
  const unbound = b.geometry.unbound.filter((u) => /radius|shadow|surface|font/.test(u.name));
  if (unbound.length) lines.push(`- declared by the ${b.geometry.family} family and read by nothing, so never drawn: ${unbound.map((u) => String(u.name) + ' ' + String(u.value)).join('; ')}.`);
  if (inset) lines.push(`- page inset --grammar-page-inset ${inset.declared} = ${b.geometry.widths.map((w) => fmtPx(b.geometry.resolver.memo('inset-' + w, [b.geometry.chains.html, b.geometry.chains.root], w).variable('--grammar-page-inset')?.px) + ' at ' + w + 'px').join(', ')} (PageContainer).`);
  return lines;
}

/** The brief as text. */
export function briefText(b) {
  const lines = briefHeadLines(b);
  for (const layer of LAYERS) {
    lines.push('', `== ${layer.toUpperCase()} ==`);
    for (const t of b.topics.filter((x) => x.layer === layer)) lines.push(...topicLines(t));
  }
  lines.push(...ownedValueLines(b), ...geometryLines(b));
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------------------
// Scoring a render
// ---------------------------------------------------------------------------------------------------------

const contrastRatio = (a, b) => wcagRatio({ rgb: a.slice(0, 3) }, { rgb: b.slice(0, 3) });

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const numberWord = (w) => (WORDS[String(w).toLowerCase()] ?? Number(w));

const DECIMAL = String.raw`\d+(?:\.\d+)?`;
const SIZE_IN_CASE = new RegExp(String.raw`(\d+)px\s*[x×]\s*(\d+)px`);
const RATIO_IN_CASE = new RegExp(String.raw`(${DECIMAL}):1`);

const PASS = (evidence) => ({ status: 'pass', evidence });
const FAIL = (evidence) => ({ status: 'fail', evidence });
const NONE = (evidence) => ({ status: 'unmeasurable', evidence });

/** Instruments for the cases a render can decide, keyed `<file> <RULE> <case>`. */
const MEASURERS = {
  'anatomy-source.yaml ANATOMY-2 case-1': (v, ctx) => {
    const nested = v.inputs.filter((e) => v.containerOf(e));
    if (!nested.length) return NONE('no input sits inside a surface in this render');
    const bad = nested.filter((e) => !sameColor(e.style.bg, ctx.probes['input.secondary.bg']?.rgba) || normalizeShadowText(e.style.shadow) !== 'none');
    return bad.length ? FAIL(`${bad.map(tag).join(', ')} not the secondary variant (fill ${ctx.probes['input.secondary.bg']?.value}, no shadow)`) : PASS(`${nested.length} nested field(s) use the secondary fill, no shadow`);
  },
  'anatomy-source.yaml ANATOMY-2 case-2': (v) => {
    const nested = v.cards.filter((c) => c.nested);
    if (!nested.length) return NONE('no surface nested inside another');
    const bad = nested.filter((c) => v.shadowOn(c.el) || !v.borderOn(c.el));
    return bad.length ? FAIL(`${bad.map((c) => tag(c.el)).join(', ')} carries the top treatment (shadow, no border) inside a raised surface`) : PASS(`${nested.length} nested surface(s) outlined, unshadowed`);
  },
  'contrast.yaml COLOR-3 case-6': (v, ctx) => {
    const nested = v.inputs.filter((e) => v.containerOf(e));
    if (!nested.length) return NONE('no field nested in a surface');
    const ratios = nested.map((e) => r1(contrastRatio(v.bgOf(e), v.bgOf(v.containerOf(e)))));
    const secondary = nested.every((e) => sameColor(e.style.bg, ctx.probes['input.secondary.bg']?.rgba));
    return secondary ? PASS(`secondary fill; fill-to-surface ratio ${ratios.join(', ')}:1 recorded, not scored (owner ruling)`) : FAIL('a nested field is not the secondary variant');
  },
  'contrast.yaml COLOR-5 case-1': (v, ctx) => textContrast(v, ctx, false),
  'contrast.yaml COLOR-5 case-2': (v, ctx) => textContrast(v, ctx, true),
  'contrast.yaml COLOR-3 case-2': (v) => {
    const selected = v.els.filter((e) => e.visible && (e.aria.selected === 'true' || (e.aria.current && e.aria.current !== 'false')));
    if (!selected.length) return NONE('no aria-selected or aria-current peer rendered');
    const bad = [];
    for (const s of selected) {
      const peers = v.els.filter((e) => e.visible && e.parent === s.parent && e.i !== s.i && e.tag === s.tag && e.role === s.role);
      if (!peers.length) continue;
      const label = (e) => (e.own ? e : v.els.find((x) => x.own && v.ancestors(x).some((a) => a.i === e.i))) ?? e;
      const weight = label(s).style.fontWeight !== label(peers[0]).style.fontWeight;
      const indicator = s.style.border[2].w > 0 && alphaOf(s.style.border[2].color) > 0 && s.style.border[2].w !== peers[0].style.border[2].w;
      const bar = v.els.some((x) => x.visible && x.rect.h >= 1 && x.rect.h <= 4 && alphaOf(x.style.bg) > 0 && Math.abs(x.rect.x - s.rect.x) < s.rect.w && x.rect.y >= s.rect.y + s.rect.h - 6 && x.rect.y <= s.rect.y + s.rect.h + 2);
      if (!weight && !indicator && !bar) bad.push(tag(s));
    }
    return bad.length ? FAIL(`${bad.join(', ')}: selection differs from its peers by colour only`) : PASS(`${selected.length} selected peer(s) carry a weight change or an indicator`);
  },
  'contrast.yaml COLOR-3 case-3': (v) => focusCheck(v),
  'focus.yaml FOCUS-1 case-1': (v) => focusCheck(v),
  'focus.yaml FOCUS-1 case-4': (v) => focusCheck(v),
  'accessibility.yaml A11Y-1 case-1': (v) => {
    if (!v.inputs.length) return NONE('no field rendered');
    const bad = v.inputs.filter((e) => !e.labelText);
    return bad.length ? FAIL(`${bad.map((e) => e.tag+(e.placeholder?' placeholder "'+e.placeholder+'"':'')).join(', ')} has no accessible name from a label`) : PASS(`${v.inputs.length} field(s) named by their visible label`);
  },
  'ux.yaml UX-8 case-1': (v) => MEASURERS['accessibility.yaml A11Y-1 case-1'](v),
  'accessibility.yaml A11Y-1 case-2': (v) => {
    const pairs = [];
    for (const input of v.inputs) {
      const box = v.ancestors(input).find((a) => v.texts.some((t) => t.style.fontSize <= 13 && v.ancestors(t).some((x) => x.i === a.i))) ?? null;
      if (!box || v.ancestors(input).indexOf(box) > 2) continue;
      const hints = v.texts.filter((t) => t.style.fontSize <= 13 && v.ancestors(t).some((x) => x.i === box.i) && !(input.labelText ?? '').includes(t.own.slice(0, 10)));
      for (const h of hints) pairs.push({ input, h, related: input.described.includes(h.i) || input.described.some((d) => v.ancestors(h).some((a) => a.i === d)) });
    }
    if (!pairs.length) return NONE('no hint or message renders beside a field');
    const bad = pairs.filter((p) => !p.related);
    return bad.length ? FAIL(`${bad.map((p) => '"'+p.h.own.slice(0, 30)+'" is not aria-describedby of '+tag(p.input)).join('; ')}`) : PASS(`${pairs.length} hint(s) related by aria-describedby`);
  },
  'accessibility.yaml A11Y-4 case-4': (v) => (v.snap.root.scrollWidth > v.snap.root.clientWidth + 1 ? FAIL(`horizontal overflow: scrollWidth ${v.snap.root.scrollWidth} > ${v.snap.root.clientWidth}`) : PASS(`no horizontal overflow at ${v.snap.root.clientWidth}px`)),
  'accessibility.yaml A11Y-4 case-1': (v, ctx, c) => {
    const m = SIZE_IN_CASE.exec(String(c.observe));
    if (!m) return NONE('the case names no size');
    const targets = v.els.filter((e) => e.visible && (e.role === 'button' || e.tag === 'button') && v.els.some((x) => x.i === e.i) && (e.cls.includes('accordion') || v.ancestors(e).some((a) => /rail|accordion/i.test(a.cls))));
    if (!targets.length) return NONE('no accordion trigger or rail control rendered (the only targets the case sizes)');
    const bad = targets.filter((e) => e.rect.w < Number(m[1]) - 0.5 || e.rect.h < Number(m[2]) - 0.5);
    return bad.length ? FAIL(bad.map((e) => tag(e)+' '+r1(e.rect.w)+'x'+r1(e.rect.h)).join(', ')) : PASS(`${targets.length} target(s) >= ${m[1]}x${m[2]}`);
  },
  'taste.yaml TASTE-1 case-2': (v) => {
    const heads = v.els.filter((e) => e.visible && /^h[1-6]$/.test(e.tag));
    const h1 = heads.find((e) => e.tag === 'h1'); if (!h1){heads.sort((a, b) => b.style.fontSize - a.style.fontSize);} const title = h1 ?? heads[0];
    if (!title) return NONE('no heading rendered');
    const sections = heads.filter((e) => e.i !== title.i && e.tag !== 'h1');
    if (!sections.length) return NONE('no section title beside the page title');
    const bad = sections.filter((s) => s.style.fontSize >= title.style.fontSize && s.style.fontWeight >= title.style.fontWeight);
    return bad.length ? FAIL(`${bad.map((s) => tag(s)+' '+s.style.fontSize+'px/'+s.style.fontWeight).join(', ')} not below the title ${title.style.fontSize}px/${title.style.fontWeight}`) : PASS(`title ${title.style.fontSize}px/${title.style.fontWeight} above ${sections.length} section title(s)`);
  },
  'taste.yaml TASTE-4 case-3': (v, ctx) => {
    const scale = new Set([...scalePx(ctx.knowledge, 'gap'), ...scalePx(ctx.knowledge, 'padding')].map(Math.round));
    const gaps = [];
    for (const [parent, kids] of v.kids) {
      if (v.inGrammar?.(v.byI.get(parent) ?? {})) continue;
      // Out-of-flow boxes (absolute, and a fixed or sticky bar pinned to an edge) are no step of the stack.
      const stack = kids.filter((k) => k.visible && !['absolute', 'fixed', 'sticky'].includes(k.style.position)).sort((a, b) => a.rect.y - b.rect.y);
      for (let k = 1; k < stack.length; k++) { const d = stack[k].rect.y - (stack[k - 1].rect.y + stack[k - 1].rect.h); if (d > 0.5 && Math.abs(stack[k].rect.x - stack[k - 1].rect.x) < 2) gaps.push(r1(d)); }
    }
    const distinct = [...new Set(gaps.map(Math.round))].sort((a, b) => a - b);
    const off = distinct.filter((d) => !scale.has(d));
    return off.length ? FAIL(`vertical gaps ${distinct.join('/')}px; off the closed steps: ${off.join('/')}px`) : PASS(`vertical gaps ${distinct.join('/')}px, all on the closed steps`);
  },
  'taste.yaml TASTE-5 case-1': (v, ctx, c) => {
    const m = /Exactly (\w+) accent-filled/i.exec(String(c.observe));
    const allowed = m ? numberWord(m[1]) : null;
    const filled = v.buttons.filter((e) => sameColor(e.style.bg, ctx.probes['button.primary.bg']?.rgba));
    if (allowed == null) return NONE('the case names no count');
    if (!filled.length) return NONE('no accent-filled control rendered');
    return filled.length > allowed ? FAIL(`${filled.length} accent-filled controls (${filled.map(tag).join(', ')}), the case allows ${allowed}`) : PASS(`${filled.length} accent-filled control`);
  },
  'taste.yaml TASTE-6 case-1': (v, ctx, c) => {
    const m = /At most (\w+) distinct sizes, and at most (\w+) weights/i.exec(String(c.observe));
    if (!m) return NONE('the case names no limits');
    const [maxSizes, maxWeights] = [numberWord(m[1]), numberWord(m[2])];
    const bad = [];
    for (const { el } of v.cards) {
      // Badges and tags are label chips (their type is the chip's, as the closed-scale check already treats them).
      const chipBox = (e) => /(?:^|\s)(?:tag|chip|badge)(?:\s|$)/.test(e.cls ?? '');
      const chip = (t) => chipBox(t) || v.badges.some((b) => b.i === t.i) || v.ancestors(t).some((a) => chipBox(a) || v.badges.some((b) => b.i === a.i));
      const texts = v.texts.filter((t) => v.ancestors(t).some((a) => a.i === el.i) && !v.inControl(t) && !chip(t));
      const sizes = new Set(texts.map((t) => t.style.fontSize)), weights = new Set(texts.map((t) => t.style.fontWeight));
      if (sizes.size > maxSizes || weights.size > maxWeights) bad.push(`${tag(el)}: ${sizes.size} sizes (${[...sizes].join('/')}), ${weights.size} weights (${[...weights].join('/')})`);
    }
    if (!v.cards.length) return NONE('no region (card) to count in');
    return bad.length ? FAIL(bad.join('; ')) : PASS(`every card within ${maxSizes} sizes and ${maxWeights} weights`);
  },
  'taste.yaml TASTE-7 case-2': (v, ctx, c) => {
    const m = /more than (\w+) levels/i.exec(String(c.observe));
    const max = m ? numberWord(m[1]) : null;
    if (max == null) return NONE('the case names no depth');
    const depth = (el) => v.ancestors(el).filter((a) => v.cards.some((x) => x.el.i === a.i)).length + 1;
    const deepest = Math.max(0, ...v.cards.map((x) => depth(x.el)));
    return deepest > max ? FAIL(`a card sits ${deepest} levels deep`) : PASS(`deepest card nesting ${deepest}`);
  },
  'taste.yaml TASTE-7 case-3': (v) => {
    const tops = v.cards.filter((c) => !c.nested);
    if (tops.length < 2) return NONE('fewer than two peer cards');
    const kinds = new Set(tops.map((c) => normalizeShadowText(c.el.style.shadow)));
    return kinds.size > 1 ? FAIL(`peer cards carry ${kinds.size} elevation treatments`) : PASS(`${tops.length} peer cards share one elevation`);
  },
  'taste.yaml TASTE-7 case-4': (v, ctx, c) => {
    const pill = /half its height/i.test(String(c.observe)) ? (e) => e.style.radius >= e.rect.h / 2 - 0.5 : () => false;
    const boxes = [...v.buttons, ...v.inputs, ...v.cards.filter((x) => x.nested).map((x) => x.el)].filter((e) => !pill(e));
    const pairs = boxes.map((e) => ({ e, card: v.containerOf(e) })).filter((p) => p.card && p.card.i !== p.e.i);
    if (!pairs.length) return NONE('no box-shaped control or surface inside a container');
    const bad = pairs.filter((p) => p.e.style.radius > p.card.style.radius + 0.5);
    return bad.length ? FAIL(bad.map((p) => `${tag(p.e)} radius ${r1(p.e.style.radius)}px in a ${r1(p.card.style.radius)}px container`).join('; ')) : PASS(`${pairs.length} box-shaped element(s) within their container's radius; pills are their own shape`);
  },
  'ux.yaml UX-9 case-1': (v, ctx) => {
    // The case observes "the narrowest declared viewport": a desktop capture is not it.
    if (ctx.width != null && ctx.width >= 768) return NONE(`${ctx.width}px is not the narrowest (mobile) viewport the case observes`);
    const primary = v.buttons.find((e) => sameColor(e.style.bg, ctx.probes['button.primary.bg']?.rgba)) ?? v.buttons.find((e) => e.type === 'submit');
    if (!primary) return NONE('no primary action rendered');
    const vh = ctx.height;
    const sticky = ['fixed', 'sticky'].includes(primary.style.position) || v.ancestors(primary).some((a) => ['fixed', 'sticky'].includes(a.style.position));
    const inLowerHalf = primary.rect.y >= vh / 2 && primary.rect.y + primary.rect.h <= vh;
    if (sticky || inLowerHalf) { return PASS(`${tag(primary)} at y ${r1(primary.rect.y)}-${r1(primary.rect.y + primary.rect.h)} of ${vh}${sticky ? ' (pinned)' : ''}`); } return FAIL(`${tag(primary)} at y ${r1(primary.rect.y)}-${r1(primary.rect.y + primary.rect.h)}; the fold is ${vh}px`);
  },
  'font.yaml FONT-4 case-1': (v, ctx) => {
    const h1 = v.els.filter((e) => e.visible && e.tag === 'h1');
    if (h1.length !== 1) return FAIL(`${h1.length} h1 elements`);
    return ctx.font4 != null && Math.abs(h1[0].style.fontSize - ctx.font4) > 0.5 ? FAIL(`h1 ${h1[0].style.fontSize}px, FONT-4 resolves to ${ctx.font4}px`) : PASS(`one h1 at ${h1[0].style.fontSize}px`);
  },
  'boundary.yaml BOUNDARY-6 case-1': (v, ctx) => {
    const tops = v.cards.filter((c) => !c.nested).map((c) => c.el);
    if (!tops.length) return NONE('no top-level card');
    const want = normalizeShadowText(ctx.probes['card.top.shadow']?.value);
    const bad = tops.filter((e) => v.borderOn(e) || normalizeShadowText(e.style.shadow) !== want);
    return bad.length ? FAIL(`${bad.map(tag).join(', ')}: border or shadow differs from ${want}`) : PASS(`${tops.length} top card(s): no border, the surface shadow`);
  },
  'boundary.yaml BOUNDARY-5 case-1': (v) => MEASURERS['anatomy-source.yaml ANATOMY-2 case-2'](v),
  'padding.yaml PADDING-4 case-2': (v, ctx) => fromSpacing(ctx, /^card-inset/),
  'padding.yaml PADDING-4 case-3': (v, ctx) => fromSpacing(ctx, /^disclosure trigger inset/),
  'padding.yaml PADDING-4 case-6': (v, ctx) => fromSpacing(ctx, /^band \d+ (top|bottom)$/, /PADDING-4 case-6/),
  'padding.yaml PADDING-4 case-7': (v, ctx) => fromSpacing(ctx, /^band \d+ inline$/),
  'padding.yaml PADDING-3 case-3': (v, ctx) => fromSpacing(ctx, /^band \d+ (top|bottom)$/, /PADDING-3 case-3/),
  'gap.yaml GAP-4 case-3': (v, ctx) => fromSpacing(ctx, /^field to field$/),
  'gap.yaml GAP-2 case-4': (v, ctx) => fromSpacing(ctx, /^badge to badge$/),
  'measure.yaml MEASURE-1 case-2': (v, ctx) => fromSpacing(ctx, /^page-inset$/),
  'boundary.yaml BOUNDARY-1 case-3': (v, ctx) => fromSpacing(ctx, /^band separators/),
};

function fromSpacing(ctx, idRe, sourceRe = null) {
  const rows = ctx.spacing.filter((s) => idRe.test(s.id) && (!sourceRe || sourceRe.test(s.source)));
  if (!rows.length || rows.every((r) => r.status === 'unmeasurable')) return NONE('nothing of that kind rendered');
  const bad = rows.filter((r) => r.status === 'fail');
  const text = (r) => r.id+' '+(typeof r.got==='number'?r.got+'px':r.got)+' (want '+(typeof r.exp==='number'?r.exp+'px':r.exp)+')'+(r.evidence?' '+r.evidence:'');
  return bad.length ? FAIL(bad.map(text).join('; ')) : PASS(`${rows.length} measured: ${rows.slice(0, 4).map(text).join('; ')}`);
}

function textContrast(v, ctx, large) {
  const m = RATIO_IN_CASE.exec(String(ctx.case.observe ?? ''));
  const floor = m ? Number(m[1]) : null;
  if (floor == null) return NONE('the case names no ratio');
  const lm = /`(\d+(?:\.\d+)?)px`.*?`(\d+(?:\.\d+)?)px`/.exec(String(ctx.largeWhen ?? ''));
  const [big, bigBold] = lm ? [Number(lm[1]), Number(lm[2])] : [null, null];
  if (big == null) return NONE('COLOR-5 case-2 names no large-text size');
  const isLarge = (e) => e.style.fontSize >= big || (e.style.fontSize >= bigBold && e.style.fontWeight >= 700);
  const runs = v.texts.filter((e) => isLarge(e) === large && e.style.color);
  if (!runs.length) return NONE(`no ${large ? 'large' : 'normal'} text rendered`);
  const measured = runs.map((e) => { const bg = v.bgOf(e); const fg = alphaOver(e.style.color, bg); return { e, ratio: contrastRatio(fg, bg) }; });
  const bad = measured.filter((x) => x.ratio < floor - 0.005).sort((a, b) => a.ratio - b.ratio);
  return bad.length ? FAIL(`${bad.length} run(s) under ${floor}:1, worst ${bad.slice(0, 3).map((x) => tag(x.e)+' '+x.ratio.toFixed(2)+':1').join(', ')}`) : PASS(`${runs.length} run(s) >= ${floor}:1 (lowest ${Math.min(...measured.map((x) => x.ratio)).toFixed(2)}:1)`);
}

function focusCheck(v) {
  const stops = (v.snap.focus ?? []).filter(Boolean);
  if (!stops.length) return NONE('keyboard focus reached no element');
  const bad = [];
  for (const f of stops) {
    const e = v.byI.get(f.i);
    const ring = f.outline.style !== 'none' && f.outline.w >= 1;
    const shadowChanged = e && normalizeShadowText(f.shadow) !== normalizeShadowText(e.style.shadow);
    if (!ring && !shadowChanged) bad.push(e ? tag(e) : `#${f.i}`);
  }
  return bad.length ? FAIL(`${bad.length}/${stops.length} focus stop(s) show no indicator: ${[...new Set(bad)].slice(0, 5).join(', ')}`) : PASS(`${stops.length} focus stop(s), each with an outline or ring`);
}

const stepValue = (knowledge, name, id) => remPx(knowledge.find((k) => k.rel.endsWith(`presentation/${name}.yaml`))?.doc.scale?.steps?.find((s) => s.id === id)?.value);

/** What every measurer and the spacing section read: the render's size, the family geometry at it, the knowledge steps. */
function scoreContext({ g, snap, viewport, repo, knowledge, scope }) {
  const width = viewport.width;
  const geoAt = g.ok ? (g.at.find((w) => w.width === width) ?? resolveGeometry({ repo, family: g.family, widths: [width], ...(g.sources?.drawCss) }).at?.[0] ?? g.at[0]) : null;
  const scale = (name, id) => stepValue(knowledge, name, id);
  return {
    knowledge, probes: snap.probes ?? {}, width, height: viewport.height,
    pageInset: scope?.variable('--grammar-page-inset')?.px ?? null,
    cardInset: geoAt?.card.content['padding-top']?.px ?? scale('padding', 'PADDING-4'),
    edgeInset: scale('padding', 'PADDING-4'), separatorInset: scale('padding', 'PADDING-3'),
    inputGap: scale('gap', 'GAP-2'), fieldGap: scale('gap', 'GAP-4'), badgeGap: scale('gap', 'GAP-2'),
    font4: fontPx(knowledge, 'FONT-4', scope),
    largeWhen: knowledge.find((k) => k.rel.endsWith('proof/contrast.yaml'))?.doc.rules.find((r) => r.id === 'COLOR-5')?.cases.find((c) => c.id === 'case-2')?.when,
  };
}

function measureCases(brief, v, ctx) {
  const results = [];
  for (const t of brief.topics) {
    for (const c of t.cases) {
      const measure = MEASURERS[`${path.basename(t.path)} ${c.rule} ${c.case}`];
      const r = measure ? measure(v, { ...ctx, case: c }, c) : NONE('no instrument measures this case on a static render');
      results.push({ path: t.path, rule: c.rule, case: c.case, ...r });
    }
  }
  return results;
}

const fontWeightsRow = (v, knowledge, scope) => {
  const weights = new Set(v.texts.map((e) => e.style.fontWeight));
  const fontGuidance = knowledge.find((k) => k.rel.endsWith('presentation/font.yaml'))?.doc.guidance?.find((x) => x.id === 'weight');
  const publicWeights = [...String(fontGuidance?.requirement ?? '').matchAll(/`font-(normal|medium|semibold)`/g)].map((m) => Number(scope?.variable(`--font-weight-${m[1]}`)?.value)).filter(Number.isFinite);
  if (!publicWeights.length) return null;
  const off = [...weights].filter((w) => !publicWeights.includes(w));
  return { id: 'font weights', source: 'knowledge/ui/presentation/font.yaml guidance weight', got: [...weights].join('/'), exp: publicWeights.join('/'), status: off.length ? 'fail' : 'pass', evidence: off.length ? `weights off the public set: ${off.join('/')}` : '' };
};

const fontSizesRow = (v, knowledge, scope) => {
  const sizes = [...new Set(v.texts.filter((e) => !v.inControl(e)).map((e) => e.style.fontSize))].sort((a, b) => a - b);
  const fontRules = knowledge.find((k) => k.rel.endsWith('presentation/font.yaml'))?.doc.rules ?? [];
  const scaleSizes = fontRules.map((r) => fontPx(knowledge, r.id, scope)).filter((n) => n != null);
  if (!scaleSizes.length) return null;
  const off = sizes.filter((s) => !scaleSizes.some((x) => Math.abs(x - s) < 0.5));
  return { id: 'font sizes', source: 'knowledge/ui/presentation/font.yaml scale (FONT-1..6)', got: sizes.join('/'), exp: scaleSizes.join('/'), status: off.length ? 'fail' : 'pass', evidence: off.length ? `sizes off the type scale: ${off.join('/')}px` : '' };
};

const fontFamilyRow = (v, g) => {
  if (!g.ok) return null;
  const families = [...new Set(v.texts.map((e) => firstFamily(e.style.fontFamily)).filter(Boolean))];
  return { id: 'font family', source: 'grammar-geometry.mjs family font', got: families.join(', '), exp: g.font.allowed.join(' or '), status: families.every((f) => g.font.allowed.includes(f)) ? 'pass' : 'fail', evidence: '' };
};

function scoreSummary(results, spacing) {
  const count = (s) => results.filter((r) => r.status === s).length + (s === 'unmeasurable' ? 0 : spacing.filter((r) => r.status === s).length);
  return { pass: count('pass'), fail: count('fail'), unmeasurable: results.filter((r) => r.status === 'unmeasurable').length };
}

/** Score an html render against the brief's applicable cases. */
export async function scoreRender(brief, html, { repo = null, viewport = DEFAULT_VIEWPORT } = {}) {
  const g = brief.geometry;
  const probes = g.ok ? geometryProbes(g) : {};
  const shot = await snapshotFiles([html], { repo, viewport, probes });
  if (!shot.ok) return { ok: false, error: shot.error };
  const snap = shot.snapshots[0];
  const v = readSnapshot(snap);
  const scope = g.ok ? tokenScope(g, viewport.width) : null;
  const knowledge = loadKnowledge();
  const ctx = scoreContext({ g, snap, viewport, repo, knowledge, scope });
  ctx.spacing = spacingChecks(v, ctx);
  const results = measureCases(brief, v, ctx);
  ctx.spacing.push(...[fontWeightsRow(v, knowledge, scope), fontSizesRow(v, knowledge, scope), fontFamilyRow(v, g)].filter(Boolean));
  const summary = scoreSummary(results, ctx.spacing);
  let htmlSha256 = null;
  try { htmlSha256 = sha256(fs.readFileSync(html)); } catch { htmlSha256 = null; }
  // htmlSha256 binds the score to the exact render source it scored (scripts/work/draw/draw-quality.mjs DRAW_SCORE_BELOW).
  return { schema: 'starci/ui-proof-score@1', ok: summary.fail === 0, file: html, htmlSha256, viewport, summary, cases: results, spacing: ctx.spacing };
}

function scoreText(s) {
  const lines = [`UI PROOF SCORE - ${s.file} at ${s.viewport.width}x${s.viewport.height}: ${s.summary.pass} pass, ${s.summary.fail} fail, ${s.summary.unmeasurable} unmeasurable.`, '', 'SPACING / PADDING'], value = (v) => typeof v === 'number' ? `${v}px` : v, evidence = (v) => v ? ` - ${v}` : '';
  for (const r of s.spacing) lines.push(`  ${r.status.toUpperCase().padEnd(12)} ${r.id}: ${value(r.got)} (want ${value(r.exp)}) - ${r.source}${evidence(r.evidence)}`);
  lines.push('', 'CASES');
  for (const c of s.cases) lines.push(`  ${c.status.toUpperCase().padEnd(12)} ${c.path} ${c.rule} ${c.case} - ${c.evidence}`);
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------

const USAGE = `Usage:
  starci work ui-proof-brief --surface <ui record path> --repo <repo> [--family <name>] [--elements a,b] [--json]
  starci work ui-proof-brief --surface <ui record path> --repo <repo> --score <html> [--viewport 390x844] [--json]
Element kinds: ${KIND_IDS.join(', ')}
`;

function plainBrief(b) {
  const g = b.geometry;
  return { ...b, geometry: g.ok ? { ok: true, family: g.family, entry: g.sources.entry, unbound: g.unbound } : { ok: false, errors: g.errors } };
}

/** The refusal of a bad argument set, or null when the arguments are complete. */
function argumentRefusal({ surface, repo, extra }) {
  const unknown = extra.filter((e) => !KIND_IDS.includes(e));
  if (unknown.length) return { exitCode: 2, text: `unknown element kind(s) ${unknown.join(', ')}\n${USAGE}` };
  if (!surface && !extra.length) return { exitCode: 2, text: `--surface <ui record path> is required\n${USAGE}` };
  if (!repo) return { exitCode: 2, text: `--repo <repo> is required\n${USAGE}` };
  return null;
}

/** The ui record of --surface ({record, file}), or {refusal} when it is missing or unreadable. */
function readSurfaceRecord(surface) {
  if (!surface) return { record: {}, file: null };
  const file = surfaceFile(surface);
  if (!fs.existsSync(file)) return { refusal: { exitCode: 2, text: `${surface}: no ui record\n` } };
  try { return { record: parseYaml(fs.readFileSync(file, 'utf8')) ?? {}, file }; } catch (error) { return { refusal: { exitCode: 2, text: `${file}: ${error.message}\n` } }; }
}

async function scoreCommand(brief, argv, { repo, html, json }) {
  if (!fs.existsSync(html)) return { exitCode: 2, text: `${html}: no such file\n` };
  const viewport = argOf(argv, '--viewport') ? parseViewport(argOf(argv, '--viewport')) : DEFAULT_VIEWPORT;
  if (!viewport) return { exitCode: 2, text: '--viewport is <width>x<height>\n' };
  const s = await scoreRender(brief, path.resolve(html), { repo, viewport });
  if (s.error) return { exitCode: 2, text: `ui-proof-brief: ${s.error}\n` };
  return { exitCode: s.ok ? 0 : 1, text: json ? `${JSON.stringify(s, null, 2)}\n` : scoreText(s) };
}

export async function uiProofBriefMain(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) return { exitCode: 0, text: USAGE };
  const json = argv.includes('--json');
  const surface = argOf(argv, '--surface');
  const repo = argOf(argv, '--repo');
  const family = argOf(argv, '--family');
  const extra = (argOf(argv, '--elements') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const refusal = argumentRefusal({ surface, repo, extra });
  if (refusal) return refusal;
  const read = readSurfaceRecord(surface);
  if (read.refusal) return read.refusal;
  const brief = buildBrief({ record: read.record, recordFile: read.file, repo, family, extra });
  if (!brief.geometry.ok) return { exitCode: 2, text: `ui-proof-brief: the product CSS did not resolve (${brief.geometry.errors.join('; ')})\n` };
  const html = argOf(argv, '--score');
  if (html) return scoreCommand(brief, argv, { repo, html, json });
  return { exitCode: 0, text: json ? `${JSON.stringify(plainBrief(brief), null, 2)}\n` : briefText(brief) };
}

if (isMain(import.meta.url)) {
  const result = await uiProofBriefMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
