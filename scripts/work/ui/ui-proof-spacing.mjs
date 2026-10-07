// ui-proof-spacing.mjs — the spacing section of a ui proof score: measured insets and gaps of a render against
// the knowledge values (see ui-proof-brief.mjs, the owner).
import { alphaOf } from './grammar-geometry.mjs';
import { remPx } from './ui-proof-numbers.mjs';

export const r1 = (n) => Math.round(n * 10) / 10;
const quote = (value) => ` "${value}"`;
export const tag = (e) => `${e.tag}${e.own ? quote(e.own.slice(0, 28)) : ''}`;

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
  const page = anc.find((a) => a.comp === 'PageContainer') ?? padded.at(-1) ?? null;
  const cardRight = card.rect.x + card.rect.w;
  if (!page) return { left: card.rect.x, right: width - cardRight, via: 'viewport' };
  const [, pr, , pl] = page.style.padding;
  const [, br, , bl] = page.style.border.map((b) => (b.style === 'none' ? 0 : b.w));
  const outerL = page.rect.x + bl, outerR = page.rect.x + page.rect.w - br;
  const left = card.rect.x < outerL + pl - 0.5 ? card.rect.x - outerL : pl;
  const right = cardRight > outerR - pr + 0.5 ? outerR - cardRight : pr;
  return { left, right, via: `${tag(page)}${page.cls ? '.' + page.cls.split(/\s+/)[0] : ''} padding` };
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

export const scalePx = (knowledge, name) => (knowledge.find((k) => k.rel.endsWith(`presentation/${name}.yaml`))?.doc.scale?.steps ?? []).map((s) => remPx(s.value)).filter((n) => n != null);

const SIDES = ['top', 'right', 'bottom', 'left'];
const GAP_2_SOURCE = 'knowledge/ui/presentation/gap.yaml componentOwnership Input root = GAP-2';
const CARD_CONTENT_SOURCE = 'knowledge/ui/presentation/padding.yaml PADDING-4 case-2';

/** One measured row: pass within 1.5px of the expected value, fail beyond it, unmeasurable without a measure. */
const rowAdder = (out) => (id, source, got, exp, extra = '') => {
  const measured = got == null ? null : r1(got);
  let status = 'unmeasurable';
  if (got != null) {
    status = 'fail';
    if (Math.abs(got - exp) <= 1.5) status = 'pass';
  }
  out.push({ id, source, got: measured, exp, status, evidence: extra });
};

/** Closed scale for every padding, gap and margin the page draws (component-internal controls excluded). */
function closedScaleRow(v, ctx) {
  const scale = new Set([...scalePx(ctx.knowledge, 'padding'), ...scalePx(ctx.knowledge, 'gap'), ...scalePx(ctx.knowledge, 'margin')].map((n) => Math.round(n)));
  const off = [];
  for (const e of v.els.filter((x) => x.visible && !v.inControl(x) && !v.inGrammar?.(x) && !v.badges.some((b) => b.i === x.i))) {
    const values = [...e.style.padding.map((p, k) => [`padding-${SIDES[k]}`, p]), ['row-gap', e.style.rowGap], ['column-gap', e.style.columnGap], ['margin-top', e.style.margin[0]], ['margin-bottom', e.style.margin[2]]];
    for (const [prop, val] of values) if (val != null && val > 0 && !scale.has(Math.round(val)) && Math.abs(val - (ctx.pageInset ?? -1)) > 0.5) off.push(`${prop} ${r1(val)}px on ${tag(e)}`);
  }
  return { id: 'closed-scale', source: 'knowledge/ui/presentation/padding.yaml scale; gap.yaml scale; margin.yaml scale', got: `${off.length} off-scale value(s)`, exp: `every value on ${[...scale].sort((a, b) => a - b).join('/')}px (the page inset is PageContainer's clamp)`, status: off.length ? 'fail' : 'pass', evidence: off.slice(0, 12).join('; ') };
}

// Page inset: PageContainer's own inline padding. The page box is the card's PageContainer (data-component), else its
// outermost ancestor that pads its inline sides; a centred measure's auto margin lies outside that box, and a capped
// region centred inside it (MEASURE-4 case-3, a formCompact card) sits farther in by layout, not by inset. A card
// pushed into the padding (a negative margin, an overflow) is measured where it actually sits. With no padded
// ancestor the card's distance from the viewport edge is the inset.
function pageInsetRow(v, ctx, add) {
  const tops = v.cards.filter((c) => !c.nested).map((c) => c.el);
  if (ctx.pageInset == null || !tops.length) return;
  const sides = tops.map((card) => pageInsetOf(v, card, ctx.width));
  const got = sides.flatMap((s) => [s.left, s.right]).reduce((a, b) => (Math.abs(b - ctx.pageInset) > Math.abs(a - ctx.pageInset) ? b : a));
  add('page-inset', 'knowledge/ui/presentation/padding.yaml scale notes (--grammar-page-inset, PageContainer); measure.yaml MEASURE-1', got, ctx.pageInset, sides.map((s) => `${s.via}: left ${r1(s.left)}px, right ${r1(s.right)}px`).filter((x, k, all) => all.indexOf(x) === k).join('; ') + ` at ${ctx.width}px`);
}

// A disclosure surface (a <details> root, a SurfaceAccordionCard): the trigger is a control that owns the inset
// (PADDING-4 case-3); the root has none by design. Each full-width trigger's own padding is the measure.
function disclosureRows(v, card, triggers, ctx, add) {
  const src = 'knowledge/ui/presentation/padding.yaml PADDING-4 case-3 (SurfaceAccordionCard trigger)';
  for (const t of triggers) {
    const [pt, pr, pb, pl] = t.style.padding;
    const where = `${tag(t)} in ${tag(card)}`;
    add('disclosure trigger inset top', src, pt, ctx.edgeInset, where);
    add('disclosure trigger inset left', src, pl, ctx.edgeInset, where);
    add('disclosure trigger inset right', src, pr, ctx.edgeInset, where);
    add('disclosure trigger inset bottom', src, pb, ctx.edgeInset, where);
  }
}

// A card without bands holds its content the content inset away.
function plainCardRows(v, card, ctx, add) {
  const ext = contentExtent(v, card);
  if (!ext) return;
  const want = ctx.cardInset;
  // A decorative artwork zone in flow at the card's head (grammar 0.6.0 SurfaceCard artwork below 48rem) is the
  // band's art, not its inset: the content inset is measured from the zone's lower edge.
  const art = v.els.filter((e) => e.visible && /(?:^|\s)starci-core-surface-artwork(?:\s|$)/.test(e.cls ?? '') && v.ancestors(e).some((a) => a.i === card.i) && e.rect.y <= card.rect.y + ctx.cardInset + 1.5 && e.rect.y + e.rect.h <= ext.top + 0.5);
  const head = art.length ? Math.max(...art.map((e) => e.rect.y + e.rect.h)) : card.rect.y;
  add('card-inset top', `${CARD_CONTENT_SOURCE} (SurfaceCard content)`, ext.top - head, want, tag(card));
  add('card-inset left', CARD_CONTENT_SOURCE, ext.left - card.rect.x, want, tag(card));
  add('card-inset bottom', CARD_CONTENT_SOURCE, card.rect.y + card.rect.h - ext.bottom, want, tag(card));
}

// A joined card (bands split by hairlines) by side contact.
function bandedCardRows(v, card, lines, ctx, add, out) {
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

/** Card insets: a disclosure surface by its trigger, a plain card by its content, a banded card by side contact. */
function cardRows(v, ctx, add, out) {
  for (const { el: card } of v.cards) {
    const triggers = disclosureTriggers(v, card);
    if (triggers.length) { disclosureRows(v, card, triggers, ctx, add); continue; }
    const lines = hairlines(v, card);
    if (lines.length) bandedCardRows(v, card, lines, ctx, add, out);
    else plainCardRows(v, card, ctx, add);
  }
}

/** Field anatomy: the gaps between an input's label, its hint and the control. */
function inputRows(v, input, ctx, add) {
  const label = v.els.find((e) => e.visible && e.tag === 'label' && e.rect.y + e.rect.h <= input.rect.y + 1 && Math.abs(e.rect.x - input.rect.x) < 24 && input.rect.y - (e.rect.y + e.rect.h) < 60 && input.labelText && e.own && input.labelText.includes(e.own.slice(0, 12)));
  if (!label) return;
  const between = v.texts.filter((t) => t.rect.y >= label.rect.y + label.rect.h - 1 && t.rect.y + t.rect.h <= input.rect.y + 1 && !v.ancestors(t).some((a) => a.i === label.i) && t.i !== label.i);
  const hint = between.sort((a, b) => a.rect.y - b.rect.y)[0];
  if (hint) {
    add('label to hint', GAP_2_SOURCE, hint.rect.y - (label.rect.y + label.rect.h), ctx.inputGap, tag(input));
    add('hint to control', GAP_2_SOURCE, input.rect.y - (hint.rect.y + hint.rect.h), ctx.inputGap, tag(input));
  } else add('label to control', GAP_2_SOURCE, input.rect.y - (label.rect.y + label.rect.h), ctx.inputGap, tag(input));
}

/** Field to field in a form stack. */
function fieldStackRows(v, ctx, add) {
  const sorted = v.inputs.slice().sort((a, b) => a.rect.y - b.rect.y);
  for (let k = 1; k < sorted.length; k++) {
    const prev = sorted[k - 1], cur = sorted[k];
    if (Math.abs(prev.rect.x - cur.rect.x) > 2 || v.containerOf(prev)?.i !== v.containerOf(cur)?.i) continue;
    const curLabel = v.els.find((e) => e.visible && e.tag === 'label' && e.rect.y + e.rect.h <= cur.rect.y + 1 && e.rect.y >= prev.rect.y + prev.rect.h - 1);
    const top = curLabel ? curLabel.rect.y : cur.rect.y;
    add('field to field', 'knowledge/ui/presentation/gap.yaml GAP-4 case-3', top - (prev.rect.y + prev.rect.h), ctx.fieldGap, `${tag(prev)} -> ${tag(cur)}`);
  }
}

/** Badges on one row. */
function badgeRows(v, ctx, add) {
  const badges = v.badges.slice().sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  // Two badges on one row of ONE container (the same card, else the same parent) - never badges of two peer cards.
  const sameRow = (a, b) => Math.abs(a.rect.y - b.rect.y) < 4 && (v.containerOf(a)?.i ?? a.parent) === (v.containerOf(b)?.i ?? b.parent);
  for (let k = 1; k < badges.length; k++) if (sameRow(badges[k], badges[k - 1])) add('badge to badge', 'knowledge/ui/presentation/gap.yaml GAP-2 case-4', badges[k].rect.x - (badges[k - 1].rect.x + badges[k - 1].rect.w), ctx.badgeGap, `${tag(badges[k - 1])} -> ${tag(badges[k])}`);
}

/** The spacing section: measured insets and gaps against the knowledge values. */
export function spacingChecks(v, ctx) {
  const out = [];
  const add = rowAdder(out);
  out.push(closedScaleRow(v, ctx));
  pageInsetRow(v, ctx, add);
  cardRows(v, ctx, add, out);
  for (const input of v.inputs) inputRows(v, input, ctx, add);
  fieldStackRows(v, ctx, add);
  badgeRows(v, ctx, add);
  return out;
}
