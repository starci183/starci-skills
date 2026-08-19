---
title: Concurrency · Vietnamese
---

# Đồng thời

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |

## Bản ghi

Đầu vào là một shape đã được duyệt, trong đó có một sự thật có thể thay đổi và từ hai actor trở lên
có thể đọc hoặc sửa nó cùng lúc: số dư, token, membership, quota, chuyển trạng thái hay một claim
duy nhất. Pattern này không chọn business outcome. Nó quyết định biên của trạng thái tranh chấp nằm ở
đâu, primitive database nào chứng minh nó, và cuộc đua được làm cho lộ ra thế nào.

## Luật

Concurrency là thuộc tính đúng đắn, không phải chi tiết hiệu năng. Một lần đọc, quyết định rồi ghi
chỉ là một operation logic khi các actor cạnh tranh không thể chen vào để tạo trạng thái sai. Source
phải gọi tên một owner cho trạng thái tranh chấp: transaction có lock hoặc isolation, hoặc
compare-and-set (CAS) theo version làm cho bên thua nhìn thấy được.

Câu hỏi quyết định là: **điều gì khiến hai actor không thể cùng thắng?** Mutex trong một process không
phải câu trả lời khi có thể có hai replica. Retry loop không phải câu trả lời khi operation đã tạo
external effect. Unique constraint có thể là hàng rào cuối cho identity, nhưng tự nó không serialize
một invariant đọc-sửa-ghi.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi operation có thể race đều mang các tình huống
phù hợp bên dưới. Mã là identity cố định, không phải thang mức độ. Một lựa chọn đúng thường dùng
nhiều mã: `CONCURRENCY-1` gọi tên state tranh chấp, `CONCURRENCY-2` gọi tên CAS nếu phù hợp,
`CONCURRENCY-3` gọi tên hợp đồng lock/isolation, và `CONCURRENCY-4` chứng minh quyết định dưới
overlap thật.

## Mã tình huống

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `CONCURRENCY-1` | Hai actor có thể sửa cùng một state mang invariant | Một owner là transaction/lock hoặc một state transition nguyên tử bao trùm đọc, quyết định và ghi. Cấm: check-then-act qua các câu autocommit rời, process-local mutex là hàng rào duy nhất, hoặc state sau cùng do caller cung cấp |
| `CONCURRENCY-2` | Reader cũ có thể thử ghi | Đọc version/updated-at rồi đưa token đó vào conditional update; zero affected rows trở thành conflict có tên, không phải thành công im lặng hay retry vô hạn |
| `CONCURRENCY-3` | Implementation chọn lock bi quan hoặc isolation | Ghi rõ lock mode, isolation, lock key, lifetime của transaction và kết quả deadlock/timeout. Cấm: giữ lock ngoài transaction, table-wide lock cho invariant một row, hoặc lock không có policy thất bại có giới hạn |
| `CONCURRENCY-4` | Race cần được chứng minh | Test khởi động các actor cạnh tranh từ một barrier, dùng persistence/transaction thật, assert invariant và kết quả bên thua, không có sleep theo thời gian hay gọi tắt handler |

Bốn mã, và dừng ở bốn. Tình huống mới là một thay đổi luật được ghi lại, không phải mã thứ năm thêm
vào vì một concern gần giống.

## Đọc một shape đã duyệt

1. Đọc invariant nghiệp vụ đã chốt: điều gì chỉ được xảy ra một lần, tổng nào không được vượt, hoặc
   chuyển trạng thái nào là hợp lệ.
2. Đọc những gì shape để mở: contention key, owner của transaction, trường version, primitive lock
   và conflict contract là đầu vào, không được đoán.
3. Giải quyết từ ngoài vào trong. Gọi tên state tranh chấp (`CONCURRENCY-1`), chọn CAS hay lock
   (`CONCURRENCY-2`/`CONCURRENCY-3`), rồi viết race proof (`CONCURRENCY-4`).
4. Hỏi: nếu hai request cùng đọc giá trị cũ, cả hai có commit được không? Bên thua có biết phải
   refresh, báo conflict hay retry an toàn không? Lock chờ thì cái gì giải phóng nó?
5. Các mã cùng áp dụng. CAS có thể thỏa `CONCURRENCY-1` và `-2` nhưng vẫn cần `-4`; lock đúng
   nhưng không có timeout có giới hạn thì thỏa `-1` mà vi phạm `-3`. Không gộp thành một block.

## `CONCURRENCY-1` — một owner bao trùm quyết định tranh chấp

**Tình huống.** Hai actor có thể nhìn thấy cùng state trước khi một trong hai ghi.

**Source phải sinh ra.** Một transaction callback hoặc một câu SQL nguyên tử làm chủ việc đọc,
quyết định và ghi. Row/advisory lock, serializable unit hoặc conditional update phải nhìn thấy ở
biên đó. Domain service nhận state hoặc manager có thẩm quyền; không nhận post-state do caller tự
chọn.

**Dấu hiệu nhận biết.** `findOne()` rồi `save()` ở statement sau mà không có transaction; `Mutex`
trong memory ở service chạy nhiều replica; `if (remaining > 0) remaining--` trong application
memory; comment "request thường chạy tuần tự".

**Ranh giới.** Không phải `DATA-4`: `DATA-4` hỏi các write phải cùng sống/chết có dùng transactional
manager hay không; mã này hỏi actor cạnh tranh có thể làm quyết định mất hiệu lực hay không. Một
transaction có thể truyền manager đúng mà vẫn bị lost update. Không phải `IDEMP-2`: idempotency chặn
command lặp cùng key, không phân xử hai command hợp lệ khác nhau. Không phải `DELIVERY-4` hay
`CDC-4`: claim/dedupe message là concern transport/projection, không phải invariant của row. Không
phải async retry: retry quyết định thử lại sau failure, không làm lần đọc-sửa-ghi đầu tiên nguyên tử.

## `CONCURRENCY-2` — writer cũ phải thua một cách nhìn thấy được

**Tình huống.** Actor tính kết quả từ version `v`, nhưng actor khác đã commit `v+1` trước lúc nó ghi.

**Source phải sinh ra.** `UPDATE ... WHERE id = ? AND version = ?`, repository condition tương
đương, hoặc CAS native của database; phải kiểm tra affected-row count. Zero row map thành conflict/
refresh có type, không thành success và không blind retry vô hạn.

**Dấu hiệu nhận biết.** Có select `version` nhưng predicate update không có version; code overwrite
giá trị mới hơn; catch block retry object cũ mãi; caller không phân biệt conflict với not-found.

**Ranh giới.** Không phải `CONCURRENCY-3`: CAS là policy optimistic; lock/isolation là lựa chọn biên
transaction hoặc pessimistic. Không phải `DATA-4`: truyền manager không tự tạo version predicate.
Không phải async retries: retry có thể đọc lại và tính lại có chủ đích, nhưng chỉ sau khi conflict đã
được biểu đạt và có giới hạn.

## `CONCURRENCY-3` — lock và isolation là một hợp đồng có giới hạn

**Tình huống.** Operation dùng lock hoặc isolation để bảo vệ row/key tranh chấp.

**Source phải sinh ra.** Ghi chính xác lock (`FOR UPDATE`, advisory key, serializable transaction),
scope, timeout/deadlock mapping và điểm release. Lock key ổn định và đủ hẹp cho invariant. Việc
không cần lock nằm ngoài lock; không gọi network provider khi đang giữ database lock.

**Dấu hiệu nhận biết.** Lấy lock không có transaction; process-local lock giữa nhiều replica; table
lock để bảo vệ một account; provider call nằm trong lock; swallow timeout hoặc retry vô hạn.

**Ranh giới.** Không phải `CONCURRENCY-1`: `-1` nói có owner; `-3` nói owner hoạt động và thất bại
thế nào. Không phải `DATA-4`: transactional manager phải được truyền, còn mã này chọn lock và thời
gian giữ. Không phải `IDEMP-2`: durable idempotency claim là key/record riêng, không gọi nó là lock.
Không phải `DELIVERY-4`/`CDC-4`: claim/dedup của chúng ở boundary giao message hoặc projection.

## `CONCURRENCY-4` — test tạo overlap, không kể một câu chuyện về overlap

**Tình huống.** Race là defect đang được bảo vệ và phải lặp lại được.

**Source phải sinh ra.** Concurrency/e2e spec tạo hai actor thật, thả chúng qua cùng barrier, await
cả hai kết quả rồi đọc authoritative row. Assert invariant, đúng một winner khi cần, và kết quả
conflict/loser có type. Chỉ dùng deadline/poll có giới hạn cho async settlement thật; `sleep(10)` không
phải synchronization.

**Dấu hiệu nhận biết.** Spec gọi thẳng handler; mock transaction của repository; chạy request tuần tự;
chỉ assert call count; hoặc pass vì một fixed delay tình cờ làm hai actor không đụng nhau.

**Ranh giới.** Không phải `TESTING-5`/`TESTING-6`: branch coverage và assertion return value hữu ích
nhưng không chứng minh overlap. Không phải `TESTING-3`/`E2E-11`: flow qua transport thật có thể là
outer lane, còn mã này bắt buộc competing actors và persisted state. Không phải `IDEMP-5`: idempotency
proof lặp cùng logical key/effect; proof này dùng state transition cạnh tranh, thường là command khác
nhau. Không phải async retry: retry có thể che race nếu không assert outcome đồng thời trước recovery.

## Tầng giữ

| Mã | Tầng | Thứ giữ mã |
|---|---|---|
| `CONCURRENCY-1` | `documented` | operation/service và biên transaction hoặc SQL nguyên tử |
| `CONCURRENCY-2` | `documented` | conditional repository/query write và conflict mapping |
| `CONCURRENCY-3` | `documented` | database lock/advisory-lock helper và transaction owner |
| `CONCURRENCY-4` | `documented` | concurrency/e2e spec; lint không suy ra được ý định interleaving |

Cả bốn đều là documented vì dữ kiện quyết định đi qua call graph, database plan và test
orchestration. Filename hay AST rule không biết transaction có bảo vệ đúng invariant hay không. Đó
là khoảng trống trung thực, không phải quyền bỏ proof.

## Neo

| Mã | Neo | Tìm gì |
|---|---|---|
| `CONCURRENCY-1` | `src/modules/databases/postgresql/primary/lock/postgresql-advisory-lock.service.ts` | advisory lock ổn định và release trên database session |
| `CONCURRENCY-2` | `src/tests/e2e/refresh-token-concurrency.e2e-spec.ts` | hai lần refresh và một outcome token authoritative, conflict/reuse nhìn thấy được |
| `CONCURRENCY-3` | `src/modules/databases/postgresql/primary/lock/postgresql-advisory-lock.service.ts` | acquisition ở connection database thay vì mutex trong process |
| `CONCURRENCY-4` | `src/tests/e2e/community-concurrency.e2e-spec.ts` | production request đồng thời và assert invariant persisted, không gọi handler trực tiếp |

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| invariant | Giá trị, quota, transition hoặc uniqueness rule phải sống qua overlap |
| contenders | Hai hay nhiều operation/actor có thể chạy cùng lúc |
| owner | Transaction, lock, isolation hoặc CAS và key chính xác |
| conflict | Kết quả có type cho actor cũ hoặc actor thua |
| proof | Test dùng barrier và đọc lại authoritative state |

## Quy tắc

1. Mọi read-modify-write tranh chấp có một owner nhìn thấy được ở database.
2. Optimistic write mang đúng version đã đọc và kiểm tra affected-row count.
3. Lock gọi tên key, mode, scope, timeout và điểm release.
4. Không chạy external effect khi đang giữ database lock, trừ khi shape đã duyệt gọi đó là một phần
   của lock contract.
5. Race proof overlap actor thật và assert persisted state, không assert timing hay collaborator call.
6. Idempotency, delivery/CDC dedupe và async retry vẫn là boundary riêng.

## Ngoại lệ

- **Single writer do kiến trúc.** `CONCURRENCY-1` có thể thỏa bằng durable single-writer queue chỉ
  khi ownership và restart/replay semantics của queue được gọi tên; event loop local không phải
  single writer bền vững.
- **Database operation vốn nguyên tử.** `INSERT ... ON CONFLICT`, guarded `UPDATE` hoặc unique
  constraint có thể bảo vệ invariant mà không cần lock riêng. Khi outcome quan trọng vẫn cần
  `CONCURRENCY-4`.
- **Retry conflict có chủ đích.** `CONCURRENCY-2` cho phép một retry có giới hạn sau fresh read và
  chỉ khi business operation an toàn để tính lại. Conflict không được biến thành im lặng.
- **Integration world tập trung.** `CONCURRENCY-4` có thể boot module graph rút gọn, nhưng persistence,
  transaction boundary và actor cạnh tranh vẫn phải thật.

## Đầu ra

```text
operation: <mutation | query | job | webhook | scheduler>
invariant: <state hoặc rule phải sống qua overlap>
situation: <CONCURRENCY-1 … CONCURRENCY-4>
owner: <transaction | row lock | advisory lock | isolation | CAS>
conflict: <typed loser outcome, hoặc not applicable>
proof: <barrier-driven test và authoritative read-back>
reason: <sự thật loại trừ mã lân cận>
```

## Ví dụ hoàn chỉnh

**Shape đã duyệt.** Hai session thử refresh cùng token. Outcome chốt là một refresh hợp lệ và một
kết quả reuse/conflict rõ ràng.

```text
operation: mutation
invariant: một refresh-token family không thể bị consume hai lần
situation: CONCURRENCY-1
owner: database transaction theo token family
conflict: refresh-token-reuse
proof: refresh-token-concurrency.e2e-spec.ts thả hai request qua một barrier và đọc family row
reason: hai request khác nhau tranh chấp một state transition, nên idempotent replay không phải concern quyết định
```

## Phạm vi

Pattern này áp dụng cho backend chia sẻ mutable state giữa request, worker, job hoặc replica. Nó gọi
tên coordination nhìn thấy ở database và proof của nó; không áp đặt ORM, queue hay database vendor.
