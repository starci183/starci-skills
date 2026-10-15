// build.mjs - `starci app stack build --env <env> [--push] [--execute]`: builds, from the CURRENT checkout, every image the deploy block declares
// (docker buildx, linux/amd64, no provenance so the digest is one manifest), passing the public build values of build-args.mjs, and prints
// `--image <service>=<registry/name@sha256:digest>` lines ready for `stack deploy`. It refuses a dirty tree and a HEAD that carries no release tag
// (the images must come from the released commit). It never reads registry credentials: pushing uses the operator's own `docker login`.
// The image name is `ghcr.io/<owner>/<project>-<app>:<full sha>`, the owner being the GitHub owner of `origin`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArgs } from './build-args.mjs';
import { firstLine, lines as splitLines, tool } from './context.mjs';
import { failure, refusal } from './errors.mjs';

const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const GITHUB_REMOTE = /github\.com[:/]([A-Za-z0-9._-]+)\/[A-Za-z0-9._-]+?(?:\.git)?$/u;
const BUILD_ARG = /^([A-Z][A-Z0-9_]*)=(.*)$/u;
const SIDES = ['be', 'fe'];

const git = (ctx, config, args) => tool(ctx, 'git', args, { cwd: config.repoRoot });

/** The release facts of the checkout: { sha, tag } or a refusal (dirty tree, no release tag). */
function checkout(ctx, config) {
  const status = git(ctx, config, ['status', '--porcelain']);
  if (status.status !== 0) throw failure('STACK_BUILD_GIT', `git status failed: ${firstLine(status.stderr)}`);
  const dirty = splitLines(status.stdout);
  if (dirty.length > 0) throw refusal('STACK_BUILD_DIRTY', `the working tree is not clean (${dirty.length} path(s), first: ${dirty[0]}): images must come from the released commit`);
  const sha = splitLines(git(ctx, config, ['rev-parse', 'HEAD']).stdout)[0] ?? '';
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw failure('STACK_BUILD_GIT', 'cannot read HEAD');
  const tag = splitLines(git(ctx, config, ['tag', '--points-at', 'HEAD']).stdout).find((name) => RELEASE_TAG.test(name));
  if (!tag) throw refusal('STACK_BUILD_UNTAGGED', 'HEAD carries no release tag (vMAJOR.MINOR.PATCH): build only the released commit');
  return { sha, tag };
}

function ownerOf(ctx, config) {
  const remote = git(ctx, config, ['remote', 'get-url', 'origin']);
  const match = GITHUB_REMOTE.exec(firstLine(remote.stdout));
  if (remote.status !== 0 || !match) throw refusal('STACK_BUILD_OWNER', 'origin is not a github.com remote: the image owner cannot be derived');
  return match[1].toLowerCase();
}

/** The Dockerfile of an app: be/apps/<app>/Dockerfile or fe/apps/<app>/Dockerfile; ambiguity and absence are refusals. */
function dockerfileOf(config, app) {
  const found = SIDES.map((side) => `${side}/apps/${app}/Dockerfile`).filter((file) => fs.existsSync(path.join(config.repoRoot, file)));
  if (found.length === 0) throw refusal('STACK_BUILD_NO_DOCKERFILE', `no Dockerfile for app ${app} (be/apps/${app}/Dockerfile or fe/apps/${app}/Dockerfile)`);
  if (found.length > 1) throw refusal('STACK_BUILD_AMBIGUOUS', `app ${app} has a Dockerfile on both sides: ${found.join(', ')}`);
  return found[0];
}

async function argsOf(ctx, config, app, hasBuildArgs) {
  if (!hasBuildArgs) return [];
  const result = await buildArgs(ctx, config, { app });
  return result.lines.map((line) => BUILD_ARG.exec(line)).filter(Boolean).map((match) => [match[1], match[2]]);
}

function plan(config, { sha, owner }) {
  return Object.entries(config.images).map(([service, entry]) => ({
    service,
    app: entry.app,
    dockerfile: dockerfileOf(config, entry.app),
    ref: `ghcr.io/${owner}/${config.project}-${entry.app}:${sha}`,
    hasBuildArgs: Object.keys(entry.buildArgs.values).length > 0 || entry.buildArgs.sealed !== null,
  }));
}

function buildOne(ctx, config, item, args, push) {
  const metadata = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stack-build-')), 'metadata.json');
  const argv = ['buildx', 'build', '--platform', 'linux/amd64', '--provenance=false', '--file', item.dockerfile, '--tag', item.ref, '--metadata-file', metadata,
    ...args.flatMap(([key, value]) => ['--build-arg', `${key}=${value}`]), push ? '--push' : '--load', '.'];
  const run = tool(ctx, 'docker', argv, { cwd: config.repoRoot });
  let digest = null;
  try { digest = JSON.parse(fs.readFileSync(metadata, 'utf8'))['containerimage.digest'] ?? null; } catch { digest = null; }
  fs.rmSync(path.dirname(metadata), { recursive: true, force: true });
  if (run.status !== 0) return { ok: false, error: firstLine(run.stderr) || 'docker buildx failed' };
  return { ok: true, digest };
}

/** `build`: dry run unless execute; pushing needs --push as well. */
export async function buildImages(ctx, config, { push = false, execute = false } = {}) {
  if (Object.keys(config.images).length === 0) throw refusal('STACK_BUILD_NO_IMAGES', 'the deploy block declares no images');
  const release = checkout(ctx, config);
  const items = plan(config, { sha: release.sha, owner: ownerOf(ctx, config) });
  const lines = [`release ${release.tag} at ${release.sha.slice(0, 12)}: ${items.length} image(s)`, ...items.map((item) => `  ${item.service}: ${item.dockerfile} -> ${item.ref}`)];
  if (!execute) return { ok: true, lines: [...lines, `dry run: would build${push ? ' and push' : ' (local only, no digest without --push)'}; nothing was built`], data: { tag: release.tag, images: {} } };
  const images = {};
  for (const item of items) {
    const outcome = buildOne(ctx, config, item, await argsOf(ctx, config, item.app, item.hasBuildArgs), push);
    if (!outcome.ok) return { ok: false, lines: [...lines, `build of ${item.service} FAILED: ${outcome.error}`], data: { tag: release.tag, images } };
    if (push && !outcome.digest) return { ok: false, lines: [...lines, `${item.service} was pushed but docker reported no digest`], data: { tag: release.tag, images } };
    if (push) images[item.service] = `${item.ref.slice(0, item.ref.lastIndexOf(':'))}@${outcome.digest}`;
    lines.push(push ? `pushed ${item.service}: ${images[item.service]}` : `built ${item.service} (local image ${item.ref}; push it with --push to get a digest)`);
  }
  if (push) lines.push('', 'for the deploy:', `${Object.entries(images).map(([service, ref]) => `--image ${service}=${ref}`).join(' ')} --source-sha ${release.sha}`);
  return { ok: true, lines, data: { tag: release.tag, sha: release.sha, images } };
}
