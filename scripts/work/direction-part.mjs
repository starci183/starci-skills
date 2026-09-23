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
import { parseYaml } from '../../engine/yaml.mjs';

export const PART_ROLE = 'direction-content';
export const COMPOSITE_ROLE = 'direction';
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const PART_NAME = /\.content\.(png|jpe?g|webp)$/i;

const list = (v) => (Array.isArray(v) ? v : []);
const isFile = (file) => { try { return fs.statSync(file).isFile(); } catch { return false; } };
const keyOf = (file) => (process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file));
const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };

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
      const doc = isFile(index) ? readYaml(index) : null;
      cache.set(index, doc?.schema === 'work/ui-screen@1' ? { dir, record: doc } : null);
    }
    if (cache.get(index)) return cache.get(index);
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const assetsOf = (record) => [...list(record?.assets), ...list(record?.ui?.assets)].filter((a) => a && typeof a.path === 'string');

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
