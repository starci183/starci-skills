// proves: HFS_PROOF_COMMAND_FILE_MISSING@lite
// proves: HFS_PROOF_COMMAND_FILE_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHfs } from '../runtime/scripts/hfs/slots.mjs';
import { commandFiles, proofCommandFindings } from '../runtime/scripts/hfs/rules/proof-commands.mjs';

const CODE = 'HFS_PROOF_COMMAND_FILE_MISSING';
const RECORD = '.starciwork/brand/drawings/logo/index.yaml';
const TARGET = 'scripts/render-logo.mjs';

/** A temp app of `edition` that tracks one Work record whose proof commands are `commands` (kind -> command). */
function app(t, edition, commands, extra = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-command-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const declaration = { hfs: 3, kind: 'app', project: 'demo', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const requiresProof = Object.fromEntries(Object.entries(commands).map(([kind, command]) => [kind, { required: true, command }]));
  const record = { schema: 'work/ui-screen@1', id: 'ui.brand.logo', title: 'Brand wordmark preview', state: 'todo', ...extra, requiresProof };
  fs.mkdirSync(path.dirname(path.join(repoRoot, RECORD)), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, RECORD), JSON.stringify(record));
  return { repoRoot, declaration };
}

/** The HFS_PROOF_COMMAND_FILE_MISSING findings of the proof-command-files check over the tracked `files` of a temp app. */
const judge = ({ repoRoot, declaration }, files = [RECORD]) => {
  const { repo, ...resolver } = openHfs({ repoRoot, declaration });
  return proofCommandFindings({ repoRoot, files, resolver: { repo, ...resolver }, sides: Object.keys(repo.sides ?? {}) })
    .filter((finding) => finding.code === CODE);
};

for (const edition of ['lite', 'full']) {
  test(`${CODE} ${edition}: a proof command that runs a missing script is refused, one finding per kind and path`, (t) => {
    const missing = judge(app(t, edition, { measurement: `node ${TARGET}`, unit: 'node --test scripts/gone.spec.mjs' }));
    assert.deepEqual(missing.map(({ code, level, path: file, kind, missing: absent }) => ({ code, level, file, kind, absent })), [
      { code: CODE, level: 'error', file: RECORD, kind: 'measurement', absent: TARGET },
      { code: CODE, level: 'error', file: RECORD, kind: 'unit', absent: 'scripts/gone.spec.mjs' },
    ]);
    assert.match(missing[0].message, /repository does not hold/);
  });

  test(`${CODE} ${edition}: a proof command whose file exists, flags, globs, build products and other repositories is valid and passes`, (t) => {
    const fixture = app(t, edition, {
      measurement: `node ${TARGET} --out be/dist/apps/api/main.js`,
      unit: 'node --test "src/**/*.spec.mjs" ../other/tools/run.mjs',
    });
    fs.mkdirSync(path.join(fixture.repoRoot, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(fixture.repoRoot, TARGET), 'export {};\n');
    assert.deepEqual(judge(fixture), [], 'an existing file makes the exact same proof command runnable');
  });

  test(`${CODE} ${edition}: a record of an implementation in another repository is valid and not judged`, (t) => {
    assert.deepEqual(judge(app(t, edition, { measurement: `node ${TARGET}` }, { repository: 'other-repo' })), []);
  });

  test(`${CODE} ${edition}: a record of the be side is refused against the app root, where its proof command runs`, (t) => {
    const fixture = app(t, edition, { measurement: `node ${TARGET}` }, { repository: 'be' });
    assert.deepEqual(judge(fixture).map((finding) => finding.missing), [TARGET]);
  });
}

test(`${CODE}: commandFiles names only repository-relative file arguments`, () => {
  assert.deepEqual(commandFiles('node ./scripts/a.mjs --flag scripts/b.spec.mjs "src/**/*.ts" /abs/c.mjs ../x/y.mjs https://h/z.js scripts/a.mjs'), ['scripts/a.mjs', 'scripts/b.spec.mjs']);
});
