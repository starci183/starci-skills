#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SCHEMA_VERSION = 1;
const GENERATOR_VERSION = '6.2.1';
const ownPath = fileURLToPath(import.meta.url);
const sha = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const toPosix = (value) => value.replaceAll('\\', '/');

function parseArgs(argv) {
  const result = { check: false, stdout: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--check') result.check = true;
    else if (token === '--stdout') result.stdout = true;
    else if (token.startsWith('--')) result[token.slice(2)] = argv[++index];
    else throw new Error(`unexpected argument: ${token}`);
  }
  if (!result.project || !/^[a-z0-9][a-z0-9-]*$/.test(result.project)) throw new Error('--project must be a kebab-case project id');
  if (!result.source) throw new Error('--source is required');
  return result;
}

function git(sourceRoot, args, fallback = null) {
  try {
    return execFileSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    if (fallback !== null) return fallback;
    throw new Error(`cannot resolve git ${args.join(' ')} for ${sourceRoot}`);
  }
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', 'dist', 'build', 'coverage'].includes(entry.name)) return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function atomicJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function jsDoc(checker, node) {
  const symbol = node.name ? checker.getSymbolAtLocation(node.name) : null;
  return symbol ? ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim() : '';
}

function typeText(checker, type, node) {
  return checker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
}

function propsFor(checker, declaration) {
  let propsType = null;
  if (ts.isFunctionDeclaration(declaration) && declaration.parameters[0]) propsType = checker.getTypeAtLocation(declaration.parameters[0]);
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    if ((ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) && declaration.initializer.parameters[0]) {
      propsType = checker.getTypeAtLocation(declaration.initializer.parameters[0]);
    } else {
      const signature = checker.getSignaturesOfType(checker.getTypeAtLocation(declaration.initializer), ts.SignatureKind.Call)[0];
      if (signature?.parameters[0]) propsType = checker.getTypeOfSymbolAtLocation(signature.parameters[0], declaration.initializer);
    }
  }
  if (!propsType) return { type: null, fields: {} };
  const fields = {};
  for (const property of checker.getPropertiesOfType(propsType)) {
    const source = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
    fields[property.name] = {
      required: !(property.flags & ts.SymbolFlags.Optional),
      type: typeText(checker, checker.getTypeOfSymbolAtLocation(property, source), source),
      description: ts.displayPartsToString(property.getDocumentationComment(checker)).trim()
    };
  }
  return { type: typeText(checker, propsType, declaration), fields };
}

function exportedDeclarations(sourceFile) {
  const declarations = [];
  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (exported && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) declarations.push(statement);
    if (exported && ts.isVariableStatement(statement)) declarations.push(...statement.declarationList.declarations.filter((item) => item.name && ts.isIdentifier(item.name)));
  }
  return declarations;
}

function inferLayer(relative) {
  const segments = toPosix(relative).split('/');
  const index = segments.indexOf('components');
  return index >= 0 ? (segments[index + 1] ?? 'common') : 'common';
}

function contractSignals(sourceText) {
  const signals = new Set();
  for (const match of sourceText.matchAll(/\b([A-Z][A-Z0-9_]*(?:CONTRACT|PRINCIPLE)[A-Z0-9_]*)\b/g)) signals.add(match[1]);
  for (const match of sourceText.matchAll(/data-(?:principle|contract|state)=["'{]([^"'}]+)/g)) signals.add(match[1]);
  return [...signals].sort();
}

export function buildSnapshot({ project, sourceRoot, config = {} }) {
  const root = path.resolve(sourceRoot);
  const componentRoot = path.join(root, config.componentRoot ?? 'src/components');
  const sourceFiles = walk(componentRoot).filter((file) => /\.(?:ts|tsx)$/.test(file) && !/\.(?:spec|test|stories)\.(?:ts|tsx)$/.test(file)).sort();
  if (sourceFiles.length === 0) throw new Error(`no TypeScript components found under ${componentRoot}`);

  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
  const parsedConfig = configPath
    ? ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, root)
    : { options: {} };
  const program = ts.createProgram(sourceFiles, {
    ...parsedConfig.options,
    allowJs: false,
    jsx: parsedConfig.options.jsx ?? ts.JsxEmit.Preserve,
    module: parsedConfig.options.module ?? ts.ModuleKind.ESNext,
    moduleResolution: parsedConfig.options.moduleResolution ?? ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: parsedConfig.options.target ?? ts.ScriptTarget.ES2022
  });
  const checker = program.getTypeChecker();
  const components = [];
  const registries = [];
  const sourceHashes = [];

  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    const text = fs.readFileSync(file, 'utf8');
    const sourceSha256 = sha(text);
    sourceHashes.push([relative, sourceSha256]);
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;
    const fileSignals = contractSignals(text);

    for (const declaration of exportedDeclarations(sourceFile)) {
      const name = declaration.name?.text;
      if (!name) continue;
      if (/CONTRACT|PRINCIPLE/.test(name.toUpperCase())) {
        registries.push({ name, source: relative, sourceSha256, description: jsDoc(checker, declaration) });
        continue;
      }
      if (!/^[A-Z]/.test(name)) continue;
      const props = propsFor(checker, declaration);
      components.push({
        name,
        layer: inferLayer(relative),
        description: jsDoc(checker, declaration),
        source: relative,
        sourceSha256,
        props,
        contracts: fileSignals,
        exports: { kind: ts.SyntaxKind[declaration.kind] }
      });
    }
  }

  components.sort((left, right) => left.name.localeCompare(right.name) || left.source.localeCompare(right.source));
  registries.sort((left, right) => left.name.localeCompare(right.name));
  const headCommit = git(root, ['rev-parse', 'HEAD']);
  const branch = git(root, ['branch', '--show-current'], 'detached');
  const remote = git(root, ['config', '--get', 'remote.origin.url'], 'local');
  const dirtyEntries = git(root, ['status', '--porcelain=v1', '--untracked-files=no'], '').split(/\r?\n/).filter(Boolean);
  const exporterSha256 = sha(fs.readFileSync(ownPath));
  const configSha256 = sha(JSON.stringify({ componentRoot: config.componentRoot ?? 'src/components' }));
  const inputSha256 = sha(JSON.stringify({ sourceHashes, headCommit, exporterSha256, configSha256, schemaVersion: SCHEMA_VERSION }));

  return {
    schemaVersion: SCHEMA_VERSION,
    project,
    kind: 'frontend-coding-context',
    source: { repository: remote, root, branch, headCommit, dirty: dirtyEntries.length > 0 },
    generation: { id: inputSha256.slice(7, 23), inputSha256, exporterSha256, generatorVersion: GENERATOR_VERSION, configSha256 },
    statistics: { files: sourceFiles.length, components: components.length, contractRegistries: registries.length },
    components,
    contractRegistries: registries
  };
}

export function publishSnapshot({ snapshot, outputRoot, check = false }) {
  const cacheRoot = path.join(path.resolve(outputRoot), '.worktrees', snapshot.project, 'coding-context', 'frontend');
  const currentPath = path.join(cacheRoot, 'current.json');
  const current = readJson(currentPath);
  const generationPath = path.join(cacheRoot, 'generations', snapshot.generation.id, 'components.json');
  if (current?.generation?.inputSha256 === snapshot.generation.inputSha256 && fs.existsSync(generationPath)) {
    return { action: 'reused', currentPath, generationPath, snapshotSha256: current.snapshotSha256, generation: snapshot.generation };
  }
  if (check) return { action: 'stale', currentPath, generationPath, snapshotSha256: sha(JSON.stringify(snapshot)), generation: snapshot.generation };
  const snapshotSha256 = sha(JSON.stringify(snapshot));
  atomicJson(generationPath, snapshot);
  atomicJson(currentPath, {
    schemaVersion: SCHEMA_VERSION,
    project: snapshot.project,
    kind: snapshot.kind,
    generation: snapshot.generation,
    generationPath: toPosix(path.relative(path.resolve(outputRoot), generationPath)),
    snapshotSha256
  });
  return { action: current ? 'replaced' : 'created', currentPath, generationPath, snapshotSha256, generation: snapshot.generation };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = buildSnapshot({ project: args.project, sourceRoot: args.source, config: { componentRoot: args['component-root'] } });
  if (args.stdout) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }
  const outputRoot = args['output-root'] ?? path.resolve(path.dirname(ownPath), '..', '..');
  const result = publishSnapshot({ snapshot, outputRoot, check: args.check });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (args.check && result.action === 'stale') process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ownPath)) await main();
