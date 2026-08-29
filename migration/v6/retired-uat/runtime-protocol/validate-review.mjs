import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatorFor } from '../operators/validation.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const validateJson = validatorFor(new URL('./review.schema.json', import.meta.url));
const requiredHeadings = [
  '## 1. Review identity',
  '## 2. Flow graph and coverage',
  '## 3. Happy and unhappy case matrix',
  '## 4. Resource and fixture plan',
  '## 5. Case execution results',
  '## 6. Screenshot checkpoints',
  '## 7. Findings and root-cause index',
  '## 8. User feedback',
  '## 9. SUSPENSE register',
  '## 10. REQUIRE_USER_ACTION register',
  '## 11. Retest and final acceptance'
];

export function validateReviewMarkdown(source) {
  const errors = [];
  for (const heading of requiredHeadings) if (!source.includes(heading)) errors.push(`missing heading: ${heading}`);
  if (!source.includes('schema_version: 2')) errors.push('frontmatter must declare schema_version: 2');
  if (!source.includes('Flow identity:')) errors.push('review must declare the four flow-identity dimensions');
  if (!source.includes('1–5 representative cases')) errors.push('review must bind the minimal-sufficient case target');
  if (!source.includes('The happy case is separate.')) errors.push('review must preserve a separate canonical happy case');
  if (!source.includes('product-level decision branch')) errors.push('review must bind UAT cases to product-level decision branches');
  if (!source.includes('one case at a time')) errors.push('review must bind visible Browser execution to one case at a time');
  if (!source.includes('full viewport')) errors.push('review must bind full-viewport checkpoint evidence');
  if (!source.includes('constraint preflight → prepare → product execute → read-only verify → scoped cleanup')) errors.push('review must bind the non-manufacturing fixture lifecycle');
  if (!source.includes('USER APPROVE UAT')) errors.push('review must expose the user feedback command');
  if (!source.includes('USER ACTION COMPLETE')) errors.push('review must expose the user-action resume command');
  return errors;
}

export function validateReviewJson(parsed) {
  const errors = [...validateJson(parsed).errors];
  if (parsed.coverage?.selectedCaseCount !== parsed.cases?.length) errors.push('$.coverage.selectedCaseCount: must equal cases length');
  if ((parsed.coverage?.delegatedPermutationCount ?? 0) > 0 && !(parsed.coverage?.delegationRefs?.length)) errors.push('$.coverage.delegationRefs: delegated permutations require exact proof refs');
  if ((parsed.cases?.length ?? 0) > 5 && (parsed.coverage?.overflowReasons?.length ?? 0) < parsed.cases.length - 5) errors.push('$.coverage.overflowReasons: every case beyond five requires a distinct signature or high-risk transition');
  const freshAccounts = (parsed.resources ?? []).filter((resource) => resource.accountProvisioning === 'fresh').map((resource) => resource.account);
  const browserSessions = (parsed.resources ?? []).map((resource) => resource.browserSessionRef);
  const executionOrder = (parsed.resources ?? []).map((resource) => resource.executionOrder);
  if (new Set(freshAccounts).size !== freshAccounts.length) errors.push('$.resources: every case-run must use a unique fresh account');
  if (new Set(browserSessions).size !== browserSessions.length) errors.push('$.resources: every case-run must use a distinct browser session lease');
  if (new Set(executionOrder).size !== executionOrder.length || [...executionOrder].sort((a, b) => a - b).some((item, index) => item !== index + 1)) errors.push('$.resources: executionOrder must be unique and contiguous from 1');
  for (const [index, resource] of (parsed.resources ?? []).entries()) {
    if (resource.accountProvisioning === 'fresh' && resource.account === 'none') errors.push(`$.resources[${index}].account: fresh provisioning requires a new account`);
    if (resource.accountProvisioning === 'none' && resource.account !== 'none') errors.push(`$.resources[${index}].account: anonymous entry must use none`);
    if (!resource.declaredBeforeExecute) errors.push(`$.resources[${index}].declaredBeforeExecute: case identity must be published before execute`);
    if (resource.artifactDirectory !== `runs/${resource.runId}/`) errors.push(`$.resources[${index}].artifactDirectory: must match runId`);
    if (resource.cleanupSelector?.caseId !== resource.caseId || resource.cleanupSelector?.runId !== resource.runId) errors.push(`$.resources[${index}].cleanupSelector: must bind exact caseId and runId`);
  }
  return errors;
}

export function validateReviewPair(markdownPath) {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const jsonPath = path.join(path.dirname(markdownPath), 'review.json');
  const errors = validateReviewMarkdown(markdown);
  const normalized = path.resolve(markdownPath).replaceAll('\\', '/');
  const identity = normalized.match(/(?:^|\/)\.worktrees\/uat\/reviews\/([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)\/review\.md$/);
  if (!identity) errors.push('review must live under the verified backend Source .worktrees/uat/reviews/<feature>/<flow>/review.md');
  if (!fs.existsSync(jsonPath)) return [...errors, `missing machine review: ${jsonPath}`];
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (identity && parsed.feature !== identity[1]) errors.push(`review.json $.feature: expected ${identity[1]}`);
  if (identity && parsed.flow !== identity[2]) errors.push(`review.json $.flow: expected ${identity[2]}`);
  return [...errors, ...validateReviewJson(parsed).map((error) => `review.json ${error}`)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node uat/validate-review.mjs <backend-source/.worktrees/uat/reviews/<feature>/<flow>/review.md>');
    process.exitCode = 2;
  } else {
    const errors = validateReviewPair(path.resolve(target));
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else console.log('UAT review is valid');
  }
}

export const templatePath = path.join(root, 'review.template.md');
