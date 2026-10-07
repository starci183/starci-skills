import path from 'node:path';
import { HOLE, tokenizeSql } from './sql-tokens.mjs';
import { machineKit } from './machine-ast.mjs';

/**
 * R181 `sql-returning` (BE_SQL_RETURNING_SHAPE). TypeORM's `EntityManager.query` returns an UPDATE or DELETE with RETURNING as
 * `[rows, affectedCount]`, not as rows (an INSERT ... RETURNING returns rows), so a caller that reads the result as rows silently reads
 * the wrong thing and no unit spec that stubs the SQL can see it. Every `sql` tagged template (the tag declared in platform/database) of a
 * `<name>.sql.ts` file in a capability's `persistence/` is read with the tokenizer of sql-tokens.mjs, split into statements at top-level
 * semicolons, and a statement that STARTS with UPDATE or DELETE and carries RETURNING at the top level is refused: write it as
 * `WITH changed AS (UPDATE ... RETURNING ...) SELECT ... FROM changed`, which returns rows. A RETURNING inside a parenthesised CTE is the
 * wrapped form and passes; so does INSERT ... RETURNING and any statement without RETURNING.
 */
export const SQL_RETURNING_RULE_IDS = ['BE_SQL_RETURNING_SHAPE'];

const RULE = 'BE_SQL_RETURNING_SHAPE';

/** Ends the statement in progress, recording its leading verb when it carried RETURNING. */
function closeStatement(state) {
  if (state.verb && state.returning) state.found.push(state.verb);
  state.verb = null;
  state.returning = false;
}

/** Folds one token into the statement state: parenthesis depth, statement ends and the top-level words. */
function readToken(state, token) {
  if (token.t === 'punct') {
    if (token.v === '(') state.depth += 1;
    else if (token.v === ')') state.depth = Math.max(0, state.depth - 1);
    else if (token.v === ';' && state.depth === 0) closeStatement(state);
    return;
  }
  if (state.depth !== 0 || token.t !== 'word') return;
  if (state.verb === null) state.verb = token.up;
  else if (token.up === 'RETURNING') state.returning = true;
}

/** The leading verbs of the top-level statements of `text` that RETURN from an UPDATE or DELETE without a wrapping SELECT. */
function unwrappedReturning(text) {
  const state = { found: [], depth: 0, verb: null, returning: false };
  for (const token of tokenizeSql(text)) readToken(state, token);
  closeStatement(state);
  return state.found.filter(verb => verb === 'UPDATE' || verb === 'DELETE');
}

/** The SQL text of a tagged template, each substitution replaced by a HOLE marker. */
function templateText(ts, template) {
  return ts.isNoSubstitutionTemplateLiteral(template) ? template.text
    : template.head.text + template.templateSpans.map(span => HOLE + span.literal.text).join('');
}

const isDatabaseTag = (kit, checker, node) => {
  const home = kit.declarationsOf(checker, node.tag).map(kit.ownerOfDeclaration).find(Boolean);
  return home?.tier === 'platform' && home?.name === 'database';
};

const returningViolation = (kit, file, node, verb) => ({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message: `${verb} ... RETURNING in ${file.rel} is returned by EntityManager.query as [rows, affectedCount], not as rows, so a caller reading rows reads the wrong value. Wrap it: WITH changed AS (${verb} ... RETURNING ...) SELECT ... FROM changed.`, verb });

export function checkSqlReturning(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let templates = 0;
  for (const file of graph.files.values()) {
    if (file.slot !== 'be.persistence' || !path.posix.basename(file.rel).endsWith('.sql.ts') || !file.owner) continue;
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!ts.isTaggedTemplateExpression(node) || !isDatabaseTag(kit, checker, node)) return;
      templates += 1;
      for (const verb of unwrappedReturning(templateText(ts, node.template))) violations.push(returningViolation(kit, file, node, verb));
    });
  }
  return { violations, coverage: { status: 'checked', templates } };
}
