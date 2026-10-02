import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { imageFiles, renderTargets, writeTargets } from '../../packages/hfs/sync/index.mjs';
import { FE_APP_SCRIPTS, PACKAGE_MANAGER, WORKSPACES, feAppPackageName } from '../../scripts/hfs/rules/monorepo.mjs';
import { loadSonarGate } from '../../scripts/gates/sonar-gate.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const jestPreset = createRequire(import.meta.url)('../../packages/jest-preset/index.cjs');
const PINS = parseYaml(fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'knowledge', 'hfs', 'canon-pins.yaml'), 'utf8')).pins;
/** What `hfs sync` would load from the jest preset an app installs for its be side: the Sonar exclusions and the coverage sources. */
export const PRESETS = { sonarExclusions: jestPreset.sonarExclusions(), coverageSources: [...jestPreset.COVERAGE_SOURCES] };

/** An app declaration: the be side of `be` and the fe side of `fe` (hfs.json sides.<side>). */
export const appOf = ({ be = { apps: [{ name: 'core', kind: 'api' }] }, fe = { apps: [{ name: 'web', kind: 'next' }] }, project = 'demo' } = {}) => ({ hfs: 2, kind: 'app', project, sides: { be, fe } });
/** The clean app of most specs: one api app, one Next app. */
export const APP = appOf();
/** An app whose fe side holds two Next apps. */
export const TWO_FE_APPS = appOf({ fe: { apps: [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }] } });

/** The repository's `prettier` for a spec that is not about formatting: it judges every file formatted. */
export const FORMATTED = Object.freeze({ getFileInfo: async () => ({ ignored: false, inferredParser: 'babel' }), resolveConfig: async () => null, check: async () => true });
/** application-stacks.yaml as the standard shape wants it: a Sonar owned by the host. */
export const STACKS_DECLARATION = ['schema: starci/application-stacks@1', 'services:', '  sonar:', '    provider: sonarqube', '    mode: local', `    qualityGate: ${loadSonarGate().gate.name}`, '    stack:', '      owner: host', '      root: .claude/ext/sonar', '      environment: dev', ''].join('\n');

const readmeOf = (name) => [`# ${name}`, '', 'A demo app for the hfs check specs.', '', '## Overview', '', 'Demo.', '', '## Stack', '', 'TypeScript.', '', '## Repository layout', '', 'be/ and fe/.', '',
  '## Development', '', '```sh', 'npm ci', 'npm run typecheck', 'npm run lint', 'npm test', '```', '', '## Work', '', 'Records live in `.starciwork`.', ''].join('\n');

/**
 * A clean app for `declaration`: every managed file of the root and both sides rendered, every other path the manifest requires,
 * one BE feature and the front end's module entries, clean to the whole check (including the README and the back-end app module).
 * Not yet a Git repository. `into` places it as <into>/<name> instead of a fresh temporary directory (its README and package.json
 * name the directory).
 */
export function writeCleanRepo(declaration = APP, { declare = true, into, name = 'demo' } = {}) {
  const dir = into ? path.join(into, name) : fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-cli-'));
  fs.mkdirSync(dir, { recursive: true });
  const manifest = loadSlotManifest();
  const resolver = createSlotResolver(manifest, resolveRepoDeclaration(manifest, declaration));
  const put = (relative, text = '') => {
    const target = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, text);
  };
  const write = (relative, text) => { const target = path.join(dir, ...relative.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
  // The one package.json of the app, the monorepo root (R128): the fe workspaces, npm as the package manager, turbo pinned.
  put('package.json', `${JSON.stringify({ name: path.basename(dir), private: true, packageManager: PACKAGE_MANAGER, workspaces: [...WORKSPACES], devDependencies: { turbo: PINS.turbo.version } })}\n`);
  // Each fe app is a workspace (R129) that declares its own next-intl stack (R59, R131).
  for (const app of declaration.sides.fe.apps) put(`fe/apps/${app.name}/package.json`, `${JSON.stringify({ name: feAppPackageName(declaration.project, app.name), private: true, scripts: FE_APP_SCRIPTS, dependencies: { 'next-intl': PINS['next-intl'].version } }, null, 2)}\n`);
  // The Nest monorepo of the declared be apps (R130), the default project the first api app.
  const beApps = declaration.sides.be.apps;
  const defaultApp = beApps.find((app) => app.kind === 'api') ?? beApps[0];
  put('be/nest-cli.json', `${JSON.stringify({ $schema: 'https://json.schemastore.org/nest-cli', collection: '@nestjs/schematics', monorepo: true, root: `apps/${defaultApp.name}`, sourceRoot: `apps/${defaultApp.name}/src`, projects: Object.fromEntries(beApps.map((app) => [app.name, { type: 'application', root: `apps/${app.name}`, entryFile: 'main', sourceRoot: `apps/${app.name}/src` }])) }, null, 2)}\n`);
  writeTargets(dir, renderTargets(declaration, PRESETS));
  // The file a rule reads the content of that the render does not write: the be side's stack declaration.
  put('.starcistacks/application-stacks.yaml', STACKS_DECLARATION);
  // One Dockerfile per declared app (R172-R176), the template output, and the standalone output every Next image ships.
  for (const file of imageFiles(resolveRepoDeclaration(manifest, declaration))) put(file.path, file.content);
  for (const app of declaration.sides.fe.apps) put(`fe/apps/${app.name}/next.config.ts`, 'export default { output: "standalone" };\n');
  const required = resolver.requiredPaths().paths.map((entry) => entry.path);
  for (const p of required) if (!p.endsWith('/')) put(p, p === 'hfs.json' ? '' : p.endsWith('.json') ? '{}\n' : /^be\/apps\/[^/]+\/src\/app\.module\.ts$/.test(p) ? 'export class AppModule {}\n' : 'export {};\n');
  for (const app of declaration.sides.fe.apps) {
    const base = `fe/apps/${app.name}`;
    put(`${base}/src/modules/i18n/messages/en.json`, '{}');
    put(`${base}/src/modules/i18n/messages/vi.json`, '{}');
    put(`${base}/src/proxy.ts`);
    // The machine judges reachability: every module entry imports its siblings and the app's route handler imports every module entry.
    const entries = required.filter((p) => p.startsWith(`${base}/src/modules/`) && p.endsWith('/index.ts'));
    for (const entry of entries) {
      const siblings = required.filter((p) => path.posix.dirname(p) === path.posix.dirname(entry) && p !== entry && /\.tsx?$/.test(p));
      write(entry, `${siblings.map((p) => `import './${path.posix.basename(p).replace(/\.tsx?$/, '')}';\n`).join('')}export {};\n`);
    }
    put(`${base}/src/app/health/live/route.ts`, `${entries.map((p) => `import '../../../modules/${path.posix.basename(path.posix.dirname(p))}';\n`).join('')}export const GET = () => new Response('ok');\nexport const app_${app.name.replace(/-/g, '_')} = 1;\n`);
  }
  put('be/src/features/orders/index.ts', `import './orders.module';\nimport './application/place-order.handler';\nexport {};\n`);
  put('be/src/features/orders/orders.module.ts', 'export {};\n');
  put('be/src/features/orders/application/place-order.handler.ts', 'export {};\n');
  // The machine judges reachability: the app composes the feature and every required module, so a clean app is clean to it too.
  const owners = ['src/features/orders/index.ts', ...required.filter((p) => /^be\/src\/modules\/[^/]+\/[^/]+\/index\.ts$/.test(p)).map((p) => p.slice('be/'.length))];
  // An api app is denied by default (throttler, CSRF origin guard, AuthGuard) and masks its errors through the one filter of platform/errors.
  write('be/src/modules/platform/errors/index.ts', "export { AllExceptionsFilter } from './all-exceptions.filter';\n");
  write('be/src/modules/platform/errors/all-exceptions.filter.ts', 'export class AllExceptionsFilter { catch(): void {} }\n');
  write('be/src/modules/platform/http-security/index.ts', "export { CsrfOriginGuard } from './csrf-origin.guard';\n");
  write('be/src/modules/platform/http-security/csrf-origin.guard.ts', 'interface RequestHeaders { origin?: string }\ninterface HttpRequest { headers: RequestHeaders }\ninterface HttpHost { getRequest(): HttpRequest }\ninterface GuardContext { switchToHttp(): HttpHost }\nexport class CsrfOriginGuard { canActivate(context: GuardContext): boolean { return context.switchToHttp().getRequest().headers.origin !== undefined; } }\n');
  write('be/src/modules/domain/identity/index.ts', "export { AuthGuard } from './auth.guard';\n");
  write('be/src/modules/domain/identity/auth.guard.ts', 'export class AuthGuard { canActivate(): boolean { return true; } }\n');
  for (const app of declaration.sides.be.apps.filter((entry) => entry.kind === 'api')) {
    write(`be/apps/${app.name}/src/app.module.ts`, [
      "import { Module } from '@nestjs/common';", "import { APP_FILTER, APP_GUARD } from '@nestjs/core';", "import { ThrottlerGuard } from '@nestjs/throttler';",
      "import { AllExceptionsFilter } from '../../../src/modules/platform/errors';", "import { CsrfOriginGuard } from '../../../src/modules/platform/http-security';",
      "import { AuthGuard } from '../../../src/modules/domain/identity';",
      '@Module({ providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: CsrfOriginGuard }, { provide: APP_GUARD, useClass: AuthGuard }] })',
      'export class AppModule {', '  static register(_options: object) { return { module: AppModule, imports: [], providers: [] }; }', '}', ''].join('\n'));
    write(`be/apps/${app.name}/src/main.ts`, owners.map((file) => `import '../../../${file.replace(/\.ts$/, '')}';`).join('\n') + '\n');
  }
  // Both sides' tsconfig.json are the managed ones (they extend @starci/tsconfig/be.json or next.json, see installTypeScript).
  write('README.md', readmeOf(path.basename(dir)));
  if (declare) write('hfs.json', `${JSON.stringify(declaration, null, 2)}\n`);
  else fs.rmSync(path.join(dir, 'hfs.json'), { force: true });
  return dir;
}

/**
 * Makes the app's own `typescript` and the `@starci/tsconfig` preset the side tsconfigs extend resolvable from the app root's
 * node_modules (the machine loads both through the app's one install) without tracking them.
 */
export function installTypeScript(dir) {
  const target = path.join(dir, 'node_modules', 'typescript');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'package.json'), '{"name":"typescript","main":"index.js"}\n');
  fs.writeFileSync(path.join(target, 'index.js'), `module.exports = require(${JSON.stringify(path.resolve(import.meta.dirname, '..', '..', 'node_modules', 'typescript'))});\n`);
  fs.cpSync(path.resolve(import.meta.dirname, '..', '..', 'packages', 'tsconfig'), path.join(dir, 'node_modules', '@starci', 'tsconfig'), { recursive: true, filter: (source) => !source.endsWith('.test.mjs') });
  return dir;
}

export function gitAdd(dir) {
  execFileSync('git', ['-C', dir, 'init', '-q'], { stdio: 'ignore' });
  execFileSync('git', ['-C', dir, 'add', '-A', '-f', '--', '.', ':!node_modules'], { stdio: 'ignore' });
  return dir;
}

export function cleanup(dirs) {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
}

/** Installs the coverage preset `hfs sync` and `hfs check` load from a checked app (a fresh process has no injected presets), without tracking it. */
export function installPresets(dir) {
  fs.cpSync(path.resolve(import.meta.dirname, '..', '..', 'packages', 'jest-preset'), path.join(dir, 'node_modules', '@starci', 'jest-preset'), { recursive: true });
  return dir;
}
