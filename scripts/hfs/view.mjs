// hfs-view.mjs - the frozen view of one side of an app (be/ or fe/, the side folder as its root) that the lint factories hand
// their rules (`settings.starci.hfs`). Both @starci/eslint-canon-be and @starci/eslint-canon-fe ship a byte copy of this file in their
// runtime/ bundle (scripts/hfs/sync-runtime.mjs), so a path-scoped rule in either package asks the SAME resolver the
// architecture machine and `starci app check` use, and never tests a path with a regular expression of its own.
import path from 'node:path';
import { allowsFile } from './allows.mjs';
import { openHfs } from './slots.mjs';

const posix = (p) => String(p).replace(/\\/g, '/');
const isAbsoluteAny = (text) => path.isAbsolute(text) || /^[A-Za-z]:\//.test(text);

/**
 * The view rules read, over an opened resolver.
 *
 * @param {object} opened - The result of `openHfs` (manifest, repo and resolver methods).
 * @param {string} repoRoot - The absolute repository root.
 * @returns {object} The frozen view: profile, apps, connections, ruleParams, relative, classify, slotOf, tierOf, ownerOf, slot.
 */
export function hfsView(opened, repoRoot) {
  const rel = (file) => {
    const text = posix(file);
    if (!isAbsoluteAny(text)) return text.replace(/^\.\//, '');
    return posix(path.relative(repoRoot, file));
  };
  const slotCache = new Map();
  const classify = (file) => {
    const key = rel(file);
    if (!slotCache.has(key)) slotCache.set(key, opened.classifyPath(key));
    return slotCache.get(key);
  };
  return Object.freeze({
    repoRoot,
    profile: opened.repo.profile,
    side: opened.repo.side ?? null,
    apps: opened.repo.apps,
    connections: opened.repo.connections,
    ruleParams: opened.ruleParams(),
    /** The repository-relative, forward-slash form of a linted filename. */
    relative: rel,
    /** The classification of a file: `{ slot, tier, owner?, bindings? ... }` or a no-slot status. */
    classify,
    /** The slot id that owns a file, or null when no slot does. */
    slotOf: (file) => classify(file).slot ?? null,
    /** The tier of a file, or null. */
    tierOf: (file) => opened.tierOf(rel(file)) ?? null,
    /** The owner root of a file, or null. */
    ownerOf: (file) => opened.ownerOf(rel(file))?.root ?? null,
    /** What the slot that owns a file says about it: `{ slot, root, relative, allowed, entry?, forbiddenBy?, allows }`, or null when the slot names no `allows`. */
    allows: (file) => allowsFile(opened, rel(file)),
    /** A slot definition by id. */
    slot: (id) => opened.slot(id),
  });
}

/**
 * The view of the app folder on disk at `repoRoot`, against the manifest under `runtimeRoot`: a side folder (be/, fe/) finds the
 * app-root hfs.json one level up and gets that side's view, so every linted file below it is judged by its own side's slots.
 *
 * @param {{ runtimeRoot: string, repoRoot: string }} input - Where the manifest copy lives and the side folder (or app root).
 * @returns {object} The frozen view.
 */
export const openHfsView = ({ runtimeRoot, repoRoot }) => hfsView(openHfs({ root: runtimeRoot, repoRoot }), repoRoot);

/**
 * The view of one side of an in-memory app declaration (rule tests): no file is read except the manifest.
 *
 * @param {{ runtimeRoot: string, declaration: object, repoRoot: string, side: string }} input - Manifest root, hfs.json object, the linted side folder, its side.
 * @returns {object} The frozen view.
 */
export const declaredHfsView = ({ runtimeRoot, declaration, repoRoot, side }) => hfsView(openHfs({ root: runtimeRoot, declaration, side }), repoRoot);
