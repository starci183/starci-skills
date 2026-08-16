---
id: be-patterns-cdc-vi
title: vi.md
slug: /be/patterns/cdc/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống CDC-N, nhận diện bằng nghiệp vụ chứ không bằng tên file.
---

# vi.md

> Version: `2.00` · Module: `cdc`

# CDC

CDC biến **một dòng đã commit trong database** thành **một read projection được tính lại**. Listener
không phát lại business command, không cộng thêm một delta thứ hai; nó dịch một thay đổi dữ liệu
thành **danh tính** của projection, rồi dựng lại projection đó từ nguồn sự thật.

Câu hỏi quyết định, cần đặt ra trước mọi câu hỏi khác, là:

> Xử lý **đúng một dòng thay đổi đó hai lần** thì projection có ra cùng một kết quả không?

Nếu không — đoạn code đang viết không phải CDC projection, dù nó nằm trong file có tên
`*projection.listener.ts`, dù nó subscribe đúng topic.

**Đây là luật bắt buộc.** Mọi projection listener đều rơi vào các mã dưới đây; không có projection
nào nhỏ đến mức được miễn. Lý do luật xoay quanh **replay** chứ không xoay quanh "chạy đúng ở lần
giao đầu tiên": broker chỉ hứa *at-least-once*. Giao trùng không phải sự cố cần xử lý, nó là **hợp
đồng**. Code chỉ đúng khi mỗi message tới đúng một lần là code đang giả định một bảo đảm chưa ai
từng cấp cho nó.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Điều bắt buộc |
|---|---|---|
| `CDC-1` | Một projection mới cần nghe Kafka | Kế thừa base dùng chung, không tự dựng consumer |
| `CDC-2` | Projection cần biết mình là ai và nghe những bảng nào | `groupId` cố định + `topics` liệt kê đủ |
| `CDC-3` | Một dòng đổi → phải tính lại cái gì | Listener định tuyến, service tính lại |
| `CDC-4` | Tính lại con số của projection | UPSERT từ nguồn, không cộng delta của event |
| `CDC-5` | Một dòng nguồn bị xoá | Bỏ qua tombstone, không dựng ra một dòng rỗng |
| `CDC-6` | Một message hỏng giữa dòng | Log kèm topic + group, cô lập đúng message đó |
| `CDC-7` | Chứng minh CDC chạy thật | E2E đẩy qua broker thật rồi chờ projection trong DB |

---

## `CDC-1` — vòng đời Kafka thuộc về base dùng chung

**Tình huống.** Bạn thêm một projection mới. Nó cần kết nối, cần subscribe, cần parse envelope
Debezium, cần biết làm gì khi một message hỏng. Bốn thứ đó **không** phải việc của projection này —
đã có nơi phụ trách.

**Dấu hiệu nhận biết**

- Trong file listener xuất hiện `onModuleInit`, `consumer.run`, `subscribe`, hoặc `JSON.parse` một
  message.
- Listener tự inject một client Kafka thay vì nhận qua constructor của base.
- Trong file có một `try/catch` quyết định "message hỏng thì làm gì".

**Tự hỏi.** Nếu ngày mai đổi cách parse envelope, tôi phải sửa **một** chỗ hay **mười bảy** chỗ?

**Ranh giới**

- ↔ `CDC-2`: `CDC-1` nói *ai sở hữu* việc kết nối; `CDC-2` nói *khai báo cái gì* để kết nối đó có
  danh tính. Kế thừa đúng base mà `groupId` sinh ngẫu nhiên thì `CDC-1` đạt, `CDC-2` gãy.
- ↔ `CDC-6`: cô lập lỗi là **hành vi** của base. Nếu một listener tự viết `try/catch` cho message,
  nó đã vi phạm `CDC-1` trước khi kịp bàn tới `CDC-6`.

**Tình huống nghiệp vụ hay gặp.** Thêm projection thống kê khoá học · thêm projection điểm người
dùng · tách một projection cũ thành hai · một projection cần thêm topic thứ ba.

---

## `CDC-2` — danh tính consumer và tập nguồn phải khai báo rõ

**Tình huống.** `groupId` là **danh tính bền vững** của consumer projection này; `topics` là **tập nguồn
đầy đủ** có thể làm projection sai. Cả hai đều được viết ra, không được suy ra lúc chạy.

**Dấu hiệu nhận biết**

- `groupId` là một chuỗi hằng, đọc lên là biết projection nào.
- `topics` liệt kê từng bảng nguồn; prefix có thể lấy từ env, **danh sách bảng thì không**.
- Không có `randomUUID()`, không có `Date.now()`, không có tên instance trong `groupId`.

**Tự hỏi.** Restart tiến trình này 100 lần thì consumer group vẫn là **một** group, hay thành 100
group mỗi group replay lại toàn bộ lịch sử?

**Ranh giới**

- ↔ `CDC-1`: xem trên.
- ↔ `CDC-4`: group ngẫu nhiên **cộng với** recompute idempotent thì không sai số liệu, chỉ tốn tài
  nguyên khủng khiếp. Group ngẫu nhiên **cộng với** cộng delta thì sai số liệu ngay lần restart đầu.
  Hai mã hỏng theo hai kiểu khác nhau và phải được sửa riêng.

**Tình huống nghiệp vụ hay gặp.** Deploy nhiều replica cùng đọc một projection · thêm một bảng nguồn
mới mà quên khai báo topic · đổi tên bảng nguồn · chạy cùng listener ở môi trường staging và prod
với prefix topic khác nhau.

---

## `CDC-3` — listener định tuyến, service tính lại

**Tình huống.** `deriveTargets` đọc dòng vừa đổi và trả về **danh tính** của những projection bị ảnh
hưởng. `recomputeTarget` giao việc tính lại cho projection service. Listener sở hữu **định tuyến**,
không sở hữu **chính sách SQL**.

**Dấu hiệu nhận biết**

- `deriveTargets` chỉ đọc, phân nhánh theo topic, và trả về id (hoặc mảng rỗng).
- `recomputeTarget` gọi đúng một hàm của service và không làm gì khác.
- Không có `save`, `insert`, `emit`, `sendMail`, `publish` nào trong listener.

**Tự hỏi.** Nếu replay lại 10.000 message cũ, có hiệu ứng nào **ngoài projection** xảy ra không? Nếu
có — đó là business command nằm nhầm chỗ.

**Ranh giới**

- ↔ `CDC-4`: `CDC-3` nói *ai gọi*; `CDC-4` nói *hàm được gọi tính toán thế nào*. Uỷ quyền đúng cho
  service nhưng service lại `increment` thì `CDC-3` đạt, `CDC-4` gãy.
- ↔ `CDC-5`: trả về mảng rỗng vì không phân giải được cha là **đúng** `CDC-3`, không phải né tránh.

**Tình huống nghiệp vụ hay gặp.** Một bài nộp đổi trạng thái phải tính lại tiến độ khoá học · một
dòng ledger điểm phải tính lại tổng điểm · một review mới phải tính lại điểm trung bình · một dòng
ghi danh phải tính lại cả tiến độ lẫn quyền truy cập.

---

## `CDC-4` — tính lại từ nguồn, không cộng delta

**Tình huống.** Projection được dựng lại bằng một **UPSERT** từ các dòng nguồn có thẩm quyền. Nó không
bao giờ được cập nhật bằng cách cộng con số mà event mang theo.

**Dấu hiệu nhận biết**

- Hàm recompute nhận **id**, không nhận `amount`, `delta`, `points`.
- SQL có `SUM(...)`/`COUNT(...)` trên bảng nguồn và kết bằng `ON CONFLICT ... DO UPDATE`.
- Chạy lại hàm đó ba lần liên tiếp cho ra ba kết quả giống nhau.

**Tự hỏi.** Nếu broker giao **trùng** một message, con số có nhân đôi không? Nếu broker **mất** một
message, con số có tự lành ở lần thay đổi kế tiếp không? Hai câu phải là *không* và *có*.

**Ranh giới**

- ↔ `CDC-3`: xem trên.
- ↔ `CDC-6`: nuốt một message hỏng chỉ **an toàn** vì `CDC-4` đúng. Nếu recompute không idempotent
  thì mỗi lần nuốt là một sai số vĩnh viễn, và `CDC-6` biến từ cơ chế tự lành thành cơ chế mất dữ
  liệu im lặng.

**Tình huống nghiệp vụ hay gặp.** Tổng điểm người dùng · số học viên của một khoá · điểm trung bình
review · số bài đã hoàn thành · streak · bảng xếp hạng theo nhóm · số lượt tương tác của một nội
dung.

---

## `CDC-5` — tombstone không dựng ra trạng thái hiện tại

**Tình huống.** Một payload Debezium **không có ảnh `after`** thì không có dòng hiện tại nào để ánh
xạ. Base bỏ qua nó. Projection nào thật sự cần sửa chữa khi xoá thì phải lấy danh tính từ **một
nguồn còn được giữ lại**, hoặc từ một deletion stream dựng riêng.

**Dấu hiệu nhận biết**

- Code đọc `payload.after` mà không kiểm `null`.
- Có chỗ ép kiểu một tombstone thành entity rỗng rồi ghi cái rỗng đó xuống.
- Có comment kiểu "xoá rồi thì coi như 0".

**Tự hỏi.** Cái danh tính tôi đang dùng để ghi lấy ở đâu ra, khi dòng nguồn **không còn tồn tại**?

**Ranh giới**

- ↔ `CDC-3`: mảng rỗng vì "cột này đổi nhưng không liên quan" là `CDC-3`; mảng rỗng vì "không có ảnh
  `after`" là `CDC-5`. Cả hai đều đúng, nhưng chúng là hai lý do khác nhau và bị hỏng theo hai cách
  khác nhau.
- ↔ `CDC-4`: ghi số 0 cho một dòng đã xoá vẫn là ghi **suy ra từ event**, không phải từ nguồn. Nó
  hỏng cả hai mã cùng lúc.

**Tình huống nghiệp vụ hay gặp.** Huỷ ghi danh · gỡ một nội dung khỏi khoá học · xoá một review · gỡ
ghim một dự án · rời khỏi một nhóm.

---

## `CDC-6` — một message hỏng không giết consumer

**Tình huống.** Lỗi parse hoặc lỗi recompute được log kèm **topic** và **consumer group**, chỉ
ảnh hưởng đúng message đó. Consumer không dừng.

**Dấu hiệu nhận biết**

- `catch` bọc quanh việc xử lý **một** message, không bọc quanh cả vòng lặp.
- Log có đủ `groupId` và `topic` — thiếu một trong hai thì không lần ra được.
- Không `throw` ngược ra ngoài handler.

**Tự hỏi.** Một dòng dữ liệu bẩn ở bảng nguồn có làm **toàn bộ** projection ngừng cập nhật không?

**Ranh giới**

- ↔ `CDC-1`: hành vi này **nằm trong base**. Một listener tự viết cơ chế cô lập lỗi đang vi phạm
  `CDC-1`.
- ↔ `CDC-4`: nuốt lỗi chỉ hợp lệ khi recompute idempotent. Xem trên.

**Tình huống nghiệp vụ hay gặp.** Connector đổi cấu hình SMT giữa chừng · một cột đổi kiểu · một
dòng có JSON không hợp lệ · database tạm thời từ chối kết nối khi recompute.

---

## `CDC-7` — chứng minh bằng broker thật

**Tình huống.** Một E2E vận hành **đẩy qua Kafka thật** rồi **chờ projection trong database**. Việc gọi
thẳng `deriveTargets`, `recomputeTarget` hay một method của listener chỉ chứng minh code ánh xạ, chứ
không chứng minh CDC.

**Dấu hiệu nhận biết**

- Bước ARRANGE ghi dòng nguồn trực tiếp, **không** gọi projection service.
- Bước ACT chỉ chạm vào broker.
- Bước ASSERT poll bảng projection cho tới khi đúng, có timeout.

**Tự hỏi.** Nếu tôi khai sai `groupId`, hoặc quên một topic, bài test này có đỏ không? Nếu không —
bài test đang đo mapping, không đo CDC.

**Ranh giới**

- ↔ `CDC-3`: unit test cho `deriveTargets` là **hợp lệ** và hữu ích. Nó chỉ không được tính là bằng
  chứng CDC.
- ↔ `CDC-2`: đây là bài test duy nhất phát hiện được lỗi `CDC-2`, vì một `groupId` sai hoặc một
  topic thiếu chỉ lộ ra khi có broker thật ở giữa.

**Tình huống nghiệp vụ hay gặp.** Thêm projection mới · đổi tập topic của một projection cũ · nâng
cấp connector · đổi prefix topic giữa các môi trường · gộp hai projection thành một.

---

## Luật

1. Xử lý cùng một dòng thay đổi hai lần phải ra cùng một projection.
2. Base sở hữu kết nối, subscribe, parse envelope và cô lập lỗi.
3. `groupId` là hằng số; `topics` là tập nguồn đầy đủ, viết ra rõ ràng.
4. `deriveTargets` chỉ trả về danh tính và **không** gây side effect nghiệp vụ.
5. Projection được ghi bằng UPSERT từ dòng nguồn, không bằng delta của event.
6. Payload không có ảnh hiện tại thì không sinh ra lệnh ghi nào.
7. Một message lỗi ảnh hưởng đúng một message.
8. Một tuyên bố về CDC phải được chứng minh qua broker, hoặc nó không phải tuyên bố về CDC.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
dụng vào.

- **Boot best-effort (`CDC-1`).** Subscribe thất bại lúc khởi động thì log rồi nuốt, không làm sập
  tiến trình — broker chết không được kéo API chết theo. Đây là ngoại lệ về **tính sẵn sàng**, không
  phải về quyền sở hữu: chỗ nuốt nằm trong base, listener cụ thể vẫn không được có vòng đời riêng.
- **Đọc trong `deriveTargets` (`CDC-3`).** Phân giải cha — bài nộp → milestone, nội dung → khoá học
  — là thao tác **đọc** và được phép, vì ánh xạ một dòng sang danh tính đôi khi cần đi qua đồ thị
  quan hệ. **Ghi** trong `deriveTargets` thì không bao giờ được phép; phép thử là replay có lặp lại
  hiệu ứng không.
- **Trả về mảng rỗng (`CDC-3`, `CDC-5`).** Rỗng là câu trả lời đúng cho một cột đổi không liên quan,
  một cha không phân giải được, hoặc một lệnh xoá. Bịa ra một target để tránh trả về rỗng thì không.
- **Projection thật sự cần xử lý xoá (`CDC-5`).** Tiêu thụ một nguồn còn giữ lại danh tính, hoặc một
  deletion stream dựng riêng. Đọc key của tombstone rồi coi sự vắng mặt là số 0 bị từ chối **kể cả
  khi** số 0 đó tình cờ đúng ở thời điểm hiện tại.
- **Unit test cho mapping (`CDC-7`).** Gọi thẳng `deriveTargets` là một bài test hợp lệ. Nó chỉ bị
  từ chối khi được dùng làm **bằng chứng CDC** — một E2E qua broker vẫn còn nợ, bất kể đã có bao
  nhiêu unit test.
