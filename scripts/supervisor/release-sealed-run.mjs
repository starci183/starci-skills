// release-sealed-run.mjs - `node release-sealed-run.mjs <example-dir> -- npm <args>`: one npm command of an example app run the way its own ci.yml runs its lint, in a disposable
// copy with fresh nondeployable sealed members (scripts/hfs/example-secrets.mjs withMaterializedExample, docs/runtime-example-secrets.md): the runtime repository tracks no ciphertext,
// so the stack gate (HFS_STACKS_SHAPE, R253/R277) can only judge an example's declared members in such a copy. The release cut's example `lint` row and the lint report of its Sonar
// proof run through it (release-l4.mjs, release-sonar-report.mjs).
// The copy's node_modules are real folders whose entries link the source app's installed packages, except the @starci scope, which is copied: the app lint resolves its canon from the
// app root and refuses one whose real path lies outside it (packages/hfs/lint/run.mjs), so the canon must physically sit inside the copy. Exit status: the command's.
import fs from 'node:fs';
import path from 'node:path';
import { withMaterializedExample } from '../hfs/example-secrets.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { withoutGitLocalEnv } from '../lib/git.mjs';
import { isMain } from '../lib/is-main.mjs';
import { rowRunnerMain } from '../lib/row-runner-cli.mjs';

const OWN_SCOPE = '@starci';
const NOT_WALKED = new Set(['.git', 'node_modules', '.next', '.turbo', 'dist', 'coverage', '.starcistacks']);

/** Links `from` (a node_modules folder) into `to` entry by entry; the @starci scope is copied so the canon's real path is inside the copy. */
function linkModules(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name), target = path.join(to, entry.name);
    if (entry.name === OWN_SCOPE || !fs.statSync(source).isDirectory()) fs.cpSync(fs.realpathSync(source), target, { recursive: true, dereference: true });
    else fs.symlinkSync(fs.realpathSync(source), target, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

/** Every node_modules folder of the source app below `dir`, linked at the same place in the copy. */
function linkDependencies(source, copy) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const from = path.join(source, entry.name), to = path.join(copy, entry.name);
    if (entry.name === 'node_modules') linkModules(from, to);
    else if (!NOT_WALKED.has(entry.name) && fs.existsSync(to)) linkDependencies(from, to);
  }
}

/** The environment of the command: no repository-local git variable and no age identity of the host. */
const commandEnv = () => Object.fromEntries(Object.entries(withoutGitLocalEnv(process.env)).filter(([name]) => !/^SOPS_AGE_KEY(?:_FILE)?$/iu.test(name)));

/** Runs `npm <args>` of the example at `appDir` in a sealed copy; generated reports/ return to the source app. Resolves to the exit status. */
async function runSealedNpm(appDir, args, { stdio = 'inherit' } = {}) {
  const source = path.resolve(appDir);
  return withMaterializedExample(source, '.', (copy) => {
    linkDependencies(source, copy);
    const result = runNpm(args, { cwd: copy, env: commandEnv(), stdio, windowsHide: true });
    const reports = path.join(copy, 'reports');
    if (fs.existsSync(reports)) fs.cpSync(reports, path.join(source, 'reports'), { recursive: true });
    if (result.error) throw new Error(`npm ${args.join(' ')} could not start in the sealed copy`);
    return result.status ?? 1;
  });
}

if (isMain(import.meta.url)) process.exitCode = await rowRunnerMain(process.argv.slice(2), { name: 'release-sealed-run.mjs', run: (dir, args) => runSealedNpm(dir, args) });
