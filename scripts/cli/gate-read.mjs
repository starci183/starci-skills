#!/usr/bin/env node
// gate-read.mjs - the entry of `starci gate read`: the READ step of the op loop (knowledge/op-gate.yaml).
//
//   starci gate read --root <app> [--touch <file>...] [--read <file>...] [--knowledge <file>...] [--out <file>]
//
// It composes what scripts/gates/read-digest.mjs cannot know: run inside an op (a terminal the ledger binds to a job), the required
// refs of that op's filed READ (filedRequiredReads, scripts/lib/filed-reads.mjs) are recorded whatever --touch names. Outside an
// op the digest covers only the flags. Exit 0 recorded, 2 the digest could not be built.
import fs from 'node:fs';
import path from 'node:path';
import { buildReadDigest } from '../gates/read-digest.mjs';
import { opContextOf } from '../guards/op-context.mjs';
import { ledgerFileFor, openLedgerReader } from '../../engine/db/ledger.mjs';
import { latestContractOf } from '../machine/contract-version.mjs';
import { filedRequiredReads } from '../lib/filed-reads.mjs';
import { parseJson } from '../lib/json.mjs';
import { isMain } from '../lib/is-main.mjs';

const USAGE = 'usage: gate-read.mjs --root <app> [--touch <file>...] [--read <file>...] [--knowledge <file>...] [--out <file>]';

/** The filed required READ refs of the op this terminal is bound to (its newest attempt's contract), or null outside an op. */
function boundFiledReads({ env = process.env } = {}) {
  const context = opContextOf({ env });
  if (!context) return null;
  const db = openLedgerReader(ledgerFileFor(context.ledgerRepo, { env }));
  try {
    const filed = parseJson(latestContractOf(db, context.jobId)?.context_json ?? '')?.packet?.context;
    return Array.isArray(filed?.readRefs) ? filedRequiredReads(filed.readRefs, filed.selected_op?.contract?.reads ?? []) : null;
  } finally { db.close(); }
}

function parseDigestArgs(argv) {
  const opts = { root: null, touch: [], read: [], knowledge: [], out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--touch' || arg === '--read' || arg === '--knowledge') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[arg.slice(2)].push(argv[++i]); }
    else if (arg === '--root' || arg === '--out') {
      if (argv[i + 1] === undefined) {
        throw new Error(`${arg} needs a value; ${USAGE}`);
      }
      opts[arg.slice(2)] = argv[++i];
    }
    else throw new Error(`unknown argument ${arg}; ${USAGE}`);
  }
  return opts;
}

if (isMain(import.meta.url)) {
  try {
    const opts = parseDigestArgs(process.argv.slice(2));
    const filed = boundFiledReads();
    if (!opts.touch.length && !opts.knowledge.length && !filed?.size) throw new Error(`--touch or --knowledge names at least one file; ${USAGE}`);
    const digest = await buildReadDigest({ root: path.resolve(opts.root ?? process.cwd()), touch: opts.touch, read: opts.read, knowledge: opts.knowledge, filed });
    const text = `${JSON.stringify(digest, null, 2)}\n`;
    if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
    process.stdout.write(text);
  } catch (error) {
    process.stderr.write(`gate-read: ${error.message}\n`);
    process.exitCode = 2;
  }
}
