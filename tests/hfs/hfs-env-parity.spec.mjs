// hfs-env-parity.spec.mjs - R248 HFS_ENV_PARITY and R249 HFS_ENV_VALUE_SHAPE: the keys the typed EnvSource readers
// consume, the keys sealed under .starcistacks/<env>/secrets/*.enc and the keys the stack declares are one set, and a
// stored value parses as its reader's type. Fixtures reproduce the nivo D2 shapes (D2-01/06/07/08 parity, D2-03 value
// shape); sealed members are dotenv sops envelopes whose key names stay cleartext.
// proves: ENV_REQUIRED_UNSET@lite ENV_REQUIRED_UNSET@full ENV_SEALED_UNREAD@lite ENV_SEALED_UNREAD@full
// proves: ENV_DUPLICATE@lite ENV_DUPLICATE@full ENV_PUBLIC_SEALED@lite ENV_PUBLIC_SEALED@full
// proves: ENV_EXAMPLE_DRIFT@lite ENV_EXAMPLE_DRIFT@full ENV_VALUE_SHAPE@lite ENV_VALUE_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { app, run, privateAbsent } from '../helpers/hfs-secret-fixture.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import {
  ENV_DUPLICATE,
  ENV_EXAMPLE_DRIFT,
  ENV_PUBLIC_SEALED,
  ENV_REQUIRED_UNSET,
  ENV_SEALED_UNREAD,
  collectEnvReads,
  envParityFindings,
} from '../../scripts/hfs/rules/env-parity.mjs';
import { ENV_VALUE_SHAPE, envValueShapeFindings } from '../../scripts/hfs/rules/env-value-shape.mjs';

const manifest = loadSlotManifest();
const ENC = 'ENC[AES256_GCM,data:AA==,iv:AA==,tag:AA==,type:str]';
const RECIPIENT = `age1${'q'.repeat(58)}`;
const sealedDotenv = (keys) => {
  const entries = keys.map((key) => `${key}=${ENC}`).join('\n');
  return `${entries}\nsops_age__list_0__map_recipient=${RECIPIENT}\nsops_mac=${ENC}\n`;
};

const declaration = (edition) => ({
  hfs: 3,
  kind: 'app',
  project: `parity-${edition}`,
  ...(edition === 'lite' ? { edition: 'lite' } : {}),
  sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
});

const tree = (t, files) => {
  const root = mkdtemp(t, 'hfs-env-parity-');
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return root;
};

const parityOf = (root, files) => envParityFindings({ repoRoot: root, all: Object.keys(files), isRoot: true });
const shapeOf = (root, files) => envValueShapeFindings({ repoRoot: root, all: Object.keys(files), isRoot: true });
const codes = (findings, code) => findings.filter((finding) => finding.code === code);
const ENV_CODES = new Set([ENV_REQUIRED_UNSET, ENV_SEALED_UNREAD, ENV_DUPLICATE, ENV_PUBLIC_SEALED, ENV_EXAMPLE_DRIFT, ENV_VALUE_SHAPE]);

const envFindingsOf = (root, files, edition) => checkRepo({
  repoRoot: root,
  declaration: declaration(edition),
  manifest,
  files: Object.keys(files),
  tree: false,
}).findings.filter((finding) => ENV_CODES.has(finding.code));

// The nivo-shaped app: PRIMARY_DB_URL required like D2-02, OPENCLAW_MANAGE_AGENTS a bool like D2-03,
// OPENCLAW_TURN_TIMEOUT an optional duration (sealed under the wrong name OPENCLAW_TURN_TIMEOUT_MS like D2-06) and
// ENGINE_SHARED_SECRET a required string (D2-01).
const APP_CONFIG = `import type { EnvSource } from "@modules/platform/config"

export const parseAppConfig = (env: EnvSource) => ({
    url: env.secret("PRIMARY_DB_URL"),
    manage: env.bool("OPENCLAW_MANAGE_AGENTS"),
    timeout: env.duration("OPENCLAW_TURN_TIMEOUT", 300_000),
    shared: env.string("ENGINE_SHARED_SECRET"),
})
`;
const API_ENV = `import type { EnvSource } from "@modules/platform/config"
import { parseAppConfig } from "@modules/platform/config"
import { parseWebhookProviderConfig } from "@modules/platform/http-security"

export const readApiEnv = (env: EnvSource) => ({
    port: env.int("API_PORT"),
    app: parseAppConfig(env),
    calendar: parseWebhookProviderConfig(env, "CALENDAR"),
})
`;
const WEBHOOK_CONFIG = `import type { EnvSource } from "@modules/platform/config"

export const parseWebhookProviderConfig = (env: EnvSource, prefix: string) => ({
    secret: env.secret(\`\${prefix}_WEBHOOK_SECRET\`),
    toleranceMs: env.duration(\`\${prefix}_WEBHOOK_TOLERANCE\`, 300_000),
})
`;
const BASE = {
  'be/apps/api/src/api.env.ts': API_ENV,
  'be/src/modules/platform/config/app.config.ts': APP_CONFIG,
  'be/src/modules/platform/http-security/http-security.config.ts': WEBHOOK_CONFIG,
};
const NIVO_MEMBERS = {
  '.starcistacks/dev/secrets/engine.enc': sealedDotenv(['ENGINE_SHARED_SECRET', 'OPENCLAW_TURN_TIMEOUT_MS', 'STALE_API_TOKEN', 'LEGACY_SMTP_PASSWORD']),
};

for (const edition of ['lite', 'full']) {
  test(`every env code rejects its violating fixture through checkRepo (${edition})`, (t) => {
    const files = {
      ...BASE,
      ...NIVO_MEMBERS,
      '.starcistacks/dev/secrets/duplicate.enc': sealedDotenv(['ENGINE_SHARED_SECRET']),
      '.starcistacks/dev/secrets/web.enc': sealedDotenv(['NEXT_PUBLIC_API_URL']),
      'deploy/app.env.example': 'OPENCLAW_MANAGE_AGENTS=1\nQUEUE_RELAY_INTERVAL=200ms\n',
    };
    const findings = envFindingsOf(tree(t, files), files, edition);
    for (const code of ENV_CODES) {
      assert.ok(findings.some((finding) => finding.code === code), `${edition} must report ${code}`);
    }
    assert.ok(findings.every((finding) => finding.level === 'error'));
  });

  test(`every env code accepts its passing fixture through checkRepo (${edition})`, (t) => {
    const files = {
      ...BASE,
      '.starcistacks/dev/secrets/app.enc': sealedDotenv(['ENGINE_SHARED_SECRET', 'PRIMARY_DB_URL', 'OPENCLAW_MANAGE_AGENTS', 'CALENDAR_WEBHOOK_SECRET']),
      '.starcistacks/dev/infra/compose/api.yaml': 'services:\n  api:\n    environment:\n      - API_PORT=3000\n      - CALENDAR_WEBHOOK_SECRET_FILE=/run/secrets/calendar\n',
      'deploy/app.env.example': 'API_PORT=3000\nOPENCLAW_MANAGE_AGENTS=false\nOPENCLAW_TURN_TIMEOUT=30s\nPRIMARY_DB_URL=<database-location>\n',
    };
    assert.deepEqual(envFindingsOf(tree(t, files), files, edition), []);
  });
}

test('env parity flags required reads neither sealed nor declared and sealed keys nobody reads (lite)', (t) => {
  const files = { ...BASE, ...NIVO_MEMBERS };
  const root = tree(t, files);
  const findings = parityOf(root, files);
  assert.deepEqual(
    codes(findings, ENV_REQUIRED_UNSET).map((f) => f.message.match(/required (\w+)/)[1]).sort(byCodeUnit),
    ['API_PORT', 'CALENDAR_WEBHOOK_SECRET', 'OPENCLAW_MANAGE_AGENTS', 'PRIMARY_DB_URL'],
  );
  assert.deepEqual(
    codes(findings, ENV_SEALED_UNREAD).map((f) => f.message.match(/seals (\w+)/)[1]).sort(byCodeUnit),
    ['LEGACY_SMTP_PASSWORD', 'OPENCLAW_TURN_TIMEOUT_MS', 'STALE_API_TOKEN'],
  );
  assert.deepEqual(codes(findings, ENV_DUPLICATE), []);
  assert.deepEqual(codes(findings, ENV_PUBLIC_SEALED), []);
  assert.deepEqual(codes(findings, ENV_EXAMPLE_DRIFT), []);
});

test('env parity is clean in lite when every required read is sealed or declared (lite)', (t) => {
  const files = {
    ...BASE,
    '.starcistacks/dev/secrets/app.enc': sealedDotenv(['ENGINE_SHARED_SECRET', 'PRIMARY_DB_URL', 'OPENCLAW_MANAGE_AGENTS', 'CALENDAR_WEBHOOK_SECRET']),
    '.starcistacks/application-stacks.yaml': 'schema: starci/application-stacks@1\nenvironments:\n  dev:\n    services:\n      api:\n        environment:\n          API_PORT: "3000"\n',
  };
  const root = tree(t, files);
  assert.deepEqual(parityOf(root, files), []);
  const judged = checkRepo({ repoRoot: root, declaration: declaration('lite'), manifest, files: Object.keys(files), tree: false }).findings;
  assert.deepEqual(judged.filter((finding) => ENV_CODES.has(finding.code)), []);
});

test('env parity reports the same violations through checkRepo under both editions', (t) => {
  const files = { ...BASE, ...NIVO_MEMBERS };
  for (const edition of ['lite', 'full']) {
    const root = tree(t, files);
    const findings = checkRepo({ repoRoot: root, declaration: declaration(edition), manifest, files: Object.keys(files), tree: false }).findings;
    assert.ok(findings.some((finding) => finding.code === ENV_REQUIRED_UNSET), `${edition} judges ENV_REQUIRED_UNSET`);
    assert.ok(findings.some((finding) => finding.code === ENV_SEALED_UNREAD), `${edition} judges ENV_SEALED_UNREAD`);
  }
});

test('env parity is clean in full when the roster and the stack declare the required reads', (t) => {
  const files = {
    ...BASE,
    '.starcistacks/dev/secrets/app.enc': sealedDotenv(['ENGINE_SHARED_SECRET', 'PRIMARY_DB_URL', 'OPENCLAW_MANAGE_AGENTS', 'CALENDAR_WEBHOOK_SECRET']),
    '.starcistacks/dev/infra/compose/api.yaml': 'services:\n  api:\n    environment:\n      API_PORT: "3000"\n',
    '.starcistacks/dev/runtime/env/KEYS.md': '# Keys\n\n| Key | Meaning |\n| --- | --- |\n| `API_PORT` | port |\n| `PRIMARY_DB_URL` | database (secret) |\n',
  };
  const root = tree(t, files);
  assert.deepEqual(parityOf(root, files), []);
});

test('a key sealed in two members is ENV_DUPLICATE', (t) => {
  const files = {
    ...BASE,
    '.starcistacks/dev/secrets/engine.enc': sealedDotenv(['ENGINE_SHARED_SECRET']),
    '.starcistacks/dev/secrets/app.enc': sealedDotenv(['ENGINE_SHARED_SECRET', 'PRIMARY_DB_URL', 'OPENCLAW_MANAGE_AGENTS', 'CALENDAR_WEBHOOK_SECRET']),
    '.starcistacks/dev/runtime/env/KEYS.md': '| `API_PORT` | port |\n',
  };
  const root = tree(t, files);
  const duplicates = codes(parityOf(root, files), ENV_DUPLICATE);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].path, '.starcistacks/dev/secrets/engine.enc');
  assert.match(duplicates[0].message, /ENGINE_SHARED_SECRET/);
});

test('a NEXT_PUBLIC_ key in custody is ENV_PUBLIC_SEALED', (t) => {
  const files = {
    ...BASE,
    '.starcistacks/dev/secrets/web.enc': sealedDotenv(['NEXT_PUBLIC_API_URL']),
    '.starcistacks/dev/secrets/app.enc': sealedDotenv(['ENGINE_SHARED_SECRET', 'PRIMARY_DB_URL', 'OPENCLAW_MANAGE_AGENTS', 'CALENDAR_WEBHOOK_SECRET']),
    '.starcistacks/dev/runtime/env/KEYS.md': '| `API_PORT` | port |\n',
  };
  const root = tree(t, files);
  const findings = parityOf(root, files);
  assert.deepEqual(codes(findings, ENV_PUBLIC_SEALED).map((f) => f.path), ['.starcistacks/dev/secrets/web.enc']);
  assert.ok(codes(findings, ENV_SEALED_UNREAD).every((f) => !/NEXT_PUBLIC_API_URL/.test(f.message)), 'the specific public-custody code wins over sealed-unread');
});

test('an env example key nothing reads is ENV_EXAMPLE_DRIFT', (t) => {
  const files = {
    ...BASE,
    'deploy/app.env.example': 'API_PORT=3000\nPRIMARY_DB_URL=<postgres-url>\nQUEUE_RELAY_INTERVAL=200ms\nQUEUE_RELAY_BATCH=50\n',
  };
  const root = tree(t, files);
  const drift = codes(parityOf(root, files), ENV_EXAMPLE_DRIFT);
  assert.deepEqual(drift.map((f) => f.message.match(/names (\w+)/)[1]).sort(byCodeUnit), ['QUEUE_RELAY_BATCH', 'QUEUE_RELAY_INTERVAL']);
});

test('an env example value that cannot parse is ENV_VALUE_SHAPE (the nivo D2-03 bool shape)', (t) => {
  const files = {
    ...BASE,
    'deploy/app.env.example': 'API_PORT=3000\nOPENCLAW_MANAGE_AGENTS=1\nPRIMARY_DB_URL=<postgres-url>\n',
  };
  const root = tree(t, files);
  const findings = shapeOf(root, files);
  assert.deepEqual(codes(findings, ENV_VALUE_SHAPE).map((f) => f.message.match(/gives (\w+)/)[1]), ['OPENCLAW_MANAGE_AGENTS']);
});

test('an env example of concrete parseable values raises no ENV_VALUE_SHAPE', (t) => {
  const files = {
    ...BASE,
    'deploy/app.env.example': 'API_PORT=3000\nOPENCLAW_MANAGE_AGENTS=true\nPRIMARY_DB_URL=postgres://app:example@db:5432/app\nOPENCLAW_TURN_TIMEOUT=30s\n',
  };
  const root = tree(t, files);
  assert.deepEqual(codes(shapeOf(root, files), ENV_VALUE_SHAPE), []);
});

test('the static walk resolves template keys through the reader call sites', (t) => {
  const files = { ...BASE };
  const root = tree(t, files);
  const reads = collectEnvReads(root, Object.keys(files));
  assert.equal(reads.get('CALENDAR_WEBHOOK_SECRET')?.required, true);
  assert.equal(reads.get('CALENDAR_WEBHOOK_TOLERANCE')?.required, false);
  assert.equal(reads.get('OPENCLAW_TURN_TIMEOUT')?.required, false);
  assert.equal(reads.get('OPENCLAW_MANAGE_AGENTS')?.shape?.kind, 'bool');
  const files2 = { ...BASE, '.starcistacks/dev/secrets/hook.enc': sealedDotenv(['CALENDAR_WEBHOOK_SECRET']) };
  const root2 = tree(t, files2);
  assert.ok(codes(parityOf(root2, files2), ENV_REQUIRED_UNSET).every((f) => !/CALENDAR_WEBHOOK_SECRET/.test(f.message)));
});

function fakeSops(plain = {}) {
  return {
    decrypt: (file) => ({ ...plain[path.basename(file)] }),
    seal: () => assert.fail('verify must not seal'),
  };
}

test('starci app secret verify names key and violated shape and never prints a value', (t) => {
  const { root, env } = app(t, { 'app.enc': sealedDotenv(['OPENCLAW_MANAGE_AGENTS', 'API_PORT', 'PRIMARY_DB_URL']) });
  for (const [file, text] of Object.entries(BASE)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  const sops = fakeSops({ 'app.enc': { OPENCLAW_MANAGE_AGENTS: 'private-bad-bool-1', API_PORT: 'private-bad-port-x', PRIMARY_DB_URL: 'private-db-location' } });
  const result = run(['verify', 'dev'], { cwd: root, env, sops });
  assert.equal(result.code, 2);
  assert.match(result.out, /ENV_VALUE_SHAPE dev\/app\.enc: OPENCLAW_MANAGE_AGENTS is not true or false/);
  assert.match(result.out, /ENV_VALUE_SHAPE dev\/app\.enc: API_PORT is not an integer/);
  privateAbsent(result, ['private-bad-bool-1', 'private-bad-port-x', 'private-db-location']);
});

test('starci app secret verify exits clean when every sealed value parses', (t) => {
  const { root, env } = app(t, { 'app.enc': sealedDotenv(['OPENCLAW_MANAGE_AGENTS', 'API_PORT', 'PRIMARY_DB_URL']) });
  for (const [file, text] of Object.entries(BASE)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  const sops = fakeSops({ 'app.enc': { OPENCLAW_MANAGE_AGENTS: 'true', API_PORT: '3000', PRIMARY_DB_URL: 'private-db-location' } });
  const result = run(['verify', 'dev'], { cwd: root, env, sops });
  assert.equal(result.code, 0);
  assert.match(result.out, /verified dev: 3 keys sealed/);
  privateAbsent(result, ['private-db-location']);
  assert.equal(run(['verify'], { cwd: root, env, sops }).code, 2);
});

const SHAPE_CONFIG = `import type { EnvSource } from "@modules/platform/config"
export function readApiEnv(env: EnvSource) {
  return {
    port: env.int("API_PORT"),
    enabled: env.bool("FEATURE_ENABLED"),
    endpoint: env.url("PROVIDER_URL"),
    timeout: env.duration("REQUEST_TIMEOUT"),
    mode: env.enum("RUN_MODE", ["local", "remote"]),
    token: env.secret("PROVIDER_TOKEN"),
  }
}
`;

test('verify checks every reader shape across members without changing sealed storage', (t) => {
  const values = {
    API_PORT: '3000',
    FEATURE_ENABLED: 'false',
    PROVIDER_URL: 'https://example.invalid',
    REQUEST_TIMEOUT: '30s',
    RUN_MODE: 'remote',
    PROVIDER_TOKEN: 'fixture-token-only',
  };
  const files = {
    'api.enc': sealedDotenv(['API_PORT', 'FEATURE_ENABLED', 'REQUEST_TIMEOUT']),
    'provider.enc': sealedDotenv(['PROVIDER_URL', 'RUN_MODE', 'PROVIDER_TOKEN']),
  };
  const { root, dir, env } = app(t, files);
  const source = path.join(root, 'be/apps/api/src/api.env.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, SHAPE_CONFIG);
  const plain = {
    'api.enc': { API_PORT: values.API_PORT, FEATURE_ENABLED: values.FEATURE_ENABLED, REQUEST_TIMEOUT: values.REQUEST_TIMEOUT },
    'provider.enc': { PROVIDER_URL: values.PROVIDER_URL, RUN_MODE: values.RUN_MODE, PROVIDER_TOKEN: values.PROVIDER_TOKEN },
  };
  const passing = run(['verify', 'dev'], { cwd: root, env, sops: fakeSops(plain) });
  assert.equal(passing.code, 0);
  assert.match(passing.out, /verified dev: 6 keys sealed/);
  privateAbsent(passing, Object.values(values));

  const invalid = Object.fromEntries(Object.keys(values).map((key) => [key, `fixture-invalid-${key}`]));
  invalid.PROVIDER_TOKEN = '';
  const failing = run(['verify', 'dev'], {
    cwd: root,
    env,
    sops: fakeSops({
      'api.enc': { API_PORT: invalid.API_PORT, FEATURE_ENABLED: invalid.FEATURE_ENABLED, REQUEST_TIMEOUT: invalid.REQUEST_TIMEOUT },
      'provider.enc': { PROVIDER_URL: invalid.PROVIDER_URL, RUN_MODE: invalid.RUN_MODE, PROVIDER_TOKEN: invalid.PROVIDER_TOKEN },
    }),
  });
  assert.equal(failing.code, 2);
  assert.equal(failing.out.trim().split('\n').length, 6);
  for (const key of Object.keys(values)) assert.ok(failing.out.includes(`${key} is not `));
  privateAbsent(failing, Object.values(invalid));
  for (const [name, text] of Object.entries(files)) assert.ok(fs.readFileSync(path.join(dir, name), 'utf8') === text);
  assert.deepEqual(fs.readdirSync(dir).sort(byCodeUnit), ['api.enc', 'provider.enc']);
});

test('verify sanitizes an unexpected decrypt failure without printing its message', (t) => {
  const { root, env } = app(t, { 'app.enc': sealedDotenv(['PROVIDER_TOKEN']) });
  const privateMessage = 'fixture-private-decrypt-message';
  const sops = {
    decrypt: () => { throw new Error(privateMessage); },
    seal: () => assert.fail('verify must not seal'),
  };
  const result = run(['verify', 'dev'], { cwd: root, env, sops });
  assert.equal(result.code, 2);
  assert.match(result.err, /operation failed/);
  privateAbsent(result, [privateMessage]);
});
