// managed-scripts.mjs - reads the script names from the managed package-script template for one HFS profile and
// edition. Templates stay the source of truth; README presentation checks consume only this cached name set.
import fs from 'node:fs';
import path from 'node:path';
import { managedGroupOf } from '../edition-slots.mjs';
import { loadSlotManifest } from '../slots.mjs';

const TEMPLATE_ROOTS = [
  path.resolve(import.meta.dirname, '..', '..', '..', 'packages', 'hfs', 'templates'),
  path.resolve(import.meta.dirname, '..', '..', '..', '..', 'templates'),
];
const managedScriptCache = new Map();

/** The script names of a profile/edition template after its partials are expanded. */
export function managedScriptNames(profile, edition = 'full') {
  const key = `${profile}:${edition}`;
  if (!managedScriptCache.has(key)) {
    const slot = loadSlotManifest().slots.find((entry) => entry.id === `${profile}.package-manifest`);
    const group = slot && managedGroupOf(slot, edition);
    const templates = group && TEMPLATE_ROOTS.find((dir) => fs.existsSync(path.join(dir, profile, group, 'package.json')));
    if (!templates) throw new Error(`The managed package-scripts template of profile ${profile} cannot be found next to the runtime.`);
    const text = fs.readFileSync(path.join(templates, profile, group, 'package.json'), 'utf8')
      .replace(/^\{\{> ([\w./-]+)\}\}\r?\n/gmu, (_, partial) => fs.readFileSync(path.join(templates, partial), 'utf8'));
    // The key is bounded by quotes, never the colon, so `[^"]` cannot backtrack; the strict script-name class filters after.
    const names = [...text.matchAll(/^\s*"([^"\n]+)":\s*"/gmu)].map((match) => match[1]);
    managedScriptCache.set(key, new Set(names.filter((name) => /^[A-Za-z0-9:_.-]+$/.test(name))));
  }
  return managedScriptCache.get(key);
}
