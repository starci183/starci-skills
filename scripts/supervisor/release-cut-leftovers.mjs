// release-cut-leftovers.mjs - what an earlier cut, build or crash left in the checkout that would turn the suite red: authored-looking JSON outside modules/kernel/allowlist.yaml (the inventory of the docs gate, rule
// check-json-exceptions, which every workflow-checkpoint and settle spec runs against the runtime root). It is git-ignored files that make it silent: `git status` is clean while the suite fails 30 minutes in.
// The cut reads the same inventory before it takes the host lock and refuses in seconds, naming each file and the fix. Seam (deps): jsonExceptions (the check, default checkJsonExceptions).
import { checkJsonExceptions } from '../checks/check-json-exceptions.mjs';

/** {verdict, why, findings} when the checkout `repo` holds a leftover the docs gate would refuse, else null. */
export function leftoversRefusal({ repo, deps = {} }) {
  const inventory = (deps.jsonExceptions ?? checkJsonExceptions)({ root: repo });
  const offenders = inventory.offenders.map((file) => ({ what: `${file} is JSON outside modules/kernel/allowlist.yaml (the docs gate check-json-exceptions refuses it in every workflow spec)`, fix: `delete ${file} if an interrupted cut or a build left it, else register it in the allowlist` }));
  const missing = inventory.missingAllowlist.map((file) => ({ what: `${file} is registered in modules/kernel/allowlist.yaml but absent on disk`, fix: `restore ${file} or remove its allowlist entry` }));
  const findings = [...offenders, ...missing];
  if (!findings.length) return null;
  const described = findings.map((f) => `${f.what} (${f.fix})`);
  return { verdict: 'tree-leftovers', why: `the checkout holds leftovers that turn the suite red: ${described.join('; ')}`, findings };
}
