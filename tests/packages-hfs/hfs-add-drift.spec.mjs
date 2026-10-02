import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

// The platform capabilities of the patterns (event-bus, queue, jobs) have ONE source: the template bodies `hfs add` writes
// (packages/hfs/templates/be/patterns, named by the files: tree of each pattern topic). The reference example (examples/ecommerce-app) holds
// the generated copy, so this spec renders every template of a capability the example carries and holds each file to it: a hand edit of
// the example's copy, or an edit of a template that was not regenerated into the example, is a drift. The migration stamp is read from the
// example's own migration file name.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EXAMPLE = path.join(ROOT, 'examples', 'ecommerce-app', 'be');
const TEMPLATES = path.join(ROOT, 'packages', 'hfs', 'templates', 'be', 'patterns');
const PLATFORM = 'src/modules/platform/';

const tree = (topic) => parse(fs.readFileSync(path.join(ROOT, 'knowledge', 'patterns', 'be', `${topic}.yaml`), 'utf8')).files.filter((entry) => entry.path.startsWith(PLATFORM) && entry.template);

/** The platform folder of an entry (`src/modules/platform/<capability>`). */
const capabilityOf = (entry) => entry.path.split('/').slice(0, 4).join('/');

/** The stamp of the example's migration in the capability folder, or null when it has none. */
const stampOf = (capability) => {
  const dir = path.join(EXAMPLE, capability, 'persistence', 'migrations');
  if (!fs.existsSync(dir)) return null;
  const file = fs.readdirSync(dir).find((name) => /^\d{13}-/.test(name));
  return file ? file.slice(0, 13) : null;
};

for (const topic of ['event-bus', 'queues', 'jobs']) {
  test(`${topic}: every platform file of the example equals its template`, () => {
    const entries = tree(topic);
    const capabilities = [...new Set(entries.map(capabilityOf))];
    for (const capability of capabilities) {
      if (!fs.existsSync(path.join(EXAMPLE, capability, 'index.ts'))) continue;
      const stamp = stampOf(capability);
      assert.notEqual(stamp, null, `${capability} has no migration to read the stamp from`);
      for (const entry of entries.filter((candidate) => capabilityOf(candidate) === capability)) {
        const target = path.join(EXAMPLE, ...entry.path.replace('<epochMs13>', stamp).split('/'));
        assert.ok(fs.existsSync(target), `${entry.path} is missing from the example`);
        const body = fs.readFileSync(path.join(TEMPLATES, ...entry.template.split('/')), 'utf8').replaceAll('@@epochMs13@@', stamp);
        assert.ok(!/@@[A-Za-z0-9]+@@/.test(body), `${entry.template} has a placeholder the stamp does not fill`);
        assert.equal(fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n'), body.replace(/\r\n/g, '\n'), `${entry.path} drifted from ${entry.template}`);
      }
    }
  });
}

test('the event-bus capability is carried by the example, so its drift check is not vacuous', () => {
  assert.ok(fs.existsSync(path.join(EXAMPLE, 'src', 'modules', 'platform', 'event-bus', 'index.ts')));
});
