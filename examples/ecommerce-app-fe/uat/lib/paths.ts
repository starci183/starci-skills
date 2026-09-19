import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The harness lives inside the frontend repository (`examples/ecommerce-app-fe/uat`), which is the
 * "selected automation source scope" ops/uat.verify/operator.yaml asks for. Its evidence, though, is
 * owned by the backend's `.starciwork` (schemas/work-layout.yaml: "One project owns one canonical
 * .starciwork in its bound source repository"; for this two-repository product that repository is the
 * backend, `examples/ecommerce-app-be`). Every path below is resolved from this file's own location so
 * it holds regardless of the process's current working directory.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** `examples/ecommerce-app-fe` - the repository this harness's own tests and config live in. */
export const FRONTEND_ROOT = path.resolve(HERE, '..', '..');

/** `examples/ecommerce-app-be` - the sibling repository that owns `.starciwork`. */
export const BACKEND_ROOT = path.resolve(FRONTEND_ROOT, '..', 'ecommerce-app-be');

/** The one canonical Work tree this product's UAT evidence is written into. */
export const WORK_ROOT = path.join(BACKEND_ROOT, '.starciwork');

/** `.starciwork/features/<feature>/uat/<flow>` - the node directory an existing uat-flow record owns. */
export const flowNodeDir = (feature: string, flow: string): string =>
  path.join(WORK_ROOT, 'features', feature, 'uat', flow);

/** The existing record's own `index.yaml`, read-only to this harness. */
export const flowRecordPath = (feature: string, flow: string): string =>
  path.join(flowNodeDir(feature, flow), 'index.yaml');

/** The existing record's `accounts.yaml` sibling, read-only to this harness. */
export const flowAccountsPath = (feature: string, flow: string): string =>
  path.join(flowNodeDir(feature, flow), 'accounts.yaml');

/** `.starciwork/features/<feature>/uat/<flow>/runs/<runId>` - this run's own append-only evidence folder. */
export const runDir = (feature: string, flow: string, runId: string): string =>
  path.join(flowNodeDir(feature, flow), 'runs', runId);
