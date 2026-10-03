// The image rules of an app (scripts/hfs/rules/docker.mjs over scripts/lib/dockerfile.mjs): R187 HFS_DOCKER_BUILD_CONTEXT, R188
// HFS_DOCKER_STAGES, R189 HFS_DOCKER_ENTRY, R190 HFS_DOCKER_BASE_PIN and R191 HFS_DOCKER_SECRETS. The clean app of
// tests/helpers/hfs-cli-fixture.mjs holds the Dockerfile each declared app's template renders (the passing base); each violating
// case changes one fact of one Dockerfile.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { NODE_IMAGE } from '../../scripts/hfs/rules/docker.mjs';
import { checkTargets, renderTargets } from '../../packages/hfs/sync/index.mjs';
import { newImages } from '../../packages/hfs/scaffold/image.mjs';
import { execForm, parseDockerfile, shellCommands, words } from '../../scripts/lib/dockerfile.mjs';
import { APP, PRESETS, appOf } from '../helpers/hfs-cli-fixture.mjs';
import { cleanupDockerRuleFixtures, dockerRuleFixtureFiles, dockerRulesRepoOf, DOCKER_RULES_MANIFEST } from '../helpers/hfs-hfs-docker-rules-fixture.mjs';

test.after(cleanupDockerRuleFixtures);
const MIXED = appOf({
  be: { apps: [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }, { name: 'cli', kind: 'cli' }] },
  fe: { apps: [{ name: 'landing', kind: 'next' }, { name: 'app', kind: 'next' }] },
});
const repoOf = (declaration, mutate) => {
  return dockerRulesRepoOf(declaration, mutate);
};
const at = (dir, relative) => path.join(dir, ...relative.split('/'));
const put = (dir, relative, text) => { fs.mkdirSync(path.dirname(at(dir, relative)), { recursive: true }); fs.writeFileSync(at(dir, relative), text); };
const edit = (relative, change) => (dir) => put(dir, relative, change(fs.readFileSync(at(dir, relative), 'utf8')));
const replace = (from, to) => (text) => { assert.ok(text.includes(from), `the template no longer contains ${from}`); return text.replace(from, to); };
const withoutLines = (prefix) => (text) => text.split('\n').filter((line) => !line.startsWith(prefix)).join('\n');
const only = (result, code) => result.findings.filter((f) => f.code === code);
const checked = (dir) => checkRepo({ repoRoot: dir, files: dockerRuleFixtureFiles(dir), manifest: DOCKER_RULES_MANIFEST });
const CODES = ['HFS_DOCKER_BUILD_CONTEXT', 'HFS_DOCKER_STAGES', 'HFS_DOCKER_ENTRY', 'HFS_DOCKER_BASE_PIN', 'HFS_DOCKER_SECRETS'];
const BE = 'be/apps/core/Dockerfile';
const FE = 'fe/apps/web/Dockerfile';
/** The findings of `code` after `change` is applied to the Dockerfile `relative` of the clean app (or of the app `declaration`). */
const judged = (code, relative, change, declaration = APP) => only(checked(repoOf(declaration, edit(relative, change))), code);

test('the clean app, one api and one Next app, is clean to every docker rule and holds its managed .dockerignore and images workflow', () => {
  const result = checked(repoOf(APP));
  for (const code of CODES) assert.deepEqual(only(result, code), [], code);
  assert.deepEqual(result.findings.filter((f) => ['HFS_SLOT_REQUIRED_MISSING', 'HFS_MANAGED_FILE_DRIFT'].includes(f.code)), []);
});

test('every kind of be app and several fe apps are clean: api, worker, cli and two Next apps', () => {
  const result = checked(repoOf(MIXED));
  for (const code of CODES) assert.deepEqual(only(result, code), [], code);
});

// ------------------------------------------------------------------------------------------------ the slot: one Dockerfile per app

test('repo.app-image: an app without its Dockerfile is refused, and so is a Dockerfile outside apps/<app>/', () => {
  const missing = checked(repoOf(APP, (dir) => fs.rmSync(at(dir, BE))));
  assert.ok(missing.findings.some((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING' && f.path === BE));
  const outside = checked(repoOf(APP, (dir) => put(dir, 'be/Dockerfile', 'FROM scratch\n')));
  assert.ok(outside.findings.some((f) => f.path === 'be/Dockerfile'), JSON.stringify(outside.findings.map((f) => [f.code, f.path])));
  const stray = checked(repoOf(APP, (dir) => put(dir, 'fe/apps/web/src/Dockerfile', 'FROM scratch\n')));
  assert.ok(stray.findings.some((f) => f.path === 'fe/apps/web/src/Dockerfile'));
});

test('the managed .dockerignore and images workflow are required at the app root and judged for drift', () => {
  const bare = checked(repoOf(APP, (dir) => { fs.rmSync(at(dir, '.dockerignore')); fs.rmSync(at(dir, '.github/workflows/images.yml')); }));
  for (const file of ['.dockerignore', '.github/workflows/images.yml']) assert.ok(bare.findings.some((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING' && f.path === file), file);
  const statusOf = (dir, file) => checkTargets(dir, renderTargets(APP, PRESETS)).find((item) => item.path === file)?.status;
  assert.equal(statusOf(repoOf(APP), '.dockerignore'), 'ok');
  assert.equal(statusOf(repoOf(APP, edit('.dockerignore', (text) => text.replace('.starcistacks\n', ''))), '.dockerignore'), 'drift');
  assert.equal(statusOf(repoOf(APP, edit('.github/workflows/images.yml', replace('push: false', 'push: true'))), '.github/workflows/images.yml'), 'drift');
});

const EDITED = ['# the app edited this file', 'FROM scratch', ''].join('\n');
test('starci app new image writes the Dockerfile of every declared app that has none and never overwrites one', () => {
  const dir = repoOf(MIXED, (root) => { fs.rmSync(at(root, 'be/apps/jobs/Dockerfile')); fs.rmSync(at(root, 'fe/apps/app/Dockerfile')); put(root, 'be/apps/cli/Dockerfile', EDITED); });
  assert.deepEqual(newImages({ repoRoot: dir }).sort(), ['be/apps/jobs/Dockerfile', 'fe/apps/app/Dockerfile']);
  assert.equal(fs.readFileSync(at(dir, 'be/apps/cli/Dockerfile'), 'utf8'), EDITED);
  assert.deepEqual(newImages({ repoRoot: dir }), []);
  const result = checked(dir);
  for (const file of ['be/apps/jobs/Dockerfile', 'fe/apps/app/Dockerfile']) assert.deepEqual(result.findings.filter((f) => f.path === file), [], file);
});

// ------------------------------------------------------------------------------------------------ R187 HFS_DOCKER_BUILD_CONTEXT

test('HFS_DOCKER_BUILD_CONTEXT: a header with another path, a context other than the root, or no command is refused', () => {
  const wrong = judged('HFS_DOCKER_BUILD_CONTEXT', BE, replace('docker build -f be/apps/core/Dockerfile', 'docker build -f be/apps/other/Dockerfile'));
  assert.deepEqual(wrong.map((f) => f.path), [BE]);
  assert.match(wrong[0].message, /docker build -f be\/apps\/core\/Dockerfile/);
  assert.equal(judged('HFS_DOCKER_BUILD_CONTEXT', BE, replace('-t demo/core:<tag> .', '-t demo/core:<tag> be')).length, 1);
  assert.equal(judged('HFS_DOCKER_BUILD_CONTEXT', FE, (text) => text.split('\n').filter((line) => !line.includes('docker build')).join('\n')).length, 1);
});

test('HFS_DOCKER_BUILD_CONTEXT: a COPY source that leaves the context is refused; a COPY --from stage is clean', () => {
  const up = judged('HFS_DOCKER_BUILD_CONTEXT', BE, replace('COPY be/src be/src', 'COPY ../shared shared'));
  assert.equal(up.length, 1);
  assert.equal(up[0].source, '../shared');
  assert.equal(judged('HFS_DOCKER_BUILD_CONTEXT', BE, replace('COPY be/src be/src', 'COPY /etc/hosts hosts')).length, 1);
  assert.deepEqual(judged('HFS_DOCKER_BUILD_CONTEXT', BE, replace('COPY be/src be/src', 'COPY be/src be/src\nCOPY --from=manifests /app/package.json ./copy.json')), []);
});

// ------------------------------------------------------------------------------------------------ R188 HFS_DOCKER_STAGES

test('HFS_DOCKER_STAGES: a single-stage Dockerfile, or one whose last stage is not runtime, is refused', () => {
  const single = judged('HFS_DOCKER_STAGES', BE, (text) => text.slice(0, text.indexOf('FROM', text.indexOf('AS build'))));
  assert.ok(single.some((f) => /multi-stage/.test(f.message)));
  assert.equal(judged('HFS_DOCKER_STAGES', BE, replace('AS runtime', 'AS final')).filter((f) => /multi-stage/.test(f.message)).length, 1);
});

test('HFS_DOCKER_STAGES: a runtime that is root, that builds, or a stage that runs npm install is refused', () => {
  const root = judged('HFS_DOCKER_STAGES', BE, replace('USER node\n', ''));
  assert.equal(root.length, 1);
  assert.equal(root[0].user, 'root');
  assert.equal(judged('HFS_DOCKER_STAGES', BE, replace('USER node\n', 'USER root\n')).length, 1);
  const builds = judged('HFS_DOCKER_STAGES', BE, replace('COPY --from=build /app/be/dist be/dist', 'RUN npm run build:be\nCOPY --from=build /app/be/dist be/dist'));
  assert.equal(builds.length, 1);
  assert.match(builds[0].message, /runs the build/);
  assert.equal(judged('HFS_DOCKER_STAGES', BE, replace('RUN npm ci --ignore-scripts\n', 'RUN npm install\n')).length, 1);
  assert.equal(judged('HFS_DOCKER_STAGES', BE, replace('RUN npm ci --ignore-scripts\n', 'RUN npm install -g turbo && npm ci --ignore-scripts\n')).length, 0);
});

test('HFS_DOCKER_STAGES: a back-end runtime installs --omit=dev --ignore-scripts and a front-end runtime installs nothing', () => {
  assert.equal(judged('HFS_DOCKER_STAGES', BE, replace('npm ci --omit=dev --ignore-scripts', 'npm ci --ignore-scripts')).length, 1);
  assert.equal(judged('HFS_DOCKER_STAGES', BE, replace('npm ci --omit=dev --ignore-scripts', 'npm ci --omit=dev')).length, 1);
  const fe = judged('HFS_DOCKER_STAGES', FE, replace('USER node', 'RUN npm ci --omit=dev --ignore-scripts\nUSER node'));
  assert.equal(fe.length, 1);
  assert.match(fe[0].message, /installs nothing/);
});

// ------------------------------------------------------------------------------------------------ R189 HFS_DOCKER_ENTRY

test('HFS_DOCKER_ENTRY: the runtime must start the app entry built from this app, in exec form', () => {
  const cmd = 'CMD ["node", "be/dist/apps/core/src/main.js"]';
  assert.equal(judged('HFS_DOCKER_ENTRY', BE, replace(cmd, 'CMD ["node", "be/dist/apps/other/src/main.js"]')).length, 1);
  assert.equal(judged('HFS_DOCKER_ENTRY', BE, replace(cmd, 'CMD node be/dist/apps/core/src/main.js')).length, 1);
  assert.equal(judged('HFS_DOCKER_ENTRY', FE, replace('CMD ["node", "fe/apps/web/server.js"]', 'CMD ["npm", "start"]')).length, 1);
  assert.deepEqual(judged('HFS_DOCKER_ENTRY', BE, replace(cmd, 'ENTRYPOINT ["node", "be/dist/apps/core/src/main.js"]')), []);
});

test('HFS_DOCKER_ENTRY: an api or Next app declares its port and carries a HEALTHCHECK', () => {
  const dropped = judged('HFS_DOCKER_ENTRY', BE, withoutLines('HEALTHCHECK'));
  assert.equal(dropped.length, 1);
  assert.match(dropped[0].message, /no HEALTHCHECK/);
  assert.equal(judged('HFS_DOCKER_ENTRY', BE, replace('EXPOSE 3000', 'EXPOSE 8080')).length, 1);
  assert.equal(judged('HFS_DOCKER_ENTRY', FE, replace('ENV PORT=3000\n', '')).length, 1);
  assert.equal(judged('HFS_DOCKER_ENTRY', FE, withoutLines('HEALTHCHECK')).length, 1);
});

test('HFS_DOCKER_ENTRY: a worker has a process healthcheck and listens on nothing; a cli says HEALTHCHECK NONE and listens on nothing', () => {
  const worker = 'be/apps/jobs/Dockerfile';
  const cli = 'be/apps/cli/Dockerfile';
  assert.equal(judged('HFS_DOCKER_ENTRY', worker, withoutLines('HEALTHCHECK'), MIXED).length, 1);
  assert.equal(judged('HFS_DOCKER_ENTRY', worker, replace('USER node\n', 'USER node\nEXPOSE 3000\n'), MIXED).length, 1);
  assert.equal(judged('HFS_DOCKER_ENTRY', cli, replace('HEALTHCHECK NONE', 'HEALTHCHECK CMD true'), MIXED).length, 1);
  assert.equal(judged('HFS_DOCKER_ENTRY', cli, replace('HEALTHCHECK NONE', 'HEALTHCHECK NONE\nEXPOSE 3000'), MIXED).length, 1);
});

test('HFS_DOCKER_ENTRY: a Next image builds its own workspace through turbo and its config ships the standalone output', () => {
  assert.equal(judged('HFS_DOCKER_ENTRY', FE, replace('--filter=@demo/web', '--filter=@demo/other')).length, 1);
  const config = only(checked(repoOf(APP, (dir) => put(dir, 'fe/apps/web/next.config.ts', 'export default { reactStrictMode: true };\n'))), 'HFS_DOCKER_ENTRY');
  assert.deepEqual(config.map((f) => f.path), ['fe/apps/web/next.config.ts']);
  const standalone = 'const config = { output: "standalone", reactStrictMode: true };\nexport default config;\n';
  assert.deepEqual(only(checked(repoOf(APP, (dir) => put(dir, 'fe/apps/web/next.config.ts', standalone))), 'HFS_DOCKER_ENTRY'), []);
});

// ------------------------------------------------------------------------------------------------ R190 HFS_DOCKER_BASE_PIN

test('HFS_DOCKER_BASE_PIN: a moving or foreign base is refused in every stage', () => {
  const floating = judged('HFS_DOCKER_BASE_PIN', BE, replace(`FROM ${NODE_IMAGE} AS runtime`, 'FROM node:22-alpine AS runtime'));
  assert.equal(floating.length, 1);
  assert.equal(floating[0].image, 'node:22-alpine');
  assert.equal(judged('HFS_DOCKER_BASE_PIN', BE, replace(`FROM ${NODE_IMAGE} AS build`, 'FROM node:latest AS build')).length, 1);
  assert.equal(judged('HFS_DOCKER_BASE_PIN', BE, replace(`FROM ${NODE_IMAGE} AS build`, 'FROM node AS build')).length, 1);
  assert.equal(judged('HFS_DOCKER_BASE_PIN', BE, replace(`FROM ${NODE_IMAGE} AS build`, 'FROM ${BASE} AS build')).length, 1);
});

test('HFS_DOCKER_BASE_PIN: the canon image, a prior stage, a digest-pinned image and a build argument that resolves to the canon are clean', () => {
  const digest = `FROM alpine:3.22@sha256:${'a'.repeat(64)} AS fetch\nRUN echo ok\n\n`;
  assert.deepEqual(judged('HFS_DOCKER_BASE_PIN', BE, (text) => text.replace(`FROM ${NODE_IMAGE} AS build`, `${digest}FROM ${NODE_IMAGE} AS build`)), []);
  assert.deepEqual(judged('HFS_DOCKER_BASE_PIN', BE, (text) => `ARG BASE=${NODE_IMAGE}\n${text.split(`FROM ${NODE_IMAGE}`).join('FROM ${BASE}')}`), []);
  assert.deepEqual(judged('HFS_DOCKER_BASE_PIN', BE, replace(`FROM ${NODE_IMAGE} AS runtime`, 'FROM build AS runtime')), []);
});

// ------------------------------------------------------------------------------------------------ R191 HFS_DOCKER_SECRETS

test('HFS_DOCKER_SECRETS: a COPY or ADD of an env file or of credential material is refused', () => {
  const copy = (source) => judged('HFS_DOCKER_SECRETS', BE, replace('COPY be/src be/src', `COPY be/src be/src\nCOPY ${source} /tmp/x`));
  for (const source of ['.env', 'be/.env.production', '.starcistacks/dev/runtime/files/keys.key', '.secrets/token', 'certs/server.pem', 'be/kubeconfig.yaml']) assert.equal(copy(source).length, 1, source);
  assert.deepEqual(copy('be/.env.example'), []);
  const url = judged('HFS_DOCKER_SECRETS', BE, replace('COPY be/src be/src', 'COPY be/src be/src\nADD https://example.com/tool.tgz /tmp/tool.tgz'));
  assert.equal(url.length, 1);
  assert.match(url[0].message, /checksum-verified stage/);
});

test('HFS_DOCKER_SECRETS: an ARG or ENV that names a credential is refused; NEXT_PUBLIC_* build arguments are clean', () => {
  const named = (line) => judged('HFS_DOCKER_SECRETS', BE, replace('ENV NODE_ENV=production', `ENV NODE_ENV=production\n${line}`));
  for (const line of ['ENV API_TOKEN=abc', 'ARG DB_PASSWORD', 'ENV CLIENT_SECRET abc', 'ARG STRIPE_API_KEY=x', 'ENV A=1 SIGNING_PRIVATE_KEY=x']) assert.equal(named(line).length, 1, line);
  for (const line of ['ENV KEYCLOAK_URL=http://keycloak', 'ARG NEXT_PUBLIC_MAPS_KEY', 'ENV TOKENIZER=none']) assert.deepEqual(named(line), [], line);
  assert.deepEqual(judged('HFS_DOCKER_SECRETS', FE, replace('RUN npm run codegen --silent', 'ARG NEXT_PUBLIC_API_URL\nRUN npm run codegen --silent')), []);
});

// ------------------------------------------------------------------------------------------------ the Dockerfile reader

test('the Dockerfile reader joins continuations, drops comments inside them and keeps stages, directives and comments apart', () => {
  const source = '# syntax=docker/dockerfile:1\n# header\nARG BASE=node:22\nFROM ${BASE} AS build\nRUN npm ci \\\n  # a comment inside\n  --ignore-scripts \\\n  && npm cache clean --force\n\nFROM build as runtime\nCMD ["node", "x.js"]\n';
  const parsed = parseDockerfile(source);
  assert.deepEqual(parsed.comments.map((c) => c.text), ['header']);
  assert.deepEqual(parsed.preamble.map((i) => i.keyword), ['ARG']);
  assert.deepEqual(parsed.stages.map((s) => [s.name, s.image]), [['build', '${BASE}'], ['runtime', 'build']]);
  const run = parsed.stages[0].instructions.find((i) => i.keyword === 'RUN');
  assert.equal(run.text, 'npm ci --ignore-scripts && npm cache clean --force');
  assert.deepEqual(shellCommands(run.text), [['npm', 'ci', '--ignore-scripts'], ['npm', 'cache', 'clean', '--force']]);
  assert.deepEqual(execForm(parsed.stages[1].instructions[1].text), ['node', 'x.js']);
  assert.equal(execForm('node x.js'), null);
  assert.deepEqual(words('a "b c" \'d\' e=f'), ['a', 'b c', 'd', 'e=f']);
});
