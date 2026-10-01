// Hermetic apps for the HFS architecture machine specs: a temp git repo with the app-root hfs.json, and in one side folder a
// tsconfig and the files a spec lists, judged by checkArchitecture (the side folder as its root) with the injected TypeScript compiler. No architecture.json exists any
// more; the declaration is hfs.json (modules/schemas/hfs-repo.schema.yaml), the direction matrix and slots are
// knowledge/hfs/slots.yaml.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { checkArchitecture } from '../scripts/checks/architecture.mjs';

const require = createRequire(import.meta.url);
export const ts = require('typescript');

export const DEFAULT_APPS = { be: [{ name: 'core', kind: 'api' }], fe: [{ name: 'web', kind: 'next' }] };

export function writeFiles(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    if (content === null) continue;
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

export function gitCommit(root, message = 'fixture', env = {}) {
  const git = (...args) => execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.test', ...args], { cwd: root, stdio: 'pipe', env: { ...process.env, ...env } });
  git('add', '-A', ':/');
  git('commit', '-q', '--allow-empty', '-m', message);
  return git('rev-parse', 'HEAD').toString().trim();
}

/** The app hfs.json of a fixture about one side: `fields` (apps, optionalSlots, connections, reads) for `side`, the smallest other side. */
export function appDeclaration(side, fields, project = 'fixture') {
  const other = { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } };
  return { hfs: 2, kind: 'app', project, sides: { ...other, [side]: fields } };
}

/**
 * The `side` folder of a fresh temp app (removed after the test): the root a spec writes a side's files under and runs the
 * machine on. The app root (its parent) holds nothing yet; write `../hfs.json` (appDeclarationText) and `../package.json`.
 */
export function tempSide(t, prefix, side = 'be') {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(app, { recursive: true, force: true }));
  const root = path.join(app, side);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** appDeclaration as the text of an hfs.json file. */
export const appDeclarationText = (side, fields, project = 'fixture') => `${JSON.stringify(appDeclaration(side, fields, project), null, 2)}\n`;

/**
 * A hermetic app whose `profile` side the machine judges: the app root holds hfs.json and the one package.json, the side folder
 * (`<app>/<profile>`, the returned root) a permissive tsconfig.json and (be) apps/core/src/{main.ts,app.module.ts} or (fe) a Next
 * app shell. `files` maps side-relative paths to content (null removes a default file); a path that starts with `../` is written
 * at the app root (`../package.json` replaces the app's manifest). `declaration` overrides parts of the side's declaration. The
 * app is a git repo with the files staged (not committed): call gitCommit(root) for a base.
 */
export function archFixture(t, { profile = 'be', files = {}, declaration = {}, apps = DEFAULT_APPS[profile] } = {}) {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), `starci-hfs-arch-${profile}-`));
  t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));
  const root = path.join(appRoot, profile);
  const app = apps[0].name;
  const baseline = {
    '../hfs.json': `${JSON.stringify(appDeclaration(profile, { apps, ...declaration }), null, 2)}\n`,
    '../package.json': JSON.stringify({ name: 'fixture', private: true }),
    'tsconfig.json': `${JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', allowJs: true, skipLibCheck: true, noEmit: true, experimentalDecorators: true },
      include: ['src/**/*', 'apps/**/*'],
    }, null, 2)}\n`,
    ...(profile === 'be' ? {
      [`apps/${app}/src/main.ts`]: 'void 0;\n',
      [`apps/${app}/src/app.module.ts`]: 'export const AppModule = 1;\n',
    } : {
      [`apps/${app}/src/app/.keep`]: '',
    }),
  };
  fs.mkdirSync(root, { recursive: true });
  writeFiles(root, { ...baseline, ...files });
  execFileSync('git', ['init', '-q'], { cwd: appRoot });
  execFileSync('git', ['add', '-A'], { cwd: appRoot });
  return root;
}

/** Run the whole machine over a fixture; extra options (base, paths) pass through. */
export function runArch(root, options = {}) {
  return checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts, ...options });
}

export const findings = (report, ruleId) => report.violations.filter(item => item.ruleId === ruleId);
