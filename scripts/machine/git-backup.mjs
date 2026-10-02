// git-backup.mjs - push local branch tips only into the inert dated backup namespace.
import path from 'node:path';
import { push } from '../api/git/push.mjs';
import { remote } from '../api/git/remote.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { symbolicRef } from '../api/git/symbolic-ref.mjs';

const ok = (result) => Boolean(result && (result.ok ?? (!result.error && result.status === 0)));
const output = (result, key = 'stdout') => String(result?.[key] ?? (key === 'stdout' ? result?.out : result?.err) ?? '').trim();
const list = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const refusal = (text, code = 2, data = {}) => ({ code, text: `starci git backup: ${text}`, data: { schema: 'starci/git-backup@1', ok: false, ...data } });

function branchNames(value, current) {
  const requested = list(value).map((item) => String(item ?? '').trim()).filter(Boolean);
  return [...new Set(requested.length ? requested : [current, 'main'].filter(Boolean))];
}

/** Push selected local branches to refs/backup/<UTC date>/ and nowhere else. */
export async function gitBackup(ctx, deps = {}) {
  const api = { push, remote, revParse, symbolicRef, ...deps };
  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  const remoteName = String(ctx?.args?.remote ?? 'origin').trim();
  if (!remoteName) return refusal('--remote may not be empty');
  const configured = api.remote(['get-url', remoteName], { cwd });
  if (!ok(configured)) return refusal(`remote is not configured: ${remoteName}`);
  const current = api.symbolicRef(cwd).replace(/^refs\/heads\//, '');
  if (!ctx?.args?.branches && !current) return refusal('HEAD is detached; pass --branches');
  const branches = branchNames(ctx?.args?.branches, current);
  if (!branches.length) return refusal('--branches may not be empty');

  const instant = new Date(ctx?.now ?? Date.now());
  if (Number.isNaN(instant.getTime())) return refusal('ctx.now is not a valid date');
  const date = instant.toISOString().slice(0, 10);
  const refspecs = [];
  const refs = [];
  for (const branch of branches) {
    if (branch.startsWith('+')) return refusal(`force refspecs are forbidden: ${branch}`);
    if (branch.includes(':') || branch.startsWith('refs/') || branch.startsWith('/') || branch.endsWith('/')) {
      return refusal(`invalid branch name: ${branch}`);
    }
    const source = `refs/heads/${branch}`;
    if (!api.revParse(cwd, source)) return refusal(`local branch does not resolve: ${branch}`);
    const destination = `refs/backup/${date}/${branch}`;
    const refspec = `${source}:${destination}`;
    if (refspec.startsWith('+')) return refusal(`force refspecs are forbidden: ${refspec}`);
    refspecs.push(refspec);
    refs.push(destination);
  }

  if (ctx?.args?.['dry-run']) {
    return {
      code: 0,
      text: `dry run: push to ${remoteName}\n${refspecs.join('\n')}`,
      data: { schema: 'starci/git-backup@1', ok: true, remote: remoteName, refs, refspecs, dryRun: true }
    };
  }
  const sent = api.push([remoteName, ...refspecs], { cwd });
  if (!ok(sent)) return refusal(`push failed: ${output(sent, 'stderr') || output(sent) || 'unknown error'}`, 1, { remote: remoteName, refs, refspecs });
  return {
    code: 0,
    text: `backed up to ${remoteName}:\n${refs.join('\n')}`,
    data: { schema: 'starci/git-backup@1', ok: true, remote: remoteName, refs, refspecs }
  };
}
