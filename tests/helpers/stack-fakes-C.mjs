// stack-fakes-C.mjs - helpers of the remote / prepare / backup / jobs specs (worker C only).
//   makeApp(options)          a real temp app tree (hfs.json, application-stacks.yaml with a deploy block, stack.yaml, .sops.yaml) + its loaded config
//   shellWords(command)       splits a command composed with shellQuote back into words (single quotes only)
//   fakeRunner(host, table)   an ssh runner (command) -> { status, stdout, stderr } that answers `docker ...` through the fake docker of
//                             tests/helpers/stack-fakes.mjs and any other command through `table` ({ '<substring>': (command, host) => result })
//   healthyTable(options)     answers for the non-docker commands of prepare/doctor (disk, releases directory, release pointers)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../../packages/hfs/runtime/engine/yaml.mjs';
import { loadDeployConfig } from '../../packages/hfs/stack/config.mjs';

export const RECIPIENT = `age1${'q'.repeat(58)}`;
export const IMAGE = `alpine:3.21@sha256:${'a'.repeat(64)}`;

const baseDeploy = () => ({
  stack: 'shop',
  remote: { host: 'vps', releasesBase: '/srv/shop', sealed: { ops: 'ops', sshKey: 'vps-ssh-key', knownHosts: 'vps-known-hosts' } },
  volumes: ['shop-data', 'shop-cache'],
  jobs: { service: 'api', command: ['node', 'cli.js', 'jobs'] },
  backup: { image: IMAGE, keepDays: 14, dir: '/var/backups/shop', volumes: [{ name: 'data', volume: 'shop-data' }, { name: 'cache', volume: 'shop-cache' }] },
});

/** `deploy` entries override the defaults; a `null` entry removes the default. `sealedFiles` creates empty ops / key / known_hosts members. */
export function makeApp({ deploy = {}, sealedFiles = false, sops = RECIPIENT } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-'));
  const merged = { ...baseDeploy(), ...deploy };
  for (const [key, value] of Object.entries(merged)) if (value === null) delete merged[key];
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ project: 'shop' }));
  const envDir = path.join(root, '.starcistacks', 'production');
  fs.mkdirSync(path.join(envDir, 'infra', 'swarm'), { recursive: true });
  fs.writeFileSync(path.join(envDir, 'infra', 'swarm', 'stack.yaml'), stringifyYaml({ services: { api: { image: 'x' }, web: { image: 'y' } } }));
  const declaration = { environments: { production: { runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'], deploy: merged } } };
  fs.writeFileSync(path.join(root, '.starcistacks', 'application-stacks.yaml'), stringifyYaml(declaration));
  if (sops) fs.writeFileSync(path.join(root, '.sops.yaml'), stringifyYaml({ creation_rules: [{ path_regex: '.*', age: sops }] }));
  if (sealedFiles) {
    fs.mkdirSync(path.join(envDir, 'secrets'), { recursive: true });
    for (const slug of ['ops', 'vps-ssh-key', 'vps-known-hosts']) fs.writeFileSync(path.join(envDir, 'secrets', `${slug}.enc`), '');
  }
  const config = loadDeployConfig({ repoRoot: root, env: 'production' });
  return { root, config, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/** Splits a command string composed of shellQuote'd words (a backslash outside quotes escapes the next character). */
export function shellWords(command) {
  const words = [];
  let current = null;
  let quoted = false;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quoted) {
      if (char === "'") quoted = false;
      else current += char;
    } else if (char === "'") {
      quoted = true;
      current ??= '';
    } else if (char === '\\') {
      index += 1;
      current = `${current ?? ''}${command[index]}`;
    } else if (char === ' ') {
      if (current !== null) words.push(current);
      current = null;
    } else current = `${current ?? ''}${char}`;
  }
  if (current !== null) words.push(current);
  return words;
}

/** The runner. */
export function fakeRunner(host, table = {}) {
  const commands = [];
  const run = (command, options = {}) => {
    commands.push({ command, input: options.input });
    const needle = Object.keys(table).find((key) => command.includes(key));
    if (needle) return table[needle](command, host);
    if (command.startsWith('docker ')) return host.spawn('docker', shellWords(command).slice(1));
    return { status: 127, stdout: '', stderr: `fake remote: unknown command ${command}` };
  };
  run.commands = commands;
  return run;
}

/** Answers for the non-docker commands of prepare/doctor. */
export function healthyTable({ freeKb = 50 * 1_048_576, directory = 'writable', current = '0123456789abcdef', previous = 'fedcba9876543210' } = {}) {
  return {
    'df -Pk': () => ({ status: 0, stdout: `/var/lib/docker\nFilesystem 1024-blocks Used Available Capacity Mounted\n/dev/sda1 100000000 1000 ${freeKb} 10% /\n`, stderr: '' }),
    'elif [ ! -w': () => ({ status: 0, stdout: `${directory}\n`, stderr: '' }),
    'readlink current': () => ({ status: 0, stdout: current === null ? '' : `${current}\n`, stderr: '' }),
    'readlink previous': () => ({ status: 0, stdout: previous === null ? '' : `${previous}\n`, stderr: '' }),
  };
}
