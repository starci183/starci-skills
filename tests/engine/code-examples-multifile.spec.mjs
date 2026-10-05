import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { loadExampleCatalog, exampleSourcePaths } from '../../scripts/lib/example-refs.mjs';
import { runNode } from '../../scripts/api/node/run-node.mjs';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { installInto, uninstall, runtimeInstalls, missingFrom, LINT_DEPENDENCIES, STARCI_PACKAGES } from '../helpers/hfs-app-install.mjs';

const runtime = path.resolve(import.meta.dirname, '../..');
const stableIds = ['api', 'connected-block', 'domain', 'event-bus', 'fenced-job', 'named-exception', 'projection', 'queue', 'realtime', 'saga', 'webhooks'];
const write = (root, relative, bytes) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return file;
};
const key = (file, caseSensitive = false) => {
  const resolved = path.resolve(file).replaceAll('\\', '/');
  return caseSensitive ? resolved : resolved.toLowerCase();
};

function catalogFixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-example-refs-')));
  const links = [];
  t.after(() => {
    for (const link of links) if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  write(root, 'modules/schemas/code-example-catalog.schema.yaml', fs.readFileSync(path.join(runtime, 'modules/schemas/code-example-catalog.schema.yaml')));
  write(root, 'examples/current/hfs.json', JSON.stringify({ kind: 'app' }));
  write(root, 'examples/current/be/owner.ts', 'export const owner = 1;\n');
  write(root, 'examples/current/be/owner.spec.ts', 'export const expected = 1;\n');
  write(root, 'examples/current/be/tsconfig.json', JSON.stringify({ include: ['*.ts'] }));
  const example = { id: 'current', path: 'current', lane: 'backend', title: 'Current owner', summary: 'The real owner and its program.',
    relatedRules: ['BE-DOMAIN-1'], files: ['be/owner.ts'], entrypoint: 'be/owner.ts', projects: ['be/tsconfig.json'], tests: ['be/owner.spec.ts'] };
  const doc = { schema: 'starci/code-example-catalog@1', title: 'Current references', purpose: 'Actual source pointers.', examples: [example] };
  const save = () => write(root, 'examples/index.yaml', stringifyYaml(doc));
  save();
  return { root, doc, example, save, links };
}

test('one current-source catalog resolves all eleven stable references without a duplicate connected block', () => {
  const catalog = loadExampleCatalog(runtime);
  assert.deepEqual(catalog.examples.map(row => row.id).sort(), stableIds);
  const connected = catalog.examples.find(row => row.id === 'connected-block');
  assert.equal(connected.path, 'shape-slot');
  assert.ok(connected.files.includes('fe/apps/shape-slot/src/components/blocks/HandoffBlock/index.tsx'));
  assert.ok(connected.files.includes('fe/apps/shape-slot/src/components/blocks/HandoffBlock/component.tsx'));
  assert.deepEqual(connected.tests, [], 'this actual app has no declared behavior/browser test; metadata cannot imply that coverage');
  const project = connected.projects[0], config = JSON.parse(fs.readFileSync(path.join(runtime, 'examples', connected.path, project), 'utf8'));
  assert.equal(connected.projects.length, 1, 'the child owns the compiler program; inherited configs are READ inputs');
  assert.equal(typeof config.extends, 'string');
  const inherited = path.posix.normalize(path.posix.join(path.posix.dirname(project), config.extends));
  assert.equal(connected.files.filter(file => file === inherited).length, 1, 'the actual inherited config has one explicit source-input membership');
  assert.equal(connected.projects.includes(inherited), false, 'an inherited config cannot silently become a standalone program');
  assert.ok(Object.hasOwn(config.compilerOptions?.paths ?? {}, '@/*'), 'the actual owning child retains its alias context');
  const selected = exampleSourcePaths(runtime, ['connected-block']), inheritedReference = ['examples', connected.path, inherited].join('/');
  assert.equal(selected.filter(file => file === inheritedReference).length, 1, 'selected READ includes the parent exactly once');
  for (const row of catalog.examples) {
    assert.ok(row.files.length >= 2, row.id);
    assert.ok(row.files.includes(row.entrypoint), row.id);
    assert.ok(row.projects.length > 0, row.id);
    for (const relative of [...row.files, ...row.projects, ...row.tests]) {
      const file = path.join(runtime, 'examples', row.path, relative);
      assert.equal(fs.lstatSync(file).isFile(), true, file);
      assert.equal(key(fs.realpathSync.native(file)), key(file), file);
    }
  }
  const fenced = catalog.examples.find(row => row.id === 'fenced-job');
  assert.deepEqual(new Set(exampleSourcePaths(runtime, ['fenced-job'])), new Set([...fenced.files, ...fenced.projects, ...fenced.tests].map(file => `examples/${fenced.path}/${file}`)), 'READ receives every listed source, program and test pointer rather than samples');
  assert.throws(() => exampleSourcePaths(runtime, ['unknown-current-pattern']), /unknown example id/);
});

test('duplicate identity refuses before any missing pointer lookup can mask it', t => {
  const fx = catalogFixture(t);
  fx.doc.examples.push({ ...fx.example, path: 'missing-app' });
  fx.save();
  assert.throws(() => loadExampleCatalog(fx.root), /duplicate example id: current/);
});

test('catalog metadata is closed and missing, escaped, unlisted or derived source pointers refuse', t => {
  const changes = [
    [row => { row.verified = true; }],
    [row => { row.files = []; }],
    [row => { row.projects = []; }],
    [row => { row.files.push(row.files[0]); }, {message: 'duplicate example files: current'}],
    [row => { row.projects.push(row.projects[0]); }, {message: 'duplicate example projects: current'}],
    [row => { row.files = ['../escape.ts']; row.entrypoint = '../escape.ts'; }],
    [row => { row.files = ['be/missing.ts']; row.entrypoint = 'be/missing.ts'; }],
    [row => { row.entrypoint = 'be/unlisted.ts'; }],
    [row => { row.tests = ['be/missing.spec.ts']; }],
    [row => { row.projects = ['be/missing-tsconfig.json']; }],
  ];
  for (const [mutate, expected = /invalid example|entrypoint|reference|ENOENT/] of changes) {
    const fx = catalogFixture(t);
    mutate(fx.example); fx.save();
    assert.throws(() => loadExampleCatalog(fx.root), expected, JSON.stringify(fx.example));
  }
  const fx = catalogFixture(t);
  write(fx.root, 'examples/current/dist/owner.ts', 'export const owner = 1;\n');
  fx.example.files = ['dist/owner.ts']; fx.example.entrypoint = 'dist/owner.ts'; fx.save();
  assert.throws(() => loadExampleCatalog(fx.root), /authored|derived|reference/);
});

test('a linked source inside an otherwise real app cannot become a catalog reference', t => {
  const fx = catalogFixture(t), target = path.join(fx.root, 'physical'), link = path.join(fx.root, 'examples/current/be/linked');
  write(target, 'owner.ts', 'export const owner = 1;\n');
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  fx.links.push(link);
  fx.example.files = ['be/linked/owner.ts']; fx.example.entrypoint = 'be/linked/owner.ts'; fx.save();
  assert.throws(() => loadExampleCatalog(fx.root), /contained regular|linked|reference/);
});

test('an app-root link cannot hide outside source behind a regular leaf file', t => {
  const fx = catalogFixture(t), app = path.join(fx.root, 'examples/current'), physical = path.join(fx.root, 'physical-app');
  fs.renameSync(app, physical);
  fs.symlinkSync(physical, app, process.platform === 'win32' ? 'junction' : 'dir');
  fx.links.push(app);
  assert.throws(() => loadExampleCatalog(fx.root), /contained regular|linked|reference/);
});

test('a case-only sibling app cannot pass a folded real-path comparison', t => {
  const fx = catalogFixture(t), app = path.join(fx.root, 'examples/current');
  if (fs.existsSync(path.join(fx.root, 'examples/CURRENT'))) {
    t.diagnostic('This filesystem aliases app names by case; the separate case-only sibling scenario is not applicable. Ordinary prefix and source-link refusal are exercised separately.');
    return;
  }
  const physical = path.join(fx.root, 'examples/Current');
  fs.renameSync(app, physical);
  fs.symlinkSync(physical, app, process.platform === 'win32' ? 'junction' : 'dir');
  fx.links.push(app);
  assert.throws(() => loadExampleCatalog(fx.root), /contained regular|linked|reference/);
});

test('each knowledge relatedExamples identity resolves to current app source', () => {
  const known = new Set(loadExampleCatalog(runtime).examples.map(row => row.id)), dangling = [];
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(path.join(directory, entry.name)) : entry.name.endsWith('.yaml') ? [path.join(directory, entry.name)] : []);
  const visit = (node, file) => {
    if (Array.isArray(node)) { node.forEach(value => visit(value, file)); return; }
    if (!node || typeof node !== 'object') return;
    for (const [name, value] of Object.entries(node)) {
      if (name === 'relatedExamples') {
        assert.ok(Array.isArray(value), file);
        for (const id of value) if (typeof id !== 'string' || (!id.includes('/') && !known.has(id))) dangling.push(`${file}: ${String(id)}`);
      } else visit(value, file);
    }
  };
  for (const file of walk(path.join(runtime, 'knowledge'))) visit(parseYaml(fs.readFileSync(file, 'utf8')), path.relative(runtime, file));
  assert.deepEqual(dangling, []);
});

// Copy only authored app bytes. The existing fixture owner supplies checkout-owned dependencies and copies the current kits;
// compiler programs keep their real owning config and declared dependency versions; the installed framework generates its own types.
function installedApp(t, name, projects) {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reference-app-')), source = path.join(runtime, 'examples', name);
  let links = [];
  t.after(() => uninstall(app, links));
  fs.cpSync(source, app, { recursive: true, filter: file => !path.relative(source, file).split(path.sep)
    .some(part => ['node_modules', '.git', 'dist', '.next', 'coverage', '__generated__'].includes(part)) });
  const manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  const testWorldName = '@starci/test-world';
  const testWorldFields = ['dependencies', 'devDependencies'].filter(field => Object.hasOwn(manifest[field] ?? {}, testWorldName));
  if (testWorldFields.length) {
    const producer = path.join(runtime, 'packages/test-world');
    const pkg = JSON.parse(fs.readFileSync(path.join(producer, 'package.json'), 'utf8'));
    const pin = parseYaml(fs.readFileSync(path.join(runtime, 'knowledge/hfs/canon-pins.yaml'), 'utf8')).pins[testWorldName];
    assert.equal(pkg.name, testWorldName);
    assert.equal(pkg.version, pin.version, 'the private current test-world producer must have the canonical version');
    assert.equal(fs.lstatSync(path.join(producer, pkg.types)).isFile(), true, 'the current test-world owner build is required');
    for (const field of testWorldFields) manifest[field][testWorldName] = pkg.version;
    write(app, 'package.json', JSON.stringify(manifest, null, 2)+'\n');
    // The current package's genuine build supplies both JS and declarations; borrowed published installs may predate its API.
    fs.cpSync(producer, path.join(app, 'node_modules', ...testWorldName.split('/')), { recursive: true,
      filter: file => !path.relative(producer, file).split(path.sep).some(part => ['node_modules', 'fixtures'].includes(part))
        && !/\.test\.mjs$/.test(file) });
  }
  const required = [...new Set([...LINT_DEPENDENCIES, ...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})])]
    .filter(name => !Object.hasOwn(STARCI_PACKAGES, name) && name !== testWorldName);
  const referenceInstall = path.join(source, 'node_modules');
  assert.equal(fs.lstatSync(referenceInstall).isDirectory(), true, `the declared app install is required for ${name}`);
  const installs = runtimeInstalls({ required, env: { ...process.env, STARCI_APP_INSTALLS: referenceInstall } });
  assert.deepEqual(missingFrom(installs, required), [], `actual current app install is required for ${name}; install its declared packages before qualification`);
  links = installInto(app, installs);
  const generated = runNode([path.join(app, 'scripts/codegen.mjs')], { cwd: app, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  assert.equal(generated.error ?? null, null); assert.equal(generated.signal ?? null, null);
  const require = createRequire(path.join(app, 'package.json'));
  assert.equal(require('typescript/package.json').version, manifest.devDependencies.typescript, 'the compiler is the app-declared installed version');
  for (const project of projects) {
    const directory = path.dirname(path.join(app, project)), packageFile = path.join(directory, 'package.json');
    if (!fs.existsSync(packageFile)) continue;
    const workspace = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    if (!workspace.dependencies?.next) continue;
    assert.equal(require('next/package.json').version, workspace.dependencies.next, 'Next is the owning app-declared installed version');
    const config = path.join(app, project), before = fs.readFileSync(config);
    // Keep the private CLI child alive through asynchronous framework setup; only Next's own completion
    // may finish this process. The outer timeout bounds fixture custody when framework setup cannot finish.
    const lifetime = write(app, '.starci-next-typegen-lifetime.cjs', 'setInterval(() => {}, 1000);\n');
    const types = runNode(['--require', lifetime, require.resolve('next/dist/bin/next'), 'typegen', directory], { cwd: directory,
      env: { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1' }, timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(types.status, 0, types.stderr || types.stdout);
    assert.equal(types.error ?? null, null); assert.equal(types.signal ?? null, null);
    assert.match(types.stdout, /Types generated successfully/, `the public Next CLI must finish its real typegen action: ${types.stderr || types.stdout}`);
    for (const generatedFile of ['.next/types/routes.d.ts', '.next/types/validator.ts']) {
      assert.equal(fs.lstatSync(path.join(directory, generatedFile)).isFile(), true, `Next must own ${generatedFile}`);
    }
    assert.deepEqual(fs.readFileSync(config), before, 'framework type preparation preserves the owning compiler configuration');
    assert.equal(fs.lstatSync(path.join(directory, 'next-env.d.ts')).isFile(), true, 'the real Next owner must produce its framework declarations');
  }
  for (const args of [['init', '-q'], ['add', '-A']]) {
    const baseline = runGit(args, { cwd: app, timeout: 30_000,
      config: { 'core.hooksPath': path.join(app, '.git', 'no-hooks'), 'core.fsmonitor': 'false', 'core.autocrlf': 'false' } });
    assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);
    assert.equal(baseline.error ?? null, null); assert.equal(baseline.signal ?? null, null);
  }
  return { app, require };
}

function compileProject(ts, app, project) {
  const config = path.join(app, project), loaded = ts.readConfigFile(config, ts.sys.readFile);
  assert.equal(loaded.error, undefined, `${project}: ${loaded.error && ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n')}`);
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, path.dirname(config), undefined, config);
  assert.deepEqual(parsed.errors, [], project);
  assert.ok(parsed.fileNames.length > 0, `${project} must own real source files`);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true, incremental: false });
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => ({
    file: diagnostic.file?.fileName ?? null, code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
  return { sources: new Set(program.getSourceFiles().map(source => key(source.fileName, ts.sys.useCaseSensitiveFileNames))), diagnostics };
}
const showDiagnostics = (diagnostics, app) => diagnostics.map(diagnostic => `${diagnostic.file ? path.relative(app, diagnostic.file) : '<program>'}: TS${diagnostic.code} ${diagnostic.message}`).join('\n');

async function currentCanon(fx, side) {
  const { ESLint } = fx.require('eslint');
  const pkg = `@starci/eslint-canon-${side}`, file = fx.require.resolve(pkg), kit = await import(pathToFileURL(file).href);
  assert.equal(key(file), key(path.join(fx.app, 'node_modules', pkg, 'index.mjs')), 'factory is the copied current source kit, not a historical linked install');
  const cwd = path.join(fx.app, side), hfs = kit.loadHfs(pathToFileURL(path.join(cwd, 'eslint.config.mjs')).href);
  const factory = side === 'be' ? kit.starciBeConfig : kit.starciFeConfig;
  const config = await factory({ hfs });
  assert.ok(Array.isArray(config) && config.length > 0);
  assert.ok(config.some(block => Object.keys(block.rules ?? {}).some(rule => rule.startsWith(`starci-${side}/`))), 'the full canon factory must load its rules');
  return new ESLint({ cwd, overrideConfigFile: true, overrideConfig: config });
}

test('actual catalog programs resolve current module APIs and complete current canon factories measure every listed TS source', async t => {
  const catalog = loadExampleCatalog(runtime);
  for (const name of [...new Set(catalog.examples.map(row => row.path))]) {
    const phase = label => t.diagnostic(`${name}: ${label}; memory=${JSON.stringify(process.memoryUsage())}`);
    phase('install authored app and private Git index');
    const rows = catalog.examples.filter(row => row.path === name);
    const fx = installedApp(t, name, [...new Set(rows.flatMap(row => row.projects))]), ts = fx.require('typescript');
    const sourcesByProject = new Map([...new Set(rows.flatMap(row => row.projects))].map(project => {
      phase(`compile ${project}`);
      const measured = compileProject(ts, fx.app, project);
      assert.deepEqual(measured.diagnostics, [], showDiagnostics(measured.diagnostics, fx.app));
      return [project, measured.sources];
    }));
    const targets = [...new Set(rows.flatMap(row => [...row.files, ...row.tests]).filter(file => /\.tsx?$/.test(file)))];
    for (const row of rows) {
      const rowTargets = [...new Set([...row.files, ...row.tests].filter(file => /\.tsx?$/.test(file)))];
      for (const file of rowTargets) assert.ok(row.projects.some(project => sourcesByProject.get(project).has(key(path.join(fx.app, file), ts.sys.useCaseSensitiveFileNames))),
        `${row.id}: ${name}/${file} must be included by that reference's declared owning programs`);
    }
    const first = rows[0], target = path.join(fx.app, first.entrypoint), original = fs.readFileSync(target, 'utf8');
    if (first.lane === 'frontend') {
      const inherited = first.files.find(file => file.endsWith('/tsconfig.json'));
      assert.ok(inherited && !first.projects.includes(inherited), 'inherited JSON is an input, not a separate compiler program');
      const inheritedFile = path.join(fx.app, inherited), inheritedBytes = fs.readFileSync(inheritedFile);
      try {
        fs.unlinkSync(inheritedFile);
        assert.throws(() => compileProject(ts, fx.app, first.projects[0]), /tsconfig\.json/, 'the real owning child refuses a missing inherited compiler input');
        fs.writeFileSync(inheritedFile, '{ BROKEN');
        assert.throws(() => compileProject(ts, fx.app, first.projects[0]), /tsconfig\.json/, 'the real owning child refuses malformed inherited JSON');
      } finally { fs.writeFileSync(inheritedFile, inheritedBytes); }
    }
    const missing = 'MissingCurrentCatalogSymbol';
    phase('reject unavailable module export');
    try {
      fs.writeFileSync(target, `import { ${missing} } from ${JSON.stringify(first.lane === 'backend' ? '@nestjs/common' : '@starci/grammar/common')};\n`+original);
      const rejected = compileProject(ts, fx.app, first.projects[0]);
      assert.ok(rejected.diagnostics.some(diagnostic => diagnostic.code === 2305 && diagnostic.file && key(diagnostic.file) === key(target)
        && diagnostic.message.includes(missing)), 'an unavailable real module export cannot pass current compiler acceptance');
    } finally { fs.writeFileSync(target, original); }
    for (const side of [...new Set(targets.map(file => file.split('/')[0]))]) {
      phase(`load complete ${side} canon factory`);
      const eslint = await currentCanon(fx, side);
      phase(`lint every listed ${side} source`);
      const files = targets.filter(file => file.startsWith(side+'/')).map(file => path.join(fx.app, file)), results = await eslint.lintFiles(files);
      assert.equal(results.length, files.length, `${name}/${side}: no ignored or omitted listed source`);
      assert.deepEqual(results.flatMap(result => result.messages.map(message => `${path.relative(fx.app, result.filePath)}: ${message.ruleId ?? 'fatal'} ${message.message}`)), [], `${name}/${side}: current complete canon refuses every finding, including load or parser failures`);
      if (side === 'be' && first.lane === 'backend') {
        phase('reject environment-owner violation');
        try {
          fs.appendFileSync(target, '\nexport const catalogEnvironmentLeak = process.env.CATALOG_SECRET;\n');
          const rejected = await eslint.lintFiles([target]);
          assert.ok(rejected.flatMap(result => result.messages).some(message => message.ruleId === 'starci-be/no-direct-env-read'), 'the actual complete factory keeps the current environment-owner law active');
        } finally { fs.writeFileSync(target, original); }
      }
    }
  }
});
