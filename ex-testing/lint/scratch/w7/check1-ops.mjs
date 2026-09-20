// w7/tinkle-13 check 1: modules/ops/ops/*.yaml <-> ops/*/operator.yaml
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modDir = root + 'modules/ops/ops/';
const opsDir = root + 'ops/';
const modFiles = readdirSync(modDir).filter(f => f.endsWith('.yaml'));
const opDirs = readdirSync(opsDir, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name);
const rows = [];
const modIds = new Set();
for (const f of modFiles) {
  const m = parseYaml(readFileSync(modDir + f, 'utf8'));
  modIds.add(m.id);
  const opPath = opsDir + m.id + '/operator.yaml';
  if (!existsSync(opPath)) { rows.push([m.id, 'MISSING ops/' + m.id + '/operator.yaml']); continue; }
  const o = parseYaml(readFileSync(opPath, 'utf8'));
  const diffs = [];
  if (o.id !== m.id) diffs.push(`id ${o.id}!=${m.id}`);
  if (JSON.stringify(o.goal) !== JSON.stringify(m.goal)) diffs.push('goal differs');
  if (JSON.stringify(o.nodeKinds) !== JSON.stringify(m.nodeKinds)) diffs.push(`nodeKinds ${JSON.stringify(o.nodeKinds)}!=${JSON.stringify(m.nodeKinds)}`);
  if (JSON.stringify(o.completionProfile) !== JSON.stringify(m.completionProfile)) diffs.push(`completionProfile ${o.completionProfile}!=${m.completionProfile}`);
  rows.push([m.id, diffs.length ? 'DRIFT: ' + diffs.join('; ') : 'ok']);
}
for (const d of opDirs) if (!modIds.has(d)) rows.push([d, 'MISSING modules/ops/ops/' + d + '.yaml']);
console.log(rows.map(r => r.join(' | ')).join('\n'));
console.log(`\nmodules files: ${modFiles.length}, ops dirs: ${opDirs.length}`);
