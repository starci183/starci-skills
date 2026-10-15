// R272: compile the actual Nest AppModule in a child, with explicit infrastructure doubles.
// Dynamic roots need public fixture options: src/tests/fixtures/builders/<app>.builder.ts may export
// buildWiringProof(AppModule) => { options, overrides: [{ token, value }], request? }. The runner always chooses
// the real root; a fixture cannot substitute an empty module. No environment parser or main.ts runs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath } from 'node:url';
import { invocationDir } from '../lib/roots.mjs';
import { isMain } from '../lib/is-main.mjs';
import { readJson } from './rules/read.mjs';

export const BOOT_PROOF_CODE = 'BE_APP_BOOT_PROOF_MISSING';
const WORKER = fileURLToPath(import.meta.url);
const DEFAULT_TIMEOUT = 15000;
const DI_FAILURES = new Map([
  ['UnknownDependenciesException', 'unresolved DI provider'],
  ['CircularDependencyException', 'circular DI dependency'],
  ['UndefinedModuleException', 'undefined or circular module import'],
  ['WiringTimeout', 'DI compilation timed out'],
]);
const COMPILATION_FAILURE = 'module or proof could not be compiled';
const WORKER_FAILURE = 'proof worker failed or timed out';
const SAFE_REASONS = new Set([...DI_FAILURES.values(), COMPILATION_FAILURE]);
const modulePath = app => `apps/${app}/src/app.module.ts`;
export const wiringFixturePath = app => `src/tests/fixtures/builders/${app}.builder.ts`;

const refusal = (file, reason) => ({ code: BOOT_PROOF_CODE, level: 'error', path: file,
  message: `${file}: lite boot proof failed (${reason}); compile the real AppModule with explicit fixture options and infrastructure doubles using starci app check --wiring`, reason });

/** Stable diagnostics never forward exception text, source values or child output. */
function failureReason(error) {
  // Nest exceptions inherit Error.name; their constructor identifies the refusal.
  return DI_FAILURES.get(error?.constructor?.name) ?? DI_FAILURES.get(error?.name) ?? COMPILATION_FAILURE;
}

/** Nest bootstrap defers request/transient trees: prove them in their original module's scope too. */
async function compileGraph(builder, Nest, request) {
  const compiled = await builder.compile();
  const { ContextIdFactory, ModuleRef } = Nest;
  const contextId = ContextIdFactory.create();
  compiled.registerRequestByContextId(request, contextId);
  const resolutions = [];
  // Read the actual compiled container, not an application provider claiming to be ModulesContainer.
  for (const module of compiled.container.getModules().values()) {
    // Native REQUEST/INQUIRER factories belong to Nest itself; their empty result is intentional.
    if (module === compiled.container.getInternalCoreModuleRef()) continue;
    const moduleRef = module.providers.get(ModuleRef)?.instance;
    for (const wrappers of [module.providers, module.controllers, module.injectables]) {
      for (const wrapper of wrappers.values()) {
        if (wrapper.isTransient || !wrapper.isDependencyTreeStatic()) {
          resolutions.push(() => moduleRef.resolve(wrapper.token, contextId, { strict: true }));
        }
      }
    }
  }
  await Promise.all(resolutions.map(resolve => resolve()));
}

/** Compile a real root, with overrides of existing tokens only; never auto-mock an unresolved dependency. */
async function compileAppModule({ AppModule, options, overrides = [], request = {}, Test, Nest, timeout = DEFAULT_TIMEOUT }) {
  if (typeof AppModule !== 'function') throw new Error('the actual AppModule is missing');
  if (typeof AppModule.register === 'function' && options === undefined) throw new Error('dynamic AppModule needs fixture options');
  const root = typeof AppModule.register === 'function' ? await AppModule.register(options) : AppModule;
  if (root?.module && root.module !== AppModule) throw new Error('registration must return the actual AppModule');
  const builder = Test.createTestingModule({ imports: [root] });
  for (const override of overrides) {
    if (!override || !Object.hasOwn(override, 'token') || !Object.hasOwn(override, 'value')) throw new Error('an infrastructure double needs a token and value');
    builder.overrideProvider(override.token).useValue(override.value);
  }
  let deadline;
  const expired = new Promise((_, reject) => { deadline = setTimeout(() => {
    const error = new Error('compilation deadline'); error.name = 'WiringTimeout'; reject(error);
  }, timeout); });
  try {
    // compile proves DI. Neither init nor close runs: both invoke application lifecycle hooks.
    // The isolated worker exits naturally once every infrastructure resource has a double.
    await Promise.race([compileGraph(builder, Nest, request), expired]);
  } finally { clearTimeout(deadline); }
}

/** The strict in-memory TS loader uses this app's installed compiler and Nest, including inherited aliases. */
function sourceLoader(repoRoot, entry, fixture) {
  const require = createRequire(path.join(repoRoot, 'package.json'));
  const ts = require('typescript');
  const config = ts.getParsedCommandLineOfConfigFile(path.join(repoRoot, 'tsconfig.json'), {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => { throw new Error('invalid TypeScript project'); } });
  if (!config || config.errors.length) throw new Error('invalid TypeScript project');
  const options = { ...config.options, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
    experimentalDecorators: true, emitDecoratorMetadata: true, noEmit: false, noEmitOnError: false,
    declaration: false, declarationMap: false, sourceMap: false, inlineSourceMap: false,
    incremental: false, composite: false, tsBuildInfoFile: undefined, outDir: undefined, rootDir: undefined };
  const program = ts.createProgram({ rootNames: [entry, ...(fixture ? [fixture] : [])], options });
  if (program.getSyntacticDiagnostics().length) throw new Error('invalid TypeScript source');
  const outputs = new Map();
  program.emit(undefined, (file, text, _bom, _error, sources) => {
    if (file.endsWith('.js')) for (const source of sources ?? []) outputs.set(path.resolve(source.fileName), text);
  });
  const NodeModule = require('node:module');
  const resolve = NodeModule._resolveFilename;
  NodeModule._resolveFilename = function resolveSource(request, parent, ...rest) {
    if (parent?.filename && (request.startsWith('.') || Object.keys(options.paths ?? {}).some(alias => request.startsWith(alias.replace(/\*$/, ''))))) {
      const resolved = ts.resolveModuleName(request, parent.filename, options, ts.sys).resolvedModule;
      if (resolved && !resolved.isExternalLibraryImport && !resolved.resolvedFileName.endsWith('.d.ts')) return resolved.resolvedFileName;
    }
    return resolve.call(this, request, parent, ...rest);
  };
  require.extensions['.ts'] = (loaded, file) => {
    const output = outputs.get(path.resolve(file));
    if (output === undefined) throw new Error('source is outside the compiled graph');
    loaded._compile(output, file);
  };
  require('reflect-metadata');
  return require;
}

async function wiringWorker({ repoRoot, app, fixture, timeout }) {
  // Disable network entry points before loading application source. A forgotten resource double is a refusal.
  const systemRequire = createRequire(import.meta.url);
  for (const [packageName, methods] of [['node:net', ['connect', 'createConnection']], ['node:tls', ['connect']],
    ['node:http', ['request', 'get']], ['node:https', ['request', 'get']]]) {
    const api = systemRequire(packageName);
    for (const method of methods) api[method] = () => { throw new Error('wiring needs an infrastructure double'); };
  }
  systemRequire('node:net').Socket.prototype.connect = () => { throw new Error('wiring needs an infrastructure double'); };
  systemRequire('node:net').Server.prototype.listen = () => { throw new Error('wiring needs an infrastructure double'); };
  globalThis.fetch = () => { throw new Error('wiring needs an infrastructure double'); };
  const entry = path.join(repoRoot, modulePath(app));
  const fixtureFile = fixture ? path.join(repoRoot, fixture) : null;
  const require = sourceLoader(repoRoot, entry, fixtureFile);
  const { AppModule } = require(entry);
  const proof = fixtureFile ? await require(fixtureFile).buildWiringProof(AppModule) : {};
  if (!proof || typeof proof !== 'object') throw new Error('invalid wiring fixture');
  await compileAppModule({ AppModule, options: proof.options, overrides: proof.overrides, request: proof.request,
    Test: require('@nestjs/testing').Test, Nest: require('@nestjs/core'), timeout });
}

function wiringApps(repo, files, prefix) {
  const declared = (repo.sides?.be?.apps ?? repo.apps ?? []).map(app => app.name);
  const observed = (files ?? []).flatMap(file => {
    const match = file.match(new RegExp(String.raw`^${prefix}apps/([^/]+)/src/app\.module\.ts$`));
    return match ? [match[1]] : [];
  });
  return [...new Set([...declared, ...observed])];
}

function appWiringFinding({ repoRoot, beRoot, prefix, app, files, fixtures, timeout, run }) {
  const file = `${prefix}${modulePath(app)}`;
  if (!/^[a-z][a-z0-9-]*$/.test(app) || !fs.existsSync(path.join(repoRoot, file)) || (files && !files.includes(file))) {
    return refusal(file, 'app module is missing');
  }
  const fixture = fixtures[app] ?? wiringFixturePath(app);
  const fixtureExists = fs.existsSync(path.join(beRoot, fixture)) && (!files || files.includes(`${prefix}${fixture}`));
  const args = [WORKER, '--worker', JSON.stringify({ repoRoot: beRoot, app, fixture: fixtureExists ? fixture : null, timeout })];
  const options = { cwd: beRoot, encoding: 'utf8', env: {}, windowsHide: true, timeout: timeout + 2000, maxBuffer: 1024 * 1024 };
  const result = run ? run(process.execPath, args, options) : runNode(args, options);
  let proof;
  try { proof = JSON.parse(result.stdout ?? ''); } catch { /* Output from app source cannot serve as a proof. */ }
  if (result.status !== 0 || proof?.ok !== true) return refusal(file, SAFE_REASONS.has(proof?.reason) ? proof.reason : WORKER_FAILURE);
  return null;
}

/** Synchronous check seam for the dispatcher and content finder. Paths in findings are relative to repoRoot. */
export function appWiring({ repoRoot, repo = readJson(repoRoot, 'hfs.json'), files, fixtures = {}, timeout = DEFAULT_TIMEOUT, run } = {}) {
  if (repo?.edition !== 'lite' || repo?.profile === 'fe' || repo?.kind === 'fe') return { ok: true, status: 'skipped', findings: [], apps: [] };
  const appRoot = Boolean(repo.sides);
  const beRoot = appRoot ? path.join(repoRoot, 'be') : repoRoot;
  const prefix = appRoot ? 'be/' : '';
  const apps = wiringApps(repo, files, prefix);
  const findings = [];
  for (const app of apps) {
    const finding = appWiringFinding({ repoRoot, beRoot, prefix, app, files, fixtures, timeout, run });
    if (finding) findings.push(finding);
  }
  return { ok: findings.length === 0, status: 'checked', apps, findings };
}

/** Optional standalone entry; coordinator connects the same seam to app check --wiring. */
export function appWiringMain(argv, { cwd = invocationDir(), stdout = text => process.stdout.write(text), stderr = text => process.stderr.write(text) } = {}) {
  let directory = cwd, json = false;
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] === '--cwd' && argv[at + 1]) directory = path.resolve(cwd, argv[++at]);
    else if (argv[at] === '--json') json = true;
    else if (argv[at] !== '--wiring') { stderr('usage: starci app check --wiring [--cwd <dir>] [--json]\n'); return 2; }
  }
  const repo = readJson(directory, 'hfs.json');
  if (!repo) { stderr('wiring needs a readable hfs.json\n'); return 2; }
  const result = appWiring({ repoRoot: directory, repo });
  const trailingNewline = result.findings.length ? '\n' : '';
  const report = `${result.status}: ${result.apps.length} app(s), ${result.findings.length} boot proof failure(s)\n${result.findings.map(f => f.message).join('\n')}${trailingNewline}`;
  stdout(json ? `${JSON.stringify(result)}\n` : report);
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  if (process.argv[2] === '--worker') {
    try { await wiringWorker(JSON.parse(process.argv[3])); process.stdout.write(JSON.stringify({ ok: true })); }
    catch (error) { process.stdout.write(JSON.stringify({ ok: false, reason: failureReason(error) })); }
  } else process.exitCode = appWiringMain(process.argv.slice(2));
}
