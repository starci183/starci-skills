// proves: RT_CONTROL_CHARACTER@lite
// proves: RT_CONTROL_CHARACTER@full
// proves: RT_ABSOLUTE_PATH@lite
// proves: RT_ABSOLUTE_PATH@full
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { controlCharFindings } from '../../scripts/hfs/runtime-rules/control-chars.mjs';
import { absolutePathFindings } from '../../scripts/hfs/runtime-rules/absolute-path.mjs';

const byteContext = (sources) => ({
  files: Object.keys(sources),
  params: { generated: [{ root: 'packages/hfs/runtime' }] },
  readBytes: (file) => sources[file],
});

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-runtime-paths-'));
const temporaryFile = path.join(temporaryRoot, 'state.json');
const temporaryName = path.basename(temporaryRoot);
// The synthetic path forms retain the real temp fixture's unique directory name.
// On Windows, the drive case is the real temporary path; POSIX also exercises drive syntax.
const drivePath = path.win32.isAbsolute(temporaryFile) && path.win32.parse(temporaryFile).root.length > 1
  ? temporaryFile
  : ['Q:', temporaryName, path.basename(temporaryFile)].join('/');
const profilePath = ['', 'home', temporaryName, path.basename(temporaryFile)].join('/');
const appDataPath = ['AppData', 'Local', temporaryName, path.basename(temporaryFile)].join('/');

after(() => {
  assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

// Both editions judge the same tracked runtime source; no app scaffold is involved.
for (const edition of ['lite', 'full']) {
  test(`RT_CONTROL_CHARACTER ${edition}: rejects raw control bytes in tracked source`, () => {
    const found = controlCharFindings(byteContext({
      'scripts/lib/raw-control.mjs': Buffer.from([0x61, 0x0a, 0x08, 0x00, 0x7f]),
    }));
    assert.deepEqual(found.map((finding) => finding.code), ['RT_CONTROL_CHARACTER']);
    assert.equal(found[0].path, 'scripts/lib/raw-control.mjs');
    assert.equal(found[0].line, 2);
    assert.match(found[0].message, /U\+0008/);
    assert.match(found[0].message, /3 in the file/);
  });

  test(`RT_CONTROL_CHARACTER ${edition}: accepts escapes, tab, CR and LF`, () => {
    const text = String.raw`const escaped = "\0\b\u001b";` + '\r\n\t// clean\n';
    assert.deepEqual(controlCharFindings(byteContext({
      'scripts/lib/escaped-control.mjs': Buffer.from(text),
    })), []);
  });

  test(`RT_CONTROL_CHARACTER ${edition}: accepts generated copies and binary files outside its scope`, () => {
    assert.deepEqual(controlCharFindings(byteContext({
      'packages/hfs/runtime/scripts/generated.mjs': Buffer.from([0x00]),
      'assets/control.png': Buffer.from([0x08]),
    })), []);
  });

  test(`RT_ABSOLUTE_PATH ${edition}: rejects a drive path in a source literal`, () => {
    const source = '\nexport const root = ' + JSON.stringify(drivePath) + ';\n';
    const found = absolutePathFindings('scripts/lib/host-path.mjs', source);
    assert.deepEqual(found.map((finding) => finding.code), ['RT_ABSOLUTE_PATH']);
    assert.equal(found[0].line, 2);
  });

  test(`RT_ABSOLUTE_PATH ${edition}: rejects paths in templates and comments`, () => {
    const template = 'export const root = `' + JSON.stringify(drivePath).slice(1, -1) + '`;\n';
    assert.deepEqual(absolutePathFindings('scripts/lib/template-path.ts', template)
      .map((finding) => finding.code), ['RT_ABSOLUTE_PATH']);
    const comment = '// runtime root: ' + drivePath + '\nexport const value = 1;\n';
    assert.deepEqual(absolutePathFindings('scripts/lib/comment-path.mjs', comment)
      .map((finding) => finding.code), ['RT_ABSOLUTE_PATH']);
  });

  test(`RT_ABSOLUTE_PATH ${edition}: rejects user profiles and expanded AppData in prose`, () => {
    assert.deepEqual(absolutePathFindings('docs/profile-path.md', profilePath)
      .map((finding) => finding.code), ['RT_ABSOLUTE_PATH']);
    assert.deepEqual(absolutePathFindings('docs/app-data-path.md', appDataPath)
      .map((finding) => finding.code), ['RT_ABSOLUTE_PATH']);
  });

  test(`RT_ABSOLUTE_PATH ${edition}: accepts portable runtime and temporary paths`, () => {
    const source = [
      "import os from 'node:os';",
      "import path from 'node:path';",
      "export const state = path.join(os.tmpdir(), 'runtime-proof', 'state.json');",
      "export const relative = 'scripts/lib/state.mjs';",
    ].join('\n');
    assert.deepEqual(absolutePathFindings('scripts/lib/portable-path.mjs', source), []);
  });

  test(`RT_ABSOLUTE_PATH ${edition}: accepts URLs, generic drive regexes and unexpanded names`, () => {
    const source = [
      "export const url = 'https://example.com/state';",
      String.raw`export const isDrive = (value) => /^[A-Za-z]:[\\/]/.test(value);`,
    ].join('\n');
    assert.deepEqual(absolutePathFindings('scripts/lib/path-pattern.mjs', source), []);
    assert.deepEqual(absolutePathFindings('docs/portable-path.md',
      'Use %LOCALAPPDATA% or a path relative to the runtime root.\n'), []);
  });
}
