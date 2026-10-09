// critic-verdict.mjs — the Critic's one typed answer (starci/critic-verdict@1) and the refusals that keep it honest. The verdict
// carries the digest of every product byte the Critic was handed; the settle gate accepts it only for the product it names, and
// the runtime refuses a verdict from a Critic that returned none, touched what it was handed, or judged other bytes.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { oneLine } from '../lib/clip.mjs';
import { criticContract } from './critic-contract.mjs';

const SCHEMA = 'starci/critic-verdict@1';
const sha256File = (file) => sha256(fs.readFileSync(file));

/** The digests of the files handed to the Critic: [{label, file, role, sha256}] with `file` relative to `dir` and role product or rubric. */
export function handedDigests(dir, files) {
  return files.map(({ file, label = file, role }) => ({ label, file, role, sha256: sha256File(path.join(dir, file)) }));
}

/** The typed verdict: the normalised scores of the Critic, the declared minimum, pass or fail against it and the product digests judged. */
export function typedVerdict({ normalised, handed, rubric, minimum, critic }) {
  const score = normalised.beauty;
  return { schema: SCHEMA, ...normalised, minimum, pass: Number.isFinite(score) && Number.isFinite(minimum) && score >= minimum,
    product: handed.filter((entry) => entry.role === 'product').map(({ label, sha256: digest }) => ({ label, sha256: digest })),
    ...(handed.some((entry) => entry.role === 'input') ? { inputs: handed.filter((entry) => entry.role === 'input').map(({ label, sha256: digest }) => ({ label, sha256: digest })) } : {}),
    rubric: { source: rubric?.source ?? null, checks: (rubric?.checks ?? []).length }, critic: { provider: critic.provider, model: critic.model, tier: critic.tier ?? null } };
}

/**
 * The bytes the Critic changed in its directory after it was handed `handed`, or []: a handed file with another digest or
 * missing, and a file beside them that is neither handed nor the verdict file.
 */
export function touchedByCritic({ dir, handed, verdictFile }) {
  const changed = handed.filter((entry) => {
    const at = path.join(dir, entry.file);
    return !fs.existsSync(at) || sha256File(at) !== entry.sha256;
  }).map((entry) => `${entry.file} changed or removed`);
  const known = new Set([...handed.map((entry) => entry.file), verdictFile, '.git', '.claude', '.devin']);
  const extra = fs.readdirSync(dir).filter((name) => !known.has(name)).map((name) => `${name} created`);
  return [...changed, ...extra];
}

/** null when `judged` (the digests a verdict names) holds every digest of `current` (the product the attempt holds), else the stale refusal. */
export function staleRefusal(judged, current) {
  const { codes } = criticContract();
  if (!judged?.length) return { code: codes.verdictStale, detail: 'the verdict names no product digest' };
  const missing = current.filter((digest) => !judged.includes(digest));
  return missing.length ? { code: codes.verdictStale, detail: `the verdict judged other bytes than the attempt's product (${missing.length} digest(s) not judged)` } : null;
}

/** What a round records about its critique: the provider and model, whether it was independent, the typed code of a refusal and the digests judged. */
export function roundCritic(critique) {
  return { provider: critique?.critic?.provider ?? null, model: critique?.critic?.model ?? null, independent: critique?.critic?.independent ?? false, error: critique?.error ?? null, code: critique?.code ?? null,
    judged: (critique?.verdict?.product ?? []).map((entry) => entry.sha256) };
}

/** The typed code of a critique outcome that has no verdict, or null: the happy errors and the bug each have their own. */
export function codeOfOutcome(outcome) {
  const { codes } = criticContract();
  const byOutcome = { 'verdict-missing': codes.noVerdict, 'product-modified': codes.productModified, unguarded: codes.unguarded, quota: codes.quotaOut };
  if (outcome in byOutcome) return byOutcome[outcome];
  return ['launch-failed', 'timeout', 'refused'].includes(outcome) ? codes.unavailable : null;
}

/** One line per failed check of a verdict: `<id>: <evidence> - fix: <fix>`. */
export function failedCheckLines(checks) {
  return (checks ?? []).filter((c) => !c.pass).map((c) => {
    const fix = c.fix ? ` - fix: ${oneLine(c.fix, 240)}` : '';
    return `${c.id}: ${oneLine(c.evidence ?? '', 200)}${fix}`;
  });
}
