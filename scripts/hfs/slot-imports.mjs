// slot-imports.mjs - whether one file of a scope (the app root or one side) may import another: the tier direction matrix, the
// owner units, the layer order and the public entry of an owner. Cycles are a graph property of the architecture check, not of one edge.
import { RUNTIME_KIND } from './manifest-shape.mjs';
import { classifyIn, ownerIn, tierIn } from './slot-classify.mjs';

const isEntryFile = (name) => name === 'index.ts' || name === 'index.tsx';

function unownedPathProblem(from, to) {
  for (const side of [from, to]) {
    if (side.status === 'no-slot') return { allowed: false, reason: 'unowned', code: side.code, path: side.path, nearest: side.nearest };
  }
  return null;
}

function unavailableSlotProblem(from, to) {
  for (const side of [from, to]) {
    if (side.status !== 'owned') return { allowed: false, reason: `slot${side.status[0].toUpperCase()}${side.status.slice(1).replace(/-(.)/g, (_, c) => c.toUpperCase())}`, path: side.path, slot: side.slot };
  }
  return null;
}

function sameOwnerUnit(side, owner) {
  return owner ? `${owner.slot}:${owner.root}` : `${side.slot}:${side.root}`;
}

const layerIndex = (slot, root) => (slot.layers ? slot.layers.findIndex((layer) => root.split('/').includes(layer)) : -1);

function lowerLayerProblem({ manifest, profile, byId }, from, to, fromTier, toTier, fromOwner, toOwner) {
  if (manifest.tiers[profile][fromTier].lowerLayerOnly && fromTier === toTier) {
    const fromSlot = byId.get((fromOwner ?? from).slot);
    const a = layerIndex(fromSlot, fromOwner?.root ?? from.root);
    const b = layerIndex(byId.get((toOwner ?? to).slot), toOwner?.root ?? to.root);
    if (a >= 0 && b >= 0 && b <= a) return { allowed: false, reason: 'layerOrder', fromLayer: fromSlot.layers[a], toLayer: fromSlot.layers[b] };
  }
  return null;
}

function privateEntryProblem({ repo, byId }, to, toOwner) {
  if (toOwner && repo.kind !== RUNTIME_KIND) {
    const relative = to.path === toOwner.root ? '' : to.path.slice(toOwner.root.length + 1);
    const ownerSlot = byId.get(toOwner.slot);
    const entry = isEntryFile(relative) || (byId.get(to.slot).entries ?? []).includes(to.path.slice(to.root.length + 1)) || (ownerSlot.tier === 'package' && relative === 'src/index.ts') || (ownerSlot.tier === 'app' && relative === 'app.module.ts');
    if (!entry) return { allowed: false, reason: 'notPublicEntry', owner: toOwner.root, path: to.path };
  }
  return null;
}

/**
 * Whether `fromPath` may import `toPath`: {allowed, reason, ...}. Reasons: sameOwner, untiered, crossApp,
 * tierDirection, layerOrder, notPublicEntry, allowed, slotForbidden, slotNotEnabled, slotAmbiguous, and unowned (HFS_SLOT_UNDECLARED for the path no slot owns).
 * Cycles are a graph property and belong to the architecture check, not to one edge.
 */
export function importAllowedIn(scope, fromPath, toPath) {
  const from = classifyIn(scope, fromPath);
  const to = classifyIn(scope, toPath);
  const unowned = unownedPathProblem(from, to);
  if (unowned) return unowned;
  const unavailable = unavailableSlotProblem(from, to);
  if (unavailable) return unavailable;
  const fromTier = tierIn(scope, from.path);
  const toTier = tierIn(scope, to.path);
  if (fromTier === 'none' || toTier === 'none') return { allowed: true, reason: 'untiered' };
  if (from.bindings.app !== undefined && to.bindings.app !== undefined && from.bindings.app !== to.bindings.app)
    return { allowed: false, reason: 'crossApp', from: from.bindings.app, to: to.bindings.app };
  const fromOwner = ownerIn(scope, from.path);
  const toOwner = ownerIn(scope, to.path);
  if (sameOwnerUnit(from, fromOwner) === sameOwnerUnit(to, toOwner)) return { allowed: true, reason: 'sameOwner' };
  const { mayImport } = scope.manifest.tiers[scope.profile][fromTier] ?? {};
  if (!mayImport?.includes(toTier)) return { allowed: false, reason: 'tierDirection', fromTier, toTier, mayImport: mayImport ?? [] };
  const layerProblem = lowerLayerProblem(scope, from, to, fromTier, toTier, fromOwner, toOwner);
  if (layerProblem) return layerProblem;
  // A runtime owner is imported file by file (crossOwner of knowledge/hfs/runtime-slots.yaml): no public entry.
  const privateEntry = privateEntryProblem(scope, to, toOwner);
  if (privateEntry) return privateEntry;
  return { allowed: true, reason: 'allowed', fromTier, toTier };
}
