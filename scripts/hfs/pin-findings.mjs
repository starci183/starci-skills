import fs from 'node:fs';
import path from 'node:path';
import { APP_SCOPE } from './slots.mjs';

const DEP_SECTIONS = ['dependencies', 'devDependencies'];
const pinnedSpec = (spec, pin) => (spec === pin.version ? null : `declared ${spec}, pinned ${pin.version}`);

function pinFileFindings(repoRoot, file, profile, pins) {
  const findings = [];
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8')); } catch { return findings; }
  for (const [name, pin] of Object.entries(pins)) {
    // The app root's one package.json carries the pins of both sides.
    if (profile !== APP_SCOPE && pin.side !== 'both' && pin.side !== profile) continue;
    for (const section of DEP_SECTIONS) {
      const spec = pkg[section]?.[name];
      if (spec === undefined) continue;
      const drift = pinnedSpec(spec, pin);
      if (drift) findings.push({ code: 'HFS_CANON_PIN_DRIFT', level: 'error', path: file, dependency: name, section, pinned: pin.version, declared: spec, message: `${name} in ${file} ${section}: ${drift}` });
    }
  }
  return findings;
}

export function pinFindings({ repoRoot, files, profile, pins, only }) {
  const findings = [];
  for (const file of files.filter((f) => (f === 'package.json' || f.endsWith('/package.json')) && (!only || only.has(f)))) {
    findings.push(...pinFileFindings(repoRoot, file, profile, pins));
  }
  return findings;
}
