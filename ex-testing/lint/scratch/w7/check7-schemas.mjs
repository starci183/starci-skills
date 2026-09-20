// check 7: schemas/*.yaml coverage in modules/schemas/index.yaml
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const idx = parseYaml(readFileSync(root + 'modules/schemas/index.yaml', 'utf8'));
const indexed = new Set((idx.schemas ?? []).map(s => s.file));
const yamlFiles = readdirSync(root + 'schemas/').filter(f => f.endsWith('.yaml')).map(f => 'schemas/' + f);
const missing = yamlFiles.filter(f => !indexed.has(f));
const ghost = [...indexed].filter(f => !yamlFiles.includes(f));
console.log('schemas/*.yaml files:', yamlFiles.length, '| indexed:', indexed.size);
console.log('NOT in index:', missing.length ? missing : 'none');
console.log('index entries with no source file:', ghost.length ? ghost : 'none');
// also .dist artifacts without a schemas/ source (only if a .dist still exists)
import {existsSync} from 'node:fs';
if (existsSync(root + '.dist/schemas/')) {
  const dist = readdirSync(root + '.dist/schemas/');
  const srcBase = new Set(yamlFiles.map(f => f.replace(/^schemas\//,'').replace(/\.yaml$/,'')));
  console.log('.dist/schemas artifacts with no matching schemas/ source:', dist.filter(d => !srcBase.has(d.replace(/\.json$/,''))));
} else {
  console.log('.dist/schemas: absent (deleted) — nothing to reconcile');
}
