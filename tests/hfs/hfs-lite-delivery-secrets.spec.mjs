// Production delivery slots remain on the R06 plaintext scan. They add no R220 encrypted custody home.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { secretFindings } from '../../scripts/hfs/rules/secrets.mjs';

const DECLARATION = {
  hfs: 3,
  kind: 'app',
  project: 'delivery',
  edition: 'lite',
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
};
const manifest = loadSlotManifest();
const repo = resolveRepoDeclaration(manifest, DECLARATION);
const resolver = createSlotResolver(manifest, repo);
const SECRET_CODES = new Set(['HFS_PLAINTEXT_SECRET', 'HFS_LITE_SECRET_CUSTODY']);
const secretsOf = findings => findings.filter(item => SECRET_CODES.has(item.code));

const tree = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lite-delivery-secrets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, ...file.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return root;
};
const checked = (root, files) => checkRepo({ repoRoot: root, declaration: DECLARATION, manifest, files, tree: false });

// These are variable references and deliberately identified examples, never credential values.
const DELIVERY = {
  'deploy/compose.yml': 'services:\n  core:\n    environment:\n      SECRET_FILE: ${APP_SECRET_FILE}\n',
  'deploy/production/docker-compose.yaml': 'services:\n  web:\n    environment:\n      API_KEY: "${APP_API_KEY}"\n',
  'deploy/Caddyfile': '{$APP_DOMAIN} {\n  reverse_proxy core:3000\n}\n',
  'deploy/production/app.env.example': 'APP_DOMAIN=example.invalid\nSECRET="example-only-value"\n',
  'deploy/production/.env.example': 'PASSWORD="changeMe-example-value"\nAPP_SECRET_FILE=/run/secrets/app\n',
  'deploy/ops/restart.sh': '#!/bin/sh\nsecret="$APP_SECRET"\ndocker compose -f deploy/compose.yml restart\n',
  '.github/workflows/core-deploy.yml': 'on: workflow_dispatch\nenv:\n  SECRET: ${{ secrets.APP_SECRET }}\n',
  '.github/workflows/web-deploy.yml': 'on: workflow_dispatch\nenv:\n  API_KEY: ${{ secrets.APP_API_KEY }}\n',
  '.github/workflows/authorize-deploy-key.yml': 'on: workflow_dispatch\nenv:\n  SECRET: ${{ secrets.DEPLOY_AUTHORIZATION }}\n',
  'scripts/env-sync.mjs': 'const secret = process.env.APP_SECRET;\n',
  'scripts/with-secrets.mjs': 'const secretFile = process.env.APP_SECRET_FILE;\n',
  'scripts/set-secrets.ps1': '$secret = $env:APP_SECRET\n',
  'scripts/build-core.mjs': 'const apiKey = process.env.APP_API_KEY;\n',
  'scripts/build-web.mjs': 'const secret = "env(APP_SECRET)";\n',
};

// Assemble scanner candidates at runtime so this spec itself carries no scannable credential.
const AWS_KEY = ['AKIA', 'Q'.repeat(16)].join('');
const ASSIGNED_VALUE = ['Zk3pQ9vL2m', 'X8aR5tY7uN'].join('');
const ENC = 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]';
const ENVELOPE = `${JSON.stringify({ data: ENC, sops: { mac: ENC, age: [] } })}\n`;

test('lite delivery tooling owns its paths and allows env references and env examples through R06/R220', t => {
  const files = Object.keys(DELIVERY);
  for (const file of files) assert.equal(resolver.classifyPath(file).status, 'owned', file);
  const root = tree(t, DELIVERY);
  assert.deepEqual(secretFindings({ repoRoot: root, files, resolver }), []);
  assert.deepEqual(secretsOf(checked(root, files).findings), []);
});

test('every owned delivery file still rejects a provider credential, including env examples and comment lines', t => {
  const files = Object.keys(DELIVERY);
  const root = tree(t, Object.fromEntries(Object.entries(DELIVERY).map(([file, text]) => [file, `${text}# copied credential ${AWS_KEY}\n`])));
  const ordinary = secretFindings({ repoRoot: root, files, resolver });
  const findings = secretsOf(checked(root, files).findings);
  const expected = files.map(file => [file, 'HFS_PLAINTEXT_SECRET', 'aws-access-key', DELIVERY[file].split('\n').length]).sort();
  const shape = items => items.map(item => [item.path, item.code, item.pattern, item.line]).sort();
  assert.deepEqual(shape(ordinary), expected);
  assert.deepEqual(shape(findings), expected, 'the edition/catalog filter must retain R06 for delivery tooling');
  assert.ok(findings.every(item => !item.message.includes(AWS_KEY)), 'findings must never echo the captured value');
});

test('assigned plaintext values in delivery examples and scripts are refused while stand-ins remain accepted', t => {
  const files = ['deploy/production/.env.example', 'scripts/with-secrets.mjs', '.github/workflows/authorize-deploy-key.yml'];
  const root = tree(t, Object.fromEntries(files.map(file => [file, `secret = "${ASSIGNED_VALUE}"\n`])));
  const findings = secretsOf(checked(root, files).findings);
  assert.deepEqual(findings.map(item => [item.path, item.code, item.pattern]).sort(), files.map(file => [file, 'HFS_PLAINTEXT_SECRET', 'assigned-secret']).sort());
  assert.ok(findings.every(item => !item.message.includes(ASSIGNED_VALUE)), 'findings name the shape, not the plaintext');
});

test('deploy does not grant an env file, private key or plaintext .enc a secret-scan exemption', t => {
  const contents = {
    'deploy/production/.env': 'PUBLIC_VALUE=example\n',
    'deploy/production/deploy.key': 'example\n',
    'deploy/production/app.enc': 'PUBLIC_VALUE=example\n',
  };
  const root = tree(t, contents);
  const findings = secretsOf(checked(root, Object.keys(contents)).findings);
  assert.deepEqual(findings.map(item => [item.path, item.code, item.pattern]).sort(), [
    ['deploy/production/.env', 'HFS_PLAINTEXT_SECRET', 'env-file'],
    ['deploy/production/deploy.key', 'HFS_PLAINTEXT_SECRET', 'private-key-file'],
    ['deploy/production/app.enc', 'HFS_PLAINTEXT_SECRET', 'sops-not-envelope'],
    ['deploy/production/app.enc', 'HFS_LITE_SECRET_CUSTODY', 'sealed-file-home'],
  ].sort());
});

test('valid sealed delivery files remain outside lite custody; the existing starcistacks home is the only exception', t => {
  const files = ['deploy/production/app.enc', 'scripts/app.enc', '.github/workflows/deploy-key.enc', '.starcistacks/prod/secrets/app.enc'];
  const root = tree(t, Object.fromEntries(files.map(file => [file, ENVELOPE])));
  assert.deepEqual(secretFindings({ repoRoot: root, files, resolver }), [], 'R06 recognizes a valid envelope independently of its custody path');
  assert.deepEqual(secretsOf(checked(root, files).findings).map(item => [item.path, item.code, item.pattern]).sort(), files.filter(file => !file.startsWith('.starcistacks/')).map(file => [file, 'HFS_LITE_SECRET_CUSTODY', 'sealed-file-home']).sort());
});
