import fs from 'node:fs';
import crypto from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { flowAccountsPath, flowRecordPath } from './paths';

/** One entry of an existing `work/disposable-accounts@1` sibling file. */
export type DisposableAccount = {
  readonly role: string;
  readonly username: string;
  readonly password: string;
};

/** The shape this harness reads back out of an existing `work/uat-flow` record. */
export type UatFlowRecord = {
  readonly id: string;
  readonly title: string;
  readonly state: 'todo' | 'done' | string;
  readonly steps: ReadonlyArray<string>;
  readonly proves: ReadonlyArray<string>;
  readonly blockedBy: ReadonlyArray<{ record: string; because?: string }> | null;
};

/** The one registry entry a flow spec imports to find its own record on disk. */
export type FlowLocation = {
  readonly id: string;
  readonly feature: string;
  readonly flow: string;
};

/**
 * Every existing `work/uat-flow` record under the backend's `.starciwork`
 * (`grep -rl '^schema: work/uat-flow' examples/todo-app-backend/.starciwork`), so a spec file names its
 * own record instead of restating feature/flow path segments inline.
 */
export const FLOW_LOCATIONS: ReadonlyArray<FlowLocation> = [
  { id: 'uat.login.sign-in', feature: 'login', flow: 'sign-in' },
  { id: 'uat.task.create', feature: 'task', flow: 'create' },
  { id: 'uat.audit.right-to-be-forgotten', feature: 'audit', flow: 'right-to-be-forgotten' },
  { id: 'uat.notify.digest-and-unsubscribe', feature: 'notify', flow: 'digest-and-unsubscribe' },
  { id: 'uat.plan.upgrade-after-cap', feature: 'plan', flow: 'upgrade-after-cap' },
  { id: 'uat.recur.make-recurring', feature: 'recur', flow: 'make-recurring' },
  { id: 'uat.share.invite-and-collaborate', feature: 'share', flow: 'invite-and-collaborate' },
];

/** sha256 of the record's own `index.yaml` bytes - the op's `completion.inputDigest`. */
export const recordDigest = (feature: string, flow: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(flowRecordPath(feature, flow))).digest('hex');

/** Reads and parses an existing `work/uat-flow` record; refuses rather than inventing a missing one. */
export const readFlowRecord = (feature: string, flow: string): UatFlowRecord => {
  const file = flowRecordPath(feature, flow);
  const raw = parseYaml(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  if (!raw || raw.schema !== 'work/uat-flow' || typeof raw.id !== 'string') {
    throw new Error(`${file} is not a work/uat-flow record; refusing to invent one.`);
  }
  return {
    id: raw.id,
    title: String(raw.title ?? ''),
    state: String(raw.state ?? ''),
    steps: Array.isArray(raw.steps) ? raw.steps.map(String) : [],
    proves: Array.isArray(raw.proves) ? raw.proves.map(String) : [],
    blockedBy: Array.isArray(raw.blockedBy)
      ? raw.blockedBy.map(entry => ({ record: String((entry as any).record), because: (entry as any).because }))
      : null,
  };
};

/**
 * Both shipped accounts.yaml records (login/sign-in, task/create) carry `{role, identity}`, not the
 * `{role, username, password}` shape this file originally assumed - `identity` names a shared
 * `work/resource` (e.g. `identity.todo-app.demo`), which is exactly what operator.yaml's `accounts` read
 * says this harness must resolve ("Resolve an existing suitable test account..."), not a literal login.
 * The one identity resource this example ships lists abstract roles it can play (person, owner,
 * stranger, ...) but never differentiates a concrete seeded row per role, while the realm
 * (.starcistacks/dev/infra/compose/realm-todo.json) only actually seeds two people: demo@todo.dev and
 * demo2@todo.dev. Task/create's `owner` and `stranger` both name the same identity yet must be two
 * distinct signed-in people for the ownership check to mean anything, so this harness treats
 * demo@todo.dev as that identity's default row and demo2@todo.dev as its second row for any role that
 * must differ from another role in the same flow - the exact distinction
 * scripts/live-proof.sh already relies on for its own br.task.list.owned check. This is a harness-side
 * resolution, not a fix to accounts.yaml itself: the record still only names an identity, and a caller
 * with a different real mapping may override any role via `UAT_USERNAME_<ROLE>`.
 */
const SEEDED_ROWS_BY_IDENTITY: Readonly<Record<string, { readonly primary: string; readonly secondary: string }>> = {
  'identity.todo-app.demo': { primary: 'demo@todo.dev', secondary: 'demo2@todo.dev' },
};

/** Roles that must resolve to the identity's *second* seeded row, so they differ from a co-occurring primary role. */
const SECOND_ROW_ROLES = new Set(['stranger']);

const usernameForIdentity = (identity: string, role: string): string => {
  const override = process.env[`UAT_USERNAME_${role.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
  if (override) return override;
  const rows = SEEDED_ROWS_BY_IDENTITY[identity];
  if (!rows) {
    throw new Error(
      `No known seeded username for identity "${identity}" (role "${role}"); set UAT_USERNAME_${role.toUpperCase()}.`,
    );
  }
  return SECOND_ROW_ROLES.has(role) ? rows.secondary : rows.primary;
};

/** Reads the record's own scoped test-account roster; the password field here is never used at runtime. */
export const readAccounts = (feature: string, flow: string): ReadonlyArray<DisposableAccount> => {
  const file = flowAccountsPath(feature, flow);
  if (!fs.existsSync(file)) return [];
  const raw = parseYaml(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  if (!raw || raw.schema !== 'work/disposable-accounts' || !Array.isArray(raw.accounts)) {
    throw new Error(`${file} is not a work/disposable-accounts record; refusing to invent one.`);
  }
  return raw.accounts.map(entry => {
    const role = String((entry as any).role);
    const literalUsername = (entry as any).username;
    const identity = (entry as any).identity;
    const username =
      literalUsername !== undefined
        ? String(literalUsername)
        : identity !== undefined
          ? usernameForIdentity(String(identity), role)
          : (() => {
              throw new Error(`${file}: account for role "${role}" declares neither username nor identity.`);
            })();
    return {
      role,
      username,
      password: (entry as any).password !== undefined ? String((entry as any).password) : '',
    };
  });
};

/**
 * The reason a blocked flow's spec is `test.skip`, read from the record's own `blockedBy` rather than a
 * literal "screens not implemented" hard-coded here. `uat.recur.make-recurring` is `state: todo` with no
 * `blockedBy` entries at all - a gap in the record, not something this harness may paper over - so that
 * one case is reported honestly instead of inventing a blocker the record never declared.
 */
export const skipReason = (record: UatFlowRecord): string => {
  if (record.blockedBy && record.blockedBy.length > 0) {
    return record.blockedBy.map(entry => entry.because ?? `blocked by ${entry.record}`).join(' ');
  }
  return `[gap] ${record.id} is state: ${record.state} but declares no blockedBy entry; ` +
    `the record does not say what is missing, so this harness cannot cite a reason beyond that absence.`;
};
