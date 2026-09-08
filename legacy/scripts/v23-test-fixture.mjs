// Synthetic scope/owner declarations for retained runtime regression fixtures.
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, rmdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession as open, confirmSession as confirm } from './session-open.mjs';
import { deliveryPolicy, scopeHash } from './mission-scope.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureFiles = new Map();
function remember(owner, file, boundary, previous = null) {
  const key = path.resolve(owner); const files = fixtureFiles.get(key) ?? new Map();
  if (!files.has(file)) files.set(file, { boundary, previous });
  fixtureFiles.set(key, files);
}
export function cleanupFixtureOwners(owner) {
  const key = path.resolve(owner); const files = fixtureFiles.get(key);
  if (!files) return;
  for (const [file, { boundary, previous }] of files) {
    const relative = path.relative(boundary, file);
    if (path.isAbsolute(relative) || relative.startsWith('..')) throw Error('fixture cleanup escaped its recorded workspace metadata root');
    if (existsSync(file)) {
      if (lstatSync(file).isSymbolicLink()) throw Error('fixture cleanup refuses replaced metadata symlink');
      if (previous === null) unlinkSync(file); else writeFileSync(file, previous);
    }
    let directory = path.dirname(file);
    while (directory !== boundary && existsSync(directory) && readdirSync(directory).length === 0) {
      rmdirSync(directory); directory = path.dirname(directory);
    }
  }
  fixtureFiles.delete(key);
}
export function discoveryFor(project = 'fixture', { tags = ['documentation'], stage = 'implement', head = 'a'.repeat(40) } = {}) {
  const policy = deliveryPolicy(ROOT); const applicable = new Set(Object.entries(policy.lanes).filter(([, lane]) => lane.when.some(tag => tags.includes(tag))).map(([id]) => id));
  return { version: 1, stage, repositories: [{ role: 'be', project, repository: 'https://github.com/sample/fixture.git', routeRef: `.workspaces/local/routes/${project}/be/config.json`, head }], impacts: [{ id: 'bounded', role: 'be', routes: tags.includes('interface') ? ['/modules/[id]', '/modules/[id]/settings'] : [], code: ['src/modules'], behavior: 'The requested bounded behavior is available through the declared boundary.', tags, evidence: ['source:src/modules'] }], destinations: [{ role: 'be', kind: 'artifact', target: 'session evidence' }], unresolved: [], lanes: Object.fromEntries(Object.entries(policy.lanes).map(([id, lane]) => [id, applicable.has(id) ? { status: 'planned', reason: 'The frozen impact names this capability.', owner: 'be', inputs: ['The confirmed requirements and prior lane outputs.'], outputs: [`Reviewable ${id} delivery.`], verification: [`Exercise positive and negative ${id} outcomes.`], dependsOn: lane.after.filter(dep => applicable.has(dep)) } : { status: 'not-applicable', reason: 'No frozen impact touches this capability.' }])) };
}
export function answerFor(mission, sourceRef = 'user:scope-answer') {
  return { kind: 'scope-answer', sourceRef, statement: 'I approve the displayed scope as stated.', scopeHash: scopeHash(mission), presentedScopeHash: scopeHash(mission), coverage: Object.fromEntries(deliveryPolicy(ROOT).authorityFields.map(field => [field, 'I approve the displayed scope as stated.'])) };
}
export function declareOwner(source, project, owner) {
  const declaration = path.join(source, '.workspaces', 'projects', project, 'workflow.json');
  const route = path.join(source, '.workspaces', 'local', 'routes', project, 'be', 'config.json');
  mkdirSync(path.dirname(declaration), { recursive: true }); mkdirSync(path.dirname(route), { recursive: true });
  if (!existsSync(declaration)) {
    writeFileSync(declaration, JSON.stringify({ version: 1, project, ownerRole: 'be' }));
    remember(owner, declaration, path.join(source, '.workspaces', 'projects'));
  }
  if (!existsSync(route)) {
    writeFileSync(route, JSON.stringify({ project, role: 'be', source: { path: source }, repository: { diskPath: owner, gitRepository: 'https://github.com/sample/fixture.git' } }));
    remember(owner, route, path.join(source, '.workspaces', 'local', 'routes'));
  }
}
export async function openSession(sessions, input) {
  const owner = path.dirname(path.dirname(sessions)); const source = path.dirname(ROOT);
  const git = (...args) => execFileSync('git', ['-C', owner, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!existsSync(path.join(owner, '.git'))) { git('init'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'Fixture source'); }
  const suffix = createHash('sha256').update(sessions).digest('hex').slice(0, 8);
  input = { ...input, project: `${input.project}-${suffix}`, mission: { ...input.mission, discovery: input.mission.discovery ?? discoveryFor(`${input.project}-${suffix}`, { head: git('rev-parse', 'HEAD') }) } };
  declareOwner(source, input.project, owner);
  const indexRoot = path.join(source, '.workspaces', 'local', 'workflows');
  const existingIndex = input.sessionId ? path.join(indexRoot, `${input.sessionId}.json`) : null;
  const previous = existingIndex && existsSync(existingIndex) ? readFileSync(existingIndex) : null;
  const result = await open(sessions, input);
  remember(owner, path.join(indexRoot, `${path.basename(result.session)}.json`), indexRoot, previous);
  return result;
}
export async function confirmSession(session, decision) {
  const state = JSON.parse(readFileSync(path.join(session, 'state.json'), 'utf8'));
  if (decision.selected === 'corrected') decision = { ...decision, mission: { ...decision.mission, discovery: decision.mission.discovery ?? state.mission.discovery } };
  if (decision.selected === 'as-stated') decision = { ...decision, authority: decision.authority ?? answerFor(state.mission, decision.sourceRef) };
  return confirm(session, decision);
}
