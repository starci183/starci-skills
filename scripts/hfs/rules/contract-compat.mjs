// contract-compat.mjs - event contracts evolve only additively (BE_CONTRACT_BREAKING, R177).
//
// A service publishes its events in `be/contracts/<service>/events.json` (the vendored snapshot hfs emits from the service's event table).
// The previous published contract is pinned beside it as `be/contracts/<service>/events.pin.json` (the same format, copied when a contract is
// published). The current snapshot is compared with its pin, event by event:
//   - every pinned event still exists under the same key, with the same `stream` and `version`;
//   - every pinned payload field still exists with the same type and the same optionality (`<type>` or `<type>?`);
//   - a field that is new is optional (events already on the wire do not carry it);
//   - any other member the pinned event declared (for example `compensates`) is unchanged.
// Anything else is a breaking change: it needs a NEW event key `<event>.v2` next to the old one, which stays until its consumers have moved.
// A new event, and a new optional field, are additive and pass. A service with no pin is not judged (the pin is opt-in per service).
import path from 'node:path';
import { isPlainObject } from '../../../engine/plain-object.mjs';
import { found, readJson } from './read.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

export const CONTRACT_BREAKING = 'BE_CONTRACT_BREAKING';

const CONTRACTS = /^be\/contracts\/([^/]+)\/events\.pin\.json$/;

const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort(byCodeUnit).map((key) => [key, sortKeys(value[key])]));
}
/** {type, optional} of a payload field spelling (`string`, `number?`, `string[]`). */
const fieldOf = (spelling) => (typeof spelling === 'string' && spelling.endsWith('?') ? { type: spelling.slice(0, -1), optional: true } : { type: spelling, optional: false });

/** The breaking changes of `current` against `pinned`: [{event, message}]. */
export function breakingChanges(pinned, current) {
  const problems = [];
  const pinnedEvents = isPlainObject(pinned?.events) ? pinned.events : {};
  const currentEvents = isPlainObject(current?.events) ? current.events : {};
  for (const [name, before] of Object.entries(pinnedEvents)) {
    const after = currentEvents[name];
    if (!isPlainObject(after)) { problems.push({ event: name, message: `event ${name} was removed; a published event is never deleted while it can still be on the wire. Keep it, and add ${name}.v2 for the new shape.` }); continue; }
    for (const key of Object.keys(before)) {
      if (key === 'payload') continue;
      if (!same(before[key], after[key])) problems.push({ event: name, message: `event ${name} changed its ${key} from ${JSON.stringify(before[key])} to ${JSON.stringify(after[key] ?? null)}; a published event keeps its ${key}. Add ${name}.v2 for the new shape.` });
    }
    const was = isPlainObject(before.payload) ? before.payload : {};
    const now = isPlainObject(after.payload) ? after.payload : {};
    for (const [field, spelling] of Object.entries(was)) {
      if (!(field in now)) { problems.push({ event: name, message: `event ${name} lost payload field ${field}; fields are only ever added. Keep it, and add ${name}.v2 for the new shape.` }); continue; }
      const a = fieldOf(spelling);
      const b = fieldOf(now[field]);
      if (a.type !== b.type) problems.push({ event: name, message: `event ${name} changed payload field ${field} from ${a.type} to ${b.type}; a field keeps its type. Add ${name}.v2 for the new shape.` });
      else if (a.optional !== b.optional) problems.push({ event: name, message: `event ${name} changed payload field ${field} from ${a.optional ? 'optional' : 'required'} to ${b.optional ? 'optional' : 'required'}; a field keeps its optionality. Add ${name}.v2 for the new shape.` });
    }
    for (const [field, spelling] of Object.entries(now)) {
      if (!(field in was) && !fieldOf(spelling).optional) problems.push({ event: name, message: `event ${name} gained required payload field ${field}; events already on the wire do not carry it, so a new field is optional (${field}?). Make it optional, or add ${name}.v2.` });
    }
  }
  return problems;
}

/** R177: the findings of every service whose contract is pinned. `files` are the repository-relative tracked paths. */
export function contractCompatFindings({ repoRoot, files }) {
  const findings = [];
  for (const rel of [...files].sort(byCodeUnit)) {
    const match = CONTRACTS.exec(rel);
    if (!match) continue;
    const current = `be/contracts/${match[1]}/events.json`;
    const pinned = readJson(repoRoot, rel);
    const snapshot = readJson(repoRoot, current);
    if (!isPlainObject(pinned) || !isPlainObject(pinned.events)) { findings.push(found(CONTRACT_BREAKING, rel, `${rel} is not a readable event contract (an object with an events table); copy a published ${path.posix.basename(current)} over it.`)); continue; }
    if (!isPlainObject(snapshot) || !isPlainObject(snapshot.events)) { findings.push(found(CONTRACT_BREAKING, current, `${current} is missing or unreadable while ${rel} pins the contract of service ${match[1]}; the contract of a published service is never dropped. Emit it again.`)); continue; }
    for (const { event, message } of breakingChanges(pinned, snapshot)) findings.push(found(CONTRACT_BREAKING, current, `${current}: ${message}`, { event, service: match[1] }));
  }
  return findings;
}
