# @starci/prettier-config

The one StarCi Prettier config, for back end and front end. Prettier is the only formatter: the ESLint layout rules
(`indent`, `quotes`, `semi`, `object-curly-newline`, `array-element-newline`, `function-call-argument-newline`) are removed
from the canon and never come back.

```json
{ "prettier": "@starci/prettier-config" }
```

Install it from the npm registry at the exact version in [`knowledge/hfs/canon-pins.yaml`](../../knowledge/hfs/canon-pins.yaml) (see [`packages/README.md`](../README.md)).

## The choice

`printWidth: 120`, `tabWidth: 4`, `semi: false`, `singleQuote: false`, `trailingComma: "all"`; JSON, YAML and Markdown use 2 spaces.

None of the StarCi monorepo repositories carries a Prettier file today. Their
layout came from ESLint: the largest back end enforces `indent: 4`, `quotes: "double"`, `semi: "never"`, and the front-end sources
already follow the same four rules. The largest repository's dialect produces the smallest reformat
diff. What changes is the one-binding-per-line imports and exports and the one-argument-per-line calls those ESLint rules
forced; Prettier collapses them to the width. `endOfLine` is `auto` so a Windows checkout with `core.autocrlf` is not flagged.

Applying it to a large repository is one commit in a quiet window, listed in `.git-blame-ignore-revs`.
