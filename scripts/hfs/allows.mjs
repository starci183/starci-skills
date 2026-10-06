import path from 'node:path';
import { braceVariants, globExpression } from '../lib/glob.mjs';

/**
 * What a slot's `requires`, `allows` and `forbids` entries (knowledge/hfs/slots.yaml) say about a file, read through the
 * resolver of scripts/hfs/slots.mjs. The machine checks that judge "this folder holds only what its slot allows"
 * (feature-shape, fe-slot-allows) and the front-end lint rules (through `hfs.allows(file)` of scripts/hfs/view.mjs) read it here so no check keeps a path list.
 *
 * An entry is a name relative to the slot instance root: `<var>` is the instance's bound variable when the slot binds it
 * (`<feature>`, `<capability>`) and one path segment of any text otherwise (`<action>`), `*` and `?` stay inside a segment,
 * `{a,b}` alternates, a trailing `/` names a directory and everything below it.
 */
const VAR = /<([A-Za-z][A-Za-z0-9-]*)>/g;

function matchersOf(entries, bindings) {
  return (entries ?? []).flatMap(entry => {
    const directory = entry.endsWith('/');
    const body = directory ? entry.slice(0, -1) : entry;
    const filled = body.replace(VAR, (whole, name) => bindings[name] ?? '*');
    return braceVariants(filled).map(variant => ({ entry, directory, expression: globExpression(directory ? `${variant}/**` : variant) }));
  });
}

/** The path of `file` below the instance root of the slot that owns it. */
export function relativeToRoot(file, root) {
  return root && file.startsWith(`${root}/`) ? file.slice(root.length + 1) : path.posix.basename(file);
}

/**
 * Whether the slot that owns `file` names it in `requires` or `allows` (and does not forbid it); null when no enabled slot
 * owns it. Unlike allowsFile it judges a slot that lists only `requires` too, so a folder closed by its slot (an app's
 * src/) is read from the slot and never from a check's own list.
 */
export function slotAdmitsFile(resolver, file) {
  const classified = resolver.classifyPath(file);
  if (classified.status === 'no-slot' || classified.status === 'ambiguous' || !classified.slot) return null;
  const slot = resolver.slot(classified.slot);
  const relative = relativeToRoot(classified.path, classified.root);
  const hit = matchersOf([...(slot.requires ?? []), ...(slot.allows ?? [])], classified.bindings).some(matcher => matcher.expression.test(relative));
  const forbidden = matchersOf(slot.forbids, classified.bindings).some(matcher => matcher.expression.test(relative) || matcher.expression.test(`${relative}/`));
  return hit && !forbidden;
}

/**
 * {slot, root, relative, allowed, entry?, forbiddenBy?} for a repository-relative file, or null when no enabled slot owns
 * it or the slot names no `allows`. `allowed` is true when the relative path matches a `requires` or `allows` entry.
 */
export function allowsFile(resolver, file) {
  const classified = resolver.classifyPath(file);
  if (classified.status === 'no-slot' || classified.status === 'ambiguous' || !classified.slot) return null;
  const slot = resolver.slot(classified.slot);
  if (!slot?.allows?.length) return null;
  const relative = relativeToRoot(classified.path, classified.root);
  const hit = matchersOf([...(slot.requires ?? []), ...slot.allows], classified.bindings).find(matcher => matcher.expression.test(relative));
  const forbidden = matchersOf(slot.forbids, classified.bindings).find(matcher => matcher.expression.test(relative) || matcher.expression.test(`${relative}/`));
  return { slot: slot.id, root: classified.root, relative, allowed: Boolean(hit) && !forbidden, entry: hit?.entry, forbiddenBy: forbidden?.entry, allows: slot.allows };
}
