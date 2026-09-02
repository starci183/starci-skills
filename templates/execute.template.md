# Execute `<operator.id>`

## Single job

One paragraph: what this invocation turns its input into, and the sentence "This is one linear
operator invocation. It does not call another operator, route a workflow, pause internally, or return
a free-form control instruction."

## <Law section, optional, repeatable>

A short law the sequence relies on, stated as an enforced prohibition with the reason it exists.
Zero or more of these sit between Single job and Sequence.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, prior receipt | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | <verb phrase> | <what it consumes> | <artifact ref it produces, or —> | <failure codes from output.schema.json, or —> |
| n | Emit and stop | everything above | receipt | — |

Every step writes at most one named artifact; every failure code in the table exists in
`output.schema.json`; every failure code the schema publishes appears in exactly one row or in
`Mandatory attacks`.

## <Law section, optional, repeatable>

## Resume execution

How a resume re-enters at step 1, what it may reuse by fingerprint, and that an unchanged resume is
`NO_PROGRESS`.

## Mandatory attacks

The bullet list of conditions under which the operator cannot report success. Each bullet names an
observable condition, never an intention.

```json template-contract
{
  "kind": "execute",
  "applies": ["operators/*/execute.md"],
  "title": { "en": "^# Execute `[a-z.]+`$", "vi": "^# Thực thi `[a-z.]+`$" },
  "sections": [
    { "en": "^## Single job$", "vi": "^## Một việc duy nhất$" },
    { "free": true },
    { "en": "^## Sequence$", "vi": "^## Trình tự$", "table": { "en": "| # | Step | Reads | Writes | Stops with |", "vi": "| # | Bước | Đọc | Ghi | Dừng với |" } },
    { "free": true },
    { "en": "^## Resume execution$", "vi": "^## Thực thi khi resume$" },
    { "en": "^## Mandatory attacks$", "vi": "^## Các đòn tấn công bắt buộc$" }
  ],
  "rules": null
}
```
