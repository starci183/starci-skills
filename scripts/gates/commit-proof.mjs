// commit-proof.mjs — locations and file IO for a commit's verification and release evidence. Each producer owns its schema.
import fs from 'node:fs';
import path from 'node:path';
import { runtimeStateDir, starciLocalRoot } from '../../engine/runtime-root.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { sameResolvedPath } from '../lib/path-key.mjs';
import { writeJsonFile } from '../api/fs/write-json-file.mjs';

const RELEASE_KINDS = Object.freeze({ l4: 'l4', affected: 'affected', rows: 'l4-rows', ci: 'ci', report: 'affected-report' });
const SHORT = 12;
/** The local git note namespace used to write and read land proof. */
export const LAND_NOTE_REF = 'land';

/** The directory shared by release proofs of every worktree of a repository. */
export const proofDirOf = (commonDir) => path.join(commonDir, 'starci-release');

/** The location of an affected, verify, deploy/check or release receipt; existing references keep their established paths. */
export function proofFileOf({ kind, sha, base, root, env, commonDir }) {
  if (kind === 'verify') return path.join(runtimeStateDir(root), 'verify', `${sha}.json`);
  if (kind === 'affected-receipt') return path.join(runtimeStateDir(root), 'affected', `${String(base).slice(0, SHORT)}-${String(sha).slice(0, SHORT)}.json`);
  if (kind === 'deploy') return path.join(starciLocalRoot(env), 'deploy', 'receipts', `${sha}.json`);
  if (!Object.hasOwn(RELEASE_KINDS, kind)) throw new Error(`unknown commit proof kind: ${kind}`);
  return path.join(proofDirOf(commonDir), `${sha}.${RELEASE_KINDS[kind]}.json`);
}

/** Every release proof of one kind under the git common directory, or [] when the directory is absent. */
export function proofFilesOf({ commonDir, kind }) {
  if (!Object.hasOwn(RELEASE_KINDS, kind)) throw new Error(`unknown release proof kind: ${kind}`);
  const folder = proofDirOf(commonDir);
  const suffix = `.${RELEASE_KINDS[kind]}.json`;
  return fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith(suffix)).map((name) => path.join(folder, name)) : [];
}

/** Writes one receipt atomically; a reader sees a complete JSON document. Returns its file. */
export function writeProofFile(file, record) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeJsonFile(tmp, record);
  fs.renameSync(tmp, file);
  return file;
}

/** A proof file's parsed document, or null when it is missing, unreadable or malformed; its producer validates the schema. */
export const readProofFile = (file) => readJsonFile(file, null);

/** The digest of the schema's ordered binding fields. */
export const proofDigest = (fields) => sha256(fields.join('\n'));

/** Whether a receipt binds the requested commit and tree. */
export const proofBinds = (record, { sha, tree }) => record?.sha === sha && record?.tree === tree;

/** Whether the specs judged this source root; a missing root never supplies proof for another checkout. */
export const judgedIn = (recorded, root) => typeof recorded === 'string' && recorded !== '' && sameResolvedPath(recorded, root);
