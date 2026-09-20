// tinkle-23 step 5: every modules/**/*.yaml parses via core/yaml.mjs::parseYaml
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const walk = d => readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(root + 'modules').filter(f => /\.ya?ml$/i.test(f));
const bad = [];
for (const f of files) { try { parseYaml(readFileSync(f, 'utf8')); } catch (e) { bad.push(`${path.relative(root, f)}: ${e.message}`); } }
console.log(`${files.length} yaml file(s) under modules/: ${bad.length ? bad.length + ' FAILED' : 'all parse'}`);
for (const b of bad) console.log('  FAIL', b);
process.exitCode = bad.length ? 1 : 0;
