#!/usr/bin/env node
// check-event-spill.mjs — RT_EVENT_SPILL_BYPASS (part of `npm run check`).
//   runs in the check stage (self-check event-spill); --json prints the findings as JSON
//
// A ledger event payload that grows with its input (a file list, a manifest, a critique, a menu) goes to the blob store through ONE path: appendEvent
// (engine/db/ledger.mjs) records it with engine/db/event-compact.mjs eventPayloadRecord, which keeps a bounded inline view and the whole payload behind
// events.payload_sha. The 16 KiB inline bound refused two writers before this check (a Kernel launch admission, a read-plan attestation); each had its own spill.
// This check refuses a runtime source file other than those two that spills by hand: a `payloadSha` passed to a write, the TOO_LARGE catch that pairs with one,
// or a direct INSERT into the events table. Readers go through engine/db/event-payload.mjs.
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings, scopeFilter } from '../lib/check-scan.mjs';
import { trackedSources } from './lib/tracked-sources.mjs';

export const CODE = 'RT_EVENT_SPILL_BYPASS';
export const OWNER_FILES = Object.freeze(['engine/db/ledger.mjs', 'engine/db/event-compact.mjs']);
export const SELF_FILES = Object.freeze(['scripts/checks/check-event-spill.mjs', 'tests/checks/check-event-spill.spec.mjs']);
const inScope = scopeFilter({ scope: /^(?:scripts|engine|ui|ext)\//, ext: /\.(?:mjs|cjs|js)$/, out: /node_modules\/|\/dist\/|^packages\/|\.spec\./, exclude: [...OWNER_FILES, ...SELF_FILES] });
const BYPASS = [
  { re: /\bpayloadSha\s*[:,)}]/, what: 'passes payloadSha to a write' },
  { re: /\b(?:filesSha|storeList)\b/, what: 'stores a list by hand and references its sha from an event' },
  { re: /STARCI_EVENT_PAYLOAD_TOO_LARGE/, what: 'catches the payload-too-large refusal to spill by hand' },
  { re: /INSERT\s+INTO\s+events\b|insertRow\(\s*db\s*,\s*['"]events['"]/i, what: 'inserts into the events table directly' },
];

/** The findings over `files` ({relativePath: text}). Pure. */
export function eventSpillFindings(files) {
  return Object.entries(files).filter(([rel]) => inScope(rel)).flatMap(([rel, text]) => BYPASS.filter((rule) => rule.re.test(text))
    .map((rule) => ({ code: CODE, path: rel, message: `${rel} ${rule.what}: a ledger event payload spills to the blob store only inside appendEvent (engine/db/event-compact.mjs eventPayloadRecord)` })));
}

/** Run the check on the runtime at `root`. */
export const checkEventSpill = (root = skillRoot) => eventSpillFindings(trackedSources(root, inScope));

if (isMain(import.meta.url)) process.exit(printFindings(checkEventSpill(), 'OK: every ledger event payload spills through appendEvent only.'));
