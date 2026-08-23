---
title: Port offset
---

# Port offset

## LOADS

None.

## Record

Đầu vào là runtime shape backend đã được chấp nhận: một Source family, các application và các service
bind hoặc consume port. Đầu ra tách allocation bền vững của Source khỏi declaration trong product và
runtime projection đã resolve, không đổi một effective port đang sạch.

## Law

`.workspaces/ports/config.json` sở hữu slot step chung của Source, và mỗi
`.workspaces/ports/<project>.json` là nơi duy nhất sở hữu lâu dài offset cùng application slot của family đó. Backend
`metadata.json` khai service identity cùng base port trong `portServices`, và có thể giữ `ports` đã
resolve cho consumer. Product không giữ `portOffset`, slot number hoặc allocation table thứ hai.

Shared service resolve theo `basePort + family.offset`. Application service resolve theo
`basePort + family.offset + application.slot * slotStep`. Frontend và backend của cùng application
dùng chung slot nên phải di chuyển cùng nhau. Cặp application canonical dùng frontend base `3000` và
backend base `3001`; vì vậy backend port đã resolve luôn bằng frontend port cộng một. Tool và external
port là ngoại lệ explicit có reason.

## Situation codes

| Code | Situation | Source phải có hình dạng gì |
|---|---|---|
| `PORT-OFFSET-1` | Source family cần allocation bền vững | Family offset và các application slot nguyên không âm, không trùng nhau chỉ sống trong `.workspaces/ports/<project>.json`; slot step chung sống trong `.workspaces/ports/config.json` |
| `PORT-OFFSET-2` | Backend service bind trên Source host | `metadata.json.portServices` khai scope và base port; `metadata.json.ports` giữ projection đã resolve |
| `PORT-OFFSET-3` | Frontend và backend thuộc cùng application | Cả hai declaration dùng cùng application slot và mọi consumer đạt tới dùng projection tương ứng |
| `PORT-OFFSET-4` | Tool hoặc external service không dùng được family arithmetic | Declaration dùng explicit port và reason không rỗng; chỉ `external` bị loại khỏi host-collision proof |
| `PORT-OFFSET-5` | Allocation hoặc projection thay đổi | Family migrate nguyên tử, mọi consumer đạt tới di chuyển cùng nhau và collision proof chạy trước runtime smoke |

## Reading an accepted shape

1. Resolve Source, project family, routed roles và application identity.
2. Inventory từng local listener và phân loại `shared`, `application`, `tool` hoặc `external`.
3. Dùng application base canonical `3000` cho frontend và `3001` cho backend; giữ effective port sạch
   bằng family offset thay vì dịch một trong hai base.
4. Emit Source allocation một lần, backend service declaration một lần, rồi cập nhật mọi projection consumer đạt tới.
5. Từ chối partial migration: cặp frontend/backend khác slot không phải trạng thái trung gian hợp lệ.

## `PORT-OFFSET-1` — Source sở hữu family và application allocation

**Situation.** Nhiều repository dùng chung một host và cần dải port ổn định, không collision.

**What it emits in source.** Một family record `.workspaces/ports/<project>.json` với `project`, `offset`,
`applications`, cộng với Source-wide `slotStep` trong `.workspaces/ports/config.json`. Product repository
không chứa offset hoặc slot authority.

**Boundary.** Nó không khai service; đó là `PORT-OFFSET-2`. Nó không sửa consumer; đó là
`PORT-OFFSET-3` hoặc `PORT-OFFSET-5`.

## `PORT-OFFSET-2` — backend metadata khai service và projection

**Situation.** Backend stack publish application hoặc shared service trên Source host.

**What it emits in source.** `metadata.json.portServices.<name>` với `scope`, `basePort` và
`application` khi cần, cộng số đã resolve tại `metadata.json.ports.<name>`.

**Boundary.** `portServices` mô tả service identity; nó không sở hữu family offset hoặc slot.
Container-internal port không publish ra host nằm ngoài declaration này.

## `PORT-OFFSET-3` — paired applications di chuyển cùng nhau

**Situation.** Frontend và backend tạo thành một routed application, cùng bind hoặc consume local port.

**What it emits in source.** Application declaration dùng cùng application key; script, env example,
default và test đọc projection tương ứng. Frontend khai base `3000`, backend khai base `3001`, và cả
hai cộng cùng family offset cùng slot term.

**Boundary.** Shared datastore không có application slot và vẫn là `PORT-OFFSET-2` với scope `shared`.

## `PORT-OFFSET-4` — explicit port là ngoại lệ đóng

**Situation.** Tool chạy thủ công hoặc external service có port mà family arithmetic không được renumber.

**What it emits in source.** `scope: tool` hoặc `scope: external`, explicit `port` và `reason` không rỗng.
Tool vẫn nằm trong local collision check; external service thì không.

**Boundary.** App, datastore, broker hoặc identity service bình thường không thành ngoại lệ chỉ vì số hiện tại tiện.

## `PORT-OFFSET-5` — migration là một family-wide structural pass

**Situation.** Allocation thiếu, trùng, stale hoặc collision với routed listener khác.

**What it emits in source.** Một pass cập nhật registry, declaration, projection và mọi consumer đạt tới,
sau đó chạy checker và concurrent runtime evidence.

**Boundary.** Không renumber effective port sạch vì thẩm mỹ. Partial role migration không hợp lệ.

## Layer held

| Code | Tier | Cái gì giữ nó |
|---|---|---|
| `PORT-OFFSET-1` | `enforced` | schema registry config/per-project và `check-port-offsets.mjs` |
| `PORT-OFFSET-2` | `enforced` | metadata declaration/projection được `check-port-offsets.mjs` kiểm tra |
| `PORT-OFFSET-3` | `documented` | routed consumer inventory cùng family-wide proof |
| `PORT-OFFSET-4` | `enforced` | explicit reason và collision classification trong `check-port-offsets.mjs` |
| `PORT-OFFSET-5` | `enforced` | collision check cùng concurrent listener smoke |

## Inputs

| Input | Evidence cần có |
|---|---|
| Source registry | `.workspaces/ports/config.json` cùng các family record `.workspaces/ports/<project>.json` |
| backend declaration | routed `metadata.json` có `portServices` và `ports` |
| consumers | compose/env script, application default, example và paired frontend reference |
| listeners | mọi local host binding và mọi external service được loại explicit |

## Rules

1. Source sở hữu offset và slot; product chỉ sở hữu service identity và projection.
2. Shared và application service dùng chính xác formula tương ứng.
3. Mỗi application slot là số nguyên không âm riêng biệt.
4. Frontend và backend consumer của cùng application migrate cùng nhau.
5. Cặp frontend/backend canonical dùng base port `3000` và `3001`, giữ `BE = FE + 1`.
6. Tool và external exception có explicit port cùng reason.
7. Không renumber effective port sạch khi chưa có measured collision hoặc accepted allocation change.
8. Collision proof phủ mọi routed local listener.

## Exceptions

- **Tool listener.** Explicit tool port có reason tham gia local collision check.
- **External service.** Explicit external port có reason được loại khỏi local host collision check.
- **Container-internal port.** Port không publish ra Source host không phải host allocation.

## Output

```text
family: <Source family>
allocation: <offset và application slots từ .workspaces/ports/<project>.json>
services: <metadata portServices declarations>
projection: <metadata ports đã resolve>
consumers: <backend/frontend runtime paths đã cập nhật>
situations: <PORT-OFFSET-1 ... PORT-OFFSET-5>
proof: <checker, collision set và concurrent runtime listeners>
```
