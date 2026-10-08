// release-record.mjs - the L4 record of a release: proof that the release cut ran the full suite for ONE commit. The git hooks
// (the app and runtime pre-push, scripts/guards/git-hooks.mjs) let a push of main or a v* tag through only when HEAD carries
// an annotated release tag AND this record exists for HEAD and names that tag, so a push that did not come out of the
// release cut is refused without running a single test.
//
// The record lives in the git common dir (never in the tree: it is not tracked, never dirties a checkout and is shared by
// every worktree of the repository): <git common dir>/starci-release/<head sha>.l4.json
//   {schema: 'starci/l4-record@1', head, tag, suite: 'local'|'ci', delegated: [{name, why}], logs: [{name, ok, log, ms}], at}
// `suite: ci` (the owner's choice, config.yaml release.suite) lists the rows CI judges as `delegated`, never as logs: a delegated row is not green, it did not run here.
// The release cut (scripts/supervisor/release-cut.mjs, GOVERNANCE lane) calls writeL4Record after its full suite and check
// passed and before the atomic push. Pure fs over the common dir path; the git call is injected (seam `commonDir`).
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { RELEASE_DEFAULTS } from '../../engine/release-config.mjs';

const L4_SCHEMA = 'starci/l4-record@1';
const RELEASE_TAG = /^v\d[\w.+-]*$/;
const SHA = /^[0-9a-f]{40,64}$/;

/** The absolute git common dir of `repo`, or null. */
export function gitCommonDir(repo, { run = revParseQuery } = {}) {
  const r = run(['--path-format=absolute', '--git-common-dir'], { cwd: repo });
  const out = String(r.stdout ?? '').trim();
  return r.status === 0 && out ? path.resolve(out) : null;
}

/** The record file of `head` under `commonDir`. */
export const l4RecordPath = ({ commonDir, head }) => path.join(commonDir, 'starci-release', `${head}.l4.json`);

/**
 * Write the L4 record of `head` for release tag `tag`. {ok, file} or {ok:false, reason}: a head that is not a full sha, a tag
 * that is not v<version>, a failed suite step or an unreadable common dir writes nothing.
 */
export function writeL4Record({ repo, head, tag, logs = [], suite = RELEASE_DEFAULTS.suite, delegated = [], commonDir = null, now = () => new Date(), run = revParseQuery } = {}) {
  if (!SHA.test(String(head))) return { ok: false, reason: 'the head is not a full sha' };
  if (!RELEASE_TAG.test(String(tag))) return { ok: false, reason: 'the tag is not a release tag v<version>' };
  if (logs.some((step) => step?.ok !== true)) return { ok: false, reason: 'a suite step is not green' };
  if (!['local', 'ci'].includes(suite)) return { ok: false, reason: 'the suite mode is local or ci' };
  if (suite === 'ci' && !delegated.length) return { ok: false, reason: 'a suite: ci record lists the delegated rows' };
  if (suite === 'local' && delegated.length) return { ok: false, reason: 'a suite: local record delegates nothing' };
  const dir = commonDir ?? gitCommonDir(repo, { run });
  if (!dir) return { ok: false, reason: 'the repository has no git common dir' };
  const file = l4RecordPath({ commonDir: dir, head });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ schema: L4_SCHEMA, head, tag, suite, delegated, logs, at: now().toISOString() }, null, 2)}\n`);
  return { ok: true, file };
}

/** The L4 record of `head`, or null when there is none or it names another head, tag or schema. */
export function readL4Record({ repo, head, tag = null, commonDir = null, run = revParseQuery } = {}) {
  const dir = commonDir ?? gitCommonDir(repo, { run });
  if (!dir) return null;
  try {
    const record = JSON.parse(fs.readFileSync(l4RecordPath({ commonDir: dir, head }), 'utf8'));
    return record?.schema === L4_SCHEMA && record.head === head && (tag === null || record.tag === tag) ? record : null;
  } catch { return null; }
}
