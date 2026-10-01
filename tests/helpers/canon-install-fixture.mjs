// _canon-install-fixture.mjs — installs this runtime's PUBLISHED canons into a fixture app the way the registry does: every
// file `npm pack` lists for packages/eslint/<side>, copied under <app>/node_modules/<package>. The gate judges that install
// against modules/models/code-patterns.yaml, so a fixture app without it is a gate that could not run (exit 2).
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { packedFiles } from '../../scripts/gates/canon-digest.mjs';
import { loadPins, PROFILES_FILE } from '../../scripts/checks/check-canon-pins.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
let published;

/** [{package, side, source, files}] of every profile's canon, its pack list read once per process. */
export function publishedCanons() {
  if (published) return published;
  const pins = loadPins(ROOT).pins;
  const profiles = parseYaml(fs.readFileSync(path.join(ROOT, PROFILES_FILE), 'utf8')).profiles;
  published = Object.values(profiles).map(({ canon }) => {
    const pin = pins[canon.package], source = path.dirname(path.join(ROOT, pin.source));
    return { package: canon.package, side: pin.side, source, files: packedFiles(source) };
  });
  return published;
}

/** Copy every published canon into `app`/node_modules; returns {package: installed directory}. */
export function installCanons(app) {
  const out = {};
  for (const canon of publishedCanons()) {
    const target = path.join(app, 'node_modules', ...canon.package.split('/'));
    for (const file of canon.files) {
      fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
      fs.copyFileSync(path.join(canon.source, file), path.join(target, file));
    }
    out[canon.package] = target;
  }
  return out;
}
