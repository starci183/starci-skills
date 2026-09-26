// direction-part.mjs — what the OWNER is shown for a drawing is the drawn PART, never the composite.
//
// Owner ruling 2026-09-24: an owner review shows only the part a draw produced -
//   page, loading, error, not-found  the page slot content  <state>--page--<bp>--<theme>.content.png
//   modal, drawer                   the overlay panel alone (never dimmed over its host)
//   layout (planned)                the layout's own drawing (a repository layout: its own capture)
// scripts/work/compose-direction.mjs still places every part into the real layout chain; that composite
// (<state>--<presentation>--<bp>--<theme>.png, role direction, with a `composite` block) is evidence and the
// reference interface.implement and interface.audit build and compare against - it is not what the owner
// reviews. Every owner-facing image picker (scripts/kernel/serve-ask.mjs for asks and the handover package,
// scripts/connectors/telegram-media.mjs for drawing notices) runs its choice through partOf()/ownerImages().
//
// How a composite finds its part, most specific first (a record drawn before the compositor has no part and
// keeps what it has):
//   1. the image is itself a part: role direction-content in its ui record, or a *.content.<ext> name;
//   2. its ui record's asset for that path carries composite.content.path - the part it was placed from;
//   3. the sibling <name>.content.<ext> exists on disk (the naming interface.draw writes).
import fs from 'node:fs';
import path from 'node:path';
import { assetsOf, list, readYamlOrNull, sha256File, slash } from './work-io.mjs';

export const PART_ROLE = 'direction-content';
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const PART_NAME = /\.content\.(png|jpe?g|webp)$/i;

const isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } };
const keyOf = (file) => (process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file));

/** Whether a file name follows the part naming (<name>.content.<ext>). */
export const isPartName = (file) => PART_NAME.test(String(file));

/** The part file name a composite <name>.<ext> is drawn from by convention: <name>.content.<ext>. */
export const partNameOf = (file) => (isPartName(file) || !IMAGE_EXT.test(String(file)) ? null : String(file).replace(IMAGE_EXT, '.content.$1'));

/** The work/ui-screen@1 record owning `file`: the nearest ancestor index.yaml of that schema, or null. */
export function uiRecordOf(file, cache = new Map()) {
  let dir = path.dirname(path.resolve(file));
  for (let i = 0; i < 7; i += 1) {
    const index = path.join(dir, 'index.yaml');
    if (!cache.has(index)) {
      const doc = isFile(index) ? readYamlOrNull(index) : null;
      cache.set(index, doc?.schema === 'work/ui-screen@1' ? { dir, record: doc } : null);
    }
    if (cache.get(index)) return cache.get(index);
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

/**
 * The owner-facing part for one image. Returns {file, composite, kind}: kind 'part' (the image is a part),
 * 'composite' (a composite whose part was found - `file` is the part, `composite` the original) or 'plain'
 * (anything else - a capture, a legacy direction, a screenshot - shown as it is).
 */
export function partOf(file, { cache = new Map() } = {}) {
  const abs = path.resolve(file);
  if (isPartName(abs)) return { file: abs, composite: null, kind: 'part' };
  const ui = uiRecordOf(abs, cache);
  if (ui) {
    const asset = assetsOf(ui.record).find((a) => keyOf(path.resolve(ui.dir, a.path)) === keyOf(abs));
    if (asset?.role === PART_ROLE) return { file: abs, composite: null, kind: 'part' };
    const content = asset?.composite?.content?.path;
    if (typeof content === 'string' && isFile(path.resolve(ui.dir, content))) return { file: path.resolve(ui.dir, content), composite: abs, kind: 'composite' };
  }
  const sibling = partNameOf(abs);
  if (sibling && isFile(sibling)) return { file: sibling, composite: abs, kind: 'composite' };
  return { file: abs, composite: null, kind: 'plain' };
}

/**
 * Map a list of images to what the owner sees: each composite replaced by its part, duplicates (a composite
 * beside its own part, a routed overlay's two presentations of one panel) collapsed, order kept.
 * `items` are file paths or objects with an `abs` (or `file`) field; objects keep their other fields, gain
 * `composite` (the replaced file) and `aliases` (every original path that collapsed into this one).
 */
export function ownerImages(items, { cache = new Map() } = {}) {
  const out = [];
  const byKey = new Map();
  for (const item of list(items)) {
    const original = typeof item === 'string' ? item : item?.abs ?? item?.file;
    if (typeof original !== 'string' || !original) continue;
    const part = partOf(original, { cache });
    const key = keyOf(part.file);
    if (byKey.has(key)) { const seen = byKey.get(key); if (!seen.aliases.includes(original)) seen.aliases.push(original); continue; }
    const entry = typeof item === 'string'
      ? { file: part.file, composite: part.composite, kind: part.kind, aliases: [original] }
      : { ...item, ...(item.abs !== undefined ? { abs: part.file } : { file: part.file }), composite: part.composite, kind: part.kind, aliases: [original] };
    byKey.set(key, entry);
    out.push(entry);
  }
  return out;
}

const pathOfRef = (ref) => (typeof ref === 'string' ? ref : ref && typeof ref === 'object' && typeof ref.path === 'string' ? ref.path : null);

/**
 * The image paths one draws.yaml entry names, the owner-facing one first: `part` (the drawn part), then
 * `content` (older name for the same), then `image` (a part, or on records drawn before this rule the
 * composite - partOf() still finds its part). Each value is a path string or {path, sha256}.
 */
export const drawImageRefs = (draw) => [draw?.part, draw?.content, draw?.image].map(pathOfRef).filter(Boolean);

// ---------------------------------------------------------------------------------------------------------
// Owner acceptance of a drawing (mia inc-a4b5b1abdd90): the owner reviews the drawn parts - desktop and mobile,
// light - in one draw-review ask (scripts/work/draw-review.mjs question), and the accept answer is written onto the
// ui record as ui.review.owner {decision: accepted, dispatchId, receipt, receiptSha256, answeredBy, at, parts}
// by draw-review.mjs apply - answeredBy owner, or auto-recommended for a drawing the owner did not ask to review
// (owner ruling 2026-09-26; both are accepted drawings). An acceptance speaks only for the parts it names: a part redrawn since (a new digest,
// or a required part the owner never saw) means the drawing is no longer the one the owner accepted.
// ---------------------------------------------------------------------------------------------------------

// Owner ruling 2026-09-24: every drawing set covers desktop AND mobile in the LIGHT theme - the parts the owner
// reviews, the draws a drawn state needs and the captures a layout needs to be settled (layout-tree.mjs). Dark and
// any other breakpoint the tree declares are optional.
export const REQUIRED_BREAKPOINTS = Object.freeze(['desktop', 'mobile']);
export const REQUIRED_THEMES = Object.freeze(['light']);
const digestOrNull = (file) => { try { return sha256File(file); } catch { return null; } };

/** The drawn parts a ui record declares (role direction-content, or a *.content.<ext> image), one per path. */
export function partAssetsOf(record) {
  const out = [], seen = new Set();
  for (const a of assetsOf(record)) {
    const rel = slash(a.path);
    if (seen.has(rel) || !(a.role === PART_ROLE || (isPartName(rel) && a.role !== 'prompt'))) continue;
    seen.add(rel);
    const state = rel.split('/').pop().split('--')[0] || null;
    out.push({ path: rel, sha256: a.sha256 ?? null, breakpoint: a.breakpoint ?? null, theme: a.theme ?? null, state });
  }
  return out;
}

/** The parts the owner reviews: every drawn part at desktop and mobile in the light theme. */
export const reviewPartsOf = (record) => partAssetsOf(record).filter((p) => REQUIRED_BREAKPOINTS.includes(p.breakpoint) && REQUIRED_THEMES.includes(p.theme));

/**
 * The owner acceptance a ui record carries (ui.review.owner), or null: {decision, dispatchId, receipt, answeredBy,
 * at, parts, current, reasons}. `current` is false when an accepted part no longer hashes to what the owner saw,
 * or when the record now draws a review part the acceptance does not name. `dir` is the ui record directory.
 */
export function ownerAcceptanceOf(record, dir) {
  const owner = record?.ui?.review?.owner;
  if (!owner || typeof owner !== 'object' || owner.decision !== 'accepted') return null;
  const reasons = [];
  const accepted = list(owner.parts).filter((p) => p && typeof p.path === 'string');
  if (!accepted.length) reasons.push('the acceptance names no part');
  for (const p of accepted) {
    const file = path.resolve(dir, p.path);
    const now = digestOrNull(file);
    if (!now) reasons.push(`${p.path} is not on disk`);
    else if (p.sha256 && now !== p.sha256) reasons.push(`${p.path} was redrawn since the owner accepted it`);
  }
  const names = new Set(accepted.map((p) => slash(p.path)));
  for (const p of reviewPartsOf(record)) if (!names.has(p.path)) reasons.push(`${p.path} (${p.breakpoint}/${p.theme}) was never shown to the owner`);
  return { ...owner, parts: accepted, current: reasons.length === 0, reasons };
}

/**
 * Whether a drawing is accepted for what waits on it (a planned layout's settlement, the lockup crop): the record
 * is done, and when it carries an owner acceptance that acceptance still names its current parts.
 * {accepted, reason}.
 */
export function drawingAcceptance(record, dir) {
  if (record?.state !== 'done') return { accepted: false, reason: `${record?.state ?? 'stateless'}, not done` };
  const owner = ownerAcceptanceOf(record, dir);
  if (owner && !owner.current) return { accepted: false, reason: `done, but the owner-accepted drawing changed since (${owner.reasons.join('; ')})` };
  return { accepted: true, reason: null };
}
