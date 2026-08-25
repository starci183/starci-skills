---
title: Integration
---

# Integration

## LOADS

Không có.

## Record

Mẫu này định tuyến kiến trúc source sau khi một provider hoặc capability hạ tầng bên ngoài đã được
chấp thuận. Nó đặt port của feature, adapter, translation và lifecycle registration mà không để SDK
của vendor trở thành luật domain.

## Law

Integration có hai contract: contract feature dùng trong application và protocol provider dùng trong
adapter. Port ổn định, diễn đạt capability; adapter sở hữu auth, wire format, SDK và lifecycle. Data
và failure từ provider được dịch tại ranh giới. Registration rõ ràng, một lần và có thể thay thế.

Câu hỏi quyết định: feature có giữ nguyên ý nghĩa khi provider, credential, response shape hoặc
availability thay đổi không?

## Situation codes

| Code | Tình huống | Source phải có |
|---|---|---|
| `INTEGRATION-1` | Feature cần capability ngoài | Port do feature sở hữu, dùng domain intent và result/error typed; feature không import SDK |
| `INTEGRATION-2` | Adapter nói chuyện với provider | Một adapter implement port và chứa protocol, auth, endpoint, SDK; credential đến từ config đã compose |
| `INTEGRATION-3` | Data/failure provider đi qua ranh giới | Translation thuần map field/status/error sang DTO và failure identity ổn định; raw provider object không thoát |
| `INTEGRATION-4` | Integration vào runtime | Composition root bind đúng một implementation, khai báo start/stop/health và cho phép thay trong test |

## Reading an accepted shape

1. Bắt đầu từ capability và outcome của feature, không từ noun của SDK.
2. Đặt port trước adapter, adapter trước translation, rồi mới registration.
3. Chỉ register sau khi config và lifecycle rõ ràng.
4. Hỏi: test feature dùng fake port được (`-1`); auth cô lập (`-2`); provider đổi status không làm
   đổi domain (`-3`); startup/shutdown/replacement có owner (`-4`) không?
5. Code cộng dồn: port đúng nhưng trả raw SDK vẫn sai `-3`; adapter đúng mà không register sai `-4`.

## `INTEGRATION-1` — ranh giới feature tới port

Feature định nghĩa port hẹp ở application/domain boundary, operation dùng thuật ngữ feature, input/
output typed và failure ổn định. Port không lộ SDK client, provider request, HTTP response hay token.

Ranh giới: `CQRS` quyết định vị trí command/query/event; code này quyết định capability edge. `EVENT-
DELIVERY` phân phối fact, không thay cánh cửa provider.

## `INTEGRATION-2` — protocol và auth nằm trong adapter

Adapter duy nhất import SDK, tạo wire request, nhận config typed, áp auth/endpoint rồi gọi provider.
Feature không đọc token hoặc env.

Ranh giới: `CONFIGURATION` compose/validate giá trị, adapter dùng nó để auth. Timeout/retry generic có
thể do `RESILIENCE` sở hữu, còn request provider là của adapter.

## `INTEGRATION-3` — dịch data và error provider

Boundary map response vào result nội bộ, map status/error vào failure identity, retryability và metadata
an toàn; bỏ field lạ và không trả SDK object vào feature.

Ranh giới: `EXCEPTIONS` định nghĩa identity, code này dịch provider failure vào identity đó; `OBSERVABILITY`
có thể giữ provider code đã redact nhưng log không phải API translation.

## `INTEGRATION-4` — registration của lifecycle

Composition root bind một adapter cho một port và khai báo startup, shutdown, health hoặc subscription.
Registration explicit, idempotent; test cung cấp fake port mà không boot provider.

Ranh giới: `DELIVERY-ASSURANCE` kiểm tra gate/secret, còn code này đặt runtime. Provider callback có thể
phát event local nhưng client provider vẫn do integration registration sở hữu.

## Layer held

Feature/application sở hữu port và internal contract. Adapter sở hữu SDK, wire protocol, auth,
translation. Composition root sở hữu registration/lifecycle. Configuration sở hữu validation, resilience
sở hữu deadline/retry/bulkhead, event delivery sở hữu fan-out, observability sở hữu telemetry.

## Inputs

| Input | Evidence |
|---|---|
| capability | Operation và result/failure contract |
| provider | SDK/protocol, endpoint, auth, lifecycle |
| translation | Mapping response/error và redaction |
| configuration | Giá trị typed và owner secret |
| registration | Composition root, start/stop/health |
| proof | Fake-port test và provider harness/contract test |

## Rules

1. Chỉ adapter import provider code.
2. Port dùng capability, không dùng vocabulary provider.
3. Dịch cả success và failure.
4. Compose credential một lần; feature không đọc raw env.
5. Register lifecycle explicit, đúng một lần.

## Exceptions

- Capability provider-specific vẫn phải dịch response/failure và giữ auth trong adapter.
- Webhook nhận wire shape phải gọi translator ngay, không đưa raw data vào feature/event.
- Shared SDK wrapper có thể gom auth/pool nhưng feature vẫn phụ thuộc port phía sau adapter.

## Output

```text
capability: <capability feature>
port: <file/type port>
adapter: <provider adapter>
translation: <mapping result/failure>
registration: <composition root/lifecycle>
situation: <INTEGRATION-1 | INTEGRATION-2 | INTEGRATION-3 | INTEGRATION-4>
reason: <fact chọn boundary>
```
