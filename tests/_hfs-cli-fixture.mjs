import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../scripts/lib/hfs-slots.mjs';
import { renderTargets, writeTargets } from '../packages/hfs/sync/index.mjs';
import { loadSonarGate } from '../scripts/checks/sonar-gate.mjs';

const jestPreset = createRequire(import.meta.url)('../packages/jest-preset/index.cjs');
/** The Sonar exclusions `hfs sync` would load from the preset a repository installs, per profile (a front end has no test runner, so none). */
export const PRESETS = {
  be: { sonarExclusions: jestPreset.sonarExclusions() },
  fe: null,
};

export const BE = { hfs: 1, profile: 'be', project: 'demo', apps: [{ name: 'core', kind: 'api' }] };
export const FE = { hfs: 1, profile: 'fe', project: 'demo', apps: [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }] };

/** The repository's `prettier` for a spec that is not about formatting: it judges every file formatted. */
export const FORMATTED = Object.freeze({ getFileInfo: async () => ({ ignored: false, inferredParser: 'babel' }), resolveConfig: async () => null, check: async () => true });
/** application-stacks.yaml as the standard shape wants it: a Sonar owned by the host. */
export const STACKS_DECLARATION = ['schema: starci/application-stacks@1', 'services:', '  sonar:', '    provider: sonarqube', '    mode: local', `    qualityGate: ${loadSonarGate().gate.name}`, '    stack:', '      owner: host', '      root: .claude/ext/sonar', '      environment: dev', ''].join('\n');

const readmeOf = (name, profile) => [`# ${name}`, '', 'A demo repository for the hfs check specs.', '', '## Overview', '', 'Demo.', '', '## Stack', '', 'TypeScript.', '', '## Repository layout', '', 'apps and src.', '',
  '## Development', '', '```sh', 'npm ci', 'npm run typecheck', 'npm run lint', 'npm run build', 'npm test', '```', '', ...(profile === 'be' ? ['## Work', '', 'Records live in `.starciwork`.', ''] : [])].join('\n');

/**
 * A clean product repository for `declaration`: every managed file rendered, every other path the manifest requires, plus one BE
 * feature, clean to the whole check (the README and, for a back end, the composition the machine wants). Not yet a Git repository.
 * `into` places it as <into>/<name> instead of a fresh temporary directory (its README names the directory).
 */
export function writeCleanRepo(declaration, { declare = true, into, name = 'demo' } = {}) {
  const dir = into ? path.join(into, name) : fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-cli-'));
  fs.mkdirSync(dir, { recursive: true });
  const manifest = loadSlotManifest();
  const resolver = createSlotResolver(manifest, resolveRepoDeclaration(manifest, declaration));
  const put = (relative, text = '') => {
    const target = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.writeFileSync(target, text);
  };
  put('package.json', `${JSON.stringify({ name: 'demo', private: true })}\n`);
  writeTargets(dir, renderTargets(declaration, PRESETS[declaration.profile]));
  // The files a rule reads the content of that the render does not write: the stack declaration of a back end, the manifests of a front end.
  if (declaration.profile === 'be') put('.starcistacks/application-stacks.yaml', STACKS_DECLARATION);
  if (declaration.profile === 'fe') for (const app of declaration.apps) put(`apps/${app.name}/package.json`, `${JSON.stringify({ name: `@demo/${app.name}`, private: true, dependencies: { 'next-intl': '4.13.6' } }, null, 2)}
`);
  for (const entry of resolver.requiredPaths().paths) if (!entry.path.endsWith('/')) put(entry.path, entry.path === 'hfs.json' ? '' : entry.path.endsWith('.json') ? '{}\n' : /^apps\/[^/]+\/src\/app\.module\.ts$/.test(entry.path) ? 'export class AppModule {}\n' : 'export {};\n');
  if (declaration.profile === 'fe') {
    const required = resolver.requiredPaths().paths.map((entry) => entry.path);
    for (const app of declaration.apps) {
      put(`apps/${app.name}/src/modules/i18n/messages/en.json`, '{}');
      put(`apps/${app.name}/src/modules/i18n/messages/vi.json`, '{}');
      put(`apps/${app.name}/src/proxy.ts`);
      // The machine judges reachability: every module entry imports its siblings and the app's route handler imports every module entry.
      const entries = required.filter((p) => p.startsWith(`apps/${app.name}/src/modules/`) && p.endsWith('/index.ts'));
      for (const entry of entries) {
        const siblings = required.filter((p) => path.posix.dirname(p) === path.posix.dirname(entry) && p !== entry && /\.tsx?$/.test(p));
        fs.writeFileSync(path.join(dir, ...entry.split('/')), `${siblings.map((p) => `import './${path.posix.basename(p).replace(/\.tsx?$/, '')}';\n`).join('')}export {};\n`);
      }
      put(`apps/${app.name}/src/app/health/live/route.ts`, `${entries.map((p) => `import '../../../modules/${path.posix.basename(path.posix.dirname(p))}';\n`).join('')}export const GET = () => new Response('ok');\nexport const app_${app.name.replace(/-/g, '_')} = 1;\n`);
    }
  }
  if (declaration.profile === 'be') {
    put('src/features/orders/index.ts', `import './orders.module';\nimport './application/place-order.handler';\nexport {};\n`);
    put('src/features/orders/orders.module.ts', 'export {};\n');
    put('src/features/orders/application/place-order.handler.ts', 'export {};\n');
    // The machine judges reachability: the app composes the feature and every required module, so a clean repository is clean to it too.
    const owners = ['src/features/orders/index.ts', ...resolver.requiredPaths().paths.map((entry) => entry.path).filter((p) => /^src\/modules\/[^/]+\/[^/]+\/index\.ts$/.test(p))];
    // An api app is denied by default (throttler, CSRF origin guard, AuthGuard) and masks its errors through the one filter of platform/errors.
    const write = (relative, text) => { const target = path.join(dir, ...relative.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); };
    write('src/modules/platform/errors/index.ts', "export { AllExceptionsFilter } from './all-exceptions.filter';\n");
    write('src/modules/platform/errors/all-exceptions.filter.ts', 'export class AllExceptionsFilter { catch(): void {} }\n');
    write('src/modules/platform/http-security/index.ts', "export { CsrfOriginGuard } from './csrf-origin.guard';\n");
    write('src/modules/platform/http-security/csrf-origin.guard.ts', 'interface RequestHeaders { origin?: string }\ninterface HttpRequest { headers: RequestHeaders }\ninterface HttpHost { getRequest(): HttpRequest }\ninterface GuardContext { switchToHttp(): HttpHost }\nexport class CsrfOriginGuard { canActivate(context: GuardContext): boolean { return context.switchToHttp().getRequest().headers.origin !== undefined; } }\n');
    write('src/modules/domain/identity/index.ts', "export { AuthGuard } from './auth.guard';\n");
    write('src/modules/domain/identity/auth.guard.ts', 'export class AuthGuard { canActivate(): boolean { return true; } }\n');
    write('apps/core/src/app.module.ts', [
      "import { Module } from '@nestjs/common';", "import { APP_FILTER, APP_GUARD } from '@nestjs/core';", "import { ThrottlerGuard } from '@nestjs/throttler';",
      "import { AllExceptionsFilter } from '../../../src/modules/platform/errors';", "import { CsrfOriginGuard } from '../../../src/modules/platform/http-security';",
      "import { AuthGuard } from '../../../src/modules/domain/identity';",
      '@Module({ providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: CsrfOriginGuard }, { provide: APP_GUARD, useClass: AuthGuard }] })',
      'export class AppModule {', '  static register(_options: object) { return { module: AppModule, imports: [], providers: [] }; }', '}', ''].join('\n'));
    write('apps/core/src/core.composition.spec.ts', "import { AppModule } from './app.module';\nit('boots', () => { AppModule.register({}); });\n");
    fs.writeFileSync(path.join(dir, 'apps/core/src/main.ts'), owners.map((file) => `import '../../../${file.replace(/\.ts$/, '')}';`).join('\n') + '\n');
  }
  // Both profiles' tsconfig.json is the managed one (it extends @starci/tsconfig/be.json or next.json, see installTypeScript).
  fs.writeFileSync(path.join(dir, 'README.md'), readmeOf(path.basename(dir), declaration.profile));
  if (declare) fs.writeFileSync(path.join(dir, 'hfs.json'), `${JSON.stringify(declaration, null, 2)}\n`);
  else fs.rmSync(path.join(dir, 'hfs.json'), { force: true });
  return dir;
}

/** Makes the repository's own `typescript` and the `@starci/tsconfig` preset its tsconfig.json extends resolvable (the machine loads both from the checked repository) without tracking them. */
export function installTypeScript(dir) {
  const target = path.join(dir, 'node_modules', 'typescript');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'package.json'), '{"name":"typescript","main":"index.js"}\n');
  fs.writeFileSync(path.join(target, 'index.js'), `module.exports = require(${JSON.stringify(path.resolve(import.meta.dirname, '..', 'node_modules', 'typescript'))});\n`);
  fs.cpSync(path.resolve(import.meta.dirname, '..', 'packages', 'tsconfig'), path.join(dir, 'node_modules', '@starci', 'tsconfig'), { recursive: true, filter: (source) => !source.endsWith('.test.mjs') });
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

/** Installs the coverage preset `hfs sync` and `hfs check` load from a checked back-end repository (a fresh process has no injected presets), without tracking it. */
export function installPresets(dir) {
  fs.cpSync(path.resolve(import.meta.dirname, '..', 'packages', 'jest-preset'), path.join(dir, 'node_modules', '@starci', 'jest-preset'), { recursive: true });
  return dir;
}
