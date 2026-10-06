import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../packages/cli/src/main.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// `runtime link` and `runtime install` examples run in-process and write a launcher: they get a throwaway home, never a path in the checkout.
const smokeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-smoke-home-'));
test.after(() => fs.rmSync(smokeHome, { recursive: true, force: true }));
const commands = Object.entries(CATALOG.groups).flatMap(([group, groupSpec]) =>
  Object.entries(groupSpec.verbs).map(([verb, command]) => ({ group, verb, command })),
);

const capture = async (argv) => {
  const output = { out: '', err: '', spawned: [] };
  const code = await main(argv, {
    catalog: CATALOG,
    version: 'smoke-test',
    cwd: repoRoot,
    home: smokeHome,
    env: {},
    stdout: (text) => { output.out += text; },
    stderr: (text) => { output.err += text; },
    locateRuntime: () => ({ root: repoRoot, source: 'smoke-test' }),
    spawn: (program, args, options) => {
      output.spawned.push({ program, args, options });
      return { status: 0 };
    },
    installRuntime: () => 0,
    linkRuntime: () => 0,
    importHfs: async () => ({ main: async () => 0 }),
    importGuard: async () => ({ main: async () => 0 }),
  });
  return { code, ...output };
};

// The catalog examples are POSIX-style command lines. Quotes group a token and
// are removed; a backslash quotes the following character outside single quotes.
const shellWords = (text) => {
  const words = [];
  let word = '';
  let quote = null;
  let escaped = false;
  let active = false;
  for (const char of text) {
    if (escaped) {
      word += char;
      escaped = false;
      active = true;
    } else if (quote === "'") {
      if (char === quote) quote = null;
      else word += char;
    } else if (quote === '"') {
      if (char === quote) quote = null;
      else if (char === '\\') escaped = true;
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      active = true;
    } else if (char === '\\') {
      escaped = true;
      active = true;
    } else if (/\s/.test(char)) {
      if (active) words.push(word);
      word = '';
      active = false;
    } else {
      word += char;
      active = true;
    }
  }
  assert.equal(quote, null, `unterminated quote in: ${text}`);
  assert.equal(escaped, false, `trailing escape in: ${text}`);
  if (active) words.push(word);
  return words;
};

const usageTail = (command) => (command.positional ?? []).map((entry) => {
  const value = entry.enum?.length ? entry.enum.join('|') : entry.name;
  const rendered = entry.variadic ? `${value}...` : value;
  return ` ${entry.required ? `<${rendered}>` : `[${rendered}]`}`;
}).join('');

const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowPattern = (name) => new RegExp(`^  ${escaped(name)}(?: {2,}|$)`, 'm');

test('help reaches every group and verb with generated usage and summaries', async () => {
  const top = await capture(['help']);
  assert.equal(top.code, 0, top.err);
  for (const group of Object.keys(CATALOG.groups)) assert.match(top.out, rowPattern(group), `top help omits ${group}`);

  for (const [group, groupSpec] of Object.entries(CATALOG.groups)) {
    const shown = await capture([group, '--help']);
    assert.equal(shown.code, 0, `${group} help: ${shown.err}`);
    for (const verb of Object.keys(groupSpec.verbs)) assert.match(shown.out, rowPattern(verb), `${group} help omits ${verb}`);
  }

  for (const { group, verb, command } of commands) {
    const shown = await capture([group, verb, '--help']);
    assert.equal(shown.code, 0, `${group} ${verb} help: ${shown.err}`);
    assert.ok(shown.out.includes(`Usage: starci ${group} ${verb}${usageTail(command)} [options]`), `bad usage line for ${group} ${verb}`);
    assert.ok(shown.out.includes(command.summary), `help omits the ${group} ${verb} summary`);
  }
});

test('every documented example is accepted by the dispatcher validation path', async () => {
  const failures = [];
  for (const { group, verb, command } of commands) {
    for (const example of command.examples ?? []) {
      const argv = shellWords(example);
      const program = argv.shift();
      if (program !== 'starci' || argv[0] !== group || argv[1] !== verb) {
        failures.push(`${example}: expected starci ${group} ${verb}`);
        continue;
      }
      const result = await capture(argv);
      if (result.code !== 0) failures.push(`${example}: exit ${result.code}; ${result.err.trim()}`);
    }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
});

test('bad usage exits 2 without reaching a handler or throwing', async () => {
  for (const { group, verb, command } of commands) {
    const unknown = await capture([group, verb, '--definitely-unknown']);
    assert.equal(unknown.code, 2, `${group} ${verb} accepted an unknown flag`);
    assert.match(unknown.err, /unknown option --definitely-unknown/);
    assert.equal(unknown.spawned.length, 0, `${group} ${verb} dispatched after bad usage`);

    const hasRequired = (command.flags ?? []).some((flag) => flag.required)
      || (command.positional ?? []).some((positional) => positional.required);
    if (hasRequired) {
      const missing = await capture([group, verb]);
      assert.equal(missing.code, 2, `${group} ${verb} accepted missing required input`);
      assert.match(missing.err, /missing required (?:option|positional)/);
      assert.equal(missing.spawned.length, 0, `${group} ${verb} dispatched without required input`);
    }
  }
});
