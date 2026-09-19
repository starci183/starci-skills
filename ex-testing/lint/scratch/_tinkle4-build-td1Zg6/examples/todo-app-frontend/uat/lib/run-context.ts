import { execFileSync } from 'node:child_process';
import { FRONTEND_ROOT, BACKEND_ROOT } from './paths';

/** The base URL flows navigate to; `UAT_BASE_URL` defaults to the port convention's frontend port. */
export const BASE_URL = process.env.UAT_BASE_URL ?? 'http://localhost:3000';

/**
 * The demo person's password. Never a literal in this harness - `work-layout.yaml` allows
 * `accounts.yaml` to carry a synthetic disposable password for the Work record itself, but the
 * credential this harness actually submits to a running app comes from the environment alone, exactly
 * as ops/uat.verify/operator.yaml's `accounts` read requires ("Resolve credentials at use time ...
 * never in tracked source or evidence"). In a real run this is exported by `with-dev-secrets` from the
 * SOPS-encrypted demo env; nothing here decrypts or stores it.
 */
export const DEMO_PASSWORD = process.env.UAT_DEMO_PASSWORD ?? null;

/**
 * This lane does not own Keycloak or Postgres for this product (another lane's compose stack is up and
 * must not be started, stopped or written to by this harness) and was authorized only to use a
 * reachable shared API "read-only" for the sign-in refusal check. A step that would need a *successful*
 * sign-in - creating a session row on that shared, other-owned database - is therefore out of this
 * harness's authority in this environment, independent of whether the demo credential is technically
 * known. Flows gate those steps on this flag rather than attempting them and silently mutating shared
 * state; a caller that does own its own stack flips it via `UAT_LIVE_LOGIN_AUTHORIZED=true`.
 */
export const LIVE_LOGIN_AUTHORIZED = process.env.UAT_LIVE_LOGIN_AUTHORIZED === 'true';

/**
 * `accounts.yaml` can declare more than one role (task/create's owner + stranger), but this harness was
 * told to read exactly one credential out of the environment (`UAT_DEMO_PASSWORD`, documented as the
 * SOPS demo env's password). For a single-role flow that is unambiguous; for a multi-role flow it is a
 * real gap the record and the task never resolved, so a caller that has actually provisioned distinct
 * per-role passwords may set `UAT_PASSWORD_<ROLE>` (role upper-cased, non-alnum turned into `_`) to
 * disambiguate. Absent that, every role falls back to the one demo password, which is only correct when
 * the flow truly has one account.
 */
export const passwordFor = (role: string): string | null => {
  const specific = process.env[`UAT_PASSWORD_${role.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
  return specific ?? DEMO_PASSWORD;
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
