// stack-release-fakes.mjs - the app tree and sealed members the render/provision/build-args/sealed specs share (worker A).
// makeApp({ members, mutate }) writes a tiny app into a temp directory (hfs.json, application-stacks.yaml with a deploy block, the stack
// source, config files, empty `.enc` stand-ins) and returns { root, config, host, sops, ctx(extra), dispose }. Neutral names only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../../packages/hfs/runtime/engine/yaml.mjs';
import { loadDeployConfig } from '../../packages/hfs/stack/config.mjs';
import { fakeHost, fakeSops } from './stack-fakes.mjs';

export const IMAGE_API = `registry.example/team/app-api@sha256:${'a1'.repeat(32)}`;
export const IMAGE_WEB = `registry.example/team/app-web@sha256:${'b2'.repeat(32)}`;
export const ZERO = `registry.example/team/app-api@sha256:${'0'.repeat(64)}`;
export const SOURCE_SHA = 'abcdef0123456789abcdef0123456789abcdef01';

export const MEMBERS = {
  api: { DATABASE_URL: 'db-secret-value', API_TOKEN: 'api-token-value', EXTRA_FILE: 'ignored-file-pointer', lower_case: 'ignored-name', EMPTY_ONE: '' },
  auth: { SESSION_KEY: 'session-secret-value' },
  shared: { TOKEN: 'shared-token-value', PROVIDER_KEY: 'provider-secret-value', MODEL: 'model-x', ALERT_MAX: '30' },
  web: { PUBLIC_KEY: 'public-key-value' },
};

const STACK_SOURCE = {
  services: { api: { deploy: { replicas: 1 }, configs: [{ source: 'routes', target: '/etc/routes.yml' }] }, web: { deploy: { replicas: 1 } }, worker: { deploy: { replicas: 1 } } },
  configs: { routes: { external: true, name: '${APP_CFG_ROUTES}' } },
};

const deployBlock = () => ({
  images: {
    api: { app: 'api' },
    web: { app: 'web', buildArgs: { values: { PUBLIC_URL: 'https://app.example.test' }, sealed: { member: 'web', keys: ['PUBLIC_KEY'] } } },
  },
  secrets: {
    grants: [
      { service: 'api', filePointers: true, from: [{ member: 'api' }, { member: 'auth' }, { member: 'shared', keys: ['TOKEN'], fill: true }] },
      { service: 'worker', from: [{ member: 'shared', keys: ['TOKEN'], required: true }, { member: 'shared', keys: ['PROVIDER_KEY', 'ABSENT_KEY'] }] },
    ],
    settings: { member: 'shared', keys: ['MODEL', 'ALERT_MAX', 'ABSENT_SETTING'] },
  },
  environment: {
    api: {
      files: ['infra/swarm/api-public.conf'],
      values: { PORT: '8787', PRICE: '$5' },
      settings: { ALERT_LIMIT: { key: 'ALERT_MAX', default: '20' }, MODEL_NAME: { key: 'MODEL' }, FALLBACK: { key: 'ABSENT_SETTING', default: 'dflt' }, NOTHING: { key: 'ABSENT_SETTING' } },
    },
  },
  configs: [{ name: 'routes', file: 'infra/swarm/routes.yml', env: 'APP_CFG_ROUTES' }],
  passEnv: ['CONTACT_EMAIL'],
  verify: {
    http: [{ name: 'api liveness', url: 'https://api.example.test/healthz' }],
    exec: [{ name: 'jobs check', service: 'api', command: ['node', 'cli.js'] }],
  },
});

/** A temp app tree plus fakes. `mutate(deploy, stackSource)` edits the declarations before they are written. */
export function makeApp({ members = MEMBERS, mutate = () => {}, overrides, files = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stack-'));
  const deploy = deployBlock();
  const source = structuredClone(STACK_SOURCE);
  mutate(deploy, source);
  const envDir = path.join(root, '.starcistacks', 'production');
  const put = (rel, text, base = envDir) => {
    const file = path.join(base, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  put('hfs.json', JSON.stringify({ project: 'app' }), root);
  put('application-stacks.yaml', stringifyYaml({ environments: { production: { runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'], deploy } } }), path.join(root, '.starcistacks'));
  put('infra/swarm/stack.yaml', stringifyYaml(source));
  put('infra/swarm/api-public.conf', 'LOG_LEVEL=info\nBROKEN LINE\nPORT=1111\n');
  put('infra/swarm/routes.yml', 'routes: []\n');
  for (const [rel, text] of Object.entries(files)) put(rel, text);
  for (const name of Object.keys(members)) put(`secrets/${name}.enc`, '{"sops":{}}\n');
  const host = fakeHost({ overrides, fileReader: (file) => fs.readFileSync(file, 'utf8') });
  const sops = fakeSops({ members });
  return {
    root,
    config: loadDeployConfig({ repoRoot: root, env: 'production' }),
    host,
    sops,
    ctx: (extra = {}) => host.ctx({ cwd: root, sops, env: { STARCI_SECRET_VERSION_KEY: 'fixture-version-key' }, ...extra }),
    dispose: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

/** Every string a spec must keep secret-free: all values of the members. */
export const secretValues = (members = MEMBERS) => Object.values(members).flatMap((map) => Object.values(map)).filter(Boolean);
