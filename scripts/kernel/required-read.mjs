// required-read.mjs — the server-derived Kernel READ set and actual deployed bytes.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { contractFilesOf, runtimeShaOf } from '../machine/contract-version.mjs';
import { statusQuery } from '../api/git/status-query.mjs';
import { INSTALL_MANIFEST_FILE, INSTALL_PROTOCOL_SCHEMA, installedPayloadDigest } from '../lib/install-custody.mjs';
import { ENGINE_SCHEMA } from '../../engine/constants.mjs';
import { parseJson } from '../lib/json.mjs';
export const KERNEL_BOOT_FILES = Object.freeze(['modules/kernel/kernel-prompt.md', 'modules/kernel/driver-loop.yaml']);
export const KERNEL_CONTRACT_FILES = Object.freeze([...KERNEL_BOOT_FILES, 'modules/kernel/api.yaml', 'modules/cli/commands/kernel', 'modules/kernel/owner-rulings.yaml']);
const OP_PROMPT_FILE = 'scripts/kernel/op-prompt.mjs';
const KERNEL_READ_SCHEMA = 'starci/kernel-required-read@1';
const refuse = detail => Object.assign(Error(detail), { code: 'kernel-read-unverified' });
const sameRow = (a, b) => a?.path === b?.path && a?.sha256 === b?.sha256 && a?.bytes === b?.bytes;

const expand = (root, relative) => {
  if (path.isAbsolute(relative) || relative.split('/').includes('..')) throw refuse('unsafe required read path');
  const file = path.join(root, relative), stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw refuse(`linked required read: ${relative}`);
  if (stat.isDirectory()) return fs.readdirSync(file).sort().flatMap(name => expand(root, `${relative}/${name}`));
  if (!stat.isFile()) throw refuse(`non-regular required read: ${relative}`);
  return [relative];
};

/** Derive required paths from the actual workflow/op contracts; caller-supplied paths cannot remove any. */
export function kernelReadManifest(db, workflowId, { root, authority, ops = [], clean = true, status = statusQuery } = {}) {
  try {
    const requiredOps = [...new Set([...db.prepare('SELECT DISTINCT op_id FROM jobs WHERE workflow_id=? AND op_id IS NOT NULL').all(workflowId).map(row => row.op_id), ...ops])].sort();
    const paths = [...KERNEL_CONTRACT_FILES, ...requiredOps.flatMap(op => contractFilesOf(root, op)), ...(requiredOps.length ? [OP_PROMPT_FILE] : [])];
    const installed = !fs.existsSync(path.join(root,'.git'));
    const files = new Set([...paths, ...(installed ? ['package.json','engine/constants.mjs'] : [])].flatMap(relative => expand(root, relative)));
    const rows = [...files].sort().map(relative => {
      // Validate parents too, not just a final file reached through an undeclared junction.
      const parts = relative.split('/');
      for (let i = 1; i <= parts.length; i++) if (fs.lstatSync(path.join(root, ...parts.slice(0,i))).isSymbolicLink()) throw refuse(`linked required read: ${relative}`);
      const bytes = fs.readFileSync(path.join(root, relative));
      return { path: relative, sha256: sha256(bytes), bytes: bytes.length };
    });
    let rev, revision;
    if (installed) {
      const descriptor = path.join(root,INSTALL_MANIFEST_FILE), stat = fs.lstatSync(descriptor);
      if (!stat.isFile() || stat.isSymbolicLink()) throw refuse('installed custody descriptor is not regular');
      const custody = JSON.parse(fs.readFileSync(descriptor,'utf8'));
      const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
      if (custody.name !== pkg.name || custody.version !== pkg.version || typeof pkg.name !== 'string' || !pkg.name
        || typeof pkg.version !== 'string' || !pkg.version || custody.installProtocol?.schema !== INSTALL_PROTOCOL_SCHEMA
        || custody.installProtocol.engine !== ENGINE_SCHEMA || !custody.files || Array.isArray(custody.files)) throw refuse('installed package/custody identity is unavailable');
      for (const row of rows) if (custody.files[row.path] !== installedPayloadDigest(fs.readFileSync(path.join(root,row.path))))
        throw refuse(`required bytes differ from installation custody: ${row.path}`);
      revision = { kind: 'installed',package: { name: pkg.name,version: pkg.version },protocol: custody.installProtocol,
        requiredDigest: sha256(JSON.stringify(rows)) };
      rev = `installed:${revision.requiredDigest}`;
    } else {
      rev = runtimeShaOf(root);
      if (!rev) throw refuse('runtime Git revision unavailable');
      revision = { kind: 'git',sha: rev };
    }
    if (clean && !installed) {
      const checked = status(['--porcelain=v1', '-z', '--untracked-files=all', '--', ...KERNEL_CONTRACT_FILES, ...[...files].sort()], { dir: root, timeout: 30_000 });
      if (checked?.error || checked?.signal || checked?.status !== 0) throw refuse('required read status unavailable');
      if (String(checked.stdout ?? '').length) throw refuse('required deployed read inputs differ from HEAD');
    }
    const manifest = { schema: KERNEL_READ_SCHEMA, workflowId, rev, revision, incarnation: authority.digest, ops: requiredOps, files: rows };
    return { ...manifest, digest: sha256(JSON.stringify(manifest)) };
  } catch (error) { if (error.code === 'kernel-read-unverified') throw error; throw refuse(`required read unavailable: ${String(error?.message ?? error)}`); }
}

/** A complete explicit attestation equals the current server-derived plan, including its exact hash rows. */
export function verifyKernelRead(submitted, required) {
  if (!submitted || submitted.schema !== required.schema || submitted.workflowId !== required.workflowId
    || submitted.rev !== required.rev || JSON.stringify(submitted.revision) !== JSON.stringify(required.revision) || submitted.incarnation !== required.incarnation || submitted.digest !== required.digest
    || JSON.stringify(submitted.ops) !== JSON.stringify(required.ops) || !Array.isArray(submitted.files)
    || submitted.files.length !== required.files.length || !required.files.every((row,index) => sameRow(row,submitted.files[index])))
    throw refuse('READ attestation does not match the complete current required manifest');
  return required;
}

/** New-leg READ admission; legacy/boot receipts never acquire a current incarnation by assertion. */
export function requireKernelRead(db, workflowId, { root, authority, op, status } = {}) {
  const required = kernelReadManifest(db, workflowId, { root, authority, ops: op ? [op] : [], status });
  const row = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='runtime-rev-acked' ORDER BY seq DESC LIMIT 1").get(workflowId);
  const ack = parseJson(row?.payload_json)?.readManifest;
  const { digest, ...body } = ack ?? {};
  if (ack?.schema !== KERNEL_READ_SCHEMA || ack.workflowId !== workflowId || ack.incarnation !== required.incarnation
    || !Array.isArray(ack.files) || !Array.isArray(ack.ops) || !ack.revision || digest !== sha256(JSON.stringify(body))
    || !required.ops.every(op => ack.ops.includes(op)) || !required.files.every(file => ack.files.some(read => sameRow(file,read)))) throw refuse('current Kernel has no complete READ attestation for this new leg');
  return required;
}
