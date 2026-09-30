// canon-packed-load.spec.mjs - each eslint canon, installed from its packed tarball (only the files its package.json ships),
// loads every rule and lints a file of a real HFS repository. 2.1.0/7.1.0 shipped a runtime that read a template left
// outside the tarball, so every rule failed to load in product repositories while the in-tree tests passed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BE, FE, cleanup, gitAdd, installTypeScript, writeCleanRepo } from './_hfs-cli-fixture.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..');
const NEEDED = ['eslint', 'typescript', '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser', 'eslint-plugin-react-hooks', 'globals'];
/** An install that carries every peer and dependency the canons load (a front-end example installs the fullest set). */
const DEPS = ['examples/ecommerce-app-fe', 'examples/shape-slot', 'examples/todo-app-frontend', 'packages']
  .map((dir) => path.join(RUNTIME, ...dir.split('/'), 'node_modules'))
  .find((dir) => NEEDED.every((dep) => fs.existsSync(path.join(dir, ...dep.split('/'), 'package.json'))));
const made = [];
const links = [];
test.after(() => {
  for (const link of links) if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
  cleanup(made);
});

/** Packs `packages/<dir>` and extracts it as `<repo>/node_modules/@starci/<name>`, with its dependencies linked from the runtime's install. */
function installPacked(repo, dir, name) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-pack-'));
  made.push(out);
  const tgz = execFileSync('npm', ['pack', '--silent', '--pack-destination', out], { cwd: path.join(RUNTIME, 'packages', ...dir.split('/')), encoding: 'utf8', shell: process.platform === 'win32' }).trim().split(/\r?\n/).at(-1);
  const target = path.join(repo, 'node_modules', '@starci', name);
  fs.mkdirSync(target, { recursive: true });
  // Windows' own bsdtar reads drive-letter paths; the GNU tar a git shell puts first on PATH takes `C:` for a remote host
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  execFileSync(tar, ['-xzf', path.join(out, tgz), '-C', target, '--strip-components=1']);
  for (const dep of ['eslint', 'typescript', '@typescript-eslint', 'eslint-plugin-react-hooks', 'globals']) {
    const link = path.join(repo, 'node_modules', dep);
    if (fs.existsSync(path.join(DEPS, dep)) && !fs.existsSync(link)) {
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(path.join(DEPS, dep), link, 'junction');
      links.push(link);
    }
  }
  return target;
}

for (const [label, declaration, dir, name, entry, file] of [
  ['be', BE, 'eslint/be', 'eslint-canon-be', 'starciBeConfig', 'src/modules/platform/config/index.ts'],
  ['fe', FE, 'eslint/fe', 'eslint-canon-fe', 'starciFeConfig', null],
]) {
  test(`the packed ${name} loads every rule and lints a file of a ${label} repository`, { skip: DEPS ? false : `no local install carries ${NEEDED.join(', ')}; install an FE example to run this check` }, async () => {
    const repo = gitAdd(installTypeScript(writeCleanRepo(declaration)));
    made.push(repo);
    const canon = installPacked(repo, dir, name);
    const plugin = await import(pathToFileURL(path.join(canon, 'index.mjs')).href);
    assert.equal(typeof plugin[entry], 'function', `${name} exports ${entry}`);
    const { ESLint } = await import(pathToFileURL(path.join(DEPS, 'eslint', 'lib', 'api.js')).href);
    const config = await plugin[entry]({ hfs: plugin.loadHfs(pathToFileURL(path.join(repo, 'eslint.config.mjs')).href) });
    const eslint = new ESLint({ cwd: repo, overrideConfigFile: true, overrideConfig: config });
    const target = file ?? fs.readdirSync(path.join(repo, 'apps', declaration.apps[0].name, 'src'), { recursive: true }).map(String).find((f) => /\.tsx?$/.test(f));
    const results = await eslint.lintFiles([file ? path.join(repo, file) : path.join(repo, 'apps', declaration.apps[0].name, 'src', target)]);
    const loadErrors = results.flatMap((r) => r.messages).filter((m) => m.fatal || /Error while loading rule|cannot be found/.test(m.message));
    assert.deepEqual(loadErrors, [], `${name} rules load from the tarball`);
  });
}
