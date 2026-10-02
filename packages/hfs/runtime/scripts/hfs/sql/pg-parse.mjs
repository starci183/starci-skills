// pg-parse.mjs - the one SQL parse entry of the hfs database rules (scripts/hfs/rules/database.mjs): the WASM build
// of libpg-query, the real PostgreSQL parser compiled to WebAssembly (no native build, no postgres server). It is
// loaded lazily: a check of an app with no supabase/ tree never pays the module init. parseSql gives the statement
// tree of a migration (`{version, stmts}`, each stmt `{stmt, stmt_location, stmt_len}` with byte offsets); a
// plpgsql body (a DO block's or a function's `as` source) is judged through parsePlpgsqlBody, which wraps it in a
// probe CREATE FUNCTION because libpg-query parses plpgsql only in that form. A parse failure throws the
// library's SqlError, whose sqlDetails.cursorPosition is the 1-based byte offset of the error.

let loading = null;

/**
 * The libpg-query module (wasm build), initialized once per process. A bare dynamic import so the package can be
 * absent until a supabase/ tree exists to judge; the caller reports the load failure, not this module.
 */
function loadPgParser() {
  loading ??= (async () => {
    const module = await import('libpg-query');
    const lib = module.default?.parseSync ? module.default : module;
    await lib.loadModule();
    return lib;
  })();
  return loading;
}

/** The parse tree of `text` ({version, stmts}); throws SqlError on invalid SQL. */
export async function parseSql(text) {
  return (await loadPgParser()).parseSync(text);
}

/**
 * The plpgsql AST of a function/DO body: libpg-query's plpgsql parser only accepts a whole CREATE FUNCTION, so
 * `body` is wrapped in a probe function under a dollar tag that does not collide with the body's own tags.
 * Answers the PLpgSQL_function node; throws on a body that is not valid plpgsql.
 */
export async function parsePlpgsqlBody(body, parameters = [], returnsVoid = true) {
  let i = 0;
  let tag = `$hfs_probe_${i}$`;
  while (body.includes(tag)) { i += 1; tag = `$hfs_probe_${i}$`; }
  const args = parameters.map((parameter) => parameter?.FunctionParameter?.name).filter(Boolean)
    .map((name) => `"${name.replace(/"/g, '""')}" text`).join(', ');
  const result = await (await loadPgParser()).parsePlPgSQLSync(
    `create function hfs_probe(${args}) returns ${returnsVoid ? 'void' : 'text'} language plpgsql as ${tag}${body}${tag};`,
  );
  return result?.plpgsql_funcs?.[0]?.PLpgSQL_function ?? null;
}
