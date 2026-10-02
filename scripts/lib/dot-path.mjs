// dot-path.mjs — reading a nested value by its dotted path ('a.b.c'): null-safe descent, every absent
// step reads as undefined.

/** `root[key1][key2]...` for `dotted` = 'key1.key2...'; an absent step yields undefined. */
export const dotGet = (root, dotted) => String(dotted).split('.').reduce((node, key) => (node == null ? node : node[key]), root);
