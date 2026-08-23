# Authority pattern backend

## LOADS

None.

## Record

Đây là entry V5 ổn định cho kiến trúc source backend. Luật pattern chi tiết tiếp tục sống đúng một nơi
dưới `knowledge/compilers/patterns/be/`; shelf này chọn và bind chúng mà không chép lại phán quyết.

## Routes

| Accepted shape chứa | Authority |
|---|---|
| Decision về file, import, operation, persistence, event, failure, test hoặc transport backend | child được route tới dưới `knowledge/compilers/patterns/be/<module>` |
| Complexity, semantic duplication, volatile facts, normalize lặp, state mâu thuẫn hoặc analysis provenance | `knowledge/compilers/patterns/be/maintainability` |

## Required plan binding

Mọi backend plan phát một binding cho mỗi module được route tới:

```json
{
  "module": "<pattern module>",
  "situations": ["<fixed situation code>"],
  "paths": ["<exact approved path>"],
  "evidence": ["<live schema or sibling fact>"]
}
```

## Rules

1. Mỗi file trong plan có ít nhất một pattern binding.
2. Mỗi binding có fixed situations, exact paths và live evidence.
3. Router không thêm phán quyết thứ hai; child pattern vẫn là authority.
4. Backend fact không có pattern situation là standards gap và dừng planning.
5. Situation enforced phải accountable qua rule-binding chain.

## Stops

- Route hoặc sibling/schema evidence stale.
- File không có pattern situation được route tới.
- Situation không có exact path hoặc evidence.
- Plan phải phát minh product-local architecture convention.

## Output

```text
module: <pattern authority>
situations: <fixed codes>
paths: <exact files>
evidence: <live facts>
```
