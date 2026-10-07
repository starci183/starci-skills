// Linear-time text trimming and `<placeholder>` replacement for the HFS path and prose checks.

/** `text` without its trailing characters that are in `chars`. */
export function trimTrailingChars(text, chars) {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end -= 1;
  return text.slice(0, end);
}

/** `text` with every `<name>` placeholder (a `<`, one or more characters other than `>`, a `>`) replaced by `replacement`. */
export function replacePlaceholders(text, replacement) {
  let out = '';
  let from = 0;
  let open = text.indexOf('<');
  while (open >= 0) {
    const close = text.indexOf('>', open + 1);
    if (close < 0) break;
    if (close === open + 1) {
      open = text.indexOf('<', close);
    } else {
      out += text.slice(from, open) + replacement;
      from = close + 1;
      open = text.indexOf('<', from);
    }
  }
  return out + text.slice(from);
}

/** Whether `text` holds a `<name>` placeholder. */
export const hasPlaceholder = (text) => replacePlaceholders(text, '') !== text;
