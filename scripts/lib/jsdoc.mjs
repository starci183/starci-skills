/**
 * The description form shared by runtime and product public-documentation checks.
 * This proves local form; responsibility, accuracy and important decision rationale remain review.
 */

/** Whether AST-selected description text contains a letter or number; language and meaning remain review. */
export const hasJsdocDescription = (description) => typeof description === "string" && /[\p{L}\p{N}]/u.test(description);

/**
 * Read description text before block tags; file-level headers do not describe a declaration.
 * Tag payloads and punctuation cannot make an empty API description pass.
 */
export const jsdocDescription = (comment) => {
  if (comment?.type !== "Block" || !comment.value.startsWith("*")) return "";
  const prose = comment.value.replace(/^\*/, "").split(/\r?\n/u)
    .map((line) => line.replace(/^\s*\*(?: ?)/u, "")).join("\n");
  if (/(?:^|\s)@(?:file|fileoverview|overview|license|copyright)\b/u.test(prose)) return "";
  const description = prose.split(/(?:^|\s)@[A-Za-z][\w-]*(?=\s|$)/u, 1)[0].trim();
  return hasJsdocDescription(description) ? description : "";
};

/**
 * Return the final adjacent JSDoc only when it describes this declaration.
 * Decorated classes document the export after its decorators; member docs precede their decorators.
 */
export const jsdocBefore = (sourceCode, node) => {
  const exported = node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration";
  const anchor = exported
    ? sourceCode.getTokens(node).find((token) => token.type === "Keyword" && token.value === "export")
    : node.decorators?.[0] ?? node;
  if (!anchor) return null;
  const comment = sourceCode.getCommentsBefore(anchor).at(-1);
  if (!jsdocDescription(comment)) return null;
  return /^\s*$/u.test(sourceCode.getText().slice(comment.range[1], anchor.range[0])) ? comment : null;
};
