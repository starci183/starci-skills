// slot-app-view.mjs - the resolver of a whole app: a root path is answered by the scope of the app root, a path below a side folder
// (be/, fe/) by that side's scope with the side prefixed back onto every path and root it returns. Only the declared `reads` cross sides.
// slots.mjs builds the scopes (`root` and `sides`, each a resolver of one scope) and hands them to appResolver.
import { APP_SCOPE, PROFILES } from './slot-manifest-shape.mjs';
import { cleanSlotPath } from './slot-path.mjs';

/** { side, rest } when `p` lies below a side folder, else null. */
function splitSide(input) {
  const p = cleanSlotPath(input);
  const slash = p.indexOf('/');
  const head = slash < 0 ? p : p.slice(0, slash);
  return PROFILES.includes(head) && slash > 0 ? { side: head, rest: p.slice(slash + 1) } : null;
}

const under = (side, rel) => (rel ? `${side}/${rel}` : side);

function prefixed(side, c) {
  return {
    ...c,
    path: under(side, c.path),
    side,
    ...(c.root !== undefined ? { root: under(side, c.root) } : {}),
    ...(c.nearest ? { nearest: { ...c.nearest, matchedPrefix: under(side, c.nearest.matchedPrefix), matchedDepth: c.nearest.matchedDepth + 1 } } : {}),
  };
}

function classifyApp({ root, sides }, input) {
  const at = splitSide(input);
  return at ? prefixed(at.side, sides[at.side].classifyPath(at.rest)) : root.classifyPath(input);
}

function ownerApp({ root, sides }, input) {
  const at = splitSide(input);
  if (!at) return root.ownerOf(input);
  const owner = sides[at.side].ownerOf(at.rest);
  return owner ? { ...owner, root: under(at.side, owner.root), side: at.side } : null;
}

/** Whether `toPath`, of the other side, lies below a path `fromSide` declares it reads. */
const readsPath = (repo, fromSide, toPath) => repo.sides[fromSide].reads.some((read) => `${cleanSlotPath(toPath)}/`.startsWith(read));

/** The verdict of an import from a side file to a path of the other side (or of the app root, `toSide` null): allowed only through a declared read. */
function sideCrossing(repo, fromSide, toSide, toPath) {
  return readsPath(repo, fromSide, toPath)
    ? { allowed: true, reason: 'sideRead', fromSide, toSide }
    : { allowed: false, reason: 'crossSide', fromSide, toSide, reads: repo.sides[fromSide].reads };
}

function importAllowedApp({ repo, root, sides }, fromPath, toPath) {
  const from = splitSide(fromPath);
  const to = splitSide(toPath);
  // A side file may read an app-root path (supabase/types/) only through a declared read, exactly as it reads the other side.
  if (from && (!to || from.side !== to.side)) return sideCrossing(repo, from.side, to ? to.side : null, toPath);
  if (from && to) return sides[from.side].importAllowed(from.rest, to.rest);
  return root.importAllowed(fromPath, toPath);
}

function requiredPathsApp({ root, sides }) {
  const own = root.requiredPaths();
  const paths = [...own.paths];
  const minimums = [...own.minimums];
  for (const side of PROFILES) {
    const required = sides[side].requiredPaths();
    paths.push(...required.paths.map((entry) => ({ ...entry, path: under(side, entry.path), side })));
    minimums.push(...required.minimums.map((entry) => ({ ...entry, side })));
  }
  return { paths, minimums };
}

function slotEnabledApp({ root, sides }, slot) {
  if (slot.profiles.includes(APP_SCOPE)) return root.slotEnabled(slot);
  return PROFILES.some((side) => slot.profiles.includes(side) && sides[side].slotEnabled(slot));
}

/** The resolver of the app `repo`: `root` answers its root paths and `sides[side]` the paths below that side's folder. */
export function appResolver(repo, root, sides) {
  const view = { repo, root, sides };
  const allSlots = [...new Map([...root.slots(), ...PROFILES.flatMap((side) => sides[side].slots())].map((s) => [s.id, s])).values()];
  const byId = new Map(allSlots.map((s) => [s.id, s]));
  const classifyPath = (input) => classifyApp(view, input);
  return Object.freeze({
    repo,
    sides: Object.freeze(sides),
    /** The side of a path (be, fe) or null for a root path. */
    sideOf: (input) => splitSide(input)?.side ?? null,
    slot: (id) => byId.get(id) ?? null,
    slots: () => allSlots,
    slotEnabled: (slot) => slotEnabledApp(view, slot),
    classifyPath,
    slotOf: (p) => { const c = classifyPath(p); return c.slot ? byId.get(c.slot) : null; },
    ownerOf: (input) => ownerApp(view, input),
    tierOf: (input) => { const at = splitSide(input); return at ? sides[at.side].tierOf(at.rest) : root.tierOf(input); },
    importAllowed: (fromPath, toPath) => importAllowedApp(view, fromPath, toPath),
    requiredFiles: (input) => { const at = splitSide(input); return at ? sides[at.side].requiredFiles(at.rest).map((p) => under(at.side, p)) : root.requiredFiles(input); },
    requiredPaths: () => requiredPathsApp(view),
    trackingOf: (p) => classifyPath(p).tracking ?? null,
    isTracked: (p) => classifyPath(p).tracking === 'tracked',
    // The root has no tier and no rule parameters of its own; each side has them (sides.<side>.ruleParams()).
    ruleParams: () => null,
    allowedImports: () => null,
  });
}
