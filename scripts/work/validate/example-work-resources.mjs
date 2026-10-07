// The cross-record rules of the example Work standard (check-example-work.mjs) that run after the per-record
// rules: a done frontend implementation proves its running page, a uat-flow's environment, fixtures and accounts
// resolve to resources of the matching kind.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { renderProofProblems } from '../render-proof.mjs';

// A done frontend implementation proves its running page through the existing
// render/brand owner: capture PNG, markup, palette, anatomy and mascot rules.
// It uses the same frontend predicate as IMPL_BEFORE_DIRECTION. Missing or
// uncheckable selected capture bytes refuse; a core-check skip is not a pass.
export function checkRenderProofs({ problems, records, workspaceDoc, workRoot, blobOptions }) {
  for (const rec of records.values()) {
    if (rec.schema !== 'work/implementation@1' || rec.data?.state !== 'done') continue;
    for (const problem of renderProofProblems({rec, records, workspaceDoc, workRoot, blobOptions}))
      problems.push(`${rec.shown}: ${problem}`);
  }
}

/** The refusal when `id` does not resolve to a work/resource@1 of `kind`, else null. */
function resourceKindProblem(recOf, rec, { label, id, kind }) {
  if (recOf(id)?.schema !== 'work/resource@1') return `${rec.shown}: ${label} ${id} does not resolve to a work/resource@1`;
  const actual = recOf(id)?.data?.kind;
  if (actual !== kind) return `${rec.shown}: ${label} ${id} resolves to a work/resource@1 of kind "${actual}", not ${kind}`;
  return null;
}

function checkAccountIdentity({ problems, recOf }, rec, account) {
  const wrong = resourceKindProblem(recOf, rec, { label: 'accounts.yaml identity', id: account.identity, kind: 'identity' });
  if (wrong) { problems.push(wrong); return; }
  const target = recOf(account.identity);
  if (Array.isArray(target.data?.roles) && typeof account.role === 'string' && !target.data.roles.includes(account.role)) problems.push(`${rec.shown}: accounts.yaml selects role ${account.role} of ${account.identity}, which presents only [${target.data.roles.join(', ')}]; a flow chooses an identity by a role it presents [HFS_IDENTITY_CUSTODY]`);
}

function checkFlowAccounts(ctx, rec) {
  const accountsFile = path.join(rec.dir, rec.data.accounts);
  if (!fs.existsSync(accountsFile)) return;
  const accountsDoc = parseYaml(fs.readFileSync(accountsFile, 'utf8'));
  for (const account of accountsDoc?.accounts ?? []) {
    if (account?.identity) checkAccountIdentity(ctx, rec, account);
  }
}

// ---- concept 13 (continued): uat-flow environment/fixtures/accounts refs resolve to a real _resources entry ----
export function checkUatFlowResources(ctx) {
  for (const rec of ctx.records.values()) {
    if (rec.schema === 'work/uat-flow@1') checkFlowResourceRefs(ctx, rec);
  }
}

function checkFlowResourceRefs(ctx, rec) {
  const { problems, recOf } = ctx;
  const data = rec.data;
  if (data.environment) {
    const wrong = resourceKindProblem(recOf, rec, { label: 'environment', id: data.environment, kind: 'environment' });
    if (wrong) problems.push(wrong);
  }
  if (Array.isArray(data.fixtures)) {
    for (const fid of data.fixtures) {
      const wrong = resourceKindProblem(recOf, rec, { label: 'fixture', id: fid, kind: 'fixture' });
      if (wrong) problems.push(wrong);
    }
  }
  if (typeof data.accounts === 'string') checkFlowAccounts(ctx, rec);
}
