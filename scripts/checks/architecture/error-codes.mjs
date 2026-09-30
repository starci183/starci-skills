import path from 'node:path';
import { machineKit, upperSnake } from './machine-ast.mjs';

/**
 * R38 error codes (BE_ERROR_HOME, machine half; the eslint half judges the error classes). The string value of every
 * member of a `<C>ErrorCode` enum in a capability's `errors/<c>.error.ts` is a string literal shaped
 * `<CAPABILITY>_<WHAT>` (UPPER_SNAKE of the owning capability, no `_ERROR` or `_EXCEPTION` suffix) and unique across the
 * whole repository, so a code names one refusal and one capability for the client and the log.
 */
export const ERROR_CODE_RULE_IDS = ['BE_ERROR_HOME'];

const RULE = 'BE_ERROR_HOME';

export function checkErrorCodes(input) {
  const { graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  const seen = new Map();
  let enums = 0;
  let codes = 0;
  const files = [...graph.files.values()].filter(file => file.slot === 'be.errors' && file.owner && path.posix.basename(file.rel).endsWith('.error.ts'))
    .sort((a, b) => a.rel.localeCompare(b.rel));
  for (const file of files) {
    const checker = kit.checkerOf(file.sourceFile);
    const capability = upperSnake(path.posix.basename(file.owner.root));
    const shape = new RegExp(`^${capability}_[A-Z0-9]+(?:_[A-Z0-9]+)*$`, 'u');
    for (const statement of file.sourceFile.statements) {
      if (!ts.isEnumDeclaration(statement) || !statement.name.text.endsWith('ErrorCode')) continue;
      enums += 1;
      for (const member of statement.members) {
        const report = message => violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, member), message });
        const name = kit.propertyNameText(member.name) ?? '?';
        const value = member.initializer && ts.isStringLiteralLike(member.initializer) ? member.initializer.text : kit.stringValue(checker, member.initializer);
        if (value === null || value === undefined) { report(`${statement.name.text}.${name} must be a string literal code (\`${capability}_<WHAT>\`); a computed or numeric code cannot be checked or told apart in a log.`); continue; }
        codes += 1;
        if (!shape.test(value) || /_(?:ERROR|EXCEPTION)$/u.test(value)) {
          report(`${statement.name.text}.${name} = "${value}" must match ${capability}_<WHAT> in UPPER_SNAKE with the capability prefix and no _ERROR or _EXCEPTION suffix.`);
        }
        if (seen.has(value)) report(`Error code "${value}" is already declared in ${seen.get(value)}; a code is unique across the repository.`);
        else seen.set(value, file.rel);
      }
    }
  }
  return { violations, coverage: { status: 'checked', enums, codes } };
}
