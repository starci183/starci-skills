---
title: Api-evolution
---

# API evolution

## LOADS

Không có.

## Record

Đầu vào là API operation, schema, event-facing payload hoặc client contract đã chấp nhận. Module này
quyết định contract thay đổi mà không âm thầm phá caller: điều gì additive, break khi nào cần negotiate,
deprecation kết thúc ra sao, error/enum/page nào ổn định và test nào chứng minh compatibility. Áp dụng
cho GraphQL, REST và public service boundary tương đương; internal function chỉ vào scope khi có consumer
độc lập release phụ thuộc.

## Law

Compatibility là semantic, không chỉ “server còn compile”. Thêm field/capability optional mà không đổi
meaning; không âm thầm diễn giải lại required field, enum value, error code hoặc cursor. Break phải có
version/negotiation rõ và migration path. Deprecated surface có owner, telemetry, sunset criteria và
removal change; comment “deprecated” không phải lifecycle. Error dùng machine identity ổn định, enum có
unknown policy khi protocol cho phép và cursor opaque. Provider/consumer contract test chạy old/new
client trên version được hỗ trợ.

Ranh giới rõ. `transport` đặt route/header/GraphQL field/protocol syntax; `exception-identity` giữ
class/code identity; `naming` giữ source vocabulary; `data-access` giữ persistence migration;
`maintainability` phán isolation; `testing` giữ mechanics. Module này quyết semantic compatibility và
evolution evidence, không thay implementation detail.

## Situation codes

| Code | Situation | Source phải thể hiện |
|---|---|---|
| `API-1` | Mở rộng contract released mà không break | Field/option mới additive, optional/default; field, meaning, error, pagination cũ vẫn hợp lệ |
| `API-2` | Change không giữ được semantics cũ | Version/negotiation explicit chọn contract breaking; không trộn semantics âm thầm |
| `API-3` | Public surface deprecate/remove | Có owner, notice, telemetry, migration, sunset, removal criteria và proof riêng |
| `API-4` | Error/enum/pagination representation public | Machine error code/path, enum unknown behavior và cursor/page semantics opaque ổn định |
| `API-5` | Contract change được đề xuất/release | Consumer/provider compatibility test cover old/new client, fixture, negotiation và failure |

## Đọc shape đã duyệt

1. Inventory consumer, release version, field/argument/enum/error/cursor và semantics phụ thuộc.
2. Phân loại additive, negotiated-breaking, deprecation hoặc removal trước sửa schema.
3. Giữ meaning/default cũ. Nếu không thể, chọn negotiation explicit.
4. Với deprecation, gọi tên owner, migration, telemetry và removal gate đo được.
5. Freeze error/code/path, enum unknown handling và cursor semantics bằng fixture.
6. Thêm test old/new consumer, malformed và unsupported-version.
7. Áp dụng độc lập mọi mã; field additive vẫn cần error/page stability và test.

## `API-1` — additive change giữ meaning cũ

**Situation.** Operation released cần thêm field, optional argument, capability hoặc event member.

**Source phải thể hiện.** Response field mới optional/default an toàn; request input mới optional và việc
bỏ qua không đổi meaning. Nullability, ordering, error code, authorization semantics cũ giữ nguyên.
Consumer không biết field mới vẫn parse và dùng answer cũ.

**Ranh giới.** `NAMING-*` không làm schema compatible. `DATA-*` migration không chứng minh wire
compatibility. Nếu meaning cũ/mới không coexist, dừng `API-1` và dùng negotiation của `API-2`.

## `API-2` — breaking semantics cần negotiation rõ

**Situation.** Field type/nullability, required input, enum meaning, error shape, pagination hoặc
authorization behavior không thể giữ consumer cũ.

**Source phải thể hiện.** Version được chọn bằng route/header/media type, GraphQL schema/version hoặc
negotiation khai báo tương đương và validate trước dispatch. Mỗi version có contract coherent và
test/docs; không đoán bằng user-agent, date switch hay silent branch.

**Ranh giới.** `TRANSPORT` thực thi cửa route/header/schema; `API-2` buộc cửa đó visible/deterministic.
`EXCEPTION-IDENTITY` giữ code ổn định trong từng version. `MAINTAINABILITY` có thể tách implementation
nhưng không cho hidden break.

## `API-3` — deprecation có lifecycle đo được

**Situation.** Field, endpoint, enum, version hoặc capability phải biến mất.

**Source phải thể hiện.** Surface đánh dấu deprecated với replacement, date/owner; usage đo theo
client/version/tenant; migration documented; sunset announced; removal đợi usage/support criteria.
Removal là change riêng và có test chứng minh old contract không còn được hứa.

**Ranh giới.** Không phải `MAINTAIN-*`: cleanup code cũ không phải deprecation lifecycle. `TRANSPORT`
có thể hiển thị directive/header; mã này giữ evidence/timing. Deprecated error code vẫn giữ identity
đến khi remove.

## `API-4` — error, enum và pagination ổn định

**Situation.** Caller branch theo error, lưu enum hoặc resume page.

**Source phải thể hiện.** Error có stable machine code và structured path/metadata; wording/status tách
riêng. Enum addition có unknown/fallback policy, không repurpose value cũ. Cursor opaque, scoped cho
operation/version, invalid có stable error; order/page boundary documented, không suy từ ID.

**Ranh giới.** `exception-identity` chọn class/code; `API-4` giữ identity compatible. `transport` map
syntax. `PERF-1` bound page cost; mã này giữ pagination contract. `naming` không govern enum spelling
wire sau release.

## `API-5` — compatibility là executable

**Situation.** Provider đổi contract, publish version hoặc remove deprecated surface.

**Source phải thể hiện.** Contract tests chạy old consumer fixture với provider, new consumer với contract
mới và case negotiation/error/unknown-enum/cursor. Schema diff review có consumer matrix; test assert
semantics chứ không chỉ generated types/HTTP 200. Removal test chứng minh sunset/migration.

**Ranh giới.** Không phải generic `TESTING-*`: testing chọn lane/assertion; `API-5` gọi tên matrix/facts
freeze. Không phải `PERF-4`: latency budget không establish semantic compatibility.

## Layer held

| Code | Tier | Được giữ bởi |
|---|---|---|
| `API-1` | `documented` | Schema diff và consumer review |
| `API-2` | `documented` | Negotiation integration test và versioned contract review |
| `API-3` | `documented` | Usage telemetry, owner/sunset record và removal review |
| `API-4` | `documented` | Wire fixture và client behavior tests |
| `API-5` | `documented` | Provider/consumer matrix và schema-diff gate |

## Inputs

| Input | Bằng chứng bắt buộc |
|---|---|
| consumers | Released clients, version, generated SDK và usage thật |
| contract | Field, argument, enum, error, cursor, default, semantics |
| change | Additive, breaking, deprecated hoặc removal |
| negotiation | Version signal explicit và contract được chọn |
| lifecycle | Replacement, owner, telemetry, sunset, removal criteria |
| proof | Schema diff, fixture, old/new test, failure case |

## Rules

1. Coi meaning, nullability, error code, enum value, cursor semantics hiện tại là contract.
2. Input/output additive phải optional/default và old client bỏ qua được.
3. Break bắt buộc negotiate explicit, deterministic.
4. Deprecation có owner, replacement, telemetry, sunset, removal gate.
5. Error identity stable, enum unknown explicit, cursor opaque/scoped.
6. Chạy old/new provider-consumer contract test; generated type không đủ proof.
7. Giữ transport, exception identity, naming, data access, maintainability, testing ở module riêng.

## Exceptions

- **Private unreleased API.** Chưa có consumer release độc lập có thể đổi trước release đầu, nhưng vẫn
  cần source shape coherent và test consumer đã khai báo.
- **Security emergency.** Remove/reject ngay có thể trước sunset; publish break, giữ failure identity
  ổn định và bổ sung migration/compatibility evidence sau.
- **GraphQL deprecation.** Directive là notice, không tự là lifecycle; owner/usage/sunset vẫn cần.
- **Enum protocol hạn chế.** Nếu protocol không chịu unknown, negotiate/version trước khi thêm value.

## Stops

Dừng khi không biết consumer/released semantics, break thiếu negotiation, deprecation thiếu owner/
telemetry/sunset, error/enum/cursor suy từ message/ID, hoặc proof chỉ compile/build. Dừng removal khi
thiếu migration và usage criteria.

## Proof

| Code | Proof tối thiểu |
|---|---|
| `API-1` | Schema diff + old-client fixture chứng minh field/meaning cũ và omission field mới |
| `API-2` | Version negotiation test chứng minh mỗi signal chọn đúng một contract, không silent cross-version |
| `API-3` | Deprecation record/telemetry và removal test chứng minh replacement/sunset gate |
| `API-4` | Wire fixture assert error code/path, enum fallback, cursor opaque semantics |
| `API-5` | Provider/consumer matrix chạy old/new qua success, failure, unknown, cursor |

## Output

```text
consumers: <released clients và versions>
change: <additive | negotiated-breaking | deprecated | removal>
contract: <field/error/enum/pagination semantics>
negotiation: <explicit signal hoặc none>
lifecycle: <owner, replacement, telemetry, sunset, gate>
situation: <API-1 | API-2 | API-3 | API-4 | API-5>
verdict: <holds | violates | stop>
proof: <schema diff, fixture hoặc matrix>
```

## Scope

Pattern quản lý semantic API compatibility, breaking negotiation explicit, deprecation/removal lifecycle,
error/enum/pagination contract ổn định và compatibility proof executable. Nó không đặt transport route,
đặt source name, chọn exception identity, làm data migration, refactor module hay chọn test lane; các
phần đó thuộc `transport`, `naming`, `exception-identity`, `data-access`, `maintainability`, `testing`.
