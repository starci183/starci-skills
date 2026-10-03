import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepoPresentation } from '../../scripts/hfs/architecture/hfs.mjs';
import { cliFindings } from '../../scripts/hfs/rules/cli.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { secretHits } from '../../scripts/lib/secret-patterns.mjs';

// Three checks read the edition through the declaration or the managed data, never through a branch of their own caller:
// R147 (the cli app is the Supabase CLI's job under lite), the README Development section (the managed script names of the
// edition), and the secret scan (`env(NAME)` in supabase/config.toml is a reference, not a value).

const declaration = (edition) => ({ hfs: 2, kind: 'app', project: 'demo', ...(edition ? { edition } : {}), sides: { be: { apps: [{ name: 'api', kind: 'api' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } });
const open = (edition) => { const manifest = loadSlotManifest(); const repo = resolveRepoDeclaration(manifest, declaration(edition)); return { repo, resolver: createSlotResolver(manifest, repo) }; };

test('R147: a connection forces the cli app in full and not in lite; a tracked command forces it in both', () => {
  const full = open();
  const lite = open('lite');
  assert.deepEqual(cliFindings({ files: [], ...full }).map((f) => f.code), ['BE_CLI_REQUIRED']);
  assert.deepEqual(cliFindings({ files: [], ...lite }), []);
  assert.deepEqual(cliFindings({ files: ['be/src/features/cli/index.ts'], ...lite }).map((f) => f.code), ['BE_CLI_REQUIRED']);
});

const readme = (commands) => `# demo\n\nA demo app.\n\n## Development\n\n${commands.join('\n')}\n`;
const withReadme = (t, text) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lite-readme-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'README.md'), text);
  fs.writeFileSync(path.join(dir, '.gitattributes'), '* text=auto\n');
  return dir;
};
const developmentFindings = (dir, edition) => checkRepoPresentation({ root: dir, runtime: false, tree: { top: new Set(), hasFile: (f) => ['README.md', '.gitattributes'].includes(f), hasDir: () => false, source: 'test' }, edition }).violations.filter((v) => v.ruleId === 'HFS_README_DEVELOPMENT_INCOMPLETE');

test('README Development: the managed script names of the edition decide (no npm test in lite, typecheck and lint in both)', (t) => {
  const liteCommands = ['npm install', 'npm run typecheck', 'npm run lint'];
  const lite = withReadme(t, readme(liteCommands));
  assert.deepEqual(developmentFindings(lite, 'lite'), []);
  assert.equal(developmentFindings(lite, 'full').length, 1, 'full still wants npm test');
  const full = withReadme(t, readme([...liteCommands, 'npm test']));
  assert.deepEqual(developmentFindings(full, 'full'), []);
  const missing = withReadme(t, readme(['npm install', 'npm run lint']));
  assert.equal(developmentFindings(missing, 'lite').length, 1, 'typecheck stays required in lite (the partial scripts are read, not skipped)');
  assert.equal(developmentFindings(missing, 'full').length, 1);
});

test('secret scan: env(NAME) in a config is a reference; a literal value is still a secret', () => {
  assert.deepEqual(secretHits('supabase/config.toml', 'secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"'), []);
  assert.deepEqual(secretHits('supabase/config.toml', 'client_secret = "env(GOOGLE_CLIENT_SECRET)"'), []);
  assert.deepEqual(secretHits('supabase/config.toml', 'secret = "Zk3pQ9vL2mX8aR5tY7uN"'), ['assigned-secret']);
  assert.deepEqual(secretHits('app.ts', 'password = "env(NOT_A_REFERENCE_BUT_LONG_enough)x"'), ['assigned-secret'], 'only the exact env(NAME) form is exempt');
});
