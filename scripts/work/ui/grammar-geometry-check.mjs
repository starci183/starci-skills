import path from 'node:path';
import { alphaOver } from '../../lib/color.mjs';
import { BUTTON_VARIANTS, DEFAULT_VIEWPORT, chainText, firstFamily, isPill, normalizeShadowText, resolveGeometry } from './grammar-geometry-resolve.mjs';

// grammar-geometry-check.mjs - reading a rendered snapshot (controls, surfaces, badges and text) and judging it against
// the resolved geometry: GEOMETRY_OFF_GRAMMAR for every element whose computed geometry leaves the grammar.

const GEOMETRY_CODE = 'GEOMETRY_OFF_GRAMMAR';
const CONTROL_TAGS = new Set(['button', 'input', 'select', 'textarea', 'a', 'label', 'summary']);
const INPUT_SKIP = new Set(['checkbox', 'radio', 'range', 'hidden', 'submit', 'button', 'reset', 'file', 'color', 'image']);
export const alphaOf = (c) => (c ? c[3] : 0);
export const sameColor = (a, b, tol = 3) => Boolean(a && b) && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol && Math.abs(a[3] - b[3]) <= 0.03;

/** Index a snapshot: children, ancestors, composed backgrounds and the classified elements. */
export function readSnapshot(snap) {
  const els = snap.elements;
  const byI = new Map(els.map((e) => [e.i, e]));
  const kids = new Map();
  for (const e of els) { if (e.parent != null) { if (!kids.has(e.parent)) { kids.set(e.parent, []); } kids.get(e.parent).push(e); } }
  const ancestors = (e) => { const out = []; let p = e.parent; while (p != null && byI.has(p)) { out.push(byI.get(p)); p = byI.get(p).parent; } return out; };
  const pageBg = [snap.root.bodyBg, snap.root.htmlBg].find((c) => c && c[3] > 0) ?? [255, 255, 255, 1];
  const composed = new Map();
  const bgOf = (e) => {
    if (!e) return alphaOf(pageBg) >= 1 ? pageBg : alphaOver(pageBg, [255, 255, 255, 1]);
    if (composed.has(e.i)) return composed.get(e.i);
    const under = bgOf(e.parent != null ? byI.get(e.parent) : null);
    const own = e.style.bg && alphaOf(e.style.bg) > 0 ? alphaOver(e.style.bg, under) : under;
    composed.set(e.i, own);
    return own;
  };
  const isControl = (e) => CONTROL_TAGS.has(e.tag) || ['button', 'tab', 'link', 'checkbox', 'switch', 'radio', 'menuitem', 'option'].includes(e.role);
  const inControl = (e) => isControl(e) || ancestors(e).some(isControl);
  const shadowOn = (e) => e.style.shadow && e.style.shadow !== 'none' && normalizeShadowText(e.style.shadow) !== 'none';
  const borderOn = (e) => e.style.border.some((b) => b.w > 0 && b.style !== 'none' && alphaOf(b.color) > 0);
  const vw = snap.viewport?.width ?? snap.root.clientWidth;
  const buttons = els.filter((e) => e.visible && e.role !== 'tab' && (e.tag === 'button' || e.role === 'button' || (e.tag === 'input' && ['submit', 'button', 'reset'].includes(e.type)) || (e.tag === 'a' && /\b(button|btn)\b/i.test(e.cls))));
  const inputs = els.filter((e) => e.visible && ((e.tag === 'input' && !INPUT_SKIP.has(e.type ?? 'text')) || e.tag === 'textarea' || e.tag === 'select'));
  const differsFromParent = (e) => { const parent = e.parent != null ? byI.get(e.parent) : null; return !sameColor(bgOf(e), bgOf(parent), 2); };
  const strip = (e) => ['nav', 'header', 'footer'].includes(e.tag) || ['tablist', 'navigation', 'banner', 'toolbar'].includes(e.role) || (e.style.radius < 1 && !shadowOn(e) && !borderOn(e));
  // A real grammar render (a .draw.tsx): the element sits inside a grammar component's own anatomy (a data-component root
  // is nearer than any layout element the drawing wrote). Its spacing, type and shape are the grammar's - judged by the
  // grammar's own conformance, not by the drawing that composed it. Never true for a hand-written html render (no
  // data-component there).
  const inGrammar = (e) => {
    if (e.comp) return true;
    for (const a of ancestors(e)) {
      if (a.drawLayout) return false;
      if (a.comp) return true;
    }
    return false;
  };
  // A notice (Alert: its own anatomy gate, DRAW_ALERT_ANATOMY, and the HeroUI radius) or a media box (Image/MediaFrame)
  // is never a card.
  // A cell or bar ruled on ONE edge only (square, no shadow) is a divided region - a stat-strip cell's inline-start
  // hairline, a pinned action bar's top hairline (grammar 0.6.0: DescriptionList stat-strip, PinnedActionBar) - never a
  // card, whatever ground it carries.
  const edgeRuled = (e) => e.style.radius < 1 && !shadowOn(e) && e.style.border.filter((b) => b.w > 0 && b.style !== 'none' && alphaOf(b.color) > 0).length === 1;
  const notCard = (e) => /(?:^|\s)(?:alert|starci-core-alert|starci-core-image|starci-core-media-frame|starci-core-media-viewport|starci-core-description-pair|starci-core-pinned-action-bar)(?:\s|$)/.test(e.cls) || ['img', 'picture', 'video'].includes(e.tag) || edgeRuled(e);
  const surfaceLike = (e) => e.visible && !inControl(e) && !notCard(e) && e.rect.h >= 40 && (shadowOn(e) || borderOn(e) || (alphaOf(e.style.bg) > 0 && differsFromParent(e)));
  const candidates = els.filter((e) => surfaceLike(e) && e.rect.w >= Math.min(240, vw * 0.5) && !(strip(e) && !ancestors(e).some((a) => surfaceLike(a) && !strip(a))));
  const candidateSet = new Set(candidates.map((e) => e.i));
  const cardOf = (e) => ancestors(e).find((a) => candidateSet.has(a.i)) ?? null;
  const isBand = (e) => { const host = cardOf(e); return Boolean(host) && e.style.radius < 1 && !shadowOn(e) && Math.abs(e.rect.w - host.rect.w) <= 1.5; };
  const cards = candidates.filter((e) => !isBand(e)).map((e) => ({ el: e, nested: Boolean(cardOf(e)) && !isBand(e) }));
  const cardSet = new Set(cards.map((c) => c.el.i));
  const bands = candidates.filter(isBand);
  const containerOf = (e) => ancestors(e).find((a) => cardSet.has(a.i)) ?? null;
  const badges = els.filter((e) => e.visible && !inControl(e) && !cardSet.has(e.i) && e.rect.h <= 32 && e.rect.h >= 12 && e.rect.w <= 260 && (e.own || (kids.get(e.i) ?? []).some((k) => k.own)) && alphaOf(e.style.bg) > 0 && differsFromParent(e));
  const texts = els.filter((e) => e.visible && e.own && e.style.fontSize > 0);
  return { snap, els, byI, kids, ancestors, bgOf, isControl, inControl, inGrammar, shadowOn, borderOn, buttons, inputs, cards, bands, badges, texts, containerOf, cardOf: containerOf, vw };
}

const describe = (e) => {
  let content = '';
  if (e.own) content = ' "' + e.own.slice(0, 40) + '"';
  else if (e.value) content = ' [' + e.value.slice(0, 30) + ']';
  return e.tag + (e.id ? '#' + e.id : '') + content;
};
const near = (a, b, tol = 1) => a != null && b != null && Math.abs(a - b) <= tol;
const rgbaText = (c) => `rgba(${(c ?? []).join(', ')})`;

/** Probes the page must normalise: every expected colour and shadow in computed form. */
export function geometryProbes(g) {
  const a = g.at[0];
  const out = {};
  for (const [v, s] of Object.entries(a.button.variants)) {
    out[`button.${v}.bg`] = { prop: 'background-color', value: s['background-color']?.value ?? 'transparent' };
    out[`button.${v}.fg`] = { prop: 'color', value: s.color?.value ?? 'currentColor' };
    if (s['border-top-color']?.value) out[`button.${v}.border`] = { prop: 'border-top-color', value: s['border-top-color'].value };
  }
  for (const v of ['primary', 'secondary']) {
    out[`input.${v}.bg`] = { prop: 'background-color', value: a.input[v]['background-color']?.value ?? 'transparent' };
    out[`input.${v}.shadow`] = { prop: 'box-shadow', value: a.input[v]['box-shadow']?.value ?? 'none' };
  }
  out['card.top.shadow'] = { prop: 'box-shadow', value: a.card.top['box-shadow']?.value ?? 'none' };
  out['card.nested.border'] = { prop: 'border-top-color', value: a.card.nested['border-top-color']?.value ?? 'transparent' };
  return out;
}

/** A button's corner radius: a pill when the resolved radius reaches half the height, else the resolved radius. */
function buttonRadius(e, a, off) {
  const r = a.button['border-radius']?.px;
  const pill = isPill(r, a.button.heightPx);
  const gotR = Math.min(e.style.radius, e.rect.h / 2);
  if (pill ? gotR < e.rect.h / 2 - 0.75 : !near(gotR, r)) off('button', e, 'border-radius', `${e.style.radius}px`, pill ? `a pill: ${r}px = ${a.button['border-radius']?.declared} (radius >= height/2)` : `${r}px`, a.button['border-radius']?.file);
}

/** A button's height: a full-width one keeps the touch floor, any other the resolved height. */
function buttonHeight(e, a, off, { fill, iconOnly }) {
  if (fill) {
    const floor = a.button.fill['min-height']?.px;
    if (floor != null && e.rect.h < floor - 0.75) off('button', e, 'min-height (full width)', `${e.rect.h}px`, `>= ${floor}px (${a.button.fill['min-height']?.declared})`, a.button.fill['min-height']?.file);
    return;
  }
  const expectedH = a.button.heightPx;
  if (!iconOnly && expectedH != null && !near(e.rect.h, expectedH)) off('button', e, 'height', `${e.rect.h}px`, `${expectedH}px (${a.button.height?.declared})`, a.button.height?.file);
}

/** The outline variant's border: width and colour against the resolved outline button. */
function outlineBorder(e, a, P, off) {
  const b = e.style.border[0];
  const ow = a.button.variants.outline;
  if (ow['border-top-width']?.px != null && !near(b.w, ow['border-top-width'].px, 0.25)) off('button', e, 'outline border width', `${b.w}px`, `${ow['border-top-width'].px}px`, ow['border-top-width'].file);
  if (P['button.outline.border']?.rgba && !sameColor(b.color, P['button.outline.border'].rgba)) off('button', e, 'outline border colour', rgbaText(b.color), `${P['button.outline.border'].value} (${ow['border-top-color']?.declared})`, ow['border-top-color']?.file);
}

/** A button's fill: one of the Button variants (a transparent one may carry the outline border). */
function buttonFill(e, view, a, P, variantColors, off) {
  const bg = e.style.bg;
  const variant = variantColors.some((vc) => (alphaOf(bg) < 0.02 ? alphaOf(vc.bg) < 0.02 : sameColor(bg, vc.bg)));
  if (!variant) {
    off('button', e, 'fill', bg ? `rgba(${bg.join(', ')})` : 'none', `one of the Button variants: ${variantColors.filter((x) => x.bg).map((x) => x.v + ' ' + P['button.' + x.v + '.bg']?.value).join('; ')}`, a.button.variants.primary['background-color']?.file);
    return;
  }
  if (alphaOf(bg) < 0.02 && view.borderOn(e)) outlineBorder(e, a, P, off);
}

/** The findings of one button: radius, height, padding, font size and fill. */
function buttonFindingsOf(e, view, a, P, variantColors, off) {
  const parent = e.parent != null ? view.byI.get(e.parent) : null;
  const parentContent = parent ? parent.rect.w - parent.style.padding[1] - parent.style.padding[3] : null;
  // A real grammar Button declares its width (data-width fill|content); only a hand-drawn one is judged by its box.
  const fill = e.comp === 'Button' && e.dataWidth ? e.dataWidth === 'fill' : parentContent != null && e.rect.w >= parentContent - 1.5 && e.rect.w > e.rect.h * 3;
  const iconOnly = e.rect.w <= e.rect.h + 2;
  // The resolved geometry is the default (md) Button's; a sm or lg one (the grammar Alert's action is sm) is judged on
  // its shape (the pill) only.
  const sized = /(?:^|\s)button--(?:sm|lg)(?:\s|$)/.test(e.cls);
  buttonRadius(e, a, off);
  if (!sized) buttonHeight(e, a, off, { fill, iconOnly });
  if (!sized && !iconOnly && !fill && a.button['padding-left']?.px != null && !near(e.style.padding[3], a.button['padding-left'].px)) off('button', e, 'padding-inline', `${e.style.padding[3]}px`, `${a.button['padding-left'].px}px`, a.button['padding-left'].file);
  const label = e.own ? e : (view.kids.get(e.i) ?? []).find((k) => k.own) ?? e;
  if (a.button['font-size']?.px != null && label.own && !near(label.style.fontSize, a.button['font-size'].px, 0.5)) off('button', e, 'font-size', `${label.style.fontSize}px`, `${a.button['font-size'].px}px`, a.button['font-size'].file);
  buttonFill(e, view, a, P, variantColors, off);
}

function buttonFindings(view, a, P, off) {
  const variantColors = BUTTON_VARIANTS.map((v) => ({ v, bg: P[`button.${v}.bg`]?.rgba, fg: P[`button.${v}.fg`]?.rgba, border: P[`button.${v}.border`]?.rgba }));
  for (const e of view.buttons) buttonFindingsOf(e, view, a, P, variantColors, off);
}

/** An input's fill and shadow: inside a surface the secondary variant, on the canvas the primary (or secondary) fill. */
function inputFill(e, a, P, inside, off) {
  const wantBg = P[`input.${inside ? 'secondary' : 'primary'}.bg`]?.rgba;
  if (!inside) {
    if (wantBg && !sameColor(e.style.bg, wantBg) && !sameColor(e.style.bg, P['input.secondary.bg']?.rgba)) off('input', e, 'fill', rgbaText(e.style.bg), `${P['input.primary.bg'].value} (primary) or ${P['input.secondary.bg']?.value} (secondary)`, a.input.primary['background-color']?.file);
    return;
  }
  const wantShadow = normalizeShadowText(P['input.secondary.shadow']?.value);
  if (wantBg && !sameColor(e.style.bg, wantBg)) off('input', e, 'fill (inside a surface: secondary variant)', rgbaText(e.style.bg), `${P['input.secondary.bg'].value} (${a.input.secondary['background-color']?.declared}) - knowledge/ui/proof/anatomy-source.yaml ANATOMY-2 case-1`, a.input.secondary['background-color']?.file);
  if (normalizeShadowText(e.style.shadow) !== wantShadow) off('input', e, 'shadow (inside a surface: secondary variant)', normalizeShadowText(e.style.shadow), wantShadow, a.input.secondary['box-shadow']?.file);
}

function inputFindings(view, a, P, off) {
  for (const e of view.inputs) {
    const inside = Boolean(view.containerOf(e)) || view.ancestors(e).some((x) => view.bands.some((b) => b.i === x.i));
    const spec = a.input[inside ? 'secondary' : 'primary'];
    const r = spec['border-radius']?.px;
    if (r != null && !near(e.style.radius, r)) off('input', e, 'border-radius', `${e.style.radius}px`, `${r}px (${spec['border-radius'].declared})`, spec['border-radius'].file);
    const drawnBorder = e.style.border.some((b) => b.w > 0 && b.style !== 'none' && alphaOf(b.color) > 0.02);
    if ((spec['border-top-width']?.px ?? 0) === 0 && drawnBorder) off('input', e, 'border', `${e.style.border[0].w}px ${e.style.border[0].style}`, `none (${spec['border-top-width']?.declared}${chainText(spec['border-top-width'])})`, spec['border-top-width']?.file);
    inputFill(e, a, P, inside, off);
  }
}

/** A top-level card: no border, and the resolved shadow. */
function topCardFindings(e, spec, P, view, off) {
  if (view.borderOn(e)) off('card', e, 'border', `${e.style.border[0].w}px ${e.style.border[0].style}`, `none (${spec['border-top-width']?.declared})`, spec['border-top-width']?.file);
  const want = normalizeShadowText(P['card.top.shadow']?.value);
  if (normalizeShadowText(e.style.shadow) !== want) off('card', e, 'shadow', normalizeShadowText(e.style.shadow), `${want} (${spec['box-shadow']?.declared}${chainText(spec['box-shadow'])})`, spec['box-shadow']?.file);
}

/** A nested card: the resolved border width and shadow. */
function nestedCardFindings(e, spec, off) {
  const bw = spec['border-top-width']?.px;
  if (bw != null && !near(e.style.border[0].w, bw, 0.25)) off('nested card', e, 'border', `${e.style.border[0].w}px`, `${bw}px ${spec['border-top-color']?.value ?? ''}`, spec['border-top-width']?.file);
  if (normalizeShadowText(e.style.shadow) !== normalizeShadowText(spec['box-shadow']?.value)) off('nested card', e, 'shadow', normalizeShadowText(e.style.shadow), normalizeShadowText(spec['box-shadow']?.value), spec['box-shadow']?.file);
}

function cardFindings(view, a, P, off) {
  for (const { el: e, nested } of view.cards) {
    const spec = nested ? a.card.nested : a.card.top;
    const r = spec['border-radius']?.px;
    if (r != null && !near(Math.min(e.style.radius, e.rect.h / 2), Math.min(r, e.rect.h / 2))) off(nested ? 'nested card' : 'card', e, 'border-radius', `${e.style.radius}px`, `${r}px (${spec['border-radius'].declared}${chainText(spec['border-radius'])})`, spec['border-radius'].file);
    if (nested) nestedCardFindings(e, spec, off);
    else topCardFindings(e, spec, P, view, off);
  }
}

function badgeFindings(view, a, off) {
  for (const e of view.badges) {
    if (Math.min(e.style.radius, e.rect.h / 2) < e.rect.h / 2 - 0.75) off('badge', e, 'border-radius', `${e.style.radius}px`, `a pill (radius >= height/2; ${a.badge['border-radius']?.declared})`, a.badge['border-radius']?.file);
    const label = e.own ? e : (view.kids.get(e.i) ?? []).find((k) => k.own);
    if (label && a.badge['font-size']?.px != null && !near(label.style.fontSize, a.badge['font-size'].px, 0.5)) off('badge', e, 'font-size', `${label.style.fontSize}px`, `${a.badge['font-size'].px}px`, a.badge['font-size'].file);
  }
}

/** The page inset variable of the product, or null when the resolver cannot read it. */
function pageInset(g, width) {
  try { return g.resolver.memo(`inset-${width}`, [g.chains.html, g.chains.root], width).variable('--grammar-page-inset'); } catch { return null; }
}

// Page inset: a page-scoped render (a `<shape>--page--<breakpoint>--<theme>` part) keeps its top-level content -
// text outside any card or control, and every top-level card - the page inset (--grammar-page-inset, PageContainer;
// knowledge/ui/presentation/padding.yaml scale notes, measure.yaml MEASURE-1) from both viewport edges. A
// module-ledger page on mobile: a page header flush with the left edge (0px) passed because nothing measured it.
function pageInsetFindings(view, g, { file, width }, off) {
  if (!/--page--/.test(path.basename(String(file ?? ''))) || !g.resolver || !g.chains) return;
  const inset = pageInset(g, width);
  if (inset?.px == null) return;
  const top = [...view.cards.filter((c) => !c.nested).map((c) => c.el), ...view.texts.filter((t) => !view.inControl(t) && !view.containerOf(t))]
    .filter((e) => e.rect.w > 0 && e.rect.h > 0);
  const leftMost = top.reduce((m, e) => (!m || e.rect.x < m.rect.x ? e : m), null);
  const rightMost = top.reduce((m, e) => (!m || e.rect.x + e.rect.w > m.rect.x + m.rect.w ? e : m), null);
  const want = `>= ${inset.px}px (--grammar-page-inset ${inset.declared ?? inset.value ?? ''} at ${width}px; PageContainer, measure.yaml MEASURE-1)`;
  if (leftMost && leftMost.rect.x < inset.px - 1) off('page', leftMost, 'inline inset (left)', `${Math.round(leftMost.rect.x * 10) / 10}px`, want, inset.file ?? null);
  const right = rightMost ? width - (rightMost.rect.x + rightMost.rect.w) : null;
  if (rightMost && right < inset.px - 1) off('page', rightMost, 'inline inset (right)', `${Math.round(right * 10) / 10}px`, want, inset.file ?? null);
}

/** Text runs set in a family the product does not bind: one finding per off family. */
function fontFindings(view, g, off) {
  const allowed = new Set(g.font.allowed);
  const offFamilies = new Map();
  for (const e of view.texts) {
    const fam = firstFamily(e.style.fontFamily);
    if (!fam || allowed.has(fam)) continue;
    if (!offFamilies.has(fam)) offFamilies.set(fam, []);
    offFamilies.get(fam).push(e);
  }
  for (const [fam, list] of offFamilies) off('text', list[0], 'font-family', `${fam} (${list.length} text runs)`, `the family font: ${[...allowed].join(' or ')}`, g.font.binding?.file);
}

function resolveAt(g, width) {
  const hit = g.at.find((w) => w.width === width);
  if (hit) return hit;
  const again = resolveGeometry({ repo: g.sources.repo, family: g.family, widths: [width], ...g.sources.drawCss });
  return again.ok ? again.at[0] : g.at[0];
}

/** GEOMETRY_OFF_GRAMMAR findings of one snapshot against the resolved geometry at the snapshot's width. */
export function geometryFindings(snap, g, { file = snap.file } = {}) {
  const view = readSnapshot(snap);
  const width = snap.viewport?.width ?? DEFAULT_VIEWPORT.width;
  const a = g.resolver ? resolveAt(g, width) : g.at[0];
  const P = snap.probes ?? {};
  const out = [];
  const off = (element, e, property, got, expected, source) => out.push({ level: 'refuse', code: GEOMETRY_CODE, file, element, at: describe(e), property, got, expected, source });
  buttonFindings(view, a, P, off);
  inputFindings(view, a, P, off);
  cardFindings(view, a, P, off);
  badgeFindings(view, a, off);
  pageInsetFindings(view, g, { file, width }, off);
  fontFindings(view, g, off);
  return { findings: out, counts: { buttons: view.buttons.length, inputs: view.inputs.length, cards: view.cards.length, badges: view.badges.length, texts: view.texts.length } };
}
