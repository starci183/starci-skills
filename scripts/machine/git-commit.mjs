// git-commit.mjs - create one convention-shaped commit without broad or implicit staging.
import fs from 'node:fs';
import path from 'node:path';
import { add } from '../api/git/add.mjs';
import { commit } from '../api/git/commit.mjs';
import { diff } from '../api/git/diff.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { symbolicRef } from '../api/git/symbolic-ref.mjs';
import { asList, byCodeUnit } from '../lib/list.mjs';
import { refusal as verbRefusal, resultOk as ok, resultOutput as output } from '../lib/verb-call.mjs';

const TYPES = new Set(['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'land', 'release']);

const slash = (value) => value.split(path.sep).join('/');

function stagedFiles(cwd, gitDiff) {
  const result = gitDiff(['--cached', '--name-only', '--'], { cwd, config: { 'core.quotepath': 'off' } });
  return ok(result) ? output(result).split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : null;
}

function statusPaths(text) {
  return String(text ?? '').split(/\r?\n/).map((line) => line.slice(3).trim())
    .map((name) => name.includes(' -> ') ? name.split(' -> ').at(-1) : name).filter(Boolean);
}

function resolvePaths(inputs, cwd, root, exists) {
  const resolved = [];
  for (const value of inputs) {
    const given = String(value ?? '');
    if (!given) return { error: 'a --paths value may not be empty' };
    const absolute = path.resolve(cwd, given);
    const relative = path.relative(root, absolute);
    if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
      return { error: `path is outside the repository: ${given}` };
    }
    if (!exists(absolute)) return { error: `path does not exist: ${given}` };
    resolved.push(slash(relative || '.'));
  }
  return { paths: [...new Set(resolved)] };
}

/** Commit the requested paths or the existing index with the StarCi subject and trailers. */
export async function gitCommit(ctx, deps = {}) {
  const refusal = (text, code = 2) => verbRefusal('starci git commit', text, code,
    { schema: 'starci/git-commit@1', ok: false });
  const api = { add, commit, diff, porcelainStatus, revParse, revParseQuery, symbolicRef, exists: fs.existsSync, ...deps };
  const args = ctx?.args ?? {};
  const type = String(args.type ?? '').trim();
  const summary = String(args.summary ?? '').trim();
  const scope = args.scope == null ? '' : String(args.scope).trim();
  if (!TYPES.has(type)) return refusal(`--type must be one of ${[...TYPES].join(', ')}`);
  if (!summary) return refusal('--summary is required');
  if (!/^[a-z]/.test(summary)) return refusal('--summary must start with a lowercase letter');
  if (summary.endsWith('.')) return refusal('--summary must not end with a period');
  if (/[\r\n]/.test(summary) || /[\r\n]/.test(scope)) return refusal('--summary and --scope must be one line');
  const subject = scope ? `${type}(${scope}): ${summary}` : `${type}: ${summary}`;
  if (subject.length > 100) return refusal(`subject is ${subject.length} characters; maximum is 100`);

  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  const top = api.revParseQuery(['--show-toplevel'], { cwd });
  if (!ok(top) || !output(top)) return refusal('current directory is not a Git worktree');
  const root = path.resolve(output(top));
  const branchRef = api.symbolicRef(root);
  const branch = branchRef.replace(/^refs\/heads\//, '');
  const role = String(ctx?.role ?? 'owner');
  if (branch === 'main' && ['worker', 'lead', 'coordinator'].includes(role)) {
    return refusal(`role ${role} may not commit on main; commit on a lane and use starci git sync to merge local main into lanes`);
  }

  const requested = asList(args.paths);
  const checked = resolvePaths(requested, cwd, root, api.exists);
  if (checked.error) return refusal(checked.error);
  const addPaths = checked.paths ?? [];
  const coAuthor = String(args['co-author'] ?? ctx?.env?.STARCI_CO_AUTHOR ?? '').trim();
  const lane = String(args.lane ?? (branch.startsWith('lane/') ? branch : '')).trim();
  const trailers = [...(coAuthor ? [`Co-Authored-By: ${coAuthor}`] : []), ...(lane ? [`Lane: ${lane}`] : [])];
  const paragraphs = [subject];
  const body = String(args.body ?? '').trim();
  if (body) paragraphs.push(body);
  if (trailers.length) paragraphs.push(trailers.join('\n'));
  const message = paragraphs.join('\n\n');

  if (args['dry-run']) {
    const staged = stagedFiles(root, api.diff);
    if (staged == null) return refusal('could not read the staged files', 1);
    let preview = staged;
    if (addPaths.length) {
      const status = api.porcelainStatus(root, { pathspecs: addPaths, untracked: 'all', literal: true });
      if (!status.ok) return refusal(`could not inspect --paths: ${status.stderr || 'git status failed'}`, 1);
      preview = [...new Set([...staged, ...statusPaths(status.stdout)])].sort(byCodeUnit);
    }
    if (!preview.length) return refusal('nothing to commit', 1);
    return {
      code: 0,
      text: `message:\n${message}\n\nstaged:\n${preview.join('\n')}`,
      data: { schema: 'starci/git-commit@1', ok: true, sha: null, subject, trailers, paths: preview, dryRun: true }
    };
  }

  if (addPaths.length) {
    const staged = api.add(['--', ...addPaths], { cwd: root });
    if (!ok(staged)) return refusal(`git add failed: ${output(staged, 'stderr') || 'unknown error'}`, 1);
  }
  const paths = stagedFiles(root, api.diff);
  if (paths == null) return refusal('could not read the staged files', 1);
  if (!paths.length) return refusal('nothing to commit', 1);
  const made = api.commit(['-m', message], { cwd: root });
  if (!ok(made)) return refusal(`git commit failed: ${output(made, 'stderr') || output(made) || 'unknown error'}`, 1);
  const sha = api.revParse(root, 'HEAD');
  if (!sha) return refusal('commit succeeded but HEAD could not be resolved', 1);
  return {
    code: 0,
    text: `committed ${sha.slice(0, 7)} ${subject}`,
    data: { schema: 'starci/git-commit@1', ok: true, sha, subject, trailers, paths }
  };
}
