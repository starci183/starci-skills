// No knowledge text cites a slot that does not exist. A slot id is cited by the authored canon (knowledge/**, docs/**, the package
// READMEs, the hfs templates); when a slot is deleted (be.app.migrate, be.feature.transport.cli, fe.tool-config-repo) every
// citation goes with it. A token is read as a slot citation when its family (<scope>.<first segment>: be.app, be.feature,
// fe.package, app.task-graph, ...) is the family of a real slot of knowledge/hfs/slots.yaml; it is dead when it is neither a slot
// id nor the prefix of one (be.transport names the family of be.transport.http and is fine).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { walkFiles } from '../../scripts/lib/walk.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SCOPES = ['app', 'repo', 'be', 'fe'];
const TOKEN = /(?<![\w./@-])((?:app|repo|be|fe)\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*)(?![\w-]|\.[a-z]|\/|\*)/g;
const TEXT = /\.(?:md|yaml|yml)$/;

/** Every slot id of the product manifest, the families they form, and every prefix of one. */
export function slotVocabulary(manifest = loadSlotManifest()) {
  const ids = new Set(manifest.slots.map((slot) => slot.id));
  const families = new Set([...ids].map((id) => id.split('.').slice(0, 2).join('.')));
  const prefixes = new Set([...ids].flatMap((id) => id.split('.').map((_, i, parts) => parts.slice(0, i + 1).join('.'))));
  return { ids, families, prefixes };
}

/** The dead slot citations of `text`: [{ token, line }]. */
export function deadCites(text, vocabulary) {
  const dead = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(TOKEN)) {
      const token = match[1];
      if (!SCOPES.includes(token.split('.')[0]) || token.split('.').length < 2) continue;
      const family = token.split('.').slice(0, 2).join('.');
      if (!vocabulary.families.has(family) || vocabulary.prefixes.has(token)) continue;
      dead.push({ token, line: index + 1 });
    }
  });
  return dead;
}

/** The authored canon that cites slots: knowledge, docs, the package READMEs and the hfs templates. */
const canonFiles = () => [
  ...walkFiles(path.join(ROOT, 'knowledge'), { sorted: true }),
  ...walkFiles(path.join(ROOT, 'docs'), { sorted: true }),
  ...walkFiles(path.join(ROOT, 'packages', 'hfs', 'templates'), { sorted: true }),
  ...fs.readdirSync(path.join(ROOT, 'packages'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(ROOT, 'packages', entry.name, 'README.md')).filter((file) => fs.existsSync(file)),
].filter((file) => TEXT.test(file) && !file.split(path.sep).includes('node_modules'));

test('a deleted slot id cited in text is found, a real one, a family prefix and a file name are not', () => {
  const vocabulary = slotVocabulary();
  const found = deadCites('the migrate app (be.app.migrate) and be.feature.transport.cli\nbe.app.cli, be.transport and be.feature.application\n@starci/tsconfig/be.json, fe.package.bogus and be.transport.*', vocabulary);
  assert.deepEqual(found.map((f) => [f.token, f.line]), [['be.app.migrate', 1], ['be.feature.transport.cli', 1], ['fe.package.bogus', 3]]);
});

test('no knowledge text, doc, package README or hfs template cites a slot the manifest does not have', () => {
  const vocabulary = slotVocabulary();
  const dead = canonFiles().flatMap((file) => deadCites(fs.readFileSync(file, 'utf8'), vocabulary).map((hit) => `${path.relative(ROOT, file).split(path.sep).join('/')}:${hit.line} ${hit.token}`));
  assert.deepEqual(dead, []);
});
