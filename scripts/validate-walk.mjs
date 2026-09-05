// The gate on a declarative browser walk (templates/kinds/uat-walk.schema.json) and on what a run of
// it produces. The schema states the shape; the relations it cannot state are read here, once, so the
// runner, the two operators' validators and the spec share one reading of a walk: step ids are unique;
// the first step is the one goto and goes to entry.route, and no later step navigates; a capture name
// is unique; an action step names a target and a goto, wait or capture step names none; an expect step
// carries an expectation and every other step carries none; a fill on a field whose name reads as a
// password or secret takes a credential by name, the name is the account's, and no other fill takes
// one; a UAT walk's assertions name a frozen case with a capture of the case's own name, taken after
// the sign-in redirect has landed. The sweep refuses, in a walk or in anything a run wrote, a
// credential-shaped value and the three spellings of agent-authored browser code (page.evaluate,
// page.request, locator( ) — a walk carries targets, never code. The
// sweep reads the walk folder, the kind captures and the artifacts under a response folder, and
// nothing else: the tree's own scripts are code by design and are never its input. The origin check
// reads a narrower set still — what the agent itself wrote — because the runner's records of the page
// carry the page's own bytes.
//
// A control has two spellings here, for two questions. `stepControl` answers what a step's observation
// is evidence of — its own target, else the nearest earlier target pressed, else the entry — and is
// what an assertion and an audit capture carry. `stepOwnControl` answers what the step itself named —
// its own target, `entry <route>` for the goto, null otherwise — and is what the runner's ledger
// carries, so a targetless step never reads as though the previous control were at fault.
//
// A run also writes one capture-measurements record per capture (templates/kinds/
// capture-measurements.schema.json); the result names it, this gate checks its shape, and
// `citedMeasurement` resolves the ref-and-property citation an audit verdict carries against it.
//
//   node scripts/validate-walk.mjs <walk.json> [<response dir>]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { SECRET_PATTERNS, PASSWORD_LEAK } from './sweep-secrets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WALK_SCHEMA = path.join('templates', 'kinds', 'uat-walk.schema.json');
export const RESULT_SCHEMA = path.join('templates', 'kinds', 'walk-result.schema.json');
export const MEASUREMENTS_SCHEMA = path.join('templates', 'kinds', 'capture-measurements.schema.json');
// A field whose accessible name reads as a secret takes its value by credential name and never as text.
export const SECRET_FIELD = /password|passcode|passphrase|secret|\btoken\b|\bpin\b|otp|mật khẩu/i;
// The three spellings of browser code an agent might smuggle into a walk or a capture.
export const AGENT_CODE = /page\.evaluate|page\.request|locator\(/;
// What a run leaves that is not the agent's writing: the runner's records of the page it opened — the
// DOM, the accessibility snapshot and the measurements — and the receipt @tools/host writes for the
// sheet it serves. Their bytes are the page's or the tool's, so the origin check does not read them:
// an inline SVG namespace and a framework's own documentation link are the rendered page speaking, and
// a loopback sheet is the host answering. The secret and browser-code checks still read every file.
export const PAGE_RECORD = /(?:\.dom\.json|\.ax\.txt|\.measurements\.json|(?:^|\/)host\.json)$/;
const ACTION_STEPS = new Set(['click', 'fill', 'press', 'select', 'check']);
const TARGETLESS = new Set(['goto', 'capture']);
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

export const walkFingerprint = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export const originOf = (route) => { try { return new URL(route).origin; } catch { return null; } };
export const isCredential = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.credential === 'string';
export const walkFiles = (walkId) => ({
  walk: `response/data/walks/${walkId}/walk.json`,
  result: `response/data/walks/${walkId}/walk-result.json`,
  ledger: `response/data/walks/${walkId}/capture.json`,
  trace: `response/data/walks/${walkId}/trace.zip`,
});

// The control a step pressed, as the walk states it: the step's own target, else the target of the
// nearest earlier step that had one, else the entry route for a step that follows only the goto.
export function controlOfStep(walk, stepId) {
  const steps = walk?.steps ?? [];
  const at = steps.findIndex((s) => s.id === stepId);
  if (at === -1) return null;
  for (let i = at; i >= 0; i -= 1) {
    if (steps[i].target) return { kind: 'target', ...steps[i].target };
    if (steps[i].action === 'goto') return { kind: 'entry', route: walk.entry?.route ?? null };
  }
  return null;
}
// One spelling of a control for a receipt: `<role> "<name>"[ exact][ nth=<n>]` or `entry <route>`.
export function controlString(control) {
  if (!control) return null;
  if (control.kind === 'entry') return `entry ${control.route}`;
  return `${control.role} ${JSON.stringify(control.name)}${control.exact ? ' exact' : ''}${control.nth !== undefined ? ` nth=${control.nth}` : ''}`;
}
export const stepControl = (walk, stepId) => controlString(controlOfStep(walk, stepId));
// The control a step itself named, for the ledger: its own target, the entry route for the goto, and
// null for a step that names none — never another step's target.
export function ownControlOfStep(walk, stepId) {
  const step = (walk?.steps ?? []).find((s) => s.id === stepId);
  if (!step) return null;
  if (step.target) return { kind: 'target', ...step.target };
  if (step.action === 'goto') return { kind: 'entry', route: walk.entry?.route ?? null };
  return null;
}
export const stepOwnControl = (walk, stepId) => controlString(ownControlOfStep(walk, stepId));

export function loadWalkSchema(root = ROOT) { return JSON.parse(readFileSync(path.join(root, WALK_SCHEMA), 'utf8')); }
export function loadResultSchema(root = ROOT) { return JSON.parse(readFileSync(path.join(root, RESULT_SCHEMA), 'utf8')); }
export function loadMeasurementsSchema(root = ROOT) { return JSON.parse(readFileSync(path.join(root, MEASUREMENTS_SCHEMA), 'utf8')); }

// A verdict's citation resolved against the record: the element whose ref it names and the value the
// runner recorded at the dotted property. `element` is null when no entry carries the ref; `found`
// is false when the entry carries no such property; otherwise `recorded` is the runner's value.
export function citedMeasurement(measurements, { ref, property }) {
  const element = (measurements?.elements ?? []).find((e) => e.ref === ref) ?? null;
  if (!element) return { element: null, found: false, recorded: undefined };
  let recorded = element;
  for (const key of String(property).split('.')) {
    if (recorded === null || typeof recorded !== 'object' || !Object.hasOwn(recorded, key)) return { element, found: false, recorded: undefined };
    recorded = recorded[key];
  }
  if (recorded !== null && typeof recorded === 'object') return { element, found: false, recorded: undefined };
  return { element, found: true, recorded };
}

// Schema plus relations. `at` labels the file in every message.
export function walkErrors(walk, { root = ROOT, at = 'walk.json', schema = loadWalkSchema(root) } = {}) {
  const errors = validateAgainst(schema, walk, at);
  if (errors.length) return errors;
  const steps = walk.steps;
  const ids = new Set();
  const captureNames = new Set();
  const credentialName = walk.account?.credentialName ?? null;
  let lastCredentialFill = -1;
  let redirectLanded = true;
  steps.forEach((step, i) => {
    const label = `${at}: step ${step.id ?? i}`;
    if (ids.has(step.id)) errors.push(`${label}: id is declared twice; a step id is the address a capture's control is checked against`);
    ids.add(step.id);
    if (step.action === 'goto') {
      if (i !== 0) errors.push(`${label}: goto at step ${i + 1}; the walk navigates once, at step 1, to entry.route, and every later state is reached through a named control`);
      if (step.value !== walk.entry.route) errors.push(`${label}: goto goes to ${JSON.stringify(step.value)}; the only navigation a walk makes is to entry.route ${walk.entry.route}`);
    } else if (i === 0) errors.push(`${label}: the first step is the goto to entry.route, and this walk opens with ${step.action}`);
    if (ACTION_STEPS.has(step.action) && !step.target) errors.push(`${label}: ${step.action} names no target; a walk presses only what the accessibility tree names`);
    if (TARGETLESS.has(step.action) && step.target) errors.push(`${label}: ${step.action} carries a target it cannot press`);
    if (step.action === 'expect') {
      if (!step.expect || !Object.keys(step.expect).length) errors.push(`${label}: expect states no expectation`);
      if (step.expect && !step.target && Object.keys(step.expect).some((k) => k !== 'url')) errors.push(`${label}: expect names no target, so it can only expect a url; text, visibility, count, attribute, checked and value are read off a named control`);
    } else if (step.expect !== undefined) errors.push(`${label}: only an expect step carries an expectation`);
    if (step.assertion !== undefined && step.action !== 'expect') errors.push(`${label}: only an expect step evidences a frozen assertion`);
    if (step.action === 'capture') {
      if (!step.capture) errors.push(`${label}: capture names no capture`);
      else {
        if (captureNames.has(step.capture.name)) errors.push(`${label}: capture name ${step.capture.name} is used twice; one name is one screenshot`);
        captureNames.add(step.capture.name);
      }
      if (!redirectLanded) errors.push(`${label}: capture before the sign-in redirect landed; a credential was filled at step ${steps[lastCredentialFill].id} and no expectation has since proved where the walk stands, so this frame could hold the credential`);
    } else if (step.capture !== undefined) errors.push(`${label}: only a capture step carries a capture`);
    if (step.action === 'fill') {
      const secretField = SECRET_FIELD.test(step.target?.name ?? '');
      if (isCredential(step.value)) {
        if (!secretField) errors.push(`${label}: a credential is filled into ${JSON.stringify(step.target?.name)}, a field whose name does not read as a secret; a sealed value reaches a password field and nothing else`);
        if (!credentialName) errors.push(`${label}: fills credential ${step.value.credential} while the walk declares no account; the credential's name and its sealed reference come from the account`);
        else if (step.value.credential !== credentialName) errors.push(`${label}: fills credential ${step.value.credential}; the walk's account declares ${credentialName}, and a walk resolves no other name`);
        lastCredentialFill = i;
        redirectLanded = false;
      } else {
        if (secretField) errors.push(`${label}: fills ${JSON.stringify(step.target?.name)}, a field whose name reads as a secret, with a literal value; a secret is filled as { "credential": "<name>" } and resolved by the runner from the sealed reference, never written into the walk`);
        if (typeof step.value !== 'string') errors.push(`${label}: fill takes a string or a credential by name`);
      }
    } else if (isCredential(step.value)) errors.push(`${label}: only a fill takes a credential`);
    if (step.action === 'press' && typeof step.value !== 'string') errors.push(`${label}: press names a key`);
    if (step.action === 'select' && typeof step.value !== 'string') errors.push(`${label}: select names an option`);
    if (step.action === 'check' && step.value !== undefined && typeof step.value !== 'boolean') errors.push(`${label}: check takes true, false or nothing`);
    if (step.action === 'wait' && !step.target && !Number.isInteger(step.value)) errors.push(`${label}: wait names a target to wait for or a number of milliseconds`);
    if (step.action === 'expect' && !redirectLanded && (step.expect?.url !== undefined || step.expect?.visible)) redirectLanded = true;
  });
  // A UAT walk: every assertion names a frozen case, and every case named has a capture of its own name.
  const run = walk.run ?? null;
  const cases = new Map((run?.cases ?? []).map((c) => [c.caseId, c]));
  const orders = [...cases.values()].map((c) => c.order).sort((a, b) => a - b);
  orders.forEach((o, i) => { if (o !== i + 1) errors.push(`${at}: run.cases must carry a contiguous order starting at 1`); });
  if (run && cases.size !== (run.cases ?? []).length) errors.push(`${at}: run.cases names a case twice`);
  const assertedCases = new Set();
  for (const step of steps) {
    if (!step.assertion) continue;
    if (!run) { errors.push(`${at}: step ${step.id} evidences assertion ${step.assertion.assertionId} while the walk declares no run; a UAT walk names its run and its frozen cases`); continue; }
    if (!cases.has(step.assertion.caseId)) errors.push(`${at}: step ${step.id} evidences case ${step.assertion.caseId}, which run.cases does not freeze`);
    assertedCases.add(step.assertion.caseId);
  }
  for (const caseId of assertedCases) if (!captureNames.has(caseId)) errors.push(`${at}: case ${caseId} is evidenced by an expectation and captured by no capture step named ${caseId}; a case's screenshot is the capture that carries its id`);
  if (run) for (const caseId of cases.keys()) if (!assertedCases.has(caseId)) errors.push(`${at}: case ${caseId} is frozen in run.cases and evidenced by no expectation`);
  return errors;
}

// Every text a walk or a run wrote, line by line: a URL outside the route's origin, a value shaped like
// a secret, or browser code. A finding names the file, the line and what kind of thing it found.
// `origins` is off for a file the agent did not write (PAGE_RECORD), whose URLs are the page's own.
export function sweepWalkText(text, origin, { file = 'walk.json', patterns = SECRET_PATTERNS, passwordLeak = true, origins = true } = {}) {
  const findings = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    const push = (pattern) => findings.push({ file, line: i + 1, pattern });
    if (AGENT_CODE.test(line)) push('agent-code');
    if (origins) for (const url of line.match(URL_RE) ?? []) if (originOf(url) !== origin) push('foreign-url');
    for (const { id, re } of patterns) if (re.test(line)) push(id);
    if (passwordLeak && PASSWORD_LEAK.test(line)) push('password-leak');
  });
  return findings;
}
export const sweepFindingErrors = (findings) => findings.map((f) => `${f.file}:${f.line}: carries ${f.pattern}; a walk carries role-and-name targets, one entry route and a credential by name, what a run wrote carries nothing shaped like a secret and no browser code, and what the agent wrote carries no URL outside the route's origin`);

const TEXT = new Set(['.json', '.txt', '.md', '.log', '.html']);
function* textFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* textFiles(full);
    else if (TEXT.has(path.extname(entry.name).toLowerCase()) && statSync(full).size <= 8 * 1024 * 1024) yield full;
  }
}
// The walk and every text file a run of it left under the response folder: the walk folder, the kind
// captures and the artifacts. The password-leak pattern is applied to the walk only — the operator's own
// custody check already applies it to the captures it publishes — because a rendered page that labels a
// field "Password:" is not a leaked value. The origin check is applied to what the agent wrote and not
// to the runner's page records (PAGE_RECORD), for the same reason: a URL the page carries is the
// page's, and only a URL the agent carries says where the agent went.
export function sweepWalkRun(walkText, responseDir, walkId, { relativeTo = responseDir } = {}) {
  let walk = null;
  try { walk = JSON.parse(walkText); } catch { /* the schema pass names the parse error */ }
  const origin = originOf(walk?.entry?.route);
  const findings = sweepWalkText(walkText, origin, { file: 'walk.json' });
  if (!responseDir || !existsSync(responseDir)) return findings;
  const scan = [path.join(responseDir, 'data', 'walks', walkId), path.join(responseDir, 'data', 'captures'), path.join(responseDir, 'artifacts')];
  for (const dir of scan) {
    if (!existsSync(dir)) continue;
    for (const file of textFiles(dir)) {
      const rel = path.relative(relativeTo, file).split(path.sep).join('/');
      if (rel.endsWith('/walk.json')) continue;
      findings.push(...sweepWalkText(readFileSync(file, 'utf8'), origin, { file: rel, passwordLeak: false, origins: !PAGE_RECORD.test(rel) }));
    }
  }
  return findings;
}

// One walk file, and the run beside it when a response folder is given: the schema, the relations, the
// sweep, and — when the result exists — that the result names this walk at its digest.
export function validateWalkFile(walkFile, responseDir = null, { root = ROOT } = {}) {
  const errors = [];
  if (!existsSync(walkFile)) return { errors: [`${walkFile}: missing`], walk: null, result: null };
  const bytes = readFileSync(walkFile);
  const text = bytes.toString('utf8');
  let walk; try { walk = JSON.parse(text); } catch (e) { return { errors: [`${walkFile}: ${e.message}`], walk: null, result: null }; }
  const at = responseDir ? path.relative(path.dirname(responseDir), walkFile).split(path.sep).join('/') : path.basename(walkFile);
  errors.push(...walkErrors(walk, { root, at }));
  errors.push(...sweepFindingErrors(sweepWalkRun(text, responseDir, walk?.id ?? path.basename(path.dirname(walkFile)), { relativeTo: responseDir ? path.dirname(responseDir) : path.dirname(walkFile) })));
  let result = null;
  const resultFile = path.join(path.dirname(walkFile), 'walk-result.json');
  if (existsSync(resultFile)) {
    try { result = JSON.parse(readFileSync(resultFile, 'utf8')); } catch (e) { errors.push(`${resultFile}: ${e.message}`); }
    if (result) {
      errors.push(...validateAgainst(loadResultSchema(root), result, at.replace(/walk\.json$/, 'walk-result.json')));
      if (result.walkFingerprint !== walkFingerprint(bytes)) errors.push(`${at}: the result beside this walk ran ${result.walkFingerprint} and the walk hashes to ${walkFingerprint(bytes)}; a walk edited after its run is a walk nobody ran`);
      if (walk?.id && result.walkRef !== walkFiles(walk.id).walk) errors.push(`${at}: the result names ${result.walkRef}, not this walk`);
      // Every measurements record the result names is the runner's and keeps the kind's shape.
      if (responseDir) {
        const schema = loadMeasurementsSchema(root);
        for (const c of result.captures ?? []) {
          if (!c.measurementsRef) continue;
          const file = path.join(responseDir, c.measurementsRef.replace(/^response\//, ''));
          if (!existsSync(file)) { errors.push(`${at}: the result names ${c.measurementsRef} for capture ${c.name}, which is not on disk; a capture the runner measured keeps its record beside the screenshot`); continue; }
          let doc = null; try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { errors.push(`${c.measurementsRef}: ${e.message}`); continue; }
          errors.push(...validateAgainst(schema, doc, c.measurementsRef));
          if (doc?.capture !== undefined && doc.capture !== c.name) errors.push(`${c.measurementsRef}: records capture ${doc.capture} and the result names it for ${c.name}`);
        }
      }
    }
  }
  return { errors, walk, result, fingerprint: walkFingerprint(bytes) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [walkFile, responseDir] = process.argv.slice(2);
  if (!walkFile) { process.stderr.write('usage: node scripts/validate-walk.mjs <walk.json> [<response dir>]\n'); process.exit(2); }
  const { errors } = validateWalkFile(path.resolve(walkFile), responseDir ? path.resolve(responseDir) : null);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('walk valid\n');
}
