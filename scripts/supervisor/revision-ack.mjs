#!/usr/bin/env node
// starci supervisor revision-ack — read the files a runtime revision change sends to the Supervisor and attest them (modules/kernel/revision-scope.yaml).
//
//   starci supervisor revision-ack --plan [--json]                       the files owed (with hashes), or nothing
//   starci supervisor revision-ack --rev <sha> --read-manifest <file>    attest the manifest --plan returned, after reading every file
import fs from 'node:fs';
import { withMachine } from '../../engine/db/machine.mjs';
import { isMain } from '../lib/is-main.mjs';
import { arg } from '../lib/cli-arg.mjs';
import { attest, planRead } from '../machine/revision-ack.mjs';
import { supervisorSeat } from '../machine/revision-seats.mjs';
import { resolveRev, revRootOf } from '../kernel/runtime-rev.mjs';

/** The answer of one revision-ack call over the machine handle `m`: {ok, ...} or a refusal {ok: false, code, error}. */
export function revisionAck(m, { plan = false, rev = null, manifestFile = null } = {}) {
  const seat = supervisorSeat({ m, root: revRootOf() });
  if (plan) {
    const { notice, manifest } = planRead(seat);
    return { ok: true, state: notice.state, readManifest: manifest };
  }
  try {
    if (resolveRev(seat.root, String(rev)) !== seat.current) return { ok: false, code: 'supervisor-rev-unknown', error: 'the revision is not the current deployed commit' };
    const done = attest(seat, JSON.parse(fs.readFileSync(String(manifestFile), 'utf8')));
    return { ok: true, rev: seat.current, count: done.manifest.files.length, filesSha: done.filesSha };
  } catch (error) { return { ok: false, code: error.code ?? 'revision-read-unverified', error: String(error?.message ?? error) }; }
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const plan = argv.includes('--plan');
  if (!plan && !(arg(argv, 'rev') && arg(argv, 'read-manifest'))) {
    console.error('use: starci supervisor revision-ack --plan | --rev <sha> --read-manifest <file> [--json]');
    process.exit(2);
  }
  const answer = withMachine((m) => revisionAck(m, { plan, rev: arg(argv, 'rev'), manifestFile: arg(argv, 'read-manifest') }));
  const text = answer.ok ? JSON.stringify(answer.readManifest ?? answer) : `refused ${answer.code}: ${answer.error}`;
  console.log(argv.includes('--json') ? JSON.stringify(answer) : text);
  process.exitCode = answer.ok ? 0 : 1;
}
