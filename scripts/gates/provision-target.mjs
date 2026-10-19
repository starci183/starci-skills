// Public operation targets reuse the app's one stack declaration and credential schema.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { findStackDeclaration } from '../lib/stack-declaration.mjs';
import { validateAgainstSchema } from '../lib/json-schema.mjs';
import { isLoopbackHost } from '../lib/loopback-host.mjs';
import { invocationDir } from '../lib/roots.mjs';
import { repositoryHome } from '../hfs/repo-identity.mjs';
import { canonicalPath, pathKey } from '../lib/path-key.mjs';
import { openMachineReader } from '../../engine/db/machine.mjs';

const refuse = code => Object.assign(new Error(code), { code });

function targetSchema() {
  const schema = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules/schemas/provision-operation.schema.yaml'), 'utf8'));
  const stacks = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules/schemas/application-stacks.schema.yaml'), 'utf8'));
  return { ...schema, $defs: { ...schema.$defs, serviceCredential: stacks.$defs.serviceCredential } };
}

function assertRegisteredWorktree(repoRoot, ledgerRoot) {
  if (pathKey(canonicalPath(repoRoot)) === pathKey(canonicalPath(ledgerRoot))) return;
  const machine = openMachineReader();
  try {
    const registered = machine?.worktreeRow(repoRoot);
    if (!registered || registered.removed_at !== null || pathKey(canonicalPath(registered.repo_root)) !== pathKey(canonicalPath(ledgerRoot)))
      throw refuse('provision-worktree-unregistered');
  } finally { machine?.close(); }
}

function readTargetDeclaration(repoRoot, targetId, provider) {
  if (typeof targetId !== 'string' || !/^[a-z][a-z0-9-]*$/u.test(targetId)) throw refuse('provision-target-id-required');
  const declaration = findStackDeclaration(repoRoot);
  if (declaration.missing || declaration.error) throw refuse('provision-declaration-unavailable');
  const operations = declaration.doc.operations;
  if (!operations || validateAgainstSchema(operations, targetSchema()).length) throw refuse('provision-declaration-invalid');
  const selected = operations.targets[targetId];
  if (!selected) throw refuse('provision-target-unknown');
  if (provider && !(Array.isArray(provider) ? provider : [provider]).includes(selected.provider)) throw refuse('provision-provider-mismatch');
  return { declaration, selected };
}

function targetOrigin(selected) {
  let origin;
  try { origin = new URL(selected.origin); } catch { throw refuse('provision-origin-invalid'); }
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || (origin.protocol !== 'https:' && !(selected.context === 'local' && origin.protocol === 'http:' && isLoopbackHost(origin.hostname))))
    throw refuse('provision-origin-refused');
  return origin.origin;
}

function targetTransport(selected) {
  if (selected.provider === 'app-stack' || selected.provider === 'app-db')
    return { transport: 'native', origin: null, endpoint: selected.endpoint };
  return { transport: 'http', origin: targetOrigin(selected), endpoint: null };
}

function credentialReferences(selected) {
  const credentials = Object.create(null);
  for (const ref of selected.credentials) {
    if (Object.hasOwn(credentials, ref.id) || (ref.hostConnection === undefined && (typeof ref.key !== 'string' || !ref.key.trim()))) throw refuse('provision-credential-reference-invalid');
    credentials[ref.id] = ref;
  }
  const optional = selected.optionalCredentials ?? [];
  if (new Set(optional).size !== optional.length || optional.some(role => !Object.hasOwn(credentials, role)))
    throw refuse('provision-credential-reference-invalid');
  for (const role of optional) credentials[role] = { ...credentials[role], optional: true };
  return credentials;
}

function appProject(repoRoot) {
  let app;
  try { app = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hfs.json'), 'utf8')); }
  catch { throw refuse('provision-project-unavailable'); }
  if (app.kind !== 'app' || typeof app.project !== 'string' || !app.project.trim()) throw refuse('provision-project-unavailable');
  return app.project;
}

/**
 * Resolve one named public target from the app's stack declaration. No credential presence,
 * authentication or provider request is inspected. The public transport identity binds HTTP
 * origins or native endpoints to the canonical App home; declaration bytes bind plan acceptance.
 */
export function resolveProvisionTarget({ cwd = invocationDir(), targetId, provider = null } = {}) {
  const repoRoot = path.resolve(cwd);
  const ledgerRoot = repositoryHome(repoRoot);
  assertRegisteredWorktree(repoRoot, ledgerRoot);
  const { declaration, selected } = readTargetDeclaration(repoRoot, targetId, provider);
  const transport = targetTransport(selected);
  const credentials = credentialReferences(selected);
  const project = appProject(repoRoot);
  const endpointIdentity = transport.transport === 'http'
    ? { kind: 'http-origin', origin: transport.origin }
    : { kind: selected.provider, project, repository: pathKey(canonicalPath(ledgerRoot)), endpoint: transport.endpoint };
  return {
    id: targetId, project, repoRoot, ledgerRoot, provider: selected.provider,
    context: selected.context, ...transport, endpointIdentity, resource: selected.resource,
    credentials, destination: selected.destination ?? null, actions: selected.actions ?? [],
    declaration: { path: declaration.file, sha256: sha256(fs.readFileSync(declaration.file)) },
  };
}
