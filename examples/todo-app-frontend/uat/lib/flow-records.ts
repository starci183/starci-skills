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

/** Reads the record's own scoped test-account roster; the password field here is never used at runtime. */
export const readAccounts = (feature: string, flow: string): ReadonlyArray<DisposableAccount> => {
  const file = flowAccountsPath(feature, flow);
  if (!fs.existsSync(file)) return [];
  const raw = parseYaml(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  if (!raw || raw.schema !== 'work/disposable-accounts' || !Array.isArray(raw.accounts)) {
    throw new Error(`${file} is not a work/disposable-accounts record; refusing to invent one.`);
  }
  return raw.accounts.map(entry => ({
    role: String((entry as any).role),
    username: String((entry as any).username),
    password: String((entry as any).password),
  }));
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
