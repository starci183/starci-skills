// PostgreSQL AST primitives shared by database verbs and synchronous content rules.

/** String identifier components from libpg-query's wrapped String nodes. */
export const sqlStringParts = (nodes) => (nodes ?? []).map((node) => node?.String?.sval).filter((value) => value !== undefined);

/** Traverse SQL/PLpgSQL objects; executable scans leave function declarations inert. */
export function walkSqlAst(value, visit, executable = false) {
  if (!value || typeof value !== 'object' || (executable && value.CreateFunctionStmt)) return;
  visit(value);
  for (const child of Object.values(value)) walkSqlAst(child, visit, executable);
}

/** Build a synchronous parser with the caller's failure policy and initialized parser. */
export function sqlParser(parser, reject = () => null) {
  return (text) => {
    try { return parser?.parseSync(text) ?? null; }
    catch (error) { return reject(error); }
  };
}

/** Resolve named arguments before positional arguments, as PostgreSQL does. */
export function sqlCallArgument(call, position, names = []) {
  const args = call.args ?? [];
  return args.find((item) => names.includes(item?.NamedArgExpr?.name))?.NamedArgExpr?.arg
    ?? args.filter((item) => !item.NamedArgExpr)[position];
}

/** Read a literal string through static casts without evaluating an expression. */
export function sqlStringLiteral(node) {
  if (node?.TypeCast) return sqlStringLiteral(node.TypeCast.arg);
  return node?.A_Const?.sval?.sval ?? null;
}
