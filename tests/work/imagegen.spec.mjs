// `starci work imagegen` with an injected runner: success writes the images, their prompt copies and the receipt the Work gate
// reads; a quota or a runner failure is a typed refusal that still releases the slot; an output outside the worktree is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { main } from '../../scripts/work/imagegen.mjs';
import { imagegenArgs, imagegenBrief } from '../../scripts/work/imagegen/imagegen-codex.mjs';
import { blankImage, encodePng } from '../../scripts/work/png.mjs';
import { checkReceipt } from '../../scripts/work/validate/work-artifact-verification.mjs';
import { declarationsOf, RECEIPT_DECLARATIONS } from '../../scripts/work/validate/work-artifact-declarations.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

const PNG = Buffer.from(encodePng(blankImage(8, 4)));
const NO_EVENTS = { threadId: null, usage: null, failures: [], lastMessage: null };

function world(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-imagegen-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  const root = path.join(base, 'repo');
  const codexHome = path.join(base, 'codex-home');
  fs.mkdirSync(path.join(root, 'rec', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.mkdirSync(path.join(base, 'elsewhere'), { recursive: true });
  fs.writeFileSync(path.join(base, 'mascot.prompt.txt'), 'A calm unicorn mascot, flat style.\n');
  fs.writeFileSync(path.join(root, 'rec', 'ref.png'), PNG);
  return { base, root, codexHome, assets: path.join(root, 'rec', 'assets'), prompt: path.join(base, 'mascot.prompt.txt'), env: { ...process.env, CODEX_HOME: codexHome } };
}

/** A runner standing in for `codex exec`: it leaves `images` PNGs in the thread directory and reports `outcome`. */
function runnerOf(w, { images = 1, outcome = {}, seen = [] } = {}) {
  return async (call) => {
    seen.push(call);
    call.onSpawn(777);
    const dir = path.join(w.codexHome, 'generated_images', 'thread-1');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < images; i += 1) fs.writeFileSync(path.join(dir, `exec-${i}.png`), PNG);
    return { code: 0, signal: null, pid: 777, timedOut: false, exited: true, error: null, stderr: '',
      events: { threadId: 'thread-1', usage: { input_tokens: 10, output_tokens: 2 }, failures: [], lastMessage: 'done' }, ...outcome };
  };
}

async function call(w, argv, { io = { ...fakeAdmission(), history: () => ({}) }, deps = {}, root = w.root } = {}) {
  let stdout = '', stderr = '';
  const code = await main(argv, { env: w.env, root, context: { jobId: 'job-9' }, io, deps, out: { write: (s) => { stdout += s; } }, err: { write: (s) => { stderr += s; } } });
  return { code, stdout, stderr, io };
}

const base = (w, extra = []) => ['--prompt', w.prompt, '--out', w.assets, '--name', 'mascot', '--json', ...extra];

test('success writes the images, their prompt copies and a receipt the Work gate can verify', async (t) => {
  const w = world(t);
  const seen = [];
  const reference = path.join(w.root, 'rec', 'ref.png');
  const r = await call(w, base(w, ['--count', '1', '--size', '1536x1024', '--reference', reference, '--stage', 'initial']), { deps: { runner: runnerOf(w, { seen }) } });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const result = JSON.parse(r.stdout);
  assert.deepEqual([result.ok, result.model, result.tier, result.requested, result.produced, result.complete], [true, 'gpt-6.1-sol', 'imagegen', 1, 1, true]);
  assert.equal(fs.readFileSync(path.join(w.assets, 'mascot-1.png')).equals(PNG), true);
  assert.equal(fs.readFileSync(path.join(w.assets, 'mascot-1.prompt.txt'), 'utf8'), 'A calm unicorn mascot, flat style.\n');
  const receipt = parseYaml(fs.readFileSync(path.join(w.assets, 'generation-receipts.yaml'), 'utf8'));
  assert.deepEqual([receipt.schema, receipt.tool, receipt.calls.length], ['starci/generation-receipts@1', 'image_gen.imagegen', 1]);
  const entry = receipt.calls[0];
  assert.equal(entry.artifact, 'assets/mascot-1.png');
  assert.equal(entry.sha256, sha256(PNG));
  assert.equal(entry.prompt, 'assets/mascot-1.prompt.txt');
  assert.equal(entry.promptSha256, sha256(fs.readFileSync(path.join(w.assets, 'mascot-1.prompt.txt'))));
  assert.deepEqual([entry.stage, entry.model, entry.effort, entry.tier, entry.toolOutputBasename, entry.width, entry.height, entry.requestedSize],
    ['initial', 'gpt-6.1-sol', 'high', 'imagegen', 'exec-0.png', 8, 4, '1536x1024']);
  assert.deepEqual(entry.referencedImages, [{ path: 'rec/ref.png', sha256: sha256(PNG) }]);
  assert.deepEqual(entry.usage, { input_tokens: 10, output_tokens: 2 });
  assert.equal(seen.length, 1);
  assert.ok(seen[0].args.includes(`--image=${reference}`), 'the reference reaches codex exec');
  assert.match(seen[0].brief, /Requested size: 1536x1024/);
  assert.deepEqual(r.io.calls.map(([name, value]) => (name === 'mark' ? `mark:${value.state}` : name)), ['reserve', 'mark:launching', 'mark:live', 'release']);
  assert.deepEqual(r.io.calls.at(-1)[1], { kind: 'process-exited', confirmed: true, pid: 777 });
});

test('a second call appends to the receipt and a taken target name is refused', async (t) => {
  const w = world(t);
  assert.equal((await call(w, base(w, ['--count', '2']), { deps: { runner: runnerOf(w, { images: 2 }) } })).code, 0);
  const again = await call(w, base(w), { deps: { runner: runnerOf(w) } });
  assert.equal(again.code, 1);
  assert.equal(JSON.parse(again.stdout).code, 'IMAGEGEN_BAD_INPUT');
  assert.equal((await call(w, ['--prompt', w.prompt, '--out', w.assets, '--name', 'variant', '--json'], { deps: { runner: runnerOf(w) } })).code, 0);
  const receipt = parseYaml(fs.readFileSync(path.join(w.assets, 'generation-receipts.yaml'), 'utf8'));
  assert.deepEqual(receipt.calls.map((entry) => entry.artifact), ['assets/mascot-1.png', 'assets/mascot-2.png', 'assets/variant-1.png']);
});

test('a member out of tokens is a quota refusal: the runner never starts and nothing is written or reserved', async (t) => {
  const w = world(t);
  const seen = [];
  const r = await call(w, base(w), { io: { ...fakeAdmission({ used: { codex: 93 } }), history: () => ({}) }, deps: { runner: runnerOf(w, { seen }) } });
  const result = JSON.parse(r.stdout);
  assert.deepEqual([r.code, result.ok, result.code, result.admission.kind, result.admission.reason], [1, false, 'IMAGEGEN_QUOTA', 'quota', 'tokens-out']);
  assert.equal(seen.length, 0);
  assert.equal(r.io.calls.filter(([name]) => name === 'reserve').length, 0);
  assert.equal(fs.existsSync(path.join(w.assets, 'mascot-1.png')), false);
});

test('a runner failure is a typed refusal that releases the slot and writes no image', async (t) => {
  const w = world(t);
  const failing = (failures, extra = {}) => ({ events: { ...NO_EVENTS, failures }, code: 1, ...extra });
  const cases = [
    [failing(['You have hit your usage limit']), 'IMAGEGEN_QUOTA'],
    [failing(['Not logged in, please sign in']), 'IMAGEGEN_UNAVAILABLE'],
    [failing(['stream disconnected']), 'IMAGEGEN_RUNNER_FAILED'],
    [failing([], { code: 3, stderr: 'boom' }), 'IMAGEGEN_RUNNER_FAILED'],
    [failing([], { timedOut: true, code: null }), 'IMAGEGEN_TIMEOUT'],
    [failing([], { error: 'spawn codex ENOENT', code: null, pid: null }), 'IMAGEGEN_RUNNER_FAILED'],
  ];
  for (const [outcome, expected] of cases) {
    const r = await call(w, base(w), { deps: { runner: runnerOf(w, { images: 0, outcome }) } });
    assert.equal(r.code, 1, expected);
    assert.equal(JSON.parse(r.stdout).code, expected);
    assert.equal(r.io.calls.filter(([name]) => name === 'release').length, 1, `${expected} releases its slot`);
  }
  const silent = await call(w, base(w), { deps: { runner: runnerOf(w, { images: 0 }) } });
  assert.equal(JSON.parse(silent.stdout).code, 'IMAGEGEN_NO_OUTPUT');
  assert.equal(fs.existsSync(path.join(w.assets, 'generation-receipts.yaml')), false);
});

test('a child that did not exit keeps its slot', async (t) => {
  const w = world(t);
  const r = await call(w, base(w), { deps: { runner: runnerOf(w, { images: 0, outcome: { timedOut: true, exited: false, code: null } }) } });
  assert.equal(JSON.parse(r.stdout).code, 'IMAGEGEN_TIMEOUT');
  assert.equal(r.io.calls.filter(([name]) => name === 'release').length, 0);
});

test('an output directory or reference outside the worktree, or inside .git, is refused before anything runs', async (t) => {
  const w = world(t);
  const seen = [];
  const deps = { runner: runnerOf(w, { seen }) };
  for (const out of [path.join(w.base, 'elsewhere'), path.join(w.root, '..', 'elsewhere'), path.join(w.root, '.git', 'x')]) {
    const r = await call(w, ['--prompt', w.prompt, '--out', out, '--json'], { deps });
    assert.equal(r.code, 1, out);
    assert.equal(JSON.parse(r.stdout).code, 'IMAGEGEN_OUT_OF_WORKTREE', out);
    assert.equal(r.io.calls.length, 0, 'no reservation for a refused request');
  }
  fs.writeFileSync(path.join(w.base, 'elsewhere', 'ref.png'), PNG);
  const outside = await call(w, base(w, ['--reference', path.join(w.base, 'elsewhere', 'ref.png')]), { deps });
  assert.equal(JSON.parse(outside.stdout).code, 'IMAGEGEN_OUT_OF_WORKTREE');
  assert.equal(seen.length, 0);
  assert.deepEqual(fs.readdirSync(path.join(w.base, 'elsewhere')), ['ref.png']);
  const noTree = await call(w, ['--prompt', w.prompt, '--out', path.join(w.root, 'a'), '--json'], { root: null, deps });
  assert.equal(JSON.parse(noTree.stdout).code, 'IMAGEGEN_OUT_OF_WORKTREE');
});

test('bad input is refused with its code and a missing flag is a usage error', async (t) => {
  const w = world(t);
  const deps = { runner: runnerOf(w) };
  const refusals = [
    [['--prompt', path.join(w.base, 'none.txt'), '--out', w.assets, '--json'], /does not exist/],
    [base(w, ['--count', '99']), /--count must be an integer from 1 to 8/],
    [base(w, ['--size', 'big']), /--size must look like/],
    [base(w, ['--reference', path.join(w.base, 'mascot.prompt.txt')]), /not a png, jpg or webp/],
    [['--prompt', w.prompt, '--out', w.assets, '--name', '../x', '--json'], /--name must be a file stem/],
  ];
  for (const [argv, pattern] of refusals) {
    const r = await call(w, argv, { deps });
    assert.equal(r.code, 1, argv.join(' '));
    const result = JSON.parse(r.stdout);
    assert.equal(result.code, 'IMAGEGEN_BAD_INPUT');
    assert.match(result.detail, pattern);
  }
  const usage = await call(w, ['--out', 'x'], { deps });
  assert.equal(usage.code, 2);
  assert.match(usage.stderr, /--prompt is required/);
});

test('the codex argv runs one read-only, ephemeral, JSON run on the member model and the brief states count, size and references', () => {
  const args = imagegenArgs({ cwd: '/work', member: { model: 'gpt-6.1-sol', effort: 'high' }, references: ['/a.png', '/b.png'] });
  assert.deepEqual(args.slice(0, 3), ['exec', '--json', '--ephemeral']);
  assert.deepEqual(args.slice(args.indexOf('-s'), args.indexOf('-s') + 2), ['-s', 'read-only']);
  assert.deepEqual(args.slice(args.indexOf('-m'), args.indexOf('-m') + 2), ['-m', 'gpt-6.1-sol']);
  assert.ok(args.includes('model_reasoning_effort="high"'));
  assert.deepEqual(args.filter((value) => value.startsWith('--image=')), ['--image=/a.png', '--image=/b.png']);
  assert.equal(args.at(-1), '-', 'the brief goes in on stdin');
  const brief = imagegenBrief({ promptText: Buffer.from('draw it'), count: 2, size: null, referenceCount: 2 });
  assert.match(brief, /exactly 2 images/);
  assert.match(brief, /draw it/);
  assert.doesNotMatch(brief, /Requested size/);
});

test('the Work gate verifies the receipt: image and prompt bytes are opened and their digests agree', async (t) => {
  const w = world(t);
  assert.equal((await call(w, base(w, ['--reference', path.join(w.root, 'rec', 'ref.png')]), { deps: { runner: runnerOf(w) } })).code, 0);
  const findings = [];
  const sink = { refuse: (file, code) => findings.push(code), suspect: (file, code) => findings.push(code), info: () => {} };
  const seen = { declarations: 0, filesOpened: 0, digests: 0, digestsCompared: 0, receiptCalls: 0 };
  const record = path.join(w.root, 'rec');
  checkReceipt(path.join(w.assets, 'generation-receipts.yaml'), { repoRoot: w.root, workRoot: record, recordDir: record, ownerDirOf: () => record, blobOptions: null },
    sink, seen, { declarationsOf, receiptDeclarations: RECEIPT_DECLARATIONS });
  assert.deepEqual(findings, []);
  assert.deepEqual([seen.receiptCalls, seen.filesOpened, seen.digestsCompared], [1, 3, 3]);
  fs.writeFileSync(path.join(w.assets, 'mascot-1.png'), Buffer.concat([PNG, Buffer.from([0])]));
  checkReceipt(path.join(w.assets, 'generation-receipts.yaml'), { repoRoot: w.root, workRoot: record, recordDir: record, ownerDirOf: () => record, blobOptions: null },
    sink, seen, { declarationsOf, receiptDeclarations: RECEIPT_DECLARATIONS });
  assert.equal(findings.length > 0, true, 'a changed image no longer matches its receipt digest');
});
