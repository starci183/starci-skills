import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

const externalOpsByRoot = new Map();
/** The ops the catalog (modules/models/kinds.yaml) marks `external: true`: the chat app runs them, the workflow never dispatches them. */
export function externalOpsOf(skillRoot) {
  if (!externalOpsByRoot.has(skillRoot)) {
    const kinds = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'models', 'kinds.yaml'), 'utf8'))?.kinds ?? {};
    externalOpsByRoot.set(skillRoot, new Set(Object.entries(kinds).filter(([, kind]) => kind?.external === true).map(([id, kind]) => kind.operator ?? id)));
  }
  return externalOpsByRoot.get(skillRoot);
}

export function legStatusColorOf({ noRows, inFlight, unresolved, failedRetry, queued, ownerWait, succeeded, rework }) {
  if (noRows()) return 'gray';
  if (inFlight()) return 'yellow';
  if (unresolved()) return 'red';
  if (failedRetry()) return 'red';
  if (queued() || ownerWait()) return 'yellow';
  if (succeeded()) return rework() ? 'red' : 'green';
  return 'red';
}

export function deferredFieldOf(deferred, hasPlanDeferral, plannedReason) {
  if (deferred) return { deferred };
  if (hasPlanDeferral()) return { deferred: plannedReason() };
  return {};
}
