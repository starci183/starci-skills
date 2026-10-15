// Shell scanners share the same projection: whole-line comments do not execute.

/** Keep executable lines and line breaks while excluding whole-line shell comments. */
export const shellCommandSource = (text) => String(text ?? '').split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join('\n');
