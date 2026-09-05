// The synthetic origin the import specs share (producer-import.spec.mjs, validate-chain.spec.mjs): a
// host under the temp dir with .worktrees/sessions/original, whose step 1 is one done git.publish
// branch with a receipt that satisfies the git-publication contract, and .worktrees/sessions/receiver,
// a session that holds nothing at step 100 (the evidence range), so a spec can import 1/1 of the original into 100/1 of the
// receiver and judge the result through the import gate. Nothing here reads an installed session.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateImportedInput } from './producer-import.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HEAD = '1'.repeat(40);
export const digest = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const write = (p, v) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n'); };
export const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function producerImportFixture() {
  const host = mkdtempSync(path.join(tmpdir(), 'producer-import-')), sessions = path.join(host, '.worktrees/sessions'), sourceSession = path.join(sessions, 'original'), targetSession = path.join(sessions, 'receiver'), source = path.join(sourceSession, 'step-1/parallel-1'), target = path.join(targetSession, 'step-100/parallel-1');
  const req = { schemaVersion: 9, operatorId: 'git.publish', step: 1, parallel: 1, sessionId: 'original', contexts: [], requirements: {}, inputs: {}, resume: null };
  write(path.join(source, 'request/request.json'), req);
  write(path.join(sourceSession, 'state.json'), { id: 'original', steps: { '1/1': 'git.publish' }, requestHashes: { '1/1': digest(readFileSync(path.join(source, 'request/request.json'))) } });
  write(path.join(targetSession, 'state.json'), { id: 'receiver', steps: { '2/1': 'quality.verify' }, requestHashes: {}, chain: [['2/1']], current: '2/1' });
  const table = (h, header, rows) => `## ${h}\n\n| ${header.join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n`;
  const contract = read(path.join(ROOT, 'templates/kinds/git-publication.contract.json'));
  let md = '# git-publication — fixture\n\n';
  for (const s of contract.sections) { const name = s.heading.slice(4, -1); if (s.rows) md += table(name, ['Field', 'Value'], s.rows.map((row) => [row, row === 'Operator' ? 'git.publish' : row === 'Frozen head' ? HEAD : 'fixture'])); else if (name === 'Published heads') md += table(name, ['Checkout', 'Branch', 'Head', 'Previous remote head', 'Commits'], [['fixture', 'fixture', '`' + HEAD + '`', '—', '1']]); else if (name === 'Hooks') md += table(name, ['Hook', 'Reference', 'Outcome'], [['`pre-commit`', 'fixture', 'passed']]); else if ((s.minRows ?? 1) === 0) md += table(name, s.table.replace(/^\^?\||\|\$?$/g, '').split('|').map((c) => c.trim()), []); else md += table(name, ['Code', 'Subject', 'Statement'], [['`BOUNDARY_CLEAN`', 'fixture', 'Synthetic typed fixture; no publication performed']]); }
  write(path.join(source, 'response/response.md'), md); write(path.join(source, 'response/artifacts/raw.log'), 'raw gate output\n');
  write(path.join(source, 'response/response.json'), { schemaVersion: 9, operatorId: 'git.publish', step: 1, parallel: 1, status: 'done', fields: { 'git-publication': 'response/response.md' }, fallbacks: [], commits: [], next: [] });
  const args = { sourceSessionId: 'original', sourceStep: 1, sourceParallel: 1, targetSessionId: 'receiver', targetStep: 100, targetParallel: 1, root: ROOT, hostRoot: host };
  const check = () => validateImportedInput(ROOT, targetSession, 'step-100/parallel-1/response/response.md', 'git-publication', { hostRoot: host });
  const cleanup = () => { if (!path.resolve(host).startsWith(path.resolve(tmpdir()) + path.sep)) throw Error('unsafe fixture cleanup'); rmSync(host, { recursive: true, force: true }); };
  return { host, sourceSession, targetSession, source, target, args, check, cleanup };
}
