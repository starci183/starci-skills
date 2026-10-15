// Names-only declarations become genuine sealed placeholders when an app or example is materialized.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { setSecretValues } from './secret-store.mjs';
import { sealBootstrapValues } from './secret-bootstrap-crypto.mjs';

const ENVIRONMENT = /^[a-z0-9][a-z0-9-]*$/u;
const MEMBER = /^secrets\/([a-z0-9][a-z0-9-]*)(?:\.enc)?$/u;
const KEY = /^[A-Z][A-Z0-9_]*$/u;

function readDocument(file, format) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  return format === 'json' ? JSON.parse(text) : parseYaml(text);
}

function memberOf(environment, declaration) {
  const entry = typeof declaration === 'string' ? { where: declaration } : declaration;
  const location = entry?.where ?? (entry?.name && `secrets/${entry.name}`);
  const match = MEMBER.exec(location ?? '');
  if (!ENVIRONMENT.test(environment) || !match)
    throw new Error('sealed member declarations must use .starcistacks/<environment>/secrets/<slug>');
  return { env: environment, slug: match[1], keys: entry.keys };
}

function rosterKeys(repoRoot, member) {
  const file = path.join(repoRoot, '.starcistacks', member.env, 'runtime', 'env', 'KEYS.md');
  if (!fs.existsSync(file)) return [];
  const keys = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const key = /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/u.exec(line)?.[1];
    if (!key) continue;
    const locations = [...line.matchAll(/(?:secrets\/|\/run\/secrets\/)([a-z0-9][a-z0-9-]*)(?:\.enc)?/gu)];
    if (locations.some((match) => match[1] === member.slug)) keys.push(key);
  }
  return keys;
}

function keysOf(repoRoot, member) {
  const declared = Array.isArray(member.keys) ? member.keys : rosterKeys(repoRoot, member);
  const keys = declared.length ? declared : [member.slug.replaceAll('-', '_').toUpperCase()];
  if (keys.some((key) => !KEY.test(key))) throw new Error('sealed member keys must be environment key names');
  return [...new Set(keys)].sort(byCodeUnit);
}

function descriptorMembers(repoRoot) {
  const stacks = path.join(repoRoot, '.starcistacks');
  if (!fs.existsSync(stacks)) return [];
  const members = [];
  for (const entry of fs.readdirSync(stacks, { withFileTypes: true })) {
    if (!entry.isDirectory() || !ENVIRONMENT.test(entry.name)) continue;
    const descriptor = readDocument(path.join(stacks, entry.name, 'environment.json'), 'json');
    for (const declaration of descriptor.secrets ?? []) members.push(memberOf(entry.name, declaration));
  }
  return members;
}

/** Resolve public member/key names without opening any existing envelope or private identity. */
export function declaredSealedMembers(repoRoot) {
  const manifest = readDocument(path.join(repoRoot, '.starcistacks', 'application-stacks.yaml'), 'yaml');
  const declarations = descriptorMembers(repoRoot);
  for (const [environment, model] of Object.entries(manifest?.environments ?? {})) {
    for (const declaration of model?.secrets ?? []) declarations.push(memberOf(environment, declaration));
  }
  const members = new Map();
  for (const member of declarations) {
    const id = `${member.env}/${member.slug}`;
    members.set(id, { ...member, keys: keysOf(repoRoot, member) });
  }
  return [...members.values()].sort((left, right) => `${left.env}/${left.slug}`.localeCompare(`${right.env}/${right.slug}`));
}

function placeholderValue(key) {
  const generated = randomUUID();
  if (/DB_URL$/u.test(key)) return `postgresql://app_be:${generated}@db.invalid:5432/app`;
  if (key.endsWith('_URL')) return `https://example.invalid/${generated}`;
  return generated;
}

/** Create missing members for this app's recipient, preserving owner-provisioned members. */
export function materializeDeclaredPlaceholders(repoRoot, { recipient, recipientsForFile, processEnv = process.env, sops, write } = {}) {
  const members = [];
  for (const member of declaredSealedMembers(repoRoot)) {
    const relative = `.starcistacks/${member.env}/secrets/${member.slug}.enc`;
    if (fs.existsSync(path.join(repoRoot, relative))) continue;
    const age = recipientsForFile?.(path.join(repoRoot, relative)) ?? [recipient];
    if (!age.length || age.some((value) => !/^age1[a-z0-9]+$/u.test(value ?? '')))
      throw new Error('sealed placeholders require the app public age recipient');
    if (!sops && age.length !== 1) throw new Error('multiple recipients require the standard SOPS adapter');
    const values = Object.fromEntries(member.keys.map((key) => [key, placeholderValue(key)]));
    const adapter = sops ?? { seal: () => sealBootstrapValues({ values, recipient: age[0] }) };
    setSecretValues(repoRoot, { slug: member.slug, values, env: member.env }, {
      age, processEnv, sops: adapter, write,
    });
    members.push(relative);
  }
  return { members };
}
