// release-proof-images.mjs - build, boot, health-check, and tear down every selected shipped image, sequentially.
import fs from 'node:fs';
import path from 'node:path';
import { proofBuild as realBuild } from '../api/docker/proof-build.mjs';
import { containerRm as realContainerRemove } from '../api/docker/container-rm.mjs';
import { proofImageInspect as realImageInspect } from '../api/docker/proof-image-inspect.mjs';
import { resourceRemove } from '../api/docker/resource-remove.mjs';
import { proofRun as realRun } from '../api/docker/proof-run.mjs';
import { containerInspect as realContainerInspect } from '../api/docker/container-inspect.mjs';
import { asList } from '../lib/list.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';
import { protectedPortsInText } from '../lib/protected-installations.mjs';
import { resultDetail, resultOk } from '../lib/verb-call.mjs';
import { isForeignContainer } from '../machine/docker-policy.mjs';
import { underHostLock } from '../machine/verb-lock.mjs';

const text = (result) => String(result?.stdout ?? '').trim();
const commaList = (value, fallback) => {
  const values = asList(value === undefined ? fallback : value);
  return values.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
};

/** `starci release images`: release-image build/run/health/teardown proof with exact-id cleanup. */
export async function releaseProofImages(ctx, deps = {}) {
  const success = (result) => resultOk(result, { acceptOk: false });
  const failure = (result) => resultDetail(result, { limit: null, lastLine: true });
  if ((ctx.positionals ?? []).length) return { code: 2, stderr: 'starci release images: no positional arguments are accepted' };
  const root = path.resolve(ctx.cwd ?? process.cwd(), ctx.args?.app ?? '.');
  let declaration;
  try { declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8')); }
  catch (error) { return { code: 2, stderr: `starci release images: --app must name an app root (${error.message})` }; }
  if (!fs.existsSync(path.join(root, 'package.json'))) return { code: 2, stderr: 'starci release images: --app must contain package.json' };
  const project = String(declaration?.project ?? '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(project) || isForeignContainer(project)) return { code: 2, stderr: 'starci release images: the project name is invalid or belongs to a protected installation' };
  const sides = commaList(ctx.args?.sides, ['be', 'fe']);
  if (sides.some((side) => !['be', 'fe'].includes(side))) return { code: 2, stderr: 'starci release images: --sides accepts only be and fe' };
  const only = new Set(commaList(ctx.args?.only, []));
  const images = [];
  for (const side of sides) {
    const apps = path.join(root, side, 'apps');
    if (!fs.existsSync(apps)) continue;
    for (const entry of fs.readdirSync(apps, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const dockerfile = path.join(side, 'apps', entry.name, 'Dockerfile');
      if (!entry.isDirectory() || !fs.existsSync(path.join(root, dockerfile)) || (only.size && !only.has(entry.name))) continue;
      if (isForeignContainer(entry.name)) return { code: 2, stderr: `starci release images: refusing foreign image name ${entry.name}` };
      const protectedPorts = protectedPortsInText(fs.readFileSync(path.join(root, dockerfile), 'utf8'));
      if (protectedPorts.length) return { code: 2, stderr: `starci release images: ${dockerfile} names protected port ${protectedPorts[0]}` };
      images.push({ side, app: entry.name, dockerfile: dockerfile.split(path.sep).join('/'), tag: `${project}/${entry.name}:dev` });
    }
  }
  if (!images.length) return { code: 2, stderr: 'starci release images: no selected Dockerfile was found' };

  const build = deps.proofBuild ?? realBuild;
  const imageInspect = deps.proofImageInspect ?? realImageInspect;
  const run = deps.proofRun ?? realRun;
  const inspect = deps.containerInspect ?? realContainerInspect;
  const removeContainer = deps.proofContainerRemove ?? realContainerRemove;
  const removeImage = deps.proofImageRemove ?? ((tag) => resourceRemove('image', [tag]));
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const waitSeconds = Number(ctx.args?.['wait-seconds'] ?? 90);
  if (!Number.isFinite(waitSeconds) || waitSeconds < 10) return { code: 2, stderr: 'starci release images: --wait-seconds must be at least 10' };
  const results = [];
  const operation = async () => {
    for (const image of images) {
      const row = { ...image, ok: false, imageId: null, size: null, health: null, running: false, teardown: false };
      const built = await build({ dockerfile: image.dockerfile, tag: image.tag }, { cwd: root });
      if (!success(built)) { row.error = `build failed: ${failure(built) || (built?.status ?? 'unknown')}`; results.push(row); continue; }
      const meta = await imageInspect(image.tag);
      if (!success(meta)) { row.error = `image inspect failed: ${failure(meta) || (meta?.status ?? 'unknown')}`; results.push(row); continue; }
      [row.imageId, row.size] = text(meta).split('|');
      const started = await run({ tag: image.tag, project });
      const container = text(started);
      if (!success(started) || !container || isForeignContainer(container)) { row.error = `run failed: ${failure(started) || 'no container id'}`; results.push(row); continue; }
      try {
        const attempts = Math.max(2, Math.ceil(waitSeconds / 5));
        await repeatInOrder(async (attempt) => {
          if (attempt > attempts) return true;
          const health = await inspect(container, '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealthcheck{{end}}');
          const running = await inspect(container, '{{.State.Running}}');
          row.health = text(health); row.running = text(running) === 'true';
          if (row.health === 'healthy' || (row.health === 'nohealthcheck' && row.running && attempt >= 2)) { row.ok = true; return true; }
          if (row.health === 'unhealthy' || !row.running || attempt === attempts) return true;
          await sleep(5_000);
        });
        if (!row.ok) row.error = `container not healthy (${row.health ?? 'unknown'}, running=${row.running})`;
      } finally {
        const removed = await removeContainer(container);
        row.teardown = success(removed);
        if (!row.teardown) { row.ok = false; row.error = `teardown failed: ${failure(removed) || (removed?.status ?? 'unknown')}`; }
      }
      if (ctx.args?.['remove-images'] === true) {
        const removed = await removeImage(image.tag);
        if (!success(removed)) { row.ok = false; row.error = `image removal failed: ${failure(removed) || (removed?.status ?? 'unknown')}`; }
      }
      results.push(row);
    }
    return { code: results.every((row) => row.ok) ? 0 : 1 };
  };
  let outcome;
  try {
    const locked = await (deps.underHostLock ?? underHostLock)({ role: ctx.role ?? 'release', purpose: 'release-images', env: ctx.env }, operation, deps);
    if (locked?.ok === true && Object.hasOwn(locked, 'value')) outcome = locked.value;
    else if (locked?.ok === false && locked?.code === undefined) outcome = { code: 1, stderr: `starci release images: host lock refused (${locked.reason ?? 'held'})` };
    else outcome = locked;
  } catch (error) { outcome = { code: 1, stderr: `starci release images: ${error.message}` }; }
  const passed = results.filter((row) => row.ok).length;
  return { ...outcome, text: `starci release images: ${passed}/${images.length} images passed`, data: { schema: 'starci/release-images@1', project, images: results } };
}
