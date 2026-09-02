import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const operatorsDir = path.join(root, 'operators');
const routing = JSON.parse(await readFile(path.join(root, 'routing.json'), 'utf8'));
const errors = [];

const kinds = new Set(Object.keys(routing.kinds));
const operators = new Map();

for (const entry of await readdir(operatorsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = JSON.parse(await readFile(path.join(operatorsDir, entry.name, 'operator.json'), 'utf8'));
  const schema = await readFile(path.join(operatorsDir, entry.name, 'output.schema.json'), 'utf8');
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
    } else if (route.target !== undefined) {
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
