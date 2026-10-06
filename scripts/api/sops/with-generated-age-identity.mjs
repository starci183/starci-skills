// with-generated-age-identity.mjs — run `age-keygen` once for the host's initial identity and hand the generated identity to `consume` (the init install, scripts/install/initial-age.mjs).
import { withGeneratedAgeIdentity as withIdentity } from './lib.mjs';

/** The runner's result: {ok, ...} or a typed failure naming the tool profile. `options`: env, cwd, invocation, assertLease, consume (see lib.mjs). */
export function withGeneratedAgeIdentity(options = {}) {
  return withIdentity(options);
}
