import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTargetTypeScript } from '../architecture/typescript.mjs';

export const GRAMMAR_GUARD_RULES = Object.freeze(['FE_GRAMMAR_GUARD_BEHAVIOR']);
const CONTRACT_SCHEMA = 'starci/grammar-guard-contract@1';
const VECTOR_PROFILE = 'starci/grammar-guards-v1';
const RESULT_SCHEMA = 'starci/grammar-guard-probe@1';
const MAX_FILES = 2048;
const MAX_BYTES = 32 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slash = value => value.replaceAll('\\', '/');

function exact(value, keys, label) {
  if (!plain(value) || Object.keys(value).some(key => !keys.includes(key))) throw Error(`${label} has an invalid shape.`);
}

function safeRelative(value, { allowDot = false } = {}) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)
    || value !== path.posix.normalize(value) || value.split('/').includes('..') || (!allowDot && value === '.')) throw Error('Expected a normalized repository-relative path.');
  return value;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function regular(root, relative) {
  safeRelative(relative);
  const absolute = path.resolve(root, relative);
  for (let cursor = absolute; cursor !== root; cursor = path.dirname(cursor)) {
    if (!inside(root, cursor)) throw Error(`Input escapes the target repository: ${relative}`);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw Error(`Input redirects through a link: ${relative}`);
  }
  if (!fs.lstatSync(absolute).isFile()) throw Error(`Input is not a regular file: ${relative}`);
  return absolute;
}

function readContract(root) {
  const file = regular(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const value = pkg.starci?.codePatterns?.next?.grammarGuards;
  exact(value, ['schema', 'package', 'entry', 'source', 'vectorProfile'], 'Grammar guard contract');
  if (value.schema !== CONTRACT_SCHEMA || value.vectorProfile !== VECTOR_PROFILE
    || typeof value.package !== 'string' || !/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(value.package)
    || typeof value.entry !== 'string' || !/^\.\/[a-z0-9][a-z0-9._/-]*$/i.test(value.entry)) throw Error('Grammar guard contract needs the supported schema, package, public subpath and vector profile.');
  exact(value.source, value.source?.kind === 'repository' ? ['kind', 'root'] : ['kind'], 'Grammar guard package source');
  if (!['installed', 'repository'].includes(value.source.kind)) throw Error('Grammar guard package source must be installed or repository.');
  if (value.source.kind === 'repository') safeRelative(value.source.root, { allowDot: true });
  return { pkg, value };
}

function runNode(spawn, args, cwd, timeout = TIMEOUT_MS) {
  const env = { FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' };
  for (const name of ['SYSTEMROOT', 'WINDIR', 'ComSpec', 'TEMP', 'TMP']) if (typeof process.env[name] === 'string') env[name] = process.env[name];
  return spawn(process.execPath, ['--permission', '--allow-fs-read=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    env,
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
  if (!inside(root, declared)) throw Error('Repository Grammar root escapes the target repository.');
  const packageRoot = fs.realpathSync(declared);
  if (!fs.lstatSync(packageRoot).isDirectory()) throw Error('Repository Grammar root is not a directory.');
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  if (pkg.name !== contract.package) throw Error('Repository Grammar package identity does not match the contract.');
  const standalone = packageRoot === root;
  const selected = resolvePublicEntry(root, specifier, spawn);
  if (!inside(packageRoot, selected)) throw Error('Consumer resolves a stale or different Grammar package than the declared repository provider.');
  return { root: packageRoot, entry: selected, selection: standalone ? 'standalone-import' : 'consumer-import' };
}

function staticRelativeDependencies(ts, packageRoot, entry, inventoryFiles, packageType) {
  const inventory = new Set(inventoryFiles.map(([, file]) => path.resolve(file)));
  const visited = new Set();
  const pending = [entry];
  const resolve = (source, specifier) => {
    const base = path.resolve(path.dirname(source), specifier);
    const candidates = [base, ...['.js', '.mjs', '.cjs', '.json'].map(extension => `${base}${extension}`),
      ...['index.js', 'index.mjs', 'index.cjs', 'index.json'].map(name => path.join(base, name))];
    const found = candidates.find(candidate => fs.existsSync(candidate) && fs.lstatSync(candidate).isFile());
    if (!found) throw Error(`Grammar public entry has an unresolved relative dependency: ${specifier}`);
    const canonical = fs.realpathSync(found);
    if (!inside(packageRoot, canonical)) throw Error('Grammar public entry dependency escapes its canonical package root.');
    if (!inventory.has(path.resolve(canonical))) throw Error(`Grammar public entry dependency is outside the bound package inventory: ${slash(path.relative(packageRoot, canonical))}`);
    return canonical;
  };
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file) || !/\.[cm]?[jt]sx?$/i.test(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = node => {
      let literal = null;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) literal = node.moduleSpecifier;
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
        && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) literal = node.moduleReference.expression;
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (![1, 2].includes(node.arguments.length) || !ts.isStringLiteralLike(node.arguments[0])) throw Error('Grammar public entry has an unresolved dynamic import.');
        literal = node.arguments[0];
      } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
        && (file.toLowerCase().endsWith('.cjs') || (file.toLowerCase().endsWith('.js') && packageType !== 'module'))) {
        if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0])) throw Error('Grammar public entry has an unresolved dynamic require.');
        literal = node.arguments[0];
      }
      if (literal?.text.startsWith('.')) pending.push(resolve(file, literal.text));
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...visited].map(file => slash(path.relative(packageRoot, file))).sort();
}

function packageInputs(ts, packageRoot, sourceKind, entry) {
  const manifest = path.join(packageRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (!Array.isArray(pkg.files) || !pkg.files.length || pkg.files.some(value => typeof value !== 'string' || !value || /[*?{}]/.test(value)
    || path.isAbsolute(value) || value.includes('\\') || value.split('/').includes('..'))) throw Error('Grammar package files must be an explicit bounded package inventory.');
  const roots = new Set([manifest, entry]);
  for (const value of pkg.files) {
    const absolute = path.resolve(packageRoot, value);
    if (inside(packageRoot, absolute) && fs.existsSync(absolute)) roots.add(absolute);
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
    if (!inside(packageRoot, canonical)) throw Error('Grammar package input escapes its canonical root.');
    const relative = slash(path.relative(packageRoot, canonical));
    if (!files.has(relative)) { files.set(relative, canonical); bytes += stat.size; }
    if (files.size > MAX_FILES || bytes > MAX_BYTES) throw Error('Grammar package identity exceeds the bounded input ceiling.');
  };
  for (const absolute of roots) visit(absolute);
  const sorted = [...files].sort(([a], [b]) => a.localeCompare(b));
  return { pkg, files: sorted, bytes, dependencyFiles: staticRelativeDependencies(ts, packageRoot, entry, sorted, pkg.type) };
}

function targetInputs(root) {
  const names = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock'];
  const files = names.filter(name => fs.existsSync(path.join(root, name))).map(name => [name, regular(root, name)]);
  if (files.length < 2) throw Error('Target Grammar selection needs a dependency lock beside package.json.');
  return files;
}

function identity(ts, root, resolved) {
  const inventory = packageInputs(ts, resolved.root, resolved.sourceKind, resolved.entry);
  const hash = crypto.createHash('sha256');
  const files = [...targetInputs(root).map(([name, file]) => [`target:${name}`, file]),
    ...inventory.files.map(([name, file]) => [`grammar:${name}`, file])].sort(([a], [b]) => a.localeCompare(b));
  for (const [name, file] of files) {
    hash.update(name); hash.update(Buffer.from([0])); hash.update(fs.readFileSync(file)); hash.update(Buffer.from([0]));
  }
  return { digest: hash.digest('hex'), files: files.map(([name]) => name), package: inventory.pkg, bytes: inventory.bytes,
    dependencyFiles: inventory.dependencyFiles };
}

function permissionCapabilities() {
  const networkDenied = process.allowedNodeEnvironmentFlags?.has?.('--allow-net') === true;
  return { model: 'node-permission', trust: 'selected-package-is-trusted', filesystemRead: 'all', filesystemWrite: 'denied',
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
    ||rules.length>512||!Array.isArray(states)||!states.length||states.length>128||new Set(states).size!==states.length||states.some(x=>typeof x!=='string'||!x)) throw Error('public-contract-unavailable');
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
  for(const [name,value] of [['sentinel',unknownState],['empty',''],['null',null],['number',0],['object',{}],['array',[]]]) {
    try { assertState(value); fail('presentation-invalid:'+name,'accepted-invalid'); }
    catch(error) { if(!typeError(error)) fail('presentation-invalid:'+name,'wrong-error-class'); }
  }
  process.stdout.write(JSON.stringify({schema,ok:violations.length===0,ruleCount:rules.length,stateCount:states.length,violations}));
} catch(error) {
  process.stdout.write(JSON.stringify({schema,ok:false,unavailable:'public-entry-or-contract'}));
}`;

function executeProbe(resolved, spawn) {
  const result = runNode(spawn, ['--input-type=module', '-e', PROBE, resolved.entry], resolved.root);
  if (result.error || result.status !== 0 || result.signal || result.stderr || typeof result.stdout !== 'string') throw Error('Grammar guard behavior probe did not complete cleanly within its bound.');
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { throw Error('Grammar guard behavior probe returned malformed output.'); }
  if (!plain(parsed) || parsed.schema !== RESULT_SCHEMA || typeof parsed.ok !== 'boolean' || (parsed.unavailable === undefined
    && (!Number.isInteger(parsed.ruleCount) || parsed.ruleCount < 1 || parsed.ruleCount > 512 || !Number.isInteger(parsed.stateCount) || parsed.stateCount < 1 || parsed.stateCount > 128 || !Array.isArray(parsed.violations)))) throw Error('Grammar guard behavior probe result is invalid.');
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
    for (const file of files) regular(root, file);
    result.files = [...files].sort();
    const loaded = loadTargetTypeScript(root); result.compiler = { version: loaded.version, resolved: loaded.resolved };
    const { value: contract } = readContract(root);
    if (!contextFiles.includes('package.json') && !files.includes('package.json')) throw Error('Target package contract is outside the bound input context.');
    const resolved = resolvePackage(root, contract, spawn); resolved.sourceKind = contract.source.kind;
    if (contract.source.kind === 'repository') {
      const providerManifest = slash(path.relative(root, path.join(resolved.root, 'package.json')));
      if (inside(root, resolved.root) && !contextFiles.includes(providerManifest) && !files.includes(providerManifest)) throw Error('Repository Grammar package is outside the bound input context.');
    }
    const before = identity(loaded.ts, root, resolved), probe = executeProbe(resolved, spawn), reselected = resolvePackage(root, contract, spawn);
    reselected.sourceKind = contract.source.kind;
    if (reselected.root !== resolved.root || reselected.entry !== resolved.entry || reselected.selection !== resolved.selection) throw Error('The consumer Grammar package selection changed during the behavior probe.');
    const after = identity(loaded.ts, root, reselected);
    if (before.digest !== after.digest || before.files.join('\0') !== after.files.join('\0')) throw Error('Grammar package or target selection inputs changed during the behavior probe.');
    result.execution = { engine: 'node-esm-import', node: process.version, permissions: permissionCapabilities(), vectorProfile: VECTOR_PROFILE,
      package: { name: before.package.name, version: before.package.version ?? null, root: slash(resolved.root), entry: slash(resolved.entry), selection: resolved.selection,
        inputDigest: before.digest, boundFiles: before.files.length, packageBytes: before.bytes, dependencyFiles: before.dependencyFiles }, vectors: { requiredRules: probe.ruleCount, presentationStates: probe.stateCount,
        invalidPresentationValues: 6 } };
    for (const item of probe.violations) result.violations.push({ ruleId: GRAMMAR_GUARD_RULES[0], path: result.files[0], message: `Grammar guard vector failed: ${item.vector} (${item.reason}).` });
    result.checkedRuleIds = [...GRAMMAR_GUARD_RULES];
  } catch (error) { result.errors.push({ ruleId: GRAMMAR_GUARD_RULES[0], path: result.files[0] ?? null, message: String(error.message ?? error) }); }
  return result;
}
