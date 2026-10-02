import path from 'node:path';
import { HOLE, tokenizeSql } from './sql-tokens.mjs';
import { machineKit } from './machine-ast.mjs';

/**
 * R136 `sql-returning` (BE_SQL_RETURNING_SHAPE). TypeORM's `EntityManager.query` returns an UPDATE or DELETE with RETURNING as
 * `[rows, affectedCount]`, not as rows (an INSERT ... RETURNING returns rows), so a caller that reads the result as rows silently reads
 * the wrong thing and no unit spec that stubs the SQL can see it. Every `sql` tagged template (the tag declared in platform/database) of a
 * `<name>.sql.ts` file in a capability's `persistence/` is read with the tokenizer of sql-tokens.mjs, split into statements at top-level
 * semicolons, and a statement that STARTS with UPDATE or DELETE and carries RETURNING at the top level is refused: write it as
 * `WITH changed AS (UPDATE ... RETURNING ...) SELECT ... FROM changed`, which returns rows. A RETURNING inside a parenthesised CTE is the
 * wrapped form and passes; so does INSERT ... RETURNING and any statement without RETURNING.
 */
export const SQL_RETURNING_RULE_IDS = ['BE_SQL_RETURNING_SHAPE'];

const RULE = 'BE_SQL_RETURNING_SHAPE';

/** The leading verbs of the top-level statements of `text` that RETURN from an UPDATE or DELETE without a wrapping SELECT. */
export function unwrappedReturning(text) {
  const found = [];
  let depth = 0;
  let verb = null;
  let returning = false;
  const close = () => { if (verb && returning) found.push(verb); verb = null; returning = false; };
  for (const token of tokenizeSql(text)) {
    if (token.t === 'punct') {
      if (token.v === '(') depth += 1;
      else if (token.v === ')') depth = Math.max(0, depth - 1);
      else if (token.v === ';' && depth === 0) close();
      continue;
    }
    if (depth !== 0 || token.t !== 'word') continue;
    if (verb === null) verb = token.up;
    else if (token.up === 'RETURNING') returning = true;
  }
  close();
  return found.filter(verb => verb === 'UPDATE' || verb === 'DELETE');
}

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
      if (!ts.isTaggedTemplateExpression(node)) return true;
      const home = kit.declarationsOf(checker, node.tag).map(kit.ownerOfDeclaration).find(Boolean);
      if (!home || home.tier !== 'platform' || home.name !== 'database') return true;
      templates += 1;
      const template = node.template;
      const text = ts.isNoSubstitutionTemplateLiteral(template) ? template.text
        : template.head.text + template.templateSpans.map(span => HOLE + span.literal.text).join('');
      for (const verb of unwrappedReturning(text)) {
        violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node), message: `${verb} ... RETURNING in ${file.rel} is returned by EntityManager.query as [rows, affectedCount], not as rows, so a caller reading rows reads the wrong value. Wrap it: WITH changed AS (${verb} ... RETURNING ...) SELECT ... FROM changed.`, verb });
      }
      return true;
    });
  }
  return { violations, coverage: { status: 'checked', templates } };
}
