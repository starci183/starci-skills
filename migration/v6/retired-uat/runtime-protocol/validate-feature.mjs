import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorFor } from '../operators/validation.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const validateJson = validatorFor(new URL('./feature.schema.json', import.meta.url));
const requiredHeadings = [
  '## 1. Feature identity and outcome',
  '## 2. Minimal-sufficient flow inventory',
  '## 3. Shared fixtures, resources, and sequential order',
  '## 4. Feature coverage rollup',
  '## 5. Root-cause, feedback, and SUSPENSE rollup',
  '## 6. Feature acceptance'
];

export function validateFeatureMarkdown(source) {
  const errors = [];
  for (const heading of requiredHeadings) if (!source.includes(heading)) errors.push(`missing heading: ${heading}`);
  if (!source.includes('schema_version: 2')) errors.push('frontmatter must declare schema_version: 2');
  if (!source.includes('four-dimension identity rule')) errors.push('feature index must bind minimal-sufficient flow identity');
  if (!source.includes('Uncovered transitions | 0')) errors.push('feature index must expose zero-uncovered acceptance');
  if (!source.includes('USER APPROVE UAT')) errors.push('feature index must expose the user approval command');
  return errors;
}

function featurePathIdentity(indexPath) {
  const normalized = path.resolve(indexPath).replaceAll('\\', '/');
  const match = normalized.match(/(?:^|\/)\.worktrees\/uat\/reviews\/([a-z0-9][a-z0-9._-]*)\/INDEX\.md$/);
  return match ? { feature: match[1] } : null;
}

export function validateFeatureJson(parsed) {
  const errors = [...validateJson(parsed).errors];
  const ids = parsed.flows?.map((flow) => flow.id) ?? [];
  if (new Set(ids).size !== ids.length) errors.push('$.flows: flow ids must be unique');
  for (const [index, flow] of (parsed.flows ?? []).entries()) {
    if (flow.selectedCaseCount !== flow.unhappyCaseCount + 1) errors.push(`$.flows[${index}]: selectedCaseCount must equal one happy plus unhappyCaseCount`);
    const expected = `.worktrees/uat/reviews/${parsed.feature}/${flow.id}/review.md`;
    if (flow.reviewRef !== expected) errors.push(`$.flows[${index}].reviewRef: expected ${expected}`);
  }
  return errors;
}

export function validateFeaturePair(indexPath) {
  const markdown = fs.readFileSync(indexPath, 'utf8');
  const jsonPath = path.join(path.dirname(indexPath), 'feature.json');
  const errors = validateFeatureMarkdown(markdown);
  const identity = featurePathIdentity(indexPath);
  if (!identity) errors.push('feature index must live under the verified backend Source .worktrees/uat/reviews/<feature>/INDEX.md');
  if (!fs.existsSync(jsonPath)) return [...errors, `missing machine feature index: ${jsonPath}`];
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (identity && parsed.feature !== identity.feature) errors.push(`feature.json $.feature: expected ${identity.feature}`);
  return [...errors, ...validateFeatureJson(parsed).map((error) => `feature.json ${error}`)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node uat/validate-feature.mjs <backend-source/.worktrees/uat/reviews/<feature>/INDEX.md>');
    process.exitCode = 2;
  } else {
    const errors = validateFeaturePair(path.resolve(target));
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else console.log('UAT feature index is valid');
  }
}

export const featureTemplatePath = path.join(root, 'feature-index.template.md');
