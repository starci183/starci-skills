// starci app new service | spec - the one way a `*.service.ts` and its unit spec come into being.
//
// Unit test standard (owner-locked): only `*.service.ts` files are unit-tested, each with exactly one colocated
// `<name>.service.spec.ts`, built with `Test.createTestingModule({ providers }).compile()` and `moduleRef.get(Service)`,
// with the providers equal to the constructor dependencies and every double taken from `@starci/jest-preset`. This module
// writes that spec: it reads the service constructor with the repository's own TypeScript compiler API and PRE-FILLS one
// provider per dependency, so the author starts from a spec that already compiles, provides exactly what the service asks
// for and has one placeholder `it` per public method.
//
// The token of an `Inject<Name>()` decorator is `<NAME>` (UPPER_SNAKE of the name), exported from the module the decorator is
// imported from (the capability decorators file, through its index) - the convention the `injection-token-exported` law keeps.
// The double of a token comes from `ruleParams.be.specDoubles` of the slot manifest, the same table the lint law
// `spec-infra-double-from-kit` holds a spec to, so the skeleton satisfies the law by construction.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { explainPath } from '../runtime/scripts/hfs/check.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';

export class ScaffoldError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ScaffoldError';
    this.code = code;
  }
}

const KIT = '@starci/jest-preset';
const CLOCK_START = '2026-01-01T00:00:00.000Z';
const PRINT_WIDTH = 120;
const INDENT = '    ';

// ------------------------------------------------------------------------------------------------ names

const words = name => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[\s_-]+/).filter(Boolean);
/** `member-profile` -> `MemberProfile`. */
export const pascalOf = name => words(name).map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join('');
/** `InjectPrimaryEntityManager` -> `PRIMARY_ENTITY_MANAGER`. */
const tokenNameOf = decorator => words(decorator.replace(/^Inject/, '')).map(word => word.toUpperCase()).join('_');
const camelOf = name => { const pascal = pascalOf(name); return pascal[0].toLowerCase() + pascal.slice(1); };

const SERVICE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

// ------------------------------------------------------------------------------------------------ reading a service

/**
 * The shape of the service class of `text`: { className, dependencies, methods }.
 *   dependencies: in constructor order, either { kind: 'token', name, decorator, token, module, type } for an `@Inject*()` custom
 *   decorator (or `@Inject(TOKEN)`), or { kind: 'class', name, className, module } for a class-typed parameter.
 *   `type` is { text, imports: [{ name, module }] }, the parameter type and where each imported name of it comes from.
 */
function readServiceShape({ ts, fileName, text }) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imported = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) imported.set(element.name.text, { module: statement.moduleSpecifier.text, imported: (element.propertyName ?? element.name).text });
  }
  const base = path.basename(fileName).replace(/\.service\.ts$/, '');
  const classes = source.statements.filter(statement => ts.isClassDeclaration(statement) && statement.name && (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) !== 0 && statement.name.text.endsWith('Service'));
  const node = classes.find(candidate => candidate.name.text === `${pascalOf(base)}Service`) ?? classes[0];
  if (!node) throw new ScaffoldError('HFS_NEW_NO_SERVICE_CLASS', `${fileName} exports no class named *Service`);

  const typeOf = annotation => {
    const names = new Set();
    const visit = child => { if (ts.isIdentifier(child) && imported.has(child.text)) names.add(child.text); ts.forEachChild(child, visit); };
    visit(annotation);
    return { text: annotation.getText(source), imports: [...names].map(name => ({ name, module: imported.get(name).module })) };
  };

  const dependencies = [];
  const constructor = node.members.find(member => ts.isConstructorDeclaration(member));
  for (const parameter of constructor?.parameters ?? []) {
    if (!ts.isIdentifier(parameter.name) || !parameter.type) throw new ScaffoldError('HFS_NEW_UNTYPED_PARAMETER', `${fileName}: every constructor parameter needs a name and a type annotation`);
    const name = parameter.name.text;
    const decorator = (ts.getDecorators(parameter) ?? []).map(item => item.expression).find(expression => ts.isCallExpression(expression) && ts.isIdentifier(expression.expression));
    if (decorator) {
      const callee = decorator.expression.text;
      if (callee === 'Inject') {
        const argument = decorator.arguments[0];
        if (!argument || !ts.isIdentifier(argument) || !imported.has(argument.text)) throw new ScaffoldError('HFS_NEW_TOKEN_UNKNOWN', `${fileName}: @Inject(...) of ${name} must name a token imported from a module`);
        dependencies.push({ kind: 'token', name, decorator: 'Inject', token: argument.text, module: imported.get(argument.text).module, type: typeOf(parameter.type) });
        continue;
      }
      if (callee.startsWith('Inject')) {
        if (!imported.has(callee)) throw new ScaffoldError('HFS_NEW_TOKEN_UNKNOWN', `${fileName}: ${callee} is not imported, so the module that exports its token is unknown`);
        dependencies.push({ kind: 'token', name, decorator: callee, token: tokenNameOf(callee), module: imported.get(callee).module, type: typeOf(parameter.type) });
        continue;
      }
    }
    const reference = ts.isTypeReferenceNode(parameter.type) && ts.isIdentifier(parameter.type.typeName) ? parameter.type.typeName.text : null;
    if (!reference || !imported.has(reference)) throw new ScaffoldError('HFS_NEW_DEPENDENCY_UNKNOWN', `${fileName}: parameter ${name} is neither an @Inject*() token nor an imported class; provide it by hand`);
    dependencies.push({ kind: 'class', name, className: reference, module: imported.get(reference).module });
  }

  const methods = node.members
    .filter(member => ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && !(ts.getCombinedModifierFlags(member) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected | ts.ModifierFlags.Static)))
    .map(member => member.name.text);
  return { className: node.name.text, dependencies, methods };
}

// ------------------------------------------------------------------------------------------------ writing the spec

const tableOf = manifest => {
  const table = manifest.ruleParams?.be?.specDoubles;
  if (!table) throw new ScaffoldError('HFS_NEW_NO_DOUBLE_TABLE', 'the slot manifest has no ruleParams.be.specDoubles: refresh @starci/hfs');
  return table;
};

const doubleOf = (table, token) => table.doubles.find(entry => new RegExp(entry.token).test(token)) ?? table.fallback;

/** One line of code per double kind; `clock` is the shared FakeClock of the build helper. */
const EMITTERS = {
  mockEntityManager: () => ({ code: 'mockEntityManager()', uses: ['mockEntityManager'] }),
  fakeTransaction: () => ({ code: 'fakeTransaction(mockEntityManager())', uses: ['fakeTransaction', 'mockEntityManager'] }),
  FakeClock: () => ({ code: 'clock', clock: true }),
  recordingEventBus: () => ({ code: 'recordingEventBus()', uses: ['recordingEventBus'] }),
  recordingQueueOutbox: () => ({ code: 'recordingQueueOutbox()', uses: ['recordingQueueOutbox'] }),
  fakeCache: () => ({ code: 'fakeCache(clock)', uses: ['fakeCache'], clock: true }),
  fakeLock: () => ({ code: 'fakeLock(clock)', uses: ['fakeLock'], clock: true }),
  fakeIds: () => ({ code: 'fakeIds()', uses: ['fakeIds'] }),
  builder: () => ({ code: '{}', note: 'the real values of the options this service reads: one case per flag branch' }),
  mock: dependency => ({ code: `mock<${dependency.type.text}>()`, uses: ['mock'] }),
};

/** The import line of `names` from `module`, wrapped at the print width the way prettier would. */
const importLine = (names, module, typeOnly = false) => {
  const head = typeOnly ? 'import type' : 'import';
  const single = `${head} { ${names.join(', ')} } from "${module}"`;
  return single.length <= PRINT_WIDTH ? single : `${head} {\n${names.map(name => `${INDENT}${name},`).join('\n')}\n} from "${module}"`;
};

const compareModules = (a, b) => {
  const rank = module => (module.startsWith('.') ? 2 : module.startsWith('@modules/') || module.startsWith('@features/') || module.startsWith('@tests/') ? 1 : 0);
  return rank(a) - rank(b) || a.localeCompare(b);
};

/** The spec skeleton of a service shape: text of `<name>.service.spec.ts`. */
function specSkeleton({ shape, serviceFile, manifest = loadSlotManifest() }) {
  const table = tableOf(manifest);
  const subject = `./${path.basename(serviceFile).replace(/\.ts$/, '')}`;
  const kit = new Set();
  const imports = new Map();
  const typeImports = new Map();
  const addImport = (map, module, name) => { if (!map.has(module)) map.set(module, new Set()); map.get(module).add(name); };
  let needsClock = false;

  const taken = new Set(['service', 'clock', 'moduleRef']);
  const variables = [];
  const providers = [shape.className];
  const notes = [];
  for (const dependency of shape.dependencies) {
    if (dependency.kind === 'class') {
      addImport(imports, dependency.module, dependency.className);
      const variable = uniqueName(camelOf(dependency.name), taken);
      variables.push({ variable, code: `mock<${dependency.className}>()` });
      kit.add('mock');
      providers.push({ provide: dependency.className, variable });
      continue;
    }
    const entry = doubleOf(table, dependency.token);
    const emit = EMITTERS[entry.double];
    if (!emit) throw new ScaffoldError('HFS_NEW_DOUBLE_UNKNOWN', `the slot manifest names the double ${entry.double} for ${dependency.token}, which starci app new cannot write yet`);
    const made = emit(dependency);
    for (const name of made.uses ?? []) kit.add(name);
    if (made.clock) { needsClock = true; kit.add('FakeClock'); }
    addImport(imports, dependency.module, dependency.token);
    for (const type of dependency.type.imports) if (made.uses?.includes('mock')) addImport(typeImports, type.module, type.name);
    if (entry.double === 'FakeClock') { providers.push({ provide: dependency.token, variable: 'clock' }); continue; }
    const variable = uniqueName(camelOf(dependency.name), taken);
    variables.push({ variable, code: made.code, note: made.note });
    if (made.note) notes.push(made.note);
    providers.push({ provide: dependency.token, variable });
  }
  if (shape.dependencies.some(dependency => dependency.kind === 'token' && doubleOf(table, dependency.token).double === 'FakeClock')) needsClock = true;

  const lines = [];
  lines.push(importLine(['Test'], '@nestjs/testing'));
  if (kit.size) lines.push(importLine([...kit].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), KIT));
  const modules = [...new Set([...imports.keys(), ...typeImports.keys()])].sort(compareModules);
  for (const module of modules) {
    if (imports.has(module)) lines.push(importLine([...imports.get(module)].sort(), module));
    if (typeImports.has(module)) lines.push(importLine([...typeImports.get(module)].sort(), module, true));
  }
  lines.push(`import { ${shape.className} } from "${subject}"`);
  lines.push('');

  const build = [];
  build.push('const build = async () => {');
  if (needsClock) build.push(`${INDENT}const clock = new FakeClock("${CLOCK_START}")`);
  for (const item of variables) {
    if (item.note) build.push(`${INDENT}// Fill in ${item.note}.`);
    build.push(`${INDENT}const ${item.variable} = ${item.code}`);
  }
  build.push(`${INDENT}const moduleRef = await Test.createTestingModule({`);
  build.push(`${INDENT}${INDENT}providers: [`);
  for (const provider of providers) build.push(`${INDENT}${INDENT}${INDENT}${typeof provider === 'string' ? provider : `{ provide: ${provider.provide}, useValue: ${provider.variable} }`},`);
  build.push(`${INDENT}${INDENT}],`);
  build.push(`${INDENT}}).compile()`);
  const returned = ['service: moduleRef.get(' + shape.className + ')', ...(needsClock ? ['clock'] : []), ...variables.map(item => item.variable)];
  const single = `${INDENT}return { ${returned.join(', ')} }`;
  if (single.length <= PRINT_WIDTH) build.push(single);
  else build.push(`${INDENT}return {`, ...returned.map(item => `${INDENT}${INDENT}${item},`), `${INDENT}}`);
  build.push('}');
  lines.push(...build, '');

  lines.push(`describe("${shape.className}", () => {`);
  if (shape.methods.length === 0) {
    lines.push(`${INDENT}it("is built by the testing module with its constructor dependencies", async () => {`);
    lines.push(`${INDENT}${INDENT}const { service } = await build()`);
    lines.push(`${INDENT}${INDENT}expect(service).toBeInstanceOf(${shape.className})`);
    lines.push(`${INDENT}})`);
  } else {
    shape.methods.forEach((method, index) => {
      if (index > 0) lines.push('');
      lines.push(`${INDENT}describe("${method}", () => {`);
      lines.push(`${INDENT}${INDENT}it("${method} has its first case written", async () => {`);
      lines.push(`${INDENT}${INDENT}${INDENT}const { service } = await build()`);
      lines.push(`${INDENT}${INDENT}${INDENT}expect(service.${method}).toBeInstanceOf(Function)`);
      lines.push(`${INDENT}${INDENT}})`);
      lines.push(`${INDENT}})`);
    });
  }
  lines.push('})');
  return `${lines.join('\n')}\n`;
}

function uniqueName(name, taken) {
  let candidate = name;
  for (let counter = 2; taken.has(candidate); counter += 1) candidate = `${name}${counter}`;
  taken.add(candidate);
  return candidate;
}

// ------------------------------------------------------------------------------------------------ writing the service

/**
 * `--inject` entries: `InjectCache=@modules/integrations/cache:Cache` (a token dependency: decorator, the module that exports the
 * decorator and its token, the parameter type) or `ProbeCheckerService=@modules/platform/probes` (a class dependency).
 */
function parseInject(entry) {
  const match = /^([A-Za-z][A-Za-z0-9]*)=([^:\s]+)(?::([A-Za-z][A-Za-z0-9<>, ]*))?$/.exec(entry);
  if (!match) throw new ScaffoldError('HFS_NEW_INJECT_INVALID', `--inject ${entry}: expected InjectName=<module>:<Type> or ClassName=<module>`);
  const [, name, module, type] = match;
  if (name.startsWith('Inject')) {
    if (!type) throw new ScaffoldError('HFS_NEW_INJECT_INVALID', `--inject ${entry}: a token dependency names its type after a colon (InjectCache=<module>:Cache)`);
    return { kind: 'token', decorator: name, module, type, parameter: camelOf(type.replace(/<.*$/, '')) };
  }
  if (type) throw new ScaffoldError('HFS_NEW_INJECT_INVALID', `--inject ${entry}: a class dependency takes no type`);
  return { kind: 'class', className: name, module, parameter: camelOf(name) };
}

/** The text of a new `<name>.service.ts` with the given dependencies (parseInject results). */
function serviceSource({ name, dependencies = [] }) {
  const className = `${pascalOf(name)}Service`;
  const values = new Map();
  const types = new Map();
  const add = (map, module, item) => { if (!map.has(module)) map.set(module, new Set()); map.get(module).add(item); };
  add(values, '@nestjs/common', 'Injectable');
  for (const dependency of dependencies) {
    if (dependency.kind === 'token') { add(values, dependency.module, dependency.decorator); add(types, dependency.module, dependency.type.replace(/<.*$/, '')); } else add(values, dependency.module, dependency.className);
  }
  const lines = [];
  for (const module of [...new Set([...values.keys(), ...types.keys()])].sort(compareModules)) {
    if (values.has(module)) lines.push(importLine([...values.get(module)].sort(), module));
    if (types.has(module)) lines.push(importLine([...types.get(module)].sort(), module, true));
  }
  lines.push('', '@Injectable()', `/** The ${words(name).join(' ')} service: state what it decides in one sentence. */`);
  if (dependencies.length === 0) lines.push(`export class ${className} {}`);
  else {
    lines.push(`export class ${className} {`, `${INDENT}constructor(`);
    for (const dependency of dependencies) lines.push(dependency.kind === 'token' ? `${INDENT}${INDENT}@${dependency.decorator}() private readonly ${dependency.parameter}: ${dependency.type},` : `${INDENT}${INDENT}private readonly ${dependency.parameter}: ${dependency.className},`);
    lines.push(`${INDENT}) {}`, '}');
  }
  return `${lines.join('\n')}\n`;
}

// ------------------------------------------------------------------------------------------------ the commands

const loadTypeScript = repoRoot => {
  try { return createRequire(path.join(repoRoot, 'package.json'))('typescript'); } catch {
    throw new ScaffoldError('HFS_NEW_TYPESCRIPT_MISSING', `typescript is not installed under ${repoRoot}; run npm ci first, starci app new reads the constructor with the repository's own TypeScript`);
  }
};

const BE = 'be';

/** The be side folder of the app at `appRoot`: starci app new runs at the app root and writes into be/ only. */
const backEndOf = appRoot => {
  let repo;
  try { repo = readRepoDeclaration(loadSlotManifest(), appRoot); } catch (error) { throw new ScaffoldError('HFS_NEW_NO_HFS', `${appRoot} has no valid app hfs.json (${error.message})`); }
  if (!repo.sides) throw new ScaffoldError('HFS_NEW_NO_HFS', `${appRoot} is not the app root; run starci app new at the folder of hfs.json`);
  return path.join(appRoot, BE);
};

/** An app-relative path below be/ as a be-relative one; a path of the root or of fe/ is refused. */
const belowBackEnd = input => {
  const relative = input.split(path.sep).join('/').replace(/^\.\//, '').replace(/\/$/, '');
  if (!relative.startsWith(`${BE}/`)) throw new ScaffoldError('HFS_NEW_BACKEND_ONLY', `starci app new service | spec writes back-end services under be/; ${relative} is not below be/`);
  return relative.slice(BE.length + 1);
};

/** The slot check of a target: the manifest must own the path, else nothing is written. */
const requireSlot = (repoRoot, relative) => {
  const explained = explainPath({ repoRoot, input: relative });
  if (explained.status === 'no-slot' || explained.status === 'ambiguous') throw new ScaffoldError('HFS_NEW_NO_SLOT', `${relative} is owned by no slot of the HFS manifest (${explained.status}); a service belongs in src/modules/{domain,platform,integrations}/<capability>/`);
};

const writeNew = (repoRoot, relative, text) => {
  const target = path.join(repoRoot, relative);
  if (fs.existsSync(target)) throw new ScaffoldError('HFS_NEW_EXISTS', `${relative} already exists; starci app new never overwrites`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  return relative;
};

/** `starci app new spec be/<file>.service.ts` at the app root: writes the spec skeleton of an existing service; returns the created app-relative paths. */
export function newSpec({ repoRoot: appRoot, file, ts = loadTypeScript(appRoot), manifest = loadSlotManifest() }) {
  const repoRoot = backEndOf(appRoot);
  const relative = belowBackEnd(file);
  if (!relative.endsWith('.service.ts')) throw new ScaffoldError('HFS_NEW_NOT_A_SERVICE', `${relative} is not a *.service.ts file: only services have a unit spec`);
  const absolute = path.join(repoRoot, relative);
  if (!fs.existsSync(absolute)) throw new ScaffoldError('HFS_NEW_NO_SERVICE', `${relative} does not exist`);
  const specPath = relative.replace(/\.ts$/, '.spec.ts');
  requireSlot(repoRoot, specPath);
  const shape = readServiceShape({ ts, fileName: absolute, text: fs.readFileSync(absolute, 'utf8') });
  return [writeNew(repoRoot, specPath, specSkeleton({ shape, serviceFile: relative, manifest }))].map(created => `${BE}/${created}`);
}

/** `starci app new service be/<dir> <name> [--inject ...]` at the app root: writes the service and its spec skeleton; returns the created app-relative paths. */
export function newService({ repoRoot: appRoot, dir, name, inject = [], ts = loadTypeScript(appRoot), manifest = loadSlotManifest() }) {
  const repoRoot = backEndOf(appRoot);
  if (!SERVICE_NAME.test(name)) throw new ScaffoldError('HFS_NEW_NAME_INVALID', `the service name ${name} must be kebab-case (member-profile), without the .service suffix`);
  const relative = path.posix.join(belowBackEnd(dir), `${name}.service.ts`);
  requireSlot(repoRoot, relative);
  requireSlot(repoRoot, relative.replace(/\.ts$/, '.spec.ts'));
  for (const target of [relative, relative.replace(/\.ts$/, '.spec.ts')]) if (fs.existsSync(path.join(repoRoot, target))) throw new ScaffoldError('HFS_NEW_EXISTS', `${target} already exists; starci app new never overwrites`);
  const text = serviceSource({ name, dependencies: inject.map(parseInject) });
  const shape = readServiceShape({ ts, fileName: path.join(repoRoot, relative), text });
  const spec = specSkeleton({ shape, serviceFile: relative, manifest });
  return [writeNew(repoRoot, relative, text), writeNew(repoRoot, relative.replace(/\.ts$/, '.spec.ts'), spec)].map(created => `${BE}/${created}`);
}
