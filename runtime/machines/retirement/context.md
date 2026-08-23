# Retirement machine

## LOADS

None.

## Record

`check.mjs` is the deterministic retirement proof for active references to the retired roots
`.claude_legacy`, `.claude-v3`, `.claude-starci-ultimate`, `.mount` and `.containers`.

The report walks a repository in sorted path order and emits exact path-component matches with a
source-relative path, line, column, root identity and bounded evidence. It skips Git metadata,
dependency/build/cache output, generated documentation, the retired target trees themselves and its
own directory (including fixture literals). `--strict` returns a failing process status when any
active reference remains; report mode still prints all findings for migration work.

## Runtime target

```text
node .claude/runtime/machines/retirement/check.mjs --report <repository-root>
node .claude/runtime/machines/retirement/check.mjs --strict <repository-root>
```
