import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND_ROOT, BACKEND_ROOT } from './paths';

/**
 * The product's one runtime projection is `ecommerce-app-be/metadata.json` - the same file
 * `scripts/projection.mjs` and the BE's own AppConfigService resolve every port from, so this
 * harness reads it rather than carrying a second copy that could drift. `ECOMMERCE_APP_BE_METADATA`
 * names the file outright when a run injects a different checkout; otherwise the sibling repo's own
 * file is the answer. A missing or partial projection throws - nothing here invents a number.
 */
export const METADATA_FILE_ENV = 'ECOMMERCE_APP_BE_METADATA';

const projectedPort = (key: 'identityApi' | 'orderApi' | 'landing' | 'shop'): number => {
  const file = process.env[METADATA_FILE_ENV] ?? path.join(BACKEND_ROOT, 'metadata.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { ports?: Record<string, unknown> };
  const port = parsed.ports?.[key];
  if (typeof port !== 'number') {
    throw new Error(`${file} does not carry a numeric ports.${key}; set ${METADATA_FILE_ENV} or the UAT_*_URL env var.`);
  }
  return port;
};

/** The base URL flows navigate to - the shop app; `UAT_BASE_URL` wins, the projection's `shop` is the default. */
export const BASE_URL = process.env.UAT_BASE_URL ?? `http://localhost:${projectedPort('shop')}`;

/** The order service - catalogue/cart/checkout doors; `UAT_ORDER_API_URL` wins, `orderApi` is the default. */
export const ORDER_API_URL = process.env.UAT_ORDER_API_URL ?? `http://localhost:${projectedPort('orderApi')}`;

/** The identity service - register/sign-in/session doors; `UAT_IDENTITY_API_URL` wins, `identityApi` is the default. */
export const IDENTITY_API_URL = process.env.UAT_IDENTITY_API_URL ?? `http://localhost:${projectedPort('identityApi')}`;

/**
 * A run-scoped credential override. `accounts.yaml` in this product's Work tree carries a synthetic
 * disposable `{role, username, password}` pair outright (work-layout.yaml allows a throwaway password
 * on the record itself), so the env var is the override path for a run whose provisioned credential
 * differs - not the only place a password can come from. Nothing here decrypts or stores a real secret.
 */
export const DEMO_PASSWORD = process.env.UAT_DEMO_PASSWORD ?? null;

/**
 * A flow whose steps create or mutate account/session/cart/order rows on a shared database must not
 * be attempted against infrastructure this run does not own. Specs gate those steps on this flag -
 * recorded `observed: 'not-run'` rather than silently faked - and a caller that did boot and own the
 * stack (the dev compose pair, or a run-owned one) flips it via `UAT_LIVE_LOGIN_AUTHORIZED=true`.
 */
export const LIVE_LOGIN_AUTHORIZED = process.env.UAT_LIVE_LOGIN_AUTHORIZED === 'true';

/**
 * Resolves the credential a spec actually submits for one declared role: `UAT_PASSWORD_<ROLE>`
 * (role upper-cased, non-alnum turned into `_`) first, then `UAT_DEMO_PASSWORD`, then the record's
 * own disposable `password` entry - which is honest here because this product's accounts.yaml still
 * authors literal `{role, username, password}` rows (todo's `{role, identity}` refs do not exist in
 * this tree; there is no `_resources` identity record to point at).
 */
export const passwordFor = (role: string, declared: string | null = null): string | null => {
  const specific = process.env[`UAT_PASSWORD_${role.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
  return specific ?? DEMO_PASSWORD ?? declared;
};

const shortSha = (repositoryRoot: string): string | null => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

/** The frontend commit this run served from; null only when the worktree has no git history to read. */
export const frontendCommit = (): string | null => shortSha(FRONTEND_ROOT);

/** The backend commit, read only if that sibling repository is present and readable; never required. */
export const backendCommit = (): string | null => shortSha(BACKEND_ROOT);

/** `<UTC stamp>-<short sha>`, computed once per harness invocation and shared by every flow it runs. */
export const makeRunId = (): string => {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const sha = frontendCommit() ?? 'nogit';
  return `${stamp}-${sha}`;
};

/**
 * `global-setup.ts` computes the run's one runId and stores it in `UAT_RUN_ID` before any worker
 * process starts, so test workers and the reporter (which run as separate processes) read the exact
 * same value instead of each computing their own close-but-different timestamp.
 */
export const currentRunId = (): string => {
  const id = process.env.UAT_RUN_ID;
  if (!id) throw new Error('UAT_RUN_ID is not set; playwright.config.ts must run global-setup.ts before any test.');
  return id;
};
