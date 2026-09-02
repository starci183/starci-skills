import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

// One file per runtime under resources/agents/profiles; the file name is the runtime id.
const profilesDir = path.join(root, 'resources', 'agents', 'profiles');
const agents = { runtimes: {} };
for (const file of (await readdir(profilesDir)).filter((f) => f.endsWith('.json')).sort()) {
  const runtime = file.slice(0, -'.json'.length);
  const group = JSON.parse(await readFile(path.join(profilesDir, file), 'utf8'));
  if (group.runtime !== runtime) throw new Error(`${file}: runtime must be "${runtime}", got "${group.runtime}"`);
  if (group.schemaVersion !== 8) throw new Error(`${file}: schemaVersion must be 8`);
  agents.runtimes[runtime] = group;
}

// Profiles are grouped by runtime; a runtime owns the provider, and profile ids must be unique
// across runtimes because operators bind the bare id.
const profiles = {};
for (const [runtime, group] of Object.entries(agents.runtimes)) {
  if (typeof group.provider !== 'string') errors.push(`runtime ${runtime}: provider must be a string`);
  for (const [id, profile] of Object.entries(group.profiles ?? {})) {
    if (profiles[id]) errors.push(`profile ${id}: declared in more than one runtime`);
    profiles[id] = { ...profile, runtime, provider: group.provider };
  }
}

const GRANTS = ['webSearch', 'imageGeneration', 'browser', 'sourceWrite'];
const WEB = new Set(['never', 'bounded']);
const IMAGE = new Set(['never', 'authority-only', 'required']);

// Every profile declares every grant explicitly, so a missing key cannot read as "allowed".
for (const [id, profile] of Object.entries(profiles)) {
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

// Each operator carries its own resource binding in operator.json: one profile, the grants it
// requires, and its answers to the three standing questions. There is no central assignment file,
// so the binding cannot drift from the operator that owns it.
const operatorsDir = path.join(root, 'operators');
const operators = new Map();
for (const entry of await readdir(operatorsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(operatorsDir, entry.name);
  const manifest = JSON.parse(await readFile(path.join(dir, 'operator.json'), 'utf8'));
  const schemas = await Promise.all(['input.schema.json', 'output.schema.json'].map((f) => readFile(path.join(dir, f), 'utf8')));
  const pinned = new Set([...schemas.join('\n').matchAll(/"model"\s*:\s*\{\s*"const"\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
  operators.set(manifest.id, { resources: manifest.resources, pinned, dir: entry.name });
}

const used = new Set();
for (const [id, { resources, pinned }] of operators) {
  if (!resources || typeof resources !== 'object') {
    errors.push(`${id}: operator.json must declare resources { profile, requires, policy }`);
    continue;
  }
  const { profile: profileId, requires = [], policy = {} } = resources;
  const profile = profiles[profileId];
  if (typeof profileId !== 'string' || !profile) {
    errors.push(`${id}: resources.profile ${profileId} is not a declared profile`);
    continue;
  }
  used.add(profileId);

  // A grant the operator uses must be permitted by its profile.
  for (const grant of requires) {
    if (!GRANTS.includes(grant)) errors.push(`${id}: unknown grant ${grant}`);
    else if (!profile.permits[grant]) errors.push(`${id}: requires ${grant} but profile ${profileId} does not permit it`);
  }

  // Policy answers must agree with the grants actually required.
  if (!WEB.has(policy.webSearch)) errors.push(`${id}: policy.webSearch must be never or bounded`);
  if (!IMAGE.has(policy.imageGeneration)) errors.push(`${id}: policy.imageGeneration must be never, authority-only, or required`);
  if (typeof policy.grammarBound !== 'boolean') errors.push(`${id}: policy.grammarBound must be true or false`);
  const req = new Set(requires);
  if (policy.webSearch === 'bounded' && !req.has('webSearch')) errors.push(`${id}: bounded web search must appear in requires`);
  if (policy.webSearch === 'never' && req.has('webSearch')) errors.push(`${id}: requires webSearch but policy says never`);
  if (policy.imageGeneration === 'required' && !req.has('imageGeneration')) errors.push(`${id}: required image generation must appear in requires`);
  if (policy.imageGeneration === 'never' && req.has('imageGeneration')) errors.push(`${id}: requires imageGeneration but policy says never`);

  // A model an operator's schema pins as a const must be the model of its one profile.
  for (const model of pinned) {
    if (model !== profile.model) errors.push(`${id}: schema pins model ${model} but its profile ${profileId} runs ${profile.model}`);
  }
}

// resources/INDEX.md summarises the bindings; a summary that disagrees with an operator is drift.
const index = await readFile(path.join(root, 'resources', 'INDEX.md'), 'utf8');
const GRAMMAR_WORD = { true: 'yes', false: 'no' };
const rows = new Map();
for (const line of index.split(/\r?\n/)) {
  const m = /^\| `([a-z.]+)` \| ([a-z-]+) \| ([a-z-]+) \| (yes|no) \| ([a-z-]+) \|/.exec(line);
  if (m) rows.set(m[1], { profile: m[2], web: m[3], grammar: m[4], images: m[5] });
}
for (const [id, { resources }] of operators) {
  const row = rows.get(id);
  if (!row) { errors.push(`resources/INDEX.md: no process-matrix row for ${id}`); continue; }
  if (!resources) continue;
  const expect = { profile: resources.profile, web: resources.policy?.webSearch, grammar: GRAMMAR_WORD[resources.policy?.grammarBound], images: resources.policy?.imageGeneration };
  for (const key of Object.keys(expect)) {
    if (row[key] !== expect[key]) errors.push(`resources/INDEX.md: ${id} row says ${key} ${row[key]}, operator.json says ${expect[key]}`);
  }
}
for (const id of rows.keys()) if (!operators.has(id)) errors.push(`resources/INDEX.md: row for unknown operator ${id}`);

// The orchestrator record turns operators into agents; its two numbers are the whole contract.
const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
if (orchestrator.agentPerOperator !== true) errors.push('orchestrator.json: agentPerOperator must be true');
if (!Number.isInteger(orchestrator.maxConcurrentAgents) || orchestrator.maxConcurrentAgents < 1 || orchestrator.maxConcurrentAgents > 3) {
  errors.push('orchestrator.json: maxConcurrentAgents must be an integer from 1 to 3');
}
if (orchestrator.dispatch !== 'routing.json') errors.push('orchestrator.json: dispatch must be routing.json');

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`resources bound: ${Object.keys(agents.runtimes).length} runtimes, ${Object.keys(profiles).length} profiles, ${operators.size} operators on ${used.size} profiles\n`);
}
