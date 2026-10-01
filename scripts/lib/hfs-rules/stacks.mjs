// stacks.mjs - HFS_STACKS_SHAPE (R10): `.starcistacks` has the standard shape and the host Sonar owner.
//   - every tracked path under the app root's `.starcistacks/` is one the app.starcistacks slot allows (its `allows` list is the shape:
//     application-stacks.yaml and <env>/{README.md, environment.json, infra/{compose,k8s,terraform}, runtime/{config,env},
//     secrets/<slug>.enc, seeds}); a `.enc` outside <env>/secrets/ is never allowed, `runtime/files/`, a root `DESIGN.md`,
//     `deployment.json` and `k8s/` are not in the list, so they fall out of it;
//   - the declaration (read by scripts/lib/stack-declaration.mjs, the one reader of it) states a sonar service, a local
//     Sonar is owned by the host (`stack.owner: host`, root `.claude/ext/sonar`), and no service still points at `.stacks`.
// The declaration's services contract (custody, CI wiring, project keys) stays check-starcistacks's; this file judges shape only.
import { braceVariants, globExpression } from '../glob.mjs';
import { declaredStack, findStackDeclaration, STACK_ROOT, text } from '../stack-declaration.mjs';
import { found } from './read.mjs';

export const STACKS_SHAPE = 'HFS_STACKS_SHAPE';
export const STACKS_SLOT = 'app.starcistacks';
export const HOST_SONAR_ROOT = '.claude/ext/sonar';
const SEALED = /\.enc$/;
const INSIDE_SECRETS = /^[^/]+\/secrets\/[^/]+\.enc$/;
const RETIRED_ROOT = /^\.?stacks(?:\/|$)/;

/** The anchored expressions of a slot's `allows` entries: `<name>` is one path segment, braces alternate. */
const allowedExpressions = (allows) => allows.flatMap((entry) => braceVariants(entry.replace(/<[a-z][a-z0-9-]*>/g, '*'))).map((variant) => globExpression(variant.endsWith('/') ? `${variant}**` : variant));

const shapeFinding = (file, message, extra) => found(STACKS_SHAPE, file, message, extra);

/** The shape findings of the `.starcistacks` tree at the app root (`repoRoot` is the app root, `files` its own tracked paths). */
export function stacksFindings({ repoRoot, files, resolver }) {
  const slot = resolver.slot(STACKS_SLOT);
  if (!slot) return [];
  const findings = [];
  const allowed = allowedExpressions(slot.allows ?? []);
  const prefix = `${STACK_ROOT}/`;
  for (const file of files.filter((f) => f.startsWith(prefix))) {
    const rel = file.slice(prefix.length);
    if (SEALED.test(rel) && !INSIDE_SECRETS.test(rel)) findings.push(shapeFinding(file, `${file} is a sealed secret outside <env>/secrets/<slug>.enc; move it to .starcistacks/<env>/secrets/`));
    else if (!allowed.some((expression) => expression.test(rel))) findings.push(shapeFinding(file, `${file} is not part of the standard .starcistacks shape (application-stacks.yaml and <env>/{README.md, environment.json, infra, runtime/{config,env}, secrets/<slug>.enc, seeds}); move or delete it`));
  }
  if (!files.some((f) => f === `${prefix}application-stacks.yaml`)) return findings;
  const declaration = findStackDeclaration(repoRoot);
  const declared = `${prefix}application-stacks.yaml`;
  if (declaration.error) return [...findings, shapeFinding(declared, `${declared} cannot be read: ${declaration.error}`)];
  const services = declaration.doc?.services;
  if (services === undefined || typeof services.sonar !== 'object' || services.sonar === null) {
    findings.push(shapeFinding(declared, `${declared} declares no sonar service; every repository states its Sonar owner (a local one is owned by the host: stack.owner host, root ${HOST_SONAR_ROOT})`));
    return findings;
  }
  for (const [id, entry] of Object.entries(services)) {
    const stack = declaredStack(entry);
    if (stack?.root && RETIRED_ROOT.test(stack.root)) findings.push(shapeFinding(declared, `${declared} services.${id}.stack.root ${stack.root} still points at the retired .stacks root; the stack root is ${STACK_ROOT}`));
    if (id === 'sonar' && text(entry?.mode) === 'local' && !(stack?.hostOwned && stack.root === HOST_SONAR_ROOT)) {
      findings.push(shapeFinding(declared, `${declared} services.sonar is a local Sonar but is not owned by the host; declare stack.owner host with root ${HOST_SONAR_ROOT}`));
    }
  }
  return findings;
}
