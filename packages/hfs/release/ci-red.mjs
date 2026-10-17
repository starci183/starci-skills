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

/** Reads branch runs plus push/tag runs whose commits are reachable from the default branch; the newest completed run decides, even if a newer run is pending. */
export function latestDefaultBranchCi({ spawn, cwd, defaultBranch = 'main' }) {
  const args = ['run', 'list', '--workflow', 'ci.yml'];
  const tail = ['--limit', '20', '--json', FIELDS];
  const branch = runsOf(run(spawn, cwd, 'gh', [...args, '--branch', defaultBranch, ...tail]));
  if (!branch) return { state: 'unknown', why: 'gh branch runs unavailable (missing gh, authentication, or unreadable response)' };
  const pushes = runsOf(run(spawn, cwd, 'gh', [...args, '--event', 'push', ...tail]));
  if (!pushes) return { state: 'unknown', why: 'gh push runs unavailable (missing gh, authentication, or unreadable response)' };
  const candidates = branch.filter((row) => row && SHA.test(row.headSha));
  let ancestryUnknown = false;
  for (const row of pushes) {
    if (!row || !SHA.test(row.headSha) || row.event !== 'push') continue;
    const ancestor = run(spawn, cwd, 'git', ['merge-base', '--is-ancestor', row.headSha, defaultBranch]);
    if (!ancestor.error && ancestor.status === 0) candidates.push(row);
    else if (ancestor.error || ancestor.status !== 1) ancestryUnknown = true;
  }
  const completed = candidates.filter((row) => row.status === 'completed' && Number.isFinite(Date.parse(row.createdAt)));
  completed.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.databaseId) - Number(a.databaseId));
  const latest = completed[0];
  if (!latest) return { state: 'unknown', why: ancestryUnknown ? 'cannot establish push run ancestry on the default branch' : 'no completed CI run on the default branch' };
  if (latest.conclusion === 'success') return { state: 'green', run: latest };
  if (RED.has(latest.conclusion)) return { state: 'red', run: latest };
  return { state: 'unknown', why: 'latest completed CI run has no success or red conclusion', run: latest };
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
