// docker-build.mjs - `starci docker build`: one declared app, app-root context, deterministic local tag, never push/login.
import fs from 'node:fs';
import path from 'node:path';
import { build as realDockerBuild } from '../api/docker/build.mjs';
import { resultDetail as detail, resultOk as success } from '../lib/verb-call.mjs';
import { DOCKER_PORT_POLICY, isForeignContainer } from './docker-policy.mjs';
import { underHostLock } from './verb-lock.mjs';

/** Build one be/fe app declared by hfs.json from the application root. */
export async function dockerBuild(ctx, deps = {}) {
  const cwd = path.resolve(ctx.cwd ?? process.cwd());
  const [app, ...extra] = ctx.positionals ?? [];
  if (!app || extra.length || !/^[a-z0-9][a-z0-9-]*$/.test(String(app))) return { code: 2, stderr: 'starci docker build: app must be one kebab-case name' };
  let declaration;
  try { declaration = JSON.parse(fs.readFileSync(path.join(cwd, 'hfs.json'), 'utf8')); }
  catch (error) { return { code: 2, stderr: `starci docker build: the app root needs a readable hfs.json (${error.message})` }; }
  const project = String(declaration?.project ?? '');
  const matches = ['be', 'fe'].flatMap((side) => (declaration?.sides?.[side]?.apps ?? []).filter((entry) => entry?.name === app).map(() => side));
  if (declaration?.kind !== 'app' || !/^[a-z0-9][a-z0-9-]*$/.test(project)) return { code: 2, stderr: 'starci docker build: hfs.json must declare kind app and a kebab-case project' };
  if (matches.length !== 1) return { code: 2, stderr: `starci docker build: ${app} must be declared exactly once under sides.be.apps or sides.fe.apps` };
  const tagName = String(ctx.args?.tag ?? 'dev');
  if (!/^\w[\w.-]{0,127}$/.test(tagName)) return { code: 2, stderr: 'starci docker build: --tag is not a valid Docker tag' };
  const tag = `${project}/${app}:${tagName}`;
  if (isForeignContainer(tag)) return {
    code: 2,
    stderr: `${DOCKER_PORT_POLICY}: image ${tag} belongs to a protected installation and is foreign`,
    data: { schema: 'starci/docker-refusal@1', ok: false, code: DOCKER_PORT_POLICY, message: `image ${tag} is foreign` },
  };
  const dockerfile = path.join(matches[0], 'apps', app, 'Dockerfile').split(path.sep).join('/');
  if (!fs.existsSync(path.join(cwd, dockerfile))) return { code: 2, stderr: `starci docker build: declared app ${app} has no ${dockerfile}` };
  try {
    const run = async () => {
      const result = await (deps.dockerBuild ?? realDockerBuild)({ dockerfile, tag, noCache: ctx.args?.['no-cache'] === true }, { cwd });
      if (!success(result)) return { code: 1, stderr: `starci docker build: ${detail(result) || `docker exited ${result?.status ?? 'without a status'}`}` };
      return { code: 0, text: `starci docker build: built ${tag}`, data: { schema: 'starci/docker-build@1', project, app, tag, dockerfile, context: cwd } };
    };
    const locked = await (deps.underHostLock ?? underHostLock)({ role: ctx.role ?? 'owner', purpose: 'docker-build', env: ctx.env }, run, deps);
    if (locked?.ok === true && Object.hasOwn(locked, 'value')) return locked.value;
    if (locked?.ok === false && locked?.code === undefined) return { code: 1, stderr: `starci docker build: host lock refused (${locked.reason ?? 'held'})` };
    return locked;
  } catch (error) { return { code: 1, stderr: `starci docker build: host lock failed (${error.message})` }; }
}
