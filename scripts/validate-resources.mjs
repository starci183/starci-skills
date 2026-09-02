import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agents = JSON.parse(await readFile(path.join(root, 'resources', 'agents.json'), 'utf8'));
const assignments = JSON.parse(await readFile(path.join(root, 'resources', 'assignments.json'), 'utf8'));
const errors = [];

const GRANTS = ['webSearch', 'imageGeneration', 'browser', 'sourceWrite'];
const WEB = new Set(['never', 'bounded']);
const IMAGE = new Set(['never', 'authority-only', 'required']);

// Profiles are grouped by runtime; a runtime owns the provider, and profile ids must be unique
// across runtimes because assignments.json binds the bare id.
const profiles = {};
for (const [runtime, group] of Object.entries(agents.runtimes ?? {})) {
  if (typeof group.provider !== 'string') errors.push(`runtime ${runtime}: provider must be a string`);
  for (const [id, profile] of Object.entries(group.profiles ?? {})) {
    if (profiles[id]) errors.push(`profile ${id}: declared in more than one runtime`);
    profiles[id] = { ...profile, runtime, provider: group.provider };
  }
}
agents.profiles = profiles;

// Every profile declares every grant explicitly, so a missing key cannot read as "allowed".
for (const [id, profile] of Object.entries(agents.profiles)) {
  for (const grant of GRANTS) {
    if (typeof profile.capabilities?.[grant] !== 'boolean') errors.push(`profile ${id}: capabilities.${grant} must be true or false`);
    if (typeof profile.permits?.[grant] !== 'boolean') errors.push(`profile ${id}: permits.${grant} must be true or false`);
    // A profile may not permit what the model cannot do here; policy narrows capability, never widens it.
    if (profile.permits?.[grant] === true && profile.capabilities?.[grant] !== true) {
      errors.push(`profile ${id}: permits.${grant} but capabilities.${grant} is false`);
    }
  }
  if (profile.isolation !== 'fresh' || profile.forkTurns !== 'none') {
    errors.push(`profile ${id}: material executions are fresh with no inherited turns`);
  }
}

// Operators on disk and operators assigned must be the same set, both ways.
const operatorsDir = path.join(root, 'operators');
const onDisk = new Map();
for (const entry of await readdir(operatorsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(operatorsDir, entry.name);
  const manifest = JSON.parse(await readFile(path.join(dir, 'operator.json'), 'utf8'));
  const schemas = await Promise.all(['input.schema.json', 'output.schema.json'].map((f) => readFile(path.join(dir, f), 'utf8')));
  const pinned = new Set([...schemas.join('\n').matchAll(/"model"\s*:\s*\{\s*"const"\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
  onDisk.set(manifest.id, { pinned });
}
for (const id of onDisk.keys()) {
  if (!assignments.operators[id]) errors.push(`${id}: no resource assignment`);
}
for (const id of Object.keys(assignments.operators)) {
  if (!onDisk.has(id)) errors.push(`assignments.json names unknown operator ${id}`);
}

for (const [id, entry] of Object.entries(assignments.operators)) {
  if (!onDisk.has(id)) continue;
  const roles = Object.entries(entry.roles ?? {});
  if (roles.length === 0) errors.push(`${id}: at least one role must bind a profile`);

  const permitted = new Set();
  const assignedModels = new Set();
  for (const [role, profileId] of roles) {
    const profile = agents.profiles[profileId];
    if (!profile) {
      errors.push(`${id}.${role}: unknown profile ${profileId}`);
      continue;
    }
    assignedModels.add(profile.model);
    for (const grant of GRANTS) if (profile.permits[grant]) permitted.add(grant);
  }

  // A grant the operator uses must be permitted by at least one of its profiles.
  for (const grant of entry.requires ?? []) {
    if (!GRANTS.includes(grant)) errors.push(`${id}: unknown grant ${grant}`);
    else if (!permitted.has(grant)) errors.push(`${id}: requires ${grant} but no assigned profile permits it`);
  }

  // Policy answers must agree with the grants actually required.
  const policy = entry.policy ?? {};
  if (!WEB.has(policy.webSearch)) errors.push(`${id}: policy.webSearch must be never or bounded`);
  if (!IMAGE.has(policy.imageGeneration)) errors.push(`${id}: policy.imageGeneration must be never, authority-only, or required`);
  if (typeof policy.grammarBound !== 'boolean') errors.push(`${id}: policy.grammarBound must be true or false`);
  const requires = new Set(entry.requires ?? []);
  if (policy.webSearch === 'bounded' && !requires.has('webSearch')) errors.push(`${id}: bounded web search must appear in requires`);
  if (policy.webSearch === 'never' && requires.has('webSearch')) errors.push(`${id}: requires webSearch but policy says never`);
  if (policy.imageGeneration === 'required' && !requires.has('imageGeneration')) errors.push(`${id}: required image generation must appear in requires`);
  if (policy.imageGeneration === 'never' && requires.has('imageGeneration')) errors.push(`${id}: requires imageGeneration but policy says never`);

  // A model an operator's schema pins as a const must be one of its assigned profiles' models,
  // so the registry and the contract cannot quietly disagree about who runs the step.
  for (const model of onDisk.get(id).pinned) {
    if (!assignedModels.has(model)) errors.push(`${id}: schema pins model ${model} but no assigned profile uses it`);
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  const roles = Object.values(assignments.operators).reduce((n, e) => n + Object.keys(e.roles).length, 0);
  process.stdout.write(`resources bound: ${Object.keys(agents.runtimes).length} runtimes, ${Object.keys(agents.profiles).length} profiles, ${onDisk.size} operators, ${roles} roles\n`);
}
