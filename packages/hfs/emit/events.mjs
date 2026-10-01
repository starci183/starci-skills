/**
 * The async contract of a service: `contracts/<app>/events.json`, emitted from the literal `EVENTS` table of
 * `apps/<app>/src/events.ts` (the events the service publishes: stream, version, payload fields). Nothing is executed: the
 * table is read as a TypeScript syntax tree with the repository's own `typescript`. The reader and the printer are the runtime's
 * (`scripts/lib/event-contract.mjs`), so `hfs check` (R131 HFS_EVENT_CONTRACT) compares the committed file with exactly this text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readEvents, snapshotText } from '../runtime/scripts/lib/event-contract.mjs';

/** The repository-relative path of a service's event table. */
export const eventsPath = (app) => `apps/${app}/src/events.ts`;

/** The repository-relative path of a service's event contract. */
export const eventsSnapshotPath = (app) => `contracts/${app}/events.json`;

/** The text of the event contract of `app`, or null when the app declares no `events.ts`; a table that is not a literal throws. */
export function emitEvents({ repoRoot, app }) {
  const file = path.join(repoRoot, eventsPath(app));
  if (!fs.existsSync(file)) return null;
  const ts = createRequire(path.join(repoRoot, 'package.json'))('typescript');
  const { events, problems } = readEvents(ts, fs.readFileSync(file, 'utf8'));
  if (problems.length > 0) throw new Error(`hfs emit-contracts: ${eventsPath(app)} is not a literal event table: ${problems.join('; ')}`);
  return snapshotText(app, events);
}
