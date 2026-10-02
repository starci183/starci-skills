// ast-names.mjs — the names an acorn binding pattern declares (identifier, destructuring, defaults, rest).

/** Every name `pattern` binds, pushed into `into` (an array; a Set caller adds each result itself). */
export function boundNames(pattern, into = []) {
  if (!pattern) return into;
  if (pattern.type === 'Identifier') into.push(pattern.name);
  else if (pattern.type === 'ObjectPattern') pattern.properties.forEach((p) => boundNames(p.value ?? p.argument, into));
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((p) => boundNames(p, into));
  else if (pattern.type === 'AssignmentPattern') boundNames(pattern.left, into);
  else if (pattern.type === 'RestElement') boundNames(pattern.argument, into);
  return into;
}
