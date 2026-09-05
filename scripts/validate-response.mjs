// The response half of one branch (step-N/parallel-M/response/), checked after the agent stops: the
// gate schema; every Output the operator's operator.md declares is present when required and valid
// when present (markdown kinds through templates/kinds/<kind>.contract.json, data kinds through
// <kind>.schema.json, artifacts by existence); a blocked stop is a code the operator may emit whose
// effective disposition is terminate; a taken fallback is one whose effective disposition is fallback
// and is recorded under ## Fallbacks taken; a waiting status names a declared exchange; a nested
// exchange's own response is checked the same way. Effective means after `unless` is evaluated
// against request.json requirements. Operator-specific law lives in operators/<id>/validate.mjs.
import { existsSync } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { V22_CONTRACT } from './validate-request.mjs';
import { checkDocument, loadKindTemplates } from './validate-templates.mjs';
import { loadOperatorPackages, kindOf, isYes, exchangeOf } from './operator-md.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';
import { sessionRootOf } from './validate-request.mjs';
import { packageForOrigin } from './retired-operators.mjs';
import { loadInteractionPolicy, interactionErrors } from './validate-interaction.mjs';
import { secretErrors } from './sweep-secrets.mjs';

// Only a fully quoted cell is unquoted: a sentence that opens with a code span keeps its backticks.
const unquote = (s) => { const t = String(s ?? '').trim(); return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t; };

// Rows of the first table under `## <heading>`, cells unquoted.
export function tableUnder(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  const rows = [];
  let inTable = false;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    if (lines[i].startsWith('|') && /^\|\s*-{3,}/.test(lines[i + 1] ?? '')) { inTable = true; i += 1; continue; }
    if (inTable) { if (!lines[i].startsWith('|')) break; rows.push(lines[i].split('|').slice(1, -1).map((c) => unquote(c))); }
  }
  return rows;
}
// Whether a response hands the mission to a person: a blocked response routes by the domain of its
// stop through routing.json, a done one may name `user` in next. Both are read from the files that
// publish them, so the map keeps one home.
export async function userRouted(root, registry, operatorId, response) {
  if ((response?.next ?? []).includes('user')) return true;
  if (response?.status !== 'blocked') return false;
  const entry = registry?.codes?.[response.stop];
  if (!entry || entry.domain === 'self') return false;
  const routing = JSON.parse(await readFile(path.join(root, 'routing.json'), 'utf8'));
  return routing.routes?.[operatorId]?.[entry.domain]?.kind === 'user';
}

// The candidates a ## Printed table put in front of the person, keyed by candidate id with the
// viewports each was printed at. A candidate row is a served page `<candidateId>.html?viewport=<name>`
// or a capture `<candidateId>.<name>.png`, wherever it lives; a row of any other shape (the sheet, a
// worst capture per topic, a run summary) is not a candidate and is not counted.
export function printedCandidates(rows) {
  const out = new Map();
  for (const [artifact] of rows ?? []) {
    const cell = String(artifact ?? '').replace(/^`|`$/g, '');
    const [file, query = ''] = cell.split('?');
    const base = file.replace(/^.*\//, '');
    let id = null;
    let viewport = null;
    const q = /(?:^|&)viewport=([A-Za-z0-9-]+)/.exec(query);
    if (q && /\.html$/.test(base)) { id = base.replace(/\.html$/, ''); viewport = q[1]; }
    else { const m = /^([a-z0-9][a-z0-9-]*)\.([a-z0-9][a-z0-9-]*)\.png$/.exec(base); if (m) { id = m[1]; viewport = m[2]; } }
    if (!id) continue;
    if (!out.has(id)) out.set(id, new Set());
    out.get(id).add(viewport);
  }
  return out;
}

// @tools/print, decision-points: a design decision handed to a person reaches them as rendered
// candidates they pick by eye, never as prose alternatives. `options` are the ids the person is
// asked to choose between (every one must be printed), `minimum` is the floor for a composition or
// taste choice, `viewports` is how many captures each candidate carries, and `reason` is the stop's
// message, which names the sheet and asks one question and nothing more.
export function choiceHandoffErrors({ at, printedRows, options = [], minimum = options.length, viewports = 2, reason }) {
  const errors = [];
  const candidates = printedCandidates(printedRows);
  const needed = Math.max(minimum, options.length);
  if (candidates.size === 0) errors.push(`${at}: the choice is handed to the person as prose; ## Printed lists no rendered candidate, and a design decision reaches a person as rendered candidates they pick by eye`);
  for (const option of options) if (!candidates.has(option)) errors.push(`${at}: option ${option} is offered and never printed; every option the person is asked to choose between is a rendered candidate under ## Printed`);
  if (candidates.size && candidates.size < needed) errors.push(`${at}: ## Printed shows ${candidates.size} rendered candidate(s) for a choice of ${needed}; a composition or taste choice puts at least ${minimum} in front of the person and never fewer than the options`);
  for (const [id, seen] of candidates) if (seen.size < viewports) errors.push(`${at}: candidate ${id} is printed at ${seen.size} viewport(s) of ${viewports}; every candidate carries a capture per viewport`);
  const text = String(reason ?? '');
  if (!text.trim()) errors.push('response/response.json: a choice handed to a person carries a reason: the sheet URL and one question');
  else {
    if (/[\r\n]/.test(text)) errors.push('response/response.json: reason spans more than one line; the message to the person is the sheet URL and one question');
    if (!/https?:\/\/\S+/.test(text)) errors.push('response/response.json: reason names no served URL; the person is told where the candidates are, not what they look like');
    // One sentence, and that sentence a question: a clause that describes the options before asking
    // is the narration the print law refuses.
    const prose = text.replace(/https?:\/\/\S+/g, '').trim();
    const sentences = prose.split(/[.;!?]\s+|[.;!?]$/).filter((s) => s.trim()).length;
    if (sentences !== 1 || !/\?$/.test(prose)) errors.push('response/response.json: reason is not one question ending in "?"; the options are printed, not narrated');
  }
  return errors;
}

function patternOf(fileCell) {
  const esc = unquote(fileCell).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/<[^>]+>/g, '[A-Za-z0-9_.-]+');
  return new RegExp(`^${esc}$`);
}
export function effectiveDisposition(entry, requirements) {
  if (entry.unless && String(requirements?.[entry.unless.param] ?? '') === String(entry.unless.equals)) return entry.unless.then;
  return entry.disposition;
}

// The agent's own check against its branch goal (request.json.goal). A done response whose request
// serves a mission done-when line carries goalCheck { achieved, evidence }; every evidence path is a
// file this response's fields declare and that exists on disk; achieved true rests on at least one. A
// goalCheck that passes here is what validate-session counts as validator-accepted, and only those
// reach state.json.brief.proven. A nested exchange belongs to its branch and carries none.
export function goalCheckErrors(dir, response, goal, { rel = (f) => f, exchange = null } = {}) {
  const errors = [];
  const check = response?.goalCheck;
  const serves = goal?.doneWhen !== undefined;
  if (check === undefined) {
    if (serves && response?.status === 'done') errors.push(`${rel('response/response.json')}: the request serves mission doneWhen ${goal.doneWhen}, so a done response carries goalCheck { achieved, evidence }; the line is evidenced by files this receipt declares or it is not evidenced`);
    return errors;
  }
  if (exchange) errors.push(`${rel('response/response.json')}: a nested exchange carries no goalCheck; the branch it belongs to does`);
  const declared = new Set(Object.values(response.fields ?? {}).flatMap((v) => (Array.isArray(v) ? v : [v])));
  for (const p of check.evidence ?? []) {
    if (!declared.has(p)) errors.push(`${rel('response/response.json')}: goalCheck.evidence ${p} is not a file this response's fields declare; evidence is a declared output, never a path invented for the check`);
    else if (!existsSync(path.join(dir, p))) errors.push(`${rel(p)}: named as goalCheck evidence but missing`);
  }
  if (check.achieved === true && !(check.evidence ?? []).length) errors.push(`${rel('response/response.json')}: goalCheck.achieved is true with no evidence; an achieved done-when line is evidenced by at least one declared file`);
  return errors;
}

export function attemptContractErrors(dir, response, request, { rel = (f) => f } = {}) {
  const errors = [];
  const requestV22 = request?.contractVersion === V22_CONTRACT;
  const responseV22 = response?.contractVersion === V22_CONTRACT;
  if (requestV22 && !responseV22) errors.push(`${rel('response/response.json')}: contractVersion ${V22_CONTRACT} is required by the v2.2 request`);
  if (responseV22 && !requestV22) errors.push(`${rel('response/response.json')}: a v2.2 receipt cannot answer a legacy or unmarked request`);
  if (!requestV22 || !responseV22) return errors;
  const expected = request.expected ?? {};
  const attempt = request.attempt ?? {};
  if (response.attempt?.id !== attempt.id) errors.push(`${rel('response/response.json')}: attempt.id does not match request.attempt.id ${attempt.id}`);
  if (response.attempt?.number !== attempt.number) errors.push(`${rel('response/response.json')}: attempt.number does not match request.attempt.number ${attempt.number}`);
  if (response.attempt?.expectedVersion !== expected.version) errors.push(`${rel('response/response.json')}: attempt.expectedVersion does not match request.expected.version ${expected.version}`);
  if (response.status === 'running' || response.status === 'waiting') return errors;
  if (response.actual?.expectedVersion !== expected.version) errors.push(`${rel('response/response.json')}: actual.expectedVersion does not match frozen expected version ${expected.version}`);
  const observedAt = Date.parse(response.actual?.observedAt);
  if (!Number.isFinite(observedAt) || observedAt > Date.now() + 300_000) errors.push(`${rel('response/response.json')}: actual.observedAt is not a valid observation instant`);
  if (response.comparison?.expectedVersion !== expected.version) errors.push(`${rel('response/response.json')}: comparison.expectedVersion does not match frozen expected version ${expected.version}`);
  const criteria = new Map((expected.criteria ?? []).map((criterion) => [criterion.id, criterion]));
  const observations = new Map();
  for (const observation of response.actual?.observations ?? []) {
    if (observations.has(observation.criterionId)) errors.push(`${rel('response/response.json')}: actual repeats criterion ${observation.criterionId}`);
    observations.set(observation.criterionId, observation);
  }
  const comparisons = new Map();
  for (const comparison of response.comparison?.criteria ?? []) {
    if (comparisons.has(comparison.criterionId)) errors.push(`${rel('response/response.json')}: comparison repeats criterion ${comparison.criterionId}`);
    comparisons.set(comparison.criterionId, comparison);
  }
  const declared = new Set(Object.values(response.fields ?? {}).flatMap((value) => Array.isArray(value) ? value : [value]));
  for (const [id] of criteria) {
    if (!observations.has(id)) errors.push(`${rel('response/response.json')}: actual has no observation for expected criterion ${id}`);
    if (!comparisons.has(id)) errors.push(`${rel('response/response.json')}: comparison has no verdict for expected criterion ${id}`);
  }
  for (const [id, observation] of observations) {
    if (!criteria.has(id)) errors.push(`${rel('response/response.json')}: actual names unknown criterion ${id}`);
    for (const evidence of observation.evidence ?? []) {
      if (!declared.has(evidence)) errors.push(`${rel('response/response.json')}: actual evidence ${evidence} is not a declared output`);
      else if (!existsSync(path.join(dir, evidence))) errors.push(`${rel(evidence)}: actual evidence is missing`);
    }
  }
  for (const [id, comparison] of comparisons) {
    if (!criteria.has(id)) errors.push(`${rel('response/response.json')}: comparison names unknown criterion ${id}`);
    const observedEvidence = new Set(observations.get(id)?.evidence ?? []);
    for (const evidence of comparison.evidence ?? []) if (!observedEvidence.has(evidence)) errors.push(`${rel('response/response.json')}: comparison evidence ${evidence} for ${id} was not observed by this attempt`);
  }
  const requiredVerdicts = [...criteria].filter(([, criterion]) => criterion.required).map(([id]) => comparisons.get(id)?.verdict ?? 'inconclusive');
  const derived = requiredVerdicts.includes('mismatched') ? 'mismatched' : requiredVerdicts.includes('inconclusive') ? 'inconclusive' : 'matched';
  if (response.comparison?.verdict !== derived) errors.push(`${rel('response/response.json')}: comparison.verdict ${response.comparison?.verdict ?? 'missing'} disagrees with required criteria (${derived})`);
  if (response.status === 'done' && (derived !== 'matched' || response.comparison?.next !== 'advance')) errors.push(`${rel('response/response.json')}: status done advances only after every required criterion matched and comparison.next is advance`);
  if (response.status === 'mismatch' && (derived === 'matched' || !['repair', 'retry', 'blocked'].includes(response.comparison?.next))) errors.push(`${rel('response/response.json')}: status mismatch records a mismatched or inconclusive comparison and chooses repair, retry or blocked`);
  if (response.status === 'mismatch' && (response.next ?? []).length) errors.push(`${rel('response/response.json')}: a mismatch does not route to the next operator; attempt-gate records repair or retry first`);
  if (response.goalCheck?.achieved === true && derived !== 'matched') errors.push(`${rel('response/response.json')}: goalCheck cannot be achieved while required expected criteria are ${derived}`);
  return errors;
}

async function loadProfiles(root) {
  const profiles = {};
  const profilesDir = path.join(root, 'resources', 'agents', 'profiles');
  for (const file of (await readdir(profilesDir)).filter((name) => name.endsWith('.json')).sort()) {
    const group = JSON.parse(await readFile(path.join(profilesDir, file), 'utf8'));
    for (const [id, profile] of Object.entries(group.profiles ?? {})) profiles[id] = { ...profile, runtime: group.runtime };
  }
  return profiles;
}

export async function profileReceiptErrors(root, pkg, response, { renamed = false, at = 'response/response.json' } = {}) {
  if (response?.contractVersion !== V22_CONTRACT) return [];
  const errors = [];
  const bound = response.boundProfile;
  const ran = response.ranProfile;
  const requiresRan = response.status !== 'running';
  const expected = pkg?.manifest?.resources?.profile;
  if (typeof bound !== 'string') errors.push(`${at}: every v2.2 receipt records boundProfile`);
  if (requiresRan && typeof ran !== 'string') errors.push(`${at}: every completed or waiting v2.2 receipt records the profile that actually ran as ranProfile`);
  if (typeof bound !== 'string') return errors;
  if (!renamed && bound !== expected) errors.push(`${at}: boundProfile ${bound} is not the profile ${pkg.en.id} binds (${expected})`);

  const [profiles, orchestrator] = await Promise.all([
    loadProfiles(root),
    readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8').then(JSON.parse)
  ]);
  if (!profiles[bound]) errors.push(`${at}: boundProfile ${bound} is not a declared profile`);
  else if (profiles[bound].retired === true) errors.push(`${at}: boundProfile ${bound} is retired and cannot bind a v2.2 run`);
  if (typeof ran === 'string' && !profiles[ran]) errors.push(`${at}: ranProfile ${ran} is not a declared profile`);
  else if (typeof ran === 'string' && profiles[ran].retired === true) errors.push(`${at}: ranProfile ${ran} is retired and cannot run a v2.2 attempt`);

  const equivalent = orchestrator.profileEquivalents?.pairs?.[bound];
  if (typeof ran === 'string' && ran !== bound && ran !== equivalent) errors.push(`${at}: ranProfile ${ran} is neither boundProfile ${bound} nor its configured equivalent ${equivalent ?? '(none)'}`);
  return errors;
}

const outcomeKinds = new Set(['image', 'table', 'code', 'diagram', 'document', 'link']);
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
};

async function ownedArtifactErrors(dir, ref, kind, at) {
  const errors = [];
  const branch = path.resolve(dir);
  const absolute = path.resolve(branch, ref);
  if (!inside(branch, absolute)) return [`${at}.ref: ${ref} leaves its attempt branch`];
  let current = absolute;
  try {
    while (inside(branch, current)) {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) return [`${at}.ref: ${ref} crosses a symbolic link`];
      if (current === absolute && !stat.isFile()) return [`${at}.ref: ${ref} is not a regular file`];
      current = path.dirname(current);
    }
  } catch (error) {
    return [`${at}.ref: ${ref} is not a readable owned artifact (${error.code ?? error.message})`];
  }
  let bytes;
  try { bytes = await readFile(absolute); }
  catch (error) { return [`${at}.ref: ${ref} is not readable (${error.code ?? error.message})`]; }
  if (bytes.length === 0) errors.push(`${at}.ref: ${ref} is empty`);
  if (kind !== 'image' && !bytes.toString('utf8').trim()) errors.push(`${at}.ref: ${ref} has no readable content`);
  if (kind === 'image' && bytes.length) {
    const ext = path.extname(absolute).toLowerCase();
    const png = bytes.length >= 33
      && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      && bytes.subarray(12, 16).toString('ascii') === 'IHDR'
      && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0
      && bytes.subarray(bytes.length - 8, bytes.length - 4).toString('ascii') === 'IEND';
    const jpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    const webp = bytes.length >= 16 && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length;
    const svgText = ext === '.svg' ? bytes.toString('utf8').replace(/^\uFEFF/, '') : '';
    const svg = ext === '.svg' && !svgText.includes('\u0000') && /^(?:\s*<\?xml[^>]*>\s*)?(?:\s*<!--[^]*?-->\s*)*<svg(?:\s|>)/i.test(svgText)
      && /(?:<\/svg>\s*$|<svg[^>]*\/\s*>\s*$)/i.test(svgText);
    const valid = (ext === '.png' && png) || (['.jpg', '.jpeg'].includes(ext) && jpeg) || (ext === '.webp' && webp) || svg;
    if (!valid) errors.push(`${at}.ref: ${ref} is not a valid PNG, JPEG, WebP or SVG image matching its extension`);
  }
  return errors;
}

export async function loadOutcomeRegistry(root) {
  const file = path.join(root, 'resources', 'outcomes.json');
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Error(`resources/outcomes.json: ${error.message}`); }
}

// The accepted result is reviewable before routing: it selects a declared, operator-owned output;
// outcomes.json says which presentation kinds that output type can support; and the selected files
// are real, readable evidence. Array-valued fields are flattened so an operator can select one
// candidate capture without copying or rewriting it after the receipt is sealed.
export async function outcomeErrors(root, dir, response, pkg, { exchange = null, rel = (f) => f, registry: suppliedRegistry } = {}) {
  if (response?.contractVersion !== V22_CONTRACT) return [];
  const at = rel('response/response.json');
  if (response.status !== 'done') return response.outcome === undefined ? [] : [`${at}: outcome is reserved for an accepted done result; ${response.status} reports its truthful typed state without a best-outcome block`];
  if (!response.outcome) return [`${at}: every v2.2 done receipt selects outcome.primary for “The best outcome”`];
  let outcomeRegistry = suppliedRegistry;
  if (!outcomeRegistry) {
    try { outcomeRegistry = await loadOutcomeRegistry(root); }
    catch (error) { return [error.message]; }
  }
  const errors = [];
  if (outcomeRegistry?.schemaVersion !== 1 || !outcomeRegistry.kinds || !outcomeRegistry.operators) {
    return ['resources/outcomes.json: expected schemaVersion 1 with kinds and operators maps'];
  }
  const operatorRule = outcomeRegistry.operators[response.operatorId];
  if (!operatorRule || !Array.isArray(operatorRule.primaryKinds)) errors.push(`resources/outcomes.json: no primaryKinds policy for ${response.operatorId}`);

  const outputs = (pkg?.en?.tables?.outputs?.rows ?? []).filter((row) => exchangeOf(unquote(row.file)) === exchange);
  const fieldTypes = new Map();
  for (const row of outputs) {
    const field = kindOf(row.kind);
    if (!fieldTypes.has(field)) fieldTypes.set(field, new Set());
    fieldTypes.get(field).add(String(row.type ?? '').trim());
  }
  const declared = new Map();
  for (const [field, value] of Object.entries(response.fields ?? {})) {
    for (const ref of Array.isArray(value) ? value : [value]) {
      if (!declared.has(ref)) declared.set(ref, new Set());
      declared.get(ref).add(field);
    }
  }
  const items = [response.outcome.primary, ...(response.outcome.secondary ?? [])];
  const seen = new Set();
  for (const [index, item] of items.entries()) {
    const itemAt = `${at}.outcome.${index === 0 ? 'primary' : `secondary[${index - 1}]`}`;
    if (!item || !outcomeKinds.has(item.kind) || typeof item.ref !== 'string') continue; // Structural errors come from response.schema.json.
    if (seen.has(item.ref)) errors.push(`${itemAt}.ref: ${item.ref} is already selected; outcome links each artifact once`);
    seen.add(item.ref);
    if (index === 0 && operatorRule && !operatorRule.primaryKinds.includes(item.kind)) errors.push(`${itemAt}.kind: ${item.kind} is not an allowed primary kind for ${response.operatorId}`);
    const kindRule = outcomeRegistry.kinds[item.kind];
    if (!kindRule || !Array.isArray(kindRule.responseTypes)) errors.push(`resources/outcomes.json: kind ${item.kind} has no responseTypes policy`);
    const fields = declared.get(item.ref);
    if (!fields) errors.push(`${itemAt}.ref: ${item.ref} is not one of response.fields, so the operator does not own it as evidence`);
    else if (kindRule) {
      const compatible = [...fields].some((field) => [...(fieldTypes.get(field) ?? [])].some((type) => kindRule.responseTypes.includes(type)));
      if (!compatible) errors.push(`${itemAt}: ${item.kind} cannot present ${item.ref}; its declared Output type is outside ${kindRule.responseTypes.join('|')}`);
    }
    errors.push(...await ownedArtifactErrors(dir, item.ref, item.kind, itemAt));
  }
  return errors;
}
// The goal the branch's request carried, read from disk when the caller did not pass it.
async function requestOf(dir, exchange) {
  const file = path.join(exchange ? path.dirname(dir) : dir, 'request', 'request.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

// `dir` is the branch (or exchange) folder; `requirements` and `goal` come from the branch's request.json.
// `origin` is set only by scripts/producer-import.mjs#originAuthority, which revalidates another
// session's frozen producer before importing it: the origin's status, fields, typed outputs, stops
// and secrets are judged by this tree, but its `next` is the routing history of the tree that ran it
// and is not a typed output, so a hand-off to an operator this tree renamed or retired is not read.
export async function validateResponse(root, dir, { requirements = {}, exchange = null, goal, packages, kinds, registry, origin = false } = {}) {
  const errors = [];
  const rel = (f) => path.relative(sessionRootOf(dir) ?? dir, path.join(dir, f)).split(path.sep).join('/');
  const file = path.join(dir, 'response', 'response.json');
  if (!existsSync(file)) return { errors: [`${rel('response/response.json')}: missing`], response: null, present: new Set() };
  let response; try { response = JSON.parse(await readFile(file, 'utf8')); } catch (e) { return { errors: [`${rel('response/response.json')}: ${e.message}`], response: null, present: new Set() }; }
  const request = await requestOf(dir, exchange);
  const schema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'response.schema.json'), 'utf8'));
  errors.push(...validateAgainst(schema, response, rel('response/response.json')));
  const stateFile = path.join(sessionRootOf(dir) ?? dir, 'state.json');
  let choices = {};
  if (existsSync(stateFile)) {
    try { choices = JSON.parse(await readFile(stateFile, 'utf8')).choices ?? {}; }
    catch (e) { errors.push(`state.json: ${e.message}`); }
  }
  errors.push(...interactionErrors(await loadInteractionPolicy(root), response.interaction, choices, response.status));
  // The skeleton the orchestrator wrote at dispatch: the agent has not answered, so nothing routes.
  if (response.status === 'running') errors.push(`${rel('response/response.json')}: status running is the dispatch skeleton, not a receipt; the agent replaces it with done, blocked or waiting, and an agent that exits leaving it is RECEIPT_MISSING`);
  // A sealed value never reaches a receipt, an artifact or a log an agent kept.
  errors.push(...secretErrors(path.join(dir, 'response'), { relativeTo: sessionRootOf(dir) ?? dir }));
  errors.push(...attemptContractErrors(dir, response, request, { rel }));
  // The branch goal is answered in the receipt: a done branch that serves a done-when line says whether it evidenced it.
  errors.push(...goalCheckErrors(dir, response, goal === undefined ? request?.goal ?? null : goal, { rel, exchange }));
  if (response.status !== 'blocked' && response.stop !== undefined) errors.push(`${rel('response/response.json')}: only a blocked response carries a stop`);
  if (response.status !== 'waiting' && response.awaiting !== undefined) errors.push(`${rel('response/response.json')}: only a waiting response carries awaiting`);
  if ((response.exchange ?? null) !== exchange) errors.push(`${rel('response/response.json')}: exchange ${response.exchange ?? 'none'} does not match the folder ${exchange ?? 'none'}`);
  packages ??= await loadOperatorPackages(root);
  // An origin frozen under an older tree may name an id this tree retired: it is judged by the package that produces its kinds today (operators/retired.json).
  const pkg = packages.find((p) => p.manifest.id === response.operatorId) ?? (origin ? packageForOrigin(root, packages, response.operatorId) : null);
  if (!pkg) { errors.push(`response.json: unknown operator ${response.operatorId}`); return { errors, response, present: new Set() }; }
  if (pkg.shape !== 'v9') { errors.push(`${response.operatorId} is not an operator.md package`); return { errors, response, present: new Set() }; }
  kinds ??= await loadKindTemplates(root);
  registry ??= await loadErrorsRegistry(root);
  errors.push(...registry.errors);
  const op = pkg.en;
  // An origin frozen under a retired id owed the outputs, file names, sections and profile of its own operator and
  // tree, not its successor's: it is judged on the outputs it declares — each file present and readable, each data
  // kind against its schema — and not on today's required outputs, declared file patterns, markdown contracts or
  // profile, which are this tree's history, exactly as `next` and the operator id are. An origin of an operator
  // that still exists owes today's contract in full.
  const renamed = origin && pkg.manifest.id !== response.operatorId;

  // Which Outputs belong to this folder: the branch owns files without an exchange prefix, an exchange owns its own.
  const outputs = (op.tables.outputs?.rows ?? []).filter((r) => exchangeOf(unquote(r.file)) === exchange);
  const present = new Set();
  for (const row of outputs) {
    const kind = kindOf(row.kind);
    const type = row.type.trim();
    // Inside an exchange folder the declared file is <exchange>/response/x; the response.json there lists response/x.
    const declaredFile = exchange ? unquote(row.file).replace(`${exchange}/`, '') : unquote(row.file);
    const value = response.fields?.[kind];
    const files = value === undefined ? [] : Array.isArray(value) ? value : [value];
    if (files.length === 0) { if (isYes(row.required) && response.status === 'done' && !renamed) errors.push(`${rel('response/response.json')}: required output ${kind} is not in fields`); continue; }
    present.add(kind);
    const re = patternOf(declaredFile);
    for (const f of files) {
      if (!re.test(f) && !renamed) errors.push(`${rel('response/response.json')}: fields.${kind} = ${f} does not match the declared file ${declaredFile}`);
      const full = path.join(dir, f);
      if (!existsSync(full)) { errors.push(`${rel(f)}: listed in response.json but missing`); continue; }
      if (type === 'md') {
        if (renamed) continue;
        const contract = kinds.get(kind);
        if (!contract) { errors.push(`templates/kinds/${kind}.contract.json: missing`); continue; }
        errors.push(...checkDocument(rel(f), await readFile(full, 'utf8'), contract, 'en'));
      } else if (type === 'data') {
        const schemaPath = path.join(root, 'templates', 'kinds', `${kind}.schema.json`);
        if (!existsSync(schemaPath)) { errors.push(`templates/kinds/${kind}.schema.json: missing`); continue; }
        let value2; try { value2 = JSON.parse(await readFile(full, 'utf8')); } catch (e) { errors.push(`${rel(f)}: ${e.message}`); continue; }
        errors.push(...validateAgainst(JSON.parse(await readFile(schemaPath, 'utf8')), value2, rel(f)));
      }
    }
  }
  for (const kind of Object.keys(response.fields ?? {})) if (!outputs.some((r) => kindOf(r.kind) === kind)) errors.push(`${rel('response/response.json')}: fields.${kind} is not an Output of ${op.id}${exchange ? ` in exchange ${exchange}` : ''}`);
  errors.push(...await outcomeErrors(root, dir, response, pkg, { exchange, rel }));

  // Stops, fallbacks, waiting.
  const stopsTable = new Set((op.tables.stops?.rows ?? []).map((r) => unquote(r.code)));
  const dispositionOf = (code) => { const e = registry.codes[code]; return e && registry.allowed(code, op.id) ? effectiveDisposition(e, requirements) : null; };
  if (response.status === 'blocked') {
    const d = dispositionOf(response.stop);
    // A code the orchestrator writes on the agent's behalf (UNKNOWN_STOP, RECEIPT_MISSING, BUDGET_EXHAUSTED)
    // is declared by the registry's writer field, never by an operator's Stops table.
    if (registry.codes[response.stop]?.writer !== 'orchestrator' && !stopsTable.has(response.stop)) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not in the Stops table of ${op.id}`);
    if (d === null) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not a registered code ${op.id} may emit`);
    else if (d !== 'terminate') errors.push(`${rel('response/response.json')}: ${response.stop} has disposition fallback under these requirements; the step should have continued`);
  }
  for (const code of response.fallbacks ?? []) {
    const d = dispositionOf(code);
    if (!stopsTable.has(code)) errors.push(`${rel('response/response.json')}: fallback ${code} is not in the Stops table of ${op.id}`);
    if (d === null) errors.push(`${rel('response/response.json')}: fallback ${code} is not a registered code ${op.id} may emit`);
    else if (d !== 'fallback') errors.push(`${rel('response/response.json')}: ${code} has disposition terminate under these requirements; it cannot be taken as a fallback`);
  }
  if (response.status === 'waiting') {
    const declared = (op.tables.outputs?.rows ?? []).filter((r) => exchangeOf(unquote(r.file)) === response.awaiting?.exchange);
    if (!declared.length) errors.push(`${rel('response/response.json')}: awaiting exchange ${response.awaiting?.exchange} is declared by no Output of ${op.id}`);
    else if (!declared.some((r) => kindOf(r.kind) === response.awaiting?.kind)) errors.push(`${rel('response/response.json')}: awaiting kind ${response.awaiting?.kind} is not produced by exchange ${response.awaiting?.exchange}`);
  }
  const mainMd = outputs.find((r) => /\/response\.md$/.test(unquote(r.file)));
  if (mainMd && present.has(kindOf(mainMd.kind))) {
    const text = await readFile(path.join(dir, 'response', 'response.md'), 'utf8');
    const taken = (tableUnder(text, '## Fallbacks taken') ?? []).map(([c]) => c);
    const declaredTaken = new Set(response.fallbacks ?? []);
    for (const c of taken) if (!declaredTaken.has(c)) errors.push(`${rel('response/response.md')}: Fallbacks taken lists ${c}, which response.json does not`);
    for (const c of declaredTaken) if (!taken.includes(c)) errors.push(`${rel('response/response.json')}: fallback ${c} is not recorded under ## Fallbacks taken in response.md`);
  }
  // next names only what the operator's own Next table offers (or user / external); a workflow cannot add a hand-off the operator does not declare.
  // An imported origin is exempt from this one check and nothing else (see `origin` above).
  const nextTable = new Set((op.tables.next?.rows ?? []).map((r) => unquote(r.operator)));
  for (const nextId of origin ? [] : response.next ?? []) {
    if (nextId === 'user' || nextId === 'external') continue;
    if (!packages.some((p) => p.manifest.id === nextId)) errors.push(`${rel('response/response.json')}: next names unknown operator ${nextId}`);
    else if (!nextTable.has(nextId)) errors.push(`${rel('response/response.json')}: next names ${nextId}, which the Next table of ${op.id} does not offer`);
  }
  // Every v2.2 receipt records both the bound profile and the active profile that actually ran. The
  // latter is either the binding itself or the one configured cross-runtime equivalent.
  errors.push(...await profileReceiptErrors(root, pkg, response, { renamed, at: rel('response/response.json') }));
  if (exchange && (response.next ?? []).length) errors.push(`${rel('response/response.json')}: a nested exchange does not route; next must be empty`);
  return { errors, response, present, pkg };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/validate-response.mjs <session>/step-N/parallel-M[/<exchange>]\n'); process.exit(2); }
  const dir = path.resolve(target);
  // A branch is <session>/step-N/parallel-M (its parent is step-N); an exchange is <branch>/<exchange> (its parent is parallel-M).
  const exchange = /^step-\d+$/.test(path.basename(path.dirname(dir))) ? null : path.basename(dir);
  const run = async () => {
    let requirements = {};
    let goal = null;
    const reqFile = path.join(exchange ? path.dirname(dir) : dir, 'request', 'request.json');
    if (existsSync(reqFile)) { const request = JSON.parse(await readFile(reqFile, 'utf8')); requirements = request.requirements ?? {}; goal = request.goal ?? null; }
    return validateResponse(root, dir, { requirements, exchange, goal });
  };
  run().then(({ errors }) => {
    if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('response valid\n');
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
