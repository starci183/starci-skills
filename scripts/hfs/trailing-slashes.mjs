// Trailing-slash trimming for slot paths and generated roots, linear in the length of the text.

/** `text` without its trailing `/` characters. */
export function trimTrailingSlashes(text) {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 47) end -= 1;
  return text.slice(0, end);
}
