// push.mjs - `starci app release push`: sends the default branch and the release tag to the remote in ONE atomic push through the repository's own
// pre-push hook (never --no-verify). It requires what the hook requires: an annotated release tag on HEAD and the L4 record of the gate for that
// head and tag. `git push --dry-run --atomic` always runs first (the hook's verdict is the proof) and any failure refuses the push.
// With --execute the exact sha first goes to its candidate ref refs/heads/release/candidate-<version> and the push waits for the ci.yml run of that sha
// (candidate-ci.mjs, OWNER RULING candidate-ci 2026-10-18): only a green candidate (or the owner's sha-bound override record) moves the branch and the tag.
import fs from 'node:fs';
import path from 'node:path';
import { firstLine } from '../stack/context.mjs';
import { failure, refusal } from '../stack/errors.mjs';
import { annotatedOnHead, git, refName, releaseDir } from './gate.mjs';
import { candidateRef, candidateStep } from './candidate-ci.mjs';

const VERDICT = /RIGHTS_PUSH_NOT_RELEASE|pre-push|failed to push|Everything up|->/u;

function readRecord(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const greenRecord = (record, head, tag) => record?.head === head && record?.tag === tag
  && Array.isArray(record.gates) && record.gates.length > 0 && record.gates.every((gate) => gate?.pass === true || (gate?.name === 'sonar' && gate?.skipped === true));

/** The release gate as the hook reads it: the annotated tag on HEAD whose L4 record names head and tag. Returns { tag } or { reason }. */
function gateState(ctx, head, prefix) {
  const tags = annotatedOnHead(ctx, prefix);
  if (tags.length === 0) return { reason: `no ANNOTATED tag ${prefix}[0-9]* on HEAD: run starci app release gate --execute first` };
  const file = path.join(releaseDir(ctx), `${head}.l4.json`);
  if (!fs.existsSync(file)) return { reason: `no L4 record ${file}: run starci app release gate --execute first` };
  const record = readRecord(file);
  const tag = tags.find((name) => greenRecord(record, head, name));
  return tag ? { tag } : { reason: `the L4 record does not name head ${head.slice(0, 10)} and one of ${tags.join(', ')} with every gate green` };
}

/** The remote branch tip, or null on an empty remote; an unreachable remote is a failure (the state cannot be judged). */
function remoteTip(ctx, remote, branch) {
  const listed = git(ctx, ['ls-remote', '--heads', remote, branch], { allowFail: true });
  if (listed.code !== 0) throw failure('RELEASE_REMOTE_UNREACHABLE', `cannot read ${remote}: ${firstLine(listed.stderr)}`);
  if (listed.stdout === '') return null;
  git(ctx, ['fetch', remote, branch, '--quiet']);
  return listed.stdout.split(/\s/u)[0];
}

const isAncestor = (ctx, older, newer) => git(ctx, ['merge-base', '--is-ancestor', older, newer], { allowFail: true }).code === 0;

/** The remote object of a tag ('' when absent). */
function remoteTagObject(ctx, remote, tag) {
  const wanted = `refs/tags/${tag}`;
  const listed = git(ctx, ['ls-remote', '--tags', remote, wanted], { allowFail: true }).stdout.split('\n');
  return listed.map((line) => line.split('\t')).find((parts) => parts[1] === wanted)?.[0] ?? '';
}

function branchRefs(ctx, { head, remote, branch }, red) {
  const tip = remoteTip(ctx, remote, branch);
  if (tip === null || isAncestor(ctx, tip, head)) return { refs: tip === head ? [] : [`${head}:refs/heads/${branch}`], tip };
  if (isAncestor(ctx, head, tip)) return { refs: [], tip };
  red.push(`${remote}/${branch} (${tip.slice(0, 10)}) is not an ancestor of HEAD: not a fast-forward; merge it first`);
  return { refs: [], tip };
}

function tagRefs(ctx, { remote, tag }, red) {
  const object = remoteTagObject(ctx, remote, tag);
  if (object === '') return [`refs/tags/${tag}`];
  if (object !== git(ctx, ['rev-parse', `refs/tags/${tag}`]).stdout) red.push(`tag ${tag} exists on ${remote} as a different object`);
  return [];
}

function probe(ctx, remote, refs, red) {
  const run = git(ctx, ['push', '--dry-run', '--atomic', remote, ...refs], { allowFail: true });
  const verdict = `${run.stderr}\n${run.stdout}`.split('\n').filter((line) => VERDICT.test(line)).slice(0, 4);
  if (run.code !== 0) red.push('the pre-push hook refuses this push as things stand');
  return { exit: run.code, lines: [`hook dry run  git push --dry-run --atomic: exit ${run.code}`, ...verdict.map((line) => `  ${line.slice(0, 200)}`)] };
}

const NAME_RULE = '^[A-Za-z0-9._/-]+$';

function assertNames(remote, branch) {
  if (!refName(remote)) throw refusal('RELEASE_USAGE', `--remote ${remote} must match ${NAME_RULE}`);
  if (!refName(branch)) throw refusal('RELEASE_USAGE', `the default branch ${branch} must match ${NAME_RULE}`);
}

const gateLine = (gate) => (gate.tag ? `release gate   OK: annotated ${gate.tag} on HEAD, L4 record names head and tag` : 'release gate   CLOSED (see RED below)');

/** A refusal result: the lines so far, every red item and a closing line; `data.red` lists the red items. */
const refuse = (out, red, data, closing) => ({ ok: false, lines: [...out, ...red.map((item) => `RED: ${item}`), closing], data: { ...data, red } });

/**
 * `starci app release push`. options: { execute, remote }. The remote and branch names are validated; the branch is the declared default branch.
 * Dry run (and --execute) first prove the push with `git push --dry-run --atomic`; --execute then pushes for real, still through the hook.
 */
export async function releasePush(ctx, config, options = {}) {
  const remote = options.remote ?? 'origin';
  const branch = config.defaultBranch;
  assertNames(remote, branch);
  const head = git(ctx, ['rev-parse', 'HEAD']).stdout;
  const gate = gateState(ctx, head, config.tagPrefix);
  const out = [`HEAD           ${head}`, gateLine(gate)];
  const data = { head, tag: gate.tag ?? null, remote, branch, refs: [], hook: null, pushed: false };
  if (!gate.tag) return refuse(out, [gate.reason], data, 'nothing pushed.');
  const red = [];
  const refs = [...branchRefs(ctx, { head, remote, branch }, red).refs, ...tagRefs(ctx, { remote, tag: gate.tag }, red)];
  data.refs = refs;
  const candidate = refs.length > 0 ? candidateRef(gate.tag, config.tagPrefix) : null;
  if (candidate) out.push(`plan           git push ${remote} +${head.slice(0, 10)}:${candidate}, wait for its ci.yml run to be green, then git push --atomic ${remote} ${refs.join(' ')}`);
  else out.push(`plan           git push --atomic ${remote} (nothing)`);
  if (refs.length === 0 && red.length === 0) return { ok: true, lines: [...out, `already pushed: ${remote}/${branch} holds HEAD and ${gate.tag} is on ${remote}. Nothing to do.`], data };
  if (refs.length > 0) {
    const hook = probe(ctx, remote, refs, red);
    data.hook = { exit: hook.exit };
    out.push(...hook.lines);
  }
  if (red.length > 0) return refuse(out, red, data, options.execute === true ? 'nothing pushed.' : 'dry run: nothing pushed.');
  if (options.execute !== true) return { ok: true, lines: [...out, 'dry run: nothing pushed. ready; re-run with --execute.'], data };
  const judged = await candidateStep(ctx, { head, tag: gate.tag, prefix: config.tagPrefix, remote, wait: options.candidateWait });
  data.candidate = judged.data;
  out.push(...judged.lines);
  if (!judged.ok) return { ok: false, lines: [...out, `nothing pushed to ${branch} or ${gate.tag}.`], data };
  const run = git(ctx, ['push', '--atomic', remote, ...refs], { allowFail: true });
  if (run.code !== 0) return { ok: false, lines: [...out, `push failed: ${firstLine(run.stderr)}`], data };
  return { ok: true, lines: [...out, `pushed to ${remote}: ${refs.join(' ')}`], data: { ...data, pushed: true } };
}
