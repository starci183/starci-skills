import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, isBuiltin } from 'node:module';
import { spawnSync } from 'node:child_process';
import { isInside, slash } from '../architecture/config.mjs';
import { loadTargetTypeScript } from '../architecture/typescript.mjs';
import { plain, repositoryPath } from './common.mjs';

export const NEST_METADATA_RULES = Object.freeze(['NEST_JEST_ALIAS_PARITY', 'NEST_TEST_DISCOVERY']);
const TEST = /(?:^|[./-])(?:spec|test)\.[cm]?[jt]sx?$/;
const ROOTS = ['src', 'apps', 'libs', 'packages', 'test', 'tests', 'testing-support'];
const JEST_TIMEOUT_MS = 25_000;
const JEST_MAX_BUFFER = 8 * 1024 * 1024;
const key = value => process.platform === 'win32' ? slash(path.resolve(value)).toLowerCase() : slash(path.resolve(value));

const safeFile = (root, relative) => repositoryPath(root, relative, 'Repository input');

function authoredFiles(root) {
  const files = [];
  const visit = directory => {
    let directoryStat;
    try { directoryStat = fs.lstatSync(directory); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw Error(`Authored source root is not a regular directory: ${slash(path.relative(root, directory))}`);
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.name === 'node_modules' || item.name === '.git') continue;
      const absolute = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw Error(`Authored source inventory contains a link: ${slash(path.relative(root, absolute))}`);
      if (item.isDirectory()) visit(absolute);
      else if (item.isFile() && /\.(?:[cm]?[jt]sx?|json)$/.test(item.name)) files.push(slash(path.relative(root, absolute)));
    }
  };
  for (const directory of ROOTS) visit(path.join(root, directory));
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    if ((/^(?:jest.*\.[cm]?[jt]s|tsconfig.*\.json|package(?:-lock)?\.json)$/.test(item.name)) && !item.isDirectory()) {
      safeFile(root, item.name);
      files.push(item.name);
    }
  }
  return [...new Set(files)].sort();
}

function testProjects(root, pkg) {
  const authored = pkg.starci?.codePatterns?.nest?.testProjects;
  if (authored === undefined) return [{ config: null, tsconfig: 'tsconfig.json', selectProjects: null }];
  if (!Array.isArray(authored) || !authored.length) throw Error('nest.testProjects must contain at least one runner/TypeScript binding.');
  const projects = authored.map(item => {
    if (!plain(item) || Object.keys(item).some(name => !['config', 'tsconfig', 'selectProjects'].includes(name))) throw Error('Invalid nest.testProjects entry.');
    if (item.config !== null) safeFile(root, item.config);
    safeFile(root, item.tsconfig);
    if (item.selectProjects !== undefined && (!Array.isArray(item.selectProjects) || !item.selectProjects.length
      || item.selectProjects.some(name => typeof name !== 'string' || !name.trim())
      || new Set(item.selectProjects).size !== item.selectProjects.length)) throw Error('selectProjects must contain unique nonempty Jest display names.');
    return { config: item.config, tsconfig: item.tsconfig, selectProjects: item.selectProjects ?? null };
  });
  if (new Set(projects.map(item => JSON.stringify(item))).size !== projects.length) throw Error('Duplicate Jest/TypeScript project binding.');
  return projects;
}

function localJest(root) {
  const require = createRequire(path.join(root, 'package.json'));
  const manifest = require.resolve('jest/package.json');
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.jest;
  if (pkg.name !== 'jest' || typeof pkg.version !== 'string' || typeof bin !== 'string') throw Error('Target Jest package has no valid CLI identity.');
  const resolved = path.resolve(path.dirname(manifest), bin);
  if (!isInside(path.dirname(manifest), resolved) || !fs.statSync(resolved).isFile()) throw Error('Target Jest CLI escapes its package.');
  return { version: pkg.version, resolved, manifest };
}

function sourceImports(ts, file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw Error(`Invalid configuration source syntax: ${file}`);
  const imports = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (!ts.isStringLiteralLike(node.moduleSpecifier)) throw Error('Configuration import is not statically resolved.');
      if (!(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)) imports.push(node.moduleSpecifier.text);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (!expression || !ts.isStringLiteralLike(expression)) throw Error(`Unresolved import-equals configuration dependency: ${file}`);
      imports.push(expression.text);
    }
    if (ts.isPropertyAssignment(node) && ['preset', 'resolver'].includes(node.name.getText(source).replace(/^['"]|['"]$/g, ''))) {
      if (ts.isStringLiteralLike(node.initializer)) imports.push(node.initializer.text.replace('<rootDir>/', './'));
      else if (node.initializer.kind !== ts.SyntaxKind.NullKeyword) throw Error(`Unresolved configuration preset/resolver in ${file}.`);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0])) throw Error(`Dynamic configuration dependency is unsupported: ${file}`);
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

/** Discover inputs before any config execution, so the parent can bind both sides of the measurement. */
export function discoverNestMetadataInputs({ root, files = [], contextFiles = [] } = {}) {
  const result = { files: [], toolFiles: [], specFiles: [], projects: [], errors: [] };
  try {
    root = fs.realpathSync(path.resolve(root));
    const pkgFile = safeFile(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const { ts, resolved } = loadTargetTypeScript(root);
    const jest = localJest(root);
    const authored = authoredFiles(root);
    const inputs = new Set(['package.json', ...authored, ...files, ...contextFiles]);
    const toolFiles = new Set([resolved, jest.resolved, jest.manifest]);
    const toolPackages = new Set();
    const addToolPackage = entry => {
      let directory = path.dirname(entry);
      while (path.dirname(directory) !== directory && !fs.existsSync(path.join(directory, 'package.json'))) directory = path.dirname(directory);
      if (!fs.existsSync(path.join(directory, 'package.json'))) { toolFiles.add(entry); return; }
      if (toolPackages.has(directory)) return;
      toolPackages.add(directory);
      const visit = current => {
        for (const item of fs.readdirSync(current, { withFileTypes: true })) {
          if (item.name === 'node_modules') continue;
          const absolute = path.join(current, item.name);
          if (item.isSymbolicLink()) throw Error(`Configuration tool package has an unsupported link: ${absolute}`);
          if (item.isDirectory()) visit(absolute);
          else if (item.isFile() && /\.(?:[cm]?[jt]s|json)$/.test(item.name)) toolFiles.add(absolute);
        }
      };
      visit(directory);
    };
    addToolPackage(resolved); addToolPackage(jest.resolved);
    const projects = testProjects(root, pkg);
    const addRead = absolute => {
      if (isInside(root, absolute) && !slash(absolute).includes('/node_modules/')) {
        const relative = slash(path.relative(root, absolute));
        safeFile(root, relative);
        inputs.add(relative);
      } else toolFiles.add(path.resolve(absolute));
      return fs.readFileSync(absolute, 'utf8');
    };
    for (const item of projects) {
      const absolute = safeFile(root, item.tsconfig);
      const read = ts.readConfigFile(absolute, addRead);
      if (read.error) throw Error(`Cannot parse ${item.tsconfig}.`);
      const parsed = ts.parseJsonConfigFileContent(read.config, { ...ts.sys, readFile: addRead }, path.dirname(absolute), undefined, absolute);
      const invalid = parsed.errors.filter(error => error.code !== 18003);
      if (invalid.length) throw Error(`Invalid TypeScript project ${item.tsconfig}: ${ts.flattenDiagnosticMessageText(invalid[0].messageText, '\n')}`);
      item.options = parsed.options;
      item.sourceFiles = parsed.fileNames.map(file => slash(path.relative(root, file)));
      if (item.config !== null) inputs.add(item.config);
    }
    const pending = [...inputs].filter(file => /(?:^|\/)jest[^/]*\.[cm]?[jt]s$/.test(file));
    for (const item of projects) if (item.config && !item.config.endsWith('.json')) pending.push(item.config);
    const seen = new Set();
    while (pending.length) {
      const relative = pending.pop();
      if (seen.has(relative)) continue;
      seen.add(relative);
      const absolute = safeFile(root, relative);
      inputs.add(relative);
      for (const specifier of sourceImports(ts, absolute, fs.readFileSync(absolute, 'utf8'))) {
        if (isBuiltin(specifier)) continue;
        const from = createRequire(absolute);
        let dependency;
        try { dependency = from.resolve(specifier); }
        catch {
          dependency = ts.resolveModuleName(specifier, absolute, projects[0].options, ts.sys).resolvedModule?.resolvedFileName;
        }
        if (!dependency || !path.isAbsolute(dependency)) throw Error(`Unresolved configuration import ${specifier} in ${relative}.`);
        if (isInside(root, dependency) && !slash(dependency).includes('/node_modules/')) {
          const local = slash(path.relative(root, dependency));
          safeFile(root, local);
          inputs.add(local);
          if (/\.[cm]?[jt]s$/.test(local)) pending.push(local);
        } else addToolPackage(dependency);
      }
    }
    for (const relative of inputs) safeFile(root, relative);
    result.files = [...inputs].sort();
    result.toolFiles = [...toolFiles].sort();
    result.specFiles = authored.filter(file => TEST.test(file));
    result.projects = projects;
  } catch (error) { result.errors.push({ message: String(error.message) }); }
  return result;
}

function fingerprint(root, discovered) {
  const hash = crypto.createHash('sha256');
  for (const file of [...discovered.files.map(file => path.resolve(root, file)), ...discovered.toolFiles].sort()) {
    hash.update(slash(file)); hash.update('\0'); hash.update(fs.readFileSync(file)); hash.update('\0');
  }
  return hash.digest('hex');
}

function runJest(root, tool, config, command, selectProjects = null) {
  const args = [tool.resolved, command, '--json', '--watch=false', '--watchAll=false', '--watchman=false'];
  if (command === '--listTests') args.push('--runInBand', '--cache=false');
  if (config) args.push('--config', path.resolve(root, config));
  if (selectProjects) args.push('--selectProjects', ...selectProjects);
  const ran = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', windowsHide: true, shell: false,
    timeout: JEST_TIMEOUT_MS, maxBuffer: JEST_MAX_BUFFER, env: { ...process.env, CI: 'true', FORCE_COLOR: '0' } });
  if (ran.error || ran.status !== 0) throw Error(`Jest ${command} unavailable (${ran.error?.code ?? ran.status ?? ran.signal}).`);
  try { return JSON.parse(ran.stdout); } catch { throw Error(`Jest ${command} returned invalid JSON.`); }
}

const regexAlias = alias => `^${alias.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*)')}$`;
function aliasRegexPattern(expression) {
  if (typeof expression !== 'string' || !expression.startsWith('^') || !expression.endsWith('$')) return null;
  const text = expression.slice(1, -1).replace('(.*)', '\u0000').replace(/\\([.*+?^${}()|[\]\\])/g, '$1');
  if (/[?+^${}()|[\]\\]/.test(text) || text.includes('*')) return null;
  return text.replace('\u0000', '*');
}
const matchesAlias = (pattern, sample) => new RegExp(regexAlias(pattern)).test(sample);
function aliasesOverlap(left, right) {
  if (!left.includes('*')) return matchesAlias(right, left);
  if (!right.includes('*')) return matchesAlias(left, right);
  const [lp, ls] = left.split('*'), [rp, rs] = right.split('*');
  return (lp.startsWith(rp) || rp.startsWith(lp)) && (ls.endsWith(rs) || rs.endsWith(ls));
}

function checkAliases(root, descriptor, config, result, relatedPath) {
  const add = message => result.violations.push({ ruleId: 'NEST_JEST_ALIAS_PARITY', message, relatedPath });
  const mappings = config.moduleNameMapper;
  if (config.resolver) throw Error('A custom Jest resolver needs its own verified alias-resolution adapter; mapper-only coverage is unavailable.');
  if (!Array.isArray(mappings) || mappings.some(item => !Array.isArray(item) || item.length !== 2)) throw Error('Normalized Jest moduleNameMapper is invalid.');
  const options = descriptor.options;
  const transforms = Array.isArray(config.transform) ? config.transform : [];
  for (const transform of transforms) {
    if (!Array.isArray(transform) || typeof transform[1] !== 'string' || !slash(transform[1]).includes('/ts-jest/')) continue;
    const selected = transform[2]?.tsconfig ?? config.globals?.['ts-jest']?.tsconfig;
    if (selected !== undefined && typeof selected !== 'string') throw Error('Inline or disabled ts-jest TypeScript config cannot prove project alias parity.');
    const actual = path.resolve(config.rootDir, selected ?? 'tsconfig.json');
    if (key(actual) !== key(path.resolve(root, descriptor.tsconfig))) add('The declared TypeScript project differs from the project used by ts-jest.');
  }
  const aliases = options.paths ?? {};
  const base = options.baseUrl ?? options.pathsBasePath ?? path.dirname(path.resolve(root, descriptor.tsconfig));
  for (const [alias, targets] of Object.entries(aliases)) {
    if ((alias.match(/\*/g) ?? []).length > 1 || !Array.isArray(targets) || !targets.length) throw Error(`Unsupported TypeScript alias ${alias}.`);
    const expression = regexAlias(alias);
    const index = mappings.findIndex(item => item[0] === expression);
    if (index < 0) { add(`Jest is missing the TypeScript alias ${alias}.`); continue; }
    const expected = targets.map(target => key(path.resolve(base, target.replace('*', '$1'))));
    const actual = (Array.isArray(mappings[index][1]) ? mappings[index][1] : [mappings[index][1]])
      .map(target => typeof target === 'string' ? key(path.resolve(config.rootDir, target.replaceAll('<rootDir>', config.rootDir))) : null);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) add(`Jest alias ${alias} does not preserve TypeScript target order and paths.`);
    for (let position = 0; position < index; position++) {
      const prior = aliasRegexPattern(mappings[position][0]);
      if (prior === null) throw Error(`Cannot prove alias precedence for mapper ${mappings[position][0]}. Use anchored exact or single-wildcard mapper forms.`);
      if (!aliasesOverlap(prior, alias)) continue;
      const priority = pattern => pattern.includes('*') ? pattern.indexOf('*') : Infinity;
      if (Object.hasOwn(aliases, prior) && priority(prior) > priority(alias)) continue;
      add(`Jest mapper ${mappings[position][0]} shadows TypeScript alias ${alias}.`);
    }
  }
}

/** Measure resolved runner configuration and discovery only; no test or setup hook is executed. */
export function checkNestMetadata({ root, files = [], ruleIds = [], contextFiles = [] } = {}) {
  const result = { schema: 'starci/code-pattern-script@1', repository: '', files: [], checkedRuleIds: [], requestedRuleIds: ruleIds,
    violations: [], errors: [], compiler: null, tools: [], inputFiles: [], discoveredTests: [], runnerConfigs: [], lifecycleEntries: [], inputs: null };
  try {
    root = fs.realpathSync(path.resolve(root)); result.repository = root;
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length
      || !Array.isArray(ruleIds) || !ruleIds.length || new Set(ruleIds).size !== ruleIds.length
      || ruleIds.some(id => !NEST_METADATA_RULES.includes(id))) throw Error('Explicit files and unique supported Nest metadata rules are required.');
    for (const file of files) safeFile(root, file);
    result.files = [...files].sort();
    const before = discoverNestMetadataInputs({ root, files, contextFiles });
    if (before.errors.length) throw Error(before.errors.map(error => error.message).join('; '));
    const beforeDigest = fingerprint(root, before);
    const compiler = loadTargetTypeScript(root); result.compiler = { version: compiler.version, resolved: compiler.resolved };
    const tool = localJest(root); result.tools.push({ name: 'jest', version: tool.version, resolved: tool.resolved });
    result.inputFiles = before.files;
    const configurations = new Map(), discovered = new Set(), accounted = new Map(), listings = [];
    for (const descriptor of before.projects) {
      const configKey = descriptor.config ?? '<root auto>';
      if (!configurations.has(configKey)) {
        const shown = runJest(root, tool, descriptor.config, '--showConfig');
        if (!plain(shown) || !Array.isArray(shown.configs) || !shown.configs.length
          || shown.configs.some(config => !plain(config) || typeof config.rootDir !== 'string' || !isInside(root, config.rootDir))) throw Error('Jest normalized project inventory is invalid or outside the repository.');
        configurations.set(configKey, shown.configs);
        accounted.set(configKey, new Set());
      }
      const all = configurations.get(configKey);
      const selected = descriptor.selectProjects ? all.filter(config => descriptor.selectProjects.includes(config.displayName?.name)) : all;
      if (!selected.length || (descriptor.selectProjects && selected.length !== descriptor.selectProjects.length)) throw Error('Jest project selection does not resolve unique display names.');
      for (const config of selected) {
        if (accounted.get(configKey).has(config)) throw Error('A normalized Jest project has multiple TypeScript bindings.');
        accounted.get(configKey).add(config);
        if (ruleIds.includes('NEST_JEST_ALIAS_PARITY')) checkAliases(root, descriptor, config, result, descriptor.config ?? 'package.json');
      }
      if (ruleIds.includes('NEST_TEST_DISCOVERY')) {
        const listed = runJest(root, tool, descriptor.config, '--listTests', descriptor.selectProjects);
        if (!Array.isArray(listed) || listed.some(file => typeof file !== 'string' || !path.isAbsolute(file) || !isInside(root, file))) throw Error('Jest test inventory is malformed or outside the repository.');
        for (const absolute of listed) {
          const relative = slash(path.relative(root, absolute));
          safeFile(root, relative);
          discovered.add(relative);
        }
        listings.push({ descriptor, files: [...listed].map(key).sort() });
      }
    }
    for (const [name, configs] of configurations) if (accounted.get(name).size !== configs.length) throw Error(`Some normalized Jest projects have no TypeScript binding: ${name}`);
    for (const [name, configs] of configurations) {
      const latest = runJest(root, tool, name === '<root auto>' ? null : name, '--showConfig');
      if (JSON.stringify(latest.configs) !== JSON.stringify(configs)) throw Error('Normalized Jest configuration changed during measurement.');
      for (const config of configs) for (const field of ['globalSetup', 'globalTeardown']) {
        if (!config[field]) continue;
        // Only source-bound local entries can grant a default-export exception. A
        // dependency-owned hook does not invalidate unrelated alias/discovery proof.
        if (typeof config[field] !== 'string' || !path.isAbsolute(config[field]) || !isInside(root, config[field])) continue;
        const relative = slash(path.relative(root, config[field]));
        if (!before.files.includes(relative)) continue;
        safeFile(root, relative);
        result.lifecycleEntries.push(relative);
      }
      result.runnerConfigs.push({ config: name, digest: crypto.createHash('sha256').update(JSON.stringify(configs)).digest('hex'),
        projects: configs.map(config => ({ rootDir: config.rootDir, name: config.displayName?.name ?? null })) });
    }
    for (const listing of listings) {
      const repeated = runJest(root, tool, listing.descriptor.config, '--listTests', listing.descriptor.selectProjects);
      if (!Array.isArray(repeated) || repeated.some(file => typeof file !== 'string' || !path.isAbsolute(file))
        || JSON.stringify([...repeated].map(key).sort()) !== JSON.stringify(listing.files)) throw Error('Jest test discovery changed during measurement.');
    }
    if (ruleIds.includes('NEST_TEST_DISCOVERY')) for (const file of before.specFiles) if (!discovered.has(file)) {
      result.violations.push({ ruleId: 'NEST_TEST_DISCOVERY', relatedPath: file,
        message: `Authored spec is not discoverable by any declared Jest lane: ${file}` });
    }
    result.discoveredTests = [...discovered].sort();
    result.lifecycleEntries = [...new Set(result.lifecycleEntries)].sort();
    const after = discoverNestMetadataInputs({ root, files, contextFiles });
    if (after.errors.length) throw Error('Metadata inputs became unavailable during measurement.');
    const afterDigest = fingerprint(root, after);
    result.inputs = { before: beforeDigest, after: afterDigest, stable: beforeDigest === afterDigest };
    if (!result.inputs.stable) throw Error('Metadata/source/tool inputs changed during measurement.');
    result.checkedRuleIds = [...ruleIds].sort();
  } catch (error) { result.errors.push({ message: String(error.message) }); }
  return result;
}
