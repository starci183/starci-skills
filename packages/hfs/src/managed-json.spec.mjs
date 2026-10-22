// A JSON file is managed canon, not authored JSON, when a managed slot of the slot manifest names it: its template in @starci/hfs, and
// an app's render of that template (scripts/lib/managed-json.mjs, read by the runtime's json-exceptions check). Any byte of difference
// from the template keeps a file authored.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { declaredTemplateNames, isManagedRender, managedTemplatesOf } from '../runtime/scripts/lib/managed-json.mjs';
import { loadSlotManifest } from '../runtime/scripts/hfs/slots.mjs';

const manifest = loadSlotManifest();
const BROWSER_TEMPLATE = 'app/browser-config/browser/tsconfig.json';
const templateText = fs.readFileSync(new URL(`../templates/${BROWSER_TEMPLATE}`, import.meta.url), 'utf8');

test('the browser tsconfig of an app is rendered from the browser-config template of app.browser-config', () => {
  assert.ok(managedTemplatesOf(manifest, 'browser/tsconfig.json').includes(BROWSER_TEMPLATE));
});

test('a file no managed slot lists has no template', () => {
  assert.deepEqual(managedTemplatesOf(manifest, 'browser/journeys/shop.ts'), []);
  assert.deepEqual(managedTemplatesOf(manifest, 'be/src/tests/fixtures/payload.json'), []);
});

test('a side file is placed under its side: the back end test tsconfig is be.tool-config', () => {
  assert.ok(managedTemplatesOf(manifest, 'be/src/tests/tsconfig.json').includes('be/tool-config/src/tests/tsconfig.json'));
});

test('the slot manifest declares the browser-config template, and never a wildcard as a template name', () => {
  const names = declaredTemplateNames(manifest);
  assert.ok(names.has(BROWSER_TEMPLATE));
  assert.ok([...names].every((name) => !/[*?[<]/.test(name)), 'only literal files of a managed slot are templates');
});

test('a file equal to its template is its render, whatever its line endings', () => {
  assert.equal(isManagedRender(templateText, [{ text: templateText }]), true);
  assert.equal(isManagedRender(templateText.replace(/\n/g, '\r\n'), [{ text: templateText }]), true);
});

test('a file that differs from its template by one byte stays authored', () => {
  assert.equal(isManagedRender(templateText.replace('ES2022', 'ES2023'), [{ text: templateText }]), false);
});

test('a template with a variable is never matched as a render', () => {
  const variable = '{ "name": "{{project}}" }\n';
  assert.equal(isManagedRender(variable, [{ text: variable }]), false);
});

test('no template, no render', () => {
  assert.equal(isManagedRender(templateText, []), false);
});
