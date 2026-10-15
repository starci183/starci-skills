// proves: HFS_DOCKER_STAGES@lite
// proves: HFS_DOCKER_STAGES@full
// proves: HFS_DOCKER_ENTRY@lite
// proves: HFS_DOCKER_ENTRY@full
// proves: HFS_DOCKER_BASE_PIN@lite
// proves: HFS_DOCKER_BASE_PIN@full
// proves: HFS_DOCKER_SECRETS@lite
// proves: HFS_DOCKER_SECRETS@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { imageFiles } from '../../packages/hfs/sync/index.mjs';
import { dockerFindings, NODE_IMAGE } from '../../scripts/hfs/rules/docker.mjs';

const API = 'be/apps/api/Dockerfile';
const WORKER = 'be/apps/jobs/Dockerfile';
const CLI = 'be/apps/cli/Dockerfile';
const NEXT = 'fe/apps/web/Dockerfile';
const CONFIG = 'fe/apps/web/next.config.ts';

function fixture(t, edition, mutation) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const repoRoot = fs.mkdtempSync(path.join(temporaryRoot, 'hfs-docker-legacy-'));
  t.after(() => {
    const resolved = path.resolve(repoRoot);
    assert.equal(path.dirname(resolved), temporaryRoot);
    assert.ok(path.basename(resolved).startsWith('hfs-docker-legacy-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const repo = {
    hfs: 3, kind: 'app', project: 'proof', edition,
    sides: {
      be: { kinds: ['api', 'worker', 'cli'], apps: [
        { name: 'api', kind: 'api' }, { name: 'jobs', kind: 'worker' }, { name: 'cli', kind: 'cli' },
      ] },
      fe: { apps: [{ name: 'web', kind: 'next' }] },
    },
  };
  // Lite may opt into its Next image; both editions use the actual scaffold renderer.
  const files = imageFiles(repo, { hasImage: () => true });
  files.push({ path: CONFIG, content: 'export default { output: "standalone" };\n' });
  for (const file of files) {
    let content = file.content;
    if (mutation?.path === file.path) {
      assert.ok(content.includes(mutation.from), `fixture source missing ${mutation.from}`);
      content = content.replace(mutation.from, mutation.to);
    }
    const target = path.join(repoRoot, ...file.path.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { repoRoot, repo, files: files.map((file) => file.path) };
}

const judged = (t, edition, code, mutation) => dockerFindings(fixture(t, edition, mutation))
  .filter((finding) => finding.code === code).map((finding) => finding.code);
const change = (file, from, to) => ({ path: file, from, to });

for (const edition of ['lite', 'full']) {
  test(`${edition} accepts valid image stages and rejects invalid stage discipline`, (t) => {
    assert.deepEqual(judged(t, edition, 'HFS_DOCKER_STAGES'), []);
    const invalid = [
      change(CLI, 'AS build', 'AS compilation'),
      change(CLI, 'AS runtime', 'AS final'),
      change(CLI, 'USER node', 'USER root'),
      change(CLI, 'RUN npm ci --ignore-scripts', 'RUN npm install'),
      change(CLI, 'USER node', 'RUN npm run build:be\nUSER node'),
      change(CLI, 'npm ci --omit=dev --ignore-scripts', 'npm ci --ignore-scripts'),
      change(CLI, 'npm ci --omit=dev --ignore-scripts', 'npm ci --omit=dev'),
      change(NEXT, 'USER node', 'RUN npm ci --omit=dev --ignore-scripts\nUSER node'),
    ];
    for (const mutation of invalid) {
      assert.deepEqual(judged(t, edition, 'HFS_DOCKER_STAGES', mutation), ['HFS_DOCKER_STAGES']);
    }
  });

  test(`${edition} accepts valid app entries and rejects invalid entries ports health and Next output`, (t) => {
    assert.deepEqual(judged(t, edition, 'HFS_DOCKER_ENTRY'), []);
    const invalid = [
      change(CLI, 'be/dist/apps/cli/src/main.js', 'be/dist/apps/other/src/main.js'),
      change(API, 'EXPOSE 3000', 'EXPOSE 8080'),
      change(API, 'HEALTHCHECK --interval', '# removed HEALTHCHECK --interval'),
      change(WORKER, 'HEALTHCHECK --interval', '# removed HEALTHCHECK --interval'),
      change(WORKER, 'USER node', 'USER node\nEXPOSE 3000'),
      change(CLI, 'HEALTHCHECK NONE', 'HEALTHCHECK CMD true'),
      change(CLI, 'HEALTHCHECK NONE', 'HEALTHCHECK NONE\nEXPOSE 3000'),
      change(NEXT, 'CMD ["node", "fe/apps/web/server.js"]', 'CMD ["npm", "start"]'),
      change(NEXT, '--filter=@proof/web', '--filter=@proof/other'),
      change(CONFIG, 'output: "standalone"', 'output: "export"'),
    ];
    for (const mutation of invalid) {
      assert.deepEqual(judged(t, edition, 'HFS_DOCKER_ENTRY', mutation), ['HFS_DOCKER_ENTRY']);
    }
  });

  test(`${edition} accepts valid pinned bases and rejects invalid moving or unresolved bases`, (t) => {
    assert.deepEqual(judged(t, edition, 'HFS_DOCKER_BASE_PIN'), []);
    assert.deepEqual(judged(t, edition, 'HFS_DOCKER_BASE_PIN', change(CLI, `FROM ${NODE_IMAGE} AS runtime`, 'FROM build AS runtime')), []);
    const digest = `FROM alpine:3.22@sha256:${'a'.repeat(64)} AS runtime`;
    assert.deepEqual(judged(t, edition, 'HFS_DOCKER_BASE_PIN', change(CLI, `FROM ${NODE_IMAGE} AS runtime`, digest)), []);
    for (const base of ['node:latest', 'node:22-alpine', '${BASE}']) {
      assert.deepEqual(judged(t, edition, 'HFS_DOCKER_BASE_PIN', change(CLI, `FROM ${NODE_IMAGE} AS runtime`, `FROM ${base} AS runtime`)), ['HFS_DOCKER_BASE_PIN']);
    }
  });

  test(`${edition} accepts valid public inputs and rejects invalid image secret inputs`, (t) => {
    assert.deepEqual(judged(t, edition, 'HFS_DOCKER_SECRETS'), []);
    for (const input of ['COPY be/.env.example ./sample', 'ARG NEXT_PUBLIC_MAPS_KEY', 'ENV TOKENIZER=none']) {
      assert.deepEqual(judged(t, edition, 'HFS_DOCKER_SECRETS', change(CLI, 'USER node', `${input}\nUSER node`)), []);
    }
    const invalid = [
      'COPY .env ./sample', 'COPY be/.env.production ./sample', 'COPY .starcistacks/runtime ./sample',
      'COPY .secrets/input ./sample', 'COPY .volume/input ./sample', 'COPY certs/server.pem ./sample',
      'COPY be/kubeconfig.yaml ./sample', 'ADD https://example.com/tool.tgz ./tool.tgz',
      'ARG API_TOKEN', 'ARG DB_PASSWORD', 'ARG CLIENT_SECRET', 'ARG SIGNING_PRIVATE_KEY',
    ];
    for (const input of invalid) {
      assert.deepEqual(judged(t, edition, 'HFS_DOCKER_SECRETS', change(CLI, 'USER node', `${input}\nUSER node`)), ['HFS_DOCKER_SECRETS']);
    }
  });
}
