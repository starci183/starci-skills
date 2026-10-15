// build.mjs - `starci app stack build --env <env> [--push] [--execute]`: builds, from the CURRENT checkout, every image the deploy block declares
// (docker buildx, linux/amd64, no provenance so the digest is one manifest), passing the public build values of build-args.mjs, and prints
// `--image <service>=<registry/name@sha256:digest>` lines ready for `stack deploy`. It refuses a dirty tree and a HEAD that carries no release tag
// (the images must come from the released commit). It never reads registry credentials: pushing uses the operator's own `docker login`.
// The image name is `<registry host>/<owner>/<project>-<app>:<full sha>`, the owner being the GitHub owner of `origin` (ghcr.io only).
// With deploy.registry.visibility `public` (the default) every image is scanned for secret material BEFORE it is pushed (image-scan.mjs: the layers of
// a public package are public), and after the push the real visibility of the package is checked with an ANONYMOUS manifest fetch of the pushed
// digest; a package that is still private is reported with the one owner step that changes it (GitHub has no API for that) and the run fails.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildArgs } from './build-args.mjs';
import { firstLine, lines as splitLines, tool } from './context.mjs';
import { failure, refusal } from './errors.mjs';
import { requireAgeIdentity } from './sealed.mjs';
import { scanImage } from './image-scan.mjs';

const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const GITHUB_REMOTE = /github\.com[:/]([A-Za-z0-9._-]+)\/[A-Za-z0-9._-]+?(?:\.git)?$/u;
const BUILD_ARG = /^([A-Z][A-Z0-9_]*)=(.*)$/u;
const SIDES = ['be', 'fe'];
const MAX_HITS_SHOWN = 20;
const MANIFEST_TYPES = ['application/vnd.oci.image.index.v1+json', 'application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json', 'application/vnd.docker.distribution.manifest.v2+json'];

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
    ref: `${config.registry.host}/${owner}/${config.project}-${entry.app}:${sha}`,
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

/** `docker push` of a scanned local image; the digest is the one docker prints. */
function pushOne(ctx, config, item) {
  const run = tool(ctx, 'docker', ['push', item.ref], { cwd: config.repoRoot });
  if (run.status !== 0) return { ok: false, error: firstLine(run.stderr) || 'docker push failed' };
  return { ok: true, digest: /digest:\s*(sha256:[0-9a-f]{64})/u.exec(String(run.stdout))?.[1] ?? null };
}

function scanRefusal(item, scan) {
  const shown = scan.hits.slice(0, MAX_HITS_SHOWN).map((hit) => `  ${hit.kind}: ${hit.where} (${hit.why})`);
  const more = scan.hits.length > MAX_HITS_SHOWN ? [`  ... and ${scan.hits.length - MAX_HITS_SHOWN} more`] : [];
  const head = `REFUSED to push ${item.service}: the image would be public and the scan found ${scan.hits.length} hit(s) and ${scan.errors.length} failed step(s) (places only, never the text)`;
  return [head, ...shown, ...more, ...scan.errors.map((error) => `  scan error: ${error}`)];
}

/** One image: built (and pushed in the same step when private); built, scanned and only then pushed when public. Returns { ok, digest, lines }. */
function processImage(ctx, config, item, args, { push }) {
  const isPublic = config.registry.visibility === 'public';
  const built = buildOne(ctx, config, item, args, push && !isPublic);
  if (!built.ok) return { ok: false, lines: [`build of ${item.service} FAILED: ${built.error}`] };
  if (!isPublic) return { ok: true, digest: built.digest, lines: [] };
  const scan = scanImage(ctx, item.ref, { allowedArgs: args.map(([key]) => key) });
  if (!scan.ok) return { ok: false, lines: scanRefusal(item, scan) };
  const clean = `scanned ${item.service}: no secret material found`;
  if (!push) return { ok: true, digest: null, lines: [clean] };
  const pushed = pushOne(ctx, config, item);
  if (!pushed.ok) return { ok: false, lines: [clean, `push of ${item.service} FAILED: ${pushed.error}`] };
  return { ok: true, digest: pushed.digest, lines: [clean] };
}

const ownerStep = (name) => `owner step: GitHub -> Packages -> ${name} -> Package settings -> Change visibility -> Public (GitHub has no API for this)`;

/** 'public' when an ANONYMOUS client can fetch the manifest of the pushed digest, 'private' when the registry refuses it, 'unknown' on a network error. */
export async function visibilityOf(ctx, host, repository, digest) {
  try {
    const token = await ctx.fetch(`https://${host}/token?scope=repository:${repository}:pull&service=${host}`, { signal: AbortSignal.timeout(15000) });
    const bearer = token.ok ? (await token.json()).token : null;
    const headers = { Accept: MANIFEST_TYPES.join(', '), ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) };
    const manifest = await ctx.fetch(`https://${host}/v2/${repository}/manifests/${digest}`, { headers, signal: AbortSignal.timeout(15000) });
    return manifest.status === 200 ? 'public' : 'private';
  } catch {
    return 'unknown';
  }
}

/** After the push: the real visibility of every pushed package against the declared one. Returns { ok, lines, actual }. */
async function checkVisibility(ctx, config, images) {
  const declared = config.registry.visibility;
  const lines = [];
  const actual = {};
  let ok = true;
  for (const [service, ref] of Object.entries(images)) {
    const [name, digest] = ref.split('@');
    const repository = name.slice(config.registry.host.length + 1);
    const packageName = repository.slice(repository.indexOf('/') + 1);
    actual[service] = await visibilityOf(ctx, config.registry.host, repository, digest);
    if (actual[service] === 'unknown') lines.push(`visibility of ${packageName} could not be checked (network)`);
    else if (actual[service] === declared) lines.push(`visibility of ${packageName}: ${actual[service]}, as declared`);
    else if (declared === 'public') {
      ok = false;
      lines.push(`visibility of ${packageName} is PRIVATE but deploy.registry.visibility is public`, ownerStep(packageName));
    } else lines.push(`note: ${packageName} is public although deploy.registry.visibility is private; change it in Package settings or declare public`);
  }
  return { ok, lines, actual };
}

/** `build`: dry run unless execute; pushing needs --push as well. */
export async function buildImages(ctx, config, { push = false, execute = false } = {}) {
  if (Object.keys(config.images).length === 0) throw refusal('STACK_BUILD_NO_IMAGES', 'the deploy block declares no images');
  if (config.registry.host !== 'ghcr.io') throw refusal('STACK_BUILD_REGISTRY', `build supports ghcr.io only (deploy.registry.host is ${config.registry.host})`);
  const release = checkout(ctx, config);
  const items = plan(config, { sha: release.sha, owner: ownerOf(ctx, config) });
  const lines = [`release ${release.tag} at ${release.sha.slice(0, 12)}: ${items.length} image(s), registry ${config.registry.host} (${config.registry.visibility})`, ...items.map((item) => `  ${item.service}: ${item.dockerfile} -> ${item.ref}`)];
  if (!execute) {
    const scan = config.registry.visibility === 'public' ? ', scan for secret material' : '';
    return { ok: true, lines: [...lines, `dry run: would build${scan}${push ? ' and push' : ' (local only, no digest without --push)'}; nothing was built`], data: { tag: release.tag, images: {} } };
  }
  if (items.some((item) => config.images[item.service].buildArgs.sealed !== null)) requireAgeIdentity(ctx, config, 'build');
  const images = {};
  for (const item of items) {
    const outcome = processImage(ctx, config, item, await argsOf(ctx, config, item.app, item.hasBuildArgs), { push });
    lines.push(...outcome.lines);
    if (!outcome.ok) return { ok: false, lines, data: { tag: release.tag, images } };
    if (push && !outcome.digest) return { ok: false, lines: [...lines, `${item.service} was pushed but docker reported no digest`], data: { tag: release.tag, images } };
    if (push) images[item.service] = `${item.ref.slice(0, item.ref.lastIndexOf(':'))}@${outcome.digest}`;
    lines.push(push ? `pushed ${item.service}: ${images[item.service]}` : `built ${item.service} (local image ${item.ref}; push it with --push to get a digest)`);
  }
  const visibility = push ? await checkVisibility(ctx, config, images) : { ok: true, lines: [], actual: {} };
  lines.push(...visibility.lines);
  if (push) lines.push('', 'for the deploy:', `${Object.entries(images).map(([service, ref]) => `--image ${service}=${ref}`).join(' ')} --source-sha ${release.sha}`);
  return { ok: visibility.ok, lines, data: { tag: release.tag, sha: release.sha, images, visibility: visibility.actual } };
}
