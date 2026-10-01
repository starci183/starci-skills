import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {enclosingRepository, loadArchitectureConfig} from '../scripts/checks/architecture/config.mjs';
import {appDeclarationText} from './_hfs-arch-fixture.mjs';

/**
 * A checked project is routinely one package of a repository that also ships the packages it consumes.
 * `--root` is that project, not the repository, so a `file:` dependency pointing at a sibling package
 * resolves outside `--root` while still being an ordinary, resolvable part of the same checkout - which is
 * exactly the shape the example apps once had against
 * `packages/shared-kit` and `packages/fe-kit`. Refusing it failed the whole architecture check closed
 * (ARCH_CONFIG_INVALID) over a monorepo layout nobody had done anything wrong in.
 *
 * The boundary is therefore the enclosing git repository rather than `--root`, and the three cases that
 * matter are asserted here: inside the project (a workspace of it), inside the repository but outside the
 * project (resolvable, and deliberately NOT a workspace of it), and outside the repository entirely
 * (still refused, which is the property the old rule was protecting).
 */

function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-architecture-file-dependency-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-architecture-file-dependency-'));
    fs.rmSync(root, {recursive: true, force: true});
  });
  const write = (relative, text) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, text);
  };
  const manifest = (relative, value) => write(path.posix.join(relative, 'package.json'), `${JSON.stringify(value, null, 2)}\n`);
  return {root, write, manifest};
}

/**
 * The minimum a backend side needs for the loader to get as far as reading its dependencies: the app at `at` (its one
 * package.json and hfs.json) and its be/ side folder, the root the loader checks (sideOf).
 */
function project(write, manifest, at, dependencies) {
  manifest(at, {name: path.posix.basename(at) || 'app', version: '0.0.0', dependencies});
  write(path.posix.join(at, 'hfs.json'), appDeclarationText('be', {apps: [{name: 'core', kind: 'api'}]}));
  write(path.posix.join(at, 'be/src/modules/thing/thing.service.ts'), 'export class ThingService {}\n');
  write(path.posix.join(at, 'be/src/features/thing/thing.module.ts'), 'export class ThingModule {}\n');
  write(path.posix.join(at, 'be/tsconfig.json'), '{"compilerOptions":{"strict":true}}\n');
}

/** The be side folder of the app at `at`. */
const sideOf = (root, at) => path.join(root, at, 'be');

test('a file: dependency inside the checked side is one of its workspaces', t => {
  const {root, write, manifest} = repo(t);
  write('.git', 'gitdir: elsewhere\n');
  project(write, manifest, 'app', {'@kit/local': 'file:./be/packages/local'});
  manifest('app/be/packages/local', {name: '@kit/local', version: '0.0.0'});
  const config = loadArchitectureConfig(sideOf(root, 'app'));
  assert.deepEqual(config.workspaces, ['packages/local'],
    'a package the project itself contains is part of its own layout, and the loader has always collected it');
});

test('a file: dependency inside the same repository resolves without becoming a workspace of the project', t => {
  const {root, write, manifest} = repo(t);
  write('.git', 'gitdir: elsewhere\n');
  manifest('', {name: 'monorepo', version: '0.0.0', private: true});
  project(write, manifest, 'examples/app', {'@kit/e2e': 'file:../../packages/shared-kit'});
  manifest('packages/shared-kit', {name: '@kit/e2e', version: '0.0.0'});
  write('packages/shared-kit/src/index.ts', 'export const kit = 1;\n');

  const config = loadArchitectureConfig(sideOf(root, 'examples/app'));
  assert.deepEqual(config.workspaces, [],
    "a sibling package this project consumes is not part of this project's source layout; collecting it would pull another package's src into these roots");
  assert.deepEqual(config.kinds, ['backend'], 'the config still loads, which is the whole point - the old rule failed it closed');
});

test('a file: dependency outside the repository is still refused', t => {
  const {root, write, manifest} = repo(t);
  write('.git', 'gitdir: elsewhere\n');
  project(write, manifest, 'app', {'@kit/stray': 'file:../../outside-kit'});
  fs.mkdirSync(path.join(path.dirname(root), 'outside-kit'), {recursive: true});
  t.after(() => fs.rmSync(path.join(path.dirname(root), 'outside-kit'), {recursive: true, force: true}));
  fs.writeFileSync(path.join(path.dirname(root), 'outside-kit', 'package.json'), '{"name":"@kit/stray","version":"0.0.0"}\n');
  assert.throws(() => loadArchitectureConfig(sideOf(root, 'app')),
    /must resolve to a package directory inside the repository/,
    'a path that leaves the checkout is unreviewable, which is the property the containment rule exists for');
});

test('a file: dependency pointing at something that is not a package is refused inside the repository too', t => {
  const {root, write, manifest} = repo(t);
  write('.git', 'gitdir: elsewhere\n');
  manifest('', {name: 'monorepo', version: '0.0.0', private: true});
  project(write, manifest, 'examples/app', {'@kit/ghost': 'file:../../packages/ghost'});
  fs.mkdirSync(path.join(root, 'packages/ghost'), {recursive: true});
  assert.throws(() => loadArchitectureConfig(sideOf(root, 'examples/app')),
    /must resolve to a package directory inside the repository/,
    'being inside the repository is not enough; the dependency must actually be a package, or the declaration names nothing');
});

test('with no repository around it, the project itself is the boundary', t => {
  const {root, write, manifest} = repo(t);
  manifest('', {name: 'monorepo', version: '0.0.0', private: true});
  project(write, manifest, 'examples/app', {'@kit/e2e': 'file:../../packages/shared-kit'});
  manifest('packages/shared-kit', {name: '@kit/e2e', version: '0.0.0'});
  assert.throws(() => loadArchitectureConfig(sideOf(root, 'examples/app')),
    /must resolve to a package directory inside the repository/,
    'the wider boundary is a git checkout, not any parent directory that happens to exist');
});

test('the loaded config carries the repository it found, so every later boundary test asks the same question', t => {
  const {root, write, manifest} = repo(t);
  write('.git', 'gitdir: elsewhere\n');
  manifest('', {name: 'monorepo', version: '0.0.0', private: true});
  project(write, manifest, 'examples/app', {});
  const config = loadArchitectureConfig(sideOf(root, 'examples/app'));
  assert.equal(config.repository, path.resolve(root),
    'the import-resolution check reads this rather than walking up again, so the two cannot disagree about where the checkout ends');
  assert.equal(enclosingRepository(path.join(root, 'examples/app')), path.resolve(root));
});

test('a project with no git checkout around it reports no repository at all', t => {
  const {root, write, manifest} = repo(t);
  manifest('', {name: 'monorepo', version: '0.0.0', private: true});
  project(write, manifest, 'examples/app', {});
  const config = loadArchitectureConfig(sideOf(root, 'examples/app'));
  assert.equal(config.repository, null,
    'null is what makes the project itself the boundary; a parent directory that is not a checkout is not a wider scope, it is just a parent');
});
