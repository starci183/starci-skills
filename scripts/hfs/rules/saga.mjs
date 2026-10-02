// saga.mjs - the saga pattern of a product that declares `patterns: ["saga"]` in hfs.json (R142 to R146). A saga is a feature folder
//   be/src/features/<feature>/saga/
//     <saga>.saga.service.ts              the orchestrator: the list of its steps and compensations (a service, unit-tested beside it)
//     <saga>.saga-state.ts                the persisted state of a run, typed with its `status` and its `version` fence
//     steps/<step>.step.ts                one step, dispatching one command, naming the event it puts on the wire
//     compensations/<step>.compensation.ts  the compensation of that step, naming the failure event that triggers it
//   be/src/features/<feature>/transport/message/<event>.consumer.ts   the consumers that advance it, through the inbox
//   be/contracts/<service>/events.json   every event, a compensating one declaring `compensates: "<step event>"`
// Five tree checks (the slot manifest owns the paths: an undeclared saga folder is HFS_SLOT_NOT_ENABLED):
//   R142 BE_SAGA_STEP_COMPENSATION  every step has a compensation of the same name and the other way round, and the orchestrator imports them all;
//   R143 BE_SAGA_STATE_VERSIONED    every orchestrator has its `.saga-state.ts` whose exported state type carries `status` and a numeric `version`,
//                                   and imports the fenced store of `platform/saga`;
//   R144 BE_SAGA_EVENT_CONTRACT     a step and a compensation each name their event (`readonly event = "<name>"`), both are in a contract, and the
//                                   contract of the compensation's event says it compensates the step's event;
//   R145 BE_SAGA_CONSUMER_DEDUPE    a consumer of a saga feature passes the id of the delivery (`message.eventId`) on to the command, so the inbox can dedupe it;
//   R146 BE_SAGA_E2E_MISSING        every compensation path has an e2e spec through the world that names its event and injects a failure
//                                   (an outage of an infra service, an app or a fake: `during`, `cut`, `latency`, `failNext`, `interruptDatabase`).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackage, requirePackage } from '../../lib/package-at.mjs';
import { found, readJson, readText } from './read.mjs';

export const SAGA_STEP_COMPENSATION = 'BE_SAGA_STEP_COMPENSATION';
export const SAGA_STATE_VERSIONED = 'BE_SAGA_STATE_VERSIONED';
export const SAGA_EVENT_CONTRACT = 'BE_SAGA_EVENT_CONTRACT';
export const SAGA_CONSUMER_DEDUPE = 'BE_SAGA_CONSUMER_DEDUPE';
export const SAGA_E2E_MISSING = 'BE_SAGA_E2E_MISSING';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAGA_FILE = /^be\/src\/features\/([^/]+)\/saga\/(?:(?:steps|compensations)\/)?[^/]+\.(?:saga\.service|saga-state|step|compensation)\.ts$/;
const ORCHESTRATOR = /^be\/src\/features\/([^/]+)\/saga\/([^/]+)\.saga\.service\.ts$/;
const STATE = /^be\/src\/features\/([^/]+)\/saga\/([^/]+)\.saga-state\.ts$/;
const STEP = /^be\/src\/features\/([^/]+)\/saga\/steps\/([^/]+)\.step\.ts$/;
const COMPENSATION = /^be\/src\/features\/([^/]+)\/saga\/compensations\/([^/]+)\.compensation\.ts$/;
const CONSUMER = /^be\/src\/features\/([^/]+)\/transport\/message\/[^/]+\.consumer\.ts$/;
const E2E_SPEC = /^be\/src\/tests\/e2e\/[^/]+\/[^/]+\.e2e-spec\.ts$/;
const CONTRACT = /^be\/contracts\/[^/]+\/events\.json$/;
const USE_TEST_WORLD = /\buseTestWorld\s*\(/;
const INJECTION = /\.(?:during|cut|latency|failNext|interruptDatabase)\s*\(/;
const STORE_MODULE = /(?:^|\/)platform\/saga$/;

/** The TypeScript compiler of the app (else of the runtime), or null. */
function typescriptFor(repoRoot) {
  const located = findPackage([repoRoot, HERE], ['typescript']);
  return located ? requirePackage(located) : null;
}

const parse = (ts, text) => ts.createSourceFile('saga.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** The module specifiers a source file imports or re-exports. */
function specifiersOf(ts, sourceFile) {
  const out = [];
  for (const statement of sourceFile.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) out.push(statement.moduleSpecifier.text);
  }
  return out;
}

/** The string literal of the class property `event` (`readonly event = "order.placed"`), or null. */
function eventOf(ts, sourceFile) {
  let name = null;
  const visit = (node) => {
    if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'event' && node.initializer && ts.isStringLiteralLike(node.initializer)) name = node.initializer.text;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return name;
}

/** Whether an exported interface or type alias of the file declares `status` and a `version: number` member. */
function statesVersion(ts, sourceFile) {
  let versioned = false;
  const memberNames = (members) => new Map(members.filter((member) => ts.isPropertySignature(member) && ts.isIdentifier(member.name)).map((member) => [member.name.text, member.type]));
  for (const statement of sourceFile.statements) {
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const members = ts.isInterfaceDeclaration(statement) ? statement.members : ts.isTypeAliasDeclaration(statement) && ts.isTypeLiteralNode(statement.type) ? statement.type.members : null;
    if (members === null) continue;
    const named = memberNames(members);
    if (named.has('status') && named.get('version')?.kind === ts.SyntaxKind.NumberKeyword) versioned = true;
  }
  return versioned;
}

/** Whether a source text reads `.eventId` of something (the id of the delivery travels on). */
function readsEventId(ts, sourceFile) {
  let read = false;
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'eventId') read = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return read;
}

/** The sagas of the app: every feature that holds a `saga/` folder. */
const featuresOf = (files) => [...new Set(files.map((file) => SAGA_FILE.exec(file)?.[1]).filter((feature) => feature !== undefined))].sort();

/** Findings of R142 to R146 over the tracked paths `files` of the app at `repoRoot`. */
export function sagaFindings({ repoRoot, files }) {
  const features = featuresOf(files);
  if (features.length === 0) return [];
  const ts = typescriptFor(repoRoot);
  if (ts === null) return [];
  const findings = [];
  const events = new Map();
  for (const contract of files.filter((file) => CONTRACT.test(file))) {
    for (const [name, event] of Object.entries(readJson(repoRoot, contract)?.events ?? {})) events.set(name, { contract, ...event });
  }
  const specs = files.filter((file) => E2E_SPEC.test(file)).map((file) => ({ file, text: readText(repoRoot, file) ?? '' })).filter(({ text }) => USE_TEST_WORLD.test(text));
  const compensationPaths = [];
  for (const feature of features) {
    const under = (pattern) => files.filter((file) => pattern.test(file) && pattern.exec(file)[1] === feature);
    const steps = new Map(under(STEP).map((file) => [STEP.exec(file)[2], file]));
    const compensations = new Map(under(COMPENSATION).map((file) => [COMPENSATION.exec(file)[2], file]));
    const orchestrators = under(ORCHESTRATOR);
    const states = new Map(under(STATE).map((file) => [STATE.exec(file)[2], file]));
    const folder = `be/src/features/${feature}/saga/`;
    // R142
    for (const [stem, file] of steps) if (!compensations.has(stem)) findings.push(found(SAGA_STEP_COMPENSATION, file, `${file} is a saga step with no compensation: add ${folder}compensations/${stem}.compensation.ts, the command that undoes it; every forward step of a saga has one.`, { step: stem }));
    for (const [stem, file] of compensations) if (!steps.has(stem)) findings.push(found(SAGA_STEP_COMPENSATION, file, `${file} is a compensation of no step: ${folder}steps/${stem}.step.ts does not exist; a compensation undoes the step of the same name.`, { step: stem }));
    if (orchestrators.length === 0 && (steps.size > 0 || compensations.size > 0)) findings.push(found(SAGA_STEP_COMPENSATION, folder, `${folder} holds steps or compensations but no orchestrator: add <saga>.saga.service.ts, the list of the steps and their compensations.`));
    for (const orchestrator of orchestrators) {
      const text = readText(repoRoot, orchestrator);
      if (text === null) continue;
      const sourceFile = parse(ts, text);
      const imported = specifiersOf(ts, sourceFile).map((specifier) => path.posix.normalize(path.posix.join(path.posix.dirname(orchestrator), specifier)));
      for (const file of [...steps.values(), ...compensations.values()]) {
        if (!imported.includes(file.replace(/\.ts$/, ''))) findings.push(found(SAGA_STEP_COMPENSATION, orchestrator, `${orchestrator} does not list ${file}: the orchestrator imports every step and every compensation of its saga, so a step nobody runs cannot hide.`, { step: file }));
      }
      // R143
      const stem = ORCHESTRATOR.exec(orchestrator)[2];
      const stateFile = states.get(stem);
      if (stateFile === undefined) findings.push(found(SAGA_STATE_VERSIONED, orchestrator, `${orchestrator} has no ${folder}${stem}.saga-state.ts: the persisted state of a run is typed there, with its status and its version fence.`, { saga: stem }));
      if (!specifiersOf(ts, sourceFile).some((specifier) => STORE_MODULE.test(specifier))) findings.push(found(SAGA_STATE_VERSIONED, orchestrator, `${orchestrator} does not use the fenced store of platform/saga: a run is persisted and moved only through it (every transition names the version it read), never by a write of its own.`, { saga: stem }));
    }
    for (const [stem, file] of states) {
      const text = readText(repoRoot, file);
      if (text !== null && !statesVersion(ts, parse(ts, text))) findings.push(found(SAGA_STATE_VERSIONED, file, `${file} exports no state type with a \`status\` and a \`version: number\`; a saga run is persisted with a version, the fence that stops a zombie delivery from moving it twice.`, { saga: stem }));
    }
    // R144
    const eventOfFile = new Map();
    for (const [kind, map] of [['step', steps], ['compensation', compensations]]) {
      for (const [stem, file] of map) {
        const text = readText(repoRoot, file);
        const name = text === null ? null : eventOf(ts, parse(ts, text));
        eventOfFile.set(`${kind}:${stem}`, name);
        if (name === null) findings.push(found(SAGA_EVENT_CONTRACT, file, `${file} names no event: a ${kind} of a saga declares \`readonly event = "<name>"\`, the event of the contract it ${kind === 'step' ? 'puts on the wire' : 'answers'}.`, { step: stem }));
        else if (!events.has(name)) findings.push(found(SAGA_EVENT_CONTRACT, file, `${file} names the event "${name}", which no be/contracts/<service>/events.json declares; every event of a saga is in a vendored contract.`, { step: stem, event: name }));
      }
    }
    for (const [stem, file] of compensations) {
      const compensationEvent = eventOfFile.get(`compensation:${stem}`);
      const stepEvent = eventOfFile.get(`step:${stem}`);
      if (compensationEvent && stepEvent && events.has(compensationEvent) && events.get(compensationEvent).compensates !== stepEvent) {
        findings.push(found(SAGA_EVENT_CONTRACT, file, `${file}: the contract of "${compensationEvent}" (${events.get(compensationEvent).contract}) does not declare \`compensates: "${stepEvent}"\`; the failure event of a compensation says which step's event it undoes.`, { step: stem, event: compensationEvent }));
      }
      if (compensationEvent) compensationPaths.push({ file, stem, event: compensationEvent });
    }
    // R145
    for (const file of under(CONSUMER)) {
      const text = readText(repoRoot, file);
      if (text !== null && !readsEventId(ts, parse(ts, text))) findings.push(found(SAGA_CONSUMER_DEDUPE, file, `${file} is a consumer of the saga feature ${feature} but never passes the id of the delivery on (\`message.eventId\`); the saga takes every event through the inbox, so the consumer hands the id to its command.`, { feature }));
    }
  }
  // R146
  for (const { file, stem, event } of compensationPaths) {
    const named = specs.filter(({ text }) => text.includes(event));
    const expected = `be/src/tests/e2e/<area>/<name>.e2e-spec.ts`;
    if (named.length === 0) findings.push(found(SAGA_E2E_MISSING, file, `${file}: the compensation path of "${event}" has no e2e spec; add ${expected}, which boots the apps with useTestWorld, drives the failure and reads the compensated state back.`, { step: stem, event }));
    else if (!named.some(({ text }) => INJECTION.test(text))) findings.push(found(SAGA_E2E_MISSING, named[0].file, `${named[0].file} names "${event}" but injects no failure; the compensation path is proven with a fault through the world (an outage of an infra service or an app with \`during\`, \`cut\`, \`latency\`, a fake's \`failNext\`, \`interruptDatabase\`), not only the happy flow.`, { step: stem, event }));
  }
  return findings;
}
