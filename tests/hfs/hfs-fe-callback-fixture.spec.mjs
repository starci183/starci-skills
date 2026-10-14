import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { callbackShape } from '../../packages/eslint/fe/callback-shape.mjs';
import { hfsFromDeclaration } from '../../packages/eslint/fe/lib/hfs.mjs';
import { createSlotResolver, loadSlotManifest, readRepoDeclaration } from '../../scripts/hfs/slots.mjs';

const root = fileURLToPath(new URL('../fixtures/hfs-callback-full/', import.meta.url));
const callbackPath = 'apps/web/src/app/auth/callback/route.ts';
const filename = path.join(root, 'fe', callbackPath);
const declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8'));
const source = fs.readFileSync(filename, 'utf8');

function findings(code) {
  return new Linter().verify(code, [{
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    settings: { starci: { hfs: hfsFromDeclaration(declaration, path.join(root, 'fe')) } },
    plugins: { fixture: { rules: { callback: callbackShape } } },
    rules: { 'fixture/callback': 'error' },
  }], { filename });
}

test('full callback fixture enables its Supabase slot and passes the callback rule', () => {
  const manifest = loadSlotManifest();
  const repo = readRepoDeclaration(manifest, root);
  assert.equal(repo.edition, 'full');
  assert.equal(createSlotResolver(manifest, repo).classifyPath(`fe/${callbackPath}`).slot, 'fe.route.callback');
  assert.deepEqual(findings(source), []);
});

test('full callback fixture rejects extra network work before its redirect', () => {
  const violating = source.replace('return NextResponse.redirect', 'await fetch("/profile"); return NextResponse.redirect');
  assert.deepEqual(findings(violating).map((finding) => finding.messageId), ['shape']);
});
