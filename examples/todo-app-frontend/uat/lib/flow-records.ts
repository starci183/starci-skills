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
  /** Step entries as the record authors them ({order, actor, action, expected, checks}) - kept as
   * objects, not String()'d, so the manifest's flows.json carries the steps a reader can act on
   * instead of "[object Object]" (first seen on run 20260919T183145Z-5c10a673). */
  readonly steps: ReadonlyArray<unknown>;
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
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    proves: Array.isArray(raw.proves) ? raw.proves.map(String) : [],
    blockedBy: Array.isArray(raw.blockedBy)
      ? raw.blockedBy.map(entry => ({ record: String((entry as any).record), because: (entry as any).because }))
      : null,
  };
};

/**
 * Every role the shared `identity.todo-app.demo` resource declares (_resources/identities/todo-app-
 * demo/resource.yaml: person, operator, owner, owner-at-cap, editor, viewer, stranger) resolves to one
 * of the two demo Keycloak users actually seeded by
 * .starcistacks/dev/infra/compose/realm-todo.json (DEMO-ONLY, committed for reader round-trip): the
 * resource lists seven roles but the realm only seeds two concrete accounts, so role -> email is this
 * fixed, small map rather than something accounts.yaml could name on its own once it moved from
 * literal `{role, username, password}` entries to `{role, identity}` refs into the shared resource.
 * 'viewer'/'stranger' get the second seeded user so a flow needing two distinct identities (task's
 * owner/stranger) gets two distinct real logins; every other role reuses the first.
 *
 * Fixed in the v9-5 lane: 'editor' also resolves to the second seeded user - share's
 * invite-and-collaborate flow needs owner != editor, and mapping editor onto the owner's own account
 * would have signed the "invited person" in as the owner themselves. The realm still seeds only two
 * accounts, so editor and viewer share the same second login; no spec may sign in two distinct
 * invitees until a third user is seeded (see uat.share.invite-and-collaborate's own notes).
 */
const ROLE_EMAIL: Readonly<Record<string, string>> = {
  person: 'demo@todo.dev',
  operator: 'demo@todo.dev',
  owner: 'demo@todo.dev',
  'owner-at-cap': 'demo@todo.dev',
  editor: 'demo2@todo.dev',
  viewer: 'demo2@todo.dev',
  stranger: 'demo2@todo.dev',
};

/**
 * Reads the record's own scoped test-account roster and resolves each `{role, identity}` ref to a real
 * seeded username via `ROLE_EMAIL` above. The password is never read from this file (see `ROLE_EMAIL`'s
 * note and `run-context.ts#passwordFor`, which resolves it from the environment instead) - `password`
 * stays on `DisposableAccount` only for shape compatibility and is always the empty string here.
 *
 * Fixed in this lane: this previously read `entry.username`/`entry.password` directly, which matched
 * an older accounts.yaml shape; every accounts.yaml under examples/todo-app-backend/.starciwork now
 * authors `{role, identity}` (see work-layout.yaml's uatFlow shape note), so those two fields were
 * always `String(undefined)` - the literal text "undefined" - and every flow that called this would
 * have typed that into a real sign-in form instead of a real email.
 */
export const readAccounts = (feature: string, flow: string): ReadonlyArray<DisposableAccount> => {
  const file = flowAccountsPath(feature, flow);
  if (!fs.existsSync(file)) return [];
  const raw = parseYaml(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  if (!raw || raw.schema !== 'work/disposable-accounts' || !Array.isArray(raw.accounts)) {
    throw new Error(`${file} is not a work/disposable-accounts record; refusing to invent one.`);
  }
  return raw.accounts.map(entry => {
    const role = String((entry as any).role);
    const email = ROLE_EMAIL[role];
    if (!email) throw new Error(`${file}: no seeded demo user is known for role "${role}"; add it to ROLE_EMAIL.`);
    return { role, username: email, password: '' };
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
