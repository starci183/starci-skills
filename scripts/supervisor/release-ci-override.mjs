// The owner at a terminal may accept red CI for one SHA; both the local record and the runtime tree's ruling are required by the canon cut.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createInterface } from 'node:readline/promises';
import { parseYaml } from '../../engine/yaml.mjs';
import { gitCommonDir } from '../guards/release-record.mjs';
import { boundIdentityOf, rightsRoleOf } from '../guards/rights.mjs';
import { hostLockOwner } from '../machine/host-lock.mjs';
import { configGet } from '../api/git/config-get.mjs';
import { workflowRuns } from '../api/gh/workflow-runs.mjs';
import { ciPolicy } from './release-ci-rows.mjs';

const SHA = /^[a-f0-9]{40}$/;
const SCHEMA = 'starci/ci-override@1';
const rulingFile = (repo) => path.join(repo, 'modules/kernel/owner-rulings.yaml');
const recordFile = (dir, sha) => path.join(dir, 'starci-release', `${sha}.ci-override.json`);

/** An override is evidence only for its exact SHA, with an attributed reason and timestamp and, for canon, a ruling in the tree being cut. */
export function readCiOverride({ repo, sha, commonDir = null, requireRuling = false }) {
  if (!SHA.test(String(sha))) return null;
  try {
    const record = JSON.parse(fs.readFileSync(recordFile(commonDir ?? gitCommonDir(repo), sha), 'utf8'));
    if (record.schema !== SCHEMA || record.sha !== sha || !record.reason?.trim() || !record.by?.trim() || !Number.isFinite(Date.parse(record.at)) || typeof record.runUrl !== 'string') return null;
    if (requireRuling) {
      const doc = parseYaml(fs.readFileSync(rulingFile(repo), 'utf8'));
      if (!doc.rulings?.some((r) => r.id === `ci-override-${sha.slice(0, 12)}` && r.ruling === record.reason)) return null;
    }
    return record;
  } catch { return null; }
}

/** Resolve actual terminal bindings and the release host lock before testing the caller's rights role. */
function callerRole(env) {
  const identity = boundIdentityOf(env.ORCA_TERMINAL_HANDLE, { env });
  return rightsRoleOf({ ...identity, env, lockOwner: String(env.STARCI_ROLE ?? '').toLowerCase() === 'release' ? hostLockOwner({ env }) : null });
}

/** Ask the owner for the SHA prefix on the live terminal; always close the readline interface. */
async function confirmSha(sha) {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try { return await reader.question(`Type ${sha.slice(0, 12)} to accept red CI: `); } finally { reader.close(); }
}

/** Append a single safely quoted ruling before top-level supersedes, preserving every existing byte; conflicting IDs refuse. */
function appendRuling(text, { sha, reason, at }) {
  const id = `ci-override-${sha.slice(0, 12)}`;
  const doc = parseYaml(text);
  if (!Array.isArray(doc.rulings)) throw new Error('owner rulings has no rulings list');
  const existing = doc.rulings.find((r) => r.id === id);
  if (existing) {
    if (existing.ruling !== reason) throw new Error('the owner ruling already has another reason');
    return text;
  }
  const match = /^supersedes:/m.exec(text);
  if (!match) throw new Error('owner rulings has no top-level supersedes key');
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const entry = [`  - id: ${id}`, `    date: '${at.slice(0, 10)}'`, '    source: "the owner at the terminal (starci release ci-override)"', `    ruling: ${JSON.stringify(reason)}`, '    supersedes: []', '    enforcedBy: [scripts/supervisor/release-cut.mjs]', ''].join(nl);
  const result = `${text.slice(0, match.index)}${entry}${nl}${text.slice(match.index)}`;
  parseYaml(result);
  return result;
}

/** Owner-only override: a bound role or non-TTY input refuses with exit 2 before prompting or writing; seams replace identity, terminal and confirmation in smoke proofs. */
export async function ciOverride({ repo, sha, reason, deps = {} }) {
  const refuse = (code, why) => ({ ok: false, code: 2, why: `${code}: ${why}` });
  try {
    if ((deps.role ?? callerRole)(deps.env ?? process.env) || !(deps.isTTY ?? process.stdin.isTTY)) return refuse('RIGHTS_OWNER_ONLY', 'CI override requires the owner at an interactive terminal');
  } catch { return refuse('RIGHTS_OWNER_ONLY', 'the caller identity could not be resolved'); }
  sha = typeof sha === 'string' ? sha.toLowerCase() : sha;
  if (!SHA.test(String(sha)) || typeof reason !== 'string' || !reason.trim()) return refuse('RELEASE_CI_OVERRIDE_USAGE', 'provide --sha <40 lowercase hex> and --reason <text>');
  reason = reason.trim();
  try {
    const dir = (deps.commonDir ?? gitCommonDir)(repo);
    if (!dir) return refuse('RELEASE_CI_OVERRIDE_WRITE', 'the repository has no git common dir');
    if (await (deps.confirm ?? confirmSha)(sha) !== sha.slice(0, 12)) return refuse('RELEASE_CI_OVERRIDE_CONFIRM', 'the typed SHA prefix did not match');
    const at = (deps.now ?? (() => new Date()))().toISOString();
    const name = (deps.configGet ?? configGet)(repo, 'user.name');
    if (!name.ok || !String(name.stdout ?? '').trim()) return refuse('RELEASE_CI_OVERRIDE_WRITE', 'git config user.name is required');
    const by = `${String(name.stdout).trim()} (${(deps.osUser ?? (() => os.userInfo().username))()})`;
    const file = recordFile(dir, sha);
    const ownerFile = rulingFile(repo);
    const ownerText = fs.existsSync(ownerFile) ? fs.readFileSync(ownerFile, 'utf8') : null;
    const updated = ownerText === null ? null : appendRuling(ownerText, { sha, reason, at });
    let runUrl = '';
    try {
      const reply = (deps.workflowRuns ?? workflowRuns)({ workflow: ciPolicy().workflow, sha }, { cwd: repo });
      const runs = reply.status === 0 ? JSON.parse(reply.stdout) : [];
      runUrl = runs.find((run) => run.headSha === sha && run.status === 'completed')?.url ?? '';
    } catch { /* The owner can record a SHA override even while GitHub is unavailable. */ }
    const record = { schema: SCHEMA, sha, reason, by, at, runUrl };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // A runtime ruling is written first: an interrupted write cannot leave a new record without its ruling.
    if (updated !== null && updated !== ownerText) fs.writeFileSync(ownerFile, updated);
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
    return { ok: true, code: 0, file, ruling: updated === null ? null : ownerFile, record };
  } catch (error) { return refuse('RELEASE_CI_OVERRIDE_WRITE', error.message); }
}
