// draw-quality.mjs — owner ruling 2026-09-27 (a product's wf-<product>-modules-agentos-mujek7lg op-interface.draw-2815deda22): a
// draw with correct tokens is not a draw that passes. The owner judged the module-ledger drawing ugly - ten whole-page
// renders of one layout that differ only in a status banner, no controls for the FR's commands, internal ids and
// jargon in the copy, badges bound to no tone - and it had gone green on checks alone. What an interface.draw pass
// binds is refused, per ui record, when:
//   SHAPE_DUPLICATE          two drawn states of the same XBase at one breakpoint and theme render the same image
//                            except one horizontal band (a status banner or badge row): a data status the slot renders
//                            through SlotView, never a second shape (pixel rows compared, a shifted tail realigned);
//   DRAW_SCOPE_FULL_PAGE     the record binds a full-page composite (the layout chrome around the slot) as a drawing,
//                            or a bound image is a `--page--` composite: interface.draw draws only the XBase content
//                            (`<XBase>#<state>--<breakpoint>--<theme>.png`, or its `.content.png` part); the layout
//                            is the layout's. A `surface: layout` record draws its own chrome and is exempt;
//   DRAW_ACTION_MISSING      a drawn state that a person leaves by a command (a ui.flow transition whose trigger is an
//                            actor activating, selecting, opening, submitting ...) renders fewer controls (button,
//                            link, select, submit, role=button/link/tab/menuitem) in its render source than it has
//                            such commands - every FR command of the surface is a control;
//   DRAW_COPY_INTERNAL       the visible copy of a render source leaks internal ids or jargon (a `source:` label in
//                            either language - source-phrases.yaml drawCopy -, `installation-1`, kebab ids with a
//                            digit, uuids and hashes);
//   DRAW_BADGE_UNTONED       a badge / chip / status pill binds no tone token (data-tone, color=, a tone class, a
//                            var(--<tone>)), or a success word (installed, active, ready, confirmed) binds a tone
//                            other than success;
//   DRAW_SCORE_BELOW         a part has no ui-proof score beside it (`<render source stem>.score.json`, the
//                            `ui-proof-brief.mjs --score <html> --json` output of THAT html, its htmlSha256), or the
//                            score fails a case: every failed case is critique to address before the pass;
//   DRAW_NOT_OWNER_ACCEPTED  the drawn record carries no current acceptance by the owner (ui.review.owner written by
//                            draw-review.mjs apply from an answer the owner gave, never auto-recommended or a
//                            delegate): a draw never turns green on checks alone, it goes to the owner as a
//                            draw-review ask.
// Owner rulings 2026-09-27 add, per part: the DNA gate (draw-dna.mjs: DRAW_OFF_GRAMMAR_COMPONENT, DRAW_NOTICE_NOT_ALERT,
// DRAW_RATIO_NOT_METER) and the taste metrics (draw-taste.mjs: DRAW_ACCENT_BUDGET, DRAW_TOO_MANY_BANDS,
// DRAW_TOO_MANY_BADGES) once per render source, and DRAW_LOOP_MISSING (draw-loop-coverage.mjs) per record; and the decision
// evidence per part (draw-rationale.mjs DRAW_RATIONALE_MISSING: <part>.rationale.json, data-why everywhere, every value
// its draw-render record measured covered, every rule id resolvable, <part>.redline.png beside it).
import fs from 'node:fs';
import path from 'node:path';
import { decodePng } from '../png.mjs';
import { isFile } from '../../lib/fs-kind.mjs';
import { assetsOf, list, slash, workRootOf } from '../work-io.mjs';
import { sha256File } from '../../../engine/digest.mjs';
import { ownerAcceptanceOf } from '../direction-part.mjs';
import { DRAW_TOOL, SHAPE_DUPLICATE, assetStateOf } from '../ui/ui-shapes.mjs';
import { DRAW_DNA_CODES, anatomyFindings, dnaFindings, loadDna, proposalFilesFor, proposalNamesIn } from './draw-dna.mjs';
import { DRAW_TASTE_CODES, accentBudgetOf, drawLoopSettings, htmlTasteFindings } from './draw-taste.mjs';
import { assetRequestIdsFor } from '../asset-slot.mjs';
import { DRAW_LOOP_MISSING, loopCoverageFindings, loopFileOfRef } from './draw-loop-coverage.mjs';
import { DRAW_RATIONALE_MISSING, loadRationale, measuresOf, rationaleFileOf, rationaleFindings, ruleResolver } from './draw-rationale.mjs';
import { altOf } from '../../lib/source-phrases.mjs';

export { SHAPE_DUPLICATE };
export const DRAW_SCOPE_FULL_PAGE = 'DRAW_SCOPE_FULL_PAGE';
export const DRAW_ACTION_MISSING = 'DRAW_ACTION_MISSING';
export const DRAW_COPY_INTERNAL = 'DRAW_COPY_INTERNAL';
export const DRAW_BADGE_UNTONED = 'DRAW_BADGE_UNTONED';
export const DRAW_SCORE_BELOW = 'DRAW_SCORE_BELOW';
export const DRAW_NOT_OWNER_ACCEPTED = 'DRAW_NOT_OWNER_ACCEPTED';
export { DRAW_LOOP_MISSING, DRAW_RATIONALE_MISSING };
export const DRAW_QUALITY_CODES = Object.freeze([SHAPE_DUPLICATE, DRAW_SCOPE_FULL_PAGE, DRAW_ACTION_MISSING, DRAW_COPY_INTERNAL, DRAW_BADGE_UNTONED, DRAW_SCORE_BELOW, DRAW_NOT_OWNER_ACCEPTED,
  ...DRAW_DNA_CODES, ...DRAW_TASTE_CODES, DRAW_LOOP_MISSING, DRAW_RATIONALE_MISSING]);
const SCORE_SCHEMA = 'starci/ui-proof-score@1';
/** The largest share of an image's rows two renders of one XBase may differ in and still be one shape plus a status band. */
const STATUS_BAND_MAX = 0.3;
const OWNER = 'owner';
const shaOf = (file) => { try { return sha256File(file); } catch { return null; } };
const PART_ROLES = new Set(['direction-content', 'direction']);

/** The breakpoint an asset is drawn at: its field, else the `--<breakpoint>--<theme>` segment of its name. */
const breakpointOf = (a) => a.breakpoint ?? a.composite?.breakpoint ?? (/--(desktop|mobile|tablet|wide|\d+x\d+)(?:--|\.)/.exec(path.basename(a.path))?.[1] ?? null);
const themeOf = (a) => a.theme ?? a.composite?.theme ?? (/--(light|dark)(?:\.|--)/.exec(path.basename(a.path))?.[1] ?? 'light');
const isComposite = (a) => Boolean(a.composite) || a.generation?.mode === 'composite';

/**
 * The render source of a part: the `.html` beside it (`X.content.png` -> `X.content.html`, `B#s--bp--th.png` -> `.html`),
 * else - a real-component drawing (owner ruling 2026-09-27) - the rendered DOM `draw-loop finish` installs beside the
 * part (`<part>.dom.html`, next to its `<part>.draw.tsx`). The reference draw <tmp>/draw-components passed every
 * loop metric and was still refused DRAW_SCORE_BELOW "no render source (.html)" here.
 */
export function renderSourceOf(dir, rel) {
  const stem = path.resolve(dir, rel).replace(/\.(png|jpe?g|webp)$/i, '');
  for (const ext of ['.html', '.dom.html']) if (isFile(`${stem}${ext}`)) return `${stem}${ext}`;
  return null;
}

/** A real-component part: its render source is the rendered DOM and its `<part>.draw.tsx` sits beside it. */
const isComponentSource = (src) => /\.dom\.html$/i.test(String(src)) && isFile(String(src).replace(/\.dom\.html$/i, '.draw.tsx'));
/** The part stem of a render source (`<part>.html` or `<part>.dom.html` -> `<part>`). */
const partStemOf = (src) => String(src).replace(/(?:\.dom)?\.html$/i, '');

/** The html with each `<...>` tag replaced by a line break; a `<` with no later `>` stays. */
function tagsToLineBreaks(html) {
  let out = '';
  let at = 0;
  let open = html.indexOf('<');
  while (open >= 0) {
    const close = html.indexOf('>', open + 1);
    if (close < 0) break;
    const empty = close === open + 1;
    if (!empty) {
      out += `${html.slice(at, open)}\n`;
      at = close + 1;
    }
    open = html.indexOf('<', empty ? open + 1 : at);
  }
  return out + html.slice(at);
}
/** The visible text of an html render source: tags, scripts, styles and comments removed, entities decoded. */
export function visibleTextOf(html) {
  return tagsToLineBreaks(String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|template|svg)\b[\s\S]*?<\/\1>/gi, ' '))
    .replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replace(/&#39;|&apos;/g, "'").replaceAll('&quot;', '"')
    .split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Internal-copy patterns: each {id, rx, why}. Owner ruling 2026-09-27 names the `source:` label (and its Vietnamese
 * form, lexicon drawCopy.sourceLabel), installation ids, kebab ids. */
const INTERNAL_COPY = Object.freeze([
  { id: 'source-label', rx: new RegExp(String.raw`(^|\s)(${altOf('drawCopy.sourceLabel')}|source)\s*:`, 'giu'), why: 'a source label is provenance jargon, not product copy' },
  { id: 'internal-vocabulary', rx: new RegExp(`${altOf('drawCopy.internalVocabulary')}|current source|core system`, 'giu'), why: 'internal system vocabulary' },
  { id: 'record-id', rx: /\b(?:installation|instance|inst|ws|wf|op|job|ctx|req|evt)-[a-z0-9]+(?:-[a-z0-9]+)*\b/gi, why: 'a raw record id' },
  { id: 'kebab-id', rx: /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g, why: 'a kebab-case identifier', test: (m) => /\d/.test(m) || m.split('-').length >= 3 },
  { id: 'uuid-hash', rx: /\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{12,})\b/gi, why: 'a uuid or hash' },
  { id: 'snake-id', rx: /\b[a-z]+(?:_[a-z0-9]+)+\b/g, why: 'a snake_case identifier' },
]);

export function internalCopyOf(lines) {
  const out = [];
  for (const line of lines) {
    for (const p of INTERNAL_COPY) {
      for (const m of line.matchAll(p.rx)) {
        if (p.test && !p.test(m[0])) continue;
        out.push({ id: p.id, text: line.slice(0, 120), match: m[0].trim(), why: p.why });
      }
    }
  }
  return out;
}

const CONTROL_RX = new RegExp([
  String.raw`<(button)\b`,
  String.raw`<a\b[^>]*\bhref=`,
  String.raw`<select\b`,
  String.raw`<input\b[^>]*\btype=["']?(submit|button|checkbox|radio)`,
  String.raw`\brole=["'](button|link|tab|menuitem|switch|checkbox|radio)["']`
].join('|'), 'gi');
/** How many controls a render source draws. */
export const controlCountOf = (html) => [...String(html).matchAll(CONTROL_RX)].length;

const COMMAND_WORDS = ['activates?', 'selects?', 'clicks?', 'press(?:es)?', 'opens?', 'chooses?', 'submits?', 'taps?', 'confirms?', 'cancels?', 'retries', 'installs?', 'uninstalls?', 'configures?', 'toggles?', 'enters?', 'types?'];
const COMMAND_RX = new RegExp(String.raw`\b(${COMMAND_WORDS.join('|')})\b`, 'i');
const ACTOR_RX = new RegExp(String.raw`^\s*(the\s+)?(owner|user|member|admin|administrator|actor|viewer|operator|person|customer|visitor|${altOf('drawCopy.actor')})\b`, 'i');
/** The commands a person leaves `state` by: ui.flow transitions from it whose trigger is an actor's command. */
export function commandsFrom(record, state) {
  return list(record?.ui?.flow?.transitions).filter((t) => {
    const from = Array.isArray(t?.from) ? t.from.map(String) : [String(t?.from ?? '')];
    const trigger = String(t?.trigger ?? '');
    return from.includes(state) && ACTOR_RX.test(trigger) && COMMAND_RX.test(trigger);
  }).map((t) => ({ id: t.id ?? null, trigger: t.trigger }));
}

// A badge class is the whole token: `tag-group`, `tag-group__list` or `starci-core-badge-dot` (a real grammar render's
// TagGroup root and Badge dot) are not badges; a vendor variant class is BEM (`chip--success`, `tag--default`).
const BADGE_OPEN_PATTERN = String.raw`<([a-z][a-z0-9-]*)\b([^>]*\b(?:class|data-slot|data-component)=["'][^"']*\b(?:badge|chip|status-pill|pill|tag)(?![\w-])[^"']*["'][^>]*)>`;
const BADGE_RX = new RegExp(String.raw`${BADGE_OPEN_PATTERN}([\s\S]*?)<\/\1>`, 'gi');
const TONES = ['success', 'warning', 'danger', 'error', 'info', 'accent', 'primary', 'secondary', 'neutral', 'default', 'muted'];
const TONE_RX = new RegExp(String.raw`\b(?:data-tone|tone|color|variant)=["'](${TONES.join('|')})["']|\b(?:text|bg|border|badge|chip|tag|tone)--?(${TONES.join('|')})\b|var\(--[\w-]*(${TONES.join('|')})[\w-]*\)`, 'i');
const SUCCESS_WORDS = new RegExp(String.raw`\b(installed|active|ready|confirmed|enabled|connected|healthy|succeeded|success)\b|${altOf('drawCopy.success')}`, 'i');
/** Badges a render source draws: [{text, tone|null}]. */
export function badgesOf(html) {
  const out = [];
  for (const m of String(html).matchAll(BADGE_RX)) {
    const attrs = m[2], inner = m[3];
    const tone = TONE_RX.exec(attrs) ?? TONE_RX.exec(inner);
    out.push({ text: visibleTextOf(inner).join(' ').slice(0, 60), tone: tone ? (tone[1] ?? tone[2] ?? tone[3]).toLowerCase() : null });
  }
  return out;
}

/** One 32-bit FNV-1a hash per pixel row of a decoded RGBA image. */
function rowHashes(img) {
  const rowBytes = img.width * 4, out = new Uint32Array(img.height);
  for (let y = 0; y < img.height; y += 1) {
    let h = 0x811c9dc5;
    for (let i = y * rowBytes, end = i + rowBytes; i < end; i += 1) { h ^= img.data[i]; h = Math.imul(h, 0x01000193); }
    out[y] = h >>> 0;
  }
  return out;
}

/** The index of the first row of `ha` and `hb` (the first `n` rows) that differ, or `n`. */
function firstDifferingRow(ha, hb, n) {
  let top = 0;
  while (top < n && ha[top] === hb[top]) top += 1;
  return top;
}

/** The rows of the differing band when `x` and `y` shifted by `d` agree over at least a fifth of the image, else null. */
function shiftedBandRows(x, y, d, top, end, H) {
  let k = end - 1;
  while (k >= top && x[k] === y[k + d]) k -= 1;
  const matched = end - 1 - k;
  return matched < H / 5 ? null : (k - top + 1) + d;
}

/** The smallest differing band over both shift directions: {rows, shift} or null (rows above `top` agree). */
function bestShiftedMatch(ha, hb, top, H, maxShift) {
  let best = null;
  for (const [x, y, sign] of [[ha, hb, 1], [hb, ha, -1]]) {
    for (let d = 0; d <= maxShift; d += 1) {
      const end = Math.min(x.length, y.length - d);
      if (end - top < H / 5) break;
      const rows = shiftedBandRows(x, y, d, top, end, H);
      if (rows !== null && (!best || rows < best.rows)) best = { rows, shift: sign * d };
    }
  }
  return best;
}

/**
 * Whether two decoded images of one width differ only in one horizontal band: the rows above the first difference
 * agree, and below the band the rest agrees at some vertical shift (a banner that pushes the list down; with a fixed
 * viewport the pushed tail is cut at the bottom) over at least a fifth of the image, the band being at most
 * STATUS_BAND_MAX of the taller image. {band, share, shift} or null.
 */
export function statusBandOf(a, b) {
  if (!a || !b || a.width !== b.width) return null;
  const ha = rowHashes(a), hb = rowHashes(b);
  const H = Math.max(a.height, b.height), n = Math.min(a.height, b.height);
  const top = firstDifferingRow(ha, hb, n);
  if (top === a.height && a.height === b.height) return { band: [top, top], share: 0, shift: 0 };
  const best = bestShiftedMatch(ha, hb, top, H, Math.floor(H * STATUS_BAND_MAX));
  if (!best) return null;
  const share = best.rows / H;
  return share <= STATUS_BAND_MAX ? { band: [top, top + best.rows], share, shift: best.shift } : null;
}

const decodeOrNull = (file) => { try { const img = decodePng(fs.readFileSync(file)); return img?.data ? img : null; } catch { return null; } };

const readJsonOrNull = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const pushFindings = (out, rel, findings) => { for (const f of findings) out.push({ code: f.code, path: rel, detail: f.detail }); };

/** Scope: a full-page composite is never the drawing. */
function fullPageFindings(live, record, baseOf, at, out) {
  const layoutRecord = [record?.surface, ...Object.values(record?.surface && typeof record.surface === 'object' ? record.surface : {})].includes('layout');
  if (layoutRecord) return;
  for (const a of live.filter(isComposite)) out.push({ code: DRAW_SCOPE_FULL_PAGE, path: at(a.path), detail: `${a.path} is a full-page composite bound as a drawing: interface.draw draws only the XBase content (${baseOf.get(assetStateOf(record, a)) || '<XBase>'}#${assetStateOf(record, a) ?? '<state>'}--<breakpoint>--<theme>.png); the layout chrome is the layout's` });
}

/** The derivable parts grouped by XBase, breakpoint and theme: Map(key -> [{a, state}]). */
function shapeGroupsOf(parts, record, baseOf, nonDerivable) {
  const groups = new Map();
  for (const a of parts) {
    const state = assetStateOf(record, a);
    if (!state || nonDerivable.has(state)) continue;
    const key = `${baseOf.get(state) || '?'}|${breakpointOf(a)}|${themeOf(a)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ a, state });
  }
  return groups;
}

/** Duplicate shapes: same XBase, breakpoint and theme, one status band apart. */
function duplicateShapeFindings(parts, { record, recordDir, baseOf, nonDerivable, at }, out) {
  const groups = shapeGroupsOf(parts, record, baseOf, nonDerivable);
  for (const [key, members] of groups) {
    const [base, bp, theme] = key.split('|');
    const seen = new Set();
    const imgs = members.map((m) => ({ ...m, img: decodeOrNull(path.join(recordDir, m.a.path)) })).filter((m) => m.img);
    for (let i = 0; i < imgs.length; i += 1) for (let j = i + 1; j < imgs.length; j += 1) {
      if (imgs[i].state === imgs[j].state || seen.has(imgs[j].state)) continue;
      const band = statusBandOf(imgs[i].img, imgs[j].img);
      if (!band) continue;
      seen.add(imgs[j].state);
      out.push({ code: SHAPE_DUPLICATE, path: at(imgs[j].a.path), detail: `${base}#${imgs[j].state} and ${base}#${imgs[i].state} at ${bp}/${theme} are one layout: they differ only in rows ${band.band[0]}-${band.band[1]} (${Math.round(band.share * 100)}% of the image, a status band) - that is a data status the slot renders through SlotView (ui.dataStatus), not a second shape` });
    }
  }
}

/** Every FR command of a state is a control of its render (once per state and breakpoint). */
function commandControlFindings(a, rel, state, html, judgedStates, record, out) {
  if (!state || judgedStates.has(`${state}|${breakpointOf(a)}`)) return;
  judgedStates.add(`${state}|${breakpointOf(a)}`);
  const commands = commandsFrom(record, state);
  const controls = controlCountOf(html);
  if (commands.length && controls < commands.length) out.push({ code: DRAW_ACTION_MISSING, path: rel, detail: `${state} is left by ${commands.length} command(s) (${commands.map((c) => c.id ?? c.trigger).join(', ')}) but its render draws ${controls} control(s): every FR command of the surface is a control` });
}

/** Internal copy and untoned or mistoned badges of a render. */
function copyBadgeFindings(a, rel, html, out) {
  const leaks = internalCopyOf(visibleTextOf(html));
  if (leaks.length) {
    const examples = leaks.slice(0, 5).map((l) => `"${l.match}" (${l.why})`).join('; ');
    const more = leaks.length > 5 ? ` (+${leaks.length - 5})` : '';
    out.push({ code: DRAW_COPY_INTERNAL, path: rel, detail: `${a.path} shows internal copy: ${examples}${more}` });
  }
  for (const b of badgesOf(html)) {
    if (!b.tone) out.push({ code: DRAW_BADGE_UNTONED, path: rel, detail: `${a.path} badge "${b.text}" binds no tone token (data-tone / color= / a tone class / var(--<tone>))` });
    else if (SUCCESS_WORDS.test(b.text) && b.tone !== 'success') out.push({ code: DRAW_BADGE_UNTONED, path: rel, detail: `${a.path} badge "${b.text}" reads as success but binds tone ${b.tone}` });
  }
}

/** A real-component part is judged as the draw loop judges it: rendered-DOM ownership from its draw-render record
 * (every painting element belongs to a grammar component) and the measured anatomy - never the html DNA
 * attribute gate, which reads every grammar-rendered <div> as unmapped (127 false findings on the reference). */
function componentSourceFindings(a, rel, src, rec0, out) {
  const own = rec0?.ownership;
  if (!own) out.push({ code: 'DRAW_OFF_GRAMMAR_COMPONENT', path: rel, detail: `${a.path} has no rendered-DOM ownership in its draw-render record: redraw it through the draw loop` });
  else if (own.unownedCount) out.push({ code: 'DRAW_OFF_GRAMMAR_COMPONENT', path: rel, detail: `${path.basename(src)} rendered DOM: ${own.unownedCount} painting element(s) owned by a drawn layout element, not a grammar component - ${list(own.unowned).slice(0, 5).join('; ')}` });
  pushFindings(out, rel, anatomyFindings(rec0?.anatomy, { label: path.basename(src) }));
}

/** The DNA gate, taste metrics and rationale findings of one render source (once per source). */
function renderSourceFindings(a, rel, src, html, ctx, out) {
  const { recordDir, record, dna, settings, resolve } = ctx;
  const loopFile = loopFileOfRef(a.generation?.loop);
  const loopDir = loopFile ? path.dirname(loopFile) : null;
  const proposals = proposalNamesIn(proposalFilesFor(src, [recordDir, ...(loopDir ? [loopDir] : [])]));
  const rec0 = readJsonOrNull(path.join(recordDir, a.path).replace(/.png$/i, '.json'));
  if (isComponentSource(src)) componentSourceFindings(a, rel, src, rec0, out);
  else pushFindings(out, rel, dnaFindings(html, { dna, proposals, label: path.basename(src), assetRequests: assetRequestIdsFor(src, [recordDir]) }));
  pushFindings(out, rel, htmlTasteFindings(html, { settings, label: path.basename(src) }));
  // A component part's decision evidence is <part>.rationale.json (draw-loop finish installs it beside the part).
  const why = loadRationale(isComponentSource(src) && isFile(`${partStemOf(src)}.rationale.json`) ? `${partStemOf(src)}.rationale.json` : rationaleFileOf(src));
  const rec = readJsonOrNull(path.join(recordDir, a.path).replace(/.png$/i, '.json'));
  const redline = isFile(path.join(recordDir, a.path).replace(/.png$/i, '.redline.png'));
  pushFindings(out, rel, rationaleFindings({ html, entries: why.entries, errors: why.errors, measures: measuresOf([rec]), resolve, record, dna, label: path.basename(src), redlines: [{ part: a.path, ok: redline }] }));
}

/** The ui-proof score of a part: missing, stale (html parts) or failing. */
function scoreFindings(a, rel, src, out) {
  const component = isComponentSource(src);
  const scoreFile = `${partStemOf(src)}.score.json`;
  const score = readJsonOrNull(scoreFile);
  const htmlSha = shaOf(src);
  if (score?.schema !== SCORE_SCHEMA) {
    const instruction = component ? 'draw it through the draw loop (starci work draw-loop round, then finish installs <part>.score.json)' : `run starci work ui-proof-brief --surface <record> --repo <product> --score ${path.basename(src)} --viewport <WxH> --json > ${path.basename(scoreFile)}`;
    out.push({ code: DRAW_SCORE_BELOW, path: rel, detail: `${a.path} has no ui-proof score: ${instruction}` });
  }
  // A component part was scored on its bundled harness page, never on the DOM snapshot; its freshness is the settle
  // re-measure from <part>.draw.tsx (draw-loop-settle.mjs), so only the score's verdict binds here.
  else if (!component && score.htmlSha256 !== htmlSha) out.push({ code: DRAW_SCORE_BELOW, path: rel, detail: `${path.basename(scoreFile)} scored another version of ${path.basename(src)} (htmlSha256 ${String(score.htmlSha256 ?? 'absent').slice(0, 12)}, now ${String(htmlSha).slice(0, 12)}): score the current render` });
  else if ((score.summary?.fail ?? 1) > 0) {
    const failed = [...list(score.spacing), ...list(score.cases)].filter((c) => c?.status === 'fail').map((c) => c.id ?? `${c.rule} ${c.case}`);
    const examples = failed.slice(0, 6).join('; ');
    const more = failed.length > 6 ? ` (+${failed.length - 6})` : '';
    out.push({ code: DRAW_SCORE_BELOW, path: rel, detail: `${a.path} scores ${score.summary.pass} pass / ${score.summary.fail} fail: address the critique (${examples}${more}) and re-score` });
  }
}

/** One part: controls for the commands, copy, badges, the render source judged once, the accent budget, the score. */
function partFindings(a, ctx, out) {
  const { recordDir, record, settings, judgedStates, judgedSources, at } = ctx;
  const state = assetStateOf(record, a);
  const src = renderSourceOf(recordDir, a.path);
  const rel = at(a.path);
  if (!src) {
    out.push({ code: DRAW_SCORE_BELOW, path: rel, detail: `${a.path} has no render source (.html) beside it: nothing can score, count its controls or read its copy` });
    return;
  }
  const html = fs.readFileSync(src, 'utf8');
  commandControlFindings(a, rel, state, html, judgedStates, record, out);
  copyBadgeFindings(a, rel, html, out);
  if (!judgedSources.has(src)) {
    judgedSources.add(src);
    renderSourceFindings(a, rel, src, html, ctx, out);
  }
  const accent = accentBudgetOf(path.join(recordDir, a.path), { html, settings, label: a.path });
  if (accent.finding) out.push({ code: accent.finding.code, path: rel, detail: accent.finding.detail });
  scoreFindings(a, rel, src, out);
}

/** Owner acceptance: only the owner's accept of the current parts. */
function ownerAcceptanceFindings(record, recordDir, at, out) {
  const acceptance = ownerAcceptanceOf(record, recordDir);
  const by = acceptance?.answeredBy ?? null;
  if (!acceptance) out.push({ code: DRAW_NOT_OWNER_ACCEPTED, path: at('index.yaml'), detail: `${record?.id ?? 'the record'} carries no owner acceptance: a draw goes to the owner as one draw-review ask (starci work draw-review question --job <id>) and only the owner's accept settles it` });
  else if (!acceptance.current) out.push({ code: DRAW_NOT_OWNER_ACCEPTED, path: at('index.yaml'), detail: `the owner's acceptance no longer holds (${acceptance.reasons.join('; ')}): review it again` });
  else if (by !== OWNER) out.push({ code: DRAW_NOT_OWNER_ACCEPTED, path: at('index.yaml'), detail: `the acceptance was answered by ${by ?? 'nobody named'}, not the owner: a drawing never turns green on checks or an automatic accept` });
}

/** The quality findings of one ui record: [{code, path, detail}]. `recordDir` absolute, `repo` for shown paths. */
export function drawQualityFindings(recordDir, record, repo) {
  const out = [];
  const at = (rel) => slash(path.join(path.relative(repo, recordDir), rel));
  const shapes = list(record?.ui?.shapes);
  const baseOf = new Map(shapes.map((s) => [String(s?.state), String(s?.base ?? '')]));
  const nonDerivable = new Set(shapes.filter((s) => s?.nonDerivable).map((s) => String(s.state)));
  const live = assetsOf(record).filter((a) => !a.retired && a.selected !== false && PART_ROLES.has(a.role) && a.generation?.tool === DRAW_TOOL);
  fullPageFindings(live, record, baseOf, at, out);
  const parts = live.filter((a) => !isComposite(a));
  duplicateShapeFindings(parts, { record, recordDir, baseOf, nonDerivable, at }, out);

  // Per part: the DNA gate and the taste metrics (draw-dna.mjs, draw-taste.mjs; owner rulings 2026-09-27) once per
  // render source, the accent budget per part image.
  const ctx = {
    recordDir, record, at, judgedStates: new Set(), judgedSources: new Set(),
    dna: parts.length ? loadDna() : null,
    settings: parts.length ? drawLoopSettings() : null,
    resolve: parts.length ? ruleResolver({ workRoot: workRootOf(recordDir), record, repoRoot: repo }) : null
  };
  for (const a of parts) partFindings(a, ctx, out);

  // The loop: every live part came out of draw-loop.mjs, bytes unchanged since its finish installed them.
  if (parts.length) out.push(...loopCoverageFindings(recordDir, record, repo));
  if (parts.length || live.length) ownerAcceptanceFindings(record, recordDir, at, out);
  return out;
}
