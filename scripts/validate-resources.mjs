// Resources close when: every profile declares, for every tool in resources/tools.json, what the runtime can do
// (capabilities) and what the profile is allowed to do (permits), and never permits what it cannot; every
// operator binds one profile and declares its tools as @tools/<id> with one mode the registry defines, each
// permitted by its profile and supported by its runtime; resources/INDEX.md repeats the bindings exactly;
// orchestrator.json fixes the agent contract and a symmetric profile equivalent on the other runtime.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const toolsDoc = JSON.parse(await readFile(path.join(root, 'resources', 'tools.json'), 'utf8'));
if (toolsDoc.schemaVersion !== 9) errors.push('resources/tools.json: schemaVersion must be 9');
const TOOLS = toolsDoc.tools ?? {};
const RUNTIMES = Object.keys(toolsDoc.runtimes ?? {});
for (const [id, tool] of Object.entries(TOOLS)) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) errors.push(`resources/tools.json: tool id ${id} must be lowercase`);
  if (!tool.purpose) errors.push(`resources/tools.json: ${id} needs a purpose`);
  if (!tool.modes || !Object.keys(tool.modes).length) errors.push(`resources/tools.json: ${id} needs modes`);
  for (const rt of RUNTIMES) if (typeof tool.support?.[rt]?.supported !== 'boolean' || !tool.support?.[rt]?.via) errors.push(`resources/tools.json: ${id} must say whether ${rt} supports it and via what`);
}

// One file per runtime under resources/agents/profiles; the file name is the runtime id.
const profilesDir = path.join(root, 'resources', 'agents', 'profiles');
const profiles = {};
for (const file of (await readdir(profilesDir)).filter((f) => f.endsWith('.json')).sort()) {
  const runtime = file.slice(0, -'.json'.length);
  const group = JSON.parse(await readFile(path.join(profilesDir, file), 'utf8'));
  if (group.runtime !== runtime) errors.push(`${file}: runtime must be "${runtime}", got "${group.runtime}"`);
  if (!RUNTIMES.includes(runtime)) errors.push(`${file}: runtime ${runtime} is not declared in resources/tools.json`);
  if (typeof group.provider !== 'string') errors.push(`runtime ${runtime}: provider must be a string`);
  for (const [id, profile] of Object.entries(group.profiles ?? {})) {
    if (profiles[id]) errors.push(`profile ${id}: declared in more than one runtime`);
    profiles[id] = { ...profile, runtime, provider: group.provider };
  }
}
for (const [id, profile] of Object.entries(profiles)) {
  for (const tool of Object.keys(TOOLS)) {
    const supported = TOOLS[tool].support?.[profile.runtime]?.supported === true;
    if (typeof profile.capabilities?.[tool] !== 'boolean') errors.push(`profile ${id}: capabilities.${tool} must be true or false`);
    if (typeof profile.permits?.[tool] !== 'boolean') errors.push(`profile ${id}: permits.${tool} must be true or false`);
    if (profile.capabilities?.[tool] === true && !supported) errors.push(`profile ${id}: capabilities.${tool} is true but resources/tools.json says ${profile.runtime} does not support it`);
    if (profile.permits?.[tool] === true && profile.capabilities?.[tool] !== true) errors.push(`profile ${id}: permits.${tool} but capabilities.${tool} is false`);
  }
  for (const key of Object.keys(profile.permits ?? {})) if (!TOOLS[key]) errors.push(`profile ${id}: permits unknown tool ${key}`);
  if (profile.isolation !== 'fresh' || profile.forkTurns !== 'none') errors.push(`profile ${id}: material executions are fresh with no inherited turns`);
}

// Each operator binds one profile and declares its tools with modes.
const operatorsDir = path.join(root, 'operators');
const operators = new Map();
for (const entry of await readdir(operatorsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = JSON.parse(await readFile(path.join(operatorsDir, entry.name, 'operator.json'), 'utf8'));
  operators.set(manifest.id, manifest.resources);
}
const used = new Set();
for (const [id, resources] of operators) {
  if (!resources || typeof resources !== 'object') { errors.push(`${id}: operator.json must declare resources { profile, grammarBound, tools }`); continue; }
  const { profile: profileId, grammarBound, tools = {} } = resources;
  const profile = profiles[profileId];
  if (typeof profileId !== 'string' || !profile) { errors.push(`${id}: resources.profile ${profileId} is not a declared profile`); continue; }
  used.add(profileId);
  if (typeof grammarBound !== 'boolean') errors.push(`${id}: resources.grammarBound must be true or false`);
  if (resources.requires || resources.policy) errors.push(`${id}: resources.requires and resources.policy are retired; declare resources.tools`);
  for (const [ref, mode] of Object.entries(tools)) {
    const m = /^@tools\/([a-z][a-z0-9-]*)$/.exec(ref);
    if (!m) { errors.push(`${id}: tool ${ref} must be written @tools/<id>`); continue; }
    const tool = TOOLS[m[1]];
    if (!tool) { errors.push(`${id}: ${ref} is not in resources/tools.json`); continue; }
    if (!tool.modes[mode]) errors.push(`${id}: ${ref} mode ${mode} is not one of ${Object.keys(tool.modes).join(', ')}`);
    if (mode === 'never') errors.push(`${id}: ${ref} declared as never; leave it out instead`);
    if (!profile.permits?.[m[1]]) errors.push(`${id}: declares ${ref} but profile ${profileId} does not permit it`);
  }
  if (!tools['@tools/fileread']) errors.push(`${id}: every operator reads its Context aliases; declare @tools/fileread`);
}

// resources/INDEX.md repeats the bindings: | `operator` | profile | grammar | tools | why |
const index = await readFile(path.join(root, 'resources', 'INDEX.md'), 'utf8');
const GRAMMAR_WORD = { true: 'yes', false: 'no' };
const rows = new Map();
for (const line of index.split(/\r?\n/)) {
  const m = /^\| `([a-z.]+)` \| ([a-z-]+) \| (yes|no) \| ([^|]*) \|/.exec(line);
  if (m) rows.set(m[1], { profile: m[2], grammar: m[3], tools: m[4].trim() });
}
for (const [id, resources] of operators) {
  const row = rows.get(id);
  if (!row) { errors.push(`resources/INDEX.md: no process-matrix row for ${id}`); continue; }
  if (!resources) continue;
  const expectTools = Object.entries(resources.tools ?? {}).map(([k, v]) => `\`${k.split('/')[1]}:${v}\``).join(', ');
  const expect = { profile: resources.profile, grammar: GRAMMAR_WORD[resources.grammarBound], tools: expectTools };
  for (const key of Object.keys(expect)) if (row[key] !== expect[key]) errors.push(`resources/INDEX.md: ${id} row says ${key} "${row[key]}", operator.json says "${expect[key]}"`);
}
for (const id of rows.keys()) if (!operators.has(id)) errors.push(`resources/INDEX.md: row for unknown operator ${id}`);

// The orchestrator record turns operators into agents.
const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
if (orchestrator.agentPerOperator !== true) errors.push('orchestrator.json: agentPerOperator must be true');
if (!Number.isInteger(orchestrator.maxConcurrentAgents) || orchestrator.maxConcurrentAgents < 1 || orchestrator.maxConcurrentAgents > 3) errors.push('orchestrator.json: maxConcurrentAgents must be an integer from 1 to 3');
if (orchestrator.dispatch !== 'routing.json') errors.push('orchestrator.json: dispatch must be routing.json');
if (orchestrator.interactionPolicy !== 'resources/interaction.json') errors.push('orchestrator.json: interactionPolicy must name resources/interaction.json');
const interaction = JSON.parse(await readFile(path.join(root, 'resources/interaction.json'), 'utf8'));
if (interaction.schemaVersion !== 1 || !Array.isArray(interaction.questionKinds) || !interaction.questionKinds.length || interaction.questionKinds.some((kind) => typeof kind !== 'string' || !kind.trim())) errors.push('interaction.json: schemaVersion and questionKinds must declare a communication contract');
if (!Number.isInteger(interaction.minOptions) || !Number.isInteger(interaction.maxOptions) || interaction.minOptions < 1 || interaction.maxOptions < interaction.minOptions) errors.push('interaction.json: option bounds must be ordered positive integers');
if (!interaction.selectionSource || !interaction.rule || interaction.gate !== 'scripts/validate-interaction.mjs') errors.push('interaction.json: selectionSource, rule and interaction gate must be declared');
const pairs = orchestrator.profileEquivalents?.pairs ?? {};
for (const [id, profile] of Object.entries(profiles)) {
  const eq = pairs[id];
  if (!eq) { errors.push(`orchestrator.json: profileEquivalents lacks ${id}`); continue; }
  if (!profiles[eq]) errors.push(`orchestrator.json: profileEquivalents maps ${id} to unknown profile ${eq}`);
  else if (profiles[eq].runtime === profile.runtime) errors.push(`orchestrator.json: profileEquivalents maps ${id} to ${eq} on the same runtime`);
  else if (pairs[eq] !== id) errors.push(`orchestrator.json: profileEquivalents is not symmetric for ${id} and ${eq}`);
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`resources bound: ${RUNTIMES.length} runtimes, ${Object.keys(TOOLS).length} tools, ${Object.keys(profiles).length} profiles, ${operators.size} operators on ${used.size} profiles\n`);
}
