import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const slash = (value) => value.split(path.sep).join('/');

async function filesUnder(branch, folder, files) {
  const absolute = path.join(branch, folder);
  const rootStat = await lstat(absolute);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`EVIDENCE_PATH: ${folder} must be a real directory`);
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const ref = slash(path.join(folder, entry.name));
    if (entry.isSymbolicLink()) throw new Error(`EVIDENCE_PATH: symbolic link ${ref}`);
    if (entry.isDirectory()) await filesUnder(branch, ref, files);
    else if (entry.isFile()) files.push({ ref, sha256: sha(await readFile(path.join(branch, ref))) });
    else throw new Error(`EVIDENCE_PATH: ${ref} is not a regular file`);
  }
}

export async function buildEvidenceManifest(branch) {
  branch = path.resolve(branch);
  const branchStat = await lstat(branch);
  if (branchStat.isSymbolicLink() || !branchStat.isDirectory()) throw new Error('EVIDENCE_PATH: attempt branch must be a real directory');
  const files = [];
  await filesUnder(branch, 'request', files);
  await filesUnder(branch, 'response', files);
  files.sort((left, right) => left.ref.localeCompare(right.ref));
  const response = files.find((item) => item.ref === 'response/response.json');
  if (!files.some((item) => item.ref === 'request/request.json') || !response) throw new Error('EVIDENCE_MISSING: request/request.json and response/response.json are required');
  const version = 1;
  return { version, responseHash: response.sha256, fingerprint: sha(Buffer.from(JSON.stringify({ version, files }))), files };
}

export async function evidenceManifestErrors(branch, expected) {
  if (!expected || expected.version !== 1 || !/^sha256:[0-9a-f]{64}$/.test(expected.responseHash ?? '') || !/^sha256:[0-9a-f]{64}$/.test(expected.fingerprint ?? '') || !Array.isArray(expected.files)) return ['evidenceManifest: missing or malformed accepted proof manifest'];
  let actual;
  try { actual = await buildEvidenceManifest(branch); }
  catch (error) { return [error.message]; }
  const errors = [];
  if (expected.responseHash !== actual.responseHash) errors.push('evidenceManifest.responseHash: response/response.json changed after acceptance');
  if (expected.fingerprint !== actual.fingerprint || JSON.stringify(expected.files) !== JSON.stringify(actual.files)) errors.push('evidenceManifest.fingerprint: request/response evidence inventory changed after acceptance');
  return errors;
}
