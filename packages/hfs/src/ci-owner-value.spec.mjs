import test from 'node:test';
import assert from 'node:assert/strict';
import { setVariable, syncVariables } from '../ci/vars.mjs';
import { verifyCi } from '../ci/verify.mjs';
import { readCiDeclaration } from '../runtime/scripts/hfs/ci-declaration.mjs';

const owner = { name: 'VPS_USER', scope: 'environment', environment: 'production', ownerValue: true };
const literal = { name: 'PUBLIC_HOST', scope: 'repository', value: 'https://example.invalid' };
const declarationOf = (...vars) => readCiDeclaration({ ci: { vars } });

/** The fake GitHub seam records writes and repository lookups without invoking any child process. */
function harness(declaration, options = {}) {
  const calls = [], lookups = [], output = [];
  const gh = {
    repository: (repo) => { lookups.push(repo); return 'example/app'; },
    run: (...args) => calls.push(args),
  };
  return { declaration, options, gh, calls, lookups, output, stdout: (text) => output.push(text) };
}

test('sync skips owner values and executes the remaining public plan', () => {
  const context = harness(declarationOf(owner, literal), { execute: true });
  assert.equal(syncVariables(context), 0);
  assert.deepEqual(context.calls, [[['variable', 'set', 'PUBLIC_HOST', '--body', literal.value, '--repo', 'example/app']]]);
  assert.match(context.output[0], /^skip variable VPS_USER \(environment:production\): owner-supplied value; the owner runs starci app ci var set VPS_USER \[--env ENV\] with the value on stdin\n$/);
  assert.equal(context.output[1], 'set variable PUBLIC_HOST (repository)\n');
});

test('dry sync stays offline and owner-only execution does not look up GitHub', () => {
  const dry = harness(declarationOf(owner, literal));
  assert.equal(syncVariables(dry), 0);
  assert.equal(dry.output[1], 'would set variable PUBLIC_HOST (repository)\n');
  assert.deepEqual(dry.calls, []);
  assert.deepEqual(dry.lookups, []);
  const only = harness(declarationOf(owner), { execute: true });
  assert.equal(syncVariables(only), 0);
  assert.deepEqual(only.calls, []);
  assert.deepEqual(only.lookups, []);
});

test('owner set reads async stdin once and passes the body without echoing it', async () => {
  const context = harness(declarationOf(owner), { env: 'production' });
  let reads = 0;
  const body = 'synthetic-owner-input';
  assert.equal(await setVariable({ ...context, name: owner.name, stdin: async () => { reads += 1; return `${body}\r\n`; } }), 0);
  assert.equal(reads, 1);
  assert.deepEqual(context.calls, [[['variable', 'set', owner.name, '--body', body, '--env', 'production', '--repo', 'example/app']]]);
  assert.equal(context.output.join(''), 'set variable VPS_USER (environment:production)\n');
  assert.ok(!context.output.join('').includes(body));
});

test('owner set refuses argv and empty input before GitHub access', async () => {
  const context = harness(declarationOf(owner), { env: 'production', value: 'synthetic-argv' });
  let reads = 0;
  await assert.rejects(setVariable({ ...context, name: owner.name, stdin: () => { reads += 1; return 'unused'; } }), { code: 'CI_VALUE_ARGV', message: 'CI_VALUE_ARGV: an owner-supplied variable takes its value on stdin' });
  assert.equal(reads, 0);
  for (const stdin of ['', '\n', '\r\n', null]) {
    await assert.rejects(setVariable({ ...context, options: { env: 'production' }, name: owner.name, stdin }), { code: 'CI_VALUE_EMPTY' });
  }
  assert.deepEqual(context.calls, []);
  assert.deepEqual(context.lookups, []);
  assert.deepEqual(context.output, []);
});

test('owner input strips only one newline and literal vars retain argv agreement', async () => {
  const context = harness(declarationOf(owner), { env: 'production' });
  await setVariable({ ...context, name: owner.name, stdin: 'synthetic\n\n' });
  assert.equal(context.calls[0][0][4], 'synthetic\n');
  const publicContext = harness(declarationOf(literal), { value: literal.value });
  assert.equal(await setVariable({ ...publicContext, name: literal.name }), 0);
  await assert.rejects(setVariable({ ...publicContext, name: literal.name, options: { value: 'different' } }), { code: 'CI_VAR_DRIFT' });
});

test('declarations normalize ownerValue and refuse both or neither source', () => {
  const declaration = declarationOf(owner, literal);
  assert.deepEqual(declaration.problems, []);
  assert.equal(declaration.vars[0].ownerValue, true);
  assert.equal(declaration.vars[0].value, undefined);
  assert.equal(declaration.vars[1].ownerValue, false);
  for (const ownerValue of [true, false]) {
    assert.deepEqual(declarationOf({ ...literal, ownerValue }).problems, [{ code: 'CI_DECLARATION_INVALID', at: 'ci.vars[0]', message: 'a variable has either a value or ownerValue' }]);
  }
  for (const entry of [{ name: 'PUBLIC_HOST', scope: 'repository' }, { name: 'PUBLIC_HOST', scope: 'repository', ownerValue: false }]) {
    assert.deepEqual(declarationOf(entry).problems, [{ code: 'CI_DECLARATION_INVALID', at: 'ci.vars[0]', message: 'a variable needs a value or ownerValue: true' }]);
  }
});

test('verification checks owner variable presence without comparing its body', () => {
  const context = harness(declarationOf(owner));
  context.gh.json = (args) => args[0] === 'variable' && args.includes('production') ? [{ name: owner.name, value: 'synthetic-live-value' }] : [];
  assert.equal(verifyCi({ ...context, sealed: [] }), 0);
  assert.equal(context.output.join(''), 'CI verification passed\n');
  context.gh.json = () => [];
  context.output.length = 0;
  assert.equal(verifyCi({ ...context, sealed: [] }), 1);
  assert.equal(context.output.join(''), 'CI_VAR_MISSING: VPS_USER (environment:production)\n');
});
