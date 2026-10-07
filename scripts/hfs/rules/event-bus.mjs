// event-bus.mjs - the tree checks of the declared patterns (hfs.json sides.be.patterns).
//   BE_EVENT_CLASS_CONTRACT   every typed event class `be/src/modules/events/<service>/<event>.event.ts` equals an entry of the vendored
//                             contract `be/contracts/<service>/events.json` (the same name and version), every entry of a vendored
//                             contract has its class, and a class file is named after its event (`order.placed` -> `order-placed.event.ts`);
//   BE_PATTERN_SPEC_MISSING   a declared pattern has its required scenarios: ruleParams.be.patternScenarios.<pattern> lists scenario ids,
//                             and an e2e or integration spec of the back end holds a test whose title starts `<pattern>/<scenario>:`.
// Class members are read with TypeScript's own parser (a `static readonly eventName` and `version` with literal initializers), spec
// titles are the first argument of `it(` and `test(` calls; no source text is matched by a regular expression.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSlotManifest, ruleParams } from '../slots.mjs';
import { loadTypescript } from '../../lib/package-at.mjs';
import { literalText } from '../../lib/ts-ast.mjs';
import { found, readJson, readText } from './read.mjs';

const EVENT_CLASS_CONTRACT = 'BE_EVENT_CLASS_CONTRACT';
const PATTERN_SPEC_MISSING = 'BE_PATTERN_SPEC_MISSING';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVENT_FILE_PREFIX = 'be/src/modules/events/';
const EVENT_SUFFIX = '.event.ts';
const CONTRACT_PREFIX = 'be/contracts/';
const CONTRACT_NAME = 'events.json';
const TEST_FOLDERS = ['be/src/tests/e2e/', 'be/src/tests/integration/'];
const SPEC_SUFFIXES = ['.e2e-spec.ts', '.integration-spec.ts'];
const TEST_CALLEES = new Set(['it', 'test']);

/** The TypeScript compiler of the app (else of the runtime), or null. */
const typescriptFor = (repoRoot) => loadTypescript(repoRoot, HERE);

/** The event-bus pattern file name of an event name: dots become dashes (`order.placed` -> `order-placed`). */
export const stemOfEvent = (name) => name.replaceAll('.', '-');

/** The `eventName` and `version` literals a class declares as `static readonly` members, with the line of the class. */
function eventClassInfo(ts, node) {
  let name = null;
  let version = null;
  for (const member of node.members) {
    if (!ts.isPropertyDeclaration(member) || !member.initializer || !member.name || !ts.isIdentifier(member.name)) continue;
    const isStatic = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
    if (!isStatic) continue;
    let value = member.initializer;
    while (ts.isAsExpression(value) || ts.isParenthesizedExpression(value)) value = value.expression;
    if (member.name.text === 'eventName') name = literalText(ts, value);
    if (member.name.text === 'version' && ts.isNumericLiteral(value)) version = Number(value.text);
  }
  if (name !== null || version !== null || node.name) return { className: node.name?.text ?? '<anonymous>', name, version };
  return null;
}

function readEventClass(ts, text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const classes = [];
  const visit = (node) => {
    if (ts.isClassDeclaration(node)) {
      const info = eventClassInfo(ts, node);
      if (info) classes.push(info);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return classes;
}

function eventClassesOf(repoRoot, files, ts) {
  const findings = [];
  const classesByService = new Map();
  for (const file of files) {
    if (!file.startsWith(EVENT_FILE_PREFIX) || !file.endsWith(EVENT_SUFFIX)) continue;
    const rest = file.slice(EVENT_FILE_PREFIX.length).split('/');
    if (rest.length !== 2) continue;
    const [service, base] = rest;
    const stem = base.slice(0, -EVENT_SUFFIX.length);
    const text = readText(repoRoot, file);
    if (text === null) continue;
    const classes = readEventClass(ts, text, file).filter((c) => c.name !== null || c.version !== null);
    if (classes.length !== 1 || classes[0].name === null || classes[0].version === null) {
      const candidates = classes.length === 1 ? 'one without both literals' : `${classes.length} candidates`;
      findings.push(found(EVENT_CLASS_CONTRACT, file, `${file} must declare exactly one event class with literal \`static readonly eventName\` and \`static readonly version\` members (the typed event of be/contracts/${service}/${CONTRACT_NAME}); found ${candidates}.`, { service }));
      continue;
    }
    const [event] = classes;
    if (stemOfEvent(event.name) !== stem) findings.push(found(EVENT_CLASS_CONTRACT, file, `${file} declares the event \`${event.name}\`, so the file is \`${stemOfEvent(event.name)}${EVENT_SUFFIX}\`: a class file is named after its event.`, { service, event: event.name }));
    if (!classesByService.has(service)) classesByService.set(service, new Map());
    classesByService.get(service).set(event.name, { file, version: event.version });
  }
  return { findings, classesByService };
}

function eventContractsOf(repoRoot, files) {
  const contracts = new Map();
  for (const file of files) {
    if (!file.startsWith(CONTRACT_PREFIX) || !file.endsWith(`/${CONTRACT_NAME}`)) continue;
    const rest = file.slice(CONTRACT_PREFIX.length).split('/');
    if (rest.length !== 2) continue;
    contracts.set(rest[0], { file, doc: readJson(repoRoot, file) });
  }
  return contracts;
}

function classContractFindings(classesByService, contracts) {
  const findings = [];
  for (const [service, byName] of classesByService) {
    const contract = contracts.get(service);
    for (const [name, { file, version }] of byName) {
      const entry = contract?.doc?.events?.[name];
      if (!contract) findings.push(found(EVENT_CLASS_CONTRACT, file, `${file} declares the event \`${name}\` but ${CONTRACT_PREFIX}${service}/${CONTRACT_NAME} is not tracked; every event class is an entry of the vendored contract of its service.`, { service, event: name }));
      else if (entry === undefined) findings.push(found(EVENT_CLASS_CONTRACT, file, `${file} declares the event \`${name}\` which ${contract.file} does not list; emit the contract (\`starci app emit\`) so the class and the contract agree.`, { service, event: name }));
      else if (entry.version !== version) findings.push(found(EVENT_CLASS_CONTRACT, file, `${file} declares \`${name}\` at version ${version} but ${contract.file} lists version ${entry.version}; a version changes in the class and the contract together.`, { service, event: name }));
    }
  }
  return findings;
}

function contractClassFindings(classesByService, contracts) {
  const findings = [];
  for (const [service, contract] of contracts) {
    const events = contract.doc?.events;
    if (events === null || typeof events !== 'object') continue;
    for (const name of Object.keys(events)) {
      if (!classesByService.get(service)?.has(name)) findings.push(found(EVENT_CLASS_CONTRACT, contract.file, `${contract.file} lists the event \`${name}\` but ${EVENT_FILE_PREFIX}${service}/${stemOfEvent(name)}${EVENT_SUFFIX} declares no such class; every contract entry has its typed event class.`, { service, event: name }));
    }
  }
  return findings;
}

/** Findings of BE_EVENT_CLASS_CONTRACT. */
export function eventClassContractFindings({ repoRoot, files, repo }) {
  const patterns = repo.sides?.be?.patterns ?? [];
  if (!patterns.includes('event-bus')) return [];
  const ts = typescriptFor(repoRoot);
  if (!ts) return [];
  const classes = eventClassesOf(repoRoot, files, ts);
  const contracts = eventContractsOf(repoRoot, files);
  return [...classes.findings, ...classContractFindings(classes.classesByService, contracts), ...contractClassFindings(classes.classesByService, contracts)];
}

/** The scenario ids a back end proves: every `<pattern>/<scenario>:` test title of an e2e or integration spec. */
function provenScenarios(ts, repoRoot, files) {
  const proven = new Set();
  for (const file of files) {
    if (!TEST_FOLDERS.some((folder) => file.startsWith(folder)) || !SPEC_SUFFIXES.some((suffix) => file.endsWith(suffix))) continue;
    const text = readText(repoRoot, file);
    if (text === null) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && TEST_CALLEES.has(node.expression.text)) {
        const title = literalText(ts, node.arguments[0]);
        const colon = title === null ? -1 : title.indexOf(':');
        if (colon > 0) proven.add(title.slice(0, colon));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return proven;
}

let memoScenarios;
/** ruleParams.be.patternScenarios of the slot manifest this runtime ships. */
const scenariosTable = () => (memoScenarios ??= ruleParams(loadSlotManifest(), 'be').patternScenarios ?? {});

/** Findings of BE_PATTERN_SPEC_MISSING: each declared pattern's required scenarios have a test. */
export function patternSpecFindings({ repoRoot, files, repo, scenarios = scenariosTable() }) {
  const patterns = (repo.sides?.be?.patterns ?? []).filter((name) => (scenarios[name] ?? []).length > 0);
  if (patterns.length === 0) return [];
  const ts = typescriptFor(repoRoot);
  if (!ts) return [];
  const proven = provenScenarios(ts, repoRoot, files);
  const findings = [];
  for (const pattern of patterns) {
    for (const scenario of scenarios[pattern]) {
      const id = `${pattern}/${scenario}`;
      if (!proven.has(id)) findings.push(found(PATTERN_SPEC_MISSING, 'hfs.json', `The pattern \`${pattern}\` is declared but no e2e or integration spec (be/src/tests/e2e, be/src/tests/integration) holds a test titled \`${id}: ...\`; each scenario of a declared pattern is proven on the test world.`, { pattern, scenario: id }));
    }
  }
  return findings;
}
