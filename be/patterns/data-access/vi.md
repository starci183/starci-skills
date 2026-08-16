---
id: be-patterns-data-access-vi
title: vi.md
slug: /be/patterns/data-access/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống DATA-N, nhận diện bằng nghiệp vụ chứ không bằng thói quen gõ code.
---

# vi.md

> Version: `2.00` · Module: `data-access`

# Data access

Mọi lần chạm vào dữ liệu đều đi qua một `EntityManager`, được tiêm bằng một
decorator **gọi tên datasource** mà nó thuộc về. Ở đây không có repository injection, cũng không có
connection mặc định ngầm: cả hai đều là những cái tay cầm **trông giống hệt nhau** dù đang trỏ vào
database nào, mà ứng dụng này thì có nhiều hơn một database.

Toàn bộ luật bắt nguồn từ một tính chất duy nhất. `EntityManager` là **một đơn vị công việc có thể truyền
đi** — đưa cho helper, bọc vào transaction, đánh tráo bằng bản transactional — còn repository thì
không, vì nó bị buộc vào một entity duy nhất suốt đời.

Câu hỏi duy nhất phân định:

> Thao tác này **có thể mọc thêm một lệnh ghi thứ hai** không?

Gần như luôn luôn có thể. Một tay cầm không mang nổi transaction sang lệnh ghi thứ hai thì nó
đã sai **ngay từ đầu**, chứ không phải sai vào cái ngày lệnh ghi thứ hai xuất hiện. Cái giá không
nằm ở lúc chọn sai, mà nằm ở lúc phải viết lại — và module nào phát hiện ra trước sẽ phải gánh lần
viết lại đó.

**Đây là luật bắt buộc.** Không có thao tác nào nhỏ đến mức được miễn khai báo mã. Đọc một dòng vẫn
là `DATA-1` đúng cùng lý do mà tất toán một đơn hàng là `DATA-1`. Câu "có mỗi một bảng thôi mà" là
chỗ luật này bị bỏ qua nhiều nhất, bởi vì bảng thứ hai đến sau, và lúc nó đến thì tay cầm đã sai rồi.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `DATA-1` | Đang tiêm handle vào constructor: chỗ này chạm database nào? | Decorator gọi tên datasource |
| `DATA-2` | Đang chọn hình dáng của handle | `EntityManager`, không bao giờ repository |
| `DATA-3` | Đang khai một entity mới, hoặc sắp đổi tên một class entity | `@Entity("tên_bảng")` |
| `DATA-4` | Nhiều lệnh ghi phải cùng sống hoặc cùng chết | Một transaction, manager **truyền vào** |
| `DATA-5` | Câu trả lời này để làm gì, và ai trả giá cho nó | Relation khai ở call site |

---

## `DATA-1` — handle phải nói nó trỏ vào database nào

**Tình huống.** Bạn viết constructor cho một service, một handler hoặc một cron để chạm vào dữ liệu.
Kiểu `EntityManager` **không** nói gì về connection: manager của database chính và manager của một
bản replica phân tích hay một sandbox là **cùng một kiểu**.

**Dấu hiệu nhận biết**

- Trong constructor có một tham số kiểu `EntityManager` mà không có decorator nào đứng trước.
- Đọc file từ trên xuống dưới không tìm được một chữ nào nói đây là database nào.
- Wiring của module thì đúng, nên code chạy — cho tới hôm ai đó đổi provider mặc định.

**Tự hỏi.** Người đọc file này lần đầu, muốn biết "chỗ này ghi vào database nào", họ sẽ tìm ở đâu?
Nếu câu trả lời không phải là **chính dòng tiêm này** thì đây là `DATA-1` đang bị vi phạm.

**Ranh giới**

- ↔ `DATA-2`: `DATA-1` nói handle **không khai** nó trỏ vào đâu; `DATA-2` nói handle **sai hình
  dáng** dù nó trỏ đúng vào đâu. Một `@InjectRepository` được viết rất tử tế vẫn hỏng cả hai; một
  `EntityManager` trần chỉ hỏng cái thứ nhất.
- ↔ `DATA-4`: `DATA-1` xét **chỗ tiêm**, `DATA-4` xét **chỗ dùng**. Tiêm đúng vẫn có thể dùng sai
  bằng cách gọi manager của mình trong khi người gọi đang mở transaction.

**Tình huống nghiệp vụ hay gặp.** Service nghiệp vụ mới · cron chạy nền · projection đọc từ CDC ·
seeder · guard cần tra quyền · job xử lý hàng đợi · service dọn dữ liệu tạm.

---

## `DATA-2` — handle phải mang được lệnh ghi thứ hai

**Tình huống.** Bạn đang chọn hình dáng của tay cầm. Repository trông tiện hơn: nó đã biết
entity, gọi ngắn hơn, IDE gợi ý đẹp hơn. Nhưng nó **buộc vào một entity**, nên cái ngày thao tác này
phải ghi thêm một bảng nữa, nó không đi cùng được.

**Dấu hiệu nhận biết**

- Constructor có `@InjectRepository(...)`, hoặc một tham số kiểu `Repository<T>` / `TreeRepository<T>`
  / `MongoRepository<T>`.
- Handler có hai, ba repository — mỗi cái một bảng — và các lệnh ghi nằm cạnh nhau, không có gì gói
  chúng lại.
- Trong code review, câu "cái này chưa cần transaction đâu" xuất hiện.

**Tự hỏi.** Nếu lệnh ghi thứ hai fail, lệnh ghi thứ nhất có bị hoàn lại không? Với hai repository,
câu trả lời là **không**, và không có gì trong kiểu dữ liệu phản đối cả — đó chính là lý do lỗi này
lọt qua review.

**Ranh giới**

- ↔ `DATA-1`: xem trên.
- ↔ `DATA-4`: `DATA-2` nói bạn **có** đơn vị công việc để truyền đi; `DATA-4` nói bạn **có truyền nó
  đi thật không**. Sửa xong `DATA-2` chưa đảm bảo `DATA-4` đúng.

**Tình huống nghiệp vụ hay gặp.** Ghi danh cộng trừ ví · tạo đơn cộng khoá số lượng tồn · duyệt bài
nộp cộng cộng điểm · huỷ đơn cộng hoàn tiền cộng ghi nhật ký · tặng thành tích cộng gửi thông báo ·
mọi thứ có chữ "và" trong câu mô tả nghiệp vụ.

---

## `DATA-3` — entity phải tự gọi tên cái bảng của nó

**Tình huống.** Bạn khai báo một entity mới, hoặc — nguy hiểm hơn — bạn đang **đổi tên một class
entity** cho hợp nghiệp vụ mới. Nếu tên bảng để ORM tự suy ra, nó suy ra từ tên class.

**Dấu hiệu nhận biết**

- `@Entity()` không có tham số.
- Tên bảng trong migration khớp y hệt tên class, kể cả phần hậu tố kiểu `_entity`.
- Trong PR đổi tên class, phần diff **không** có file migration nào.

**Tự hỏi.** Nếu ngày mai class này đổi tên, bảng có đổi tên theo không? Nếu có: dưới `synchronize`,
việc đổi tên ấy được thi hành bằng **DROP rồi CREATE**, không phải bằng migration. Đổi tên class là
một thao tác refactor; một cái bảng bị drop là một sự cố.

**Ranh giới**

- ↔ `DATA-5`: cả hai đều là quyết định nằm trên entity, nhưng `DATA-3` nói về **danh tính** của bảng,
  còn `DATA-5` nói về **chi phí** mà entity áp lên mọi câu query. Một entity đặt tên bảng rất đúng
  vẫn có thể bắt cả hệ thống trả giá cho relation eager.

**Tình huống nghiệp vụ hay gặp.** Thêm entity mới · đổi tên class cho khớp ngôn ngữ nghiệp vụ · tách
một entity làm hai · gộp hai entity làm một · entity cần nằm trong schema riêng.

---

## `DATA-4` — transaction là đơn vị công việc, và nó được **truyền**, không phải được **ngầm hiểu**

**Tình huống.** Bạn đã mở một transaction. Bên trong, bạn gọi một helper của service khác để cộng
điểm, ghi nhật ký, phát thông báo. Helper ấy có manager riêng của nó, được tiêm ở constructor của nó.

**Dấu hiệu nhận biết**

- Bên trong callback của `transaction()` có một lời gọi **không** nhận `manager` làm tham số.
- Helper dùng `this.entityManager` trong khi người gọi đang ở giữa một transaction.
- Bug chỉ xuất hiện dưới tải, và luôn có hình dạng "một nửa đã ghi".

**Tự hỏi.** Nếu transaction bên ngoài rollback, những gì helper vừa ghi có biến mất không? Nếu helper
tự lấy manager của mình: **không**. Nó ghi trên một connection khác và commit độc lập — nhìn code
thì thấy nó "nằm trong" transaction, còn database thì không nghĩ thế.

**Ranh giới**

- ↔ `DATA-2`: xem trên.
- ↔ `DATA-1`: helper vi phạm `DATA-4` thường **không** vi phạm `DATA-1` chút nào — manager của nó
  được tiêm rất đúng, chỉ là nó không nên dùng cái đó ở đây. Đây là lý do mã này không bắt được bằng
  cách đọc một file.

**Không có lint nào giữ mã này.** Muốn biết helper lấy manager ở đâu thì phải đi theo call graph, mà
một luật đoán mò ở đây sẽ báo đỏ lên code đúng — và một luật báo đỏ lên code đúng thì bị tắt.

**Tình huống nghiệp vụ hay gặp.** Ghi danh rồi cộng ví · duyệt bài rồi cộng XP · thanh toán rồi phát
thành tích · huỷ rồi hoàn · mọi service dùng chung được gọi từ bên trong transaction của người khác.

---

## `DATA-5` — query nói ra cái nó cần, entity không quyết hộ

**Tình huống.** Bạn đang lấy dữ liệu cho một câu trả lời cụ thể. Relation, cột và thứ tự thuộc về
tính của **câu trả lời ấy**, không phải thuộc tính của entity. Người biết cần gì là call site.

**Dấu hiệu nhận biết**

- Trên entity có relation khai `eager`.
- Một màn hình chỉ cần một cột nhưng query trả về cả cây quan hệ.
- Có người "tối ưu" bằng cách thêm eager cho tiện, và số truy vấn ở chỗ khác tăng lên.

**Tự hỏi.** Ai đang trả giá cho quyết định này? Với eager trên entity, câu trả lời là **mọi call
site**, kể cả cái chỉ cần một cột — và cái call site ấy không hề biết mình đang trả giá.

**Ranh giới**

- ↔ `DATA-3`: xem trên.
- ↔ `DATA-4`: cả hai đều là "quyết định nằm sai chỗ", nhưng `DATA-4` là quyết định về **tính nguyên
  tử**, còn `DATA-5` là quyết định về **chi phí**. Nhầm `DATA-4` gây mất dữ liệu; nhầm `DATA-5` gây
  chậm dần đều.

**Không có lint nào giữ mã này.** Muốn biết một relation *có nên* được hỏi ở call site không thì phải
biết câu trả lời dùng để làm gì, mà file entity thì không chứa dữ kiện đó.

**Tình huống nghiệp vụ hay gặp.** Danh sách gọn cạnh trang chi tiết đầy đủ · giỏ hàng cần giá và bản
dịch · bảng xếp hạng chỉ cần tên và điểm · export chỉ cần vài cột · màn hình quản trị cần cả cây.

---

## Luật

1. `EntityManager` được tiêm phải mang decorator gọi tên datasource.
2. Không tiêm repository, không bằng decorator và cũng không bằng kiểu.
3. `@Entity` phải tự nêu tên bảng; dạng options hợp lệ ngang dạng chuỗi.
4. Việc phải cùng sống cùng chết thì nằm trong **một** transaction.
5. Mọi thứ chạy bên trong transaction đều **nhận manager qua tham số**.
6. Relation, select và order khai ở call site; entity không phát eager cho tất cả mọi người.
7. Nếu chưa chắc thao tác có mọc thêm lệnh ghi thứ hai không: coi như **có**. Chọn handle theo giả
   định đó, vì đổi handle về sau tốn hơn nhiều so với giữ sẵn một handle rộng hơn nhu cầu hôm nay.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều khép kín và nêu rõ
mã nó áp dụng vào.

- **Dạng options của `@Entity`.** Thuộc `DATA-3`. `@Entity({ name: "t", schema: "s" })` hợp lệ ngang
  `@Entity("t")` và **không** phải một biến thể phong cách cần loại bỏ: nó là dạng duy nhất mang được
  schema. Cấm nó thì tác giả sẽ xoá schema đi cho vừa luật — hỏng hơn cả cái lỗi mà luật này sinh ra
  để chặn.
- **Manager lấy từ query runner tự mở.** Thuộc `DATA-4`. Manager transactional không bắt buộc phải
  đến từ callback của `transaction()`. Một helper tự mở query runner để giữ một lock theo session,
  rồi **truyền manager của chính runner đó** vào trong, thì vẫn nằm trong một đơn vị công việc. Điều
  bị cấm là **callee tự đi lấy manager của mình**, không phải một cách tạo manager cụ thể nào.
- **`DATA-4` và `DATA-5` do người giữ.** Thuộc chính hai mã đó. Chúng không "nhẹ hơn" ba mã kia,
  chúng nằm ở **tầng giữ khác**. Một reviewer không trả lời được câu "helper này lấy manager ở đâu"
  thì người ấy vừa tìm ra lỗi, không phải vừa gặp một chỗ luật nói chưa rõ.
- **Nợ khi mới áp dụng.** Cả ba rule đo được **không** vi phạm nào ở repository tham chiếu nên đều
  bật ở mức `error`. Một repository mới áp dụng thì **đo trước**, cái nào trên không thì để `warn`
  kèm con số, dọn xuống không, rồi mới lật sang `error`. Bật `error` khi còn nợ sẽ chặn mọi commit
  chạm vào chỗ nợ — và đó là cách một rule đúng bị gỡ ra.
