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
  readonly state: 'todo' | 'inprogress' | 'done' | 'uninvestigate' | string;
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
 * (`grep -rl '^schema: work/uat-flow' examples/ecommerce-app-be/.starciwork`), so a spec file names
 * its own record instead of restating feature/flow path segments inline.
 *
 * `uat.smoke.browse` is NOT a uat-flow record: it is this harness's own rig-proof spec. It binds the
 * `checkout/place-order` node because that record's declared `entry` is `/browse` - the one shop
 * route already connected to a real service read - so its run lands where the surface it exercised
 * is owned. The real `uat.checkout.place-order` walk stays a separate spec for the lane that lands
 * the feature.
 */
export const FLOW_LOCATIONS: ReadonlyArray<FlowLocation> = [
  { id: 'uat.identity.sign-in', feature: 'identity', flow: 'sign-in' },
  { id: 'uat.checkout.place-order', feature: 'checkout', flow: 'place-order' },
  { id: 'uat.smoke.browse', feature: 'checkout', flow: 'place-order' },
];

/** sha256 of the record's own `index.yaml` bytes - the op's `completion.inputDigest`. */
export const recordDigest = (feature: string, flow: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(flowRecordPath(feature, flow))).digest('hex');

/**
 * Reads and parses an existing `work/uat-flow` record; refuses rather than inventing a missing one.
 * `steps` are passed through as authored - this product's records write them as ordered
 * `{order, actor, action, expected, checks}` flow objects, not the flat strings todo's records use.
 */
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
 * Reads the record's own scoped test-account roster. Unlike todo's accounts.yaml - which authors
 * `{role, identity}` refs into a shared `work/resource` identity record - this product has no
 * `_resources` identity records, so its roster carries the literal `{role, username, password}`
 * shape the schema also permits (v7-12 authored it that way deliberately; the passwords are
 * synthetic throwaway pairs for a demo store, never real credentials). The env override path stays
 * in `run-context.ts#passwordFor`, which prefers a provisioned credential when one exists.
 */
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
    password: typeof (entry as any).password === 'string' ? (entry as any).password : '',
  }));
};

/**
 * The reason a blocked flow's spec is `test.skip`, read from the record's own `blockedBy` rather
 * than a literal "screens not implemented" hard-coded here. A `state: todo` record with no
 * `blockedBy` entries at all is a gap in the record, not something this harness may paper over, so
 * that case is reported honestly instead of inventing a blocker the record never declared.
 */
export const skipReason = (record: UatFlowRecord): string => {
  if (record.blockedBy && record.blockedBy.length > 0) {
    return record.blockedBy.map(entry => entry.because ?? `blocked by ${entry.record}`).join(' ');
  }
  return `[gap] ${record.id} is state: ${record.state} but declares no blockedBy entry; ` +
    `the record does not say what is missing, so this harness cannot cite a reason beyond that absence.`;
};
