// environment.preflight's own law over one branch, on top of the shared step check: the report is
// complete — its check ids are exactly the closed vocabulary expanded over the requested roles and
// the operation classes the environment schema publishes, so a check that did not run is a missing
// id and never silence; the Checks table and checks[] agree one-to-one by id, family and status;
// every wall has exactly one Walls row and one walls[] entry, owned by its family or a person, and
// nothing else is a wall; the branch is done exactly when no wall stands and blocked with
// ENVIRONMENT_NOT_READY exactly when one does, its reason naming every wall in one paragraph; a role
// whose declaration is a wall has its other checks skipped and an unnamed flow has its flow checks
// skipped; ROUTE_NAME_NEAR_MATCH is taken exactly when a declaration wall's repair names a suggested
// id, and the wall still stands; the approval checks say what the declaration on disk says, at the
// hash the report pinned; the receipt's Binding rows restate the report and the request; and nothing
// written looks like a credential.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { credentialShaped } from '../../scripts/sweep-secrets.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { hostRootOf, missingStack, loadEnvironmentSchema, stackDeclaration } from '../../scripts/validate-request.mjs';
import { playwrightInstallStatus, missingInstallMessage, CHECK_ID as PLAYWRIGHT_CHECK } from '../../scripts/browser-walk.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'environment.preflight';
const RECEIPT = 'response/response.md';
const REPORT = 'response/data/readiness-report.json';
const REPORT_SCHEMA = path.join('templates', 'kinds', 'readiness-report.schema.json');
const NOT_READY = 'ENVIRONMENT_NOT_READY';
const NEAR_MATCH = 'ROUTE_NAME_NEAR_MATCH';
// A credential-shaped value in evidence is refused by the one list scripts/sweep-secrets.mjs publishes.
// How a declaration wall names the one declaration a requested name nearly matches.
const SUGGESTION = /\bsuggested `([a-z0-9][a-z0-9-]*)`/g;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const familyOf = (id) => String(id).split('.')[0];
// A check of one role: `<family>.<role>.<question>` for checkout and runtime, `host.<question>.<role>` for the host.
// The service family is scoped to a declared service and never to a role, whatever a service is named.
const roleScoped = (id, role) => { const p = String(id).split('.'); return (p[0] !== 'declaration' && p[0] !== 'service' && p[1] === role) || (p[0] === 'host' && p[2] === role); };
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));
const suggestedIds = (text) => [...String(text ?? '').matchAll(SUGGESTION)].map((m) => m[1]);

// The vocabulary the report schema publishes, expanded over the roles, classes and declared services
// of this branch. An environment that declares no service expands the service templates to nothing,
// which is how "there is no such service here" is said without a check that answers for one.
export function expectedCheckIds(schema, roles, classes, services = []) {
  const out = [];
  for (const template of schema.$defs.checkIds.templates) {
    if (template.includes('<role>')) for (const role of roles) out.push(template.replace('<role>', role));
    else if (template.includes('<class>')) for (const cls of classes) out.push(template.replace('<class>', cls));
    else if (template.includes('<service>')) for (const s of services) out.push(template.replace('<service>', s));
    else out.push(template);
  }
  return out;
}
// The operation classes are read from the environment schema, never listed here.
export const authorizationClasses = (envSchema) => Object.keys(envSchema.properties.authorization.properties);
// The services are read from the environment's own declaration, never listed here.
export const declaredServices = (declaration) => (declaration?.services ?? []).map((s) => s.id);

export async function validateEnvironmentStep(branchDir, root = ROOT, hostRoot = hostRootOf(root)) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  const blockedNotReady = response.status === 'blocked' && response.stop === NOT_READY;
  let report = null;
  let reportText = null;
  if (present.has('readiness-report') && has(REPORT)) {
    reportText = await read(REPORT);
    try { report = JSON.parse(reportText); } catch { report = null; }
  }
  const receiptText = present.has('environment-readiness') && has(RECEIPT) ? await read(RECEIPT) : null;

  // A gate stop carries no report; a wall stop carries the whole of it, because a report that
  // stopped at the first wall is the sequence of walls this operator exists to replace.
  if (response.status === 'blocked' && !blockedNotReady && (report || receiptText)) errors.push(`response/response.json: a ${response.stop} stop is a gate stop and carries no readiness report`);
  if (blockedNotReady && !report) errors.push(`${REPORT}: a branch blocked with ${NOT_READY} still carries the complete report, every check included`);
  if (blockedNotReady && !receiptText) errors.push(`${RECEIPT}: a branch blocked with ${NOT_READY} still carries the receipt with its Walls table`);

  // Nothing written may look like a credential: the evidence is an outcome, a name, a length or a digest.
  for (const [label, text] of [[RECEIPT, receiptText], [REPORT, reportText], ['response/response.json reason', response.reason]]) {
    if (text && credentialShaped(text)) errors.push(`${label}: carries a credential-shaped value; the evidence of a custody check is its outcome, the credential's name and a length or digest, never the value`);
  }

  const env = report?.env ?? requirements.env;
  if (!empty(env)) { const missing = missingStack(root, env, hostRoot); if (missing) errors.push(`request.json: env ${env} names no stack; ${missing} does not exist`); }

  if (report) {
    // The report answers the request it was written for.
    if (!empty(requirements.project) && report.project !== requirements.project) errors.push(`${REPORT}: project ${report.project} differs from the request's ${requirements.project}`);
    if (Array.isArray(requirements.roles) && requirements.roles.length) {
      const asked = new Set(requirements.roles);
      if (asked.size !== report.roles.length || report.roles.some((r) => !asked.has(r))) errors.push(`${REPORT}: roles ${report.roles.join(', ')} differ from the request's ${requirements.roles.join(', ')}`);
    }
    if (!empty(requirements.env) && report.env !== requirements.env) errors.push(`${REPORT}: env ${report.env} differs from the request's ${requirements.env}`);
    if ((requirements.flow ?? null) !== (report.flow ?? null) && !(empty(requirements.flow) && report.flow === null)) errors.push(`${REPORT}: flow ${report.flow} differs from the request's ${requirements.flow ?? 'null'}`);

    // Completeness: the id set is the vocabulary, expanded, and nothing else.
    const envSchema = await loadEnvironmentSchema(root);
    const reportSchema = JSON.parse(await readFile(path.join(root, REPORT_SCHEMA), 'utf8'));
    const classes = authorizationClasses(envSchema);
    // The declaration on disk says which services this environment runs; a declaration that fails its
    // schema names none, and the service family then expands to nothing rather than to guesses.
    const declaration = await stackDeclaration(root, report.env, hostRoot, envSchema);
    const declarationValid = declaration.exists && declaration.errors.length === 0;
    const services = declarationValid ? declaration.declaration.services ?? [] : [];
    const expected = expectedCheckIds(reportSchema, report.roles, classes, declaredServices({ services }));
    const byId = new Map();
    for (const c of report.checks) {
      if (byId.has(c.id)) errors.push(`${REPORT}: check ${c.id} is recorded twice`);
      byId.set(c.id, c);
      if (c.family !== familyOf(c.id)) errors.push(`${REPORT}: check ${c.id} says family ${c.family}; a check's family is the first segment of its id`);
    }
    for (const id of expected) if (!byId.has(id)) errors.push(`${REPORT}: check ${id} was not run; every readiness question runs once and a missing id is a check that stayed silent`);
    const expectedSet = new Set(expected);
    for (const id of byId.keys()) if (!expectedSet.has(id)) errors.push(`${REPORT}: check ${id} is not in the vocabulary readiness-report.schema.json publishes for roles ${report.roles.join(', ')}`);

    // Walls: one entry per wall check, owned by its family or a person, and nothing else.
    const wallIds = new Set([...byId.values()].filter((c) => c.status === 'wall').map((c) => c.id));
    const wallsById = new Map();
    for (const w of report.walls) {
      if (wallsById.has(w.checkId)) errors.push(`${REPORT}: walls records ${w.checkId} twice; a wall check has exactly one wall entry`);
      wallsById.set(w.checkId, w);
      const check = byId.get(w.checkId);
      if (!check) errors.push(`${REPORT}: walls names ${w.checkId}, which checks does not record`);
      else if (check.status !== 'wall') errors.push(`${REPORT}: walls names ${w.checkId}, whose status is ${check.status}; only a wall check has a wall entry`);
      else {
        if (check.owner !== w.owner) errors.push(`${REPORT}: check ${w.checkId} says owner ${check.owner} and its wall entry says ${w.owner}`);
        if (w.owner !== check.family && w.owner !== 'person') errors.push(`${REPORT}: wall ${w.checkId} is owned by ${w.owner}; a wall is cleared by its family (${check.family}) or by a person`);
      }
      if (familyOf(w.checkId) !== 'declaration' && suggestedIds(w.repair).length) errors.push(`${REPORT}: wall ${w.checkId} suggests a name; only a declaration wall carries a near-match suggestion`);
    }
    for (const id of wallIds) if (!wallsById.has(id)) errors.push(`${REPORT}: check ${id} is a wall with no wall entry; every wall names its owner and its repair`);
    for (const c of byId.values()) if (c.status !== 'wall' && c.owner !== null) errors.push(`${REPORT}: check ${c.id} is ${c.status} and names owner ${c.owner}; only a wall has an owner`);

    // Done exactly when no wall stands; blocked with ENVIRONMENT_NOT_READY exactly when one does.
    if (response.status === 'done' && report.walls.length) errors.push(`response/response.json: the branch is done while ${report.walls.length} wall(s) stand; a wall blocks with ${NOT_READY}`);
    if (blockedNotReady && !report.walls.length) errors.push(`response/response.json: blocked with ${NOT_READY} while the report records no wall`);
    if (blockedNotReady) {
      const reason = String(response.reason ?? '');
      if (!reason.trim()) errors.push(`response/response.json: a ${NOT_READY} stop carries a reason naming every wall`);
      if (/[\r\n]/.test(reason)) errors.push(`response/response.json: reason spans more than one paragraph; every wall is listed in one so a person clears them together`);
      for (const id of wallIds) if (!reason.includes(id)) errors.push(`response/response.json: reason does not name wall ${id}; the person reads every wall from the reason, not one per re-entry`);
    }

    // Skips: a role whose declaration is a wall has nothing to inspect; an unnamed flow has no account.
    for (const role of report.roles) {
      const decl = byId.get(`declaration.${role}`);
      if (!decl) continue;
      const others = [...byId.values()].filter((c) => c.id !== decl.id && roleScoped(c.id, role));
      if (decl.status === 'wall') for (const c of others) if (c.status !== 'skipped') errors.push(`${REPORT}: check ${c.id} is ${c.status} while declaration.${role} is a wall; a role with no declared route has nothing to inspect and its other checks are skipped`);
      if (decl.status === 'ok') for (const c of others.filter((x) => x.family === 'checkout')) if (c.status === 'skipped') errors.push(`${REPORT}: check ${c.id} is skipped while declaration.${role} is ok; a declared route has a checkout to inspect`);
    }
    // The runtime family follows the request: a role the chain serves, observes or walks has its runtime
    // checked; a role that is merely bound has it skipped, so a package repair never inherits the readiness
    // of a server it never touches.
    const runtimeRoles = new Set(Array.isArray(requirements.runtimeRoles) ? requirements.runtimeRoles : []);
    for (const role of report.roles) {
      const decl = byId.get(`declaration.${role}`);
      if (!decl || decl.status !== 'ok') continue;
      for (const c of [...byId.values()].filter((x) => x.family === 'runtime' && roleScoped(x.id, role))) {
        if (runtimeRoles.has(role) && c.status === 'skipped') errors.push(`${REPORT}: check ${c.id} is skipped while the chain touches the ${role} runtime (runtimeRoles); a runtime the chain serves, observes or walks is inspected`);
        if (!runtimeRoles.has(role) && c.status !== 'skipped') errors.push(`${REPORT}: check ${c.id} is ${c.status} while the chain touches no ${role} runtime (runtimeRoles); a runtime nobody serves, observes or walks is skipped, never a wall`);
      }
    }
    const flowChecks = [...byId.values()].filter((c) => c.id.startsWith('identity.flow.'));
    if (report.flow === null) {
      for (const c of flowChecks) if (c.status !== 'skipped') errors.push(`${REPORT}: check ${c.id} is ${c.status} while no flow was named; both flow checks are skipped`);
    } else {
      const account = byId.get('identity.flow.account');
      if (account && account.status === 'skipped') errors.push(`${REPORT}: identity.flow.account is skipped while flow ${report.flow} was named; the account record is always inspectable`);
    }

    // The near match is a fallback exactly when a declaration wall suggests a name, and the wall stands.
    const suggestions = report.walls.filter((w) => familyOf(w.checkId) === 'declaration').flatMap((w) => suggestedIds(w.repair));
    const taken = (response.fallbacks ?? []).includes(NEAR_MATCH);
    if (taken && !suggestions.length) errors.push(`response/response.json: ${NEAR_MATCH} is taken while no declaration wall names a suggested id`);
    if (!taken && suggestions.length) errors.push(`response/response.json: a declaration wall names suggested \`${suggestions[0]}\` and ${NEAR_MATCH} is not recorded as taken`);
    if (taken && receiptText) {
      const action = (tableUnder(receiptText, '## Fallbacks taken') ?? []).find(([code]) => code === NEAR_MATCH)?.[1] ?? '';
      for (const id of suggestions) if (!action.includes(`\`${id}\``)) errors.push(`${RECEIPT}: the ${NEAR_MATCH} fallback does not name the suggested \`${id}\``);
    }
    for (const w of report.walls) for (const id of suggestedIds(w.repair)) if (id === report.project || report.roles.includes(id)) errors.push(`${REPORT}: wall ${w.checkId} suggests \`${id}\`, which is the requested name itself`);

    // The service family says what the declaration on disk says about each service it names: the
    // declaration check is ok exactly where the declaration carries that service completely, and the
    // probe check is skipped exactly where the declaration wants the service down, because nothing
    // answering is then the state that was asked for. Nothing here starts, stops or moves a service.
    for (const s of services) {
      const declared = byId.get(`service.${s.id}.declared`);
      if (declared && declared.status === 'wall') errors.push(`${REPORT}: check service.${s.id}.declared is a wall while ${declaration.rel} carries the service with its kind, command, probe and holder; the declaration answered this one`);
      const probe = byId.get(`service.${s.id}.probe`);
      if (!probe) continue;
      if (s.desired === 'down' && probe.status !== 'skipped') errors.push(`${REPORT}: check service.${s.id}.probe is ${probe.status} while the declaration wants the service down; nothing answering is the state that was asked for, and the probe is skipped`);
      if (s.desired === 'up' && probe.status === 'skipped') errors.push(`${REPORT}: check service.${s.id}.probe is skipped while the declaration wants the service up; a service the environment wants running is probed, and a probe that does not answer is a wall owned by service`);
    }

    // Approvals say what the declaration on disk says, at the hash the report pinned.
    const decl = declaration;
    const valid = declarationValid;
    if (valid) {
      if (report.declarationRef !== decl.reference) errors.push(`${REPORT}: declarationRef ${report.declarationRef} is not the declaration on disk (${decl.reference}); a moved declaration is authority drift, not a quieter approval`);
      for (const cls of classes) {
        const c = byId.get(`approval.${cls}`);
        if (!c) continue;
        if (c.status !== 'ok') errors.push(`${REPORT}: approval.${cls} is ${c.status} while the declaration is valid; a valid declaration answers every class, declared or person`);
        else if (!new RegExp(`^${decl.authorization[cls]}\\b`).test(c.evidence)) errors.push(`${REPORT}: approval.${cls} evidence "${c.evidence}" does not open with ${decl.authorization[cls]}, which the declaration gives the class`);
      }
    } else {
      if (report.declarationRef !== null) errors.push(`${REPORT}: declarationRef names a declaration that ${decl.exists ? 'fails its schema' : 'does not exist'}; the report records null and every approval check as a wall`);
      for (const cls of classes) { const c = byId.get(`approval.${cls}`); if (c && c.status !== 'wall') errors.push(`${REPORT}: approval.${cls} is ${c.status} while the environment declares nothing valid; every approval check is a wall owned by approval`); }
    }

    // The walk runner's install is read back from the host the way the declaration is: the check says
    // what scripts/browser-walk.mjs would find at the place resources/tools.json names, and an absent
    // install is a wall in the runner's own wording, never an ok the runner would then contradict.
    const playwright = byId.get(PLAYWRIGHT_CHECK);
    if (playwright && playwright.status !== 'skipped') {
      const install = playwrightInstallStatus(hostRoot, root);
      if (install.present && playwright.status !== 'ok') errors.push(`${REPORT}: ${PLAYWRIGHT_CHECK} is ${playwright.status} while Playwright and a Chromium stand at ${install.root}; the runner would load them`);
      if (!install.present && playwright.status !== 'wall') errors.push(`${REPORT}: ${PLAYWRIGHT_CHECK} is ok while no Playwright install stands at ${install.root}; the runner exits with "${missingInstallMessage(hostRoot, root)}", and the check is a wall owned by host with that repair`);
      if (!install.present && playwright.status === 'wall') {
        const wall = wallsById.get(PLAYWRIGHT_CHECK);
        if (wall && !String(wall.repair).includes(install.root)) errors.push(`${REPORT}: wall ${PLAYWRIGHT_CHECK} names a repair that does not name the install place ${install.root}; the repair is the runner's own wording`);
      }
    }
  }

  if (receiptText && report) {
    // The receipt restates the report: the same binding, the same checks, the same walls.
    const title = receiptText.split(/\r?\n/)[0] ?? '';
    if (title !== `# environment-readiness — ${report.project}`) errors.push(`${RECEIPT}: title names ${title.replace(/^# environment-readiness — /, '')}, the report names ${report.project}`);
    const binding = fields(tableUnder(receiptText, '## Binding'));
    if (binding.Project !== report.project) errors.push(`${RECEIPT}: Project ${binding.Project} differs from the report's ${report.project}`);
    if (binding.Roles !== report.roles.join(', ')) errors.push(`${RECEIPT}: Roles "${binding.Roles}" differs from the report's ${report.roles.join(', ')}`);
    if (binding.Environment !== report.env) errors.push(`${RECEIPT}: Environment ${binding.Environment} differs from the report's ${report.env}`);
    if ((empty(binding.Flow) ? null : binding.Flow) !== report.flow) errors.push(`${RECEIPT}: Flow ${binding.Flow} differs from the report's ${report.flow ?? '—'}`);
    if ((empty(binding.Declaration) ? null : binding.Declaration) !== report.declarationRef) errors.push(`${RECEIPT}: Declaration differs from the report's declarationRef`);

    const rows = tableUnder(receiptText, '## Checks') ?? [];
    const seen = new Set();
    const byId = new Map(report.checks.map((c) => [c.id, c]));
    for (const [id, family, status] of rows) {
      if (seen.has(id)) errors.push(`${RECEIPT}: Checks lists ${id} twice`);
      seen.add(id);
      const c = byId.get(id);
      if (!c) { errors.push(`${RECEIPT}: Checks lists ${id}, which the report does not record`); continue; }
      if (c.family !== family) errors.push(`${RECEIPT}: check ${id} says family ${family}, the report says ${c.family}`);
      if (c.status !== status) errors.push(`${RECEIPT}: check ${id} says ${status}, the report says ${c.status}`);
    }
    for (const id of byId.keys()) if (!seen.has(id)) errors.push(`${RECEIPT}: Checks omits ${id}, which the report records`);

    const wallRows = tableUnder(receiptText, '## Walls') ?? [];
    const wallSeen = new Map();
    for (const [id, owner, repair] of wallRows) {
      if (wallSeen.has(id)) errors.push(`${RECEIPT}: Walls lists ${id} twice; a wall check has exactly one Walls row`);
      wallSeen.set(id, { owner, repair });
    }
    const walls = new Map(report.walls.map((w) => [w.checkId, w]));
    for (const [id, row] of wallSeen) {
      const w = walls.get(id);
      if (!w) { errors.push(`${RECEIPT}: Walls lists ${id}, which the report records as no wall`); continue; }
      if (row.owner !== w.owner) errors.push(`${RECEIPT}: wall ${id} says owner ${row.owner}, the report says ${w.owner}`);
      if (row.repair !== w.repair) errors.push(`${RECEIPT}: wall ${id} repair differs from the report's`);
    }
    for (const id of walls.keys()) if (!wallSeen.has(id)) errors.push(`${RECEIPT}: Walls omits ${id}, which the report records as a wall`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateEnvironmentStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid environment.preflight branch\n');
}
