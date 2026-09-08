import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseOperatorMd, cellCodes } from './operator-md.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const operatorsDir = path.join(root, 'operators');
const routing = JSON.parse(await readFile(path.join(root, 'routing.json'), 'utf8'));
const errors = [];

const kinds = new Set(Object.keys(routing.kinds));
const operators = new Map();
const registry = await loadErrorsRegistry(root);
errors.push(...registry.errors);

for (const entry of await readdir(operatorsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(operatorsDir, entry.name);
  const manifest = JSON.parse(await readFile(path.join(dir, 'operator.json'), 'utf8'));
  if (existsSync(path.join(dir, 'operator.md'))) {
    // An operator.md package emits exactly the domains of the stop codes its Stops table lists; `self`
    // is the operator's own domain, which routing.json answers with kind "resume".
    const op = parseOperatorMd(await readFile(path.join(dir, 'operator.md'), 'utf8'), 'en');
    const domains = new Set();
    for (const row of op.tables.stops?.rows ?? []) {
      const code = cellCodes(row.code)[0] ?? row.code.trim();
      const domain = registry.codes[code]?.domain;
      if (!domain) continue; // validate-operator reports the unknown code
      domains.add(domain === 'self' ? manifest.domain : domain);
    }
    operators.set(manifest.id, domains.size ? domains : null);
    continue;
  }
  const schema = await readFile(path.join(dir, 'output.schema.json'), 'utf8');
  const match = /"owningDomain"\s*:\s*\{[^}]*"enum"\s*:\s*(\[[^\]]*\])/s.exec(schema);
  operators.set(manifest.id, match ? new Set(JSON.parse(match[1])) : null);
}

// Every operator must have a route table, and the table must cover exactly the domains
// that operator can actually emit. A domain it can emit but cannot route is a dead end;
// a route for a domain it never emits is a rule nobody reaches.
for (const [id, domains] of operators) {
  const table = routing.routes[id];
  if (!table) {
    errors.push(`${id}: no route table`);
    continue;
  }
  if (domains === null) {
    errors.push(`${id}: output schema declares no owningDomain enum`);
    continue;
  }
  for (const domain of domains) {
    if (!Object.hasOwn(table, domain)) errors.push(`${id}: emits "${domain}" with no route`);
  }
  for (const domain of Object.keys(table)) {
    if (!domains.has(domain)) errors.push(`${id}: routes "${domain}" which it never emits`);
  }
}

for (const id of Object.keys(routing.routes)) {
  if (!operators.has(id)) errors.push(`routing.json names unknown operator ${id}`);
}

// A destination must resolve. An "operator" route needs a real target; the other kinds
// must not carry one, or the map would silently disagree with itself.
for (const [id, table] of Object.entries(routing.routes)) {
  for (const [domain, route] of Object.entries(table)) {
    if (!kinds.has(route.kind)) {
      errors.push(`${id}.${domain}: unknown kind ${route.kind}`);
      continue;
    }
    if (route.kind === 'operator') {
      if (!route.target) errors.push(`${id}.${domain}: operator route needs a target`);
      else if (!operators.has(route.target)) errors.push(`${id}.${domain}: targets unknown operator ${route.target}`);
      else if (route.target === id) errors.push(`${id}.${domain}: targets itself; use kind "resume"`);
      if (route.then !== undefined) errors.push(`${id}.${domain}: only a chain route carries then`);
    } else if (route.kind === 'chain') {
      // A chain route names the operator whose primary output a sibling mission must produce; the wall
      // is cleared by planning and running that mission, not by a person.
      if (!route.target) errors.push(`${id}.${domain}: chain route needs a target operator`);
      else if (!operators.has(route.target)) errors.push(`${id}.${domain}: chain targets unknown operator ${route.target}`);
      else if (route.target === id) errors.push(`${id}.${domain}: chain targets itself`);
      if (route.then !== undefined) errors.push(`${id}.${domain}: a chain route carries no then; the sibling mission is planned from its goal`);
    } else if (route.target !== undefined || route.then !== undefined) {
      errors.push(`${id}.${domain}: kind ${route.kind} must not carry a target`);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  const routes = Object.values(routing.routes).reduce((total, table) => total + Object.keys(table).length, 0);
  process.stdout.write(`routing map closed: ${operators.size} operators, ${routes} routes\n`);
}
