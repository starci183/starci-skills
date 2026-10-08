// trim-end.mjs — a string without the run of characters at its end that `matches` accepts.

/** `value` with its trailing characters removed while `matches(char)` holds. */
export const trimEndWhile = (value, matches) => {
  let end = value.length;
  while (end > 0 && matches(value[end - 1])) end -= 1;
  return value.slice(0, end);
};
