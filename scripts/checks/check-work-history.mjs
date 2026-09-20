#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {canonicalJSON, sha256} from '../../engine/index.mjs';
import {walk} from './check-example-work.mjs';
import {loadRecords} from '../example/example-ownership.mjs';
import {classifyChange} from './work-change.mjs';

/**
 * A Work tree cannot say what it used to say.
 *
 * `change.rev`, `change.kind` and `change.withdraws` are claims about a *transition*, and a record file on
 * disk holds exactly one side of it. scripts/checks/work-change.mjs already owns the semantics of the transition and
 * was found unusable in practice by the v6-4 audit for one reason: it asks for `--against <previous Work
 * tree>`, and nobody produces previous Work trees. The example trees keep no history of their own, so every
 * rev/kind/withdraws claim in them has been accepted on faith since it was authored.
 *
 * The previous tree does exist, in the only place anybody keeps it: git. `.claude` is a repository and the
 * example trees are committed inside it, so a baseline is one object lookup away for any record that has ever
 * been committed. This script is that bridge - it hands scripts/checks/work-change.mjs the baseline it has been asking
 * for without asking any lane to archive a tree.
 *
 * What falls out of comparing a record against its own committed past is exactly what no in-place check can
 * see: normative text that moved while `change.rev` stood still, a revision number that went backwards, a
 * withdrawal quoting a clause the record never carried, and a `kind: editorial` that added and removed
 * obligations on the way.
 *
 * Severity discipline, matching check-work-deep.mjs:
 *   REFUSE  - the transition is deterministically wrong given the history this run reached
 *   SUSPECT - the verdict rests on a heuristic, or on a revision git could not show within --limit
 *   INFO    - counts, and skips that name the checks they stand in for
 * Every finding names WHICH transition produced it (`HEAD -> uncommitted`, `9b57a291 -> HEAD`), because the
 * fleet edits these trees concurrently and a refusal without its side of the pair cannot be attributed.
 *
 * It reports and never repairs - the precedent check-stales.mjs and scripts/checks/work-change.mjs both set.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_LIMIT = 50;
const HEADER = '\x1f';

// ---- concept 1: a version is its parsed content, not its bytes ----
// Two revisions are the same revision here when their parsed YAML agrees. Comparing bytes instead would make
// every explanatory comment a lane writes into a record a new revision - these trees are full of comments
// recording which lane closed which gap - so a comment-only edit would read as an undeclared normative move on
// every run. The same rule hides git's checkout-time eol translation (.gitattributes is present), which is the
// point: what is compared is what a record commits to, not how it is formatted.
const sameVersion = (left, right) => canonicalJSON(left) === canonicalJSON(right);

// ---- concept 2: which half of a record is normative ----
/**
 * The projection check-work-deep.mjs's `normDigestOf` uses, restated rather than imported: that module keeps
 * the function module-local and this lane may not edit it, so the two field lists are kept in step by whoever
 * changes either. scripts/checks/work-change.mjs's exported `normative()` is deliberately NOT used for this comparison
 * - it also strips prose keys (title, description, note) at every depth, which is right for "how far did this
 * edit travel" and wrong for "did anything the record says move", where a changed `trigger` or
 * `postconditions` entry is an edit a revision is supposed to cover.
 */
const VOLATILE = new Set(['state', 'change', 'provenBy', 'verificationSource', 'blockedBy']);
const normativeProjection = data => Object.fromEntries(
  Object.entries(data ?? {}).filter(([key]) => !VOLATILE.has(key)));
const normDigestOf = data => sha256(canonicalJSON(normativeProjection(data)));

const revOf = data => Number.isInteger(data?.change?.rev) ? data.change.rev : null;
const kindOf = data => typeof data?.change?.kind === 'string' ? data.change.kind.trim() : null;
const withdrawsOf = data => (Array.isArray(data?.change?.withdraws) ? data.change.withdraws : [])
  .filter(clause => typeof clause === 'string').map(clause => clause.trim()).filter(Boolean);
const statementsOf = data => (Array.isArray(data?.statements) ? data.statements : [])
  .filter(clause => typeof clause === 'string').map(clause => clause.trim()).filter(Boolean);
/** A rev above 1, or a withdrawal, is a claim that this record had a previous revision - rev 1 has none. */
const claimsPriorRevision = data => (revOf(data) ?? 1) > 1 || withdrawsOf(data).length > 0;

/**
 * Every string leaf a document carries, at any depth - what a withdrawal could have come from. Three scopes
 * are asked, from strictest to widest, because the tiers of the answer differ: `statements` is the clause
 * list the change record is supposed to quote, the normative projection is everything the record commits the
 * product to, and the whole document minus its own `change` block is everything it ever said in prose. A
 * clause found only in the widest scope was a `blockedBy[].because` or a note, not an obligation withdrawn.
 */
const leafStrings = node => {
  const found = new Set();
  const collect = value => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) found.add(trimmed);
    } else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(node);
  return found;
};
const withoutChange = data => Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => key !== 'change'));
/** The whitespace folding a YAML block scalar introduces: "a\n  b" and "a b" are the same sentence, and a
 * check that refused the difference would be refusing the formatter rather than the claim. */
const fold = text => text.replace(/\s+/g, ' ').trim();

/**
 * The scopes a set of older revisions offers, plus a haystack for the case where the quoted text is real but
 * is only part of a longer clause the record carried.
 */
function withdrawalScopes(olderVersions) {
  const statements = new Set();
  const normative = new Set();
  const anywhere = new Set();
  for (const version of olderVersions) {
    for (const clause of statementsOf(version.data)) statements.add(fold(clause));
    for (const clause of leafStrings(normativeProjection(version.data))) normative.add(fold(clause));
    for (const clause of leafStrings(withoutChange(version.data))) anywhere.add(fold(clause));
  }
  return {statements, normative, anywhere, haystack: [...statements, ...normative, ...anywhere].join('\n\u0000\n')};
}

/**
 * Whether a revision's `withdraws` list holds up against the revisions before it, clause by clause. The
 * claim is attributed to the pair that introduced it: an identical list on the older side means the claim was
 * inherited by that edit rather than made by it, so the question moves one revision further back - and when
 * every reachable revision already carries it, only the record's own birth can answer, which is why
 * `older: null` walks the whole chain below the newest.
 */
function withdrawalAssessment(record) {
  const {versions} = record;
  const newest = versions[0];
  const listed = withdrawsOf(newest?.data);
  if (!listed.length) return null;
  let older = null;
  for (const version of versions.slice(1)) {
    if (!sameList(listed, withdrawsOf(version.data))) {
      older = version;
      break;
    }
  }
  const below = older ? versions.slice(versions.indexOf(older)) : versions.slice(1);
  const ancestors = record.ancestors ?? [];
  const scopes = withdrawalScopes([...below, ...ancestors]);
  // When the mainline chain shows no predecessor that differs, the revision the claim refers to is only
  // reachable through the lineage walk - a record that moved directory with its tree carries its rev-1 text at
  // the path it used to live under. That closest reachable ancestor is the clause list the claim is checked
  // against; if it holds, the claim stands and nothing is reported.
  const named = older ?? ancestors[0] ?? null;
  const held = statementsOf(named?.data).map(fold);
  const verdicts = listed.map(clause => ({clause, tier: withdrawalTier(clause, held, scopes)}));
  return {newest, older: named, verdicts, unsourced: verdicts.some(verdict => verdict.tier === 'never-carried')};
}

function withdrawalTier(clause, held, scopes) {
  const quoted = fold(clause);
  if (held.includes(quoted)) return 'held';
  if (scopes.statements.has(quoted)) return 'wrong-revision';
  if (scopes.normative.has(quoted)) return 'not-a-statement';
  if (scopes.anywhere.has(quoted)) return 'prose-not-obligation';
  if (quoted.length > 12 && scopes.haystack.includes(quoted)) return 'fragment-of-a-clause';
  return 'never-carried';
}

const sameList = (left, right) => left.length === right.length && left.every((clause, i) => clause === right[i]);

/** What went and what came, at the statement level - the plain-language half of a kind verdict. */
function changedStatements(olderData, newerData) {
  const before = statementsOf(olderData);
  const after = statementsOf(newerData);
  return {
    added: after.filter(statement => !before.includes(statement)),
    removed: before.filter(statement => !after.includes(statement)),
  };
}

// ---- concept 3: one git spawn per tree is the budget ----
/**
 * `git log --follow -- <path>` is the obvious way to ask for one record's history and the wrong way to ask for
 * 254 of them: measured on this repository, each --follow spawn costs ~120ms of rename detection, so a tree
 * would take half a minute. One `git log --name-status` over the tree answers the same question for every path
 * at once in ~170ms. --follow is then spent only where a verdict depends on lineage a plain path listing
 * cannot show - a record that moved directory with its tree - which is a handful, by construction.
 */
function gitText(repoDir, args) {
  const run = spawnSync('git', args, {cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 28});
  return run.status === 0 ? run.stdout : null;
}

/** The repository the tree lives in, or null. `rev-parse --show-toplevel` IS the walk up to `.git`, and it
 * also resolves a linked worktree, where `.git` is a file rather than a directory. */
function repoRootFor(cwd) {
  const run = spawnSync('git', ['rev-parse', '--show-toplevel'], {cwd, encoding: 'utf8'});
  return run.status === 0 ? run.stdout.trim().replaceAll('\\', '/') : null;
}

const gitRelative = (target, repoDir) => path.relative(repoDir.replaceAll('/', path.sep), target)
  .replaceAll('\\', '/');

/**
 * `git log --format=<sentinel>%H --name-status -z` -> {byPath: Map(path -> [{commit, status, from, blobPath}],
 * newest first), commits, capped}. With -z a rename is three fields (`R100`, old, new), so the stream is
 * consumed positionally rather than line-wise; git also leaves a stray newline in front of an entry's status,
 * which is why fields are trimmed before being classified and why both the `M\0path` and the `M\tpath`
 * framings are accepted. `--first-parent` is the default because a reader means the mainline when they ask what
 * the tree committed: lane branches are interesting only once they landed.
 */
function historyByPath(repoDir, pathspec, limit, {follow = false} = {}) {
  const args = ['log', ...(follow ? [] : ['--first-parent']), `--format=${HEADER}%H`, '--name-status', '-z'];
  if (follow) args.push('--follow');
  args.push('-n', String(limit), '--', pathspec);
  const text = gitText(repoDir, args);
  if (text === null) return null;
  const byPath = new Map();
  const commits = [];
  let commit = null;
  const fields = text.split('\0');
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (field === '') continue;
    if (field.replace(/^\s+/, '').startsWith(HEADER)) {
      commit = field.slice(field.indexOf(HEADER) + HEADER.length).trim();
      commits.push(commit);
      continue;
    }
    if (!commit) continue;
    const cleaned = field.replace(/^[\s\x00-\x1f]+/, '').replace(/\r$/, '');
    const joined = /^([ACDMRTUXB]\d*)[\t](.+)$/.exec(cleaned);
    const status = joined ? joined[1][0] : /^[ACDMRTUXB]\d*$/.test(cleaned) ? cleaned[0] : null;
    if (!status) continue;
    const paths = joined ? [joined[2]] : [fields[++index]];
    if (status === 'R' || status === 'C') paths.push(fields[++index]);
    const listedPath = paths.at(-1)?.replace(/^\s+/, '');
    if (!listedPath) continue;
    const entries = byPath.get(listedPath) ?? [];
    entries.push({commit, status, blobPath: listedPath,
      from: paths.length > 1 ? paths[0].replace(/^\s+/, '') : null, crossing: status === 'R' || status === 'C'});
    byPath.set(listedPath, entries);
  }
  return {byPath, commits: commits.length, capped: commits.length >= limit};
}

/**
 * One record's lineage through the paths it has lived in. A rename prints as `R100 <old> <new>` at the commit
 * that moved it, so the entries under the new path stop there and the older revisions are listed under the old
 * path - stitching the `from` links is what turns "the tree moved" into "this record has four revisions".
 */
function lineageEntries(byPath, specPath) {
  const entries = [];
  const walked = new Set();
  let current = specPath;
  while (current && !walked.has(current)) {
    walked.add(current);
    const listed = byPath.get(current) ?? [];
    if (!listed.length) break;
    entries.push(...listed);
    current = listed.at(-1).crossing ? listed.at(-1).from : null;
  }
  const seen = new Set();
  const key = entry => `${entry.commit}:${entry.blobPath}`;
  return entries.filter(entry => !seen.has(key(entry)) && seen.add(key(entry)));
}

/**
 * `rev:path` specs that exist, resolved in one `cat-file --batch` process - one spawn for thousands of
 * revisions where the same number of `git show` calls would take minutes. The framing is one object per
 * `<oid> blob <size>` line, then the raw bytes, then a newline. A spec that does not resolve (the path was not
 * there yet at that commit) comes back as `<spec> missing` and is kept as null rather than guessed at: an
 * absent revision is a fact, a wrong revision is a fabrication.
 */
function readBlobs(repoDir, specs) {
  const found = new Map();
  const unique = [...new Set(specs)];
  if (!unique.length) return found;
  const input = Buffer.from(unique.map(spec => `${spec}\n`).join(''), 'utf8');
  const run = spawnSync('git', ['cat-file', '--batch'], {cwd: repoDir, input, maxBuffer: 1 << 28});
  const bytes = run.stdout;
  if (!bytes || !bytes.length) return found;
  let cursor = 0;
  for (const spec of unique) {
    const headerEnd = bytes.indexOf(0x0a, cursor);
    if (headerEnd < 0) break;
    const header = bytes.subarray(cursor, headerEnd).toString('utf8');
    cursor = headerEnd + 1;
    const parts = header.split(' ');
    if (parts.length === 3 && parts[1] === 'blob') {
      const size = Number(parts[2]);
      found.set(spec, bytes.subarray(cursor, cursor + size));
      cursor += size + 1;
    } else {
      found.set(spec, null);
    }
  }
  return found;
}

// ---- concept 4: the chain of revisions, and what it can prove ----
/**
 * The record's revisions, newest first, as parsed documents, deduplicated by content. `uncommitted` on the
 * newest entry is the attribution handle: with a fleet editing the same trees, a finding about an edit nobody
 * has committed yet is somebody else's in-flight work, while a finding about two committed revisions is a claim
 * that already passed review once. A blob that does not parse is counted, never silently dropped.
 */
function versionsOf(recordFile, chain, blobs, stats) {
  const candidates = [{label: 'uncommitted', bytes: fs.readFileSync(recordFile)},
    {label: 'HEAD', bytes: blobs.get(`HEAD:${chain.specPath}`)}];
  for (const entry of chain.entries) {
    candidates.push({label: entry.commit.slice(0, 8), bytes: blobs.get(`${entry.commit}:${entry.blobPath}`)});
  }
  const versions = [];
  for (const candidate of candidates) {
    if (candidate.bytes === undefined || candidate.bytes === null) continue;
    let data = null;
    try {
      data = parseYaml(candidate.bytes.toString('utf8'));
    } catch {
      stats.unreadable++;
      continue;
    }
    if (!data || typeof data !== 'object') {
      stats.unreadable++;
      continue;
    }
    const twin = versions.find(known => sameVersion(known.data, data));
    if (twin) {
      twin.labels.push(candidate.label);
      continue;
    }
    versions.push({data, labels: [candidate.label]});
  }
  for (const version of versions) {
    // A revision the worktree and HEAD agree on is committed: the edit is not in flight.
    version.uncommitted = version.labels[0] === 'uncommitted' && !version.labels.includes('HEAD');
    version.at = version.uncommitted ? 'uncommitted'
      : version.labels.includes('HEAD') ? 'HEAD' : version.labels[1] ?? version.labels[0];
  }
  return versions;
}

/**
 * Whether the chain reaches the record's birth: an addition at the bottom of the walk that git did not reach
 * by crossing into this path, and that is not merely where --limit stopped. This is why a refusal about "no
 * revision carried it" is only allowed once confirmLineage walked the lineage: the plain listing shows a
 * directory move as an `A`, which is a relocation, not a beginning.
 */
const birthSeen = chain => {
  const last = chain.entries.at(-1);
  return Boolean(last) && last.status === 'A' && !last.crossing && !chain.capped;
};

/**
 * A claim contradicted by a record's whole committed past is only as strong as that past, so before such a
 * claim is refused the lineage is walked with --follow - the one operation that follows a file through the
 * directories it has lived in (the todo tree moved from `examples/todo-app` to `examples/todo-app-backend` with
 * most of its records already carrying claims written at the old path).
 *
 * The walk is kept in `record.ancestors` and used for ONE question - did this record ever carry this string.
 * It never feeds the transition checks: --follow without --first-parent lists commits from lanes that ran in
 * parallel, and two branch tips that were never each other's predecessor are not a revision sequence. A
 * "rev went backwards" claim about parallel branches would be a false refusal, so the mainline chain owns it.
 */
function confirmLineage(repoDir, record, limit, blobs, stats) {
  const follow = historyByPath(repoDir, record.specPath, limit, {follow: true});
  const entries = lineageEntries(follow?.byPath ?? new Map(), record.specPath);
  if (!entries.length) return false;
  for (const [spec, blob] of readBlobs(repoDir, entries.map(entry => `${entry.commit}:${entry.blobPath}`))) {
    blobs.set(spec, blob);
  }
  const walked = versionsOf(record.recordFile, {specPath: record.specPath, entries}, blobs, stats);
  record.ancestors = walked.slice(1);
  record.lineageFollowed = true;
  record.birthVisible = birthSeen({entries, capped: follow.capped});
  return true;
}

const chainSpecs = chain => [`HEAD:${chain.specPath}`,
  ...chain.entries.map(entry => `${entry.commit}:${entry.blobPath}`)];

// ---- concept 5: the checks ----
function checkRecord(record, out, {limit}) {
  const {shown, id, versions} = record;
  const refuse = (code, msg) => out.refuse.push(`${shown}: ${msg} [${code}]`);
  const suspect = (code, msg) => out.suspect.push(`${shown}: ${msg} [${code}]`);
  const info = (code, msg) => out.info.push(`${shown}: ${msg} [${code}]`);
  const assessment = record.assessment ?? withdrawalAssessment(record);

  // ---- REV_NOT_BUMPED: normative text moved and the revision did not ----
  for (let index = 0; index + 1 < versions.length; index++) {
    const newer = versions[index];
    const older = versions[index + 1];
    const transition = `${older.at} -> ${newer.at}`;
    if (normDigestOf(newer.data) === normDigestOf(older.data)) continue;
    const [revNewer, revOlder] = [revOf(newer.data), revOf(older.data)];
    const moved = describeMove(older.data, newer.data);
    if (revNewer !== null && revNewer === revOlder) {
      refuse('CHANGE_UNRECORDED', `${transition}: normative content moved (${moved}) while change.rev stayed `
        + `at ${revNewer}`);
    } else if (revNewer === null && revOlder !== null) {
      refuse('CHANGE_UNRECORDED', `${transition}: normative content moved (${moved}) and the change record was `
        + 'deleted');
    } else if (revNewer === null && revOlder === null) {
      // A record that never authored a change block is the layout's gap, not this edit's lie: nothing in
      // check-example-work.mjs requires `change` on any schema, so refusing - or even suspecting - one record
      // at a time would print well over a hundred lines on a single tree, which is the wolf-crying failure
      // mode the severity tiers exist to avoid. The count is reported once per tree by CHANGE_UNDECLARED.
      record.stats.undeclared++;
      if (record.stats.undeclaredExamples.length < 2) record.stats.undeclaredExamples.push(shown);
    }
  }

  // ---- REV_NOT_MONOTONIC: a revision number that went backwards ----
  const revs = versions.map(version => ({at: version.at, rev: revOf(version.data)}))
    .filter(entry => entry.rev !== null).reverse();
  for (let index = 1; index < revs.length; index++) {
    if (revs[index].rev < revs[index - 1].rev) {
      refuse('REV_NOT_MONOTONIC', `change.rev went backwards across committed history: ${revs[index - 1].at} `
        + `carried ${revs[index - 1].rev}, ${revs[index].at} carries ${revs[index].rev}`);
    }
  }

  // ---- WITHDRAWS_NOT_VERBATIM: the clause must be text an earlier revision actually carried ----
  if (assessment) {
    const names = assessment.older ? assessment.older.at : 'the oldest reachable revision';
    for (const {clause, tier} of assessment.verdicts) {
      if (tier === 'held') continue;
      const claim = `${assessment.newest.at} withdraws ${quote(clause)}`;
      if (tier === 'wrong-revision') {
        suspect('WITHDRAWS_NOT_VERBATIM', `${claim} from ${names}, which does not carry it - an older revision `
          + 'does, so the withdrawal names the wrong revision');
      } else if (tier === 'not-a-statement') {
        suspect('WITHDRAWS_NOT_VERBATIM', `${claim}, which an older revision carries inside its normative content `
          + 'but never in statements[] - a withdrawal of text this record never listed as a clause');
      } else if (tier === 'prose-not-obligation') {
        suspect('WITHDRAWS_NOT_VERBATIM', `${claim}, which an older revision carried only as prose (a blocker's `
          + 'because, a note) - prose is local and travels nowhere, so this withdrew nothing');
      } else if (tier === 'fragment-of-a-clause') {
        suspect('WITHDRAWS_NOT_VERBATIM', `${claim}, which no older revision carries as one clause - it is a piece `
          + 'of a longer sentence the record did carry, so the withdrawal quotes part of a clause rather than the '
          + 'clause itself');
      } else if (record.birthVisible) {
        refuse('WITHDRAWS_NOT_VERBATIM', `${claim}, a string no committed revision of ${id} carried anywhere, `
          + `whole or in part (${versions.length - 1} mainline revision(s) plus ${(record.ancestors ?? []).length} `
          + 'lineage revision(s) examined, down to the record\'s first commit)');
      } else {
        suspect('WITHDRAWS_NOT_VERBATIM', `${claim}, which no older revision carries, whole or in part; the record's `
          + `birth is ${record.lineageFollowed ? 'not reachable even after --follow' : `beyond --limit ${limit}`} and `
          + 'the revision it names may exist outside what this run read');
      }
    }
  }

  // ---- CHANGE_KIND_SUSPECT: a declared kind contradicted by the transition it describes ----
  for (let index = 0; index + 1 < versions.length; index++) {
    const newer = versions[index];
    const older = versions[index + 1];
    if (kindOf(newer.data) !== 'editorial') continue;
    const [revNewer, revOlder] = [revOf(newer.data), revOf(older.data)];
    // A declared editorial that also failed to bump is already refused above as an unrecorded change; this
    // check is for the case where the author did record the edit and described it as smaller than it is.
    if (revNewer === null || revNewer === revOlder) continue;
    // classifyChange over empty criteria maps is scripts/checks/work-change.mjs's own verdict for a record read on its
    // own: previous entries held verbatim plus additions is clarifying, a removal or a rewrite is breaking.
    const computed = classifyChange({meta: older.data, criteria: new Map()}, {meta: newer.data, criteria: new Map()});
    if (computed === 'editorial') continue;
    const {added, removed} = changedStatements(older.data, newer.data);
    const example = removed[0] ? `; e.g. "${trim(removed[0])}"` : added[0] ? `; e.g. "${trim(added[0])}"` : '';
    suspect('CHANGE_KIND_SUSPECT', `${older.at} -> ${newer.at} (rev ${revOlder ?? '(none)'} -> ${revNewer}): `
      + `declared kind: editorial while ${describeDelta(added, removed)} - scripts/checks/work-change.mjs reads the `
      + `transition as "${computed}"${example}`);
  }

  // ---- coverage, so a skipped verdict is never read as a clean record ----
  if (versions.length < 2 && !record.ancestors?.length && claimsPriorRevision(versions[0]?.data)) {
    info('HISTORY_INCOMPLETE', `${id} claims ${describeClaim(versions[0].data)} but only one content revision is `
      + 'reachable in git, so REV_NOT_BUMPED and REV_NOT_MONOTONIC had nothing to compare');
  }
}

/** How a transition moved the clause list, in the words a reviewer acts on. */
function describeDelta(added, removed) {
  if (removed.length && added.length) return `${removed.length} statement(s) went and ${added.length} arrived`;
  if (removed.length) return `${removed.length} statement(s) went`;
  if (added.length) return `${added.length} statement(s) arrived`;
  return 'normative content moved with no statement listed either way';
}

const describeClaim = data => withdrawsOf(data).length
  ? `a withdrawal${revOf(data) ? ` at rev ${revOf(data)}` : ''}` : `rev ${revOf(data)}`;

/** Which normative fields moved, by name - the half of a refusal a reader needs to act on it. */
function describeMove(olderData, newerData) {
  const older = normativeProjection(olderData);
  const newer = normativeProjection(newerData);
  const keys = [...new Set([...Object.keys(older), ...Object.keys(newer)])];
  const moved = keys.filter(key => canonicalJSON(older[key] ?? null) !== canonicalJSON(newer[key] ?? null));
  const named = moved.slice(0, 3).join(', ');
  return moved.length > 3 ? `${named}, +${moved.length - 3} more` : named || '(whole document)';
}

const quote = clause => `"${clause.length > 90 ? `${clause.slice(0, 87)}...` : clause}"`;
const trim = text => text.length > 70 ? `${text.slice(0, 67)}...` : text;

// ---- concept 6: git is a precondition, not an assumption ----
/**
 * A `.starciwork` copied out of the repository - a packaged example, a scratch export - has no committed
 * baseline. Refusing there would punish the copy for not being the checkout, so the tree is skipped and the
 * skip names the checks it stands in for, like check-work-deep.mjs's NO_BASELINE line. Exported so the
 * fixture test can point it at a throwaway git repository instead of the real example trees.
 */
export function checkWorkHistoryTree(workRoot, out, {limit = DEFAULT_LIMIT} = {}) {
  const records = loadRecords(workRoot, walk);
  const shown = path.relative(root, workRoot).replaceAll('\\', '/');
  const skipWith = (code, reason) => {
    out.info.push(`${shown}: ${records.size} record(s) skipped - ${reason} [${code}]`);
    return {records: records.size};
  };
  const repoDir = repoRootFor(workRoot);
  if (!repoDir) {
    return skipWith('NO_GIT', 'the tree is not inside a git repository, so no committed baseline exists and '
      + 'CHANGE_UNRECORDED / REV_NOT_MONOTONIC / WITHDRAWS_NOT_VERBATIM / CHANGE_KIND_SUSPECT cannot run');
  }
  const relTree = gitRelative(workRoot, repoDir);
  if (relTree.startsWith('..')) return skipWith('OUTSIDE_REPO', `the tree is not inside ${repoDir}`);
  const listing = historyByPath(repoDir, relTree, limit);
  if (!listing) return skipWith('GIT_FAILED', `\`git log\` over ${relTree} did not run`);
  const tracked = new Set((gitText(repoDir, ['ls-files', '-z', '--', relTree]) ?? '').split('\0').filter(Boolean));

  const stats = {unreadable: 0, undeclared: 0, undeclaredExamples: []};
  const inspected = [];
  for (const [id, rec] of records) {
    const recordFile = recordFileOf(rec, id);
    if (!recordFile) continue;
    const specPath = gitRelative(recordFile, repoDir);
    inspected.push({
      id, recordFile, specPath, stats, shown: path.relative(root, recordFile).replaceAll('\\', '/'),
      chain: {specPath, entries: listing.byPath.get(specPath) ?? [], capped: listing.capped},
    });
  }
  const untracked = inspected.filter(record => !tracked.has(record.specPath));
  const withHistory = inspected.filter(record => tracked.has(record.specPath));

  const blobs = readBlobs(repoDir, withHistory.flatMap(record => chainSpecs(record.chain)));
  for (const record of withHistory) {
    record.versions = versionsOf(record.recordFile, record.chain, blobs, stats);
    record.assessment = withdrawalAssessment(record);
  }

  // Only a withdrawal that nothing in the reachable past carries needs the whole lineage, and only for those
  // is the extra --follow spawn bought - it is what turns "the tree moved" into "this record has a revision
  // before this one", and a refusal is only allowed once that walk reached the record's birth.
  const needsLineage = withHistory.filter(record => record.assessment?.unsourced);
  for (const record of needsLineage) {
    if (confirmLineage(repoDir, record, limit, blobs, stats)) record.assessment = withdrawalAssessment(record);
  }

  for (const record of withHistory) checkRecord(record, out, {limit});

  if (untracked.length) {
    out.info.push(`${shown}: ${untracked.length} record file(s) have no git history at all - never committed, so `
      + 'no transition of theirs is checkable (expected while fleet lanes are mid-flight); e.g. '
      + `${untracked.slice(0, 2).map(record => record.shown).join(', ')} [UNTRACKED_RECORD]`);
  }
  if (stats.undeclared) {
    out.info.push(`${shown}: ${stats.undeclared} committed transition(s) moved normative content in records that `
      + 'carry no change record on either side - the layout never required one, so this is a count of what a '
      + `rev claim could not cover even in principle; e.g. ${stats.undeclaredExamples.join(', ')} `
      + '[CHANGE_UNDECLARED]');
  }
  if (stats.unreadable) {
    out.info.push(`${shown}: ${stats.unreadable} committed revision(s) did not parse as YAML 1.2 and were skipped `
      + 'rather than compared [REVISION_UNREADABLE]');
  }
  return {
    tree: shown, records: records.size, tracked: withHistory.length, untracked: untracked.length,
    followed: needsLineage.filter(record => record.lineageFollowed).length,
    transitions: withHistory.reduce((total, record) => total + Math.max(0, (record.versions?.length ?? 1) - 1), 0),
    withdrawals: withHistory.filter(record => withdrawsOf(record.versions?.[0]?.data).length).length,
    claims: withHistory.filter(record => claimsPriorRevision(record.versions?.[0]?.data)).length,
  };
}

/**
 * A record's own file: `dir/index.yaml` for nearly every record, the sibling that carries the id for the
 * `_resources/<kind>/<name>/resource.yaml` and root `workspace.yaml` shapes loadRecords also indexes. The id is
 * verified against the file rather than assumed, because one directory can hold both.
 */
function recordFileOf(rec, id) {
  const indexFile = path.join(rec.dir, 'index.yaml');
  if (fs.existsSync(indexFile) && parsesTo(indexFile, id)) return indexFile;
  const siblings = walk(rec.dir).filter(file => file.endsWith('.yaml') && !file.endsWith(`${path.sep}index.yaml`));
  return siblings.find(file => parsesTo(file, id)) ?? (fs.existsSync(indexFile) ? indexFile : null);
}

function parsesTo(file, id) {
  try {
    return parseYaml(fs.readFileSync(file, 'utf8'))?.id === id;
  } catch {
    return false;
  }
}

// ---- main ----
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const optionValue = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const treeArg = optionValue('--tree');
  const parsedLimit = Number.parseInt(optionValue('--limit') ?? '', 10);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);

  const out = {refuse: [], suspect: [], info: []};
  const summaries = trees.map(workRoot => checkWorkHistoryTree(workRoot, out, {limit}));
  const total = key => summaries.reduce((sum, row) => sum + (row[key] ?? 0), 0);

  for (const line of out.refuse) console.log(`REFUSE  ${line}`);
  for (const line of out.suspect) console.log(`SUSPECT ${line}`);
  for (const line of out.info) console.log(`INFO    ${line}`);
  console.log(`\n${total('records')} record(s), ${total('tracked')} with git history, ${total('transitions')} `
    + `version transition(s), ${total('claims')} claiming a prior revision, ${total('withdrawals')} withdrawal `
    + `claim(s) checked against their baseline${total('followed') ? `, ${total('followed')} lineage(s) confirmed `
    + `with --follow` : ''}: ${out.refuse.length} refused, ${out.suspect.length} suspect, ${out.info.length} info`);
  process.exitCode = out.refuse.length ? 1 : 0;
}
