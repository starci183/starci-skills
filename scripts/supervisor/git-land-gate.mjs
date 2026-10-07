// git-land-gate.mjs — the changed-code import, eslint and scoped-tsc gate.
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { diff as diffCall } from '../api/git/diff.mjs';
import { mergeBase as mergeBaseCall } from '../api/git/merge-base.mjs';
import { runNode as runNodeCall } from '../api/node/run-node.mjs';
import { readEnv } from '../lib/env.mjs';
import { primaryWorktreeOf as primaryWorktreeOfCall } from './git-land-repo.mjs';
import { compareTypeErrors, projectOf } from './git-land-gate-tsc.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

const CODE = /\.(ts|tsx|mts|mjs|js)$/;
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const TEMPLATE = (file) => file.startsWith('packages/hfs/templates/');
const slash = (p) => p.replaceAll(String.fromCodePoint(92), '/');

const quotedCharacter = (c, next) => {
  if (c === '\\') return { next: next ?? '', skip: 1, close: false };
  if (c === '"') return { next: '', skip: 0, close: true };
  return { next: '', skip: 0, close: false };
};
const lineCommentEnd = (text, index) => {
  const end = text.indexOf('\n', index);
  return end < 0 ? text.length : end;
};
const blockCommentEnd = (text, index) => {
  index += 2;
  while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) { index += 1; }
  return index + 1;
};

const stripJsonc = (text) => {
  let out = '', quoted = false;
  let i = 0;
  while (i < text.length) {
    const at = i++;
    const c = text[at], next = text[at + 1];
    if (quoted) {
      out += c;
      const result = quotedCharacter(c, next);
      out += result.next;
      i += result.skip;
      quoted = !result.close;
      continue;
    }
    if (c === '"') { quoted = true; out += c; continue; }
    if (c === '/' && next === '/') { i = lineCommentEnd(text, at) + 1; out += '\n'; continue; }
    if (c === '/' && next === '*') { i = blockCommentEnd(text, at) + 1; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
};
const readJson = (file) => { try { return JSON.parse(stripJsonc(fs.readFileSync(file, 'utf8'))); } catch { return {}; } };

const inheritedConfigPath = (worktree, dir, entry) => {
  if (entry.startsWith('.')) return path.resolve(dir, entry);
  const moduleConfig = entry.endsWith('.json') ? entry : path.join(entry, 'tsconfig.json');
  return path.join(worktree, 'node_modules', moduleConfig);
};
const resolveConfig = (worktree, file, seen = new Set()) => {
  if (seen.has(file) || !fs.existsSync(file)) return {};
  seen.add(file);
  const json = readJson(file), dir = path.dirname(file);
  let merged = {};
  for (const entry of [json.extends ?? []].flat().filter(Boolean)) {
    const candidate = inheritedConfigPath(worktree, dir, entry);
    merged = { ...merged, ...resolveConfig(worktree, candidate.endsWith('.json') ? candidate : `${candidate}.json`, seen) };
  }
  const own = json.compilerOptions ?? {};
  if (own.baseUrl !== undefined) merged.baseUrl = path.resolve(dir, own.baseUrl);
  if (own.paths) { merged.paths = own.paths; merged.pathsDir = dir; }
  return merged;
};
const aliasesOf = (worktree, project) => {
  const config = resolveConfig(worktree, path.join(worktree, project));
  const baseUrl = config.baseUrl ?? config.pathsDir ?? path.join(worktree, path.dirname(project));
  return Object.entries(config.paths ?? {}).map(([pattern, targets]) => ({ pattern, targets, baseUrl }));
};

const extensions = ['', '.ts', '.tsx', '.mts', '.mjs', '.js', '.json', '/index.ts', '/index.tsx', '/index.mjs', '/index.js'];
const existsModule = (target) => extensions.some((ext) => { try { return fs.statSync(target + ext).isFile(); } catch { return false; } });
const packageResolves = (worktree, file, pkg) => {
  let dir = path.dirname(path.join(worktree, file)), manifestChecked = false;
  while (dir.startsWith(worktree)) {
    const types = path.join('@types', pkg.startsWith('@') ? pkg.slice(1).replace('/', '__') : pkg);
    if (fs.existsSync(path.join(dir, 'node_modules', pkg)) || fs.existsSync(path.join(dir, 'node_modules', types))) return true;
    const manifest = path.join(dir, 'package.json');
    if (!manifestChecked && fs.existsSync(manifest)) {
      manifestChecked = true;
      const json = readJson(manifest);
      if ([json.dependencies, json.peerDependencies, json.devDependencies, json.optionalDependencies].some((deps) => deps && pkg in deps) || json.name === pkg) return true;
    }
    if (dir === worktree) break;
    dir = path.dirname(dir);
  }
  return false;
};
const binIntoBuildOutput = (worktree, file, specifier) => {
  let dir = path.dirname(path.join(worktree, file));
  while (dir.startsWith(worktree) && !fs.existsSync(path.join(dir, 'package.json'))) dir = path.dirname(dir);
  const pkg = readJson(path.join(dir, 'package.json'));
  const bins = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin ?? {});
  const own = slash(path.relative(dir, path.join(worktree, file)));
  if (!bins.some((bin) => bin.replace(/^\.\//, '') === own) || !/\bnpm run build\b|\btsc\b/.test(pkg.scripts?.prepack ?? '')) return false;
  const outDir = readJson(path.join(dir, 'tsconfig.json'))?.compilerOptions?.outDir;
  if (!outDir) return false;
  return !path.relative(path.resolve(dir, outDir), path.resolve(path.dirname(path.join(worktree, file)), specifier)).startsWith('..');
};

// Built from named parts: the import/export statement head, the lazy clause before `from`, and the quoted specifier.
const IMPORT_STATEMENT = new RegExp([String.raw`^\s*(?:import|export)\s`, '[^\'";]*?', String.raw`from\s*['"]([^'"]+)['"]`].join(''), 'gm');
// A relative specifier's query or fragment tail.
const SPECIFIER_TAIL = new RegExp(['[?#]', '.*', '$'].join(''));

const importSpecifiers = (worktree, text) => {
  try {
    const ts = createRequire(path.join(worktree, 'package.json'))('typescript');
    return ts.preProcessFile(text, true, true).importedFiles.map((entry) => entry.fileName);
  } catch {
    return [...text.matchAll(IMPORT_STATEMENT)].map((match) => match[1]);
  }
};

/** Import-resolution findings for changed executable source files. */
function importProblemFor(worktree, file, aliases, specifier) {
  if (BUILTINS.has(specifier)) return null;
  if (specifier.startsWith('.')) {
    const bare = specifier.replace(SPECIFIER_TAIL, '');
    const target = path.join(worktree, path.dirname(file), bare).replace(/\.js$/, '');
    if (!existsModule(target) && !binIntoBuildOutput(worktree, file, bare)) return `import: ${file} -> '${specifier}' does not resolve`;
    return null;
  }
  const alias = aliases.find(({ pattern }) => {
    if (pattern.endsWith('/*')) return specifier.startsWith(pattern.slice(0, -1));
    return specifier === pattern;
  });
  if (alias) {
    const rest = alias.pattern.endsWith('/*') ? specifier.slice(alias.pattern.length - 1) : '';
    if (!alias.targets.some((target) => existsModule(path.join(alias.baseUrl, target.replace('*', rest))))) return `import: ${file} -> '${specifier}' does not resolve`;
    return null;
  }
  const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (!packageResolves(worktree, file, pkg)) return `import: ${file} -> package '${pkg}' is neither installed nor declared`;
  return null;
}

function importProblems(worktree, code) {
  const problems = [];
  for (const file of code.filter((name) => !TEMPLATE(name))) {
    const text = fs.readFileSync(path.join(worktree, file), 'utf8');
    const project = projectOf(worktree, file), aliases = project ? aliasesOf(worktree, project) : [];
    for (const specifier of importSpecifiers(worktree, text)) {
      const problem = importProblemFor(worktree, file, aliases, specifier);
      if (problem) problems.push(problem);
    }
  }
  return problems;
}

const eslintCounts = (root, files, runNode, env) => {
  const bin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!fs.existsSync(bin)) return { skipped: true, counts: new Map(), messages: [] };
  const results = [];
  for (let i = 0; i < files.length; i += 80) {
    const chunk = files.slice(i, i + 80).filter((file) => fs.existsSync(path.join(root, file)));
    if (!chunk.length) continue;
    const r = runNode([bin, '--format', 'json', ...chunk], { cwd: root, encoding: 'utf8', timeout: 600_000, maxBuffer: 256 * 1024 * 1024, env });
    try { results.push(...JSON.parse(String(r.stdout || '[]'))); } catch { return { error: String(r.stderr ?? r.error?.message ?? '').slice(-300) || 'eslint output was not JSON' }; }
  }
  const counts = new Map(), messages = [];
  for (const result of results) for (const item of result.messages.filter((message) => message.severity === 2)) {
    const rel = slash(path.relative(root, result.filePath)), key = `${rel}|${item.ruleId ?? 'parse'}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    messages.push({ key, text: `${rel}:${item.line} ${item.ruleId ?? 'parse'} ${item.message.slice(0, 120)}` });
  }
  return { counts, messages };
};

/** Eslint errors the candidate adds over the same files on local main. */
function eslintProblems({ worktree, primary, code, runNode = runNodeCall, env = process.env }) {
  const files = code.filter((file) => /\.(ts|tsx|mts)$/.test(file));
  if (!files.length) return [];
  const lane = eslintCounts(worktree, files, runNode, env);
  if (lane.error) return [`eslint: could not run (${lane.error})`];
  const main = eslintCounts(primary, files, runNode, env);
  const grown = new Set([...lane.counts].filter(([key, count]) => count > (main.counts?.get(key) ?? 0)).map(([key]) => key));
  return lane.messages.filter((message) => grown.has(message.key)).slice(0, 60).map((message) => `eslint: ${message.text}`);
}

/** The complete land gate. Returns {ok, problems, changed, code, projects, base}. */
export function runLandGate({ worktree, ref, baseRef = 'main' }, deps = {}) {
  const mergeBase = deps.mergeBase ?? mergeBaseCall, diff = deps.diff ?? diffCall;
  const base = mergeBase(worktree, baseRef, ref, { git: deps.git ?? null });
  if (!base) return { ok: false, problems: [`git: ${baseRef} and ${ref} have no merge base`], changed: [], code: [], projects: [], base: null };
  const changedRun = diff(['--name-only', '--diff-filter=ACMR', `${base}..${ref}`], { cwd: worktree });
  if (changedRun?.error || changedRun?.status !== 0) return { ok: false, problems: [`git: changed files could not be read (${String(changedRun?.stderr ?? changedRun?.error?.message ?? '').trim()})`], changed: [], code: [], projects: [], base };
  const changed = String(changedRun.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const code = changed.filter((file) => CODE.test(file) && !file.endsWith('.d.ts') && fs.existsSync(path.join(worktree, file)));
  if (!code.length) return { ok: true, problems: [], changed, code, projects: [], base };
  const primaryResult = (deps.primaryWorktreeOf ?? primaryWorktreeOfCall)(worktree, deps);
  if (!primaryResult.ok) return { ok: false, problems: [`git: ${primaryResult.detail}`], changed, code, projects: [], base };
  const sourceEnv = deps.env ?? process.env;
  const env = { ...sourceEnv, SWC_NATIVE_BINDING_CACHE: readEnv('SWC_NATIVE_BINDING_CACHE', sourceEnv) ?? path.join(tempRoot(), 'starci-swc-cache') };
  fs.mkdirSync(env.SWC_NATIVE_BINDING_CACHE, { recursive: true });
  const imports = importProblems(worktree, code);
  const eslint = eslintProblems({ worktree, primary: primaryResult.primary, code, runNode: deps.runNode ?? runNodeCall, env });
  const typed = compareTypeErrors({ worktree, primary: primaryResult.primary, code, deps: { ...deps, env } });
  const problems = [...imports, ...eslint, ...typed.problems];
  return { ok: problems.length === 0, problems, changed, code, projects: typed.projects, base };
}
