# @starci/cli

`starci` is the single catalog-driven command line for StarCi. Product repositories use
`starci app ...`; runtime operations use the `workflow`, `kernel`, `runtime`, `supervisor`, and
`debug` groups.

Install the package as an exact development dependency, then run `starci help`. Runtime commands
locate an installed StarCi tree automatically. If none exists, run `starci runtime install`.
