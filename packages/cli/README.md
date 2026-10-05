# @starci/cli

`starci` is the single catalog-driven command line for StarCi. Product repositories use
`starci app ...`; runtime operations use the `workflow`, `kernel`, `runtime`, `supervisor`, and
`debug` groups.

Use Node.js 22.22.3 or later within the 22 branch, or 24.15.0 or later within the 24 branch, as
`package.json` `engines.node` declares. Runtime SQLite capability checks remain required.

Install the package as an exact development dependency, then run `starci help`. Runtime commands
locate an installed StarCi tree automatically. If none exists, run `starci runtime install`.
