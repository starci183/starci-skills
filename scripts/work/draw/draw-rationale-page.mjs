// draw-rationale-page.mjs - the in-page halves of draw-rationale.mjs: measureRationale and drawRedlines run inside the
// browser (playwright serializes each function, so each is self-contained and reads nothing of this module).
/**
 * Measure what the render uses: every distinct gap/padding/inset, radius, font-size, font-weight and line-height of a
 * visible element (type values only where the element renders text), the colours it paints, its grids, its regions
 * and its background-image art. `arg` {tokens: ['--accent', ...], whyAttr, redlineAttr, schema}.
 */
export function measureRationale(arg) {
  const { tokens = [], whyAttr, redlineAttr, schema } = arg;
  const px = (s) => { const n = Number.parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  // Any CSS colour (rgb, oklch, color-mix ...) to sRGB hex through a 1px canvas; transparent is null.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const hexCache = new Map();
  const hexOf = (c) => {
    const key = String(c);
    if (hexCache.has(key)) return hexCache.get(key);
    let hex = null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000'; ctx.fillStyle = key;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] > 5) hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    } catch { hex = null; }
    hexCache.set(key, hex);
    return hex;
  };
  // The inset sides an author wrote (a used value is reported for every side of a positioned element, so only the
  // sides a matching rule or the inline style sets are the render's decisions).
  const insetRules = [];
  const collect = (rules) => {
    for (const r of rules ?? []) {
      if (r.cssRules && r.conditionText != null) { if (window.matchMedia(r.conditionText).matches) { collect(r.cssRules); } continue; }
      if (r.cssRules && !r.selectorText) { collect(r.cssRules); continue; }
      if (!r.selectorText || !r.style) continue;
      const sides = ['top', 'right', 'bottom', 'left'].filter((k) => { const v = r.style.getPropertyValue(k); return v && v !== 'auto'; });
      if (sides.length) insetRules.push({ selector: r.selectorText, sides });
    }
  };
  for (const sheet of document.styleSheets) { try { collect(sheet.cssRules); } catch { /* a cross-origin sheet */ } }
  const insetSides = (el) => {
    const sides = new Set(['top', 'right', 'bottom', 'left'].filter((k) => { const v = el.style?.getPropertyValue(k); return v && v !== 'auto'; }));
    for (const r of insetRules) { try { if (el.matches(r.selector)) for (const k of r.sides) sides.add(k); } catch { /* an unsupported selector */ } }
    return [...sides];
  };
  const sel = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
  };
  const whyOf = (el) => { const w = el.closest(`[${whyAttr}]`); return w ? w.getAttribute(whyAttr).split(/\s+/).filter(Boolean) : []; };
  const excluded = (el) => Boolean(el.closest(`[${redlineAttr}],#redlines`));
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const values = { spacing: new Map(), radius: new Map(), fontSize: new Map(), fontWeight: new Map(), lineHeight: new Map() };
  const put = (cls, value, el) => {
    if (value == null || value === 0) return;
    if (!values[cls].has(value)) values[cls].set(value, []);
    const at = values[cls].get(value);
    if (at.length < 3) at.push(sel(el));
  };
  const colours = new Map();
  const colour = (hex, use, el) => { if (!hex) { return; } const k = `${hex}|${use}`; if (!colours.has(k)) { colours.set(k, { hex, use, at: [] }); } const c = colours.get(k); if (c.at.length < 3) { c.at.push(sel(el)); } };
  const grids = [], art = [];
  const all = [...document.querySelectorAll('body *')].filter((el) => !excluded(el) && !(el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') && !['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName) && visible(el));
  const collectSpacing = (el, cs) => {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) put('spacing', px(cs[`padding${side}`]), el);
    if (/flex|grid/.test(cs.display)) { put('spacing', px(cs.rowGap), el); put('spacing', px(cs.columnGap), el); }
    if (cs.position !== 'static') {
      for (const side of insetSides(el)) { const v = px(cs[side]); if (v != null) put('spacing', Math.abs(v), el); }
    }
  };
  const collectRadii = (el, cs) => {
    for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']) {
      const raw = String(cs[corner]).split(' ')[0];
      if (!raw || raw === '0px') continue;
      if (raw.endsWith('%')) put('radius', Number.parseFloat(raw) >= 50 ? 'circle' : raw, el);
      else { const v = px(raw); const r = el.getBoundingClientRect(); put('radius', v != null && (v >= 999 || v >= Math.min(r.width, r.height) / 2 - 0.5) && v > 8 ? 'pill' : v, el); }
    }
  };
  const collectText = (el, cs) => {
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (text) {
      put('fontSize', px(cs.fontSize), el);
      put('fontWeight', Number(cs.fontWeight) || null, el);
      if (cs.lineHeight !== 'normal') put('lineHeight', px(cs.lineHeight), el);
      colour(hexOf(cs.color), 'text', el);
    }
  };
  const collectBorders = (el, cs) => {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (Number.parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') colour(hexOf(cs[`border${side}Color`]), 'border', el);
  };
  // The tracks of a grid template: pieces split at whitespace unless the next parenthesis after it closes one.
  const trackCountOf = (template) => {
    let count = 0, from = 0;
    const closesFirst = (at) => { const open = template.indexOf('(', at), close = template.indexOf(')', at); return close !== -1 && (open === -1 || close < open); };
    for (const run of template.matchAll(/\s+/g)) {
      if (closesFirst(run.index + run[0].length)) continue;
      if (run.index > from) count += 1;
      from = run.index + run[0].length;
    }
    return template.length > from ? count + 1 : count;
  };
  const collectGrid = (el, cs) => {
    if (cs.display === 'grid') {
      const kids = [...el.children].filter((k) => visible(k) && !excluded(k));
      if (kids.length >= 2) grids.push({ selector: sel(el), why: whyOf(el), columns: trackCountOf(cs.gridTemplateColumns) });
    }
  };
  const measureElement = (el) => {
    const cs = getComputedStyle(el);
    collectSpacing(el, cs);
    collectRadii(el, cs);
    collectText(el, cs);
    colour(hexOf(cs.backgroundColor), 'background', el);
    collectBorders(el, cs);
    collectGrid(el, cs);
    if (/url\(/.test(cs.backgroundImage)) art.push({ selector: sel(el), why: whyOf(el) });
  };
  for (const el of all) {
    measureElement(el);
  }
  const pick = (m) => [...m.entries()].map(([value, at]) => ({ value, at })).sort((a, b) => String(a.value).localeCompare(String(b.value), 'en', { numeric: true }));
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const tokenColours = {};
  const rootStyle = getComputedStyle(document.documentElement);
  for (const t of tokens) {
    if (!rootStyle.getPropertyValue(t).trim()) continue;
    probe.style.color = `var(${t})`;
    const hex = hexOf(getComputedStyle(probe).color);
    if (hex) tokenColours[t] = hex;
  }
  probe.remove();
  const container = document.querySelector('[data-grammar-component="PageContainer"]') ?? document.querySelector('main') ?? document.body;
  const regions = [...container.children].filter((k) => !excluded(k) && !['SCRIPT', 'STYLE', 'TEMPLATE'].includes(k.tagName) && visible(k));
  return { schema, viewport: { width: innerWidth, height: innerHeight }, values: Object.fromEntries(Object.entries(values).map(([k, m]) => [k, pick(m)])),
    colours: [...colours.values()], grids, art, tokenColours, regions: { count: regions.length, whys: regions.map(whyOf) } };
}

/**
 * Draw the redline overlay into the page (html.annotate): spacing brackets with the value and the decision's first
 * rule id for region gaps and card paddings, a DNA label at each component root, the labels kept apart (a label that
 * would overlap another is moved, else dropped). `arg` {labels: redlineLabelsOf(entries), whyAttr, redlineAttr,
 * leaf: REDLINE_LEAF_COMPONENTS}.
 */
export function drawRedlines(arg) {
  const { labels = {}, whyAttr, redlineAttr, leaf = [] } = arg;
  document.documentElement.classList.add('annotate');
  const W = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const H = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElement('div');
  host.setAttribute(redlineAttr, '');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:2147483647;pointer-events:none`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  host.appendChild(svg);
  document.body.appendChild(host);
  const RED = '#d4001a', BLUE = '#1d4ed8';
  const placed = [];
  const hits = (r) => placed.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y);
  const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) { n.setAttribute(k, v); } svg.appendChild(n); return n; };
  const line = (x1, y1, x2, y2, c) => el('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': 1 });
  const label = (x, y, text, c) => {
    const w = text.length * 6 + 6, h = 12;
    for (const dy of [0, 13, -13, 26, -26, 39]) {
      const r = { x: Math.min(Math.max(0, x), W - w), y: Math.max(0, y + dy - h), w, h };
      if (hits(r)) continue;
      placed.push(r);
      el('rect', { x: r.x, y: r.y, width: w, height: h, fill: 'rgba(255,255,255,0.92)', stroke: c, 'stroke-width': 0.5, rx: 2 });
      const t = el('text', { x: r.x + 3, y: r.y + 9, fill: c, 'font-size': 9, 'font-family': 'ui-monospace,Menlo,Consolas,monospace' });
      t.textContent = text;
      return true;
    }
    return false;
  };
  const box = (n) => { const b = n.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; };
  const visible = (n) => { const b = n.getBoundingClientRect(); const cs = getComputedStyle(n); return b.width > 1 && b.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const whys = (n) => (n.getAttribute(whyAttr) ?? '').split(/\s+/).filter(Boolean);
  const labelOf = (n) => whys(n).map((id) => labels[id]).find(Boolean) ?? null;
  const round = (v) => Math.round(v * 10) / 10;
  const vtick = (x, y1, y2) => { line(x, y1, x, y2, RED); line(x - 3, y1, x + 3, y1, RED); line(x - 3, y2, x + 3, y2, RED); };
  const htick = (x1, x2, y) => { line(x1, y, x2, y, RED); line(x1, y - 3, x1, y + 3, RED); line(x2, y - 3, x2, y + 3, RED); };
  const all = [...document.querySelectorAll(`[${whyAttr}]`)].filter((n) => !n.closest(`[${redlineAttr}],#redlines`) && !(n instanceof SVGElement) && visible(n));
  // Spacing brackets: the gaps between the children of a layout/spacing decision's element, and its padding.
  const gapIsDecided = (ncs, gap) => gap <= 48 || [Number.parseFloat(ncs.rowGap), Number.parseFloat(ncs.columnGap)].some((d) => Number.isFinite(d) && Math.abs(d - gap) < 1);
  const drawGapForPair = (first, second, shown, ncs, tag) => {
    const a = box(first), b = box(second);
    const vgap = round(b.y - (a.y + a.h)), hgap = round(b.x - (a.x + a.w));
    if (vgap > 0.5 && gapIsDecided(ncs, vgap) && b.y >= a.y + a.h - 1) {
      const x = Math.max(2, a.x - 5);
      vtick(x, a.y + a.h, b.y);
      if (!shown.has(`v${vgap}`)) { shown.add(`v${vgap}`); label(x + 4, a.y + a.h + vgap / 2 + 6, tag(vgap), RED); }
    } else if (hgap > 0.5 && gapIsDecided(ncs, hgap) && Math.abs(a.y - b.y) < Math.max(a.h, b.h)) {
      const y = a.y + Math.min(a.h, b.h) / 2;
      htick(a.x + a.w, b.x, y);
      if (!shown.has(`h${hgap}`)) { shown.add(`h${hgap}`); label(a.x + a.w, y - 4, tag(hgap), RED); }
    }
  };
  const drawPadding = (n, tag) => {
    const cs = getComputedStyle(n), b = box(n);
    const pt = round(Number.parseFloat(cs.paddingTop) || 0), pl = round(Number.parseFloat(cs.paddingLeft) || 0);
    if (pl > 0.5 && b.h > 24) htick(b.x, b.x + pl, b.y + Math.min(b.h - 4, 12));
    if (pt > 0.5 && b.w > 24) vtick(b.x + Math.min(b.w - 4, 12), b.y, b.y + pt);
    if (pt > 0.5 || pl > 0.5) label(b.x + pl + 2, b.y + pt + 11, tag(pt === pl || !pt || !pl ? `p ${pt || pl}` : `p ${pt}/${pl}`), RED);
  };
  const drawSpacingForElement = (n) => {
    const l = labelOf(n);
    if (!l || !['layout', 'spacing'].includes(l.kind)) return;
    const tag = (v) => `${v}${l.rule ? ' · ' + l.rule : ''}`;
    const kids = [...n.children].filter((k) => !(k instanceof SVGElement) && visible(k));
    const shown = new Set();
    // A decided gap is the container's gap (or a small margin); the free space of space-between is no decision.
    const ncs = getComputedStyle(n);
    for (let i = 0; i < kids.length - 1; i += 1) drawGapForPair(kids[i], kids[i + 1], shown, ncs, tag);
    drawPadding(n, tag);
  };
  for (const n of all) drawSpacingForElement(n);
  // DNA labels at component roots, regions outlined.
  const drawComponentLabels = () => {
    for (const n of document.querySelectorAll('[data-grammar-component]')) {
      if (n.closest(`[${redlineAttr}],#redlines`) || !visible(n)) continue;
      const name = n.getAttribute('data-grammar-component');
      const upName = n.parentElement?.closest('[data-grammar-component]')?.getAttribute('data-grammar-component');
      if (leaf.includes(name) || (upName === name && n.hasAttribute('data-grammar-part'))) continue;
      const b = box(n);
      if (b.w < 48 || b.h < 24) continue;
      const l = labelOf(n);
      if (l?.kind === 'layout') el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: BLUE, 'stroke-width': 1, 'stroke-dasharray': '3 2' });
      const variant = n.getAttribute('data-variant') ?? n.getAttribute('data-tone');
      label(b.x + 2, b.y + 12, `${name}${variant ? ' ' + variant : ''}`, BLUE);
    }
  };
  drawComponentLabels();
  return { labels: placed.length };
}
