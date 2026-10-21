// staged-specs.mjs - BE_UNIT_SPEC_NOT_STAGED (R47): the commit that adds a back-end logic file adds its unit spec beside it. A new
// file `be/<path>/<name>.<role>.ts` that the coverage scope measures (scripts/hfs/coverage-scope.mjs isMeasured: a role of
// ruleParams.be.logicRoles below a measured root, outside its none folders) and that holds executable logic (a function, a method, a
// constructor, an accessor) needs `<name>.<role>.spec.ts` in the same index. A measured file with nothing to execute (constants and
// types only, such as an error-kind to HTTP-status table) has nothing a spec could call, and the spec rules refuse a spec of it
// (spec-infra-double-from-kit); the coverage gate still reaches it through its callers. `starci app hygiene` judges the files the
// index adds (packages/hfs/sync/hygiene.mjs, run by the managed pre-commit hook), so a coding agent cannot commit the code first and
// its spec afterwards. A file that already exists is the coverage gate's.
import { isMeasured } from '../coverage-scope.mjs';

const SPEC_NOT_STAGED = 'BE_UNIT_SPEC_NOT_STAGED';
const BE = 'be/';

/** The unit spec beside an app-relative `<name>.<role>.ts`: `<name>.<role>.spec.ts`. */
const siblingSpec = (file) => file.replace(/\.ts$/u, '.spec.ts');

/** The syntax kinds that execute: a body a spec can call. */
const EXECUTABLE_KINDS = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'MethodDeclaration', 'Constructor', 'GetAccessor', 'SetAccessor'];

/**
 * Whether TypeScript `text` holds executable logic. Without a TypeScript parser (`ts` null) or without the text, the file counts as
 * logic: the gate never relaxes on what it cannot read.
 */
function holdsLogic(ts, text) {
  if (!ts || typeof text !== 'string') return true;
  const kinds = new Set(EXECUTABLE_KINDS.map((name) => ts.SyntaxKind[name]));
  const source = ts.createSourceFile('subject.ts', text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const visit = (node) => kinds.has(node.kind) || ts.forEachChild(node, visit) === true;
  return ts.forEachChild(source, visit) === true;
}

/**
 * The findings `{ file, code, message }` of the app-relative files the index adds (`added`) whose sibling spec is not among the
 * paths the index holds (`indexed`, a Set). `manifest` is the slot manifest the coverage scope reads; `staged(file)` answers the
 * staged text of a file and `ts` the TypeScript parser, which tell a logic file from a constants-only one.
 */
export function stagedSpecFindings(manifest, added, indexed, { ts = null, staged = () => null } = {}) {
  return added
    .filter((file) => file.startsWith(BE) && !file.endsWith('.spec.ts') && isMeasured(manifest, file.slice(BE.length)) && !indexed.has(siblingSpec(file)))
    .filter((file) => holdsLogic(ts, staged(file)))
    .map((file) => ({
      file,
      code: SPEC_NOT_STAGED,
      message: `is a new back-end logic file the unit coverage measures at 100 per file, staged without ${siblingSpec(file).slice(file.lastIndexOf('/') + 1)} beside it; write the spec in the same change (starci gate read, code and spec, starci gate run --tests) and stage both`,
    }));
}
