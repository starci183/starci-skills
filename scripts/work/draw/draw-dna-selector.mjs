// draw-dna-selector.mjs - the attribute parts of a CSS compound selector, for draw-dna's matching of <style> rules.

// An attribute selector after its '[': the name, then (when a value follows) the operator and the value up to the first ']'.
const ATTRIBUTE_NAME_RX = /[\w:-]+/y;
const ATTRIBUTE_VALUE_RX = /\s*[~|^$*]?=\s*(?!\s)["']?([^"'\]]*)["']?\]/y;

/** The text without its [...] attribute blocks: each '[' with a later ']' is removed up to that first ']'. */
export function withoutAttributeBlocks(text) {
  let out = '';
  let at = 0;
  for (let open = text.indexOf('['); open >= 0; open = text.indexOf('[', at)) {
    const close = text.indexOf(']', open + 1);
    if (close < 0) break;
    out += text.slice(at, open);
    at = close + 1;
  }
  return out + text.slice(at);
}

/** The attribute selectors of a compound selector, left to right: [{name, value}] with value null when none is given. */
export function attributeSelectorsOf(compound) {
  const found = [];
  const openAfter = (from) => compound.indexOf('[', from + 1);
  let open = compound.indexOf('[');
  while (open >= 0) {
    ATTRIBUTE_NAME_RX.lastIndex = open + 1;
    const name = ATTRIBUTE_NAME_RX.exec(compound)?.[0];
    const afterName = ATTRIBUTE_NAME_RX.lastIndex;
    ATTRIBUTE_VALUE_RX.lastIndex = afterName;
    const valued = name === undefined ? null : ATTRIBUTE_VALUE_RX.exec(compound);
    const closed = name !== undefined && (valued || compound[afterName] === ']');
    if (closed) found.push({ name, value: valued ? valued[1] : null });
    let resume = open;
    if (closed) resume = valued ? ATTRIBUTE_VALUE_RX.lastIndex - 1 : afterName;
    open = openAfter(resume);
  }
  return found;
}
