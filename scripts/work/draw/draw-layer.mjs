// draw-layer.mjs — the layer and measure gates of a drawing (owner, 2026-09-28, StarCi Next SignInBase#signed-out:
// "this is KNOWLEDGE, not golden rules" - the runtime catches these from knowledge and gates, never from owner feedback).
//
//   DRAW_NESTED_VARIANT    knowledge/ui/proof/anatomy-source.yaml ANATOMY-2. The layer chain is page Background ->
//                          Surface -> nested control: every form control ON a surface (a bounded SurfaceCard, a
//                          card, a dialog / drawer panel) carries HeroUI's nested `secondary` variant - the choice
//                          controls (Checkbox, RadioGroup, ...) as much as the text fields (case-1); a form region
//                          (fields plus a primary submit) stands in a Surface, never directly on the Background
//                          (case-3). Judged on the RENDERED DOM (draw-render's snapshot, or the html itself): the
//                          variant is the control root's data-grammar-variant, else its vendor `<part>--<variant>`
//                          class. A control whose vendor anatomy has no layer variant (Switch, Slider) is exempt.
//   DRAW_MEASURE_UNCAPPED  knowledge/ui/presentation/measure.yaml MEASURE-4 case-3/case-4. A form region (fields plus
//                          a primary submit) caps its measure; rendered wider than FORM_MEASURE_CAP_PX (W-3xl, 48rem)
//                          at any viewport it stretched across its column. Measured in the browser (measureLayer,
//                          run by draw-render; the record's `layer`). A chat composer (inside a ChatWorkspace, a
//                          composer part or a role=log conversation) is not a form and is skipped.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isMain } from '../../lib/is-main.mjs';
import { classesOf, parseHtml, walkElements } from './draw-dna.mjs';
import { safeRemove } from '../../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../../machine/artifact-hold.mjs';
import {isFile} from '../../lib/fs-kind.mjs';
import {ancestorsOf} from '../../lib/dom-tree.mjs';
import { readEnv } from '../../lib/env.mjs';

export const DRAW_NESTED_VARIANT = 'DRAW_NESTED_VARIANT';
export const DRAW_MEASURE_UNCAPPED = 'DRAW_MEASURE_UNCAPPED';

/** W-3xl of the Width scale (measure.yaml guidance width-scale): no form region renders wider. */
export const FORM_MEASURE_CAP_PX = 768;

/** Grammar form controls whose HeroUI v3 anatomy has the layer variant (primary | secondary). */
const VARIANT_CONTROLS = Object.freeze(['Input', 'Textarea', 'Select', 'ComboBox', 'SearchField', 'NumberField', 'DateField', 'TimeField',
  'DatePicker', 'DateRangePicker', 'Checkbox', 'CheckboxGroup', 'RadioGroup', 'OtpInput']);
/** Every grammar field control (the variant ones plus those without a vendor variant): what makes a region a form. */
const FIELD_CONTROLS = Object.freeze([...VARIANT_CONTROLS, 'Switch', 'Slider', 'PressableField', 'FileDropzone']);
/** Components that paint a surface of their own. */
const SURFACE_COMPONENTS = Object.freeze(['SurfaceCard', 'SurfaceListCard', 'SurfaceAccordionCard', 'Dialog', 'Drawer', 'AlertDialog', 'Popover']);
/** The vendor class prefixes that carry the layer variant (`<prefix>--primary|secondary`). */
const VARIANT_CLASS_PREFIXES = Object.freeze(['input', 'input-group', 'textfield', 'textarea', 'select', 'combo-box', 'search-field', 'number-field',
  'date-input-group', 'date-field', 'time-field', 'date-picker', 'checkbox', 'checkbox-group', 'radio-group', 'input-otp']);

const VARIANT_CLASS = new RegExp(`^(?:${VARIANT_CLASS_PREFIXES.join('|')})--(primary|secondary)$`);
const componentOf = (attrs) => attrs?.['data-component'] ?? attrs?.['data-grammar-component'] ?? null;

/** Whether one parsed/DOM element paints a surface: a bounded grammar surface, a vendor card/surface, a dialog. */
function isSurface({ component, attrs, classes }) {
  if (attrs['data-grammar-frame'] === 'frameless') return false;
  if (SURFACE_COMPONENTS.includes(component)) return true;
  if (attrs['data-grammar-surface-depth'] != null) return true;
  if (attrs.role === 'dialog' || attrs.role === 'alertdialog') return true;
  return classes.includes('card') || classes.includes('surface') || classes.includes('starci-core-surface');
}

/** The layer variant a control root renders: data-grammar-variant, else the first vendor variant class in it. */
export function variantOfControl(root) {
  const own = root.attrs?.['data-grammar-variant'];
  if (own === 'primary' || own === 'secondary') return own;
  for (const el of [root, ...walkElements(root)]) {
    for (const c of classesOf(el)) { const m = VARIANT_CLASS.exec(c); if (m) return m[1]; }
  }
  return null;
}

const describe = (el) => {
  const component = componentOf(el.attrs);
  const name = el.attrs?.name ?? el.attrs?.id ?? walkElements(el).find((d) => d.attrs?.name)?.attrs?.name ?? null;
  const label = name ? ` "${name}"` : '';
  return `${component ?? el.tag}${label}`;
};
const surfaceAncestor = (el) => ancestorsOf(el).find((a) => isSurface({ component: componentOf(a.attrs), attrs: a.attrs ?? {}, classes: classesOf(a) })) ?? null;
const isPrimaryButton = (el) => (componentOf(el.attrs) === 'Button' && (classesOf(el).includes('button--primary') || el.attrs?.['data-variant'] === 'primary' || el.attrs?.['data-grammar-variant'] === 'primary'))
  || (el.tag === 'button' && el.attrs?.type === 'submit');

/**
 * DRAW_NESTED_VARIANT findings of one rendered DOM (html text): [{code, kind, detail}]. `label` names the capture.
 */
export function nestedVariantFindings(html, { label = 'the render' } = {}) {
  const all = walkElements(parseHtml(html));
  const out = [];
  const controls = all.filter((el) => VARIANT_CONTROLS.includes(componentOf(el.attrs))
    && !ancestorsOf(el).some((a) => FIELD_CONTROLS.includes(componentOf(a.attrs))));
  const bad = [];
  for (const el of controls) {
    if (!surfaceAncestor(el)) continue;
    const variant = variantOfControl(el);
    if (variant !== 'secondary') bad.push(`${describe(el)} (${variant ?? 'no layer variant'})`);
  }
  if (bad.length) out.push({ code: DRAW_NESTED_VARIANT, kind: 'control on a surface not nested', count: bad.length,
    detail: `${label}: ${bad.length} form control(s) on a surface without the nested variant="secondary" - ${bad.slice(0, 6).join('; ')} (ANATOMY-2 case-1: every form control on a surface, choice controls included)` });
  // ANATOMY-2 case-3: a form region (fields plus a primary submit) stands in a Surface, never on the page Background.
  const loose = [];
  for (const button of all.filter(isPrimaryButton)) {
    const region = ancestorsOf(button).find((a) => walkElements(a).some((d) => FIELD_CONTROLS.includes(componentOf(d.attrs))));
    if (!region || surfaceAncestor(button) || isSurface({ component: componentOf(region.attrs), attrs: region.attrs ?? {}, classes: classesOf(region) })) continue;
    const fields = walkElements(region).filter((d) => FIELD_CONTROLS.includes(componentOf(d.attrs)));
    // A form is one unit: fields on a surface with the submit on the Background is a split form; a field on a surface
    // is otherwise judged as a nested control only, never also as a loose form.
    const split = fields.some((d) => surfaceAncestor(d));
    if (!loose.some((l) => l.region === region)) loose.push({ region, fields, split });
  }
  for (const { fields, split } of loose) out.push(split
    ? { code: DRAW_NESTED_VARIANT, kind: 'form-split-across-layers', count: 1,
      detail: `${label}: form-split-across-layers - ${fields.slice(0, 4).map(describe).join(', ')} stand(s) on a Surface while the form's primary submit sits on the page Background; a form is one unit, its fields and its submit/actions belong in the same Surface (ANATOMY-2 case-3)` }
    : { code: DRAW_NESTED_VARIANT, kind: 'form on the page background', count: 1,
      detail: `${label}: a form region (${fields.slice(0, 4).map(describe).join(', ')} and its primary submit) stands directly on the page Background - it belongs in a Surface (SurfaceCard), its controls nested in variant="secondary" (ANATOMY-2 case-3)` });
  return out;
}

/**
 * DRAW_MEASURE_UNCAPPED findings of one capture's measured layer (draw-render record `layer`, measureLayer):
 * {viewport:{width,height}, forms:[{desc, width, fields}]}.
 */
export function measureFindings(layer, { label = 'the capture', cap = FORM_MEASURE_CAP_PX } = {}) {
  const wide = (Array.isArray(layer?.forms) ? layer.forms : []).filter((f) => Number(f.width) > cap + 0.5);
  return wide.map((f) => ({ code: DRAW_MEASURE_UNCAPPED, kind: 'form region past its measure', count: 1,
    detail: `${label}: the form region ${f.desc ?? ''} (${(f.fields ?? []).slice(0, 4).join(', ') || 'fields'} and a primary submit) renders ${Math.round(Number(f.width))}px wide at ${layer.viewport?.width ?? '?'}px, past the ${cap}px (W-3xl) form cap - a drawn XBase owns its measure: SurfaceCard measure="form"/"formCompact", else w-full max-w-md mx-auto (MEASURE-4 case-3/case-4; MEASURE-1 is the page width, not the form's)`.replace(/\s+/g, ' ') }));
}

/** Every layer finding of one capture: the static DOM variant check plus the measured form width. */
export function layerFindings({ html, layer = null, label = 'the render' }) {
  return [...nestedVariantFindings(html, { label }), ...measureFindings(layer, { label })];
}

/**
 * Runs IN THE PAGE (draw-render passes it to page.evaluate): every form region's rendered width. A form region is the
 * nearest ancestor of a primary submit that also holds a field control; a region holding a table or grid is data, not
 * a form, and is skipped. Self-contained: it closes over nothing.
 */
export function measureLayer({ fields, primary, chat }) {
  const fieldSel = fields.map((n) => `[data-component="${n}"],[data-grammar-component="${n}"]`).join(',');
  const forms = [];
  const seen = new Set();
  const isVisible = (button) => {
    const cs = getComputedStyle(button);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const regionOf = (button) => {
    let region = button.parentElement;
    while (region && region !== document.body && !region.querySelector(fieldSel)) region = region.parentElement;
    return region;
  };
  // A chat / messaging composer (a text input and a send button in a chat workspace) follows its conversation column.
  const isExcludedRegion = (region) => region.querySelector('table,[role="grid"],[role="table"]')
    || region.closest(chat) || region.querySelector(chat) || [...region.classList].some((c) => c.startsWith('starci-core-chat-'));
  for (const button of document.querySelectorAll(primary)) {
    if (!isVisible(button)) continue;
    const region = regionOf(button);
    if (!region || region === document.body || seen.has(region)) continue;
    seen.add(region);
    if (isExcludedRegion(region)) continue;
    const names = [...region.querySelectorAll(fieldSel)].map((el) => el.getAttribute('data-component') ?? el.getAttribute('data-grammar-component'));
    const cls = typeof region.className === 'string' ? region.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    const classLabel = cls ? `.${cls}` : '';
    forms.push({ desc: `<${region.tagName.toLowerCase()}${classLabel}>`, width: region.getBoundingClientRect().width, fields: names });
  }
  return { viewport: { width: window.innerWidth, height: window.innerHeight }, forms };
}

/** The argument draw-render passes measureLayer. */
export const LAYER_PROBE = Object.freeze({
  fields: FIELD_CONTROLS,
  chat: '[data-component="ChatWorkspace"],[data-grammar-component="ChatWorkspace"],[data-component*="Composer"],[data-grammar-component*="Composer"],[data-grammar-part*="composer"],[role="log"]',
  primary: '[data-component="Button"].button--primary,[data-grammar-component="Button"].button--primary,[data-component="Button"][data-variant="primary"],[data-grammar-component="Button"][data-variant="primary"],button[type="submit"]',
});

// ---------------------------------------------------------------------------------------------------------
// Existing renders: the CLI and the draw-gates gate
//
//   starci work draw-layer <render dir | part png>... [--playwright <product dir>] [--json]
//
// Every drawn part under the paths (a <part>.png whose <part>.json is a starci/draw-render@1 record) is judged:
// DRAW_NESTED_VARIANT on its rendered DOM (<part>.dom.html, else the html beside it), DRAW_MEASURE_UNCAPPED on the
// record's measured `layer`. A record drawn before the measure existed carries no `layer`: the part is re-rendered at
// its viewport from the round's harness/index.html (a draw-loop round dir) or its html source, with the product's
// Playwright (--playwright, else the cwd), and measured; a part that cannot be re-measured says so (unmeasured).
// Exit 0 all clear, 1 a finding, 2 usage.
// ---------------------------------------------------------------------------------------------------------

const readJsonFile = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** Every drawn part (png with a draw-render record) under the paths, skipping node_modules and capture outputs. */
function partsUnder(paths) {
  const out = [];
  const visit = (p) => {
    let st = null;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
      if (/^(node_modules|\.git|harness|layer-remeasure)$/.test(path.basename(p))) return;
      for (const e of fs.readdirSync(p)) visit(path.join(p, e));
      return;
    }
    if (!/\.png$/i.test(p) || /\.redline\.png$/i.test(p)) return;
    const record = readJsonFile(p.replace(/\.png$/i, '.json'));
    if (record?.schema === 'starci/draw-render@1') out.push({ png: p, record });
  };
  for (const p of paths) visit(path.resolve(p));
  return out;
}

/** The html a part can be re-rendered from: its round's harness, its record's html source, the html beside it. */
function renderSourceOf({ png, record }) {
  const harness = path.join(path.dirname(png), 'harness', 'index.html');
  if (isFile(harness)) return harness;
  // The html beside the part is the copy that was judged; the record's source path may point at a live repo since edited.
  const beside = png.replace(/\.png$/i, '.html');
  if (isFile(beside)) return beside;
  const src = record?.source?.html?.path;
  return src && isFile(src) ? src : null;
}

/**
 * The layer findings of drawn parts: [{part, viewport, findings, measured, forms}]. `playwright` (loadPlaywright) re-measures
 * a part whose record has no `layer`; without it such a part is reported unmeasured.
 */
export async function layerFindingsForParts(parts, { playwright = null } = {}) {
  const results = [];
  const scratch = playwright ? fs.mkdtempSync(path.join(os.tmpdir(), 'draw-layer-')) : null;
  try {
    for (const part of parts) {
      const label = path.basename(part.png).replace(/\.png$/i, '');
      const viewport = part.record?.viewport ? { width: part.record.viewport.width, height: part.record.viewport.height } : null;
      let dom = part.record?.dom?.path && isFile(part.record.dom.path) ? part.record.dom.path : part.png.replace(/\.png$/i, '.dom.html');
      if (!isFile(dom)) dom = isFile(part.png.replace(/\.png$/i, '.html')) ? part.png.replace(/\.png$/i, '.html') : null;
      let layer = part.record?.layer && !part.record.layer.error ? part.record.layer : null;
      let measured = layer ? 'record' : null;
      if (!layer && playwright && viewport) {
        const source = renderSourceOf(part);
        if (source) {
          try {
            const { captureHtml } = await import('../draw-render.mjs');
            const [r] = await captureHtml({ html: source, out: path.join(scratch, `${results.length}`), viewports: [viewport], theme: 'light', fullPage: true, name: 'layer-remeasure', source: { mode: 'html' }, playwright, rationale: null });
            if (r?.layer && !r.layer.error) { layer = r.layer; measured = `re-rendered ${path.relative(process.cwd(), source)}`; }
            if (!dom && r?.dom?.path && isFile(r.dom.path)) dom = r.dom.path;
          } catch (error) { measured = `re-render failed: ${String(error?.message ?? error).split(/\r?\n/)[0]}`; }
        }
      }
      const html = dom ? fs.readFileSync(dom, 'utf8') : null;
      const findings = [...(html ? nestedVariantFindings(html, { label }) : []), ...measureFindings(layer, { label })];
      results.push({ part: part.png, viewport, dom, measured: measured ?? 'unmeasured (no record layer, no re-render source or Playwright)', forms: layer?.forms ?? null, findings });
    }
  } finally {
    if (scratch) safeRemove(scratch, { hold: artifactHoldReason });
  }
  return results;
}

async function main(argv) {
  const paths = [], opts = { playwright: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') opts.json = true;
    else if (argv[i] === '--playwright') opts.playwright = argv[++i];
    else if (argv[i].startsWith('--')) { process.stderr.write(`draw-layer: unknown flag ${argv[i]}\n`); return 2; }
    else paths.push(argv[i]);
  }
  if (!paths.length) { process.stderr.write('use: starci work draw-layer <render dir | part png>... [--playwright <product dir>] [--json]\n'); return 2; }
  const parts = partsUnder(paths);
  let playwright = null;
  try { const { loadPlaywright } = await import('../draw-render.mjs'); playwright = loadPlaywright([opts.playwright, readEnv('STARCI_PLAYWRIGHT_DIR'), process.cwd()].filter(Boolean)); } catch { playwright = null; }
  const results = await layerFindingsForParts(parts, { playwright });
  const red = results.filter((r) => r.findings.length);
  if (opts.json) process.stdout.write(`${JSON.stringify({ schema: 'starci/draw-layer@1', parts: results.length, red: red.length, results }, null, 2)}\n`);
  else {
    for (const r of results) {
      const forms = r.forms ? `; forms ${r.forms.map((f) => String(Math.round(f.width)) + 'px').join(', ') || 'none'}` : '';
      process.stdout.write(`${r.findings.length ? 'FAIL' : 'ok  '} ${r.part} [${r.measured}${forms}]\n`);
      for (const f of r.findings) process.stdout.write(`       [${f.code}] ${f.detail}\n`);
    }
    process.stdout.write(`${results.length} part(s), ${red.length} red\n`);
  }
  return red.length ? 1 : 0;
}

if (isMain(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); } catch (e) { process.stderr.write(`draw-layer: ${e?.stack ?? e}\n`); process.exitCode = 2; }
}
