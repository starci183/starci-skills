// peer-integrations.mjs - HFS_PEER_INTEGRATION_MISSING (R111): an app declares the runtime peer a driver integration needs.
// The catalog knowledge/hfs/peer-integrations.yaml says "if the app depends on every package of `when` (at the named major,
// when one is named), it must declare `requires`". npm does not install such a peer for the integration, the type checker and
// the unit specs never load it, and the api fails only when it boots (@nestjs/apollo on @nestjs/platform-express 11, Express 5,
// needs @as-integrations/express5). The app root package.json is the one manifest of both sides: a `when` package counts in its
// dependencies or devDependencies, the peer counts only in its dependencies (a production install omits devDependencies).
import fs from 'node:fs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { found, readJson } from './read.mjs';

const PEER_INTEGRATION_MISSING = 'HFS_PEER_INTEGRATION_MISSING';
const MANIFEST = 'package.json';
const CATALOG_FILE = new URL('../../../knowledge/hfs/peer-integrations.yaml', import.meta.url);

/** The pairs of the catalog: [{ id, when: [{ package, major? }], requires, why }]. */
function peerIntegrationPairs() {
  const catalog = parseYaml(fs.readFileSync(CATALOG_FILE, 'utf8'));
  if (catalog?.schema !== 'starci/hfs-peer-integrations@1' || !Array.isArray(catalog.pairs)) throw new Error('knowledge/hfs/peer-integrations.yaml is not a starci/hfs-peer-integrations@1 catalog');
  return catalog.pairs;
}

/** The major a dependency spec allows (`11.2.5`, `^11.0.0`, `~11.1`, `>=11 <12`), or null when the spec names none (a tag, a link, `*`). */
function majorOf(spec) {
  const match = /^\s*(?:[\^~]|>=?|=)?\s*v?(\d+)(?:\.|\s|$)/.exec(String(spec));
  return match ? Number(match[1]) : null;
}

/** The findings of R111 over the app root package.json of `repoRoot`; `pairs` defaults to the catalog. */
export function peerIntegrationFindings({ repoRoot, files, pairs = peerIntegrationPairs() }) {
  if (!files.includes(MANIFEST)) return [];
  const pkg = readJson(repoRoot, MANIFEST);
  if (!pkg) return [];
  const runtime = pkg.dependencies ?? {};
  const declared = { ...pkg.devDependencies, ...runtime };
  const findings = [];
  for (const pair of pairs) {
    const applies = pair.when.every((entry) => typeof declared[entry.package] === 'string' && (entry.major === undefined || majorOf(declared[entry.package]) === entry.major));
    if (!applies || typeof runtime[pair.requires] === 'string') continue;
    const because = pair.when.map((entry) => `${entry.package} ${declared[entry.package]}`).join(' with ');
    const where = typeof declared[pair.requires] === 'string' ? ` (it is only a devDependency, which a production install omits)` : '';
    findings.push(found(PEER_INTEGRATION_MISSING, MANIFEST, `${MANIFEST} depends on ${because} but does not declare ${pair.requires} in its dependencies${where}: ${pair.why.trim()} Add ${pair.requires} to the dependencies.`, { pair: pair.id, requires: pair.requires }));
  }
  return findings;
}
