import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256} from '../../engine/digest.mjs';
import {parseYaml, stringifyYaml} from '../../engine/yaml.mjs';
import {SECRET_ENV_FILE} from '../../engine/secrets.mjs';
import {entrySkillsPlan, applyEntrySkillsPlan, bootstrapPlan, payloadFiles, init, update, main} from '../../scripts/install/install.mjs';
import {publishSecret} from '../../scripts/api/fs/publish-secret.mjs';
import {EXAMPLE_CATALOG_FILE, discoverExampleApps, exampleSourcePaths, loadExampleCatalog, exampleArtifactReadOptions} from '../../scripts/lib/example-refs.mjs';
import {hashTree, payloadHash} from '../../scripts/install/payload.mjs';
import {installedPayloadDigest} from '../../scripts/lib/install-custody.mjs';
import {buildReadDigest} from '../../scripts/gates/read-digest.mjs';

const source = path.resolve(import.meta.dirname, '..', '..');
const sourcePackage = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const selectedExampleFiles = sourcePackage.files.filter(relative => relative.startsWith('examples/')
  && !relative.endsWith('/') && !relative.includes('*'));
const digest = body => sha256(String(body).replace(/\r\n/g, '\n'));
const write = (repo, relative, body) => {
  const file = path.join(repo, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, body);
  return file;
};
const fixture = t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-entry-'));
  t.after(() => {
    const resolved = path.resolve(repo);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('starci-entry-'));
    fs.rmSync(resolved, {recursive: true, force: true});
  });
  return repo;
};
const exampleFixture = t => {
  const repo = fixture(t);
  write(repo, 'package.json', JSON.stringify({name: JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8')).name}));
  write(repo, 'modules/schemas/code-example-catalog.schema.yaml', fs.readFileSync(path.join(source, 'modules/schemas/code-example-catalog.schema.yaml')));
  write(repo, 'examples/current/hfs.json', JSON.stringify({kind: 'app'}));
  write(repo, 'examples/current/be/owner.ts', 'export const owner = 1;\n');
  write(repo, 'examples/current/be/contracts.json', '{}\n');
  write(repo, 'examples/current/be/tsconfig.json', JSON.stringify({include: ['*.ts']}));
  const row = {id: 'current', path: 'current', lane: 'backend', title: 'Current owner', summary: 'Actual source and program inputs.',
    relatedRules: ['BE-DOMAIN-1'], files: ['be/owner.ts', 'be/contracts.json'], entrypoint: 'be/owner.ts',
    projects: ['be/tsconfig.json'], tests: []};
  const doc = {schema: 'starci/code-example-catalog@1', title: 'Current references', purpose: 'Actual public inputs.', examples: [row]};
  const save = () => write(repo, EXAMPLE_CATALOG_FILE, stringifyYaml(doc));
  save();
  return {repo, row, doc, save};
};
const oldSkill = '# Prior installer-owned entry\n';
// Assembled because live source cannot retain a registered retired public path.
const retiredEntry = ['skills', 'define-goal', 'SKILL.md'].join('/');
const retiredProjection = '.agents/' + retiredEntry;
const oldManifest = {files: {[retiredEntry]: digest(oldSkill)}};

test('the manifest ships UI source while cache, secret and test-capture paths remain excluded', t => {
  const repo = fixture(t);
  const files = ['ui/server.mjs', 'ui/package.json', 'ui/package-lock.json', 'ui/src/icon.png',
    'ui/node_modules/local/private.mjs', 'ui/dist/app.js', 'ui/.secrets/token',
    'ui/.git-starci-status-backup/data', 'ui/agent-log-preview.png', 'ui/debug.log',
    SECRET_ENV_FILE, `${SECRET_ENV_FILE}.example`, `scripts/${SECRET_ENV_FILE}`,
    'ext/sonar/compose.yaml', 'ext/sonar/secrets/private.enc'];
  for (const file of files) write(repo, file, 'fixture bytes');
  assert.deepEqual(payloadFiles(repo), ['ext/sonar/compose.yaml', `${SECRET_ENV_FILE}.example`,
    'ui/package-lock.json', 'ui/package.json', 'ui/server.mjs', 'ui/src/icon.png']);
});

test('installed current examples reach the real current reference catalog and READ consumer', async t => {
  const repo = fixture(t), target = path.join(repo, '.claude');
  const installed = init({dir: repo, bootstrap: false, hosts: []}, () => {});
  const catalog = loadExampleCatalog(target);
  assert.equal(catalog.examples.length, 14);
  assert.deepEqual(catalog.examples.map(row => row.id), loadExampleCatalog(source).examples.map(row => row.id));
  assert.equal(discoverExampleApps(target).length, 3);
  assert.deepEqual(discoverExampleApps(target), discoverExampleApps(source));
  const required = [EXAMPLE_CATALOG_FILE, ...exampleSourcePaths(source),
    ...discoverExampleApps(source).map(app => `examples/${app}/hfs.json`)];
  for (const relative of new Set(required)) {
    const actual = fs.readFileSync(path.join(target, relative));
    assert.deepEqual(actual, fs.readFileSync(path.join(source, relative)), relative);
    assert.equal(installed.files[relative], digest(actual), relative);
  }
  assert.equal(selectedExampleFiles.length, 18, 'only BASIC13, three own Work catalog indexes and two declared system-health seeds');
  for (const relative of selectedExampleFiles) {
    const actual = fs.readFileSync(path.join(target, relative));
    assert.deepEqual(actual, fs.readFileSync(path.join(source, relative)), relative);
    assert.equal(installed.files[relative], installedPayloadDigest(actual, relative), relative);
    if (relative.startsWith('examples/.runtimes/')) assert.equal(installed.files[relative], sha256(actual), relative);
  }
  for (const app of discoverExampleApps(target)) assert.deepEqual(exampleArtifactReadOptions(target,
    path.join(target, 'examples', app, '.starciwork')), {root: path.join(target, 'examples/.runtimes', app, 'artifacts')});
  const read = await buildReadDigest({root: repo, touch: [], base: target});
  for (const relative of exampleSourcePaths(target)) {
    assert.ok(read.files.some(file => file.role === 'example' && file.path === relative
      && file.sha256 === sha256(fs.readFileSync(path.join(target, relative)))), relative);
  }
});

test('update admits newly required example closure from prior installer custody without losing local edits', t => {
  const repo = fixture(t), target = path.join(repo, '.claude');
  init({dir: repo, bootstrap: false, hosts: []}, () => {});
  const prior = JSON.parse(fs.readFileSync(path.join(target, '.starci-skills.json'), 'utf8'));
  const newlyRequired = [EXAMPLE_CATALOG_FILE, ...exampleSourcePaths(source).filter(relative => relative.endsWith('.json')),
    ...discoverExampleApps(source).map(app => `examples/${app}/hfs.json`), ...selectedExampleFiles];
  for (const relative of new Set(newlyRequired)) {
    fs.unlinkSync(path.join(target, relative));
    delete prior.files[relative];
  }
  write(repo, '.claude/.starci-skills.json', JSON.stringify(prior));
  const added = newlyRequired.find(relative => relative.endsWith('.json') && !relative.endsWith('/hfs.json'));
  const localJson = fs.readFileSync(path.join(source, added), 'utf8') + '\n';
  write(repo, `.claude/${added}`, localJson);
  const changed = exampleSourcePaths(source).find(relative => relative.endsWith('.ts'));
  const local = fs.readFileSync(path.join(target, changed), 'utf8') + '\n// local authored edit\n';
  write(repo, `.claude/${changed}`, local);
  const config = '# local owner preference\n' + fs.readFileSync(path.join(target, 'config.yaml'), 'utf8');
  write(repo, '.claude/config.yaml', config);
  const updated = update({dir: repo, bootstrap: false, hosts: []}, () => {});
  assert.equal(loadExampleCatalog(target).examples.length, 14);
  assert.equal(discoverExampleApps(target).length, 3);
  for (const relative of new Set(newlyRequired)) {
    const actual = fs.readFileSync(path.join(target, relative));
    assert.deepEqual(actual, relative === added ? Buffer.from(localJson) : fs.readFileSync(path.join(source, relative)), relative);
    assert.equal(updated.files[relative], installedPayloadDigest(actual, relative), relative);
  }
  assert.equal(fs.readFileSync(path.join(target, changed), 'utf8'), local);
  assert.ok(updated.keptLocal.includes(changed));
  assert.ok(updated.keptLocal.includes(added));
  assert.equal(fs.readFileSync(path.join(target, 'config.yaml'), 'utf8'), config);
});

test('forced update repairs damaged current example inputs while normal update refuses before copy', t => {
  const repo = fixture(t), target = path.join(repo, '.claude');
  init({dir: repo, bootstrap: false, hosts: []}, () => {});
  const compiler = exampleSourcePaths(source).find(relative => relative.endsWith('/tsconfig.json'));
  const changed = exampleSourcePaths(source).find(relative => relative.endsWith('.ts'));
  const local = fs.readFileSync(path.join(target, changed), 'utf8') + '\n// retained until force\n';
  const absent = path.join(target, EXAMPLE_CATALOG_FILE);
  fs.unlinkSync(absent);
  write(repo, `.claude/${compiler}`, '{ BROKEN');
  const declaration = `examples/${discoverExampleApps(source)[0]}/hfs.json`;
  write(repo, `.claude/${declaration}`, '{\"kind\":\"runtime\"}');
  write(repo, `.claude/${changed}`, local);
  assert.throws(() => update({dir: repo, bootstrap: false, hosts: []}, () => {}), Error);
  assert.equal(fs.existsSync(absent), false);
  assert.equal(fs.readFileSync(path.join(target, compiler), 'utf8'), '{ BROKEN');
  assert.equal(fs.readFileSync(path.join(target, changed), 'utf8'), local);
  const updated = update({dir: repo, bootstrap: false, hosts: [], force: true}, () => {});
  assert.equal(loadExampleCatalog(target).examples.length, 14);
  assert.deepEqual(fs.readFileSync(path.join(target, compiler)), fs.readFileSync(path.join(source, compiler)));
  assert.deepEqual(fs.readFileSync(path.join(target, declaration)), fs.readFileSync(path.join(source, declaration)));
  assert.equal(discoverExampleApps(target).length, 3);
  assert.deepEqual(fs.readFileSync(path.join(target, changed)), fs.readFileSync(path.join(source, changed)));
  assert.equal(Object.hasOwn(updated.files, EXAMPLE_CATALOG_FILE), true);
});

test('missing or foreign installer custody cannot select a target-inventory bypass', t => {
  const repo = fixture(t), target = path.join(repo, '.claude');
  init({dir: repo, bootstrap: false, hosts: []}, () => {});
  const file = path.join(target, '.starci-skills.json');
  const prior = fs.readFileSync(file, 'utf8'), doc = JSON.parse(prior);
  fs.unlinkSync(path.join(target, EXAMPLE_CATALOG_FILE));
  doc.name = 'foreign-owner';
  fs.writeFileSync(file, JSON.stringify(doc));
  assert.throws(() => update({dir: repo, bootstrap: false, hosts: [], force: true}, () => {}), /custody/);
  assert.equal(fs.existsSync(path.join(target, EXAMPLE_CATALOG_FILE)), false);
  fs.unlinkSync(file);
  assert.throws(() => update({dir: repo, bootstrap: false, hosts: [], force: true}, () => {}), /run starci runtime install first/);
  assert.equal(fs.existsSync(path.join(target, EXAMPLE_CATALOG_FILE)), false);
});

test('runtime payload refuses absent or malformed catalog, HFS declaration and compiler JSON before copy', t => {
  for (const [name, relative, body] of [
    ['missing catalog', EXAMPLE_CATALOG_FILE, null], ['malformed catalog', EXAMPLE_CATALOG_FILE, 'BROKEN: ['],
    ['missing HFS declaration', 'examples/current/hfs.json', null], ['foreign HFS declaration', 'examples/current/hfs.json', '{"kind":"runtime"}'],
    ['missing compiler JSON', 'examples/current/be/tsconfig.json', null], ['malformed compiler JSON', 'examples/current/be/tsconfig.json', '{ BROKEN'],
    ['malformed listed source JSON', 'examples/current/be/contracts.json', '{ BROKEN'],
  ]) {
    const fx = exampleFixture(t), file = path.join(fx.repo, relative);
    if (body === null) fs.unlinkSync(file); else fs.writeFileSync(file, body);
    assert.throws(() => payloadFiles(fx.repo), Error, name);
    if (body !== null) assert.equal(fs.readFileSync(file, 'utf8'), body, name);
  }
});

test('catalog membership never bypasses stack, vendor, secret-twin or unknown-type exclusions', t => {
  for (const relative of ['be/node_modules/vendor/input.json', 'be/.git/config.json', '.starcistacks/dev/runtime/input.json',
    '.starcistacks/dev/generated/input.json', '.starcistacks/dev/.runtime/input.json',
    '.starcistacks/dev/.scannerwork/input.json', '.starcistacks/dev/secrets.json',
    '.starcistacks/dev/automation.mjs', 'be/unknown.bin']) {
    const fx = exampleFixture(t);
    fx.row.projects.push(relative);
    write(fx.repo, `examples/current/${relative}`, '{}\n');
    if (relative.endsWith('/secrets.json')) write(fx.repo, `examples/current/${relative}.enc`, 'synthetic-ciphertext\n');
    fx.save();
    assert.throws(() => payloadFiles(fx.repo), Error, relative);
    assert.equal(fs.readFileSync(path.join(fx.repo, 'examples/current', relative), 'utf8'), '{}\n');
  }
});

test('unlisted JSON and .runtimes evidence do not gain payload admission from the catalog fix', t => {
  const fx = exampleFixture(t);
  const excluded = ['examples/current/unlisted.json', 'examples/.runtimes/current/runtime.sqlite',
    'examples/.runtimes/current/runtime.sqlite-wal', 'examples/.runtimes/current/runtime.sqlite-shm',
    'examples/.runtimes/current/artifacts/raw.json', 'examples/.runtimes/current/artifacts/trace.log'];
  for (const relative of excluded) write(fx.repo, relative, 'synthetic-reference-bytes');
  const files = new Set(payloadFiles(fx.repo));
  for (const relative of excluded) assert.equal(files.has(relative), false, relative);
  assert.ok(files.has('examples/current/be/contracts.json'));
  assert.ok(files.has('examples/current/be/tsconfig.json'));
  assert.ok(files.has(EXAMPLE_CATALOG_FILE));
});

test('payload admits only the declared basic sample bytes and public Work indexes', t => {
  const repo = fixture(t), bytes = Buffer.from([0x80, 0x0d, 0x0a]), changed = Buffer.from([0x81, 0x0d, 0x0a]);
  assert.equal(bytes.toString('utf8'), changed.toString('utf8'), 'synthetic binary regression collides under text decoding');
  for (const relative of selectedExampleFiles) write(repo, relative, bytes);
  const excluded = ['examples/.runtimes/ecommerce-app/runtime.sqlite-wal', 'examples/.runtimes/ecommerce-app/runtime.sqlite-shm',
    'examples/.runtimes/ecommerce-app/runtime.sqlite-journal', 'examples/.runtimes/foreign/runtime.sqlite',
    'examples/.runtimes/ecommerce-app/artifacts/ff/' + 'f'.repeat(64),
    'examples/.runtimes/ecommerce-app/artifacts/ff/' + 'f'.repeat(64) + '.json',
    'examples/.runtimes/ecommerce-app/logs/trace.yaml', 'examples/ecommerce-app/.starciwork/private.yaml',
    'examples/ecommerce-app/.starciwork/features/private/index.yaml'];
  for (const relative of excluded) write(repo, relative, 'public synthetic exclusion fixture');
  const files = payloadFiles(repo);
  assert.deepEqual(files, [...selectedExampleFiles].sort());
  const first = hashTree(repo), relative = selectedExampleFiles.find(file => file.endsWith('/runtime.sqlite'));
  for (const file of files) assert.equal(first[file], file.startsWith('examples/.runtimes/') ? sha256(bytes)
    : installedPayloadDigest(bytes), file);
  assert.equal(payloadHash(path.join(repo, relative), relative), sha256(bytes));
  write(repo, relative, changed);
  assert.equal(hashTree(repo)[relative], sha256(changed));
  assert.notEqual(hashTree(repo)[relative], first[relative], 'different raw binary bytes cannot keep installer custody');
  assert.equal(installedPayloadDigest(Buffer.from('a\r\nb'), 'docs/fixture.md'), sha256('a\nb'), 'ordinary text semantics remain');
});

test('literal sample paths refuse redirected ancestors before inventories or a fresh forced init can copy', t => {
  const repo = fixture(t), target = path.join(repo, '.claude'), outside = fixture(t);
  const relative = selectedExampleFiles.find(file => file.endsWith('/runtime.sqlite'));
  const directory = path.dirname(path.join(target, relative));
  fs.mkdirSync(path.dirname(directory), {recursive: true});
  write(outside, 'runtime.sqlite', Buffer.from([0x80]));
  fs.symlinkSync(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
  const prior = {name: sourcePackage.name, version: sourcePackage.version, files: {'package.json': '0'.repeat(64)}};
  assert.throws(() => payloadFiles(target), /linked|regular/);
  assert.throws(() => hashTree(target, prior, true), /linked|regular/);
  assert.equal(fs.existsSync(path.join(target, '.starci-skills.json')), false, 'fresh target has no prior custody');
  assert.throws(() => init({dir: repo, bootstrap: false, hosts: [], force: true}, () => {}), /linked|regular/);
  assert.deepEqual(fs.readdirSync(outside), ['runtime.sqlite'], 'no copied DB/CAS/sidecar reaches the redirect target');
  assert.deepEqual(fs.readFileSync(path.join(outside, 'runtime.sqlite')), Buffer.from([0x80]));
  assert.equal(fs.existsSync(path.join(target, 'package.json')), false, 'target refusal precedes payload copying');
});

test('linked catalog inputs refuse instead of acquiring installer custody', t => {
  const fx = exampleFixture(t), outside = fixture(t), directory = path.join(fx.repo, 'examples/current/be');
  for (const name of ['owner.ts', 'contracts.json', 'tsconfig.json']) {
    write(outside, name, fs.readFileSync(path.join(directory, name)));
    fs.unlinkSync(path.join(directory, name));
  }
  fs.rmdirSync(directory);
  fs.symlinkSync(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => { if (fs.lstatSync(directory, {throwIfNoEntry: false})?.isSymbolicLink()) fs.unlinkSync(directory); });
  assert.throws(() => payloadFiles(fx.repo), /linked|contained|regular/);
  assert.deepEqual(fs.readdirSync(outside).sort(), ['contracts.json', 'owner.ts', 'tsconfig.json']);
});

test('install and forced update preserve local credentials and excluded prior custody', t => {
  const repo = fixture(t), target = path.join(repo, '.claude'), logs = [];
  write(repo, '.gitignore', '# Owner ignores\ncustom.ignore\n');
  const installed = init({dir: repo, bootstrap: true, hosts: []}, line => logs.push(line));
  const secret = path.join(target, SECRET_ENV_FILE), example = `${SECRET_ENV_FILE}.example`;
  assert.equal(fs.existsSync(secret), false, 'installation ships placeholders without creating credentials');
  assert.deepEqual(fs.readFileSync(path.join(target, example)), fs.readFileSync(path.join(source, example)));
  assert.equal(Object.hasOwn(installed.files, SECRET_ENV_FILE), false);
  for (const [file, expected] of [[path.join(repo, '.gitignore'), `.claude/${SECRET_ENV_FILE}`],
    [path.join(target, '.gitignore'), `/${SECRET_ENV_FILE}`]]) {
    assert.ok(fs.readFileSync(file, 'utf8').split(/\r?\n/).includes(expected));
  }
  assert.ok(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8').includes('custom.ignore'));
  assert.ok(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8').split(/\r?\n/).map(line => line.trim()).includes('.claude/.runtime/'), 'the host state directory is ignored by the app repository');
  const local = 'synthetic-local-credential\n', custody = 'synthetic-administrative-custody\n';
  write(repo, `.claude/${SECRET_ENV_FILE}`, local);
  const config = '# Owner keeps these preferences\n' + fs.readFileSync(path.join(target, 'config.yaml'), 'utf8');
  write(repo, '.claude/config.yaml', config);
  write(repo, '.claude/ext/sonar/secrets/private.enc', custody);
  const prior = JSON.parse(fs.readFileSync(path.join(target, '.starci-skills.json'), 'utf8'));
  prior.files[SECRET_ENV_FILE] = digest(local);
  prior.files['config.yaml'] = digest(config);
  prior.files['ext/sonar/secrets/private.enc'] = digest(custody);
  write(repo, '.claude/.starci-skills.json', JSON.stringify(prior));
  const updated = update({dir: repo, bootstrap: true, hosts: [], force: true}, line => logs.push(line));
  for (const [relative, expected] of [[SECRET_ENV_FILE, local], ['config.yaml', config], ['ext/sonar/secrets/private.enc', custody]]) {
    assert.equal(fs.readFileSync(path.join(target, relative), 'utf8'), expected);
    assert.ok(updated.preservedStale.includes(relative));
    assert.equal(Object.hasOwn(updated.files, relative), false);
  }
  const outside = fixture(t), excluded = path.join(target, 'ext/sonar/secrets');
  write(outside, 'private.enc', custody);
  fs.unlinkSync(path.join(excluded, 'private.enc'));
  fs.rmdirSync(excluded);
  fs.symlinkSync(outside, excluded, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    const claimed = JSON.parse(fs.readFileSync(path.join(target, '.starci-skills.json'), 'utf8'));
    claimed.files['ext/sonar/secrets/private.enc'] = digest(custody);
    write(repo, '.claude/.starci-skills.json', JSON.stringify(claimed));
    const linked = update({dir: repo, bootstrap: true, hosts: [], force: true}, line => logs.push(line));
    assert.equal(fs.lstatSync(excluded).isSymbolicLink(), true);
    assert.ok(linked.preservedStale.includes('ext/sonar/secrets/private.enc'));
    assert.deepEqual(fs.readdirSync(outside), ['private.enc']);
    assert.equal(fs.readFileSync(path.join(outside, 'private.enc'), 'utf8'), custody);
  } finally {
    if (fs.lstatSync(excluded, {throwIfNoEntry: false})?.isSymbolicLink()) fs.unlinkSync(excluded);
  }
  assert.equal(logs.some(line => line.includes(local.trim()) || line.includes(custody.trim())), false);
});

test('fresh shared and Devin discovery copies match payload bytes and explicit-selection policies', t => {
  const repo = fixture(t);
  fs.mkdirSync(path.join(repo, '.devin/skills'), {recursive: true});
  const custody = applyEntrySkillsPlan(entrySkillsPlan(repo), () => {});
  assert.equal(custody.hashMode, 'sha256-bytes');
  assert.ok(Object.keys(custody.files).length > 0);
  for (const [relative, expected] of Object.entries(custody.files)) {
    const sourceRelative = relative.replace(/^\.(agents|devin)\/skills\//, 'skills/');
    const actual = fs.readFileSync(path.join(repo, relative));
    assert.deepEqual(actual, fs.readFileSync(path.join(source, sourceRelative)), relative);
    assert.equal(sha256(actual), expected);
  }
  for (const root of ['.agents/skills', '.devin/skills']) {
    assert.deepEqual(fs.readdirSync(path.join(repo, root)), ['starci']);
    const front = fs.readFileSync(path.join(repo, root, 'starci/SKILL.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
    const metadata = parseYaml(front);
    assert.equal(metadata['disable-model-invocation'], true);
    assert.deepEqual(metadata.triggers, ['user']);
    const policy = parseYaml(fs.readFileSync(path.join(repo, root, 'starci/agents/openai.yaml'), 'utf8'));
    assert.equal(policy.policy.allow_implicit_invocation, false);
  }
});

test('exact old copies retire while unrelated discovery entries remain', t => {
  const repo = fixture(t);
  write(repo, retiredProjection, oldSkill);
  write(repo, '.agents/skills/unrelated/SKILL.md', '# Unrelated user tool\n');
  const plan = entrySkillsPlan(repo, oldManifest);
  assert.deepEqual(plan.remove.map(item => item.relative), [retiredProjection]);
  applyEntrySkillsPlan(plan, () => {});
  assert.equal(fs.existsSync(path.join(repo, '.agents/skills/define-goal')), false);
  assert.equal(fs.readFileSync(path.join(repo, '.agents/skills/unrelated/SKILL.md'), 'utf8'), '# Unrelated user tool\n');
});

test('keptLocal retired copies remain even when their recorded hash or new internal body matches', t => {
  const internalBody = fs.readFileSync(path.join(source, 'skills/starci/references/define-goal.md'));
  for (const body of ['# Owner-kept prior entry\n', internalBody]) {
    const repo = fixture(t);
    write(repo, retiredProjection, body);
    const manifest = {files: {[retiredEntry]: digest(body)}, keptLocal: [retiredEntry]};
    const plan = entrySkillsPlan(repo, manifest);
    assert.deepEqual(plan.remove, []);
    assert.ok(plan.preserved.some(item => item.path === '.agents/skills/define-goal' && item.reason.includes('keptLocal')));
    applyEntrySkillsPlan(plan, () => {});
    assert.deepEqual(fs.readFileSync(path.join(repo, retiredProjection)), Buffer.from(body));
  }
});

test('keptLocal current entries are held even when bytes match new payload or prior custody hashes', t => {
  const currentPath = '.agents/skills/starci/SKILL.md';
  const runtimePath = 'skills/starci/SKILL.md';
  const canonical = fs.readFileSync(path.join(source, runtimePath));
  for (const body of ['# Owner-kept current entry\n', canonical]) {
    const repo = fixture(t);
    write(repo, currentPath, body);
    const manifest = {files: {[runtimePath]: digest(body)}, keptLocal: [runtimePath],
      hostSkills: {hashMode: 'sha256-bytes', files: {[currentPath]: sha256(Buffer.from(body))}}};
    const plan = entrySkillsPlan(repo, manifest);
    assert.deepEqual(plan.write, []);
    assert.deepEqual(plan.files, {}, 'owner-kept files are not adopted into new installer custody');
    assert.ok(plan.preserved.some(item => item.path === '.agents/skills/starci' && item.reason.includes('keptLocal')));
    applyEntrySkillsPlan(plan, () => {});
    assert.deepEqual(fs.readFileSync(path.join(repo, currentPath)), Buffer.from(body));
    assert.equal(fs.existsSync(path.join(repo, '.agents/skills/starci/agents')), false);
  }
});

test('modified or extra old entry files preserve the whole unproven directory', t => {
  for (const extra of [false, true]) {
    const repo = fixture(t), body = extra ? oldSkill : '# Owner changed this entry\n';
    write(repo, retiredProjection, body);
    if (extra) write(repo, '.agents/skills/define-goal/private.md', 'owner data');
    const plan = entrySkillsPlan(repo, oldManifest);
    assert.deepEqual(plan.remove, []);
    assert.equal(plan.preserved[0].path, '.agents/skills/define-goal');
    applyEntrySkillsPlan(plan, () => {});
    assert.equal(fs.readFileSync(path.join(repo, retiredProjection), 'utf8'), body);
    if (extra) assert.equal(fs.readFileSync(path.join(repo, '.agents/skills/define-goal/private.md'), 'utf8'), 'owner data');
  }
});

test('new entry modifications cannot be overwritten by old recorded hashes', t => {
  const repo = fixture(t), previous = '# Earlier canonical starci\n', actual = '# Owner-edited starci\n';
  write(repo, '.agents/skills/starci/SKILL.md', actual);
  const plan = entrySkillsPlan(repo, {files: {'skills/starci/SKILL.md': digest(previous)}});
  assert.deepEqual(plan.write, []);
  assert.equal(plan.preserved[0].path, '.agents/skills/starci');
  applyEntrySkillsPlan(plan, () => {});
  assert.equal(fs.readFileSync(path.join(repo, '.agents/skills/starci/SKILL.md'), 'utf8'), actual);
});

test('known prior host custody permits update and records the new hashes', t => {
  const repo = fixture(t), previous = '# Earlier canonical starci\n';
  write(repo, '.agents/skills/starci/SKILL.md', previous);
  const plan = entrySkillsPlan(repo, {hostSkills: {files: {'.agents/skills/starci/SKILL.md': digest(previous)}}});
  const custody = applyEntrySkillsPlan(plan, () => {});
  const expected = fs.readFileSync(path.join(source, 'skills/starci/SKILL.md'));
  assert.deepEqual(fs.readFileSync(path.join(repo, '.agents/skills/starci/SKILL.md')), expected);
  assert.equal(custody.files['.agents/skills/starci/SKILL.md'], digest(expected));
});

test('a cleanup file changed after planning refuses before removal or discovery writes', t => {
  const repo = fixture(t), file = write(repo, retiredProjection, oldSkill);
  const plan = entrySkillsPlan(repo, oldManifest);
  fs.writeFileSync(file, '# Changed after inspection\n');
  assert.throws(() => applyEntrySkillsPlan(plan, () => {}), /changed after cleanup planning/);
  assert.equal(fs.readFileSync(file, 'utf8'), '# Changed after inspection\n');
  assert.equal(fs.existsSync(path.join(repo, '.agents/skills/starci')), false);
});

test('a destination appearing after planning refuses instead of overwriting it', t => {
  const repo = fixture(t), plan = entrySkillsPlan(repo), first = plan.write[0];
  write(repo, first.relative, 'late owner file');
  assert.throws(() => applyEntrySkillsPlan(plan, () => {}), /changed after copy planning/);
  assert.equal(fs.readFileSync(path.join(repo, first.relative), 'utf8'), 'late owner file');
});

test('a junction or symlink discovery root is not followed or assigned installer custody', t => {
  const repo = fixture(t), outside = fixture(t);
  write(outside, 'sentinel', 'external owner');
  fs.mkdirSync(path.join(repo, '.agents'));
  fs.symlinkSync(outside, path.join(repo, '.agents/skills'), process.platform === 'win32' ? 'junction' : 'dir');
  const plan = entrySkillsPlan(repo, oldManifest);
  assert.equal(plan.skipped[0].dir, '.agents/skills');
  assert.deepEqual(plan.write, []);
  assert.deepEqual(plan.remove, []);
  applyEntrySkillsPlan(plan, () => {});
  assert.deepEqual(fs.readdirSync(outside), ['sentinel']);
  assert.equal(fs.readFileSync(path.join(outside, 'sentinel'), 'utf8'), 'external owner');
});

test('bootstrap preview replaces only the exact prior block and preserves custom host instructions', t => {
  const repo = fixture(t);
  const old = '# Prior bootstrap\n<!-- starci:prompt-entry -->\nPrior owned runtime entry.\n<!-- /starci:prompt-entry -->\n';
  write(repo, '.claude/init/AGENTS.md', old);
  const original = '# Host instructions\n\n' + old + '\nKeep this custom instruction.\n';
  write(repo, 'AGENTS.md', original);
  const plan = bootstrapPlan(repo, {hosts: []}, {files: {'init/AGENTS.md': digest(old)}});
  assert.equal(plan[0].action, 'updated');
  assert.ok(plan[0].text.includes('# Host instructions'));
  assert.ok(plan[0].text.includes('Keep this custom instruction.'));
  const canonical = fs.readFileSync(path.join(source, 'init/AGENTS.md'), 'utf8').match(/<!-- starci:prompt-entry -->[\s\S]*?<!-- \/starci:prompt-entry -->/)[0];
  assert.ok(plan[0].text.includes(canonical));
  assert.equal(fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), original, 'planning has no effects');
});

test('an edited or unknown bootstrap block refuses without modifying host text', t => {
  const repo = fixture(t);
  const old = '<!-- starci:prompt-entry -->\nPrior owned runtime entry.\n<!-- /starci:prompt-entry -->\n';
  write(repo, '.claude/init/AGENTS.md', old);
  const current = old.replace('Prior owned', 'Owner modified');
  write(repo, 'AGENTS.md', current);
  assert.throws(() => bootstrapPlan(repo, {hosts: []}, {files: {'init/AGENTS.md': digest(old)}}), /did not write/);
  assert.equal(fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8'), current);
});

const initialAgeFixture = t => {
  const repo = fixture(t), target = path.join(repo, '.claude'), calls = [], captures = [], logs = [], errors = [];
  const key = 'AGE-SECRET-KEY-1FIXTUREONLY', recipient = 'age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
  const image = Buffer.alloc(80);
  if (process.platform === 'win32') { image.write('MZ'); image.writeUInt32LE(64, 60); image.write('PE\0\0', 64); }
  else if (process.platform === 'linux') image.set([0x7f, 0x45, 0x4c, 0x46]);
  else image.writeUInt32BE(0xfeedfacf);
  const executable = write(repo, 'age-keygen.fixture', image);
  let owner = null, released = 0;
  const locks = {
    acquire: options => {
      assert.equal(options.ttlMs, null);
      owner = { token: 'fixture-token', pid: process.pid, host: os.hostname(), stale: false, ttlMs: null };
      return { ok: true, token: owner.token, owner };
    },
    owner: () => owner,
    release: ({ token }) => { assert.equal(token, owner?.token); owner = null; released++; return { ok: true, released: true }; },
  };
  const runProgram = (file, args, options) => {
    assert.equal(file, executable);
    assert.equal(options.shell, false);
    assert.equal(options.encoding, 'buffer');
    assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.ok(Number.isInteger(options.timeout) && options.timeout > 0);
    assert.ok(Number.isInteger(options.maxBuffer) && options.maxBuffer > 0);
    assert.equal(Object.hasOwn(options.env, 'SOPS_AGE_KEY'), false);
    assert.equal(args.some(arg => String(arg).includes(key)), false);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, '.starci-skills.json'), 'utf8'));
    assert.equal(manifest.initialAgeSetup.state, 'attempted', 'reservation precedes every AGE call');
    calls.push([...args]);
    let stdout;
    if (args[0] === '--version') stdout = Buffer.from('v1.2.1\n');
    else if (args[0] === '-y') { assert.equal(options.input.toString('utf8'), key); stdout = Buffer.from(recipient + '\n'); }
    else { assert.deepEqual(args, []); stdout = Buffer.from(`# created: fixture\n# public key: ${recipient}\n${key}\n`); }
    const result = { status: 0, signal: null, error: null, stdout, stderr: Buffer.from('private fixture diagnostic') };
    captures.push(result);
    return result;
  };
  const deps = { env: {}, log: line => logs.push(line), error: line => errors.push(line),
    runNpm: () => ({ status: 0, stdout: '', stderr: '', signal: null, error: null }),
    initialAge: { locks, resolveRealTool: () => executable, runProgram } };
  const invoke = (force = false) => main(['init', '--dir', repo, '--no-bootstrap', ...(force ? ['--force'] : [])], deps);
  const outcome = () => JSON.parse(logs.filter(line => line.startsWith('initial age setup: ')).at(-1).slice('initial age setup: '.length));
  return { repo, target, calls, captures, logs, errors, key, recipient, locks, deps, invoke, outcome,
    releaseCount: () => released, loseLease: () => { owner = null; } };
};

test('real init intent reserves before one captured generation and publishes only its derived identity', t => {
  const fx = initialAgeFixture(t);
  assert.equal(fx.invoke(), 0);
  assert.deepEqual(fx.calls, [['--version'], [], ['-y']]);
  assert.equal(fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE), 'utf8'), `SOPS_AGE_KEY=${fx.key}\n`);
  const marker = JSON.parse(fs.readFileSync(path.join(fx.target, '.starci-skills.json'), 'utf8')).initialAgeSetup;
  assert.deepEqual(marker, { schema: 'starci/initial-age-setup@1', state: 'complete', producer: 'runtime-install-init',
    attempt: 'reserved', publication: 'complete', capture: 'generated', release: {state: 'released', ok: true, released: true, leftover: null}, publicRecipient: fx.recipient });
  assert.equal(fx.outcome().outcome, 'created');
  assert.deepEqual(fx.outcome().release, { ok: true, released: true, leftover: null });
  assert.equal(fx.releaseCount(), 1);
  for (const capture of fx.captures) for (const bytes of [capture.stdout, capture.stderr]) assert.ok(bytes.every(byte => byte === 0));
  assert.equal([...fx.logs, ...fx.errors].join('\n').includes(fx.key), false);
  assert.equal([...fx.logs, ...fx.errors].join('\n').includes('private fixture diagnostic'), false);
});

test('another original init reuses the completed identity and projection updates retain attempt custody', t => {
  const fx = initialAgeFixture(t);
  assert.equal(fx.invoke(), 0);
  const before = fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE)), marker = JSON.parse(fs.readFileSync(path.join(fx.target, '.starci-skills.json'))).initialAgeSetup;
  assert.equal(fx.invoke(), 0);
  assert.equal(fx.calls.filter(args => args.length === 0).length, 1);
  assert.equal(fx.outcome().outcome, 'reused');
  assert.deepEqual(fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE)), before);
  update({ dir: fx.repo, bootstrap: false, force: true }, () => {});
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(fx.target, '.starci-skills.json'))).initialAgeSetup, marker);
});

test('eligible original init keeps unrelated credential bytes as the exact append prefix', t => {
  const fx = initialAgeFixture(t), prefix = Buffer.from('SONAR_TOKEN=synthetic-unrelated\r\nOTHER=fixture');
  write(fx.repo, `.claude/${SECRET_ENV_FILE}`, prefix);
  assert.equal(fx.invoke(true), 0);
  assert.deepEqual(fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE)), Buffer.concat([prefix, Buffer.from(`\nSOPS_AGE_KEY=${fx.key}\n`)]));
  assert.equal(fx.calls.filter(args => args.length === 0).length, 1);
  assert.equal(fx.logs.join('\n').includes('synthetic-unrelated'), false);
});

test('supplied original inline and explicit FILE identities are reused without generation or publication', t => {
  for (const mode of ['inline', 'file']) {
    const fx = initialAgeFixture(t), original = write(fx.repo, 'original.identity', 'fixture-original-key\n');
    fx.deps.env = mode === 'inline' ? { SOPS_AGE_KEY: 'fixture-original-inline' } : { SOPS_AGE_KEY_FILE: original };
    assert.equal(fx.invoke(), 0);
    assert.deepEqual(fx.calls, []);
    assert.equal(fx.outcome().outcome, 'reused');
    assert.equal(fs.existsSync(path.join(fx.target, SECRET_ENV_FILE)), false);
    assert.equal(fs.readFileSync(original, 'utf8'), 'fixture-original-key\n');
    assert.equal(fx.logs.join('\n').includes('fixture-original-inline'), false);
    assert.equal(fx.logs.join('\n').includes(original), false);
  }
});

test('explicit blank, duplicate assignments and original CMD or recipient custody refuse before projection', t => {
  for (const mode of ['blank', 'duplicate', 'cmd', 'recipient']) {
    const fx = initialAgeFixture(t);
    const original = mode === 'duplicate' ? 'SOPS_AGE_KEY=fixture-one\nSOPS_AGE_KEY=fixture-two\n' : 'OTHER=fixture\n';
    write(fx.repo, `.claude/${SECRET_ENV_FILE}`, original);
    if (mode === 'blank') fx.deps.env = { SOPS_AGE_KEY: '' };
    if (mode === 'cmd') fx.deps.env = { SOPS_AGE_KEY_CMD: 'must-never-run' };
    if (mode === 'recipient') fx.deps.env = { SOPS_AGE_RECIPIENTS: 'unknown-original-recipient' };
    assert.equal(fx.invoke(true), 1);
    assert.deepEqual(fx.calls, []);
    assert.equal(fs.existsSync(path.join(fx.target, '.starci-skills.json')), false);
    assert.equal(fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE), 'utf8'), original);
    assert.equal(fx.outcome().outcome, 'held');
  }
});

test('unrecognized encrypted custody and a foreign nonempty target hold without creating setup evidence', t => {
  for (const mode of ['ciphertext', 'foreign', 'forced-foreign', 'forced-root-age', 'forced-root-key']) {
    const fx = initialAgeFixture(t), file = mode === 'ciphertext'
      ? write(fx.repo, '.claude/ext/sonar/secrets/unknown.enc', 'opaque-synthetic-custody')
      : write(fx.repo, mode === 'forced-root-age' ? '.claude/original.age'
        : mode === 'forced-root-key' ? '.claude/identity.key' : '.claude/unowned.txt', 'foreign source');
    const before = fs.readFileSync(file);
    assert.equal(fx.invoke(mode === 'ciphertext' || mode.startsWith('forced-')), 1);
    assert.deepEqual(fx.calls, []);
    assert.equal(fs.existsSync(path.join(fx.target, '.starci-skills.json')), false);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.equal(fx.outcome().reason, mode === 'ciphertext' ? 'old-ciphertext' : 'foreign-target');
  }
});

test('attempted, unknown, malformed and absent installed custody never become a new generation request', t => {
  for (const state of ['attempted', 'unknown', 'malformed', 'absent', 'complete-missing']) {
    const fx = initialAgeFixture(t);
    init({ dir: fx.repo, bootstrap: false }, () => {});
    const file = path.join(fx.target, '.starci-skills.json'), manifest = JSON.parse(fs.readFileSync(file));
    if (state !== 'absent') manifest.initialAgeSetup = state === 'malformed' ? { state: 'complete' }
      : { schema: 'starci/initial-age-setup@1', state: state === 'complete-missing' ? 'complete' : state };
    fs.writeFileSync(file, JSON.stringify(manifest));
    const before = fs.readFileSync(file);
    assert.equal(fx.invoke(), 1);
    assert.deepEqual(fx.calls, []);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.equal(fs.existsSync(path.join(fx.target, SECRET_ENV_FILE)), false);
  }
});

test('partial publication keeps private bytes and an attempted marker, so retry cannot generate again', t => {
  const fx = initialAgeFixture(t);
  let writes = 0;
  fx.deps.initialAge.publish = request => publishSecret(request, { fs: { ...fs, writeSync: (fd, bytes, offset, length, position) => {
    if (++writes === 1) return fs.writeSync(fd, bytes, offset, 3, position);
    throw new Error('private publication exception');
  } } });
  assert.equal(fx.invoke(), 1);
  const partial = fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE));
  assert.equal(partial.toString('utf8'), 'SOP');
  assert.equal(fx.outcome().publication, 'unknown');
  assert.equal(JSON.parse(fs.readFileSync(path.join(fx.target, '.starci-skills.json'))).initialAgeSetup.state, 'held');
  assert.equal(fx.invoke(), 1);
  assert.equal(fx.calls.filter(args => args.length === 0).length, 1);
  assert.deepEqual(fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE)), partial);
  assert.equal([...fx.logs, ...fx.errors].join('\n').includes('private publication exception'), false);
});

test('numeric process failure, signal, truncation, invalid recipient and private exceptions cannot publish or retry', t => {
  for (const fault of ['status', 'signal', 'overflow', 'recipient', 'throw']) {
    const fx = initialAgeFixture(t), run = fx.deps.initialAge.runProgram;
    fx.deps.initialAge.runProgram = (file, args, options) => {
      const result = run(file, args, options);
      if (args.length === 0 && fault === 'status') result.status = 1;
      if (args.length === 0 && fault === 'signal') { result.status = null; result.signal = 'SIGTERM'; }
      if (args.length === 0 && fault === 'overflow') { result.stdout.fill(0); result.stdout = Buffer.alloc(options.maxBuffer + 1); }
      if (args[0] === '-y' && fault === 'recipient') { result.stdout.fill(0); result.stdout = Buffer.from('unverified-recipient\n'); }
      if (args.length === 0 && fault === 'throw') { result.stdout.fill(0); result.stderr.fill(0); throw new Error(fx.key); }
      return result;
    };
    assert.equal(fx.invoke(), 1);
    assert.equal(fs.existsSync(path.join(fx.target, SECRET_ENV_FILE)), false);
    assert.equal(fx.invoke(), 1);
    assert.equal(fx.calls.filter(args => args.length === 0).length, 1);
    assert.equal([...fx.logs, ...fx.errors].join('\n').includes(fx.key), false);
    for (const capture of fx.captures) for (const bytes of [capture.stdout, capture.stderr]) assert.ok(bytes.every(byte => byte === 0));
  }
});

test('real lock refusal never takes over, and actual refused, unknown or leftover release remains held', t => {
  for (const fault of ['held', 'lost', 'refused-release', 'unknown-release', 'leftover']) {
    const fx = initialAgeFixture(t), release = fx.locks.release, run = fx.deps.initialAge.runProgram;
    if (fault === 'held') fx.locks.acquire = () => ({ ok: false, reason: 'held' });
    if (fault === 'lost') fx.deps.initialAge.runProgram = (file, args, options) => {
      const result = run(file, args, options); if (args.length === 0) fx.loseLease(); return result;
    };
    if (fault === 'refused-release' || fault === 'lost') fx.locks.release = () => ({ ok: false, reason: 'not-owner', owner: {} });
    if (fault === 'unknown-release') fx.locks.release = () => { throw new Error('private release diagnostic'); };
    if (fault === 'leftover') fx.locks.release = input => ({ ...release(input), leftover: 'fixture-leftover-aside' });
    assert.equal(fx.invoke(), 1);
    if (fault === 'held') { assert.deepEqual(fx.calls, []); assert.equal(fs.existsSync(fx.target), false); }
    else assert.equal(fx.outcome().releaseCustody, 'held');
    if (fault === 'leftover') assert.equal(fx.outcome().release.leftover, 'fixture-leftover-aside');
    if (fault === 'refused-release') assert.equal(fx.outcome().release.reason, 'not-owner');
    if (fault === 'unknown-release') assert.equal(fx.outcome().release.reason, 'release-unknown');
    assert.equal([...fx.logs, ...fx.errors].join('\n').includes('private release diagnostic'), false);
  }
  const fx = initialAgeFixture(t), lock = path.join(fx.repo, 'existing-host-lock'), original = 'untouched stale fixture owner';
  fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner'), original);
  fx.deps.initialAge.locks = {};
  fx.deps.env = { STARCI_HOST_LOCK_DIR: lock };
  assert.equal(fx.invoke(), 1);
  assert.deepEqual(fx.calls, []);
  assert.equal(fs.readFileSync(path.join(lock, 'owner'), 'utf8'), original);
  assert.equal(fs.readdirSync(fx.repo).some(name => name.startsWith('existing-host-lock.aside-')), false);
});


test('publication stays release-pending until actual release, and two invocations cannot erase unresolved release custody', t => {
  for (const fault of ['leftover', 'unknown', 'not-released', 'missing-released']) {
    const fx = initialAgeFixture(t), release = fx.locks.release;
    fx.locks.release = request => {
      const pending = JSON.parse(fs.readFileSync(path.join(fx.target, '.starci-skills.json'))).initialAgeSetup;
      assert.equal(pending.state, 'published');
      assert.equal(pending.publication, 'complete');
      assert.deepEqual(pending.release, {state: 'pending'});
      if (fault === 'unknown') throw new Error('private unresolved release');
      const actual = release(request);
      if (fault === 'leftover') return {...actual, leftover: 'fixture-unresolved-aside'};
      if (fault === 'missing-released') return {ok: true};
      return {ok: true, released: false};
    };
    assert.equal(fx.invoke(), 1);
    const original = fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE));
    const markerFile = path.join(fx.target, '.starci-skills.json'), marker = JSON.parse(fs.readFileSync(markerFile)).initialAgeSetup;
    assert.equal(marker.state, 'held');
    assert.equal(marker.publication, 'complete');
    assert.equal(marker.release.state, 'held');
    assert.equal(fx.outcome().releaseCustody, 'held');
    if (fault === 'unknown') assert.equal(marker.release.reason, 'release-unknown');
    if (fault === 'leftover') assert.equal(marker.release.leftover, 'fixture-unresolved-aside');
    if (fault === 'not-released' || fault === 'missing-released') assert.equal(marker.release.released, false);
    const before = fs.readFileSync(markerFile);
    fx.locks.release = release;
    assert.equal(fx.invoke(), 1);
    assert.equal(fx.outcome().reason, 'prior-attempt');
    assert.equal(fx.calls.filter(args => args.length === 0).length, 1);
    assert.deepEqual(fs.readFileSync(path.join(fx.target, SECRET_ENV_FILE)), original);
    assert.deepEqual(fs.readFileSync(markerFile), before);
    assert.equal(fx.logs.join('\n').includes('private unresolved release'), false);
  }
});

test('a foreign owner after release prevents public finalization and the pending marker still blocks a second init', t => {
  const fx = initialAgeFixture(t), owner = fx.locks.owner, release = fx.locks.release;
  let foreign = false;
  fx.locks.owner = () => foreign ? {token: 'foreign-token', pid: process.pid, host: os.hostname(), stale: false, ttlMs: null} : owner();
  fx.locks.release = request => { const result = release(request); foreign = true; return result; };
  assert.equal(fx.invoke(), 1);
  const file = path.join(fx.target, '.starci-skills.json'), before = fs.readFileSync(file);
  const marker = JSON.parse(before).initialAgeSetup;
  assert.equal(marker.state, 'published');
  assert.deepEqual(marker.release, {state: 'pending'});
  assert.equal(fx.outcome().finalization, 'unknown');
  foreign = false; fx.locks.release = release;
  assert.equal(fx.invoke(), 1);
  assert.equal(fx.outcome().reason, 'prior-attempt');
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fx.calls.filter(args => args.length === 0).length, 1);
});

test('actual target-directory replacement during projection or captured setup refuses the new incarnation and never republishes', t => {
  for (const phase of ['projection', 'setup']) {
    const fx = initialAgeFixture(t), aside = path.join(fx.repo, 'original-runtime-incarnation');
    const replace = () => { fs.renameSync(fx.target, aside); fs.mkdirSync(fx.target); };
    fs.mkdirSync(fx.target);
    if (phase === 'projection') fx.deps.runNpm = () => { replace(); return {status: 0, signal: null, error: null, stdout: '', stderr: ''}; };
    else {
      const run = fx.deps.initialAge.runProgram;
      fx.deps.initialAge.runProgram = (file, args, options) => { const result = run(file, args, options); if (args.length === 0) replace(); return result; };
    }
    assert.equal(fx.invoke(), 1);
    assert.equal(fs.existsSync(path.join(fx.target, SECRET_ENV_FILE)), false);
    assert.equal(fs.existsSync(path.join(aside, SECRET_ENV_FILE)), false);
    assert.equal(fx.calls.filter(args => args.length === 0).length, phase === 'setup' ? 1 : 0);
    if (phase === 'projection') assert.equal(fx.outcome().reason, 'canonical-target');
    else {
      assert.equal(JSON.parse(fs.readFileSync(path.join(aside, '.starci-skills.json'))).initialAgeSetup.state, 'attempted');
      assert.equal(fx.outcome().finalization, 'unknown');
    }
    const captures = fx.calls.length;
    assert.equal(fx.invoke(), 1);
    assert.equal(fx.outcome().reason, 'prior-install', 'original public install entry custody is not a missing-marker fresh request');
    assert.equal(fx.calls.length, captures);
    assert.equal(fx.logs.join('\n').includes(fx.key), false);
    for (const capture of fx.captures) for (const bytes of [capture.stdout, capture.stderr]) assert.ok(bytes.every(byte => byte === 0));
  }
});

test('an unclassified setup failure carries its cause as detail, prints it, and never prints key material', t => {
  const fx = initialAgeFixture(t);
  fx.locks.acquire = () => { throw Object.assign(new Error(`unclassified fixture failure near ${fx.key}`), { code: 'EFIXTURE' }); };
  assert.equal(fx.invoke(), 1);
  const outcome = fx.outcome();
  assert.equal(outcome.reason, 'setup-unknown');
  assert.match(outcome.detail, /^EFIXTURE: unclassified fixture failure near /);
  assert.ok(fx.errors.some(line => line.includes('initial age setup failed (setup-unknown): EFIXTURE: unclassified fixture failure')));
  assert.equal([...fx.logs, ...fx.errors].join('\n').includes(fx.key), false);
});
