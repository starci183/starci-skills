// git-land-gate-tsc.mjs — scoped, app-bounded TypeScript comparison for the `git land` candidate and local main.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runNpm as runNpmCall } from '../api/npm/run-npm.mjs';
import { runNpx as runNpxCall } from '../api/npm/run-npx.mjs';

const slash = (p) => path.resolve(p).replaceAll(String.fromCodePoint(92), '/').toLowerCase();

/** The nearest tsconfig owning a changed file, relative to root. */
export function projectOf(root, file) {
  let dir = path.dirname(path.join(root, file));
  while (dir.startsWith(root)) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(candidate)) return path.relative(root, candidate).replaceAll(String.fromCodePoint(92), '/');
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return null;
}

/** The nearest app boundary: a directory with package-lock.json, else the checkout root. */
function appRootOf(root, project) {
  for (let dir = path.dirname(path.join(root, project)); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return dir;
    if (path.resolve(dir) === path.resolve(root) || path.dirname(dir) === dir) return path.resolve(root);
  }
}

const modulesChain = (root, project) => {
  const found = [], bound = path.resolve(appRootOf(root, project));
  for (let dir = path.dirname(path.join(root, project)); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'node_modules'))) found.push(path.relative(root, dir).replaceAll(String.fromCodePoint(92), '/') || '.');
    if (path.resolve(dir) === bound || path.dirname(dir) === dir) break;
  }
  return found;
};

/** Generate ignored front-end inputs before measuring the candidate, as the external gate did. */
function prepareFrontendProjects(root, projects, deps = {}) {
  const runNpm = deps.runNpm ?? runNpmCall, runNpx = deps.runNpx ?? runNpxCall;
  const prepared = new Set();
  for (const project of projects) {
    const appRoot = appRootOf(root, project);
    if (prepared.has(appRoot) || !path.relative(appRoot, path.join(root, project)).replaceAll(String.fromCodePoint(92), '/').startsWith('fe/')) continue;
    prepared.add(appRoot);
    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')); } catch { /* tsc reports unreadable projects */ }
    const options = { cwd: appRoot, encoding: 'utf8', timeout: 900_000, maxBuffer: 256 * 1024 * 1024, env: deps.env ?? process.env };
    if (pkg.scripts?.codegen) {
      const r = runNpm(['run', 'codegen', '--silent'], options);
      if (r?.error || r?.status !== 0) return { ok: false, project, step: 'npm run codegen', detail: String(r?.stderr ?? r?.stdout ?? r?.error?.message ?? '').trim().slice(-400) };
    }
    if (fs.existsSync(path.join(appRoot, 'fe', 'packages')) && fs.existsSync(path.join(appRoot, 'turbo.json'))) {
      const r = runNpx(['turbo', 'run', 'build', '--filter=./fe/packages/*'], options);
      if (r?.error || r?.status !== 0) return { ok: false, project, step: 'npx turbo run build', detail: String(r?.stderr ?? r?.stdout ?? r?.error?.message ?? '').trim().slice(-400) };
    }
  }
  return { ok: true };
}

/** TypeScript error lines for one project, bounded to its own app and dependency install. */
function typeErrors(root, project) {
  const boundRoot = appRootOf(root, project);
  if (!fs.existsSync(path.join(boundRoot, 'node_modules'))) return { ok: false, error: `${path.relative(root, boundRoot) || '.'} has no node_modules` };
  const configPath = path.resolve(root, project), bound = slash(boundRoot);
  let ts;
  try { ts = createRequire(configPath)('typescript'); } catch (error) { return { ok: false, error: `typescript is not resolvable from ${project}: ${error.message}` }; }
  const libDir = slash(path.dirname(ts.getDefaultLibFilePath({})));
  const inside = (p) => { const s = slash(p); return s === bound || s.startsWith(`${bound}/`) || s === libDir || s.startsWith(`${libDir}/`); };
  const sys = { ...ts.sys,
    fileExists: (p) => inside(p) && ts.sys.fileExists(p), directoryExists: (p) => inside(p) && ts.sys.directoryExists(p),
    readFile: (p, e) => (inside(p) ? ts.sys.readFile(p, e) : undefined), getDirectories: (p) => (inside(p) ? ts.sys.getDirectories(p) : []), realpath: (p) => p,
    onUnRecoverableConfigFileDiagnostic: () => {} };
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, sys);
  if (!parsed) return { ok: false, error: `${project} could not be read` };
  const options = { ...parsed.options, noEmit: true, composite: false, declaration: false, declarationMap: false, emitDeclarationOnly: false, incremental: false, preserveSymlinks: true };
  const host = ts.createCompilerHost(options);
  Object.assign(host, { fileExists: sys.fileExists, directoryExists: sys.directoryExists, readFile: sys.readFile, getDirectories: sys.getDirectories, realpath: sys.realpath,
    getSourceFile: (fileName, languageVersion) => { const text = sys.readFile(fileName); return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion); } });
  const program = ts.createProgram({ rootNames: parsed.fileNames, options, projectReferences: parsed.projectReferences, host, configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(parsed) });
  const diagnostics = [...program.getConfigFileParsingDiagnostics(), ...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics(), ...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()];
  const errors = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error && d.file).map((d) => {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    const file = path.relative(root, d.file.fileName).replaceAll(String.fromCodePoint(92), '/');
    return `${file}(${line + 1},${character + 1}): error TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n').split('\n')[0]}`;
  });
  return { ok: true, errors };
}

/** New TypeScript errors in candidate versus primary main, per owning project. */
export function compareTypeErrors({ worktree, primary, code, deps = {} }) {
  const projects = [...new Set(code.filter((f) => /\.(ts|tsx|mts)$/.test(f)).map((f) => projectOf(worktree, f)).filter(Boolean))];
  const prepared = prepareFrontendProjects(worktree, projects, deps);
  if (!prepared.ok) return { projects, problems: [`tsc: cannot prepare ${prepared.project} at ${prepared.step}: ${prepared.detail}`] };
  const problems = [];
  for (const project of projects) {
    if (fs.existsSync(path.join(primary, project))) {
      const laneChain = modulesChain(worktree, project), mainChain = modulesChain(primary, project);
      const laneMissing = mainChain.filter((dir) => !laneChain.includes(dir)), mainMissing = laneChain.filter((dir) => !mainChain.includes(dir));
      if (laneMissing.length || mainMissing.length) { problems.push(`tsc: cannot compare ${project}; node_modules differ (lane missing: ${laneMissing.join(', ') || 'none'}; main missing: ${mainMissing.join(', ') || 'none'})`); continue; }
    }
    const lane = typeErrors(worktree, project), main = fs.existsSync(path.join(primary, project)) ? typeErrors(primary, project) : { ok: true, errors: [] };
    if (!lane.ok || !main.ok) { problems.push(`tsc: cannot measure ${project}: ${lane.error ?? main.error}`); continue; }
    const roots = [slash(worktree), slash(primary)];
    const norm = (line) => roots.reduce((s, root) => s.replaceAll(root, '<root>'), line.toLowerCase()).replace(/\(\d+,\d+\)/, '(l)');
    const remaining = new Map(main.errors.map(norm).map((line) => [line, (main.errors.map(norm).filter((x) => x === line).length)]));
    const fresh = lane.errors.filter((line) => { const key = norm(line), n = remaining.get(key) ?? 0; if (n) { remaining.set(key, n - 1); return false; } return true; });
    if (lane.errors.length > main.errors.length) problems.push(`tsc: ${project} ${lane.errors.length} errors vs main ${main.errors.length}`);
    for (const line of fresh.slice(0, 40)) problems.push(`tsc: ${line.slice(0, 220)}`);
  }
  return { projects, problems };
}
