// One repository and one TypeScript program cover every default-deny scenario. Each scenario is an independent api app,
// so the real architecture machine still resolves and judges every guard chain while avoiding a fresh repository/program
// for every assertion. The returned findings are immutable slices of that one report; tests never mutate shared state.
import { archFixture, runArch, findings } from './hfs-arch-be-fixture.mjs';

const TIER_GUARDS = [
  "import { SetMetadata } from '@nestjs/common';",
  "const TIER_KEY = 'tier';",
  "const STRAY_KEY = 'stray';",
  'export const RateLimit = (tier: string) => SetMetadata(TIER_KEY, tier);',
  'interface Reader { getAllAndOverride(key: string, targets: unknown[]): unknown }',
  'export class TierGuard { constructor(private readonly reader: Reader) {} canActivate(): boolean { return this.reader.getAllAndOverride(TIER_KEY, []) !== undefined; } }',
  'export class PlainGuard { canActivate(): boolean { return true; } }',
  'export class StrayTierGuard { constructor(private readonly reader: Reader) {} canActivate(): boolean { return this.reader.getAllAndOverride(STRAY_KEY, []) !== undefined; } }',
  '',
].join('\n');

const SHARED_FILES = {
  'src/modules/platform/http-security/index.ts': "export { CsrfOriginGuard } from './csrf-origin.guard';\nexport { AppThrottlerGuard } from './app-throttler.guard';\nexport { PlainGuard, StrayTierGuard, TierGuard } from './tier.guard';\n",
  'src/modules/platform/http-security/csrf-origin.guard.ts': 'export class CsrfOriginGuard { canActivate(context: { headers: { origin?: string } }): boolean { return context.headers.origin !== undefined; } }\n',
  'src/modules/platform/http-security/app-throttler.guard.ts': "import { ThrottlerGuard } from '@nestjs/throttler';\nexport class AppThrottlerGuard extends ThrottlerGuard {}\n",
  'src/modules/platform/http-security/tier.guard.ts': TIER_GUARDS,
  'src/modules/domain/identity/index.ts': "export { AuthGuard } from './auth.guard';\nexport { Lookalike } from './lookalike';\n",
  'src/modules/domain/identity/auth.guard.ts': 'export class AuthGuard { canActivate(): boolean { return true; } }\n',
  'src/modules/domain/identity/lookalike.ts': 'export class Lookalike { canActivate(): boolean { return true; } }\n',
};

const appModule = guards => `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppThrottlerGuard, CsrfOriginGuard, PlainGuard, StrayTierGuard, TierGuard } from '../../../src/modules/platform/http-security';
import { AuthGuard, Lookalike } from '../../../src/modules/domain/identity';
@Module({ providers: [${guards.map(name => `{ provide: APP_GUARD, useClass: ${name} }`).join(', ')}] })
export class AppModule {}
`;

const helper = guards => `import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CsrfOriginGuard } from '../../../src/modules/platform/http-security';
import { AuthGuard } from '../../../src/modules/domain/identity';
export const guardChain = () => [${guards.map(name => `{ provide: APP_GUARD, useClass: ${name} }`).join(', ')}];
export const GUARD_PROVIDERS = [${guards.map(name => `{ provide: APP_GUARD, useClass: ${name} }`).join(', ')}];
`;

const rootUsingHelper = use => `import { Module } from '@nestjs/common';
import { guardChain, GUARD_PROVIDERS } from './guard-chain';
@Module({ providers: [${use}] })
export class AppModule {}
`;

const scenarios = [
  ['good-package', ['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard']],
  ['good-subclass', ['AppThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard']],
  ['good-tier', ['TierGuard', 'CsrfOriginGuard', 'AuthGuard']],
  ['good-extra', ['ThrottlerGuard', 'Lookalike', 'CsrfOriginGuard', 'AuthGuard']],
  ['missing-throttler', ['CsrfOriginGuard', 'AuthGuard']],
  ['missing-csrf', ['ThrottlerGuard', 'AuthGuard']],
  ['missing-auth', ['ThrottlerGuard', 'CsrfOriginGuard']],
  ['missing-all', []],
  ['auth-lookalike', ['ThrottlerGuard', 'CsrfOriginGuard', 'Lookalike']],
  ['reordered-auth-first', ['AuthGuard', 'ThrottlerGuard', 'CsrfOriginGuard']],
  ['reordered-auth-middle', ['ThrottlerGuard', 'AuthGuard', 'CsrfOriginGuard']],
  ['repeated-auth', ['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard', 'AuthGuard']],
  ['swapped-http-security', ['CsrfOriginGuard', 'TierGuard', 'AuthGuard']],
  ['not-throttler-plain', ['PlainGuard', 'CsrfOriginGuard', 'AuthGuard']],
  ['not-throttler-stray', ['StrayTierGuard', 'CsrfOriginGuard', 'AuthGuard']],
  ['helper-call-good', ['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard'], '...guardChain()'],
  ['helper-call-missing', ['ThrottlerGuard', 'CsrfOriginGuard'], '...guardChain()'],
  ['helper-call-reordered', ['AuthGuard', 'ThrottlerGuard', 'CsrfOriginGuard'], '...guardChain()'],
  ['helper-spread-good', ['ThrottlerGuard', 'CsrfOriginGuard', 'AuthGuard'], '...GUARD_PROVIDERS'],
  ['helper-spread-missing', ['ThrottlerGuard', 'CsrfOriginGuard'], '...GUARD_PROVIDERS'],
  ['helper-spread-reordered', ['AuthGuard', 'ThrottlerGuard', 'CsrfOriginGuard'], '...GUARD_PROVIDERS'],
];

export const scenarioCount = scenarios.length;

export function defaultDenyFixture(registerCleanup) {
  const files = { ...SHARED_FILES };
  for (const [name, guards, use] of scenarios) {
    files[`apps/${name}/src/main.ts`] = 'void 0;\n';
    files[`apps/${name}/src/app.module.ts`] = use ? rootUsingHelper(use) : appModule(guards);
    if (use) files[`apps/${name}/src/guard-chain.ts`] = helper(guards);
  }
  const root = archFixture({ after: registerCleanup }, {
    apps: scenarios.map(([name]) => ({ name, kind: 'api' })),
    files,
  });
  const report = runArch(root);
  const all = findings(report, 'BE_DEFAULT_DENY');
  const byApp = new Map(scenarios.map(([name]) => [name, Object.freeze(all.filter(item => item.app === name))]));
  return Object.freeze({
    report,
    hits: name => byApp.get(name),
  });
}
