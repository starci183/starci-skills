// Hermetic repositories for the HFS architecture machine specs: a temp git repo with hfs.json, a root tsconfig and the
// files a spec lists, judged by checkArchitecture with the injected TypeScript compiler. No architecture.json exists any
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
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', message);
  return git('rev-parse', 'HEAD').toString().trim();
}

/**
 * profile 'be' | 'fe'. `files` maps repository-relative paths to content (null removes a default file).
 * Defaults: hfs.json, a permissive root tsconfig.json, and (be) apps/core/src/{main.ts,app.module.ts} or (fe) a Next app shell.
 * `declaration` overrides parts of hfs.json. The repository is a git repo with the files staged (not committed): call gitCommit for a base.
 */
export function archFixture(t, { profile = 'be', files = {}, declaration = {}, apps = DEFAULT_APPS[profile] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-hfs-arch-${profile}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = apps[0].name;
  const extraApps = Object.fromEntries(profile === 'fe'
    ? apps.slice(1).map(other => [`apps/${other.name}/package.json`, JSON.stringify({ name: `@fixture/${other.name}`, private: true })]) : []);
  const baseline = {
    ...extraApps,
    'hfs.json': `${JSON.stringify({ hfs: 1, profile, project: 'fixture', apps, ...declaration }, null, 2)}\n`,
    'package.json': JSON.stringify(profile === 'fe' ? { name: 'fixture-fe', private: true, workspaces: ['apps/*'] } : { name: 'fixture-be', private: true }),
    'tsconfig.json': `${JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', allowJs: true, skipLibCheck: true, noEmit: true, experimentalDecorators: true },
      include: ['src/**/*', 'apps/**/*'],
    }, null, 2)}\n`,
    ...(profile === 'be' ? {
      [`apps/${app}/src/main.ts`]: 'void 0;\n',
      [`apps/${app}/src/app.module.ts`]: 'export const AppModule = 1;\n',
    } : {
      [`apps/${app}/package.json`]: JSON.stringify({ name: `@fixture/${app}`, private: true }),
      [`apps/${app}/src/app/.keep`]: '',
    }),
  };
  writeFiles(root, { ...baseline, ...files });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

/** Run the whole machine over a fixture; extra options (base, paths) pass through. */
export function runArch(root, options = {}) {
  return checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts, ...options });
}

export const findings = (report, ruleId) => report.violations.filter(item => item.ruleId === ruleId);
