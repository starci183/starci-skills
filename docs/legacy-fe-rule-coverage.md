Owner: knowledge/hfs/rules.yaml

# Front-end source invariants

## R106

`FE_I18N_KEYS` keeps translation reads and catalogs aligned in lite and full. A literal `next-intl` read such as `useTranslations("home")("title")` needs `home.title` in every locale. Delete catalog leaves that no app or shared-package source string can read; dynamic reads are handled conservatively so computed keys do not invent missing-key findings.

The [edition proofs](../packages/eslint/fe/legacy-i18n-keys-coverage.spec.mjs) build real catalogs and source on disk. Reading `title` passes; reading `missing` through the same translator fails on the source call.

## R107

`FE_COOKIE_ATTRIBUTES` judges writes through Next's response cookie type, including `response.cookies.set` and `(await cookies()).set`. State `httpOnly: true` for a session, or literal `false` for a script-readable preference; supply `secure` and `sameSite: "lax"` or `"strict"`. An `as const` options object preserves these choices when clearing a cookie through a spread.

The [typed examples](../packages/eslint/fe/legacy-cookie-attributes-coverage.spec.mjs) exercise both editions with Next's cookie declarations. Explicit session and preference options pass. Omitting options, omitting `httpOnly`, using `secure: false`, or using `sameSite: "none"` produces the finding. Cookie-writing behavior is authored by the application; the managed skeleton has no response-cookie writer to scaffold.

## R110

`FE_PROPS_MUTABLE` requires the props of exported rendering functions to remain readonly in either edition. Mark fields and index signatures `readonly`, including nested object fields. Collections use `readonly T[]`, `readonly [A, B]`, or `ReadonlyArray<T>`, and their element shapes also remain readonly.

The [props examples](../packages/eslint/fe/legacy-props-readonly-coverage.spec.mjs) accept a deeply readonly shape and reject mutable fields, nested fields, index signatures, arrays, tuples, inherited fields, and array element fields. `Readonly<{ title: string; tags: readonly string[] }>` is valid because its nested array is readonly too.
