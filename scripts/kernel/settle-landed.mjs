// settle's landed proof. An op whose manifest policy.commitPolicy commits
// settles pass only when its owned paths are clean in the target checkout and
// the commit its report names (`head`) is in that checkout's history; when
// the policy also pushes, origin/<branch> must contain it too. Contract:
// modules/kernel/api.yaml commands.settle (refuses not-landed /
// landed-unverifiable). Git only — no host calls.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { allocationMs } from '../../engine/config.mjs';
import { ownedPathspec } from '../../engine/admission.mjs';
import { pathKey } from '../lib/path-key.mjs';

export const commitPolicyOf = (brief) => brief?.policy?.commitPolicy ?? null;
export const policyCommits = (policy) => !!policy && typeof policy === 'object'
  && typeof policy.mode === 'string' && policy.mode.trim() !== '' && policy.mode !== 'none';
export const policyPushes = (policy) => policyCommits(policy) && policy.push === true;

// The Work-authoring ops gained a committing commitPolicy with this registered change
// (modules/kernel/contract-changes.yaml). A leg of one of its ops admitted before it runs on the
// contract it was admitted under: no head owed at report, no landed proof at settle.
export const WORK_COMMIT_CHANGE = 'authoring-ops-commit-work';
export function admittedCommitPolicy({ policy, op, admittedAt, registry }) {
  const change = registry?.changes?.find((c) => c.id === WORK_COMMIT_CHANGE) ?? null;
  if (!change || change.safetyCritical || !Number.isFinite(admittedAt)) return policy;
  return change.ops.includes(op) && admittedAt < change.effectiveAt ? null : policy;
}

const git = (cwd, args, timeout) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, timeout });
  return {
    ok: !r.error && r.status === 0,
    stdout: r.stdout ?? '',
    error: (r.stderr ?? '').trim() || String(r.error?.message ?? (r.status == null ? 'timed out' : `exit ${r.status}`)),
  };
};

const nearestExistingDir = (abs) => {
  let dir = abs;
  while (!fs.existsSync(dir)) {
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return fs.statSync(dir).isDirectory() ? dir : path.dirname(dir);
};

// Owned paths grouped by the git checkout that holds each one, as pathspecs
// relative to that checkout's top level. `placements` ({base, path, role} per
// owned path, scripts/kernel/target-repo.mjs ownedPathPlacements) resolve each
// path against its own repository; without them every path resolves against
// `base`. A path in no checkout is left out; no checkout at all means the job
// predates a resolvable target.
export function landingRepos({ base, ownedPaths = [], placements, timeoutMs }) {
  const repos = new Map(), probes = new Map();
  for (const item of placements ?? ownedPaths.map((owned) => ({ base, path: owned, role: null }))) {
    // A directory grant spelled with a trailing /** is the same prefix (engine/admission.mjs
    // normalizeOwnedPath); git reads every spec literally (ownedPathspec), so the suffix goes here.
    const abs = path.resolve(item.base, String(item.path).replace(/[\\/]\*\*[\\/]?$/, '') || '.');
    const dir = nearestExistingDir(abs);
    if (!dir) continue;
    if (!probes.has(dir)) probes.set(dir, [git(dir, ['rev-parse', '--show-toplevel'], timeoutMs), git(dir, ['rev-parse', '--show-prefix'], timeoutMs)]);
    const [top, prefix] = probes.get(dir);
    if (!top.ok || !prefix.ok || !top.stdout.trim()) continue;
    const root = path.resolve(top.stdout.trim());
    const rest = path.relative(dir, abs).replaceAll('\\', '/');
    const spec = `${prefix.stdout.trim()}${rest}`.replace(/\/+$/, '') || '.';
    if (!repos.has(root)) repos.set(root, { specs: [], role: item.role ?? null });
    repos.get(root).specs.push(spec);
  }
  return repos;
}

// Pathspecs in batches whose argv stays far below Windows' 32K command-line limit: a Work-debt
// repair owns hundreds of exact files (api enqueue --commit-only-work-debt).
const SPEC_BATCH_CHARS = 12000;
export const specBatches = (specs) => {
  const out = [[]];
  let size = 0;
  for (const spec of specs) {
    if (size + spec.length > SPEC_BATCH_CHARS && out[out.length - 1].length) { out.push([]); size = 0; }
    out[out.length - 1].push(spec);
    size += spec.length + 12;
  }
  return out.filter((batch) => batch.length);
};

// Git for Windows stores a name's Windows-illegal characters ("*:<>?| and controls) as U+F000 + code
// (':' is U+F03A), while an owned path records the ASCII name: a job owning '.../-change:' never matched
// the '.../-change' its own commit deleted, so the file read as foreign (inc-54046f4a4f99). Git reads
// both spellings of a spec, and names are compared in the ASCII form.
const WIN_MAPPED = /[-]/g;
export const asciiName = (p) => String(p).replace(WIN_MAPPED, (c) => String.fromCharCode(c.charCodeAt(0) - 0xf000));
const winMapped = (p) => String(p).replace(/[\u0001-\u001f"*:<>?|]/g, (c) => String.fromCharCode(0xf000 + c.charCodeAt(0)));
const bothSpellings = (specs) => [...new Set(specs.flatMap((s) => [s, winMapped(s)]))];

const dirtyOf = (root, specs, timeoutMs, label) => {
  const dirty = [];
  for (const batch of specBatches(bothSpellings(specs))) {
    // -z: NUL-separated records with literal paths — no C-quoting, so a name carrying bytes like the
    // U+F03A a Windows checkout writes for ':' round-trips (inc-e7e54ba0b970). A rename/copy record
    // is `XY <dest>\0<origin>`; the origin is the next record and is not itself evidence.
    const r = git(root, ['status', '--porcelain', '-z', '--untracked-files=all', '--', ...batch.map(ownedPathspec)], timeoutMs);
    if (!r.ok) return { error: r.error };
    const records = r.stdout.split('\0');
    for (let i = 0; i < records.length; i++) {
      if (!records[i]) continue;
      dirty.push(`${label}${records[i].slice(3)}`);
      if (/[RC]/.test(records[i].slice(0, 2))) i++;
    }
  }
  return { dirty: [...new Set(dirty)] };
};

// Every uncommitted or untracked file under a job's owned paths, per checkout: {repos:[{repo, role,
// dirty:[path relative to that checkout]}]} listing only checkouts with something dirty, or {error}
// when a path's repository is unresolved or git cannot answer (api reconcile --work-debt).
export function ownedPathsDirty({ base, ownedPaths = [], placements }) {
  const timeoutMs = allocationMs('settleGit.commandMs');
  if ((placements ?? []).some((p) => p.unresolved)) return { error: 'repository-unresolved' };
  const repos = [];
  for (const [root, { specs, role }] of landingRepos({ base, ownedPaths, placements, timeoutMs })) {
    const d = dirtyOf(root, specs, timeoutMs, '');
    if (d.error) return { error: d.error, repo: root };
    if (d.dirty.length) repos.push({ repo: root, role, dirty: d.dirty });
  }
  return { repos };
}

// The owned-path half of a dead worker's no-effect proof (api reconcile
// --dead-worker): every uncommitted change under the job's owned paths, and
// every commit on any ref that touched them since `sinceMs` (the dispatch
// contract's time). {provable:false, why} when the paths cannot be read — an
// unresolved repository, no git checkout holding an owned path, a git error —
// because an unreadable tree is never proof of no effect. With no owned paths
// there is nothing a worker could have changed: {provable:true, clean:true}.
export function ownedPathEffects({ base, ownedPaths = [], placements, sinceMs }) {
  const timeoutMs = allocationMs('settleGit.commandMs');
  if ((placements ?? []).some((p) => p.unresolved)) return { provable: false, why: 'repository-unresolved' };
  const items = placements ?? ownedPaths.map((owned) => ({ base, path: owned, role: null }));
  if (!items.length) return { provable: true, clean: true, repos: [], dirty: [], commits: [] };
  const repos = landingRepos({ base, ownedPaths, placements, timeoutMs });
  if (!repos.size) return { provable: false, why: 'no-checkout' };
  const since = new Date(Number.isFinite(sinceMs) ? sinceMs : 0).toISOString();
  const dirty = [], commits = [], checked = [];
  for (const [root, { specs, role }] of repos) {
    const d = dirtyOf(root, specs, timeoutMs, repos.size > 1 ? `${root}:` : '');
    if (d.error) return { provable: false, why: 'git-status', repo: root, error: d.error };
    const log = git(root, ['log', '--all', `--since=${since}`, '--format=%H', '--', ...specs.map(ownedPathspec)], timeoutMs);
    if (!log.ok) return { provable: false, why: 'git-log', repo: root, error: log.error };
    const shas = log.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    dirty.push(...d.dirty);
    commits.push(...shas);
    checked.push({ repo: root, role, paths: specs, dirty: d.dirty, commits: shas });
  }
  return { provable: true, clean: !dirty.length && !commits.length, since, repos: checked, dirty, commits };
}

// Returns {checked:false, why} when the job names no resolvable checkout (the
// settle then behaves as it always has), else {checked:true, ok, reason?, detail}.
// A placement with {unresolved} (a repository id the binding cannot resolve)
// is landed-unverifiable before any git read. detail.repos names the checkout,
// binding role and dirty paths of every repository checked.
// With -z a porcelain path is literal: no quoting, and a rename's destination is the record itself.
// (pathKey — scripts/lib/path-key.mjs — additionally strips a trailing slash; the two differ only on a
// filesystem root, which an exclude list of report files or a path inside a checkout never is.)

// The commits a job landed under its owned paths since its admission, up to
// `head`, and the files each one carries outside those paths. Ownership is
// disjoint between live jobs, so a commit since admission that touches the
// job's paths is the job's own; any other file in it is foreign - a peer's
// file a hook re-staged (nivo inc-5d7ce049e810) or a peer commit folded in by
// a reset (inc-40fed684fff8). {commits:[{sha, foreign[]}]} | {error}.
export function foreignLandedPaths({ root, specs, head, sinceMs, accept = [], timeoutMs }) {
  // git --since is whole seconds and inclusive: a commit made earlier in the admission's own second (the
  // checkout's prior history) would read as the job's. Start at the next whole second; a reported head that
  // touches an owned path is still examined below, so a job commit inside that first second is not lost.
  const since = new Date(Number.isFinite(sinceMs) ? Math.ceil(sinceMs / 1000) * 1000 : 0).toISOString();
  const log = git(root, ['log', `--since=${since}`, '--format=%H', head, '--', ...bothSpellings(specs).map(ownedPathspec)], timeoutMs);
  if (!log.ok) return { error: log.error };
  const owned = specs.map((s) => asciiName(s).replace(/\/\*\*$/, '').replace(/\/+$/, ''));
  const within = (name) => { const rel = asciiName(name); return owned.some((o) => o === '.' || rel === o || rel.startsWith(`${o}/`)); };
  const accepted = new Set(accept.map((p) => asciiName(p).replace(/\\/g, '/')));
  // -c: a merge lists the files it differs from every parent in (without it diff-tree lists nothing for a merge);
  // the commits it brought are walked by the log on their own.
  const filesOf = (sha) => git(root, ['diff-tree', '-r', '-c', '--no-commit-id', '--name-only', '--root', '-z', sha], timeoutMs);
  // The reported head is examined only when it touches an owned path: an op can report the checkout's
  // HEAD at report time — a peer's commit whose every file is foreign to this job (inc-e7e54ba0b970).
  // The log over the owned paths already names the job's own commits. Canonicalize first: a report
  // may carry a short sha, and the dedup below keys on the string.
  const resolved = git(root, ['rev-parse', `${head}^{commit}`], timeoutMs);
  if (!resolved.ok) return { error: resolved.error };
  const headSha = resolved.stdout.trim();
  const headFiles = filesOf(headSha);
  if (!headFiles.ok) return { error: headFiles.error };
  const shas = [...new Set([
    ...(headFiles.stdout.split('\0').filter(Boolean).some(within) ? [headSha] : []),
    ...log.stdout.split('\n').map((l) => l.trim()).filter(Boolean),
  ])];
  const commits = [];
  for (const sha of shas) {
    const files = sha === headSha ? headFiles : filesOf(sha);
    if (!files.ok) return { error: files.error };
    const foreign = files.stdout.split('\0').filter(Boolean).filter((rel) => !within(rel) && !accepted.has(asciiName(rel)));
    if (foreign.length) commits.push({ sha, foreign });
  }
  return { commits };
}

// `exclude`: absolute paths never counted dirty - the report files ops filed
// (api report --report <path>): a worker writes evidence/<attempt>/report.json
// after its head commit, and counting it cost a land-only retry each time
// (nivo Login a23/a24, WSPV a30, Collab seam a1).
// `foreign`: {sinceMs, accept[]} turns on the foreign-path refusal for a leg
// admitted after the shared-checkout change (modules/kernel/contract-changes.yaml).
export function landedProof({ base, ownedPaths, placements, head, branch, pushes, exclude = [], foreign = null }) {
  const timeoutMs = allocationMs('settleGit.commandMs');
  const unresolved = (placements ?? []).filter((p) => p.unresolved);
  if (unresolved.length) {
    return { checked: true, ok: false, reason: 'landed-unverifiable', detail: {
      step: 'repository', error: 'owned path names a repository the project binding cannot resolve',
      unresolved: unresolved.map((p) => ({ path: p.owned, repository: p.repository, via: p.via })),
    } };
  }
  const repos = landingRepos({ base, ownedPaths, placements, timeoutMs });
  if (!repos.size) return { checked: false, why: 'repo-unresolved' };
  const multi = repos.size > 1;
  const dirty = [], missing = [], checked = [];
  for (const [root, { specs, role }] of repos) {
    const d = dirtyOf(root, specs, timeoutMs, multi ? `${root}:` : '');
    if (d.error) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { repo: root, role, step: 'status', error: d.error } };
    const excluded = new Set(exclude.map(pathKey));
    const kept = d.dirty.filter((p) => !excluded.has(pathKey(path.join(root, multi ? p.slice(root.length + 1) : p))));
    dirty.push(...kept);
    checked.push({ repo: root, role, paths: specs, dirty: kept.map((p) => (multi ? p.slice(root.length + 1) : p)),
      ...(kept.length < d.dirty.length ? { reportFilesIgnored: d.dirty.length - kept.length } : {}) });
  }
  const claimed = typeof head === 'string' && head.trim() ? head.trim() : null;
  let repo = [...repos.keys()][0];
  // api report requires head from committing ops; a done report filed before
  // that rule carries none, and settles on the clean-paths half alone.
  // A pushing policy has no such legacy and still owes head.
  let headCheck = 'verified';
  if (!claimed) {
    if (pushes) missing.push('head');
    else headCheck = 'skipped-legacy-report';
  } else {
    const holder = [...repos.keys()].find((root) => git(root, ['cat-file', '-e', `${claimed}^{commit}`], timeoutMs).ok);
    if (!holder) missing.push(`commit:${claimed}`);
    else {
      repo = holder;
      if (!git(repo, ['merge-base', '--is-ancestor', claimed, 'HEAD'], timeoutMs).ok) missing.push(`ancestor-of-HEAD:${claimed}`);
    }
  }
  const localHead = git(repo, ['rev-parse', 'HEAD'], timeoutMs);
  const detail = { repo, dirty, repos: checked, head: claimed, headCheck, localHead: localHead.ok ? localHead.stdout.trim() : null, missing };
  if (foreign && claimed && !missing.length && repos.has(repo)) {
    const found = foreignLandedPaths({ root: repo, specs: repos.get(repo).specs, head: claimed, sinceMs: foreign.sinceMs, accept: foreign.accept ?? [], timeoutMs });
    if (found.error) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { ...detail, step: 'foreign-paths', error: found.error } };
    if (found.commits.length) return { checked: true, ok: false, reason: 'foreign-paths', detail: { ...detail, foreign: found.commits } };
  }
  if (dirty.length || missing.length || !pushes) {
    return dirty.length || missing.length
      ? { checked: true, ok: false, reason: 'not-landed', detail }
      : { checked: true, ok: true, detail };
  }
  let onBranch = typeof branch === 'string' && branch.trim() ? branch.trim() : null;
  if (!onBranch) {
    const current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs);
    onBranch = current.ok && current.stdout.trim() !== 'HEAD' ? current.stdout.trim() : null;
  }
  detail.branch = onBranch;
  if (!onBranch) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { ...detail, step: 'branch', error: 'detached HEAD and the report names no branch' } };
  const fetched = git(repo, ['fetch', '--quiet', 'origin', onBranch], allocationMs('settleGit.fetchMs'));
  if (!fetched.ok) return { checked: true, ok: false, reason: 'landed-unverifiable', detail: { ...detail, step: 'fetch', error: fetched.error } };
  const originRef = git(repo, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${onBranch}^{commit}`], timeoutMs);
  const originHead = (originRef.ok ? originRef : git(repo, ['rev-parse', 'FETCH_HEAD^{commit}'], timeoutMs)).stdout.trim() || null;
  detail.originHead = originHead;
  if (!originHead || !git(repo, ['merge-base', '--is-ancestor', claimed, originHead], timeoutMs).ok) {
    missing.push(`origin/${onBranch}:${claimed}`);
    return { checked: true, ok: false, reason: 'not-landed', detail };
  }
  return { checked: true, ok: true, detail };
}
