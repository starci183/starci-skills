// stack-app.mjs - builds a throwaway app tree for the stack verb specs: hfs.json, application-stacks.yaml (with an optional `deploy`
// block), the stack source, a public env file and two sealed members. The caller removes the trees with `removeApps()` in `after`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const roots = [];

export const STACK_SOURCE = `services:\n  api:\n    image: registry.example/team/app-api@sha256:${'a'.repeat(64)}\n  web:\n    image: registry.example/team/app-web@sha256:${'b'.repeat(64)}\n`;

export function buildApp({ deploy, runtime = 'docker-swarm', declaration, stack = STACK_SOURCE, withSecrets = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-app-'));
  roots.push(root);
  const env = path.join(root, '.starcistacks', 'production');
  fs.mkdirSync(path.join(env, 'infra', 'swarm'), { recursive: true });
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'demo', edition: 'lite' }));
  fs.writeFileSync(path.join(env, 'infra', 'swarm', 'stack.yaml'), stack);
  fs.writeFileSync(path.join(env, 'infra', 'swarm', 'public.conf'), 'MODE=production\n');
  if (withSecrets) {
    fs.mkdirSync(path.join(env, 'secrets'), { recursive: true });
    for (const slug of ['api', 'stack']) fs.writeFileSync(path.join(env, 'secrets', `${slug}.enc`), 'sealed');
    fs.writeFileSync(path.join(env, 'secrets', 'README.md'), 'not a member');
  }
  const deployLine = deploy === undefined ? '' : `    deploy: ${JSON.stringify(deploy)}\n`;
  const text = declaration ?? `schema: starci/application-stacks@1\nenvironments:\n  production:\n    status: supported\n    runtime: ${runtime}\n    composeFiles: [infra/swarm/stack.yaml]\n${deployLine}`;
  fs.writeFileSync(path.join(root, '.starcistacks', 'application-stacks.yaml'), text);
  return root;
}

/** Registers a directory made by the spec itself for removal. */
export const trackDirectory = (dir) => { roots.push(dir); return dir; };

export function removeApps() {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
}
