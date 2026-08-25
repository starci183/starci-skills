import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { validatePortableRoute } from './workspace-portable.mjs';
import { validateInput as validateHydrateInput } from '../operators/workspace/routes-hydrate/validate-input.mjs';
import { validateOutput as validateHydrateOutput } from '../operators/workspace/routes-hydrate/validate-output.mjs';

const script = fileURLToPath(new URL('./workspace-portable.mjs', import.meta.url));
const schemaRoot = fileURLToPath(new URL('../readiness/initialization/workspaces/', import.meta.url));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function git(repository, ...args) {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', windowsHide: true }).trim();
}

function repository(path, remote) {
  mkdirSync(path, { recursive: true });
  execFileSync('git', ['init', '-b', 'main', path], { stdio: 'ignore', windowsHide: true });
  git(path, 'config', 'user.name', 'Test');
  git(path, 'config', 'user.email', 'test@example.com');
  git(path, 'remote', 'add', 'origin', remote);
  writeFileSync(join(path, 'package.json'), '{}\n');
  git(path, 'add', 'package.json');
  git(path, 'commit', '-m', 'fixture');
}

function fixture(t) {
  const repositories = mkdtempSync(join(tmpdir(), 'starci-v6-workspaces-'));
  const source = join(repositories, 'source');
  const frontend = join(repositories, 'nivo-fe');
  t.after(() => rmSync(repositories, { recursive: true, force: true }));
  repository(source, 'https://github.com/starci-lab/source.git');
  repository(frontend, 'https://github.com/starci-lab/nivo-fe.git');
  mkdirSync(join(source, '.claude', 'readiness', 'initialization', 'workspaces'), { recursive: true });
  for (const name of ['config.schema.json', 'portable-route.schema.json', 'local-route.schema.json']) {
    copyFileSync(join(schemaRoot, name), join(source, '.claude', 'readiness', 'initialization', 'workspaces', name));
  }
  mkdirSync(join(source, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(frontend, 'packages', 'ui', 'src', 'contracts'), { recursive: true });
  writeFileSync(join(frontend, 'packages', 'ui', 'src', 'contracts', 'index.ts'), 'export {};\n');
  git(frontend, 'add', 'packages/ui/src/contracts/index.ts');
  git(frontend, 'commit', '-m', 'contract');
  writeJson(join(source, '.workspaces', 'config.json'), {
    $schema: '../.claude/readiness/initialization/workspaces/config.schema.json',
    schemaVersion: 6,
    defaultLang: 'vi'
  });
  writeJson(join(source, '.workspaces', 'projects', 'source', 'be.json'), {
    $schema: '../../../.claude/readiness/initialization/workspaces/portable-route.schema.json',
    version: 1,
    project: 'source',
    role: 'be',
    repository: { kind: 'source', directory: null, gitRepository: 'https://github.com/starci-lab/source.git', branch: 'main' },
    context: { instructions: [], contract: null, contractSource: null, manifests: ['package.json'], grammar: null, grammarProfile: null }
  });
  writeJson(join(source, '.workspaces', 'projects', 'nivo', 'fe.json'), {
    $schema: '../../../.claude/readiness/initialization/workspaces/portable-route.schema.json',
    schemaVersion: 6,
    project: 'nivo',
    role: 'fe',
    repository: { kind: 'sibling', directory: 'nivo-fe', gitRepository: 'https://github.com/starci-lab/nivo-fe.git', branch: 'main' },
    context: {
      instructions: [],
      contract: 'packages/ui/src/contracts/index.ts',
      contractSource: 'declared:packages/ui/src/contracts/index.ts',
      manifests: ['package.json'],
      grammarId: 'core'
    }
  });
  mkdirSync(join(source, '.workspaces', 'local', 'credentials'), { recursive: true });
  writeFileSync(join(source, '.workspaces', 'local', 'credentials', 'provider.key.enc'), 'ciphertext');
  return { repositories, source, frontend };
}

function runScript(fixture, ...args) {
  return spawnSync(process.execPath, [script, ...args, '--source', fixture.source, '--repositories-root', fixture.repositories], {
    encoding: 'utf8',
    windowsHide: true
  });
}

function runScriptWithEnv(fixture, env, ...args) {
  return spawnSync(process.execPath, [script, ...args, '--source', fixture.source, '--repositories-root', fixture.repositories], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    windowsHide: true
  });
}

test('hydrates V1 and V6 routes, refreshes stale heads, and preserves credentials', (t) => {
  const f = fixture(t);
  let result = runScript(f, 'hydrate', '--apply');
  assert.equal(result.status, 0, result.stderr);
  const v1Path = join(f.source, '.workspaces', 'local', 'routes', 'source', 'be', 'config.json');
  const v6Path = join(f.source, '.workspaces', 'local', 'routes', 'nivo', 'fe', 'config.json');
  assert.equal(JSON.parse(readFileSync(v1Path, 'utf8')).version, 1);
  const v6 = JSON.parse(readFileSync(v6Path, 'utf8'));
  assert.equal(v6.schemaVersion, 6);
  assert.equal(v6.context.grammarId, 'core');
  assert.equal(v6.repository.head, git(f.frontend, 'rev-parse', 'HEAD'));
  assert.equal(readFileSync(join(f.source, '.workspaces', 'local', 'credentials', 'provider.key.enc'), 'utf8'), 'ciphertext');

  const unchanged = readFileSync(v6Path, 'utf8');
  result = runScript(f, 'hydrate', '--apply');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(v6Path, 'utf8'), unchanged);

  writeFileSync(join(f.frontend, 'next.config.ts'), 'export default {};\n');
  git(f.frontend, 'add', 'next.config.ts');
  git(f.frontend, 'commit', '-m', 'advance');
  result = runScript(f, 'check');
  assert.equal(result.status, 1, result.stderr);
  result = runScript(f, 'hydrate', '--apply');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(v6Path, 'utf8')).repository.head, git(f.frontend, 'rev-parse', 'HEAD'));
  assert.equal(runScript(f, 'check').status, 0);
});

test('bootstrap clones a missing declared sibling and hydrates it without user-specific Git config', (t) => {
  const f = fixture(t);
  const bare = join(f.repositories, 'nivo-fe-origin.git');
  execFileSync('git', ['clone', '--quiet', '--bare', f.frontend, bare], { windowsHide: true });
  rmSync(f.frontend, { recursive: true, force: true });
  const remote = 'https://github.com/starci-lab/nivo-fe.git';
  const env = {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.${pathToFileURL(bare).href}.insteadOf`,
    GIT_CONFIG_VALUE_0: remote
  };

  const plan = runScriptWithEnv(f, env, 'bootstrap', '--plan', '--project', 'nivo');
  assert.equal(plan.status, 0, plan.stderr);
  assert.deepEqual(JSON.parse(plan.stdout).missingCheckouts, ['nivo-fe']);

  const applied = runScriptWithEnv(f, env, 'bootstrap', '--apply', '--project', 'nivo');
  assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(JSON.parse(applied.stdout).initializedCheckouts, ['nivo-fe']);
  assert.equal(git(f.frontend, 'remote', 'get-url', 'origin'), remote);
  assert.equal(runScript(f, 'check', '--project', 'nivo').status, 0);
});

test('V6 rejects legacy grammar fields, mixed versions, and non-FE grammar', () => {
  const base = {
    $schema: '../../../.claude/readiness/initialization/workspaces/portable-route.schema.json',
    schemaVersion: 6,
    project: 'nivo',
    role: 'fe',
    repository: { kind: 'sibling', directory: 'nivo-fe', gitRepository: 'https://github.com/starci-lab/nivo-fe.git', branch: 'main' },
    context: { instructions: [], contract: null, contractSource: null, manifests: ['package.json'], grammarId: 'core' }
  };
  assert.throws(() => validatePortableRoute({ ...base, version: 1 }), /invalid/);
  assert.throws(() => validatePortableRoute({ ...base, context: { ...base.context, grammar: 'starci' } }), /invalid/);
  assert.throws(() => validatePortableRoute({ ...base, role: 'be' }), /non-FE grammarId must be null|invalid/);
  assert.throws(() => validatePortableRoute({ ...base, repository: { ...base.repository, directory: '../nivo-fe' } }), /invalid/);
  assert.throws(() => validatePortableRoute({ ...base, repository: { ...base.repository, gitRepository: 'https://token@github.com/starci-lab/nivo-fe.git' } }), /invalid/);
});

test('a failing declaration produces no partial local route writes', (t) => {
  const f = fixture(t);
  const declaration = join(f.source, '.workspaces', 'projects', 'nivo', 'fe.json');
  const value = JSON.parse(readFileSync(declaration, 'utf8'));
  value.repository.branch = 'missing-branch';
  writeJson(declaration, value);
  const result = runScript(f, 'hydrate', '--apply');
  assert.equal(result.status, 1);
  assert.equal(existsSync(join(f.source, '.workspaces', 'local', 'routes', 'source', 'be', 'config.json')), false);
  assert.equal(existsSync(join(f.source, '.workspaces', 'local', 'routes', 'nivo', 'fe', 'config.json')), false);
});

test('routes-hydrate accepts safe re-entry and models hard blocks', () => {
  const prefix = 'session://tasks/workspace-v6/';
  const hash = `sha256:${'0'.repeat(64)}`;
  const input = {
    schemaVersion: 6,
    runId: 'workspace-v6',
    stage: 'workspace.initialization',
    status: 'ready',
    facts: ['workspace-declarations-ready', 'workspace-route-initialize-required'],
    payload: {
      provided: {
        compiledDeclarationsRef: `${prefix}compiled`,
        localRepositoryMapRef: `${prefix}repositories`,
        routeInitializationEvidenceRef: `${prefix}route-evidence`
      },
      loads: {
        artifacts: ['compiled', 'repositories', 'route-evidence'].map((name) => ({ ref: `${prefix}${name}`, revision: hash, loadMode: 'session-exact' })),
        knowledge: [{ id: 'workspace.initialization', generation: 'test', contentSha256: hash, loadMode: 'qdrant-exact' }],
        orchestration: { mode: 'economical', profileRef: 'orchestration/modes/economical.json', providerRef: 'orchestration/providers/openai.json' }
      },
      session: {
        taskId: 'workspace-v6',
        inputRef: `${prefix}input`,
        outputRef: `${prefix}output`,
        scratchPrefix: `${prefix}scratch`,
        retention: 'until-skill-terminal'
      }
    }
  };
  assert.equal(validateHydrateInput(input).valid, true);
  assert.equal(validateHydrateInput({ ...input, stage: 'workspace.routes.hydrate' }).valid, false);

  const output = {
    schemaVersion: 6,
    runId: 'workspace-v6',
    stage: 'workspace.blocked',
    status: 'blocked',
    facts: ['workspace-routes-hydrate-blocked'],
    payload: {
      decision: 'blocked',
      state: {
        operator: 'workspace/routes-hydrate',
        status: 'blocked',
        code: 'workspace-routes-hydrate-blocked',
        retryable: false,
        emits: { stage: 'workspace.blocked', status: 'blocked', factsAdd: ['workspace-routes-hydrate-blocked'] }
      },
      produced: { hydrationReceiptRef: null, durableWrites: [] },
      context: { used: [{ kind: 'session-artifact', ref: `${prefix}route-evidence`, revision: hash }] },
      cleanup: { scratchRefs: [`${prefix}scratch`], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' },
      evidenceRefs: [`${prefix}route-evidence`],
      findings: ['origin mismatch']
    }
  };
  assert.equal(validateHydrateOutput(output).valid, true);
});
