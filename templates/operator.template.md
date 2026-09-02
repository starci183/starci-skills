# <operator.id>

## Job

One sentence: the single thing this operator decides or produces, and what it proves it against.

## <Any law the operator carries>

Free sections between Job and Context hold the operator's own law: what it refuses, what it never
treats as a reason, what it must observe before it proposes. Prose, not tables.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@zone/path` | what is read there and at which head or fingerprint | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `kind-name` | which earlier operator's branch produces it, or "a prior run" | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `field` | prompt \| choice \| number \| id \| list \| token | — | what the person is asked; `—` in Default means the field is required |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume | `resume` | `request/request.json` | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Do the job | `field` | `@zone/path` | `response/response.md`, `response/response.json` | — |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `kind-name` | `response/response.md` | md | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |

## Next

| When | Operator |
| --- | --- |
| the condition under which the chain continues there | `other.operator` |

```json template-contract
{
  "kind": "operator",
  "applies": ["operators/*/operator.md"],
  "title": { "en": "^# [a-z]+(?:\\.[a-z]+)+$", "vi": "^# [a-z]+(?:\\.[a-z]+)+$" },
  "sections": [
    { "en": "^## Job$", "vi": "^## Việc$" },
    { "free": true },
    { "en": "^## Context$", "vi": "^## Context$", "table": { "en": "| Alias | Bind | Required |", "vi": "| Alias | Bind | Bắt buộc |" }, "minRows": 1 },
    { "en": "^## Inputs$", "vi": "^## Đầu vào$", "table": { "en": "| Kind | From | Required |", "vi": "| Kind | Từ đâu | Bắt buộc |" } },
    { "en": "^## Requirements$", "vi": "^## Yêu cầu$", "table": { "en": "| Field | Type | Default | Ask |", "vi": "| Field | Kiểu | Mặc định | Hỏi |" } },
    { "en": "^## Steps$", "vi": "^## Các bước$", "table": { "en": "| # | Step | Params | Reads | Writes | Stops with |", "vi": "| # | Bước | Tham số | Đọc | Ghi | Dừng với |" }, "minRows": 2 },
    { "en": "^## Outputs$", "vi": "^## Đầu ra$", "table": { "en": "| Kind | File | Type | Required |", "vi": "| Kind | File | Kiểu | Bắt buộc |" }, "minRows": 1, "cell": { "Type": "^(md|data|artifact)$", "Kiểu": "^(md|data|artifact)$" } },
    { "en": "^## Stops$", "vi": "^## Dừng$", "table": { "en": "| Code | Disposition |", "vi": "| Code | Xử lý |" }, "minRows": 1, "cell": { "Disposition": "^(terminate|fallback)$", "Xử lý": "^(terminate|fallback)$" } },
    { "en": "^## Next$", "vi": "^## Kế tiếp$", "table": { "en": "| When | Operator |", "vi": "| Khi | Operator |" } }
  ],
  "rules": null
}
```
