#!/usr/bin/env node
// release-push-gate.mjs - the body of the runtime repository's pre-push hook (scripts/guards/git-hooks.mjs). Git hands the hook one line
// per ref on stdin: <local ref> <local sha> <remote ref> <remote sha>. The remote main and the v* tags of the runtime move only with a
// release, so those refs are judged against the release definition (scripts/guards/release-definition.mjs), the same code `starci release cut` runs:
//   refs/heads/main   not deleted, a fast-forward of the remote main, and the pushed head is a release commit
//   refs/tags/v*      annotated, named v<version> of the commit it points at, and that commit is a release commit
//   any other ref     allowed (a lane branch, refs/backup/*, a tag that is not a release tag)
// A refusal prints `RIGHTS_PUSH_NOT_RELEASE: <ref> is closed: <what is missing> (<command that produces it>)` per ref and exits 1.
// There is no switch that opens it: a release is made by `starci release cut`, which pushes main and its tag together.
import fs from 'node:fs';
import { catFile } from '../api/git/cat-file.mjs';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { isMain } from '../lib/is-main.mjs';
import { releaseFindings } from './release-definition.mjs';

export const REFUSAL_CODE = 'RIGHTS_PUSH_NOT_RELEASE';
const ZERO = /^0+$/;
const RELEASE_TAG_REF = /^refs\/tags\/v\d/;

const parseLines = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.trim().split(/\s+/)).filter((parts) => parts.length === 4)
  .map(([localRef, localSha, remoteRef, remoteSha]) => ({ localRef, localSha, remoteRef, remoteSha }));
const describe = (findings) => findings.map((f) => `${f.missing} (${f.fix})`).join('; ');
const refuse = (ref, why) => `${REFUSAL_CODE}: ${ref} is closed: ${why}`;

function mainRefusal(cwd, { remoteRef, localSha, remoteSha }) {
  if (ZERO.test(localSha)) return refuse(remoteRef, 'a push never deletes the runtime main');
  const known = !ZERO.test(remoteSha);
  if (known && !isAncestor(cwd, remoteSha, localSha)) return refuse(remoteRef, 'it is not a fast-forward of the remote main (fetch it first; a force push rewrites main)');
  const findings = releaseFindings({ cwd, commit: localSha, remoteCommit: known ? remoteSha : null });
  return findings.length ? refuse(remoteRef, `the pushed head is not a release commit: ${describe(findings)}`) : null;
}

function tagRefusal(cwd, { remoteRef, localSha }) {
  if (ZERO.test(localSha)) return refuse(remoteRef, 'a push never deletes a release tag');
  const kind = catFile(['-t', localSha], { cwd, timeout: 60_000 }).stdout?.trim();
  if (kind !== 'tag') return refuse(remoteRef, 'a release tag is annotated: its message is the release notes');
  const commit = revParseQuery([`${localSha}^{commit}`], { cwd, timeout: 60_000 }).stdout?.trim();
  const findings = releaseFindings({ cwd, commit, tag: remoteRef.slice('refs/tags/'.length) });
  return findings.length ? refuse(remoteRef, `the tagged commit is not a release commit: ${describe(findings)}`) : null;
}

/** The refusal lines for the pushed refs `text` (git's pre-push stdin) of the repository at `cwd`: [] when every ref may move. */
function pushRefusals({ text, cwd = process.cwd() }) {
  return parseLines(text).flatMap((ref) => {
    let line = null;
    if (ref.remoteRef === 'refs/heads/main') line = mainRefusal(cwd, ref);
    else if (RELEASE_TAG_REF.test(ref.remoteRef)) line = tagRefusal(cwd, ref);
    return line ? [line] : [];
  });
}

if (isMain(import.meta.url)) {
  const refusals = pushRefusals({ text: fs.readFileSync(0, 'utf8') });
  for (const line of refusals) process.stderr.write(`${line}\n`);
  process.exitCode = refusals.length ? 1 : 0;
}
