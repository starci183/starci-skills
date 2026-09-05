// git.publish's own law over one branch, on top of the shared step check: the receipt names the
// boundary and the approval the request bound; the published head is the commit the
// quality-verification input measured; the mode is fast-forward only and nothing was forced; the
// session branch was merged, never rebased, and a merge commit exists only when the target moved; every
// hunk that merge conflicted on was resolved under the shared closed rule set and recorded, with the
// incoming session's side taken only inside the files its own write set owns;
// every hook ran and passed, `pre-push` among them; the head actually advanced; a continuation tag
// exists exactly when the request asked for one and points at the head this run pushed; the session
// that produced the merged branch is on disk with the receipt that authorized it; publication
// preserves the worktree, session branch and folder for the host session lifecycle.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { resolutionErrors } from '../../scripts/merge-resolution.mjs';

const PRODUCERS = new Set(['interface.generate', 'interface.fix', 'backend.generate', 'library.update']);

// Every step branch of the session this publish belongs to, read once as { dir, response }.
async function sessionBranches(sessionRoot) {
  const out = [];
  let steps = [];
  try { steps = (await readdir(sessionRoot, { withFileTypes: true })).filter((e) => e.isDirectory() && /^step-\d+$/.test(e.name)); } catch { return out; }
  for (const step of steps) {
    let parallels = [];
    try { parallels = (await readdir(path.join(sessionRoot, step.name), { withFileTypes: true })).filter((e) => e.isDirectory() && /^parallel-\d+$/.test(e.name)); } catch { continue; }
    for (const parallel of parallels) {
      const dir = path.join(sessionRoot, step.name, parallel.name);
      const file = path.join(dir, 'response', 'response.json');
      if (!existsSync(file)) continue;
      try { out.push({ dir, rel: `${step.name}/${parallel.name}`, response: JSON.parse(await readFile(file, 'utf8')) }); } catch { /* a malformed response is the response gate's finding, not this one's */ }
    }
  }
  return out;
}

// SESSION_MISSING: a session branch is only ever the tail of a session, so the receipt that
// authorized its commits, and the screenshots of any audit the chain declared, are on disk here.
export async function sessionReceiptErrors(branchDir, { pushedHeads, sessionBranch }) {
  const errors = [];
  const sessionRoot = sessionRootOf(branchDir);
  if (!sessionRoot || !existsSync(path.join(sessionRoot, 'state.json'))) {
    errors.push(`SESSION_MISSING: ${sessionBranch || 'the session branch'} is published from no session; state.json is not on disk beside this branch`);
    return errors;
  }
  const branches = await sessionBranches(sessionRoot);
  const producers = branches.filter((b) => PRODUCERS.has(b.response.operatorId));
  const receipted = producers.filter((b) => b.response.status === 'done' && [...pushedHeads].every((h) => (b.response.commits ?? []).includes(h)));
  if (receipted.length === 0) {
    errors.push(`SESSION_MISSING: no done ${[...PRODUCERS].join(', ')} branch in the session registers ${[...pushedHeads].join(', ') || 'the published head'} under commits; a session branch with no source-application receipt carries commits nobody wrote a request for`);
  }

  // When the chain declared an audit or a UAT run, that branch is done and the pictures proving it
  // are still on disk. Both operators publish their proof as `screenshot` artifacts.
  let state = {};
  try { state = JSON.parse(await readFile(path.join(sessionRoot, 'state.json'), 'utf8')); } catch { state = {}; }
  const declared = new Set(Object.values(state.steps ?? {}));
  for (const [operatorId, why] of [
    ['interface.audit', 'a frontend surface nobody looked at is exactly what this gate refuses to publish'],
    ['uat.verify', 'a journey nobody walked is exactly what this gate refuses to publish'],
  ]) {
    if (!declared.has(operatorId)) continue;
    const done = branches.filter((b) => b.response.operatorId === operatorId && b.response.status === 'done');
    if (done.length === 0) { errors.push(`SESSION_MISSING: the session chain declares a ${operatorId} step and no done ${operatorId} branch is on disk; ${why}`); continue; }
    for (const branch of done) {
      const shots = branch.response.fields?.screenshot;
      const files = Array.isArray(shots) ? shots : shots ? [shots] : [];
      if (files.length === 0) { errors.push(`SESSION_MISSING: ${branch.rel} is a done ${operatorId} with no screenshot artifact; the proof is the picture`); continue; }
      for (const f of files) if (!existsSync(path.join(branch.dir, f))) errors.push(`SESSION_MISSING: ${branch.rel} names the screenshot ${f}, which is not on disk`);
    }
  }
  return errors;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHA = /^[0-9a-f]{40}$/;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const rows = (text, heading) => tableUnder(text, heading) ?? [];
const fields = (text, heading) => Object.fromEntries(rows(text, heading).map(([k, v]) => [k, v]));
const unbacktick = (v) => String(v ?? '').replace(/^`|`$/g, '').trim();

// The files the session's write set owns, read from the `changes` input this publication binds: its
// `## Files` table is the exact set the producing branch committed, and it is what says where the
// incoming session's side may be taken when a hunk is resolved. A `changes` that cannot be read
// leaves the ownership rule unchecked rather than guessed.
export async function sessionWriteSet(branchDir, request) {
  const ref = (request?.inputs ?? {}).changes;
  const session = sessionRootOf(branchDir);
  if (!ref || !session) return null;
  let text; try { text = await readFile(path.join(session, ref), 'utf8'); } catch { return null; }
  const files = (tableUnder(text, '## Files') ?? []).map(([file]) => unbacktick(file)).filter(Boolean);
  return files.length ? files : null;
}

export async function validateGitPublishStep(branchDir, root = ROOT, { verifiedCommit = null } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'git.publish') return { errors };
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  // Nothing destructive can be asked for, because no field can carry it.
  for (const forbidden of ['force', 'forceWithLease', 'noVerify', 'rebase', 'amend', 'reset', 'clean', 'stash', 'deleteBranch']) {
    if (requirements[forbidden] !== undefined) errors.push(`request.json: ${forbidden} is not a field git.publish declares; a destructive act must stay unrepresentable`);
  }
  if (empty(requirements.approval)) errors.push('request.json: approval has no default; publishing outward is always something a person said yes to');
  const wantsTag = !empty(requirements.tag);

  if (!(present.has('git-publication') && existsSync(path.join(branchDir, 'response/response.md')))) {
    if (response.status === 'done') errors.push('response/response.md: a done branch needs the publication receipt');
    return { errors };
  }
  const text = await read('response/response.md');
  const binding = fields(text, '## Binding');
  const publication = fields(text, '## Publication');
  const heads = rows(text, '## Published heads');
  const hooks = rows(text, '## Hooks');
  const tag = fields(text, '## Continuation tag');
  const findings = new Set(rows(text, '## Findings').map(([code]) => unbacktick(code)));

  if (!empty(requirements.boundary) && binding.Boundary !== requirements.boundary) errors.push(`response/response.md: Binding publishes ${binding.Boundary} but the request bound ${requirements.boundary}`);
  if (!empty(requirements.approval) && binding.Approval !== requirements.approval) errors.push('response/response.md: Binding names an approval the request did not bind; an approval for another boundary is somebody else\'s');

  if (publication.Mode !== 'fast-forward-only') errors.push(`response/response.md: Mode is ${publication.Mode}; the publication mode is always fast-forward only`);
  if (publication.Forced !== 'no') errors.push('response/response.md: Forced is not no; a forced push rewrites what other people have already pulled');
  if (!/^session\//.test(publication['Session branch'] ?? '')) errors.push('response/response.md: the producer wrote on a session branch, and the receipt must name it');
  if (!['fast-forward', 'merge-commit'].includes(publication.Merge)) errors.push(`response/response.md: Merge is ${publication.Merge}; the session branch is merged, never rebased or squashed`);

  // A conflict resolves by rule or it stops, and the rules are the ones the runtime owner resolves an
  // integration merge under — one module, not a copy (scripts/merge-resolution.mjs). Which files the
  // incoming session's side may be taken in is the `changes` input's file set, so the ownership rule is
  // checked against what the session actually committed.
  const resolutions = rows(text, '## Resolutions').map(([file, hunkRange, rule]) => ({ file: unbacktick(file), hunkRange: unbacktick(hunkRange), rule: unbacktick(rule) }));
  errors.push(...resolutionErrors(resolutions, { at: 'response/response.md: Resolutions', owned: await sessionWriteSet(branchDir, request), root }));
  if (resolutions.length) {
    if (publication.Merge !== 'merge-commit') errors.push('response/response.md: Merge is fast-forward and Resolutions records a resolved hunk; a fast-forward creates nothing to resolve');
    if (!findings.has('MERGE_RESOLVED')) errors.push('response/response.md: the merge resolved a conflicting hunk and the receipt records no MERGE_RESOLVED finding; a merge that took a side says so');
    if (!findings.has('MERGE_GATED')) errors.push('response/response.md: the merge resolved a conflicting hunk and the receipt records no MERGE_GATED finding; a resolved merge is gated on the merged head before the push, and only a green gate publishes it');
  } else {
    for (const code of ['MERGE_RESOLVED', 'MERGE_GATED']) if (findings.has(code)) errors.push(`response/response.md: ${code} is recorded and Resolutions is empty; the finding names hunks the receipt does not carry`);
  }

  // The published head is the commit quality measured, not one commit further on.
  const verified = verifiedCommit ?? (publication['Verified commit'] ?? '');
  if (!SHA.test(verified)) errors.push('response/response.md: Verified commit is not a commit sha; the receipt must say which commit the gates measured');
  if (heads.length === 0) errors.push('response/response.md: Published heads is empty; a publication that advances nothing is not a publication');
  for (const [checkout, branch, head, previous, commits] of heads) {
    const at = `response/response.md: published head ${checkout}`;
    if (SHA.test(verified) && head !== verified) errors.push(`${at} is ${head} but quality verified ${verified}; a head past the verified commit carries change no gate saw`);
    if (head === previous) errors.push(`${at} equals the remote head it claims to advance`);
    if (!/^[1-9][0-9]*$/.test(commits)) errors.push(`${at} publishes ${commits} commits`);
    if (publication.Merge === 'fast-forward' && previous !== '—' && !SHA.test(previous)) errors.push(`${at} fast-forwarded from a previous head that is not a sha`);
    if (branch === '—') errors.push(`${at} names no branch`);
  }

  // Hooks are enforced, always, and pre-push is the last gate before the remote.
  const hookNames = hooks.map(([hook]) => hook);
  if (!hookNames.includes('pre-push')) errors.push('response/response.md: Hooks lacks the pre-push result; the last gate before the remote cannot be missing');
  for (const [hook, , outcome] of hooks) if (outcome !== 'passed') errors.push(`response/response.md: hook ${hook} is ${outcome}; a publication carrying a failed hook is HOOK_BLOCKED, not a receipt`);
  if (hooks.length && !findings.has('HOOK_ENFORCED')) errors.push('response/response.md: the hooks ran but the receipt records no HOOK_ENFORCED finding');

  // A tag exists exactly when the person asked for one, and it points at a head this run pushed.
  const pushedHeads = new Set(heads.map(([, , head]) => head));
  if (wantsTag) {
    if (tag.Tag === '—') errors.push('response/response.md: the request asked for a continuation tag and the receipt records none');
    else {
      const name = (requirements.tag?.name ?? '').toString();
      if (name && tag.Tag !== name) errors.push(`response/response.md: the tag is ${tag.Tag} but the request named ${name}`);
      if (!/^refs\/tags\//.test(tag.Ref ?? '')) errors.push('response/response.md: a continuation tag is annotated and lives under refs/tags/');
      if (!pushedHeads.has(tag.Head)) errors.push(`response/response.md: the tag points at ${tag.Head}, which this publication did not push`);
      if (!findings.has('CONTINUATION_TAG_PUBLISHED')) errors.push('response/response.md: a published tag must record CONTINUATION_TAG_PUBLISHED');
    }
  } else if (tag.Tag !== '—') errors.push('response/response.md: a continuation tag was published without the request asking for one');

  // The session that produced the merged branch is on disk, with the receipt that authorized it.
  if (response.status === 'done') {
    errors.push(...await sessionReceiptErrors(branchDir, { pushedHeads, sessionBranch: publication['Session branch'] ?? '' }));
  }

  // Session cleanup is a host lifecycle event, never a publication side effect.
  if (response.status === 'done' && !/(preserv|kept).*(host|session lifecycle)/i.test(publication.Cleanup ?? '')) errors.push('response/response.md: Cleanup must preserve the worktree, branch and folder for the host session lifecycle');
  if (/remov|delet|cleaned/i.test(publication.Cleanup ?? '')) errors.push('response/response.md: git.publish must not remove session evidence');

  // The commit the response registers is the commit the receipt published.
  const commits = new Set(response.commits ?? []);
  for (const head of pushedHeads) if (!commits.has(head)) errors.push(`response/response.json: commits does not register the published head ${head}`);
  for (const c of commits) if (!pushedHeads.has(c)) errors.push(`response/response.json: commits carries ${c}, which the receipt did not publish`);

  // The verified commit comes from the quality receipt, so the input must be there to compare against.
  if (response.status === 'done' && !(request?.inputs ?? {})['quality-verification']) errors.push('request.json: a publish needs the quality-verification input whose commit it pushes');
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateGitPublishStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid git.publish branch\n');
}
