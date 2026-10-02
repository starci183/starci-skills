/**
 * The async contract of a service: `contracts/<service>/events.json`, emitted from the typed event classes of the service,
 * `src/modules/events/<service>/<event>.event.ts` (name, version, `compensates`, the payload fields of the interface `create` takes).
 * Nothing is executed: the classes are read as a TypeScript syntax tree with the repository's own `typescript`. The reader and the
 * printer are the runtime's (`scripts/lib/event-contract.mjs`), so `hfs check` (R166 HFS_EVENT_CONTRACT) compares the committed file
 * with exactly this text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readEventClasses, snapshotText } from '../runtime/scripts/lib/event-contract.mjs';

const EVENTS_ROOT = 'src/modules/events';
const EVENT_SUFFIX = '.event.ts';

/** The repository-relative path of a service's event contract. */
export const eventsSnapshotPath = (service) => `contracts/${service}/events.json`;

/** The services that declare event classes under `src/modules/events/<service>/`. */
export function eventServices(repoRoot) {
  const root = path.join(repoRoot, EVENTS_ROOT);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

/** The text of the event contract of `service`, or null when it declares no event class; a class that cannot be read throws. */
export function emitEvents({ repoRoot, service }) {
  const folder = path.join(repoRoot, EVENTS_ROOT, service);
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith(EVENT_SUFFIX)).sort() : [];
  if (files.length === 0) return null;
  const ts = createRequire(path.join(repoRoot, 'package.json'))('typescript');
  const events = [];
  const problems = [];
  for (const name of files) {
    const read = readEventClasses(ts, fs.readFileSync(path.join(folder, name), 'utf8'), name);
    events.push(...read.events);
    problems.push(...read.problems.map((problem) => `${name}: ${problem}`));
  }
  if (problems.length > 0) throw new Error(`hfs emit-contracts: the event classes of ${service} cannot be read: ${problems.join('; ')}`);
  return snapshotText(service, events);
}
