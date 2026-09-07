// Synthetic evaluation fixtures only. No product identities, credentials or claimed real UAT.
import fs from 'node:fs';
import path from 'node:path';
import { validateWorkspace, sha256 } from '../core/index.mjs';

export const COMMIT = 'a'.repeat(40);
export function json(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  return target;
}
export function node(root, relative, metadata = {}, body = 'Scope: synthetic contract. Done when the declared assertion is observed.') {
  const target = path.join(root, relative, 'node.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `---\n${JSON.stringify({ schema: 'work/node@1', id: relative.replaceAll('/', ':'), kind: 'business', required: true, state: 'todo', assertions: ['accept'], ...metadata }, null, 2)}\n---\n${body}\n`);
  return target;
}
export function resource(root, id, kind, details = {}) {
  return json(root, `_resources/${kind}/${id}/resource.yaml`, { schema: 'work/resource@1', id, kind, owner: 'synthetic-owner', revision: 'r1', details });
}
export function base(root) {
  json(root, 'workspace.yaml', { schema: 'work/workspace@1', id: 'synthetic-workspace' });
  return root;
}
export function complete(root, relative, metadata = {}, extraEvidence = {}) {
  const id = metadata.id ?? relative.replaceAll('/', ':');
  node(root, relative, metadata);
  const inputDigest = validateWorkspace(root).nodes.find(item => item.id === id).inputDigest;
  const evidenceId = `${id}:evidence`;
  const evidence = { schema: 'work/evidence@1', id: evidenceId, nodeId: id, inputDigest, outcome: 'pass',
    assertions: [{ id: 'accept', outcome: 'pass', observation: 'Synthetic fixture observation, not live product evidence.' }], assets: [], ...extraEvidence };
  const evidenceFile = json(root, `${relative}/evidence/current/manifest.yaml`, evidence);
  node(root, relative, { ...metadata, state: 'done', completion: { inputDigest, evidence: [evidenceId], ...(metadata.kind === 'implementation' ? { codeRefs: [{ repository: 'repo', commit: COMMIT }] } : {}) } });
  return { id, evidence, evidenceFile, inputDigest, evidenceId };
}
export function mutateJSON(file, mutate) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  mutate(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
export function mutateNode(file, mutate) {
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const metadata = JSON.parse(match[1]); mutate(metadata);
  fs.writeFileSync(file, `---\n${JSON.stringify(metadata, null, 2)}\n---\n${match[2]}`);
}
export function imageAsset(directory) {
  // Real decodable 1x1 PNG, explicitly a synthetic fixture, never a claimed browser screenshot.
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4MsAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(path.join(directory, 'capture.png'), bytes);
  return { path: 'capture.png', sha256: sha256(bytes) };
}
