// Runtime examples keep names only; checks receive disposable copies with fresh sealed members.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runProgram } from '../api/process/run-program.mjs';
import { init as initGit } from '../api/git/init.mjs';
import { add as addGit } from '../api/git/add.mjs';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { isMain } from '../lib/is-main.mjs';
import { withoutGitLocalEnv } from '../lib/git.mjs';
import { resolveRealTool } from '../api/process/resolve-real-tool.mjs';
import { generateAppIdentity } from './secret-bootstrap-crypto.mjs';
import { declaredSealedMembers, materializeDeclaredPlaceholders } from './sealed-members.mjs';

const SKIPPED = new Set(['.git', '.claude', '.secrets', '.aws', '.codex', '.agents', 'node_modules', '.next', '.turbo', 'dist', 'coverage']);
const PATH_RULE = String.raw`\.starcistacks[/\\][^/\\]+[/\\]secrets[/\\][^/\\]+\.enc$`;

function writePublicRecipient(repoRoot, recipient) {
  fs.writeFileSync(path.join(repoRoot, '.sops.yaml'), stringifyYaml({
    creation_rules: [{ path_regex: PATH_RULE, age: recipient }],
  }));
  const stacks = path.join(repoRoot, '.starcistacks');
  for (const entry of fs.readdirSync(stacks, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(stacks, entry.name, 'backup.recipient');
    if (fs.existsSync(file)) fs.writeFileSync(file, `${recipient}\n`);
  }
}

/** Generate genuine sealed members; the fresh private identity is confined to os.tmpdir and removed before return. */
export async function materializeExample(repoRoot, { createIdentity = generateAppIdentity, sops } = {}) {
  const declared = declaredSealedMembers(repoRoot);
  if (!declared.length) return { members: [] };
  if (declared.some(({ env, slug }) => fs.existsSync(path.join(repoRoot, '.starcistacks', env, 'secrets', slug + '.enc'))))
    throw new Error('example materialization requires a disposable copy without existing sealed members');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-example-age-'));
  try {
    const selected = createIdentity();
    try {
      fs.writeFileSync(path.join(directory, 'identity.txt'), selected.identity, { mode: 0o600, flag: 'wx' });
    } finally {
      selected.identity.fill(0);
    }
    writePublicRecipient(repoRoot, selected.recipient);
    return materializeDeclaredPlaceholders(repoRoot, { recipient: selected.recipient, sops });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

function trackExample(repoRoot) {
  const env = withoutGitLocalEnv(process.env);
  if (!initGit(repoRoot, { env }).ok) throw new Error('could not initialize the isolated example git tree');
  const staged = addGit(['-A', '--', '.'], { cwd: repoRoot, env });
  if (staged.error || staged.status !== 0) throw new Error('could not stage the isolated example git tree');
}

function safeExampleSource(source, { preserveCoverage = false } = {}) {
  const name = path.basename(source);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) return false;
  if (SKIPPED.has(name) && !(preserveCoverage && name === 'coverage')) return false;
  if (name.endsWith('.enc') || /\.(?:agekey|pem|key)$/iu.test(name)) return false;
  if (['secret.env', 'secrets.env', 'keys.txt'].includes(name)) return false;
  if (name === '.env.example' || name.endsWith('.env.example')) return true;
  if (name === '.env' || name.startsWith('.env.') || name.endsWith('.env')) return false;
  if (stat.isDirectory()) return true;
  const parts = source.split(path.sep);
  return !parts.includes('secrets') || ['.gitignore', 'README.md'].includes(name);
}

function pruneEmptyDirectories(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirectories(path.join(directory, entry.name));
  }
  if (!fs.readdirSync(directory).length) fs.rmdirSync(directory);
}

/** Await callback(tempExamplePath), return its result, and remove the os.tmpdir-based copy even on failure. */
export async function withMaterializedExample(repoRoot, exampleRelativePath, callback, { materialize = materializeExample, linkDependencies = false, preserveCoverage = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-example-'));
  const source = path.resolve(repoRoot, exampleRelativePath);
  const app = path.join(directory, 'examples', path.basename(source));
  try {
    fs.writeFileSync(path.join(directory, 'hfs.json'), JSON.stringify({ kind: 'runtime' }));
    fs.cpSync(source, app, {
      recursive: true,
      filter: (file) => safeExampleSource(file, { preserveCoverage }),
    });
    pruneEmptyDirectories(app);
    if (linkDependencies) linkExampleDependencies(source, app);
    await materialize(app);
    trackExample(app);
    return await callback(app);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

// Runtime example command execution shares the same isolated materialization as the source check.
function linkExampleDependencies(source, target) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.name === 'node_modules') {
      fs.mkdirSync(target, { recursive: true });
      fs.symlinkSync(from, to, process.platform === 'win32' ? 'junction' : 'dir');
    } else if (entry.isDirectory() && safeExampleSource(from)) {
      linkExampleDependencies(from, to);
    }
  }
}

function commandLaunch(command, args) {
  const npm = /^(npm|npx)(?:\.cmd)?$/iu.exec(command);
  if (process.platform !== 'win32' || !npm) return { file: command, args };
  const entry = npm[1].toLowerCase() + '-cli.js';
  const resolved = resolveRealTool(npm[1]);
  const candidates = [
    process.env.npm_execpath && path.join(path.dirname(process.env.npm_execpath), entry),
    resolved && path.join(path.dirname(resolved), 'node_modules', 'npm', 'bin', entry),
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', entry),
  ];
  const cli = candidates.find((file) => file && fs.existsSync(file));
  if (!cli) throw new Error('the example runner could not locate the installed npm CLI entry point');
  return { file: process.execPath, args: [cli, ...args] };
}

function commandEnvironment() {
  const env = withoutGitLocalEnv(process.env);
  return Object.fromEntries(Object.entries(env).filter(([name]) => !/^SOPS_AGE_KEY(?:_FILE)?$/iu.test(name)));
}

/** Run an installed app command in a sealed temporary copy, returning its exit code and preserving report artifacts. */
export async function runMaterializedCommand(repoRoot, command, args = [], { run = runProgram } = {}) {
  return withMaterializedExample(repoRoot, '.', (app) => {
    const launch = commandLaunch(command, args);
    const result = run(launch.file, launch.args, { cwd: app, env: commandEnvironment(), stdio: 'inherit', windowsHide: true });
    const reports = path.join(app, 'reports');
    if (fs.existsSync(reports)) fs.cpSync(reports, path.join(repoRoot, 'reports'), { recursive: true });
    if (result.error) throw new Error('the example check command could not start');
    return result.status ?? 1;
  }, { linkDependencies: true, preserveCoverage: true });
}

async function main(argv) {
  if (argv[0] === '--run' && argv[1] && argv[2] === '--' && argv[3])
    return runMaterializedCommand(path.resolve(argv[1]), argv[3], argv.slice(4));
  if (argv.length !== 1) throw new Error('usage: example-secrets.mjs <disposable-copy> | --run <example> -- <command> [args]');
  const result = await materializeExample(path.resolve(argv[0]));
  process.stdout.write(`example sealed members generated: ${result.members.length}\n`);
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
