import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorFor } from '../validation.mjs';

const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const snapshotValidator = validatorFor(new URL('../../templates/uat/snapshot.schema.json', import.meta.url));
const resultValidator = validatorFor(new URL('../../templates/uat/result.schema.json', import.meta.url));
const patterns = {
  snapshot: /^\.worktrees\/uat\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/snapshot\.json$/,
  result: /^\.worktrees\/uat\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/result\.json$/,
};

export const uatContentFingerprint = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const expectedUatSnapshotRef = (feature, flow) => `.worktrees/uat/${feature}/${flow}/snapshot.json`;
export const expectedUatResultRef = (snapshotRef) => snapshotRef?.replace(/\/snapshot\.json$/, '/result.json') ?? null;

export function inspectUatArtifact(canonicalRef, kind) {
  const errors = [];
  const match = typeof canonicalRef === 'string' ? canonicalRef.match(patterns[kind]) : null;
  if (!match) return { valid: false, errors: [`canonical ${kind} ref must be the exact backend-owned ${kind}.json path`], document: null, contentFingerprint: null };
  const artifactPath = path.resolve(sourceRoot, ...canonicalRef.split('/'));
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    return { valid: false, errors: [`canonical ${kind} ref must point to an existing file`], document: null, contentFingerprint: null };
  }
  let document;
  try {
    document = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  } catch {
    return { valid: false, errors: [`canonical ${kind} artifact must contain valid JSON`], document: null, contentFingerprint: null };
  }
  const validation = (kind === 'snapshot' ? snapshotValidator : resultValidator)(document);
  if (!validation.valid) errors.push(...validation.errors.map((error) => `canonical ${kind} artifact: ${error}`));
  const [, feature, flow] = match;
  if (document.feature !== feature || document.flow !== flow) errors.push(`canonical ${kind} artifact feature/flow must match its path`);
  return { valid: errors.length === 0, errors, document, contentFingerprint: uatContentFingerprint(document) };
}
