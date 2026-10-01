// line-count.mjs - text line counts and the size-growth limit (pure).

/** The line count of a text; a trailing newline does not open a line. */
export const lineCount = (text) => {
  const lines = String(text).split(/\r?\n/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
};
/** The line count above which a file may not grow: the soft budget when `hardGrowth` holds, else no limit. */
export const hardGrowthLines = ({ soft, hardGrowth }) => (hardGrowth ? soft : Number.POSITIVE_INFINITY);
