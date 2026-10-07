// Code surface extraction of check-work-deep.mjs (SUSPECT-tier heuristics): the http routes, graphql operations and
// domain events a backend ships, read from its source tree.
import fs from 'node:fs';
import path from 'node:path';
import { walk } from './check-example-work.mjs';

const SKIP = new Set(['node_modules', 'dist', '.next', '.starciwork']);
export const srcFiles = (dir, ext) => {
  if (!fs.existsSync(dir)) return [];
  return walk(dir).filter(f => f.endsWith(ext) && !f.split(path.sep).some(s => SKIP.has(s)));
};

const HTTP_DECORATOR = new RegExp(['@(Get|Post|Put|Patch|Delete|Head|Options)', String.raw`\(\s*`, `['"]`, `([^'"]*)`, `['"]?`, String.raw`\s*\)`].join(''), 'g');
const GQL_DECORATOR = new RegExp(['@(Query|Mutation)', String.raw`\b`, String.raw`[^)]*\)`, String.raw`\s*(?:async\s+)?`, String.raw`(\w+)`, String.raw`\s*\(`].join(''), 'g');

/** HTTP routes from NestJS controllers: @Controller prefix + method decorators in the same file. */
export function httpRoutes(repoRoot) {
  const routes = [];
  for (const file of srcFiles(path.join(repoRoot, 'src'), '.controller.ts')) {
    const text = fs.readFileSync(file, 'utf8');
    const prefix = /@Controller\(\s*['"]([^'"]*)/.exec(text)?.[1] ?? '';
    for (const m of text.matchAll(HTTP_DECORATOR)) {
      routes.push({method: m[1].toUpperCase(), path: `/${[prefix, m[2]].filter(Boolean).join('/')}`.replace(/\/+/g, '/'), file});
    }
    // bare @Get() with no arg
    for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*\)/g)) {
      routes.push({method: m[1].toUpperCase(), path: `/${prefix}`.replace(/\/+/g, '/'), file});
    }
  }
  return routes;
}

const subdirectories = dir => fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory());

/** The `<cap>/<op>/` directories under a `graphql/queries` or `graphql/mutations` directory. */
function operationDirs(abs, kind) {
  const ops = [];
  for (const cap of subdirectories(abs)) {
    const capDir = path.join(abs, cap);
    for (const op of subdirectories(capDir)) ops.push({kind, cap, op, file: path.join(capDir, op)});
  }
  return ops;
}

function findOpDirs(dir, ops) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if ((entry.name === 'queries' || entry.name === 'mutations') && path.basename(dir) === 'graphql') ops.push(...operationDirs(abs, entry.name.slice(0, -1)));
    else findOpDirs(abs, ops);
  }
}

/** GraphQL operations: `graphql/{queries,mutations}/<cap>/<op>/` dirs anywhere under src (this codebase
 * nests them per-feature: src/features/<feature>/graphql/...), plus @Query/@Mutation decorated methods. */
export function gqlOps(repoRoot) {
  const ops = [];
  findOpDirs(path.join(repoRoot, 'src'), ops);
  for (const file of srcFiles(repoRoot, '.resolver.ts')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(GQL_DECORATOR)) {
      ops.push({kind: m[1].toLowerCase(), op: m[2], file});
    }
  }
  return ops;
}

/** Domain events: `class XxxEvent` declarations (this codebase uses class-based events, not string emits). */
export function eventClasses(repoRoot) {
  const names = new Set();
  for (const file of srcFiles(path.join(repoRoot, 'src'), '.ts')) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/class\s+(\w+Event)\b/g)) names.add(m[1]);
  }
  return names;
}

export const eventClassOf = id => id.replace(/^event\./, '').split('.').map(s => s.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())).join('') + 'Event';
