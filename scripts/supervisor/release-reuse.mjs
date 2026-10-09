// release-reuse.mjs - what a release cut already knows from earlier cuts, so a red row costs its own re-run and not the whole proof.
// Every cut that ran its rows leaves a ledger beside the L4 record, keyed by the commit it ran on: <git common dir>/starci-release/<sha>.l4-rows.json holds each GREEN row with a digest of
// what the row depends on (its class, its command, and the bytes of its input set at that commit, git's blob ids). A later cut reads the ledgers and, row by row, decides:
//   carry    the row is green in the ledger of THIS commit (an env-only red row re-run alone with --rows, or a plain second cut): it ran on this commit, nothing runs
//   reuse    the ledger of ANOTHER commit holds the row green with the identical digest and its class may cross commits: nothing runs, the row says which commit proved it (reusedFrom)
//   run      anything else: no ledger row, a different digest, a row that always runs, a required row of the pre-push gate (it must have RUN on the exact pushed commit), --no-reuse
// The input sets and which classes may cross commits are declared in modules/supervisor/release-cut.yaml. When anything cannot be read the answer is run.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { lsTree } from '../api/git/ls-tree.mjs';
import { gitCommonDir, proofFileOf, proofFilesOf } from '../guards/release-record.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const LEDGER_SCHEMA = 'starci/l4-rows@1';
const SHA = /^[0-9a-f]{40,64}$/;

/** The declared reuse policy of release-cut.yaml. */
export const reusePolicy = () => readModuleJson('modules', 'supervisor', 'release-cut.yaml').reuse;

const underPrefix = (file, prefix) => file === prefix || file.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);

/** The class of a row: {kind: 'root'|'whole'|'app'|'always', app?}. A row nothing declares always runs. Pure. */
export function rowClass(name, { apps = [], policy = reusePolicy() } = {}) {
  const declared = Object.entries(policy.classes).find(([, spec]) => (spec.rows ?? []).includes(name));
  if (declared && !policy.always.includes(name)) return { kind: declared[0] };
  const app = apps.find((candidate) => name.startsWith(`${candidate}: `));
  if (!app || policy.always.includes(name.replace(`${app}:`, '<app>:'))) return { kind: 'always' };
  return { kind: 'app', app };
}

/** The tracked files of `commit` with their blob ids: [{mode, sha, file}], or null when git cannot list them. */
export function treeEntries({ repo, commit, run = lsTree }) {
  const r = run(['-r', '-z', '--full-tree', commit], { cwd: repo, timeout: 120_000, maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0 || r.error) return null;
  return String(r.stdout ?? '').split('\0').filter(Boolean).map((entry) => {
    const [meta, file] = entry.split('\t');
    const [mode, , sha] = meta.split(' ');
    return { mode, sha, file };
  });
}

/** The entries a class depends on, under the declared include/exclude lists. Pure. */
function inputEntries(entries, cls, policy) {
  const spec = policy.classes[cls.kind];
  if (cls.kind === 'app') {
    const include = spec.include.map((p) => p.replaceAll('<app>', cls.app));
    return entries.filter((entry) => include.some((prefix) => underPrefix(entry.file, prefix)));
  }
  return entries.filter((entry) => !(spec.exclude ?? []).some((prefix) => underPrefix(entry.file, prefix)));
}

/** The digest of one row at one commit: class, command and the input set's blob ids; null for a class that always runs. Pure. */
export function rowDigest({ entries, cls, signature, policy = reusePolicy() }) {
  if (cls.kind === 'always' || !entries) return null;
  const lines = inputEntries(entries, cls, policy).map((entry) => `${entry.mode} ${entry.sha} ${entry.file}`).sort(byCodeUnit);
  return createHash('sha256').update([policy.digestVersion, cls.kind, cls.app ?? '', JSON.stringify(signature), ...lines].join('\n')).digest('hex');
}

/** The ledger directory file of `head`. */
export const ledgerPath = ({ commonDir, head }) => proofFileOf({ commonDir, sha: head, kind: 'rows' });

/** Write the ledger of a cut: its green rows with their digests. {ok, file} or {ok: false, reason}; never throws. Keeps the newest `keep` ledgers. */
export function writeLedger({ repo, head, tag, rows, digests, commonDir = null, now = () => new Date(), keep = reusePolicy().keep }) {
  if (!SHA.test(String(head))) return { ok: false, reason: 'the head is not a full sha' };
  const dir = commonDir ?? gitCommonDir(repo);
  if (!dir) return { ok: false, reason: 'the repository has no git common dir' };
  try {
    const file = ledgerPath({ commonDir: dir, head });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const green = rows.filter((row) => row.ok === true && !row.absent).map((row) => ({ name: row.name, digest: digests[row.name] ?? null, row }));
    fs.writeFileSync(file, `${JSON.stringify({ schema: LEDGER_SCHEMA, head, tag, at: now().toISOString(), rows: green })}\n`);
    prune(dir, keep);
    return { ok: true, file };
  } catch (error) { return { ok: false, reason: error.message }; }
}

function prune(commonDir, keep) {
  const files = proofFilesOf({ commonDir, kind: 'rows' }).map((file) => ({ file, at: fs.statSync(file).mtimeMs }));
  files.sort((a, b) => b.at - a.at).slice(keep).forEach((entry) => fs.rmSync(entry.file, { force: true }));
}

/** Every ledger of the repository, newest first: [{head, tag, at, rows: [{name, digest, row}]}]; unreadable files are left out. */
export function readLedgers({ repo, commonDir = null }) {
  const dir = commonDir ?? gitCommonDir(repo);
  if (!dir) return [];
  const ledgers = proofFilesOf({ commonDir: dir, kind: 'rows' }).flatMap((file) => {
    try {
      const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
      return ledger?.schema === LEDGER_SCHEMA && SHA.test(String(ledger.head)) && Array.isArray(ledger.rows) ? [ledger] : [];
    } catch { return []; }
  });
  return ledgers.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** The command of a planned row, what its digest is bound to. */
export const signatureOf = (step) => (step ? [step.cmd ?? null, step.args ?? null] : null);

/** The green ledger row `name` with digest `digest` at the newest ledger of `head` (same commit) or of another commit: {ledger, row} or null. */
function ledgerHit({ ledgers, name, digest, same, head }) {
  for (const ledger of ledgers.filter((l) => (l.head === head) === same)) {
    const hit = ledger.rows.find((entry) => entry.name === name && entry.row?.ok === true);
    if (hit && hit.digest === digest) return { ledger, row: hit.row };
  }
  return null;
}

/** Why a row runs when no ledger row serves it: the reason line the plan prints. */
function runReason({ cls, digest, policy, name, noReuse }) {
  if (noReuse) return '--no-reuse';
  if (cls.kind === 'always') return 'always runs (an install or a build the later rows stand on)';
  if (!digest) return 'its inputs could not be read';
  if (policy.required.rows.includes(name)) return 'required row: the pre-push gate wants it run on the exact pushed commit';
  return null;
}

/** One planned row's decision: {name, action: 'run'|'reuse'|'carry', why, from?, row?, digest}. Pure over the ledgers. */
function decide({ name, cls, digest, ledgers, head, policy, noReuse }) {
  const early = runReason({ cls, digest, policy, name, noReuse });
  const here = !noReuse && cls.kind !== 'always' && digest ? ledgerHit({ ledgers, name, digest, same: true, head }) : null;
  if (here) return { name, action: 'carry', why: `green on this commit already (ran ${here.ledger.at})`, from: head, row: here.row, digest };
  if (early) return { name, action: 'run', why: early, digest };
  const spec = policy.classes[cls.kind];
  if (!spec.acrossShas) return { name, action: 'run', why: `${cls.kind} rows run on every commit`, digest };
  const other = ledgerHit({ ledgers, name, digest, same: false, head });
  if (!other) return { name, action: 'run', why: 'no green row of an earlier commit has the identical inputs', digest };
  const from = other.row.reusedFrom ?? other.ledger.head;
  return { name, action: 'reuse', why: `inputs identical to ${from.slice(0, 9)}`, from, row: { ...other.row, reusedFrom: from }, digest };
}

/** The decisions for `--rows`: the named rows run, every other row must be green on this very commit. */
function decideRows({ names, only, digests, ledgers, head }) {
  const here = ledgers.filter((ledger) => ledger.head === head);
  return names.map((name) => {
    if (only.includes(name)) return { name, action: 'run', why: 'named by --rows', digest: digests[name] ?? null };
    const hit = here.map((ledger) => ledger.rows.find((entry) => entry.name === name && entry.row?.ok === true)).find(Boolean);
    return hit ? { name, action: 'carry', why: 'green on this commit already', from: head, row: hit.row, digest: digests[name] ?? null } : { name, action: 'missing', why: 'no green row of this commit to complete the record with', digest: digests[name] ?? null };
  });
}

/**
 * The decision of every planned row: {decisions: [...], digests: {name: digest|null}, unknown: [names in --rows the plan does not hold]}.
 * `steps` are the planned L4 steps ([{name, cmd, args}]), `proofs` and `linux` the other rows of the plan; `entries` the tree of `head`.
 */
export function chooseRows({ names, signatures, apps, entries, ledgers, head, only = null, noReuse = false, policy = reusePolicy() }) {
  const digests = Object.fromEntries(names.map((name) => [name, rowDigest({ entries, cls: rowClass(name, { apps, policy }), signature: signatures[name] ?? name, policy })]));
  if (only) {
    const unknown = only.filter((name) => !names.includes(name));
    return { decisions: decideRows({ names, only, digests, ledgers, head }), digests, unknown };
  }
  const decisions = names.map((name) => decide({ name, cls: rowClass(name, { apps, policy }), digest: digests[name], ledgers, head, policy, noReuse }));
  return { decisions, digests, unknown: [] };
}
