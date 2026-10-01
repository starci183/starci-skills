import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';

// Parity guard for the vendored engine/yaml.mjs bundle. The runtime ships zero
// npm dependencies, so engine/yaml.mjs is a frozen esbuild bundle of yaml
// 2.9.0 (see CONTRIBUTING.md, docs/installation.md). The `yaml` devDependency
// exists only to rebuild that bundle — this spec proves the vendored parseYaml
// and stringifyYaml still behave exactly like the published package (same
// options) for every tracked *.yaml/*.yml file, so a future rebuild can be
// verified before it lands.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Files where the vendored parser and the `yaml` package are known to differ.
// Keep empty: a diff means the vendored bundle drifted from yaml@2.9.0 and the
// bundle must be rebuilt, not the list grown.
const KNOWN_DIFFS = new Set([]);

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0')
  .filter((f) => /\.ya?ml$/i.test(f) && !f.includes('node_modules/'));

test('engine/yaml.mjs vendored bundle is at parity with the yaml devDependency for every tracked yaml file', async (t) => {
  const YAML = await import('yaml').catch(() => null);
  if (!YAML) return t.skip('yaml devDependency not installed — parity cannot be checked without it');

  const refParse = (source) => {
    if (typeof source !== 'string' || Buffer.byteLength(source) > 4 * 1024 * 1024) throw Error('Invalid YAML size');
    const doc = YAML.parseDocument(source, { version: '1.2', schema: 'core', uniqueKeys: true, strict: true });
    if (doc.errors.length || doc.warnings.length) throw Error('Invalid or unsupported YAML');
    return doc.toJS({ maxAliasCount: 0 });
  };
  const refStringify = (value) => YAML.stringify(value, { lineWidth: 100, aliasDuplicateObjects: false });

  const mismatches = [];
  let parsed = 0;
  let bothRejected = 0;
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    let vendored;
    let vendoredError = null;
    let reference;
    let referenceError = null;
    try { vendored = parseYaml(source); } catch (e) { vendoredError = e; }
    try { reference = refParse(source); } catch (e) { referenceError = e; }
    if (vendoredError || referenceError) {
      if (vendoredError && referenceError) { bothRejected++; continue; }
      mismatches.push(`${file}: vendored ${vendoredError ? 'rejected' : 'parsed'} but yaml ${referenceError ? 'rejected' : 'parsed'}`);
      continue;
    }
    parsed++;
    try { assert.deepStrictEqual(vendored, reference); } catch (e) {
      mismatches.push(`${file}: parsed values differ (${String(e.message).split('\n')[0]})`);
      continue;
    }
    // stringifyYaml output is written to contract files, so it must be
    // byte-identical to what the yaml package would emit for the same value.
    const vendoredOut = stringifyYaml(vendored);
    const referenceOut = refStringify(reference);
    if (vendoredOut !== referenceOut) mismatches.push(`${file}: stringify output differs`);
  }

  const unexpected = mismatches.filter((m) => !KNOWN_DIFFS.has(m.split(':')[0]));
  assert.deepEqual(unexpected, [],
    `${parsed} parsed, ${bothRejected} rejected by both; vendored/yaml mismatches: ${unexpected.length}\n${unexpected.slice(0, 20).join('\n')}`);
});
