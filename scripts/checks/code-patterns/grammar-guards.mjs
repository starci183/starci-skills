import crypto from 'node:crypto';
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isInside, slash } from '../architecture/config.mjs';
import { loadTargetTypeScript } from '../architecture/typescript.mjs';
import { exact, plain, repositoryPath, repositoryRelative } from './common.mjs';
import { assertGrammarDistFresh } from '../grammar-dist.mjs';

export const GRAMMAR_GUARD_RULES = Object.freeze(['FE_GRAMMAR_GUARD_BEHAVIOR']);
const CONTRACT_SCHEMA = 'starci/grammar-guard-contract@1';
const VECTOR_PROFILE = 'starci/grammar-guards-v1';
const RESULT_SCHEMA = 'starci/grammar-guard-probe@1';
const MAX_FILES = 20_000;
const MAX_BYTES = 256 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_RULES = 512;
const MAX_STATES = 128;
const INVALID_STATES = [['empty', ''], ['null', null], ['number', 0], ['object', {}], ['array', []]];
const BUILTINS = new Set(builtinModules.flatMap(name => [name, name.startsWith('node:') ? name : `node:${name}`]));

function readContract(root) {
  const file = repositoryPath(root, 'package.json', 'Input');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const value = pkg.starci?.codePatterns?.next?.grammarGuards;
  exact(value, ['schema', 'package', 'entry', 'source', 'vectorProfile'], 'Grammar guard contract');
  if (value.schema !== CONTRACT_SCHEMA || value.vectorProfile !== VECTOR_PROFILE
    || typeof value.package !== 'string' || !/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(value.package)
    || typeof value.entry !== 'string' || !/^\.\/[a-z0-9][a-z0-9._/-]*$/i.test(value.entry)) throw Error('Grammar guard contract needs the supported schema, package, public subpath and vector profile.');
  exact(value.source, value.source?.kind === 'repository' ? ['kind', 'root'] : ['kind'], 'Grammar guard package source');
  if (!['installed', 'repository'].includes(value.source.kind)) throw Error('Grammar guard package source must be installed or repository.');
  if (value.source.kind === 'repository') repositoryRelative(value.source.root, 'Repository Grammar root', { allowDot: true });
  return { pkg, value };
}

function runNode(spawn, args, cwd, timeout = TIMEOUT_MS, allowReads = ['*'], input = undefined) {
  const env = { FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' };
  for (const name of ['SYSTEMROOT', 'WINDIR', 'ComSpec', 'TEMP', 'TMP']) if (typeof process.env[name] === 'string') env[name] = process.env[name];
  const permissions = allowReads.map(value => `--allow-fs-read=${value}`);
  return spawn(process.execPath, ['--permission', ...permissions, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    env,
    input,
  });
}

function resolvePublicEntry(root, specifier, spawn) {
  const code = 'process.stdout.write(import.meta.resolve(process.argv[1]))';
  const result = runNode(spawn, ['--input-type=module', '-e', code, specifier], root, 5_000);
  if (result.error || result.status !== 0 || result.signal || result.stderr || typeof result.stdout !== 'string') throw Error('Grammar public import-condition resolution is unavailable.');
  let url;
  try { url = new URL(result.stdout); } catch { throw Error('Grammar public import-condition resolution returned an invalid URL.'); }
  if (url.protocol !== 'file:') throw Error('Grammar public entry must resolve to a local package file.');
  const absolute = fs.realpathSync(fileURLToPath(url));
  if (!fs.lstatSync(absolute).isFile()) throw Error('Grammar public entry is not a regular file.');
  return absolute;
}

function packageRootFromEntry(entry, expectedName) {
  for (let cursor = path.dirname(entry); path.dirname(cursor) !== cursor; cursor = path.dirname(cursor)) {
    const file = path.join(cursor, 'package.json');
    if (!fs.existsSync(file)) continue;
    try { if (JSON.parse(fs.readFileSync(file, 'utf8')).name === expectedName) return fs.realpathSync(cursor); } catch {}
  }
  throw Error('Resolved Grammar entry has no matching package manifest.');
}

function resolvePackage(root, contract, spawn) {
  const specifier = `${contract.package}${contract.entry.slice(1)}`;
  if (contract.source.kind === 'installed') {
    const entry = resolvePublicEntry(root, specifier, spawn);
    return { root: packageRootFromEntry(entry, contract.package), entry, selection: 'installed-import' };
  }
  const declared = path.resolve(root, contract.source.root);
  if (!isInside(root, declared)) throw Error('Repository Grammar root escapes the target repository.');
  const packageRoot = fs.realpathSync(declared);
  if (!fs.lstatSync(packageRoot).isDirectory()) throw Error('Repository Grammar root is not a directory.');
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  if (pkg.name !== contract.package) throw Error('Repository Grammar package identity does not match the contract.');
  const standalone = packageRoot === root;
  const selected = resolvePublicEntry(root, specifier, spawn);
  if (!isInside(packageRoot, selected)) throw Error('Consumer resolves a stale or different Grammar package than the declared repository provider.');
  return { root: packageRoot, entry: selected, selection: standalone ? 'standalone-import' : 'consumer-import' };
}

// npm `files`: positive entries name the inventory and must be literal package paths; `!`-prefixed entries only
// subtract from it (npm-packlist never adds a file for a negation), so they may be globs. A negation alone names nothing.
export function packageFileRules(files) {
  const refuse = () => { throw Error('Grammar package files must be an explicit bounded package inventory.'); };
  if (!Array.isArray(files) || !files.length) refuse();
  const include = [], exclude = [];
  for (const value of files) {
    if (typeof value !== 'string') refuse();
    const negated = value.startsWith('!'), pattern = negated ? value.slice(1) : value;
    if (!pattern || pattern.startsWith('!') || path.isAbsolute(pattern) || /^[A-Za-z]:/.test(pattern) || pattern.includes('\\')
      || pattern.split('/').includes('..') || (!negated && /[*?{}]/.test(pattern))) refuse();
    (negated ? exclude : include).push(pattern.replace(/\/+$/, ''));
  }
  if (!include.length) throw Error('Grammar package files must name at least one bounded inventory entry; negations only narrow it.');
  if (exclude.length && typeof path.posix.matchesGlob !== 'function') throw Error('Grammar package file negations need a Node runtime with path.matchesGlob.');
  return { include, exclude };
}

/** True when a package-relative file is removed from the published inventory by a `files` negation (the file or any ancestor directory matches; a slash-free pattern matches at any depth). */
export function excludedByPackageFiles(relative, exclude) {
  if (!exclude.length) return false;
  const segments = relative.split('/');
  for (let index = 1; index <= segments.length; index += 1) {
    const candidate = segments.slice(0, index).join('/');
    for (const pattern of exclude) {
      if (path.posix.matchesGlob(candidate, pattern) || (!pattern.includes('/') && path.posix.matchesGlob(segments[index - 1], pattern))) return true;
    }
  }
  return false;
}

function packageInputs(packageRoot, sourceKind, entry) {
  const manifest = path.join(packageRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const rules = packageFileRules(pkg.files);
  const roots = new Set([manifest, entry]);
  for (const value of rules.include) {
    const absolute = path.resolve(packageRoot, value);
    if (isInside(packageRoot, absolute) && fs.existsSync(absolute)) roots.add(absolute);
  }
  if (sourceKind === 'repository') for (const value of ['src', 'scripts']) {
    const absolute = path.join(packageRoot, value);
    if (fs.existsSync(absolute)) roots.add(absolute);
  }
  for (const name of fs.readdirSync(packageRoot)) if (/^(?:package-lock|npm-shrinkwrap)\.json$|^(?:pnpm-lock\.yaml|yarn\.lock)$|^tsconfig(?:\..+)?\.json$/.test(name)) roots.add(path.join(packageRoot, name));
  const files = new Map(); let bytes = 0;
  const visit = absolute => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw Error(`Grammar package contains an interior link: ${slash(path.relative(packageRoot, absolute))}`);
    if (stat.isDirectory()) {
      for (const item of fs.readdirSync(absolute).sort()) visit(path.join(absolute, item));
      return;
    }
    if (!stat.isFile()) throw Error('Grammar package inventory contains a non-file input.');
    const canonical = fs.realpathSync(absolute);
    if (!isInside(packageRoot, canonical)) throw Error('Grammar package input escapes its canonical root.');
    const relative = slash(path.relative(packageRoot, canonical));
    if (!files.has(relative)) { files.set(relative, canonical); bytes += stat.size; }
    if (files.size > MAX_FILES || bytes > MAX_BYTES) throw Error('Grammar package identity exceeds the bounded input ceiling.');
  };
  for (const absolute of roots) visit(absolute);
  const sorted = [...files].sort(([a], [b]) => a.localeCompare(b));
  return { pkg, files: sorted, bytes, exclude: rules.exclude, readRoots: [...roots].map(value => fs.realpathSync(value)).sort() };
}

function targetInputs(root) {
  const names = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock'];
  const files = names.filter(name => fs.existsSync(path.join(root, name))).map(name => [name, repositoryPath(root, name, 'Input')]);
  if (files.length < 2) throw Error('Target Grammar selection needs a dependency lock beside package.json.');
  return files;
}

function npmLock(root) {
  const file = path.join(root, 'package-lock.json');
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  return plain(value.packages) ? value.packages : null;
}

function packageNameFromSpecifier(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function packageAt(file, expectedName = null) {
  for (let cursor = path.dirname(file); path.dirname(cursor) !== cursor; cursor = path.dirname(cursor)) {
    const manifest = path.join(cursor, 'package.json');
    if (!fs.existsSync(manifest) || !fs.lstatSync(manifest).isFile()) continue;
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch { throw Error('Resolved dependency package manifest is invalid.'); }
    if (typeof pkg.name !== 'string' || !pkg.name || typeof pkg.version !== 'string' || !pkg.version) continue;
    if (expectedName && pkg.name !== expectedName) throw Error(`Resolved dependency package identity does not match ${expectedName}.`);
    return { root: fs.realpathSync(cursor), manifest: fs.realpathSync(manifest), pkg };
  }
  throw Error('Resolved external dependency has no canonical package identity.');
}

function lockBinding(root, packages, packageRecord) {
  if (!packages) throw Error(`External dependency ${packageRecord.pkg.name} cannot be bound without an npm package-lock package record.`);
  const suffix = `node_modules/${packageRecord.pkg.name}`;
  const candidates = Object.entries(packages).filter(([key, value]) => slash(key).endsWith(suffix)
    && plain(value) && value.version === packageRecord.pkg.version).map(([key]) => key).sort();
  if (!candidates.length) throw Error(`External dependency ${packageRecord.pkg.name}@${packageRecord.pkg.version} is absent from the target dependency lock.`);
  const exact = candidates.filter(key => {
    const declared = path.resolve(root, key);
    try { return fs.existsSync(declared) && fs.realpathSync(declared) === packageRecord.root; } catch { return false; }
  });
  if (exact.length === 1) return slash(exact[0]);
  if (!isInside(root, packageRecord.root) && candidates.length === 1) return slash(candidates[0]);
  throw Error(`External dependency ${packageRecord.pkg.name}@${packageRecord.pkg.version} has no unique canonical lock binding.`);
}

function externalPackageInventory(root, record) {
  const files = new Map(); let bytes = 0;
  const names = fs.readdirSync(record.root);
  if (names.some(name => ['node_modules', '.git'].includes(name))) {
    throw Error(`External dependency ${record.pkg.name} has an unbounded nested dependency or repository directory.`);
  }
  const roots = names.map(name => path.join(record.root, name)).sort();
  const visit = absolute => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw Error(`External dependency ${record.pkg.name} contains an interior link.`);
    if (stat.isDirectory()) { for (const name of fs.readdirSync(absolute).sort()) visit(path.join(absolute, name)); return; }
    if (!stat.isFile()) throw Error(`External dependency ${record.pkg.name} contains a non-file input.`);
    const canonical = fs.realpathSync(absolute);
    if (!isInside(record.root, canonical)) throw Error(`External dependency ${record.pkg.name} escapes its canonical package root.`);
    const relative = slash(path.relative(record.root, canonical));
    if (!files.has(relative)) { files.set(relative, canonical); bytes += stat.size; }
  };
  for (const absolute of roots) visit(absolute);
  return { files: [...files].sort(([a], [b]) => a.localeCompare(b)), bytes,
    readRoots: [...new Set([record.root, path.resolve(root, record.lockKey)])].sort() };
}

function staticReferences(ts, file, packageType) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let declaredRequire = false;
  const findRequireDeclaration = node => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
      && node.name && ts.isIdentifier(node.name) && node.name.text === 'require') declaredRequire = true;
    ts.forEachChild(node, findRequireDeclaration);
  };
  findRequireDeclaration(source);
  const references = [];
  const visit = node => {
    let literal = null; let mode = 'import';
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) literal = node.moduleSpecifier;
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      if (!node.moduleReference.expression || !ts.isStringLiteralLike(node.moduleReference.expression)) throw Error('Grammar closure has an unresolved import-equals dependency.');
      literal = node.moduleReference.expression; mode = 'require';
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (![1, 2].includes(node.arguments.length) || !ts.isStringLiteralLike(node.arguments[0])) throw Error('Grammar closure has an unresolved dynamic import.');
      literal = node.arguments[0];
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
      && (file.toLowerCase().endsWith('.cjs') || (file.toLowerCase().endsWith('.js') && packageType !== 'module'))) {
      if (declaredRequire) throw Error('Grammar closure has a shadowed CommonJS require that cannot be resolved statically.');
      if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0])) throw Error('Grammar closure has an unresolved dynamic require.');
      literal = node.arguments[0]; mode = 'require';
    }
    if (literal) references.push({ specifier: literal.text, mode });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return references;
}

function resolveReferences(root, requests, spawn) {
  if (!requests.length) return [];
  const pairs = requests.map(({ importer, reference }) => [reference.specifier, pathToFileURL(importer).href, reference.mode]);
  const code = "import fs from 'node:fs';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';const p=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(p.map(([s,u,m])=>m==='require'?createRequire(fileURLToPath(u)).resolve(s):import.meta.resolve(s,u))))";
  const result = runNode(spawn, ['--experimental-import-meta-resolve', '--input-type=module', '-e', code], root, 15_000, ['*'], JSON.stringify(pairs));
  if (result.error || result.status !== 0 || result.signal || result.stderr || typeof result.stdout !== 'string') throw Error('Grammar static dependency resolution is unavailable.');
  let urls;
  try { urls = JSON.parse(result.stdout); } catch { throw Error('Grammar static dependency resolution returned malformed output.'); }
  if (!Array.isArray(urls) || urls.length !== requests.length || urls.some(value => typeof value !== 'string')) throw Error('Grammar static dependency resolution returned an invalid result.');
  return urls;
}

function closureInputs(ts, root, resolved, inventory, spawn) {
  const grammarInventory = new Set(inventory.files.map(([, file]) => fs.realpathSync(file)));
  const locks = npmLock(root);
  const packages = new Map();
  const grammar = { root: resolved.root, manifest: fs.realpathSync(path.join(resolved.root, 'package.json')), pkg: inventory.pkg,
    lockKey: null, kind: 'grammar' };
  packages.set(resolved.root, grammar);
  const files = new Map();
  const pending = [resolved.entry];
  const builtins = new Set();
  const edges = [];
  const add = (file, owner) => {
    const canonical = fs.realpathSync(file);
    if (!isInside(owner.root, canonical)) throw Error('Grammar static dependency escapes its canonical package root.');
    for (let cursor = canonical; cursor !== owner.root; cursor = path.dirname(cursor)) {
      if (fs.lstatSync(cursor).isSymbolicLink()) throw Error('Grammar static dependency redirects through an interior link.');
    }
    if (!fs.lstatSync(canonical).isFile()) throw Error('Grammar static dependency is not a regular file.');
    if (owner.kind === 'grammar' && !grammarInventory.has(canonical)) {
      throw Error(`Grammar public entry dependency is outside the bound package inventory: ${slash(path.relative(owner.root, canonical))}`);
    }
    // The digest still binds every file under the positive entries; a behavior dependency must also survive npm's negations.
    if (owner.kind === 'grammar' && excludedByPackageFiles(slash(path.relative(owner.root, canonical)), inventory.exclude)) {
      throw Error(`Grammar public entry dependency is excluded from the published package inventory: ${slash(path.relative(owner.root, canonical))}`);
    }
    if (!files.has(canonical)) { files.set(canonical, owner); pending.push(canonical); }
  };
  add(resolved.entry, grammar);
  while (pending.length) {
    const batch = pending.splice(0, pending.length).filter(file => /\.[cm]?[jt]sx?$/i.test(file));
    const requests = [];
    for (const importer of batch) {
      const owner = files.get(importer);
      for (const reference of staticReferences(ts, importer, owner.pkg.type)) {
        const specifier = reference.specifier;
        if (BUILTINS.has(specifier)) { builtins.add(specifier.startsWith('node:') ? specifier : `node:${specifier}`); continue; }
        if (specifier.startsWith('file:') || specifier.startsWith('data:') || specifier.startsWith('/') || /^[A-Za-z]:[\\/]/.test(specifier)
          || (/^[a-z][a-z0-9+.-]*:/i.test(specifier) && !specifier.startsWith('node:'))) {
          throw Error(`Grammar closure uses an unsupported absolute or data dependency: ${specifier}`);
        }
        requests.push({ importer, owner, reference });
      }
    }
    const urls = resolveReferences(root, requests, spawn);
    for (let index = 0; index < requests.length; index += 1) {
      const { owner, reference } = requests[index], value = urls[index];
      if (BUILTINS.has(value)) {
        const builtin = value.startsWith('node:') ? value : `node:${value}`;
        builtins.add(builtin); edges.push({ importer: requests[index].importer, reference, resolved: builtin }); continue;
      }
      let dependency;
      if (path.isAbsolute(value)) dependency = fs.realpathSync(value);
      else {
        let url;
        try { url = new URL(value); } catch { throw Error('Grammar dependency resolution returned an invalid URL.'); }
        if (url.protocol !== 'file:') throw Error(`Grammar dependency resolution is not file-bound: ${reference.specifier}`);
        dependency = fs.realpathSync(fileURLToPath(url));
      }
      edges.push({ importer: requests[index].importer, reference, resolved: dependency });
      let targetOwner;
      if (reference.specifier.startsWith('.')) {
        targetOwner = owner;
        if (!isInside(owner.root, dependency)) throw Error('Grammar relative dependency escapes its canonical package root.');
      } else {
        const expected = reference.specifier.startsWith('#') ? null : packageNameFromSpecifier(reference.specifier);
        const found = packageAt(dependency, expected);
        targetOwner = packages.get(found.root);
        if (!targetOwner) {
          found.lockKey = lockBinding(root, locks, found); found.kind = 'external';
          targetOwner = found; packages.set(found.root, found);
        }
      }
      add(dependency, targetOwner);
    }
    if (files.size > MAX_FILES) throw Error('Grammar static dependency closure exceeds the bounded file ceiling.');
  }
  const packageList = [...packages.values()].sort((a, b) => `${a.pkg.name}@${a.pkg.version}:${a.lockKey ?? ''}`.localeCompare(`${b.pkg.name}@${b.pkg.version}:${b.lockKey ?? ''}`));
  const packageLabels = new Map(packageList.map((item, index) => [item.root, item.kind === 'grammar' ? 'grammar' : `dependency:${item.pkg.name}@${item.pkg.version}:${item.lockKey}:${index}`]));
  for (const item of packageList) item.label = packageLabels.get(item.root);
  const closureFiles = [...files].map(([file, owner]) => [`${packageLabels.get(owner.root)}:${slash(path.relative(owner.root, file))}`, file])
    .sort(([a], [b]) => a.localeCompare(b));
  const manifests = packageList.map(item => [`${packageLabels.get(item.root)}:package.json`, item.manifest]);
  return { files: [...new Map([...closureFiles, ...manifests].map(item => [item[0], item])).values()].sort(([a], [b]) => a.localeCompare(b)),
    dependencyFiles: closureFiles.map(([name]) => name), builtins: [...builtins].sort(), edges,
    packages: packageList.filter(item => item.kind === 'external') };
}

function identity(ts, root, resolved, spawn) {
  const inventory = packageInputs(resolved.root, resolved.sourceKind, resolved.entry);
  const closure = closureInputs(ts, root, resolved, inventory, spawn);
  const externalInventories = closure.packages.map(item => ({ item, inventory: externalPackageInventory(root, item) }));
  return assembleIdentity(root, inventory, closure, externalInventories);
}

function assembleIdentity(root, inventory, closure, externalInventories) {
  const hash = crypto.createHash('sha256');
  const files = [...targetInputs(root).map(([name, file]) => [`target:${name}`, file]),
    ...inventory.files.map(([name, file]) => [`grammar-inventory:${name}`, file]),
    ...externalInventories.flatMap(({ item, inventory: external }) => external.files.map(([name, file]) => [`${item.label}:inventory:${name}`, file]))]
    .sort(([a], [b]) => a.localeCompare(b));
  let bytes = 0;
  for (const [name, file] of files) {
    const content = fs.readFileSync(file); bytes += content.length;
    hash.update(name); hash.update(Buffer.from([0])); hash.update(content); hash.update(Buffer.from([0]));
    if (files.length > MAX_FILES || bytes > MAX_BYTES) throw Error(`Grammar package and dependency identity exceeds the bounded input ceiling (${files.length} files, ${bytes} bytes).`);
  }
  const readFiles = [...new Set([...inventory.readRoots, ...externalInventories.flatMap(({ inventory: external }) => external.readRoots)])].sort();
  return { digest: hash.digest('hex'), files: files.map(([name]) => name), readFiles,
    package: inventory.pkg, bytes, dependencyFiles: closure.dependencyFiles, builtins: closure.builtins,
    externalPackages: closure.packages.map(item => ({ name: item.pkg.name, version: item.pkg.version, lockKey: item.lockKey })),
    externalRecords: closure.packages, resolutionEdges: closure.edges };
}

function recheckResolutions(root, before, spawn) {
  const requests = before.resolutionEdges.map(edge => ({ importer: edge.importer, reference: edge.reference }));
  const values = resolveReferences(root, requests, spawn);
  for (let index = 0; index < before.resolutionEdges.length; index += 1) {
    const edge = before.resolutionEdges[index], value = values[index];
    let actual;
    if (BUILTINS.has(value)) actual = value.startsWith('node:') ? value : `node:${value}`;
    else if (path.isAbsolute(value)) actual = fs.realpathSync(value);
    else {
      let url;
      try { url = new URL(value); } catch { throw Error('Grammar dependency re-resolution returned an invalid URL.'); }
      if (url.protocol !== 'file:') throw Error(`Grammar dependency re-resolution is not file-bound: ${edge.reference.specifier}`);
      actual = fs.realpathSync(fileURLToPath(url));
    }
    if (actual !== edge.resolved) throw Error(`Grammar dependency selection changed during the behavior probe: ${edge.reference.specifier}`);
  }
}

function recheckIdentity(root, resolved, before, spawn) {
  recheckResolutions(root, before, spawn);
  const inventory = packageInputs(resolved.root, resolved.sourceKind, resolved.entry);
  const externalInventories = before.externalRecords.map(item => {
    if (lockBinding(root, npmLock(root), item) !== item.lockKey) throw Error(`External dependency ${item.pkg.name} selection changed during the behavior probe.`);
    return { item, inventory: externalPackageInventory(root, item) };
  });
  return assembleIdentity(root, inventory, { dependencyFiles: before.dependencyFiles, builtins: before.builtins,
    edges: before.resolutionEdges, packages: before.externalRecords }, externalInventories);
}

function permissionCapabilities() {
  const networkDenied = process.allowedNodeEnvironmentFlags?.has?.('--allow-net') === true;
  return { model: 'node-permission', trust: 'selected-package-is-trusted', filesystemRead: 'bound-package-inventories', filesystemWrite: 'denied',
    childProcess: 'denied', workerThreads: 'denied', network: networkDenied ? 'denied' : 'not-controlled-by-this-node-version' };
}

const PROBE = String.raw`
import { pathToFileURL } from 'node:url';
const schema='starci/grammar-guard-probe@1',entry=process.argv[1],violations=[];
const fail=(vector,reason)=>violations.push({vector,reason});
const typeError=error=>error instanceof TypeError;
try {
  const api=await import(pathToFileURL(entry).href);
  const define=api.defineGrammarRuleConformance,assertState=api.assertPresentationState;
  const rules=api.COMMON_UI_RULE_IDS,states=api.PRESENTATION_STATES;
  if(typeof define!=='function'||typeof assertState!=='function'||!Array.isArray(rules)||!rules.length||new Set(rules).size!==rules.length||rules.some(x=>typeof x!=='string'||!x)
    ||rules.length>${MAX_RULES}||!Array.isArray(states)||!states.length||states.length>${MAX_STATES}||new Set(states).size!==states.length||states.some(x=>typeof x!=='string'||!x)) throw Error('public-contract-unavailable');
  const rejectsAtModuleInit=async(definition,vector)=>{
    const source='import {defineGrammarRuleConformance as define} from '+JSON.stringify(pathToFileURL(entry).href)+'; define('+JSON.stringify(definition)+');';
    try { await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source)+'#'+encodeURIComponent(vector)); fail(vector,'accepted-invalid'); }
    catch(error) { if(!typeError(error)) fail(vector,'wrong-error-class'); }
  };
  try { define({familyId:'starci-valid-probe',inheritedCommonRules:[...rules],familyEvidence:{}}); } catch(error) { fail('conformance-valid-all',typeError(error)?'rejected-valid':'unexpected-error'); }
  for(const missing of rules) {
    const definition={familyId:'starci-missing-probe',inheritedCommonRules:rules.filter(rule=>rule!==missing),familyEvidence:{}};
    await rejectsAtModuleInit(definition,'conformance-missing:'+missing);
  }
  let unknown='__STARCI_UNKNOWN_RULE__'; while(rules.includes(unknown)) unknown+='_';
  await rejectsAtModuleInit({familyId:'starci-unknown-probe',inheritedCommonRules:[...rules,unknown],familyEvidence:{}},'conformance-unknown');
  for(const state of states) try { assertState(state); } catch(error) { fail('presentation-valid:'+state,typeError(error)?'rejected-valid':'unexpected-error'); }
  let unknownState='__STARCI_UNKNOWN_STATE__'; while(states.includes(unknownState)) unknownState+='_';
  for(const [name,value] of [['sentinel',unknownState],...${JSON.stringify(INVALID_STATES)}]) {
    try { assertState(value); fail('presentation-invalid:'+name,'accepted-invalid'); }
    catch(error) { if(!typeError(error)) fail('presentation-invalid:'+name,'wrong-error-class'); }
  }
  process.stdout.write(JSON.stringify({schema,ok:violations.length===0,ruleCount:rules.length,stateCount:states.length,violations}));
} catch(error) {
  process.stdout.write(JSON.stringify({schema,ok:false,unavailable:'public-entry-or-contract'}));
}`;

function executeProbe(resolved, identityValue, spawn) {
  const result = runNode(spawn, ['--input-type=module', '-e', PROBE, resolved.entry], resolved.root, TIMEOUT_MS, identityValue.readFiles);
  if (result.error || result.status !== 0 || result.signal || result.stderr || typeof result.stdout !== 'string') throw Error('Grammar guard behavior probe did not complete cleanly within its bound.');
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { throw Error('Grammar guard behavior probe returned malformed output.'); }
  if (!plain(parsed) || parsed.schema !== RESULT_SCHEMA || typeof parsed.ok !== 'boolean' || (parsed.unavailable === undefined
    && (!Number.isInteger(parsed.ruleCount) || parsed.ruleCount < 1 || parsed.ruleCount > MAX_RULES || !Number.isInteger(parsed.stateCount) || parsed.stateCount < 1 || parsed.stateCount > MAX_STATES || !Array.isArray(parsed.violations)))) throw Error('Grammar guard behavior probe result is invalid.');
  if (parsed.unavailable) throw Error('Grammar public guard exports or vocabulary are unavailable.');
  return parsed;
}

/** Execute the finite public Grammar guard vectors against the exact selected package. */
export function checkGrammarGuards({ root, files, contextFiles = [], ruleIds } = {}, { spawn = spawnSync } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null, execution: null };
  try {
    root = fs.realpathSync(path.resolve(root)); result.repository = root;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length || !Array.isArray(contextFiles)
      || !Array.isArray(ruleIds) || ruleIds.length !== 1 || ruleIds[0] !== GRAMMAR_GUARD_RULES[0]) throw Error('Grammar guard check needs explicit files and its one supported rule.');
    for (const file of files) repositoryPath(root, file, 'Input');
    result.files = [...files].sort();
    const loaded = loadTargetTypeScript(root); result.compiler = { version: loaded.version, resolved: loaded.resolved };
    const { value: contract } = readContract(root);
    if (!contextFiles.includes('package.json') && !files.includes('package.json')) throw Error('Target package contract is outside the bound input context.');
    const resolved = resolvePackage(root, contract, spawn); resolved.sourceKind = contract.source.kind;
    // The probe executes the selected package's dist: a dist that is not the build of its source is refused, not probed.
    assertGrammarDistFresh(resolved.root);
    if (contract.source.kind === 'repository') {
      const providerManifest = slash(path.relative(root, path.join(resolved.root, 'package.json')));
      if (isInside(root, resolved.root) && !contextFiles.includes(providerManifest) && !files.includes(providerManifest)) throw Error('Repository Grammar package is outside the bound input context.');
    }
    const before = identity(loaded.ts, root, resolved, spawn), probe = executeProbe(resolved, before, spawn), reselected = resolvePackage(root, contract, spawn);
    reselected.sourceKind = contract.source.kind;
    if (reselected.root !== resolved.root || reselected.entry !== resolved.entry || reselected.selection !== resolved.selection) throw Error('The consumer Grammar package selection changed during the behavior probe.');
    const after = recheckIdentity(root, reselected, before, spawn);
    if (before.digest !== after.digest || before.files.join('\0') !== after.files.join('\0')) throw Error('Grammar package or target selection inputs changed during the behavior probe.');
    result.execution = { engine: 'node-esm-import', node: process.version, permissions: permissionCapabilities(), vectorProfile: VECTOR_PROFILE,
      package: { name: before.package.name, version: before.package.version ?? null, root: slash(resolved.root), entry: slash(resolved.entry), selection: resolved.selection,
        inputDigest: before.digest, boundFiles: before.files.length, packageBytes: before.bytes, dependencyFiles: before.dependencyFiles,
        builtins: before.builtins, externalPackages: before.externalPackages }, vectors: { requiredRules: probe.ruleCount, presentationStates: probe.stateCount,
        invalidPresentationValues: INVALID_STATES.length + 1 } };
    for (const item of probe.violations) result.violations.push({ ruleId: GRAMMAR_GUARD_RULES[0], path: result.files[0], message: `Grammar guard vector failed: ${item.vector} (${item.reason}).` });
    result.checkedRuleIds = [...GRAMMAR_GUARD_RULES];
  } catch (error) { result.errors.push({ ruleId: GRAMMAR_GUARD_RULES[0], path: result.files[0] ?? null, message: String(error.message ?? error) }); }
  return result;
}
