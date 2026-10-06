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
import { contrastRatio as wcagRatio } from '../brand/brand.mjs';
import { flag as argOf } from '../work-io.mjs';
import { squash } from '../../lib/clip.mjs'; import { isMain } from '../../lib/is-main.mjs';
import { alphaOver } from '../../lib/color.mjs'; import { byCodeUnit } from '../../lib/list.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const KNOWLEDGE = path.join(ROOT, 'knowledge', 'ui');
const LAYERS = ['proof', 'presentation', 'composition'];
const REM_PX = 16;

// ---------------------------------------------------------------------------------------------------------
// Element kinds: how a surface declares one, and how a case's `when` names one
// ---------------------------------------------------------------------------------------------------------

/** detect: read on the ui record text; trigger: read on a case's when/governs; always: every surface has it. */
export const KINDS = [
  { id: 'field', detect: /\b(Input|TextField|Textarea|NumberField|SearchField|DateField|TimeField|OtpInput|Select|ComboBox|PressableField|Checkbox|Switch|RadioGroup|Slider)\b|\bfields?\b|\bforms?\b/i, trigger: /\bfields?\b|\binputs?\b|\bforms?\b|validation|autofill|keypad|\bis filled\b/i, components: ['Input', 'Textarea', 'NumberField', 'SearchField', 'OtpInput', 'PressableField', 'Label'] },
  { id: 'button', detect: /\bButton\b|IconButton|\bsubmit\b|\bCTA\b|call to action/i, trigger: /\bbuttons?\b|\bcommands?\b|call to action|\bCTA\b|IconButton|primary action|\bactions?\b(?! band)|\bconfirm\b/i, components: ['Button', 'IconButton'] },
  { id: 'link', detect: /TextAction|\bLink\b|\bhref\b|destinations?|navigat/i, trigger: /\bdestinations?\b|\blinks?\b/i, components: ['TextAction', 'Link'] },
  { id: 'selection', detect: /\bTabs?\b|Subnav|Segment|tablist|\bselected\b|\bchoice\b|RadioGroup|Checkbox|Switch|ToggleButton|Disclosure|Accordion/i, trigger: /\btabs?\b|selection|\bselected\b|\bpeers?\b|disclosures?|\bexpanded\b|arrow-key|\bchoice/i, components: ['Tabs', 'Subnav', 'SurfaceAccordionCard'] },
  { id: 'card', detect: /SurfaceCard|SurfaceListCard|SurfaceAccordionCard|EmptyNotice|\bcards?\b|\bpanels?\b|\bbands?\b/i, trigger: /\bcards?\b|\bpanels?\b|\bbands?\b|\bcontainers?\b|\bcells?\b|flush surface|inside a surface|surface that already owns|\bcolumns\b/i, components: ['SurfaceCard', 'SurfaceListCard', 'EmptyNotice'] },
  { id: 'nested', detect: /\bnested\b|\bjoined\b|\bbands?\b|inside (a|the|its) (card|surface|panel)/i, trigger: /nested inside another|surface is nested|card nesting|\bnested\b/i, components: [] },
  { id: 'badge', detect: /\bBadge\b|\bChip\b|\bTag\b|StateMark|status pill|\bpill\b/i, trigger: /\bbadges?\b|\bchips?\b|\btags?\b|state mark/i, components: ['Badge', 'StateMark'] },
  { id: 'row', detect: /\brows?\b|\blists?\b|\btables?\b|StaticStateRow|SurfaceListCard|collection|\bitems\b|\bentries\b|\brecords\b/i, trigger: /(?<!app-owned )\brows?\b(?!\s+of\b)|\blists?\b|\btables?\b|collection|record count|representative volume|below-volume|grid row/i, components: ['SurfaceListCard', 'StaticStateRow'] },
  { id: 'image', detect: /\bimg\b|\bimages?\b|illustration|mascot|MediaFrame|artwork|Avatar|photo|picture/i, trigger: /\bimages?\b|illustration|mascot|artwork|picture|photograph|imagery|decorative (art|image)/i, components: ['MediaFrame', 'Image', 'Avatar'] },
  { id: 'icon', detect: /\bIcon\b|IconButton|IconTile|\bglyphs?\b/i, trigger: /\bglyphs?\b|\bicons?\b|icon-only/i, components: ['Icon', 'IconTile', 'IconButton'] },
  { id: 'meter', detect: /\bMeter\b|Progress|ProgressCircle|Rating|bar chart/i, trigger: /rendered as bars|\bbars?\b|\bmeasurement renders|\bmeter\b/i, components: ['Meter', 'Progress', 'ProgressCircle'] },
  { id: 'overlay', detect: /\bmodal\b|\bdrawer\b|\bdialog\b|popover|\bsheet\b|overlay|Tooltip/i, trigger: /\bmodal\b|\bdrawer\b|\bdialog\b|popover|overlay|non-modal|tooltip/i, components: ['Dialog', 'Drawer', 'Popover', 'Tooltip'] },
  { id: 'sticky', detect: /\bsticky\b/i, trigger: /\bsticky\b/i, components: [] },
  { id: 'navigation', detect: /\bnav\b|navigation|Sidebar|BottomNav|breadcrumb|TopBar|\brail\b/i, trigger: /navigation|\bnav\b|sidebar|\brails?\b|breadcrumb|conversation rail/i, components: ['Sidebar', 'BottomNav', 'Subnav', 'ChatWorkspace'] },
  { id: 'code', detect: /FencedCodeBlock|code block|\bcode\b/i, trigger: /code block/i, components: ['FencedCodeBlock'] },
  { id: 'motion', detect: /animat|transition|spinner|skeleton|highlight|\bmotion\b|shimmer/i, trigger: /animat|\bmotion\b|transition runs|movement|choreograph|\bflashes\b|duration|easing/i, components: [] },
  { id: 'loading', detect: /loading|pending|\bworking\b|\bbusy\b|skeleton|in progress|submitting/i, trigger: /\bloading\b|\bpending\b|in progress|in flight|work outlasts|\bbusy\b|waited|accepted work/i, components: ['Skeleton', 'Spinner'] },
  { id: 'empty', detect: /\bempty\b|no (items|records|data|results)/i, trigger: /\bempty\b/i, components: ['EmptyNotice'] },
  { id: 'error', detect: /\berror|refus|reject|\bfail|invalid|denied/i, trigger: /\berror|refus|reject|\binvalid|failing|wrong value|permission refusal|destructive|\bwarning\b/i, components: [] },
  { id: 'success', detect: /success|\bdone\b|completed|confirmed|\bsent\b|\bsaved\b|outcome/i, trigger: /\bsuccess|\boutcome\b|result is claimed|terminal success/i, components: [] },
  { id: 'disabled', detect: /disabled|unavailable|isDisabled|read-only/i, trigger: /\bdisabled\b|\bunavailable\b/i, components: [] },
  { id: 'dark', detect: /\bdark\b/i, trigger: /\bdark\b|theme changes|each theme|every theme/i, components: [] },
  { id: 'control', always: (present) => ['field', 'button', 'link', 'selection'].some((k) => present.has(k)), trigger: /\bcontrols?\b|interactive|\btargets?\b|\btouch\b|keyboard|\bfocus|\bhover|activat|operable|tab order|pointer/i, components: [] },
  { id: 'heading', always: () => true, trigger: /\bheadings?\b|\btitles?\b|page title|\banchor\b|outline entry/i, components: ['Heading', 'SectionHeader'] },
  { id: 'text', always: () => true, trigger: /\btext\b|\bcopy\b|\blabels?\b|paragraph|sentence|\bwords?\b|\bfont\b|characters|\bmessage\b|\bnumber\b|\bdate\b/i, components: ['Text', 'Label'] },
  { id: 'page', always: () => true, trigger: /viewport|\bnarrow|\bzoom|reflow|breakpoint|one-handed|\bthumb\b|reach zone|\bcapture\b|\bframe\b|first glance|three seconds|\bdensity\b|\bview\b|\bscreen\b|\bpage\b|\bregion\b|\blayout\b|\bsection\b/i, components: ['PageContainer'] },
  { id: 'brand', always: () => true, trigger: /\bbrand\b|colou?r|palette|\bhues?\b|saturated|\baccent\b|gradient|swatch|forced colou?rs/i, components: [] },
  { id: 'direction', always: () => true, trigger: /direction|\bprompt\b|reference render|ImageGen|grammar component|grammar package|component inventory|\banatomy\b/i, components: [] },
];
const KIND_IDS = KINDS.map((k) => k.id);
const STATE_KINDS = new Set(['loading', 'empty', 'error', 'success', 'disabled', 'dark', 'motion']);

/** Cases only an evaluation lens or a running UAT observes: listed as not applicable to a drawing. */
const LENS_ONLY = /lens runs|verdict is computed|criterion has no observation|failure has been measured|lens is scored|score is recorded|audit scope selects|below-volume or data-bound|explicitly accepts a measured|every canon rule passed|taste criterion fails|references disagree with a canon|direction decision is read|placed beside those references|gap is described|declares a presentation delta|never measured|one of the two captures is missing|no store or authority|summari[sz]ed in the current/i;
const RUN_ONLY = /(?:^(the )?run\b)|\bthe run (reaches|is driven|completes|submits|presses|reloads|navigates|leaves)|returning person|\bin the run\b|mid-flow|fresh session/i;

// ---------------------------------------------------------------------------------------------------------
// The surface
// ---------------------------------------------------------------------------------------------------------

const flatText = (v) => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.map(flatText).join('\n') : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}: ${flatText(x)}`).join('\n') : String(v));

/** The ui record file for a path (the index.yaml itself or its directory). */
function surfaceFile(p) {
  const abs = path.resolve(p);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return path.join(abs, 'index.yaml');
  return abs;
}

/** The element kinds and component names a surface uses, each with the record text that shows it. */
export function surfaceElements(record, { extra = [] } = {}) {
  const ui = record?.ui ?? {};
  const components = (ui.coverage?.map ?? []).flatMap((m) => m?.components ?? []).map(flatText);
  const structure = [flatText(components), flatText(ui.intent), flatText(ui.surfaces), flatText(record?.title), flatText(record?.surface), flatText(record?.anatomy ?? ui.anatomy), flatText(record?.regions ?? ui.regions)].join('\n');
  const text = `${structure}\n${flatText(ui.states)}`;
  const present = new Map();
  for (const k of KINDS) {
    if (k.always) continue;
    const m = k.detect.exec(STATE_KINDS.has(k.id) ? text : structure);
    if (m) present.set(k.id, `record: "${m[0]}"`);
  }
  if (['modal', 'drawer'].includes(record?.surface) || (record?.surface && typeof record.surface === 'object' && Object.values(record.surface).some((v) => ['modal', 'drawer'].includes(v)))) present.set('overlay', 'record: surface modal/drawer');
  if (present.has('field') && present.has('card')) present.set('nested', present.get('nested') ?? 'record: fields inside a card');
  for (const e of extra) if (KIND_IDS.includes(e)) present.set(e, '--elements');
  const keys = new Set(present.keys());
  for (const k of KINDS) if (k.always?.(keys)) { present.set(k.id, 'every surface'); keys.add(k.id); }
  const named = new Set();
  for (const m of structure.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+|Button|Input|Tabs|Badge|Text|Label|Heading|Icon|Tooltip|Select|Chip)\b/g)) named.add(m[1]);
  for (const k of KINDS) if (present.has(k.id) && k.components.length) named.add(k.components[0]);
  return { kinds: present, components: named };
}

// ---------------------------------------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------------------------------------

/** Every knowledge/ui/{proof,presentation,composition}/*.yaml topic (index files excluded). */
export function loadKnowledge(root = KNOWLEDGE) {
  const out = [];
  for (const layer of LAYERS) {
    const dir = path.join(root, layer);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.yaml') && x !== 'index.yaml').sort()) {
      const file = path.join(dir, f);
      out.push({ layer, file, rel: path.relative(ROOT, file).split(path.sep).join('/'), doc: parseYaml(fs.readFileSync(file, 'utf8')) });
    }
  }
  return out;
}

const kindsIn = (text) => KINDS.filter((k) => k.trigger.test(String(text ?? ''))).map((k) => k.id);
const ownerComponents = (owner) => [...String(owner ?? '').matchAll(/`([A-Z][A-Za-z]+)`/g)].map((m) => m[1]).filter((n) => n !== 'App');

/** Classify one case: applicable (with the kinds that made it so) or not, with the reason. */
export function classifyCase(rule, c, elements) {
  const when = String(c.when ?? '');
  if (LENS_ONLY.test(when) || LENS_ONLY.test(String(rule.governs ?? ''))) return { applies: false, reason: 'evaluation lens bookkeeping' };
  if (RUN_ONLY.test(when.trim())) return { applies: false, reason: 'observed only in a running UAT' };
  // A case may name the element kinds that bring it into play (`elements`, any of them): applicability by
  // component presence, never by how its prose happens to be worded (2026-09-28: MEASURE-4 case-3 names "a
  // game table" as an example, so reading its text asked for a row and a sign-in form never got it).
  const declared = Array.isArray(c.elements) ? c.elements.filter((k) => KIND_IDS.includes(k)) : [];
  if (declared.length) {
    if (!declared.some((k) => elements.kinds.has(k))) return { applies: false, reason: `needs ${declared.join(' or ')}`, kinds: declared, from: 'elements' };
    const present = declared.filter((k) => elements.kinds.has(k));
    const owners = ownerComponents(c.owner);
    if (owners.length && !owners.some((o) => elements.components.has(o))) return { applies: false, reason: `owner ${owners.join('/')} not on this surface`, kinds: present, from: 'elements' };
    return { applies: true, kinds: present, from: 'elements', owners };
  }
  let kinds = kindsIn(when);
  let from = 'when';
  if (!kinds.length) { kinds = kindsIn(rule.governs); from = 'governs'; }
  const missing = kinds.filter((k) => !elements.kinds.has(k));
  if (missing.length) return { applies: false, reason: `needs ${missing.join(', ')}`, kinds, from };
  const owners = ownerComponents(c.owner);
  if (owners.length && !owners.some((o) => elements.components.has(o))) return { applies: false, reason: `owner ${owners.join('/')} not on this surface`, kinds, from };
  return { applies: true, kinds, from, owners };
}

// ---------------------------------------------------------------------------------------------------------
// Numbers: rem values, Tailwind classes and CSS tokens resolved through the product cascade
// ---------------------------------------------------------------------------------------------------------

const remPx = (v) => { const m = /^(-?\d*\.?\d+)(rem|px)?$/.exec(String(v ?? '').trim()); return m ? Number(m[1]) * (m[2] === 'px' ? 1 : REM_PX) : null; };
const fmtPx = (n) => (n == null ? '?' : `${Math.round(n * 10) / 10}px`);

/** A token lookup over the family root at one width: `variable(name)` -> {value, px}. */
function tokenScope(g, width) {
  if (!g?.ok) return null;
  const el = g.resolver.memo(`root-${width}`, [g.chains.html, g.chains.root], width);
  return { variable: (name) => el.variable(name), width };
}

const SPACING = /^(-?)(p|px|py|pt|pb|ps|pe|pl|pr|m|mx|my|mt|mb|ms|me|ml|mr|gap|gap-x|gap-y|space-x|space-y|size|min-h|min-w|w|h)-(\d+(?:\.\d+)?)$/;

/** The px a single utility class resolves to under the family, or null when it carries no number. */
export function classValue(cls, scope) {
  const bare = cls.replace(/^([a-z0-9-]+:)+/, '');
  const variant = cls.slice(0, cls.length - bare.length).replace(/:$/, '') || null;
  const spacingVar = scope?.variable('--spacing');
  const spacing = spacingVar?.px ?? null;
  let m = bare.match(SPACING);
  if (m) {
    const n = Number(m[3]) * (m[1] ? -1 : 1);
    return spacing == null ? null : { cls, variant, px: n * spacing, how: `${m[3]} x --spacing (${spacingVar.value})` };
  }
  m = bare.match(/^rounded(?:-([trbl]{1,2}))?(?:-(none|xs|sm|md|lg|xl|2xl|3xl|4xl|full))?$/);
  if (m) {
    const size = m[2] ?? null;
    if (size === 'none') return { cls, variant, px: 0, how: 'none' };
    if (size === 'full') return { cls, variant, px: Infinity, how: 'a corner larger than the box (pill)' };
    const v = size ? scope?.variable(`--radius-${size}`) : scope?.variable('--radius');
    return v?.px != null ? { cls, variant, px: v.px, how: `--radius${size ? `-${size}` : ''}: ${v.value}` } : { cls, variant, px: null, how: `--radius-${size} is not bound by the cascade` };
  }
  m = bare.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)$/);
  if (m) {
    const size = scope?.variable(`--text-${m[1]}`);
    const lh = scope?.variable(`--text-${m[1]}--line-height`);
    const ratio = lh?.value != null ? Number(evalRatio(lh.value)) : null;
    return size?.px != null ? { cls, variant, px: size.px, lineHeight: ratio ? Math.round(size.px * ratio * 10) / 10 : null, how: `--text-${m[1]}: ${size.value}` } : null;
  }
  m = bare.match(/^leading-(\d+(?:\.\d+)?)$/);
  if (m && spacing != null) return { cls, variant, px: Number(m[1]) * spacing, how: `line-height ${m[1]} x --spacing` };
  m = bare.match(/^font-(normal|medium|semibold|bold)$/);
  if (m) { const w = scope?.variable(`--font-weight-${m[1]}`); return w ? { cls, variant, weight: Number(w.value), how: `--font-weight-${m[1]}: ${w.value}` } : null; }
  m = bare.match(/^border(?:-([trblxy]))?(?:-(\d+))?$/);
  if (m) return { cls, variant, px: m[2] ? Number(m[2]) : 1, how: 'border width' };
  return null;
}

const evalRatio = (v) => { const m = /^calc\(([\d.]+)\/([\d.]+)\)$/.exec(String(v).replace(/\s+/g, '')); if (m) return Number(m[1]) / Number(m[2]); const n = Number(v); return Number.isFinite(n) ? n : null; };

/** Every utility class spelled in a render/title string, with its resolved value. */
export function classesIn(text, scope) {
  const out = [];
  const seen = new Set();
  for (const m of String(text ?? '').matchAll(/`([^`]+)`|className="([^"]+)"/g)) {
    for (const raw of (m[1] ?? m[2]).split(/[\s"'<>{}=]+/)) {
      const cls = raw.replace(/^\[|\]$/g, '').trim();
      if (!cls || seen.has(cls)) continue;
      const v = classValue(cls, scope);
      if (v) { seen.add(cls); out.push(v); }
    }
  }
  return out;
}

const describeClass = (v) => `${v.cls} = ${v.px === Infinity ? 'pill' : v.px != null ? fmtPx(v.px) : v.weight ?? '?'}${v.lineHeight ? `/${fmtPx(v.lineHeight)}` : ''}${v.variant ? ` (at ${v.variant})` : ''}`;
const withPx = (text) => String(text ?? '').replace(/(^|[^\w.])(\d*\.?\d+)rem\b/g, (all, pre, n) => `${pre}${n}rem (${fmtPx(Number(n) * REM_PX)})`);

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
    const doc = k.doc;
    const steps = new Map((doc.scale?.steps ?? []).filter((s) => s.id && s.id !== '—').map((s) => [s.id, s]));
    const cases = [];
    const skipped = [];
    for (const rule of doc.rules ?? []) {
      for (const c of rule.cases ?? []) {
        const cls = classifyCase(rule, c, elements);
        const id = `${rule.id} ${c.id}`;
        if (!cls.applies) { skipped.push({ id, reason: cls.reason }); continue; }
        const entry = { path: k.rel, rule: rule.id, case: c.id, title: rule.title, when: c.when, observe: c.observe ?? null, assert: c.assert ?? null, owner: c.owner ?? null, render: c.render ?? null, kinds: cls.kinds };
        if (k.layer === 'presentation') {
          const step = steps.get(rule.id);
          const stepPx = remPx(step?.value);
          entry.numbers = [
            ...(step?.value != null ? [{ what: `${rule.id} scale step`, text: `${step.value}${stepPx != null ? ` = ${fmtPx(stepPx)}` : ''}${step.token ? ` (${step.token})` : ''}` }] : []),
            ...classesIn(`${rule.title ?? ''} ${c.render ?? ''}`, scope).map((v) => ({ what: 'class', text: describeClass(v), value: v })),
          ];
          if (step?.token && scope) {
            const vals = scopes.map((s) => ({ width: s.width, v: s.variable(step.token) }));
            const text = vals.map(({ width, v }) => `${v?.px != null ? fmtPx(v.px) : v?.value ?? 'unbound'} at ${width}px`).join(', ');
            entry.numbers.push({ what: `${step.token} in the product CSS`, text });
            const bound = vals[0].v?.px;
            if (stepPx != null && bound != null && Math.abs(bound - stepPx) > 0.5) conflicts.push({ kind: 'knowledge-vs-css', text: `${k.rel} ${rule.id} scale step is ${step.value} (${fmtPx(stepPx)}), but ${step.token} binds ${fmtPx(bound)} in the product CSS` });
          }
        }
        cases.push(entry);
      }
    }
    const guidance = (doc.guidance ?? []).map((gd) => ({ id: gd.id, title: gd.title, requirement: withPx(gd.requirement) }));
    const owned = (doc.componentOwnership?.rows ?? []).filter((r) => r.component && elements.components.has(r.component));
    for (const r of owned) {
      const step = r.rule ? steps.get(r.rule) : null;
      ownedRows.push({ path: k.rel, component: r.component, element: r.element, rule: r.rule ?? null, value: step?.value ?? null, px: remPx(step?.value) });
    }
    const scaleNotes = doc.scale?.notes ? withPx(doc.scale.notes) : null;
    topics.push({ path: k.rel, layer: k.layer, id: doc.id, title: doc.title, cases, skipped, guidance: cases.length ? guidance : [], scaleNotes: cases.length ? scaleNotes : null });
  }
  // Two rules claiming one component element.
  const byElement = new Map();
  for (const r of ownedRows) { const key = `${r.path} ${r.component} | ${r.element}`; if (!byElement.has(key)) byElement.set(key, []); byElement.get(key).push(r); }
  for (const [key, rows] of byElement) {
    const rules = [...new Set(rows.map((r) => r.rule).filter(Boolean))];
    if (rules.length > 1) conflicts.push({ kind: 'two-owners', text: `${key.split(' ')[0]}: ${rows[0].component} "${rows[0].element}" is owned by ${rules.map((id) => `${id}${rows.find((r) => r.rule === id)?.px != null ? ` (${fmtPx(rows.find((r) => r.rule === id).px)})` : ''}`).join(' and ')} - the knowledge row does not say which condition selects each` });
  }
  // A component-owned knowledge value against what Grammar's CSS binds.
  const cssFacts = [];
  if (g.ok) {
    for (const spec of OWNED_CSS(g.chains)) {
      const rows = ownedRows.filter((r) => r.component === spec.component && spec.element.test(r.element));
      if (!rows.length) continue;
      const el = g.resolver.element(spec.chain, widths[0]);
      const v = el.get(spec.prop);
      for (const r of rows) {
        const want = r.px ?? (r.rule?.startsWith('FONT-') ? fontPx(knowledge, r.rule, scope) : null);
        cssFacts.push({ path: r.path, component: r.component, element: r.element, rule: r.rule, knowledge: want, css: v?.px ?? null, declared: v?.declared ?? null, file: v?.file ?? null, prop: spec.prop });
        if (want != null && v?.px != null && Math.abs(want - v.px) > 0.5) conflicts.push({ kind: 'knowledge-vs-css', text: `${r.path} ${r.component} "${r.element}" is ${r.rule} (${fmtPx(want)}), but Grammar's CSS binds ${spec.prop} ${fmtPx(v.px)} (\`${v.declared}\`) - the CSS renders; the knowledge row needs the owner's correction` });
      }
    }
  }
  return { schema: 'starci/ui-proof-brief@1', surface: recordFile, record: record?.id ?? null, elements: { kinds: Object.fromEntries(elements.kinds), components: [...elements.components].sort(byCodeUnit) }, geometry: g, topics, ownedRows, cssFacts, conflicts };
}

function fontPx(knowledge, ruleId, scope) {
  const font = knowledge.find((k) => k.rel.endsWith('presentation/font.yaml'));
  const rule = font?.doc.rules?.find((r) => r.id === ruleId);
  const v = classesIn(rule?.title, scope).find((x) => x.cls.replace(/^([a-z0-9-]+:)+/, '').startsWith('text-'));
  return v?.px ?? null;
}

/** The brief as text. */
export function briefText(b) {
  const lines = [];
  lines.push(`UI PROOF BRIEF - ${b.record ?? 'surface'}${b.surface ? ` (${path.relative(process.cwd(), b.surface).split(path.sep).join('/')})` : ''}`,
    `Elements: ${Object.entries(b.elements.kinds).map(([k, why]) => `${k} [${why}]`).join('; ')}.`,
    `Components: ${b.elements.components.join(', ') || 'none named'}.`,
    b.geometry.ok ? `Numbers resolved through the product CSS (family ${b.geometry.family}, ${b.geometry.sources.entry ? path.relative(b.geometry.sources.repo, b.geometry.sources.entry).split(path.sep).join('/') : 'installed packages'}).` : `Numbers: knowledge values only (${b.geometry.errors.join('; ')}).`,
    '',
    `CONFLICTS (${b.conflicts.length}) - named, not resolved here:`);
  for (const c of b.conflicts) lines.push(`- [${c.kind}] ${c.text}`);
  if (!b.conflicts.length) lines.push('- none found');
  for (const layer of LAYERS) {
    lines.push('', `== ${layer.toUpperCase()} ==`);
    for (const t of b.topics.filter((x) => x.layer === layer)) {
      if (!t.cases.length && !t.skipped.length) continue;
      lines.push('', `# ${t.path} - ${t.title} (${t.cases.length} applicable, ${t.skipped.length} not)`);
      if (t.scaleNotes) lines.push(`  scale: ${squash(t.scaleNotes)}`);
      for (const c of t.cases) {
        lines.push(`- ${t.path} ${c.rule} ${c.case} [${c.title ? squash(c.title) : ''}] when: ${squash(c.when)}`);
        if (c.observe) lines.push(`    observe: ${squash(c.observe)}`);
        if (c.assert) lines.push(`    assert: ${squash(c.assert)}`);
        if (c.owner || c.render) lines.push(`    owner ${squash(c.owner) || '-'}; render: ${squash(c.render) || '-'}`);
        if (c.numbers?.length) lines.push(`    numbers: ${c.numbers.map((n) => n.text).join('; ')}`);
      }
      for (const gd of t.guidance) lines.push(`- ${t.path} guidance ${gd.id}: ${squash(gd.requirement)}`);
      if (t.skipped.length) lines.push(`  not applicable: ${t.skipped.map((s) => `${s.id} (${s.reason})`).join('; ')}`);
    }
  }
  if (b.ownedRows.length) {
    lines.push('', '== COMPONENT-OWNED VALUES (compose the component; never restate them in app classes) ==');
    for (const r of b.ownedRows) {
      const fact = b.cssFacts.find((f) => f.path === r.path && f.component === r.component && f.element === r.element);
      lines.push(`- ${r.path} ${r.component} "${r.element}": ${r.rule ?? '(no rule)'}${r.px != null ? ` = ${fmtPx(r.px)}` : ''}${fact?.css != null ? `; CSS ${fact.prop} ${fmtPx(fact.css)} (\`${fact.declared}\`)` : ''}`);
    }
  }
  if (b.geometry.ok) {
    const a = b.geometry.at[0];
    lines.push('',
      '== GRAMMAR GEOMETRY (grammar-geometry.mjs) ==',
      `- button radius ${fmtPx(a.button['border-radius']?.px)}, height ${fmtPx(a.button.heightPx)} (full width min ${fmtPx(a.button.fill['min-height']?.px)}), padding-inline ${fmtPx(a.button['padding-left']?.px)}; input radius ${fmtPx(a.input.primary['border-radius']?.px)}, height ${fmtPx(a.input.primary.heightPx)}, padding ${fmtPx(a.input.primary['padding-top']?.px)} ${fmtPx(a.input.primary['padding-left']?.px)}, no border, secondary fill ${a.input.secondary['background-color']?.value} inside a surface.`,
      `- card radius ${fmtPx(a.card.top['border-radius']?.px)}, no border, shadow ${normalizeShadowText(a.card.top['box-shadow']?.value)}; content inset ${fmtPx(a.card.content['padding-top']?.px)}; joined inset ${fmtPx(a.card.joined['padding-top']?.px)} gap ${fmtPx(a.card.joined['row-gap']?.px)}; external label to card ${fmtPx(a.card.labelGap?.px)}; badge radius ${fmtPx(a.badge['border-radius']?.px)} height ${fmtPx(a.badge.heightPx)}; font ${b.geometry.font.binding?.value}.`);
    const inset = b.geometry.resolver.memo('inset-root', [b.geometry.chains.html, b.geometry.chains.root], 390).variable('--grammar-page-inset');
    const unbound = b.geometry.unbound.filter((u) => /radius|shadow|surface|font/.test(u.name));
    if (unbound.length) lines.push(`- declared by the ${b.geometry.family} family and read by nothing, so never drawn: ${unbound.map((u) => `${u.name} ${u.value}`).join('; ')}.`);
    if (inset) lines.push(`- page inset --grammar-page-inset ${inset.declared} = ${b.geometry.widths.map((w) => `${fmtPx(b.geometry.resolver.memo(`inset-${w}`, [b.geometry.chains.html, b.geometry.chains.root], w).variable('--grammar-page-inset')?.px)} at ${w}px`).join(', ')} (PageContainer).`);
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------------------
// Scoring a render
// ---------------------------------------------------------------------------------------------------------

const contrastRatio = (a, b) => wcagRatio({ rgb: a.slice(0, 3) }, { rgb: b.slice(0, 3) });

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const numberWord = (w) => (WORDS[String(w).toLowerCase()] ?? Number(w));
const r1 = (n) => Math.round(n * 10) / 10;
const tag = (e) => `${e.tag}${e.own ? ` "${e.own.slice(0, 28)}"` : ''}`;

const PASS = (evidence) => ({ status: 'pass', evidence });
const FAIL = (evidence) => ({ status: 'fail', evidence });
const NONE = (evidence) => ({ status: 'unmeasurable', evidence });

/** The content extent inside a box: the union of its text-bearing, control and painted descendants. */
function contentExtent(v, box, within = null) {
  const inside = (e) => e.rect.x >= box.rect.x - 0.5 && e.rect.x + e.rect.w <= box.rect.x + box.rect.w + 0.5 && e.rect.y >= (within?.top ?? box.rect.y) - 0.5 && e.rect.y + e.rect.h <= (within?.bottom ?? box.rect.y + box.rect.h) + 0.5;
  const band = (e) => !e.own && e.rect.w >= box.rect.w - 1.5;
  // A transparent box whose edge is painted (a border on every side, or an inset/outline shadow - an off chip) shows
  // that edge, so its outer box is the content's extent, not its text.
  const outlined = (e) => (e.style.border.every((b) => b.w > 0 && b.style !== 'none' && alphaOf(b.color) > 0)) || (typeof e.style.shadow === 'string' && e.style.shadow !== 'none' && e.style.shadow !== '');
  const desc = v.els.filter((e) => e.visible && e.i !== box.i && v.ancestors(e).some((a) => a.i === box.i) && inside(e) && (e.own || v.isControl(e) || ((alphaOf(e.style.bg) > 0 || outlined(e)) && !band(e) && e.rect.h < (within ? within.bottom - within.top : box.rect.h) - 2)));
  if (!desc.length) return null;
  const boxOf = (e) => {
    if (!e.own || v.isControl(e)) return { top: e.rect.y, bottom: e.rect.y + e.rect.h, left: e.rect.x, right: e.rect.x + e.rect.w };
    const [pt, pr, pb, pl] = e.style.padding;
    const [bt, br, bb, bl] = e.style.border.map((b) => (b.style === 'none' ? 0 : b.w));
    return { top: e.rect.y + pt + bt, bottom: e.rect.y + e.rect.h - pb - bb, left: e.rect.x + pl + bl, right: e.rect.x + e.rect.w - pr - br };
  };
  // An inline-level box (a badge span, an inline run of text) is placed inside its parent's line box: the strut and
  // vertical-align put its own rect a couple of pixels below the line's top (a 20px badge in a 24px line sits 2px in).
  // That offset is line-box alignment, not spacing - the inset the CSS draws ends at the parent's content edge. On the
  // first (last) line of its parent the box's top (bottom) is read at that content edge; anything farther in stays.
  const lineAligned = (e, b) => {
    if (!String(e.style.display ?? '').startsWith('inline')) return b;
    const p = e.parent != null ? v.byI.get(e.parent) : null;
    if (!p) return b;
    const [pt, , pb] = p.style.padding;
    const [bt, , bb] = p.style.border.map((x) => (x.style === 'none' ? 0 : x.w));
    const cTop = p.rect.y + pt + bt, cBottom = p.rect.y + p.rect.h - pb - bb;
    // The first line's box is at least the parent's line-height (its strut); a `normal` line-height is bounded by
    // half an em of alignment room.
    const slack = Math.max((p.style.lineHeight ?? 0) - e.rect.h, (p.style.fontSize || 16) * 0.5, 0) + 0.5;
    const out = { ...b };
    if (e.rect.y >= cTop - 0.5 && e.rect.y - cTop <= slack) out.top = Math.min(b.top, cTop);
    const eb = e.rect.y + e.rect.h;
    if (eb <= cBottom + 0.5 && cBottom - eb <= slack) out.bottom = Math.max(b.bottom, cBottom);
    return out;
  };
  const boxes = desc.map((e) => lineAligned(e, boxOf(e)));
  return { top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)), left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)) };
}

/** Full-width hairlines inside a card: borders on children spanning >= 80% of it, or <= 2px painted rules. */
function hairlines(v, card) {
  const cr = card.rect;
  const ys = [];
  for (const e of v.els.filter((x) => x.visible && v.ancestors(x).some((a) => a.i === card.i) && !v.isControl(x))) {
    if (e.rect.w < cr.w * 0.8) continue;
    const [top, , bottom] = e.style.border;
    if (top.w >= 1 && top.style !== 'none' && alphaOf(top.color) > 0) ys.push({ y: e.rect.y, left: e.rect.x, right: e.rect.x + e.rect.w });
    if (bottom.w >= 1 && bottom.style !== 'none' && alphaOf(bottom.color) > 0) ys.push({ y: e.rect.y + e.rect.h - bottom.w, left: e.rect.x, right: e.rect.x + e.rect.w });
    if (e.rect.h > 0 && e.rect.h <= 2 && alphaOf(e.style.bg) > 0) ys.push({ y: e.rect.y, left: e.rect.x, right: e.rect.x + e.rect.w });
  }
  const unique = [];
  for (const h of ys.toSorted((a, b) => a.y - b.y)) if (!unique.length || h.y - unique.at(-1).y > 2) unique.push(h);
  return unique.filter((h) => h.y > cr.y + 1 && h.y < cr.y + cr.h - 1);
}

/** The page box a top-level card sits in and the card's inline inset from it (see spacingChecks page-inset). */
function pageInsetOf(v, card, width) {
  const anc = v.ancestors(card);
  const padded = anc.filter((a) => a.style.padding[1] > 0.5 || a.style.padding[3] > 0.5);
  const page = anc.find((a) => a.comp === 'PageContainer') ?? padded[padded.length - 1] ?? null;
  const cardRight = card.rect.x + card.rect.w;
  if (!page) return { left: card.rect.x, right: width - cardRight, via: 'viewport' };
  const [, pr, , pl] = page.style.padding;
  const [, br, , bl] = page.style.border.map((b) => (b.style === 'none' ? 0 : b.w));
  const outerL = page.rect.x + bl, outerR = page.rect.x + page.rect.w - br;
  const left = card.rect.x < outerL + pl - 0.5 ? card.rect.x - outerL : pl;
  const right = cardRight > outerR - pr + 0.5 ? outerR - cardRight : pr;
  return { left, right, via: `${tag(page)}${page.cls ? `.${page.cls.split(/\s+/)[0]}` : ''} padding` };
}

/** Full-width disclosure triggers of a card: a <details> root's <summary>, or a Grammar accordion trigger. */
function disclosureTriggers(v, card) {
  const isTrigger = (e) => e.tag === 'summary' || /(?:^|\s)starci-core-accordion-trigger(?:\s|$)/.test(e.cls ?? '');
  const full = (e) => e.visible && isTrigger(e) && e.rect.w >= card.rect.w - 1.5 && v.ancestors(e).some((a) => a.i === card.i);
  const all = v.els.filter(full);
  // A card is a disclosure surface only when a trigger opens it (at its top edge), or it is the <details> root itself.
  if (card.tag !== 'details' && !all.some((e) => Math.abs(e.rect.y - card.rect.y) <= 1.5)) return [];
  return all;
}

const scalePx = (knowledge, name) => (knowledge.find((k) => k.rel.endsWith(`presentation/${name}.yaml`))?.doc.scale?.steps ?? []).map((s) => remPx(s.value)).filter((n) => n != null);

/** The spacing section: measured insets and gaps against the knowledge values. */
export function spacingChecks(v, ctx) {
  const out = [];
  const add = (id, source, got, exp, extra = '') => out.push({ id, source, got: got == null ? null : r1(got), exp, status: got == null ? 'unmeasurable' : Math.abs(got - exp) <= 1.5 ? 'pass' : 'fail', evidence: extra });
  // Closed scale for every padding, gap and margin the page draws (component-internal controls excluded).
  const scale = new Set([...scalePx(ctx.knowledge, 'padding'), ...scalePx(ctx.knowledge, 'gap'), ...scalePx(ctx.knowledge, 'margin')].map((n) => Math.round(n)));
  const off = [];
  for (const e of v.els.filter((x) => x.visible && !v.inControl(x) && !v.inGrammar?.(x) && !v.badges.some((b) => b.i === x.i))) {
    const values = [...e.style.padding.map((p, k) => [`padding-${['top', 'right', 'bottom', 'left'][k]}`, p]), ['row-gap', e.style.rowGap], ['column-gap', e.style.columnGap], ['margin-top', e.style.margin[0]], ['margin-bottom', e.style.margin[2]]];
    for (const [prop, val] of values) if (val != null && val > 0 && !scale.has(Math.round(val)) && Math.abs(val - (ctx.pageInset ?? -1)) > 0.5) off.push(`${prop} ${r1(val)}px on ${tag(e)}`);
  }
  out.push({ id: 'closed-scale', source: 'knowledge/ui/presentation/padding.yaml scale; gap.yaml scale; margin.yaml scale', got: `${off.length} off-scale value(s)`, exp: `every value on ${[...scale].sort((a, b) => a - b).join('/')}px (the page inset is PageContainer's clamp)`, status: off.length ? 'fail' : 'pass', evidence: off.slice(0, 12).join('; ') });
  // Page inset: PageContainer's own inline padding. The page box is the card's PageContainer (data-component), else its
  // outermost ancestor that pads its inline sides; a centred measure's auto margin lies outside that box, and a capped
  // region centred inside it (MEASURE-4 case-3, a formCompact card) sits farther in by layout, not by inset. A card
  // pushed into the padding (a negative margin, an overflow) is measured where it actually sits. With no padded
  // ancestor the card's distance from the viewport edge is the inset.
  const tops = v.cards.filter((c) => !c.nested).map((c) => c.el);
  if (ctx.pageInset != null && tops.length) {
    const sides = tops.map((card) => pageInsetOf(v, card, ctx.width));
    const got = sides.flatMap((s) => [s.left, s.right]).reduce((a, b) => (Math.abs(b - ctx.pageInset) > Math.abs(a - ctx.pageInset) ? b : a));
    add('page-inset', 'knowledge/ui/presentation/padding.yaml scale notes (--grammar-page-inset, PageContainer); measure.yaml MEASURE-1', got, ctx.pageInset, sides.map((s) => `${s.via}: left ${r1(s.left)}px, right ${r1(s.right)}px`).filter((x, k, all) => all.indexOf(x) === k).join('; ') + ` at ${ctx.width}px`);
  }
  // Card insets: a card without bands holds its content the content inset away; a joined card by side contact.
  for (const { el: card } of v.cards) {
    // A disclosure surface (a <details> root, a SurfaceAccordionCard): the trigger is a control that owns the inset
    // (PADDING-4 case-3); the root has none by design. Each full-width trigger's own padding is the measure.
    const triggers = disclosureTriggers(v, card);
    if (triggers.length) {
      const src = 'knowledge/ui/presentation/padding.yaml PADDING-4 case-3 (SurfaceAccordionCard trigger)';
      for (const t of triggers) {
        const [pt, pr, pb, pl] = t.style.padding;
        add('disclosure trigger inset top', src, pt, ctx.edgeInset, `${tag(t)} in ${tag(card)}`);
        add('disclosure trigger inset left', src, pl, ctx.edgeInset, `${tag(t)} in ${tag(card)}`);
        add('disclosure trigger inset right', src, pr, ctx.edgeInset, `${tag(t)} in ${tag(card)}`);
        add('disclosure trigger inset bottom', src, pb, ctx.edgeInset, `${tag(t)} in ${tag(card)}`);
      }
      continue;
    }
    const lines = hairlines(v, card);
    if (!lines.length) {
      const ext = contentExtent(v, card);
      if (!ext) continue;
      const want = ctx.cardInset;
      // A decorative artwork zone in flow at the card's head (grammar 0.6.0 SurfaceCard artwork below 48rem) is the
      // band's art, not its inset: the content inset is measured from the zone's lower edge.
      const art = v.els.filter((e) => e.visible && /(?:^|\s)starci-core-surface-artwork(?:\s|$)/.test(e.cls ?? '') && v.ancestors(e).some((a) => a.i === card.i) && e.rect.y <= card.rect.y + ctx.cardInset + 1.5 && e.rect.y + e.rect.h <= ext.top + 0.5);
      const head = art.length ? Math.max(...art.map((e) => e.rect.y + e.rect.h)) : card.rect.y;
      add('card-inset top', 'knowledge/ui/presentation/padding.yaml PADDING-4 case-2 (SurfaceCard content)', ext.top - head, want, tag(card));
      add('card-inset left', 'knowledge/ui/presentation/padding.yaml PADDING-4 case-2', ext.left - card.rect.x, want, tag(card));
      add('card-inset bottom', 'knowledge/ui/presentation/padding.yaml PADDING-4 case-2', card.rect.y + card.rect.h - ext.bottom, want, tag(card));
      continue;
    }
    const bounds = [card.rect.y, ...lines.map((h) => h.y), card.rect.y + card.rect.h];
    const bleed = lines.filter((h) => Math.abs(h.left - card.rect.x) > 1 || Math.abs(h.right - (card.rect.x + card.rect.w)) > 1);
    out.push({ id: 'band separators edge to edge', source: 'knowledge/ui/presentation/boundary.yaml BOUNDARY-1; knowledge/ui/proof/anatomy-source.yaml observation list-separator-bleed', got: `${lines.length - bleed.length}/${lines.length} full-bleed`, exp: 'every separator touches both card edges', status: bleed.length ? 'fail' : 'pass', evidence: tag(card) });
    for (let k = 0; k < bounds.length - 1; k++) {
      const ext = contentExtent(v, card, { top: bounds[k] + (k ? 1 : 0), bottom: bounds[k + 1] });
      if (!ext) continue;
      const first = k === 0, last = k === bounds.length - 2;
      add(`band ${k + 1} top`, first ? 'knowledge/ui/presentation/padding.yaml PADDING-4 case-6 (side meets the outer edge)' : 'knowledge/ui/presentation/padding.yaml PADDING-3 case-3 (side meets a separator)', ext.top - bounds[k] - (k ? 1 : 0), first ? ctx.edgeInset : ctx.separatorInset, tag(card));
      add(`band ${k + 1} bottom`, last ? 'knowledge/ui/presentation/padding.yaml PADDING-4 case-6' : 'knowledge/ui/presentation/padding.yaml PADDING-3 case-3', bounds[k + 1] - ext.bottom, last ? ctx.edgeInset : ctx.separatorInset, tag(card));
      add(`band ${k + 1} inline`, 'knowledge/ui/presentation/padding.yaml PADDING-4 case-7 (inline sides of any band)', ext.left - card.rect.x, ctx.edgeInset, tag(card));
    }
  }
  // Field anatomy: label to control inside one Input; field to field in a form stack.
  for (const input of v.inputs) {
    const label = v.els.find((e) => e.visible && e.tag === 'label' && e.rect.y + e.rect.h <= input.rect.y + 1 && Math.abs(e.rect.x - input.rect.x) < 24 && input.rect.y - (e.rect.y + e.rect.h) < 60 && input.labelText && e.own && input.labelText.includes(e.own.slice(0, 12)));
    if (!label) continue;
    const between = v.texts.filter((t) => t.rect.y >= label.rect.y + label.rect.h - 1 && t.rect.y + t.rect.h <= input.rect.y + 1 && !v.ancestors(t).some((a) => a.i === label.i) && t.i !== label.i);
    const hint = between.sort((a, b) => a.rect.y - b.rect.y)[0];
    if (hint) {
      add('label to hint', 'knowledge/ui/presentation/gap.yaml componentOwnership Input root = GAP-2', hint.rect.y - (label.rect.y + label.rect.h), ctx.inputGap, tag(input));
      add('hint to control', 'knowledge/ui/presentation/gap.yaml componentOwnership Input root = GAP-2', input.rect.y - (hint.rect.y + hint.rect.h), ctx.inputGap, tag(input));
    } else add('label to control', 'knowledge/ui/presentation/gap.yaml componentOwnership Input root = GAP-2', input.rect.y - (label.rect.y + label.rect.h), ctx.inputGap, tag(input));
  }
  const sorted = v.inputs.slice().sort((a, b) => a.rect.y - b.rect.y);
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1], cur = sorted[k];
    if (Math.abs(prev.rect.x - cur.rect.x) > 2 || v.containerOf(prev)?.i !== v.containerOf(cur)?.i) continue;
    const curLabel = v.els.find((e) => e.visible && e.tag === 'label' && e.rect.y + e.rect.h <= cur.rect.y + 1 && e.rect.y >= prev.rect.y + prev.rect.h - 1);
    const top = curLabel ? curLabel.rect.y : cur.rect.y;
    add('field to field', 'knowledge/ui/presentation/gap.yaml GAP-4 case-3', top - (prev.rect.y + prev.rect.h), ctx.fieldGap, `${tag(prev)} -> ${tag(cur)}`);
  }
  // Badges on one row.
  const badges = v.badges.slice().sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  // Two badges on one row of ONE container (the same card, else the same parent) - never badges of two peer cards.
  const sameRow = (a, b) => Math.abs(a.rect.y - b.rect.y) < 4 && (v.containerOf(a)?.i ?? a.parent) === (v.containerOf(b)?.i ?? b.parent);
  for (let k = 1; k < badges.length; k++) if (sameRow(badges[k], badges[k - 1])) add('badge to badge', 'knowledge/ui/presentation/gap.yaml GAP-2 case-4', badges[k].rect.x - (badges[k - 1].rect.x + badges[k - 1].rect.w), ctx.badgeGap, `${tag(badges[k - 1])} -> ${tag(badges[k])}`);
  return out;
}

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
    return bad.length ? FAIL(`${bad.map((e) => `${e.tag}${e.placeholder ? ` placeholder "${e.placeholder}"` : ''}`).join(', ')} has no accessible name from a label`) : PASS(`${v.inputs.length} field(s) named by their visible label`);
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
    return bad.length ? FAIL(`${bad.map((p) => `"${p.h.own.slice(0, 30)}" is not aria-describedby of ${tag(p.input)}`).join('; ')}`) : PASS(`${pairs.length} hint(s) related by aria-describedby`);
  },
  'accessibility.yaml A11Y-4 case-4': (v) => (v.snap.root.scrollWidth > v.snap.root.clientWidth + 1 ? FAIL(`horizontal overflow: scrollWidth ${v.snap.root.scrollWidth} > ${v.snap.root.clientWidth}`) : PASS(`no horizontal overflow at ${v.snap.root.clientWidth}px`)),
  'accessibility.yaml A11Y-4 case-1': (v, ctx, c) => {
    const m = /(\d+)px\s*[x×]\s*(\d+)px/.exec(String(c.observe));
    if (!m) return NONE('the case names no size');
    const targets = v.els.filter((e) => e.visible && (e.role === 'button' || e.tag === 'button') && v.els.some((x) => x.i === e.i) && (e.cls.includes('accordion') || v.ancestors(e).some((a) => /rail|accordion/i.test(a.cls))));
    if (!targets.length) return NONE('no accordion trigger or rail control rendered (the only targets the case sizes)');
    const bad = targets.filter((e) => e.rect.w < Number(m[1]) - 0.5 || e.rect.h < Number(m[2]) - 0.5);
    return bad.length ? FAIL(bad.map((e) => `${tag(e)} ${r1(e.rect.w)}x${r1(e.rect.h)}`).join(', ')) : PASS(`${targets.length} target(s) >= ${m[1]}x${m[2]}`);
  },
  'taste.yaml TASTE-1 case-2': (v) => {
    const heads = v.els.filter((e) => e.visible && /^h[1-6]$/.test(e.tag));
    const title = heads.find((e) => e.tag === 'h1') ?? heads.sort((a, b) => b.style.fontSize - a.style.fontSize)[0];
    if (!title) return NONE('no heading rendered');
    const sections = heads.filter((e) => e.i !== title.i && e.tag !== 'h1');
    if (!sections.length) return NONE('no section title beside the page title');
    const bad = sections.filter((s) => s.style.fontSize >= title.style.fontSize && s.style.fontWeight >= title.style.fontWeight);
    return bad.length ? FAIL(`${bad.map((s) => `${tag(s)} ${s.style.fontSize}px/${s.style.fontWeight}`).join(', ')} not below the title ${title.style.fontSize}px/${title.style.fontWeight}`) : PASS(`title ${title.style.fontSize}px/${title.style.fontWeight} above ${sections.length} section title(s)`);
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
    return sticky || inLowerHalf ? PASS(`${tag(primary)} at y ${r1(primary.rect.y)}-${r1(primary.rect.y + primary.rect.h)} of ${vh}${sticky ? ' (pinned)' : ''}`) : FAIL(`${tag(primary)} at y ${r1(primary.rect.y)}-${r1(primary.rect.y + primary.rect.h)}; the fold is ${vh}px`);
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
  const text = (r) => `${r.id} ${typeof r.got === 'number' ? `${r.got}px` : r.got} (want ${typeof r.exp === 'number' ? `${r.exp}px` : r.exp})${r.evidence ? ` ${r.evidence}` : ''}`;
  return bad.length ? FAIL(bad.map(text).join('; ')) : PASS(`${rows.length} measured: ${rows.slice(0, 4).map(text).join('; ')}`);
}

function textContrast(v, ctx, large) {
  const m = /(\d+(?:\.\d+)?):1/.exec(String(ctx.case.observe ?? ''));
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
  return bad.length ? FAIL(`${bad.length} run(s) under ${floor}:1, worst ${bad.slice(0, 3).map((x) => `${tag(x.e)} ${x.ratio.toFixed(2)}:1`).join(', ')}`) : PASS(`${runs.length} run(s) >= ${floor}:1 (lowest ${Math.min(...measured.map((x) => x.ratio)).toFixed(2)}:1)`);
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

/** Score an html render against the brief's applicable cases. */
export async function scoreRender(brief, html, { repo = null, viewport = DEFAULT_VIEWPORT } = {}) {
  const g = brief.geometry;
  const probes = g.ok ? geometryProbes(g) : {};
  const shot = await snapshotFiles([html], { repo, viewport, probes });
  if (!shot.ok) return { ok: false, error: shot.error };
  const snap = shot.snapshots[0];
  const v = readSnapshot(snap);
  const width = viewport.width;
  const scope = g.ok ? tokenScope(g, width) : null;
  const knowledge = loadKnowledge();
  const geoAt = g.ok ? (g.at.find((w) => w.width === width) ?? resolveGeometry({ repo, family: g.family, widths: [width], ...(g.sources?.drawCss) }).at?.[0] ?? g.at[0]) : null;
  const scale = (name, id) => remPx(knowledge.find((k) => k.rel.endsWith(`presentation/${name}.yaml`))?.doc.scale?.steps?.find((s) => s.id === id)?.value);
  const ctx = {
    knowledge, probes: snap.probes ?? {}, width, height: viewport.height,
    pageInset: scope?.variable('--grammar-page-inset')?.px ?? null,
    cardInset: geoAt?.card.content['padding-top']?.px ?? scale('padding', 'PADDING-4'),
    edgeInset: scale('padding', 'PADDING-4'), separatorInset: scale('padding', 'PADDING-3'),
    inputGap: scale('gap', 'GAP-2'), fieldGap: scale('gap', 'GAP-4'), badgeGap: scale('gap', 'GAP-2'),
    font4: fontPx(knowledge, 'FONT-4', scope),
    largeWhen: knowledge.find((k) => k.rel.endsWith('proof/contrast.yaml'))?.doc.rules.find((r) => r.id === 'COLOR-5')?.cases.find((c) => c.id === 'case-2')?.when,
  };
  ctx.spacing = spacingChecks(v, ctx);
  const results = [];
  for (const t of brief.topics) for (const c of t.cases) {
    const key = `${path.basename(t.path)} ${c.rule} ${c.case}`;
    const m = MEASURERS[key];
    const r = m ? m(v, { ...ctx, case: c }, c) : NONE('no instrument measures this case on a static render');
    results.push({ path: t.path, rule: c.rule, case: c.case, ...r });
  }
  const weights = new Set(v.texts.map((e) => e.style.fontWeight));
  const fontGuidance = knowledge.find((k) => k.rel.endsWith('presentation/font.yaml'))?.doc.guidance?.find((x) => x.id === 'weight');
  const publicWeights = [...String(fontGuidance?.requirement ?? '').matchAll(/`font-(normal|medium|semibold)`/g)].map((m) => Number(scope?.variable(`--font-weight-${m[1]}`)?.value)).filter(Number.isFinite);
  if (publicWeights.length) { const off = [...weights].filter((w) => !publicWeights.includes(w)); ctx.spacing.push({ id: 'font weights', source: 'knowledge/ui/presentation/font.yaml guidance weight', got: [...weights].join('/'), exp: publicWeights.join('/'), status: off.length ? 'fail' : 'pass', evidence: off.length ? `weights off the public set: ${off.join('/')}` : '' }); }
  const sizes = [...new Set(v.texts.filter((e) => !v.inControl(e)).map((e) => e.style.fontSize))].sort((a, b) => a - b);
  const fontRules = knowledge.find((k) => k.rel.endsWith('presentation/font.yaml'))?.doc.rules ?? [];
  const scaleSizes = fontRules.map((r) => fontPx(knowledge, r.id, scope)).filter((n) => n != null);
  if (scaleSizes.length) { const off = sizes.filter((s) => !scaleSizes.some((x) => Math.abs(x - s) < 0.5)); ctx.spacing.push({ id: 'font sizes', source: 'knowledge/ui/presentation/font.yaml scale (FONT-1..6)', got: sizes.join('/'), exp: scaleSizes.join('/'), status: off.length ? 'fail' : 'pass', evidence: off.length ? `sizes off the type scale: ${off.join('/')}px` : '' }); }
  const families = [...new Set(v.texts.map((e) => firstFamily(e.style.fontFamily)).filter(Boolean))];
  if (g.ok) ctx.spacing.push({ id: 'font family', source: 'grammar-geometry.mjs family font', got: families.join(', '), exp: g.font.allowed.join(' or '), status: families.every((f) => g.font.allowed.includes(f)) ? 'pass' : 'fail', evidence: '' });
  const count = (s) => results.filter((r) => r.status === s).length + (s === 'unmeasurable' ? 0 : ctx.spacing.filter((r) => r.status === s).length);
  const summary = { pass: count('pass'), fail: count('fail'), unmeasurable: results.filter((r) => r.status === 'unmeasurable').length };
  let htmlSha256 = null;
  try { htmlSha256 = sha256(fs.readFileSync(html)); } catch { htmlSha256 = null; }
  // htmlSha256 binds the score to the exact render source it scored (scripts/work/draw/draw-quality.mjs DRAW_SCORE_BELOW).
  return { schema: 'starci/ui-proof-score@1', ok: summary.fail === 0, file: html, htmlSha256, viewport, summary, cases: results, spacing: ctx.spacing };
}

function scoreText(s) {
  const lines = [`UI PROOF SCORE - ${s.file} at ${s.viewport.width}x${s.viewport.height}: ${s.summary.pass} pass, ${s.summary.fail} fail, ${s.summary.unmeasurable} unmeasurable.`, '', 'SPACING / PADDING'];
  for (const r of s.spacing) lines.push(`  ${r.status.toUpperCase().padEnd(12)} ${r.id}: ${typeof r.got === 'number' ? `${r.got}px` : r.got} (want ${typeof r.exp === 'number' ? `${r.exp}px` : r.exp}) - ${r.source}${r.evidence ? ` - ${r.evidence}` : ''}`);
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

export async function uiProofBriefMain(argv = []) {
  if (argv.includes('--help') || argv.includes('-h')) return { exitCode: 0, text: USAGE };
  const json = argv.includes('--json');
  const surface = argOf(argv, '--surface');
  const repo = argOf(argv, '--repo');
  const family = argOf(argv, '--family');
  const extra = (argOf(argv, '--elements') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const unknown = extra.filter((e) => !KIND_IDS.includes(e));
  if (unknown.length) return { exitCode: 2, text: `unknown element kind(s) ${unknown.join(', ')}\n${USAGE}` };
  if (!surface && !extra.length) return { exitCode: 2, text: `--surface <ui record path> is required\n${USAGE}` };
  if (!repo) return { exitCode: 2, text: `--repo <repo> is required\n${USAGE}` };
  let record = {};
  let file = null;
  if (surface) {
    file = surfaceFile(surface);
    if (!fs.existsSync(file)) return { exitCode: 2, text: `${surface}: no ui record\n` };
    try { record = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch (error) { return { exitCode: 2, text: `${file}: ${error.message}\n` }; }
  }
  const brief = buildBrief({ record, recordFile: file, repo, family, extra });
  if (!brief.geometry.ok) return { exitCode: 2, text: `ui-proof-brief: the product CSS did not resolve (${brief.geometry.errors.join('; ')})\n` };
  const html = argOf(argv, '--score');
  if (html) {
    if (!fs.existsSync(html)) return { exitCode: 2, text: `${html}: no such file\n` };
    const viewport = argOf(argv, '--viewport') ? parseViewport(argOf(argv, '--viewport')) : DEFAULT_VIEWPORT;
    if (!viewport) return { exitCode: 2, text: '--viewport is <width>x<height>\n' };
    const s = await scoreRender(brief, path.resolve(html), { repo, viewport });
    if (s.error) return { exitCode: 2, text: `ui-proof-brief: ${s.error}\n` };
    return { exitCode: s.ok ? 0 : 1, text: json ? `${JSON.stringify(s, null, 2)}\n` : scoreText(s) };
  }
  return { exitCode: 0, text: json ? `${JSON.stringify(plainBrief(brief), null, 2)}\n` : briefText(brief) };
}

if (isMain(import.meta.url)) {
  const result = await uiProofBriefMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
