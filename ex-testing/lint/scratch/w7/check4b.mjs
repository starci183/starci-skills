import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const modDir = root + 'modules/ops/ops/';
for (const f of readdirSync(modDir).filter(f => f.endsWith('.yaml'))) {
  const m = parseYaml(readFileSync(modDir + f, 'utf8'));
  const r = m.route ?? {};
  const top = [];
  for (const k of ['produces','consumes','needs']) if (m[k] !== undefined) top.push(k);
  console.log(f.padEnd(34), 'route keys:', JSON.stringify(Object.keys(r)), '| top-level:', top.join(',') || '-');
}
