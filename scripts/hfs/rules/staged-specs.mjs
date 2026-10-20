// staged-specs.mjs - BE_UNIT_SPEC_NOT_STAGED (R47): the commit that adds a back-end logic file adds its unit spec beside it. A new
// file `be/<path>/<name>.<role>.ts` that the coverage scope measures (scripts/hfs/coverage-scope.mjs isMeasured: a role of
// ruleParams.be.logicRoles below a measured root, outside its none folders) needs `<name>.<role>.spec.ts` in the same index.
// `starci app hygiene` judges the files the index adds (packages/hfs/sync/hygiene.mjs, run by the managed pre-commit hook), so a
// coding agent cannot commit the code first and its spec afterwards. A file that already exists is the coverage gate's.
import { isMeasured } from '../coverage-scope.mjs';

const SPEC_NOT_STAGED = 'BE_UNIT_SPEC_NOT_STAGED';
const BE = 'be/';

/** The unit spec beside an app-relative `<name>.<role>.ts`: `<name>.<role>.spec.ts`. */
const siblingSpec = (file) => file.replace(/\.ts$/u, '.spec.ts');

/**
 * The findings `{ file, code, message }` of the app-relative files the index adds (`added`) whose sibling spec is not among the
 * paths the index holds (`indexed`, a Set). `manifest` is the slot manifest the coverage scope reads.
 */
export function stagedSpecFindings(manifest, added, indexed) {
  return added
    .filter((file) => file.startsWith(BE) && !file.endsWith('.spec.ts') && isMeasured(manifest, file.slice(BE.length)) && !indexed.has(siblingSpec(file)))
    .map((file) => ({
      file,
      code: SPEC_NOT_STAGED,
      message: `is a new back-end logic file the unit coverage measures at 100 per file, staged without ${siblingSpec(file).slice(file.lastIndexOf('/') + 1)} beside it; write the spec in the same change (starci gate read, code and spec, starci gate run --tests) and stage both`,
    }));
}
