// git-backup.mjs - push local branch tips only into the inert dated backup namespace.
import path from 'node:path';
import { push } from '../api/git/push.mjs';
import { remote } from '../api/git/remote.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { symbolicRef } from '../api/git/symbolic-ref.mjs';
import { asList } from '../lib/list.mjs';
import { refusal as verbRefusal, resultOk as ok, resultOutput as output } from '../lib/verb-call.mjs';

function branchNames(value, current) {
  const requested = asList(value).map((item) => String(item ?? '').trim()).filter(Boolean);
  return [...new Set(requested.length ? requested : [current, 'main'].filter(Boolean))];
}

// The refspecs and destination refs that back `branches` up under refs/backup/<date>/, or the text that refuses the request.
function backupRefspecs(api, cwd, branches, date) {
  const refspecs = [];
  const refs = [];
  for (const branch of branches) {
    if (branch.startsWith('+')) return { refused: `force refspecs are forbidden: ${branch}` };
    if (branch.includes(':') || branch.startsWith('refs/') || branch.startsWith('/') || branch.endsWith('/')) {
      return { refused: `invalid branch name: ${branch}` };
    }
    const source = `refs/heads/${branch}`;
    if (!api.revParse(cwd, source)) return { refused: `local branch does not resolve: ${branch}` };
    const destination = `refs/backup/${date}/${branch}`;
    const refspec = `${source}:${destination}`;
    if (refspec.startsWith('+')) return { refused: `force refspecs are forbidden: ${refspec}` };
    refspecs.push(refspec);
    refs.push(destination);
  }
  return { refspecs, refs };
}

/** Push selected local branches to refs/backup/<UTC date>/ and nowhere else. */
export async function gitBackup(ctx, deps = {}) {
  const refusal = (text, code = 2, data = {}) => verbRefusal('starci git backup', text, code,
    { schema: 'starci/git-backup@1', ok: false, ...data });
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
  const planned = backupRefspecs(api, cwd, branches, date);
  if (planned.refused) return refusal(planned.refused);
  const { refspecs, refs } = planned;

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
