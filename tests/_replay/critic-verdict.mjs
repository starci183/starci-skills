// critic-verdict.mjs - the verdict document the stubbed Critic launch returns for the product bytes of a replay tree (used by tests/_replay/driver.mjs only).
// The digests are computed from the tree exactly as the runtime computes them (productDigests), so the settle gate judges the document as a real verdict.
import path from 'node:path';
import { productDigests, kindEntryOf, criticRubrics } from '../../scripts/work/decision-critic-product.mjs';

/** The verdict of `config` ({tree, op, within, maker, critic, beauty}) over the product under the tree's `.starciwork`. */
export function criticVerdictFor(config) {
  const rubrics = criticRubrics();
  const entry = kindEntryOf(config.op, rubrics);
  const digests = productDigests({ workRoot: path.join(config.tree, '.starciwork'), entry, inputs: rubrics.inputs, within: config.within ?? null });
  const beauty = config.beauty ?? 9;
  const pass = beauty >= entry.minimum;
  return { schema: 'starci/critic-verdict@1', op: config.op, kind: config.op, at: new Date().toISOString(), maker: config.maker ?? 'claude', critic: { provider: config.critic ?? 'codex' },
    rubric: { source: `modules/kernel/critic-rubrics.yaml id=${entry.id}`, checks: entry.checks.length }, beauty, minimum: entry.minimum, pass, product: digests.product, inputs: digests.inputs, unhanded: [],
    checks: entry.checks.map((check) => ({ id: check.id, pass, evidence: 'read', fix: pass ? null : 'fix it' })), summary: 'judged' };
}
