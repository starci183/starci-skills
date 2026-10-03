// secret.mjs - `starci app secret list|show|set|gen`: the canon command over an app's sealed secrets.
// (R06: a secret exists only as a sops envelope there). It is the one way an operator or an agent reads or writes one; a plain
// `sops` command in a KEYS.md or a runbook is retired. Every sops use goes through scripts/api/sops (decrypt.mjs, seal.mjs):
//   starci app secret list [--env <name>]                       every secret of the env and the keys it holds (names only, nothing decrypted)
//   starci app secret show <slug> [--key <NAME>] [--env <name>] decrypt one value to stdout
//   starci app secret set <slug> [--key <NAME>] [--age <recipient>]... [--env <name>]
//                                                        the value is read from stdin (never from an argument); a new secret takes its
//                                                        recipients from --age, else from the repository's .sops.yaml
//   starci app secret gen <slug> [--key <NAME>] [--bytes <n>] [--age <recipient>]... [--env <name>]
//                                                        a random value (base64url of n bytes, default 32) sealed without being printed
// A single-value secret holds its value under the key `data`. Every verb runs at the app root (the folder of hfs.json), or at --cwd.
// Exit 0 done, 2 a refusal or bad usage (a secret value is never part of a message).
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { decrypt as sopsDecrypt } from '../api/sops/decrypt.mjs';
import { seal as sopsSeal } from '../api/sops/seal.mjs';

class SecretError extends Error {}

const SLUG = /^[a-z0-9][a-z0-9-]*$/u;
const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const DEFAULT_KEY = 'data';
const VERBS = new Set(['list', 'show', 'set', 'gen']);

/** The envelope format of a sealed secret, read from its text: json, yaml or dotenv. */
export function formatOf(text) {
  const body = String(text).trimStart();
  if (body.startsWith('{')) return 'json';
  if (/^sops:\s*$/mu.test(text)) return 'yaml';
  return 'dotenv';
}

/** The key names a sealed document holds and the age recipients it is sealed to, read without decrypting anything. */
export function envelopeOf(text) {
  const format = formatOf(text);
  if (format === 'json') {
    const doc = JSON.parse(text);
    return { format, keys: Object.keys(doc).filter((name) => name !== 'sops'), recipients: (doc.sops?.age ?? []).map((entry) => entry.recipient).filter(Boolean) };
  }
  if (format === 'yaml') {
    const keys = [...text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*):/gmu)].map((match) => match[1]).filter((name) => name !== 'sops');
    return { format, keys, recipients: [...text.matchAll(/^\s+-?\s*recipient:\s*(\S+)/gmu)].map((match) => match[1]) };
  }
  const keys = [...text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gmu)].map((match) => match[1]).filter((name) => !name.startsWith('sops_'));
  return { format, keys, recipients: [...text.matchAll(/^sops_age__list_\d+__map_recipient=(\S+)/gmu)].map((match) => match[1]) };
}

/** The plaintext document `map` in the given format. A dotenv value cannot hold a line break. */
export function plaintextOf(format, map) {
  if (format === 'json') return `${JSON.stringify(map)}\n`;
  if (format === 'yaml') return `${Object.entries(map).map(([name, value]) => `${name}: ${JSON.stringify(value)}`).join('\n')}\n`;
  for (const [name, value] of Object.entries(map)) if (/[\r\n]/u.test(value)) throw new SecretError(`${name} holds a line break; a dotenv secret holds one-line values only`);
  return `${Object.entries(map).map(([name, value]) => `${name}=${value}`).join('\n')}\n`;
}

/** The directory of the sealed secrets of the app at `repoRoot` for `env`; the one env that has secrets when none is named. */
function secretsDirectory(repoRoot, env) {
  const stacks = path.join(repoRoot, '.starcistacks');
  if (!fs.existsSync(stacks)) throw new SecretError('this app has no .starcistacks; run starci app secret at the app root, or pass --cwd');
  if (env) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(env)) throw new SecretError(`--env ${env} is not an environment name`);
    return path.join(stacks, env, 'secrets');
  }
  const withSecrets = fs.readdirSync(stacks, { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join(stacks, entry.name, 'secrets'))).map((entry) => entry.name);
  if (withSecrets.length === 1) return path.join(stacks, withSecrets[0], 'secrets');
  throw new SecretError(withSecrets.length === 0 ? 'no environment of .starcistacks has a secrets folder; pass --env to create the first secret' : `more than one environment has secrets (${withSecrets.join(', ')}); pass --env`);
}

const fileOf = (directory, slug) => {
  if (!SLUG.test(slug ?? '')) throw new SecretError(`${slug === undefined ? 'a secret name' : slug} is not a secret slug: lowercase letters, digits and dashes`);
  return path.join(directory, `${slug}.enc`);
};

/** The default sops seam: the runtime's sops api, which finds the binary on this machine. */
function defaultSops(env = process.env) {
  const refuse = (what, result) => {
    if (result.error?.code === 'SOPS_MISSING') return new SecretError(result.error.message);
    return new SecretError(`sops could not ${what} (exit ${String(result.status)})`);
  };
  return {
    decrypt(file, format) {
      const result = sopsDecrypt(null, ['decrypt', '--input-type', format, '--output-type', 'json', file], { env });
      if (result.status !== 0) throw refuse(`decrypt ${path.basename(file)}; is the age identity installed?`, result);
      return JSON.parse(result.stdout);
    },
    seal(request) {
      const result = sopsSeal(null, request, { env });
      if (result.status !== 0) throw refuse(`seal the secret: ${String(result.stderr).trim().split(String.fromCharCode(10)).at(-1)}`, result);
      return result.stdout;
    },
  };
}

function parse(argv) {
  const opts = { positional: [], age: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--cwd', '--env', '--key', '--bytes', '--age'].includes(arg)) {
      if (argv[i + 1] === undefined) throw new SecretError(`${arg} needs a value`);
      if (arg === '--age') opts.age.push(argv[i + 1]); else opts[arg.slice(2)] = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--')) throw new SecretError(`unknown flag ${arg}`);
    else opts.positional.push(arg);
  }
  return opts;
}

const readStdin = () => fs.readFileSync(0, 'utf8');

/** Seal `key = value` into the secret `slug`: an existing document keeps its other keys and its recipients. */
function writeSecret({ file, key, value, age, sops }) {
  if (!KEY.test(key)) throw new SecretError(`${key} is not a key name`);
  let format = 'json';
  let map = {};
  let recipients = age;
  if (fs.existsSync(file)) {
    const text = fs.readFileSync(file, 'utf8');
    const envelope = envelopeOf(text);
    format = envelope.format;
    map = sops.decrypt(file, format);
    if (!age.length) recipients = envelope.recipients;
  }
  map[key] = value;
  const sealed = sops.seal({ inputType: format, plaintext: plaintextOf(format, map), recipients, filenameOverride: file });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, sealed);
}

/** `starci app secret <verb> ...`; `stdin` returns the value `set` seals, `sops` and `random` are test seams. */
export function secretMain(argv, { stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s), stdin = readStdin, sops = null, random = randomBytes, env = process.env, cwd = process.cwd() } = {}) {
  const [verb, ...rest] = argv;
  try {
    if (!VERBS.has(verb)) throw new SecretError('usage: starci app secret list | show <slug> | set <slug> | gen <slug> [--key NAME] [--env NAME] [--age RECIPIENT] [--bytes N] [--cwd DIR]');
    const opts = parse(rest);
    const repoRoot = path.resolve(cwd, opts.cwd ?? '.');
    const directory = secretsDirectory(repoRoot, opts.env);
    const key = opts.key ?? DEFAULT_KEY;
    if (verb === 'list') {
      if (opts.positional.length) throw new SecretError('starci app secret list takes no name');
      const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.endsWith('.enc')).sort() : [];
      for (const name of files) stdout(`${name.slice(0, -'.enc'.length)}  ${envelopeOf(fs.readFileSync(path.join(directory, name), 'utf8')).keys.join(', ')}\n`);
      stdout(`${files.length} secret${files.length === 1 ? '' : 's'} in ${path.relative(repoRoot, directory).split(path.sep).join('/')}\n`);
      return 0;
    }
    if (opts.positional.length !== 1) throw new SecretError(`starci app secret ${verb} takes one secret name`);
    const file = fileOf(directory, opts.positional[0]);
    const seam = sops ?? defaultSops(env);
    if (verb === 'show') {
      if (!fs.existsSync(file)) throw new SecretError(`${opts.positional[0]} is not sealed in this env`);
      const { format, keys } = envelopeOf(fs.readFileSync(file, 'utf8'));
      if (opts.key === undefined && !keys.includes(DEFAULT_KEY) && keys.length !== 1) throw new SecretError(`${opts.positional[0]} holds ${keys.join(', ')}; name one with --key`);
      const map = seam.decrypt(file, format);
      const name = opts.key ?? (keys.includes(DEFAULT_KEY) ? DEFAULT_KEY : keys[0]);
      if (!Object.hasOwn(map, name)) throw new SecretError(`${opts.positional[0]} has no key ${name}`);
      stdout(`${String(map[name])}\n`);
      return 0;
    }
    if (verb === 'set') {
      const value = String(stdin()).replace(/\r?\n$/u, '');
      if (value === '') throw new SecretError('the value on stdin is empty');
      writeSecret({ file, key, value, age: opts.age, sops: seam });
      stdout(`sealed ${opts.positional[0]} (${key})\n`);
      return 0;
    }
    const bytes = opts.bytes === undefined ? 32 : Number(opts.bytes);
    if (!Number.isInteger(bytes) || bytes < 16 || bytes > 1024) throw new SecretError('--bytes is a whole number from 16 to 1024');
    writeSecret({ file, key, value: random(bytes).toString('base64url'), age: opts.age, sops: seam });
    stdout(`generated and sealed ${opts.positional[0]} (${key}, ${bytes} bytes); read it with starci app secret show\n`);
    return 0;
  } catch (error) {
    if (error instanceof SecretError || error instanceof SyntaxError) { stderr(`starci app secret: ${error.message}\n`); return 2; }
    throw error;
  }
}
