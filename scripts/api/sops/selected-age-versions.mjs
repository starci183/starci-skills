// selected-age-versions.mjs — the `age-keygen` versions the generated identity accepts, for a caller that names them in a message.
import { SELECTED_AGE_VERSIONS } from './lib.mjs';

/** The accepted `age-keygen` versions, in declaration order. */
export function selectedAgeVersions() {
  return [...SELECTED_AGE_VERSIONS];
}
