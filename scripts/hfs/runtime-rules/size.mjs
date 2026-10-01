// size.mjs - HFS_SIZE_GROWTH over the runtime (rule R20 of knowledge/hfs/rules.yaml, gate runtime): a production source
// above ruleParams.runtime.fileLines.soft may not grow against the base revision (the merge-base with main), and a source
// new since the base stays within soft. A file that moved (modules/kernel/retired-paths.yaml moved[]) is compared with its
// old path. Without a base revision nothing can grow, so nothing is judged. Pure: the base reader comes in through ctx.
import { movedFrom } from './retired.mjs';

export const CODE = 'HFS_SIZE_GROWTH';

const lineCount = (text) => String(text).split('\n').length;

/** HFS_SIZE_GROWTH findings of the runtime sources against ctx.base. */
export function sizeFindings(ctx) {
  if (!ctx.base) return [];
  const { soft } = ctx.params.fileLines;
  const oldPathOf = movedFrom(ctx.retiredPaths.moved);
  const found = [];
  for (const { path: file, text } of ctx.sources) {
    const lines = lineCount(text);
    if (lines <= soft) continue;
    const before = ctx.base.show(file) ?? (oldPathOf(file) ? ctx.base.show(oldPathOf(file)) : null);
    if (before === null) found.push({ code: CODE, level: 'error', path: file, lines, soft, message: `${file} is new since ${ctx.base.sha.slice(0, 9)} and has ${lines} lines, above the soft size ${soft}: split it` });
    else if (lines > lineCount(before)) found.push({ code: CODE, level: 'error', path: file, lines, before: lineCount(before), soft, message: `${file} grew from ${lineCount(before)} to ${lines} lines since ${ctx.base.sha.slice(0, 9)}, above the soft size ${soft}: an oversized file only shrinks - move the new code into a module of its own` });
  }
  return found;
}
