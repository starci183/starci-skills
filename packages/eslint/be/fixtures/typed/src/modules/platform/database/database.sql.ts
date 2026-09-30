/** Fixture stand-in for `platform/database/database.sql.ts`: the branded SQL types and the `sql` tag. */
declare const sqlTextBrand: unique symbol
declare const sqlIdentBrand: unique symbol
/** SQL text built with the `sql` tag. */
export type SqlText = string & { readonly [sqlTextBrand]: true }
/** A dynamic identifier checked by `ident`. */
export type SqlIdent = string & { readonly [sqlIdentBrand]: true }
/** The tag that builds a `SqlText`; its only substitution is a `SqlIdent`. */
export declare function sql(strings: TemplateStringsArray, ...idents: ReadonlyArray<SqlIdent>): SqlText
/** Checks a dynamic identifier against a fixed list. */
export declare function ident(name: string, allowed: ReadonlyArray<string>): SqlIdent
