import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorFor } from '../operators/validation.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const validate = validatorFor(new URL('./request.schema.json', import.meta.url), (value) => {
  const errors = [];
  const fingerprints = value.feedbackSessions.map((session) => session.fingerprint);
  if (new Set(fingerprints).size !== fingerprints.length) errors.push('$.feedbackSessions: duplicate session fingerprints are forbidden');
  if (value.targetOwners.includes('local-only') && value.targetOwners.length > 1) errors.push('$.targetOwners: local-only cannot be combined with an upgrade owner');
  for (const [index, session] of value.feedbackSessions.entries()) {
    if (session.targetOwners.includes('local-only') && session.targetOwners.length > 1) errors.push(`$.feedbackSessions[${index}].targetOwners: local-only cannot be combined with an upgrade owner`);
  }
  const reviewedStatus = ['approved', 'resolved', 'rejected'].includes(value.status);
  if (reviewedStatus && value.review === null) errors.push(`$.review: status ${value.status} requires a durable review decision`);
  if (!reviewedStatus && value.review !== null) errors.push(`$.review: status ${value.status} cannot carry a review decision`);
  if (value.review !== null) {
    if (value.review.targetOwners.includes('local-only') && value.review.targetOwners.length > 1) errors.push('$.review.targetOwners: local-only cannot be combined with an upgrade owner');
    for (const owner of value.review.targetOwners) if (!value.targetOwners.includes(owner)) errors.push(`$.review.targetOwners: ${owner} is outside the request owner boundary`);
    if (value.status === 'rejected' && value.review.decision !== 'rejected') errors.push('$.review.decision: rejected status requires rejected decision');
    if (['approved', 'resolved'].includes(value.status) && value.review.decision !== 'approved') errors.push(`$.review.decision: ${value.status} status requires approved decision`);
  }
  return errors;
});

const requestFiles = fs.readdirSync(root)
  .filter((name) => name.endsWith('.request.json'))
  .sort();

for (const name of requestFiles) {
  const value = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const result = validate(value);
  if (!result.valid) throw new Error(`${name}:\n${result.errors.join('\n')}`);
  if (name !== `${value.id}.request.json`) throw new Error(`${name}: filename must equal stable request id`);
}

console.log(`requests valid: ${requestFiles.length} durable feedback ledger(s)`);
