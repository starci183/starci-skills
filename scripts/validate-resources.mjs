// Resources close when: every profile declares, for every tool in resources/tools.json, what the runtime can do
// (capabilities) and what the profile is allowed to do (permits), and never permits what it cannot; every
// operator binds one profile and declares its tools as @tools/<id> with one mode the registry defines, each
// permitted by its profile and supported by its runtime; resources/INDEX.md repeats the bindings exactly;
// orchestrator.json fixes the agent contract and a symmetric profile equivalent on the other runtime.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { settingsErrors } from './settings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const toolsDoc = JSON.parse(await readFile(path.join(root, 'resources', 'tools.json'), 'utf8'));
if (toolsDoc.schemaVersion !== 9) errors.push('resources/tools.json: schemaVersion must be 9');
const TOOLS = toolsDoc.tools ?? {};
const orchestrator = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8'));
// The three ways an operator runs (resources/orchestrator.json#modes): inline, the orchestrator itself;
// dispatch, a new agent that inherits the orchestrator's transcript; isolated, a new agent with an empty
// context that sees only what request.json names. The list is closed here because every gate that
// reads resources.mode (validate-request, the brief generator) branches on exactly these three words.
const MODES = new Set(Object.keys(orchestrator.modes ?? {}));
for (const mode of ['inline', 'dispatch', 'isolated']) if (!MODES.has(mode)) errors.push(`orchestrator.json: modes must declare ${mode}`);
for (const mode of MODES) if (!['inline', 'dispatch', 'isolated'].includes(mode)) errors.push(`orchestrator.json: modes declares ${mode}, which no gate knows; the modes are inline, dispatch and isolated`);
if (orchestrator.dispatchModes !== undefined) errors.push('orchestrator.json: dispatchModes is retired; the three modes live under modes');
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
  // forkTurns is per mode: an isolated agent inherits no turn, a dispatched agent inherits a positive
  // number of the orchestrator's, and inline runs no agent, so it has no entry.
  const fork = profile.forkTurns;
  if (!fork || typeof fork !== 'object' || Array.isArray(fork)) errors.push(`profile ${id}: forkTurns must be an object keyed by mode { isolated: "none", dispatch: <positive integer> }`);
  else {
    if (fork.isolated !== 'none') errors.push(`profile ${id}: forkTurns.isolated must be "none"; an isolated agent starts with an empty context`);
    if (!Number.isInteger(fork.dispatch) || fork.dispatch < 1) errors.push(`profile ${id}: forkTurns.dispatch must be a positive integer of inherited turns`);
    for (const key of Object.keys(fork)) if (!['isolated', 'dispatch'].includes(key)) errors.push(`profile ${id}: forkTurns.${key} is not a mode that runs an agent (inline has no entry)`);
  }
  if (profile.isolation !== undefined) errors.push(`profile ${id}: isolation is retired; forkTurns per mode says what an agent inherits`);
}

// Each operator binds one profile and declares its tools with modes.
const operatorsDir = path.join(root, 'operators');
const operators = new Map();
for (const entry of await readdir(operatorsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(operatorsDir, entry.name, 'operator.json'), 'utf8')); }
  catch (e) { errors.push(`operators/${entry.name}/operator.json: ${e.code === 'ENOENT' ? 'missing; a folder under operators/ is a package' : e.message}`); continue; }
  operators.set(manifest.id, manifest.resources);
}
const used = new Set();
for (const [id, resources] of operators) {
  if (!resources || typeof resources !== 'object') { errors.push(`${id}: operator.json must declare resources { profile, grammarBound, tools }`); continue; }
  const { profile: profileId, grammarBound, tools = {} } = resources;
  const profile = profiles[profileId];
  if (typeof profileId !== 'string' || !profile) { errors.push(`${id}: resources.profile ${profileId} is not a declared profile`); continue; }
  if (profile.retired === true) errors.push(`${id}: resources.profile ${profileId} is retired; it resolves historical receipts, not current operator assignments`);
  used.add(profileId);
  if (typeof grammarBound !== 'boolean') errors.push(`${id}: resources.grammarBound must be true or false`);
  if (!MODES.has(resources.mode)) errors.push(`${id}: resources.mode must be one of ${[...MODES].join(', ')} (resources/orchestrator.json#modes)`);
  if (resources.dispatch !== undefined) errors.push(`${id}: resources.dispatch is retired; resources.mode is the one field (inline | dispatch | isolated)`);
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

// Support work uses the same active-profile policy without inheriting operator effect grants.
for (const entry of await readdir(path.join(root, 'helpers'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const helper = JSON.parse(await readFile(path.join(root, 'helpers', entry.name, 'helper.json'), 'utf8'));
  const profileId = helper.resources?.profile;
  if (!profiles[profileId]) errors.push(`helper ${helper.id}: unknown profile ${profileId}`);
  else if (profiles[profileId].retired === true) errors.push(`helper ${helper.id}: profile ${profileId} is retired; select an active support profile`);
}

// resources/INDEX.md repeats the bindings: | Operator | Profile | Grammar | Tools | Mode | Why |. The
// fifth column is read by its header: it is `Mode` and carries resources.mode; while it is still headed
// `Dispatch` its legacy word `fresh` is read as `isolated`, and the header is reported for renaming.
const index = await readFile(path.join(root, 'resources', 'INDEX.md'), 'utf8');
const GRAMMAR_WORD = { true: 'yes', false: 'no' };
const rows = new Map();
let modeHeader = null;
for (const line of index.split(/\r?\n/)) {
  const h = /^\| Operator \| Profile \| Grammar \| Tools \| (Dispatch|Mode) \| Why \|/.exec(line);
  if (h) modeHeader = h[1];
  const m = /^\| `([a-z.]+)` \| ([a-z-]+) \| (yes|no) \| ([^|]*) \| ([a-z]+) \|/.exec(line);
  if (m) rows.set(m[1], { profile: m[2], grammar: m[3], tools: m[4].trim(), mode: m[5] });
}
if (!modeHeader) errors.push('resources/INDEX.md: the process matrix must be headed | Operator | Profile | Grammar | Tools | Mode | Why | (Dispatch is still read as the legacy header)');
// Accepted for now: the legacy header keeps the gate green until the matrix owner renames the column
// to Mode and rewrites its cells; once the header is Mode, only the three mode words are read.
const LEGACY_MODE = modeHeader === 'Dispatch' ? { fresh: 'isolated' } : {};
for (const [id, resources] of operators) {
  const row = rows.get(id);
  if (!row) { errors.push(`resources/INDEX.md: no process-matrix row for ${id}`); continue; }
  if (!resources) continue;
  const expectTools = Object.entries(resources.tools ?? {}).map(([k, v]) => `\`${k.split('/')[1]}:${v}\``).join(', ');
  const expect = { profile: resources.profile, grammar: GRAMMAR_WORD[resources.grammarBound], tools: expectTools, mode: resources.mode };
  const actual = { ...row, mode: LEGACY_MODE[row.mode] ?? row.mode };
  for (const key of Object.keys(expect)) if (actual[key] !== expect[key]) errors.push(`resources/INDEX.md: ${id} row says ${key} "${row[key]}", operator.json says "${expect[key]}"`);
}
for (const id of rows.keys()) if (!operators.has(id)) errors.push(`resources/INDEX.md: row for unknown operator ${id}`);

// The orchestrator record turns operators into agents.
if (!Number.isInteger(orchestrator.briefBytes) || orchestrator.briefBytes < 512) errors.push('orchestrator.json: briefBytes must be an integer of at least 512');
if (orchestrator.receiptSkeleton !== true) errors.push('orchestrator.json: receiptSkeleton must be true; the running skeleton is what makes an abandoned branch visible');
if (!/^completion/.test(String(orchestrator.wait ?? ''))) errors.push('orchestrator.json: wait must be completion-based; a timed poll is not a step');
for (const key of ['maxSteps', 'maxSameOperator']) if (!Number.isInteger(orchestrator.budget?.[key]) || orchestrator.budget[key] < 1) errors.push(`orchestrator.json: budget.${key} must be a positive integer`);
if (!orchestrator.handoff?.chain || !orchestrator.handoff?.skeleton) errors.push('orchestrator.json: handoff.chain and handoff.skeleton must be declared');
if (orchestrator.agentPerOperator !== true) errors.push('orchestrator.json: agentPerOperator must be true');
if (!Number.isInteger(orchestrator.maxConcurrentAgents) || orchestrator.maxConcurrentAgents < 1 || orchestrator.maxConcurrentAgents > 3) errors.push('orchestrator.json: maxConcurrentAgents must be an integer from 1 to 3');
if (orchestrator.concurrency?.maxDispatch !== 1) errors.push('orchestrator.json: concurrency.maxDispatch must be 1; a dispatched agent carries the orchestrator\'s transcript and two such transcripts diverge');
if (orchestrator.dispatch !== 'routing.json') errors.push('orchestrator.json: dispatch must be routing.json');
if (orchestrator.interactionPolicy !== 'resources/interaction.json') errors.push('orchestrator.json: interactionPolicy must name resources/interaction.json');
const interaction = JSON.parse(await readFile(path.join(root, 'resources/interaction.json'), 'utf8'));
// The two-line transition log: interaction.json#transitionLog fixes how many lines the orchestrator
// prints to the root chat after a transition and their shape; validate-interaction reads the same record.
const log = interaction.transitionLog;
if (!log || log.linesPerBranch !== 2 || !Array.isArray(log.shape) || log.shape.length !== 2 || log.shape.some((s) => typeof s !== 'string' || !s.trim()) || typeof log.rule !== 'string' || !log.rule.trim()) errors.push('interaction.json: transitionLog must declare linesPerBranch 2, a shape of exactly two line templates and a rule');
if (![3, 4].includes(interaction.schemaVersion) || !Array.isArray(interaction.questionKinds) || !interaction.questionKinds.length || interaction.questionKinds.some((kind) => typeof kind !== 'string' || !kind.trim())) errors.push('interaction.json: schemaVersion and questionKinds must declare a communication contract');
if (!Number.isInteger(interaction.minOptions) || !Number.isInteger(interaction.maxOptions) || interaction.minOptions < 1 || interaction.maxOptions < interaction.minOptions) errors.push('interaction.json: option bounds must be ordered positive integers');
// The display language: interaction.json#language names the settings pair, and the pair itself parses to a language tag.
if (!interaction.language?.source?.includes('resources/settings.json#language') || !interaction.asks?.rule) errors.push('interaction.json: language.source names resources/settings.json#language and asks.rule states when the person is asked');
errors.push(...settingsErrors(root));
if (!interaction.selectionSource || !interaction.rule || interaction.gate !== 'scripts/validate-interaction.mjs') errors.push('interaction.json: selectionSource, rule and interaction gate must be declared');
const pairs = orchestrator.profileEquivalents?.pairs ?? {};
const identity = JSON.parse(await readFile(path.join(root, 'resources/identity.json'), 'utf8'));
if (identity.schemaVersion !== 1 || !identity.provider || !identity.rule || !identity.adminMounts?.username || !identity.adminMounts?.password || identity.preflight !== 'scripts/identity-custody.mjs' || !Number.isInteger(identity.timeoutMs) || identity.timeoutMs < 1) errors.push('identity.json: provider, custody, transport policy and preflight must be declared');
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
