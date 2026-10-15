// proves: build-args prints the public build values of one image, names only in data, with GitHub masking and a multi-line output file.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildArgs } from '../../packages/hfs/stack/build-args.mjs';
import { makeApp, MEMBERS } from '../helpers/stack-fakes-A.mjs';

const apps = [];
const app = (options) => { const made = makeApp(options); apps.push(made); return made; };
after(() => apps.forEach((made) => made.dispose()));

test('literal values and the sealed public keys are printed as KEY=VALUE, data carries key names only', async () => {
  const { config, ctx } = app();
  const result = await buildArgs(ctx(), config, { app: 'web' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, ['PUBLIC_URL=https://app.example.test', `PUBLIC_KEY=${MEMBERS.web.PUBLIC_KEY}`]);
  assert.deepEqual(result.data, { app: 'web', service: 'web', keys: ['PUBLIC_URL', 'PUBLIC_KEY'] });
  assert.ok(!JSON.stringify(result.data).includes(MEMBERS.web.PUBLIC_KEY));
});

test('an image without build arguments prints nothing', async () => {
  const { config, ctx } = app();
  const result = await buildArgs(ctx(), config, { app: 'api' });
  assert.deepEqual(result.lines, []);
  assert.deepEqual(result.data.keys, []);
});

test('an app that no image builds is refused', async () => {
  const { config, ctx } = app();
  await assert.rejects(buildArgs(ctx(), config, { app: 'nothing' }), (error) => error.code === 'STACK_APP_UNKNOWN' && error.exit === 2);
});

test('a sealed key that is absent, empty or multi-line is refused naming the key only', async () => {
  const cases = [undefined, '', 'one\ntwo'].map((value) => app({ members: { ...MEMBERS, web: value === undefined ? {} : { PUBLIC_KEY: value } } }));
  await Promise.all(cases.map(({ config, ctx }) => assert.rejects(buildArgs(ctx(), config, { app: 'web' }), (error) => error.code === 'STACK_BUILD_ARG_INVALID' && error.message.includes('PUBLIC_KEY') && !error.message.includes('two'))));
});

test('a literal value with a line break is refused', async () => {
  const { config, ctx } = app({ mutate: (deploy) => { deploy.images.web.buildArgs.values.PUBLIC_URL = 'a\nb'; } });
  await assert.rejects(buildArgs(ctx(), config, { app: 'web' }), (error) => error.code === 'STACK_BUILD_ARG_INVALID' && error.message.includes('PUBLIC_URL'));
});

test('in GitHub Actions sealed values are masked first and the lines are appended to the output file', async () => {
  const { config, ctx, root } = app();
  const output = path.join(root, 'github-output.txt');
  fs.writeFileSync(output, 'earlier=1\n');
  const result = await buildArgs(ctx({ env: { STARCI_SECRET_VERSION_KEY: 'k', GITHUB_ACTIONS: 'true', GITHUB_OUTPUT: output } }), config, { app: 'web' });
  assert.deepEqual(result.lines, [`::add-mask::${MEMBERS.web.PUBLIC_KEY}`, 'PUBLIC_URL=https://app.example.test', `PUBLIC_KEY=${MEMBERS.web.PUBLIC_KEY}`]);
  assert.equal(fs.readFileSync(output, 'utf8'), `earlier=1\nargs<<BUILD_ARGS_OUTPUT_END\nPUBLIC_URL=https://app.example.test\nPUBLIC_KEY=${MEMBERS.web.PUBLIC_KEY}\nBUILD_ARGS_OUTPUT_END\n`);
});

test('in GitHub Actions without an output file only the masks are added', async () => {
  const { config, ctx } = app();
  const result = await buildArgs(ctx({ env: { STARCI_SECRET_VERSION_KEY: 'k', GITHUB_ACTIONS: 'true' } }), config, { app: 'web' });
  assert.equal(result.lines[0], `::add-mask::${MEMBERS.web.PUBLIC_KEY}`);
  assert.equal(result.lines.length, 3);
});

test('outside GitHub Actions the output file is left alone', async () => {
  const { config, ctx, root } = app();
  const output = path.join(root, 'untouched.txt');
  const result = await buildArgs(ctx({ env: { STARCI_SECRET_VERSION_KEY: 'k', GITHUB_ACTIONS: 'false', GITHUB_OUTPUT: output } }), config, { app: 'web' });
  assert.equal(result.lines.length, 2);
  assert.equal(fs.existsSync(output), false);
});
