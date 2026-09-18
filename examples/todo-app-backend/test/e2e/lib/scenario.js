'use strict';

/**
 * One registry entry, one `it`. The test title is exactly the assertion id, so `npm run test:e2e --
 * <group>` runs every assertion of that group, and an assertion the registry lists with no scenario
 * behind it is a hard failure of the run rather than a silent gap (assertImplemented below).
 *
 * Two outcomes are deliberately kept apart:
 *  - `notRun` on a registry entry means the assertion cannot be exercised at the public door at all. The
 *    scenario says so and fails, so the check command's exit code cannot be read as a pass.
 *  - `unproven` means the scenario runs and holds, but a named clause of the same statement has no
 *    public proof surface. That clause is written into the journal and reported, never counted as proven.
 */

const journal = require('./journal');
const client = require('./client');
const { lookup, groupAssertions } = require('./registry');

class NotRunError extends Error {
  constructor(assertionId, reason) {
    super(`NOT-RUN ${assertionId}: ${reason}`);
    this.name = 'NotRunError';
    this.assertionId = assertionId;
  }
}

function record(entry, groupId, outcome, steps, detail) {
  journal.appendJsonl('readback.jsonl', {
    assertionId: entry.id,
    group: groupId,
    record: entry.record,
    command: entry.command,
    statement: entry.statement,
    request: entry.request,
    expect: entry.expect,
    unproven: entry.unproven ?? [],
    outcome,
    detail: detail ?? null,
    notRunReason: entry.notRun ?? null,
    steps,
  });
}

function scenario(groupId, assertionId, implement) {
  const entry = lookup(groupId, assertionId);
  if (!entry) throw new Error(`scenario() names ${assertionId} under ${groupId}, which the frozen registry does not list`);
  implementedFor(groupId).push(assertionId);

  it(assertionId, async () => {
    const steps = client.beginSteps();
    if (entry.notRun) {
      record(entry, groupId, 'not-run', steps);
      throw new NotRunError(assertionId, entry.notRun);
    }
    try {
      await implement({ entry, steps });
      record(entry, groupId, 'pass', steps);
    } catch (error) {
      record(entry, groupId, 'fail', steps, String(error?.message ?? error).slice(0, 2000));
      throw error;
    }
  });
}

const implemented = new Map();

function implementedFor(groupId) {
  if (!implemented.has(groupId)) implemented.set(groupId, []);
  return implemented.get(groupId);
}

/** Called at the end of each spec file: fails the run if the registry lists an assertion for this group
 * that no scenario was written for, so an assertion cannot be dropped by simply not implementing it. */
function assertImplemented(groupId) {
  const done = new Set(implementedFor(groupId));
  const missing = groupAssertions(groupId).filter((assertion) => !done.has(assertion.id));
  if (!missing.length) return;
  describe(`${groupId} coverage`, () => {
    for (const assertion of missing) {
      it(assertion.id, () => {
        const reason = assertion.notRun ?? 'no scenario implements this registered assertion';
        record(assertion, groupId, 'not-run', [], reason);
        throw new NotRunError(assertion.id, reason);
      });
    }
  });
}

module.exports = { scenario, assertImplemented, NotRunError };
