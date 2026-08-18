# Strict fix

## LOADS

None.

## Stale signature

Strict-fix scope contains direct Prettier packages, config/ignore files, scripts, lint-staged entries,
hooks, CI steps or editor settings while the installed ESLint canon owns formatting.

## List evidence

Inspect only first-party integration points. A prose mention or transitive lockfile dependency is not
formatter ownership. Report every matching path and manifest field without executing Prettier.

## Repair inventory

Inventory direct `prettier`, `eslint-plugin-prettier`, `eslint-config-prettier`, `prettier-plugin-*`,
`.prettierignore`, `.prettierrc*`, `prettier.config.*` and every first-party invocation. This exact set,
plus manifest and lockfile, is the approval boundary.

## Apply

Remove the complete integration in one mechanical pass. Repoint a still-needed format entrypoint to the
installed ESLint canon; remove it when it only duplicates lint. Regenerate the lockfile through the package
manager. Do not delete unrelated packages merely because their dependency tree contains Prettier.

## Proof

No tracked Prettier config/ignore file, no direct Prettier-family package and no first-party invocation or
editor selection remains. Every retained format command resolves to ESLint and passes. Explain any
lockfile-only transitive match with the package manager's dependency path.
