// secret-tracked.mjs - RT_SECRET_TRACKED (knowledge/hfs/rules.yaml, gate runtime): the runtime repository is public and tracks no secret material, not even ciphertext. A tracked file that is a sealed
// secret (a *.enc member) or a secret environment file (secret.env, .env) fails unless ruleParams.runtime.heldSecrets names it with the reason it is still there; that list only shrinks. Every secret the
// host needs lives in the untracked .claude/secret.env, read through engine/secrets.mjs. Pure: the held list and the tracked files come in through ctx.

export const RT_SECRET_TRACKED = 'RT_SECRET_TRACKED';

const SEALED = /\.enc$/u;
const ENV_FILES = new Set(['secret.env', '.env']);

/** RT_SECRET_TRACKED findings: one per tracked sealed secret or secret env file that ruleParams.runtime.heldSecrets does not name. */
export function secretTrackedFindings(ctx) {
  const held = new Set((ctx.params.heldSecrets ?? []).map((entry) => String(entry.path)));
  const found = [];
  for (const file of ctx.files) {
    const base = file.slice(file.lastIndexOf('/') + 1);
    if ((SEALED.test(base) || ENV_FILES.has(base)) && !held.has(file)) {
      found.push({ code: RT_SECRET_TRACKED, level: 'error', path: file, message: `${file} is a secret tracked in the public runtime repository: the host's secrets live in the untracked .claude/secret.env (secret.env.example lists the names), so remove it from the index (git rm); a ciphertext in git history is only removed by rotating the secret` });
    }
  }
  return found;
}
