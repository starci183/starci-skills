// ci-red.mjs - the latest completed default-branch CI is a release precondition; unreadable GitHub warns, a red run needs the owner's SHA-bound override.
import fs from 'node:fs';
import path from 'node:path';
import { refusal } from '../stack/errors.mjs';

const FIELDS = 'databaseId,headSha,status,conclusion,url,event,createdAt';
const SHA = /^[a-f0-9]{40}$/u;
const RED = new Set(['failure', 'cancelled', 'timed_out', 'startup_failure', 'action_required']);

/** Every process uses the supplied seam; an unavailable executable is an unreadable result. */
function run(spawn, cwd, command, args) {
  try { return spawn(command, args, { cwd }); } catch { return { status: null }; }
}

function runsOf(result) {
  if (result.error || result.status !== 0) return null;
  try {
    const rows = JSON.parse(result.stdout);
    return Array.isArray(rows) ? rows : null;
  } catch { return null; }
}

/** Resolve each available default-branch reference once, including HEAD in detached release worktrees. */
function referenceTips(spawn, cwd, defaultBranch) {
  const refs = [`origin/${defaultBranch}`, defaultBranch, 'HEAD'];
  return refs.flatMap((name) => {
    const result = run(spawn, cwd, 'git', ['rev-parse', '--verify', '--quiet', `${name}^{commit}`]);
    const tip = String(result.stdout ?? '').trim();
    return !result.error && result.status === 0 && SHA.test(tip) ? [{ name, tip }] : [];
  });
}

/** Equality proves reachability directly; ancestry is unknown only when every available probe errors. */
function pushAncestry(spawn, cwd, row, refs) {
  if (refs.some((ref) => ref.tip === row.headSha)) return { candidate: true, unknown: false };
  let known = false;
  for (const ref of refs) {
    const result = run(spawn, cwd, 'git', ['merge-base', '--is-ancestor', row.headSha, ref.tip]);
    if (!result.error && result.status === 0) return { candidate: true, unknown: false };
    if (!result.error && result.status === 1) known = true;
  }
  return { candidate: false, unknown: !known };
}

/** Branch rows remain candidates; push rows must reach a resolved reference, and each databaseId counts once. */
function candidateRuns(spawn, cwd, branch, pushes, refs) {
  const candidates = branch.filter((row) => row && SHA.test(row.headSha));
  let ancestryUnknown = refs.length === 0;
  for (const row of pushes) {
    if (!row || !SHA.test(row.headSha) || row.event !== 'push') continue;
    const ancestry = pushAncestry(spawn, cwd, row, refs);
    if (ancestry.candidate) candidates.push(row);
    if (ancestry.unknown) ancestryUnknown = true;
  }
  const unique = new Map();
  for (const row of candidates) if (!unique.has(row.databaseId)) unique.set(row.databaseId, row);
  return { candidates: [...unique.values()], ancestryUnknown };
}

/** Reads branch runs plus push/tag runs whose commits are reachable from the default branch; the newest completed run decides, even if a newer run is pending. */
export function latestDefaultBranchCi({ spawn, cwd, defaultBranch = 'main' }) {
  const refs = referenceTips(spawn, cwd, defaultBranch);
  const unknown = (why) => ({ state: 'unknown', why: `${why} (refs: ${refs.map((ref) => ref.name).join(', ') || 'none'})` });
  const args = ['run', 'list', '--workflow', 'ci.yml'];
  const tail = ['--limit', '20', '--json', FIELDS];
  const branch = runsOf(run(spawn, cwd, 'gh', [...args, '--branch', defaultBranch, ...tail]));
  if (!branch) return unknown('gh branch runs unavailable (missing gh, authentication, or unreadable response)');
  const pushes = runsOf(run(spawn, cwd, 'gh', [...args, '--event', 'push', ...tail]));
  if (!pushes) return unknown('gh push runs unavailable (missing gh, authentication, or unreadable response)');
  const { candidates, ancestryUnknown } = candidateRuns(spawn, cwd, branch, pushes, refs);
  const completed = candidates.filter((row) => row.status === 'completed' && Number.isFinite(Date.parse(row.createdAt)));
  completed.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.databaseId) - Number(a.databaseId));
  const latest = completed[0];
  if (!latest) return unknown(ancestryUnknown ? 'cannot establish push run ancestry on the default branch' : 'no completed CI run on the default branch');
  if (latest.conclusion === 'success') return { state: 'green', run: latest };
  if (RED.has(latest.conclusion)) return { state: 'red', run: latest };
  return { ...unknown('latest completed CI run has no success or red conclusion'), run: latest };
}

/** Only a complete starci/ci-override@1 record for this exact commit can excuse a red run. */
function overrideOf(ctx, sha) {
  const common = run(ctx.spawn, ctx.cwd, 'git', ['rev-parse', '--git-common-dir']);
  if (common.error || common.status !== 0 || !String(common.stdout ?? '').trim()) return null;
  const file = path.join(path.resolve(ctx.cwd, String(common.stdout).trim()), 'starci-release', `${sha}.ci-override.json`);
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (record.schema !== 'starci/ci-override@1' || record.sha !== sha || typeof record.reason !== 'string' || !record.reason.trim() || typeof record.by !== 'string' || !record.by.trim() || typeof record.at !== 'string' || !Number.isFinite(Date.parse(record.at))) return null;
    return record;
  } catch { return null; }
}

/** Warns on unknown CI and refuses red CI unless the owner left a valid override beside the release records. */
export function requireGreenCi(ctx, ci) {
  if (ci.state === 'unknown') {
    ctx.stderr(`RELEASE_CI_UNKNOWN: ${ci.why}\n`);
    return [];
  }
  if (ci.state !== 'red') return [];
  const record = overrideOf(ctx, ci.run.headSha);
  if (record) return [`RELEASE_CI_RED overridden by the owner: ${record.reason}`];
  throw refusal('RELEASE_CI_RED', `CI run ${ci.run.url} for ${ci.run.headSha} concluded ${ci.run.conclusion}; the owner must use starci release ci-override --sha ${ci.run.headSha} --reason <text>`);
}
