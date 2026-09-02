# Output of `<operator.id>`

## <State> receipt

The success receipt: its `receiptType`, `status`, `binding`, and the decision or result object it
carries. The heading names the success state in one word (`Decided`, `Resolved`, `Verified`, …).

## <Result section, optional, repeatable>

One section per result object the receipt carries, with the invariants `validate-output.mjs`
enforces on it.

## Blocked receipt

What a blocked receipt carries: the same binding, a null result, one typed failure, and a resume
when the failure is retryable.

## Failure codes

| Code | Meaning | Owning domain | What unblocks it |
| --- | --- | --- | --- |
| `<CODE>` | <one sentence> | <domain> | <the exact delta> |

## Cross-field invariants

The bullets `validate-output.mjs` enforces across fields: fingerprints that must agree, refs that
must be registered, states that must match.

## Practical outcomes

What the caller may rely on after each outcome, and what it must not infer.

```json template-contract
{
  "kind": "output",
  "applies": ["operators/*/output.md"],
  "title": { "en": "^# Output of `[a-z.]+`$", "vi": "^# Output của `[a-z.]+`$" },
  "sections": [
    { "en": "^## [A-Z][a-z]+ receipt$", "vi": "^## Receipt (khi|đã) .+$" },
    { "free": true },
    { "en": "^## Blocked receipt$", "vi": "^## Receipt khi blocked$" },
    { "en": "^## Failure codes$", "vi": "^## Mã lỗi$" },
    { "en": "^## Cross-field invariants$", "vi": "^## Bất biến liên trường$" },
    { "en": "^## Practical outcomes$", "vi": "^## Kết quả thực tế$" }
  ],
  "rules": null
}
```
