---
title: Files-media
---

# Files-media

## LOADS

Không có.

## Record

Đầu vào là một năng lực file/media đã được chấp nhận: upload, download, preview, attachment, avatar,
video, export hoặc asset sinh ra. Module này quyết định byte, metadata, quyền sở hữu, quyền truyền
và cleanup được biểu diễn thế nào trong backend. Nó không mở lại quyết định sản phẩm có cần media
hay không; nó làm shape đã chấp nhận an toàn khi lưu và truyền.

## Law

Byte và ý nghĩa ứng dụng là hai thứ khác nhau. Byte thuộc storage provider hoặc stream boundary;
metadata thuộc database của application; database chỉ giữ reference opaque, không giữ bản sao byte
giả dạng. MIME do client khai báo chỉ là gợi ý, không phải bằng chứng. Storage key do service sinh
trong namespace của tenant, không sao chép từ tên file. Download là capability ngắn hạn có scope rõ,
không phải bucket public hay credential rộng. Mọi write thành công có owner lifecycle; mọi write lỗi
hoặc bị bỏ dở có đường cleanup idempotent.

Ranh giới là có chủ ý. `transport` chọn cửa upload/download và syntax response; `data-access` giữ
metadata persistence và transaction; `naming` quản lý tên symbol/path chứ không quản provider key;
`exception-identity` cho failure wire identity ổn định; `maintainability` phán separation và
duplication; `testing` chứng minh byte, ownership, capability và lifecycle. Module này chỉ quyết định
quan hệ media giữa các lớp đó, không thay luật của chúng.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi operation nhận, lưu, publish, download, thay
thế hoặc xoá file đều resolve mọi situation `MEDIA-*` phù hợp. “Chỉ là avatar” không được miễn:
upload nhỏ vẫn là byte không tin cậy, state thuộc tenant và resource có thể thành orphan.

## Situation codes

| Code | Situation | Source phải thể hiện |
|---|---|---|
| `MEDIA-1` | Đặt byte và metadata ứng dụng | Byte đi qua storage adapter/stream; record database giữ metadata và provider key opaque, không để blob nhị phân trong entity/API object |
| `MEDIA-2` | Tin vào size, MIME và content upload | Giới hạn size trước buffering không giới hạn; detected content đối chiếu allowlist và MIME khai báo khi contract yêu cầu; content bị từ chối không thành trusted media record |
| `MEDIA-3` | Gán provider key và tenant owner | Service sinh key opaque, không do user điều khiển, trong tenant namespace và kiểm tra tenant/resource ownership ở mọi read, write, delete |
| `MEDIA-4` | Caller cần truyền byte | Backend/storage adapter cấp signed capability ngắn hạn, đúng purpose; không dùng public URL vĩnh viễn hay credential provider rộng |
| `MEDIA-5` | Media có thể bị bỏ dở, thay thế hoặc xoá | Metadata state và provider object có lifecycle rõ; finalization, deletion và reconcile orphan idempotent |

## Đọc shape đã duyệt

1. Gọi tên nơi byte vào/ra đầu tiên, nơi query metadata và tenant/resource sở hữu. Không suy ra các
   điều này từ filename hay verb của transport.
2. Tách byte path khỏi metadata path. Xác định stream, staging hay direct transfer và provider
   reference database sẽ giữ.
3. Validate size/content trước khi gán trusted media state. Client MIME, extension và TypeScript type
   không phải bằng chứng content.
4. Sinh storage key và kiểm tra ownership trước provider operation. Key là địa chỉ, không phải quyết
   định authorization.
5. Cấp capability hẹp nhất và ghi rõ expiry/purpose. Preview, download và upload completion là các
   capability khác nhau dù cùng trỏ một object.
6. Map mọi đường thành công, lỗi, retry, abandoned thành lifecycle state và cleanup evidence.
7. Áp dụng độc lập mọi mã phù hợp. Upload có thể đúng `MEDIA-1` nhưng sai `MEDIA-2`; signed URL đúng
   `MEDIA-4` vẫn có thể trỏ orphan sai `MEDIA-5`.

## `MEDIA-1` — byte và metadata có nơi ở riêng

**Situation.** Feature cần giữ file và trả lời câu hỏi owner, size, detected type, checksum, status,
provider, key. Byte stream và các câu hỏi đó có lifecycle và đặc tính scale khác nhau.

**Source phải thể hiện.** Storage port/adapter nhận stream hoặc provider transfer request; entity/record
giữ metadata và provider key/reference opaque. DTO chỉ public media id và metadata được phép, không
public blob hay provider client. Metadata có thể tạo trong transaction; byte transfer được điều phối
bằng pending/finalized state rõ ràng.

**Ranh giới.** Không phải `DATA-*`: data access chọn manager/entity/transaction; mã này quyết định
entity chỉ là metadata. Không phải `TRANSPORT`: resolver download là cửa, không phải nơi chứa storage.
Không phải `MAINTAIN-*`: tách blob khỏi entity là media boundary dù cũng có duplication.

## `MEDIA-2` — size, declared type và detected content phải nhất quán

**Situation.** Client/provider gửi byte cùng filename và MIME. Mỗi giá trị có thể giả, bị cắt hoặc
không nhất quán; chỉ tin declaration có thể biến script, archive bomb hoặc payload quá lớn thành media
được tin.

**Source phải thể hiện.** Boundary giới hạn maximum khi stream hoặc trước cấp buffer; kiểm allowlist
detected media type và đối chiếu detected với declared khi contract yêu cầu. Extension/client MIME
chỉ là metadata. Input sai, mismatch hoặc quá limit đi qua validation/exception contract trước khi
publish record cuối.

**Ranh giới.** Không phải toàn bộ `VALIDATE-*`: validation giữ input contract chung, mã này thêm byte
limit và content sniffing. Không phải `TRANSPORT`: route giới hạn request nhưng không chứng minh content.
Không phải `EXCEPTION-IDENTITY`: identity đặt tên refusal, không quyết định byte unsafe. `PERF-4` có
thể thêm memory/time budget; `MEDIA-2` quyết định content safety.

## `MEDIA-3` — key opaque và ownership được kiểm tra

**Situation.** Service cần chọn provider key và quyết định actor có được dùng media. Filename có
separator, collision, thông tin nhạy cảm; key trông như tenant-scoped vẫn không tự cho quyền.

**Source phải thể hiện.** Key generator phía server tạo key không đoán được với tenant/resource
namespace rõ. Metadata giữ tenant/resource owner. Mọi fetch, replace, delete lấy ownership từ context
tin cậy và check trước provider request. Original filename là display metadata riêng, không nối vào
provider path.

**Ranh giới.** Không phải `NAMING-*`: naming chọn vocabulary source; mã này bảo vệ địa chỉ provider và
ownership. Không phải `AUTHORIZATION-*`: authorization quyết entitlement; mã này bảo đảm media không
bypass bằng cách đưa key. Không phải `DATA-*`: data access persist owner; mã này buộc owner tham gia
mỗi media path.

## `MEDIA-4` — quyền truyền là capability ngắn hạn có scope

**Situation.** Client cần upload/download mà không lộ storage credential hoặc bắt application proxy
mọi transfer lớn.

**Source phải thể hiện.** Backend check ownership/purpose rồi cấp signed URL/capability có expiry ngắn,
đúng một object/key, method và content constraint. Completion verify object trước mark ready; capability
không được coi là proof state application đã finalize. Cấm ACL public, URL vĩnh viễn và account-wide
credential trong request.

**Ranh giới.** Không phải `TRANSPORT`: transport expose endpoint mint/consume; mã này định scope/lifetime.
Không phải `AUTHORIZATION`: entitlement check trước mint, capability mới constrain provider transfer.
Không phải `EXCEPTION-IDENTITY`: capability hết hạn cần failure code ổn định, nhưng status/message không
phải capability.

## `MEDIA-5` — mọi object có lifecycle owner

**Situation.** Transfer lỗi sau provider create, client bỏ pending upload hoặc replacement để object cũ
ở lại. Một database row không thể tự cleanup provider bytes.

**Source phải thể hiện.** Metadata có pending/ready/deleting/deleted hoặc state tương đương. Finalization
idempotent và verify object trước ready. Replacement/delete ghi old key để xoá; scheduled reconciler
chỉ list tenant/prefix scope đã khai báo và xoá object không có metadata sống sau safety window. Retry
an toàn; cleanup failure observable, không lặng lẽ xoá audit trail.

**Ranh giới.** Không phải `DATA-4`: metadata transaction có thể atomic nhưng provider side effect cần
outbox/reconciler. Không phải `MAINTAIN-*`: state lifecycle là ownership external resource, không phải
refactoring preference. `TESTING-*` chứng minh crash/retry/orphan, không định nghĩa lifecycle.

## Layer held

| Code | Tier | Được giữ bởi |
|---|---|---|
| `MEDIA-1` | `documented` | Review storage/data-flow; blob placement và metadata ownership đi qua provider/database |
| `MEDIA-2` | `documented` | Boundary và byte-fixture tests; content safety phụ thuộc limit/config/provider/parser |
| `MEDIA-3` | `documented` | Authorization/data-flow review và tenant-isolation tests; AST một file không chứng minh ownership |
| `MEDIA-4` | `documented` | Capability contract tests và provider configuration review |
| `MEDIA-5` | `documented` | Lifecycle/reconciliation integration tests; crash/retry không thấy được trong một file |

## Inputs

| Input | Bằng chứng bắt buộc |
|---|---|
| byte path | Stream, staging, provider adapter và maximum transfer size |
| metadata | Database fields, nguồn checksum/type và public projection |
| ownership | Tenant/resource identity và authorization decision cho từng operation |
| capability | Method, key, purpose, constraints, expiry và completion verification |
| lifecycle | Pending, ready, replacement, delete, retry và orphan reconciliation |
| failures | Validation, authorization, provider và cleanup identity ổn định |

## Rules

1. Byte ở provider, metadata ở database; entity không là blob cache.
2. Giới hạn size trước buffering không giới hạn và validate detected content, không chỉ extension/header.
3. Sinh key opaque theo tenant; không dùng filename user làm provider address.
4. Check ownership trước provider access và trước khi cấp capability.
5. Signed capability ngắn hạn, một purpose và bị giới hạn đúng object.
6. Model pending/finalized/deleted; finalization, deletion, reconciliation idempotent.
7. Giữ transport, data access, naming, exception identity, maintainability, testing ở module riêng;
   ghép quyết định thay vì chép lại.
8. Mọi file/media operation resolve mọi situation phù hợp; nhỏ hay internal không được miễn.

## Exceptions

- **Inline asset nhỏ.** Asset immutable, bounded và có deployment lifecycle làm product contract có thể
  nằm trong package/config; vẫn phải đạt `MEDIA-2` và không nhầm với runtime media của tenant.
- **Application proxy.** Route có thể stream qua app vì audit, virus scan hoặc range; vẫn dùng `MEDIA-3`,
  `MEDIA-4`, resource budget; proxy không cấp quyền lộ credential.
- **Provider detected type.** Provider scan đáng tin có thể cấp detected type nếu provenance/failure được
  ghi; client declaration vẫn không authoritative.
- **Xoá ngay.** Synchronous delete hợp lệ nếu provider có semantics transactional; nếu không `MEDIA-5`
  cần tombstone/reconciler retryable.

## Stops

Dừng trước source khi chưa biết byte/metadata ở đâu, thiếu max size hoặc authority của detected type,
không gọi tên được ownership, capability thiếu purpose/expiry, hoặc chưa có câu trả lời provider failure
và orphan cleanup. Dừng nếu proof chỉ là extension, public URL, database row hoặc happy-path upload test.

## Proof

| Code | Proof tối thiểu |
|---|---|
| `MEDIA-1` | Integration test chứng minh database chỉ giữ metadata/reference, byte còn ở provider; API không có blob |
| `MEDIA-2` | Fixture test reject oversized, mismatch, malformed và disallowed content trước finalization |
| `MEDIA-3` | Tenant-isolation test chứng minh tenant/key/filename khác không read, replace, delete được |
| `MEDIA-4` | Contract test chứng minh method/key/purpose/expiry constraint và reject expired/replay/broad capability |
| `MEDIA-5` | Failure/retry/reconciliation test chứng minh không orphan vĩnh viễn và delete/finalize idempotent |

## Output

```text
bytes:      <provider/stream/staging path>
metadata:   <database record và public projection>
owner:      <tenant/resource identity và check>
capability: <method, key, purpose, constraints và expiry>
lifecycle:  <pending/ready/delete/reconcile states>
situation:  <MEDIA-1 | MEDIA-2 | MEDIA-3 | MEDIA-4 | MEDIA-5>
verdict:    <holds | violates | stop>
reason:     <fact về byte, validation, ownership, capability hoặc lifecycle>
proof:      <test hoặc provider evidence>
```

## Scope

Pattern này quản lý byte file/media, content safety, tenant ownership, transfer capability và
provider-object lifecycle. Nó không chọn transport route, database handle/transaction, source naming,
exception wire identity, refactoring shape chung hoặc test-lane mechanics; các phần đó thuộc
`transport`, `data-access`, `naming`, `exception-identity`, `maintainability`, `testing`.
