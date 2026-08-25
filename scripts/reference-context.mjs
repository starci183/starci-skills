#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptRoot, '..');
const defaultSource = resolve(skillRoot, '..');
const runtimeSource = join(skillRoot, 'runtime', 'reference-context');
const defaultStateRelative = '.workspaces/local/state/reference-context';
const defaultReferenceRelative = '.worktrees/references';
const mcpPort = 8020;
const caddyPort = 8021;

const slash = (value) => value.split(sep).join('/');
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const value = (args, flag) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
const csv = (args, flag) => (value(args, flag) ?? '').split(',').map((item) => item.trim()).filter(Boolean);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function inside(root, target) {
  const result = relative(resolve(root), resolve(target));
  return result === '' || (result !== '..' && !result.startsWith(`..${sep}`));
}

function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', windowsHide: true, ...options });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || result.stdout?.trim() || `${program} failed`);
  return result.stdout.trim();
}

function routeFiles(source) {
  const root = join(source, '.workspaces', 'projects');
  if (!existsSync(root)) throw new Error('.workspaces/projects is missing');
  const paths = [];
  for (const project of readdirSync(root, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    for (const file of readdirSync(join(root, project.name), { withFileTypes: true }).filter((item) => item.isFile() && item.name.endsWith('.json'))) paths.push(join(root, project.name, file.name));
  }
  return paths.sort();
}

export function resolveReferences({ sourceRoot = defaultSource, projects = [], roles = [] } = {}) {
  const source = resolve(sourceRoot);
  const selected = routeFiles(source).map((path) => readJson(path)).filter((route) => {
    if (projects.length && !projects.includes(route.project)) return false;
    if (roles.length && !roles.includes(route.role)) return false;
    return true;
  }).map((route) => {
    const id = `${route.project}-${route.role}`;
    const repository = route.repository?.gitRepository;
    const branch = route.repository?.branch;
    if (!repository || !branch) throw new Error(`portable route ${id} has no Git repository or branch`);
    return { id, project: route.project, role: route.role, repository, branch, path: `${defaultReferenceRelative}/${id}` };
  });
  if (!selected.length) throw new Error('no portable reference routes matched');
  const ids = selected.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('portable routes resolve duplicate reference identities');
  return selected;
}

function pythonExecutable(stateRoot) {
  return process.platform === 'win32' ? join(stateRoot, 'venv', 'Scripts', 'python.exe') : join(stateRoot, 'venv', 'bin', 'python');
}

function pipExecutable(stateRoot) {
  return process.platform === 'win32' ? join(stateRoot, 'venv', 'Scripts', 'pip.exe') : join(stateRoot, 'venv', 'bin', 'pip');
}

function detect(program, args = ['--version']) {
  const result = spawnSync(program, args, { encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? (result.stdout || result.stderr).trim() : null;
}

export function inspect({ sourceRoot = defaultSource, projects = [], roles = [] } = {}) {
  const source = resolve(sourceRoot);
  const stateRoot = join(source, defaultStateRelative);
  const referenceRoot = join(source, defaultReferenceRelative);
  const references = resolveReferences({ sourceRoot: source, projects, roles }).map((item) => {
    const root = join(source, item.path);
    const present = existsSync(join(root, '.git'));
    return { ...item, present, revision: present ? command('git', ['-C', root, 'rev-parse', 'HEAD']) : null, clean: present ? command('git', ['-C', root, 'status', '--porcelain']) === '' : null };
  });
  const python = detect(pythonExecutable(stateRoot), ['--version']);
  const caddy = detect('caddy', ['version']);
  return {
    schemaVersion: 1,
    sourceRoot: source,
    referenceRoot: slash(relative(source, referenceRoot)),
    stateRoot: slash(relative(source, stateRoot)),
    references,
    runtime: { python, caddy, configured: existsSync(join(stateRoot, 'runtime.json')), caddyConfig: existsSync(join(stateRoot, 'Caddyfile')) },
    codexUrl: `http://127.0.0.1:${caddyPort}/mcp`,
  };
}

function materializeReference(source, reference) {
  const referenceRoot = resolve(source, defaultReferenceRelative);
  const target = resolve(source, reference.path);
  if (!inside(referenceRoot, target) || target === referenceRoot) throw new Error(`unsafe reference target ${target}`);
  mkdirSync(referenceRoot, { recursive: true });
  if (!existsSync(target)) {
    command('git', ['-c', 'core.longpaths=true', 'clone', '--filter=blob:none', '--single-branch', '--branch', reference.branch, reference.repository, target]);
    command('git', ['-C', target, 'config', 'core.longpaths', 'true']);
  } else {
    if (!existsSync(join(target, '.git'))) throw new Error(`reference target is not a Git checkout: ${target}`);
    command('git', ['-C', target, 'config', 'core.longpaths', 'true']);
    const actualRemote = command('git', ['-C', target, 'remote', 'get-url', 'origin']);
    if (actualRemote !== reference.repository) throw new Error(`reference origin mismatch for ${reference.id}`);
    if (command('git', ['-C', target, 'status', '--porcelain'])) throw new Error(`reference checkout is dirty: ${target}`);
    command('git', ['-C', target, 'fetch', '--prune', 'origin', reference.branch]);
    command('git', ['-C', target, 'checkout', '--detach', `origin/${reference.branch}`]);
  }
  return command('git', ['-C', target, 'rev-parse', 'HEAD']);
}

function ensureCaddy() {
  const current = detect('caddy', ['version']);
  if (current) return current;
  if (process.platform === 'win32' && detect('winget', ['--version'])) {
    command('winget', ['install', '--id', 'CaddyServer.Caddy', '--exact', '--accept-package-agreements', '--accept-source-agreements']);
  } else if (process.platform === 'darwin' && detect('brew', ['--version'])) {
    command('brew', ['install', 'caddy']);
  } else {
    throw new Error('Caddy is missing; install it from https://caddyserver.com/docs/install and rerun bootstrap');
  }
  const installed = detect('caddy', ['version']);
  if (!installed) throw new Error('Caddy installation completed but caddy is not on PATH');
  return installed;
}

function ensurePythonRuntime(stateRoot) {
  const python = pythonExecutable(stateRoot);
  if (!existsSync(python)) command('python', ['-m', 'venv', join(stateRoot, 'venv')]);
  command(pipExecutable(stateRoot), ['install', '--disable-pip-version-check', '-r', join(runtimeSource, 'requirements.txt')]);
  const doctor = command(python, [join(runtimeSource, 'reference_context.py'), 'doctor']);
  const parsed = JSON.parse(doctor);
  if (!parsed.ready) throw new Error('Python reference runtime remains incomplete after installation');
  return parsed;
}

function writeRuntimeConfig(stateRoot, caddyVersion, doctor) {
  mkdirSync(stateRoot, { recursive: true });
  const caddyfile = `{\n\tauto_https off\n\tadmin off\n}\n\nhttp://127.0.0.1:${caddyPort} {\n\treverse_proxy 127.0.0.1:${mcpPort}\n}\n`;
  writeFileSync(join(stateRoot, 'Caddyfile'), caddyfile, 'utf8');
  const runtime = { schemaVersion: 1, stateRoot: defaultStateRelative, referenceRoot: defaultReferenceRelative, python: doctor.python, qdrantEdge: doctor.dependencies['qdrant-edge-py'], mcp: doctor.dependencies.mcp, caddy: caddyVersion, mcpPort, caddyPort, codexUrl: `http://127.0.0.1:${caddyPort}/mcp` };
  writeFileSync(join(stateRoot, 'runtime.json'), stableJson(runtime), 'utf8');
  return runtime;
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function launch(program, args, pidPath, cwd) {
  if (existsSync(pidPath)) {
    const current = Number.parseInt(readFileSync(pidPath, 'utf8'), 10);
    if (alive(current)) return current;
  }
  const child = spawn(program, args, { cwd, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  writeFileSync(pidPath, `${child.pid}\n`, 'utf8');
  return child.pid;
}

function startRuntime(source, stateRoot) {
  const python = pythonExecutable(stateRoot);
  const serverPid = launch(python, [join(runtimeSource, 'reference_context.py'), 'serve', '--state-root', stateRoot, '--host', '127.0.0.1', '--port', String(mcpPort)], join(stateRoot, 'mcp.pid'), source);
  const caddyPid = launch('caddy', ['run', '--config', join(stateRoot, 'Caddyfile'), '--adapter', 'caddyfile'], join(stateRoot, 'caddy.pid'), source);
  return { serverPid, caddyPid };
}

function proveRuntime(stateRoot, endpoint) {
  let lastError = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(pythonExecutable(stateRoot), [join(runtimeSource, 'reference_context.py'), 'smoke', '--state-root', stateRoot, '--url', endpoint], { encoding: 'utf8', windowsHide: true });
    if (result.status === 0) return JSON.parse(result.stdout.trim());
    lastError = result.stderr.trim() || result.stdout.trim();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error(lastError || 'local MCP protocol proof timed out');
}

function mergeCodexConfig(endpoint) {
  const codexRoot = process.env.CODEX_HOME ? resolve(process.env.CODEX_HOME) : join(process.env.USERPROFILE || process.env.HOME, '.codex');
  const configPath = join(codexRoot, 'config.toml');
  mkdirSync(codexRoot, { recursive: true });
  const before = existsSync(configPath) ? readFileSync(configPath, 'utf8') : '';
  const section = `[mcp_servers.starci-reference-context]\nurl = "${endpoint}"\nrequired = true\nenabled_tools = ["reference_search"]\n`;
  const expression = /(?:^|\n)\[mcp_servers\.starci-reference-context\]\r?\n[\s\S]*?(?=\r?\n\[[^\]]+\]|$)/;
  const after = expression.test(before) ? before.replace(expression, `${before.match(expression)?.[0].startsWith('\n') ? '\n' : ''}${section.trimEnd()}`) : `${before.trimEnd()}${before.trim() ? '\n\n' : ''}${section}`;
  const normalized = after.endsWith('\n') ? after : `${after}\n`;
  if (normalized !== before) writeFileSync(configPath, normalized, 'utf8');
  return { path: configPath, action: normalized === before ? 'unchanged' : 'merged', sha256: sha256(normalized) };
}

function indexReferences(source, stateRoot, references, manualFull = false) {
  const args = [join(runtimeSource, 'reference_context.py'), 'index', '--state-root', stateRoot, '--reference-root', join(source, defaultReferenceRelative)];
  for (const reference of references) args.push('--reference', reference.id);
  if (manualFull) args.push('--manual-full');
  return JSON.parse(command(pythonExecutable(stateRoot), args, { cwd: source }));
}

export function bootstrap({ sourceRoot = defaultSource, projects = [], roles = [], apply = false } = {}) {
  const source = resolve(sourceRoot);
  const plan = inspect({ sourceRoot: source, projects, roles });
  if (!apply) return { ...plan, operation: 'bootstrap-plan' };
  const stateRoot = join(source, defaultStateRelative);
  mkdirSync(stateRoot, { recursive: true });
  const revisions = plan.references.map((item) => ({ id: item.id, revision: materializeReference(source, item) }));
  const caddyVersion = ensureCaddy();
  const doctor = ensurePythonRuntime(stateRoot);
  const runtime = writeRuntimeConfig(stateRoot, caddyVersion, doctor);
  const indexed = indexReferences(source, stateRoot, plan.references);
  const processes = startRuntime(source, stateRoot);
  const proof = proveRuntime(stateRoot, runtime.codexUrl);
  const client = mergeCodexConfig(runtime.codexUrl);
  return { schemaVersion: 1, operation: 'bootstrap-apply', references: revisions, runtime, indexed, processes, proof, client };
}

export function run(argv = process.argv.slice(2)) {
  const operation = argv[0];
  const sourceRoot = resolve(value(argv, '--source-root') ?? defaultSource);
  const projects = csv(argv, '--projects');
  const roles = csv(argv, '--roles');
  if (operation === 'plan') return inspect({ sourceRoot, projects, roles });
  if (operation === 'bootstrap') {
    const apply = argv.includes('--apply');
    const plan = argv.includes('--plan');
    if (apply === plan) throw new Error('bootstrap requires exactly one of --plan or --apply');
    return bootstrap({ sourceRoot, projects, roles, apply });
  }
  if (operation === 'index') {
    const references = resolveReferences({ sourceRoot, projects, roles });
    return indexReferences(sourceRoot, join(sourceRoot, defaultStateRelative), references, argv.includes('--full'));
  }
  if (operation === 'query') {
    const query = value(argv, '--query');
    if (!query) throw new Error('query requires --query');
    const args = [join(runtimeSource, 'reference_context.py'), 'query', '--state-root', join(sourceRoot, defaultStateRelative), '--query', query];
    const reference = value(argv, '--reference');
    if (reference) args.push('--reference', reference);
    return JSON.parse(command(pythonExecutable(join(sourceRoot, defaultStateRelative)), args, { cwd: sourceRoot }));
  }
  throw new Error('Usage: reference-context.mjs <plan|bootstrap|index|query> [--source-root path] [--projects p1,p2] [--roles fe,be] [--plan|--apply|--full]');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(run())); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
