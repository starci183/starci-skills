// Operator ids a release retired (operators/retired.json): an origin bundle another session froze under
// an older tree names them, and the three readers of an imported slot resolve them to the packages that
// produce the same kinds today. Nothing else reads this file: a retired id is history, never a route.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { kindOf } from './operator-md.mjs';

export function loadRetired(root) {
  const file = path.join(root, 'operators', 'retired.json');
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')).ids ?? {}; } catch { return {}; }
}
// The packages that stand for an operator id today: the package itself when it exists, else the
// successors the retired map names, in its order.
export function packagesFor(root, packages, operatorId) {
  const own = packages.find((p) => p.manifest?.id === operatorId);
  if (own) return [own];
  return (loadRetired(root)[operatorId] ?? []).map((id) => packages.find((p) => p.manifest?.id === id)).filter(Boolean);
}
// The package whose Outputs table declares a kind, among those standing for the id; the first one when no kind is asked.
export function packageForOrigin(root, packages, operatorId, kind = null) {
  const candidates = packagesFor(root, packages, operatorId);
  if (kind === null) return candidates[0] ?? null;
  return candidates.find((p) => (p.en?.tables?.outputs?.rows ?? []).some((r) => kindOf(r.kind) === kind)) ?? null;
}
