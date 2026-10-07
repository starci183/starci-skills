// slot-side-problems.mjs - declaration checks for one app side against the HFS manifest.
import { optionalSlotProblems } from './declaration-slots.mjs';

function sideAppKindProblems(manifest, side, apps) {
  const bad = [];
  for (const app of apps) if (!manifest.appKinds[side].includes(app.kind)) bad.push(`${side} app ${app.name} has kind ${app.kind}, which is not a ${side} kind (${manifest.appKinds[side].join(', ')})`);
  return bad;
}

function requiredAppKindProblems(manifest, side, declaration) {
  const bad = [];
  const connections = declaration.connections ?? [];
  for (const slot of manifest.slots) {
    if (slot.appKind === undefined || !slot.profiles.includes(side) || slot.presence !== 'required') continue;
    if (slot.requiredWhen === 'connections' && !connections.length) continue;
    if (!declaration.apps.some((app) => app.kind === slot.appKind)) bad.push(`no ${side} app of kind ${slot.appKind} is declared (${slot.id} is required${slot.requiredWhen ? ' once a connection is declared' : ''})`);
  }
  return bad;
}

/** Problems for one side declaration, preserving the manifest's checks and their order. */
export function sideProblems(manifest, side, declaration) {
  const bad = sideAppKindProblems(manifest, side, declaration.apps);
  bad.push(...optionalSlotProblems(manifest, side, declaration));
  for (const read of declaration.reads ?? []) if (!manifest.sides[side].reads.includes(read)) bad.push(`sides.${side}.reads names ${read}; ${side} may read only ${manifest.sides[side].reads.join(', ') || 'nothing of the other side'}`);
  bad.push(...requiredAppKindProblems(manifest, side, declaration));
  return bad;
}
