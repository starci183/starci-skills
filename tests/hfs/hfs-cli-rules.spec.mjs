// The one command line of a back end (scripts/hfs/rules/cli.mjs): R132 BE_CLI_REQUIRED. The clean app of
// tests/helpers/hfs-cli-fixture.mjs is the base; a back end with a connection or a command declares the cli app be/apps/cli with
// its Dockerfile. Where a command is declared and its spec beside it are eslint-be's (packages/eslint/be/cli.spec.mjs, testing.spec.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { appOf, cleanup, gitAdd, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

const made = [];
test.after(() => cleanup(made));
const repoOf = (declaration, mutate) => {
  const dir = writeCleanRepo(declaration);
  made.push(dir);
  if (mutate) mutate(dir);
  return gitAdd(dir);
};
const put = (dir, relative, text = 'export {};\n') => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const only = (result, code) => result.findings.filter((f) => f.code === code);
const PRIMARY = [{ name: 'primary', envPrefix: 'PRIMARY_DB' }];
const WITH_CLI = appOf({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: PRIMARY } });
/** The cli image and a migrate group with its run sub-command and their specs. */
const cliTree = () => (dir) => {
  put(dir, 'be/apps/cli/Dockerfile', 'FROM node:22-alpine\n');
  put(dir, 'be/src/features/cli/index.ts');
  put(dir, 'be/src/features/cli/cli.module.ts');
  put(dir, 'be/src/features/cli/cli.module-definition.ts');
  put(dir, 'be/src/features/cli/migrate/migrate.cli.ts');
  put(dir, 'be/src/features/cli/migrate/migrate.module.ts');
  put(dir, 'be/src/features/cli/migrate/migrate.cli.spec.ts');
  put(dir, 'be/src/features/cli/migrate/subs/run.cli.ts');
  put(dir, 'be/src/features/cli/migrate/subs/run.cli.spec.ts');
};

test('BE_CLI_REQUIRED: the cli app with its image, beside a back end with a connection and commands, is clean; so is a back end with neither', () => {
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(WITH_CLI, cliTree()) }), 'BE_CLI_REQUIRED'), []);
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(appOf()) }), 'BE_CLI_REQUIRED'), [], 'no connection and no command: no cli needed');
});

test('BE_CLI_REQUIRED: a connection or a command without the cli app, a cli app of another name and a cli app without its image are refused', () => {
  const noCli = only(checkRepo({ repoRoot: repoOf(appOf({ be: { apps: [{ name: 'core', kind: 'api' }], connections: PRIMARY } })) }), 'BE_CLI_REQUIRED');
  assert.deepEqual(noCli.map((f) => f.path), ['hfs.json']);
  assert.match(noCli[0].message, /connection primary/);
  const commandsOnly = only(checkRepo({ repoRoot: repoOf(appOf(), cliTree()) }), 'BE_CLI_REQUIRED');
  assert.ok(commandsOnly.some((f) => f.path === 'hfs.json' && /src\/features\/cli/.test(f.message)));
  const renamed = appOf({ be: { apps: [{ name: 'core', kind: 'api' }, { name: 'ops', kind: 'cli' }], connections: PRIMARY } });
  assert.deepEqual(only(checkRepo({ repoRoot: repoOf(renamed) }), 'BE_CLI_REQUIRED').map((f) => f.app), ['ops']);
  const imageless = only(checkRepo({ repoRoot: repoOf(WITH_CLI, (dir) => { cliTree()(dir); fs.rmSync(path.join(dir, 'be', 'apps', 'cli', 'Dockerfile')); }) }), 'BE_CLI_REQUIRED');
  assert.deepEqual(imageless.map((f) => f.path), ['be/apps/cli/Dockerfile']);
});
