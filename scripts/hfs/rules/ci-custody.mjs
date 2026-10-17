// ci-custody.mjs - R296-R298: CI declarations, sealed app keys and workflow reads agree by consumer, without decrypting or contacting GitHub.
import fs from 'node:fs';
import { list } from '../../lib/list.mjs';
import { findStackDeclaration, STACK_ROOT } from '../../lib/stack-declaration.mjs';
import { readCiDeclaration, sealedKeyNames, workflowReferences, ciNamesOfServices } from '../ci-declaration.mjs';
import { found } from './read.mjs';

const DECLARATION = `${STACK_ROOT}/application-stacks.yaml`;
const named = (entry) => typeof entry.name === 'string' && /^[A-Z][A-Z0-9_]*$/.test(entry.name);
const identity = (kind, name) => `${kind}:${name}`;
const atCi = (section) => `${DECLARATION}#ci.${section}`;

/** A CI or Dependabot secret must never also live in a sealed app member. */
function sealedFindings(ci, sealed) {
  const names = new Set([...ci.secrets, ...ci.dependabotSecrets].filter(named).map((entry) => entry.name));
  return sealed.filter(({ key }) => names.has(key)).map(({ key, file }) => found(
    'CI_SECRET_SEALED', file,
    `${key} is a CI secret (GitHub reads it) but it is sealed in ${file} for app containers; one key, one class: remove it from the member (starci app secret unset ...) and set it with starci app ci secret set ${key}`,
  ));
}

/** A source selects sealed keys only from its own member and environment. */
function sourceRuntimeFindings(source, grant, environment, { sealed, names, findings, seen }) {
  for (const entry of sealed) {
    if (entry.env !== environment || entry.member !== source?.member || !names.has(entry.key)) continue;
    if (source.keys !== undefined && !list(source.keys).includes(entry.key)) continue;
    const id = `${entry.file}:${grant.service}:${entry.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    findings.push(found('APP_SECRET_IN_CI', entry.file,
      `${entry.key} is read by the ${grant.service} container at runtime through the ${environment} deploy grant; keep it in the .enc and drop it from ci`));
  }
}

/** Only keys actually selected by a grant, in that grant's environment and member, are runtime consumers. */
function runtimeFindings(doc, ci, sealed) {
  const names = new Set([...ci.secrets, ...ci.vars].filter(named).map((entry) => entry.name));
  const findings = [], seen = new Set();
  for (const [environment, spec] of Object.entries(doc.environments ?? {})) {
    for (const grant of list(spec?.deploy?.secrets?.grants)) {
      if (typeof grant?.service !== 'string') continue;
      for (const source of list(grant.from)) sourceRuntimeFindings(source, grant, environment, { sealed, names, findings, seen });
    }
  }
  return findings;
}

/** Workflow reads are class-sensitive; legacy lists remain readable, but an absent ci block always signals migration once per name. */
function workflowFindings(doc, declared, references) {
  const hasCi = doc.ci !== undefined;
  const allowed = new Set(declared.map(({ kind, name }) => identity(kind, name)));
  if (hasCi) {
    for (const entry of ciNamesOfServices(doc).filter(named)) {
      const legacy = list(doc.services?.[entry.service]?.ci?.[`${entry.kind}s`]);
      if (legacy.some((item) => (typeof item === 'string' ? item : item?.name) === entry.name)) allowed.add(identity(`${entry.kind}s`, entry.name));
    }
  }
  const findings = [], seen = new Set();
  for (const { file, kind, name } of references) {
    if (allowed.has(identity(kind, name))) continue;
    const id = hasCi ? `${file}:${kind}:${name}` : name;
    if (seen.has(id)) continue;
    seen.add(id);
    findings.push(found('CI_DECLARATION_DRIFT', file,
      `${kind}.${name} is read by this workflow but is not declared in ci.${kind}; declare its name, scope and consumer in ${DECLARATION}`));
  }
  return findings;
}

/** Dependabot has its own store and consumer, so only Actions secrets and vars require a workflow read. */
function driftFindings(doc, ci, references) {
  const declared = [
    ...ci.secrets.filter(named).map((entry) => ({ ...entry, kind: 'secrets' })),
    ...ci.vars.filter(named).map((entry) => ({ ...entry, kind: 'vars' })),
  ];
  const findings = workflowFindings(doc, declared, references);
  if (doc.ci === undefined) return findings;
  const reads = new Set(references.map(({ kind, name }) => identity(kind, name)));
  for (const { kind, name, optional } of declared) {
    if (!optional && !reads.has(identity(kind, name))) findings.push(found('CI_DECLARATION_DRIFT', atCi(kind),
      `${name} is declared in ci.${kind} as non-optional but no workflow reads it; remove the declaration, mark it optional or wire its workflow consumer`));
  }
  const names = new Set(declared.map(({ kind, name }) => identity(kind, name)));
  for (const [service, entry] of Object.entries(doc.services ?? {})) {
    for (const [field, kind] of [['token', 'secrets'], ['hostVar', 'vars']]) {
      const name = entry?.ci?.[field];
      if (typeof name !== 'string' || names.has(identity(kind, name))) continue;
      findings.push(found('CI_DECLARATION_DRIFT', atCi(kind),
        `services.${service}.ci.${field} names ${name}, which is not declared in ci.${kind}; declare the shared CI name`));
    }
  }
  return findings;
}

/** Offline CI custody findings of an app root, in both lite and full editions. */
export function ciCustodyFindings({ repoRoot, repo, isRoot }) {
  if (repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition) || isRoot === false) return [];
  const { doc } = findStackDeclaration(repoRoot);
  if (!doc) return [];
  const ci = readCiDeclaration(doc);
  const sealed = sealedKeyNames(repoRoot, { fs });
  const references = workflowReferences(repoRoot, { fs });
  return [...sealedFindings(ci, sealed), ...runtimeFindings(doc, ci, sealed), ...driftFindings(doc, ci, references)];
}
