import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { checkCommand, extractCommands } from '../../scripts/checks/lib/doc-commands.mjs';
import { docCommandFiles, problemsIn } from '../helpers/doc-commands.mjs';

// Every `starci <group> <verb> <flags>` shown to an agent or owner is a call the dispatcher would accept:
// known verb, declared flags, valid enum values, required flags and positionals present (fragments excepted).
const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('documented starci commands are valid calls against the generated catalog', () => {
  const bad = docCommandFiles(ROOT).flatMap((file) => problemsIn(ROOT, file, CATALOG));
  assert.deepEqual(bad, []);
});

const flag = (name, extra = {}) => ({ name, type: 'string', ...extra });
const MODEL = {
  global: [flag('json', { type: 'boolean' }), flag('cwd')],
  groups: {
    demo: {
      verbs: {
        settle: { flags: [flag('job', { required: true }), flag('verdict', { type: 'enum', enum: ['pass', 'fail'], required: true }), flag('dry-run', { type: 'boolean' })], positional: [] },
        show: { flags: [flag('note')], positional: [{ name: 'id', required: true }] },
      },
    },
  },
};
const problems = (text, kind = 'text') => extractCommands(text, { kind }).flatMap((o) => checkCommand(o, MODEL));

test('the checker accepts a complete call and rejects an undeclared flag, a missing required flag and a bad enum value', () => {
  assert.deepEqual(problems('Run `starci demo settle --job j1 --verdict pass --json`.'), []);
  assert.match(problems('Run `starci demo settle --job j1 --verdict pass --nope x`.')[0], /unknown option --nope/);
  assert.match(problems('Run `starci demo settle --verdict pass`.')[0], /missing required option --job/);
  assert.match(problems('Run `starci demo settle --job j1 --verdict maybe`.')[0], /--verdict expects one of/);
  assert.match(problems('Run `starci demo settle --job <id> --verdict pass|skip`.')[0], /--verdict expects one of/);
  assert.match(problems('Run `starci demo show --note hi`.')[0], /missing required positional id/);
  assert.match(problems('Run `starci demo gone --job j1`.')[0], /unknown verb "demo gone"/);
  assert.match(problems('```sh\nstarci demo settle --job j1 \\\n  --bogus 1\n```')[0], /unknown option --bogus/);
});

test('the checker reads placeholders, alternatives and optional groups as values, and treats fragments as fragments', () => {
  assert.deepEqual(problems('`starci demo settle --job <id> [--dry-run] --verdict pass|fail`'), []);
  assert.deepEqual(problems('`starci demo settle`'), []);
  assert.deepEqual(problems('`starci demo settle --job <id> ...`'), []);
  assert.deepEqual(problems('`starci demo settle --job <id> --verdict pass` then `starci demo show 7`'), []);
  assert.deepEqual(problems('Pass `--dry-run` to `starci demo settle`.'), []);
});

test('the checker exempts only constructs: a retired spelling, a log label, a script comment', () => {
  assert.deepEqual(problems('(starci demo settle --old is gone)'), []);
  assert.deepEqual(problems("process.stderr.write('starci history guard: refused');", 'script'), []);
  assert.deepEqual(problems("// starci demo settle --nope\nconst a = 1;", 'script'), []);
  assert.deepEqual(problems("{ spelling: 'starci api', use: 'starci demo show 1' }", 'script'), []);
  assert.match(problems("console.log('use starci demo settle --nope x');", 'script')[0], /unknown option --nope/);
});
