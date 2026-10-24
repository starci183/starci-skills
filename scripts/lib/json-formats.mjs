// json-formats.mjs - the JSON files whose format a tool requires, declared once by rule (a basename, a tool-fixed folder or a managed
// fragment) and not file by file. A file of a listed format is not authored declarative source: npm, tsc, turbo, next-intl, Claude Code,
// the stack tooling and Keycloak read it as JSON and nothing else, so no YAML or JS form of it exists. Everything else that is authored
// config belongs in YAML, and the json-exceptions check (scripts/checks/check-json-exceptions.mjs) refuses it. Proven by the package spec
// src/json-formats.spec.mjs over the bundled copy of this file.

/** The base name of a slash path. */
const baseOf = (rel) => rel.slice(rel.lastIndexOf('/') + 1);

/**
 * The declared formats: `id`, the `tool` that fixes the format and a `match(rel)` over a skill-relative slash path. A format names a
 * kind of file (a base name or a folder the tool reads by position), never one path of this repository.
 */
export const JSON_FORMATS = Object.freeze([
  { id: 'npm-manifest', tool: 'npm', match: (rel) => baseOf(rel) === 'package.json' || baseOf(rel) === 'package-lock.json' },
  { id: 'typescript-config', tool: 'tsc', match: (rel) => /^tsconfig(\.[A-Za-z0-9-]+)*\.json$/.test(baseOf(rel)) },
  { id: 'shared-tsconfig-preset', tool: 'tsc (extends)', match: (rel) => /^packages\/tsconfig\/[^/]+\.json$/.test(rel) },
  { id: 'turbo-pipeline', tool: 'turbo', match: (rel) => baseOf(rel) === 'turbo.json' },
  { id: 'nest-cli', tool: '@nestjs/cli', match: (rel) => baseOf(rel) === 'nest-cli.json' },
  { id: 'tree-kind', tool: 'starci hfs (hfs.json at a tree root)', match: (rel) => baseOf(rel) === 'hfs.json' },
  { id: 'claude-code-settings', tool: 'Claude Code', match: (rel) => /(^|\/)\.claude\/settings\.json$/.test(rel) },
  { id: 'i18n-message-catalog', tool: 'next-intl', match: (rel) => /(^|\/)modules\/i18n\/messages\/[a-z]{2}(-[A-Za-z]+)?\.json$/.test(rel) },
  { id: 'stack-environment', tool: 'starci stack (.starcistacks layout)', match: (rel) => /(^|\/)\.starcistacks\/[^/]+\/environment\.json$/.test(rel) },
  { id: 'stack-infra-metadata', tool: 'starci stack (.starcistacks layout)', match: (rel) => /(^|\/)\.starcistacks\/[^/]+\/infra\/metadata\.json$/.test(rel) },
  { id: 'keycloak-realm-import', tool: 'Keycloak realm import', match: (rel) => /(^|\/)\.starcistacks\/[^/]+\/infra\/compose\/realm-[^/]+\.json$/.test(rel) },
  { id: 'package-scripts-fragment', tool: 'npm (scripts rendered into package.json)', match: (rel) => /^packages\/hfs\/templates\/app\/package-scripts[^/]*\/[^/]+\.json$/.test(rel) },
  { id: 'async-event-contract', tool: 'starci app emit', match: (rel) => /(^|\/)be\/contracts\/[^/]+\/events(\.pin)?\.json$/.test(rel) },
  { id: 'operation-contract', tool: 'starci app emit', match: (rel) => /(^|\/)be\/contracts\/[^/]+\/openapi\.json$/.test(rel) },
  { id: 'model-scorecard-snapshot', tool: 'scripts/agent/benchmark-snapshot.mjs', match: (rel) => /^benchmark\/snapshots\/[^/]+\.json$/.test(rel) },
]);

/** The declared format that fixes `rel`, or null: the file is authored JSON the check must refuse. */
export function jsonFormatOf(rel) {
  return JSON_FORMATS.find((format) => format.match(rel)) ?? null;
}
