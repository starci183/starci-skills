---
id: be-patterns-observability-vi
title: vi.md
slug: /be/patterns/observability/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống OBSERVABILITY-N, nhận diện bằng nghiệp vụ chứ không bằng thói quen viết log.
---

# vi.md

> Version: `2.00` · Module: `observability`

# Observability

Một dòng log là **một sự kiện có tên ổn định và dữ liệu đi kèm**, không phải một câu tiếng Anh.
Nó đi ra qua **một** service duy nhất, đối số đầu tiên là **một thành viên enum**, và mọi thứ thay
đổi được đi **bên cạnh** cái tên đó dưới dạng dữ liệu.

Lý do nằm ở những gì xảy ra sau khi dòng log rời khỏi tiến trình. Câu
`handling order 4f2a for user 91` người đọc hiểu được, còn mọi thứ khác thì không: không đếm được,
không group được, không đặt alert được, không lọc theo user được — trừ khi viết một regex, và regex
đó vỡ ngay lần đầu có người sửa lại câu chữ. Cùng sự kiện ấy viết thành `ORDER_HANDLED` kèm
`{ orderId, userId }` thì đếm được ngay từ giây nó tồn tại.

Câu hỏi chốt hạ: **có bao giờ mình muốn biết chuyện này xảy ra bao nhiêu lần không?** Nếu có — và với
bất cứ thứ gì đáng log thì câu trả lời là có — nó cần một cái tên sống sót qua việc bị viết lại.

**Đây là luật bắt buộc.** Mọi dòng rời khỏi tiến trình đều thuộc đúng một mã dưới đây, và mọi tiến
  trình telemetry vận chuyển những dòng đó cũng vậy. Không có service nào nhỏ đến mức được miễn: một cron ba
  dòng vẫn log qua house service, vì cùng lý do một HTTP handler phải làm thế. Câu "chỉ là một
dòng debug thôi mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `OBSERVABILITY-1` | Cần ghi lại một chuyện vừa xảy ra trong tiến trình có request | Inject house logging service, không tự tạo logger |
| `OBSERVABILITY-2` | Đặt tên cho chuyện vừa xảy ra | Một thành viên enum đóng, không phải chuỗi ghép tại chỗ |
| `OBSERVABILITY-3` | Có id, số lượng, thời lượng, kết cục cần ghi kèm | Một object có kiểu, đứng cạnh cái tên |
| `OBSERVABILITY-4` | Đang phân vân log chỗ nào trong một hàm | Log **quyết định** và bằng chứng của nó, không log việc hàm được gọi |
| `OBSERVABILITY-5` | Đang ở trong `catch` | Ghi code và metadata của exception, không ghi câu thông báo |
| `OBSERVABILITY-6` | Chương trình chạy ngoài vòng đời request (CLI, agent) | Được dùng logger thường, khai báo **một lần theo path** |
| `OBSERVABILITY-7` | Đang dựng hoặc mở rộng đường đi của tín hiệu | Phase 1 Minimal là mặc định; Phase 2 Full cần bằng chứng đo được |
| `OBSERVABILITY-8` | Sắp thêm collector, exporter, store hay dashboard vào runtime | Khai đủ vòng đời trước, hoặc dùng lại đường đã có |

---

## `OBSERVABILITY-1` — log đi ra qua house service, và chỉ qua đó

**Tình huống.** Một service, handler, worker hay cron cần ghi lại một chuyện vừa xảy ra, và tiến
trình đang phục vụ một request hoặc một job.

**Dấu hiệu nhận biết**

- Có một logger được tạo tại chỗ trong class: `new Logger(...)`, hoặc một `console.*` còn sót.
- Dòng log ra đúng định dạng nhưng khi tra cứu thì **không có correlation id**.
- Cùng một request, có dòng thì tìm thấy trong log store, có dòng thì không.

**Tự hỏi.** Dòng này có mang theo được request đã sinh ra nó không, hay chỉ mang theo nội dung của
chính nó?

**Ranh giới**

- ↔ `OBSERVABILITY-2`: `-1` hỏi **đi qua đâu**; `-2` hỏi **tên là gì**. Gọi đúng service mà truyền
  một template literal thì vẫn hỏng, và hỏng theo mã `-2`.
- ↔ `OBSERVABILITY-6`: nếu đoạn code đó chạy **ngoài** vòng đời request thì không còn request nào để
  gắn vào; đó là lối ra `-6`, không phải một lần vi phạm `-1`.

**Đây không phải chuyện định dạng.** Logger của framework ghi ra stdout đúng hình dạng và vẫn đánh
mất request mà nó thuộc về, vì correlation id nằm trong service mà nó đi vòng qua.

**Tình huống nghiệp vụ hay gặp.** Handler thanh toán · worker xử lý job nền · cron dọn dữ liệu ·
listener của message queue · interceptor · guard · service tích hợp bên thứ ba.

---

## `OBSERVABILITY-2` — tên sự kiện là thành viên enum

**Tình huống.** Đang đặt đối số đầu tiên cho một lời gọi log. Đối số đó **đặt tên cho chuyện đã xảy
ra**, và nó phải đến từ một tập đóng.

**Dấu hiệu nhận biết**

- Có `${}` trong đối số đầu tiên.
- Có dấu `+` nối chuỗi trong đối số đầu tiên.
- Đối số đầu tiên là một chuỗi viết thẳng, dù không có biến nào bên trong.

**Tự hỏi.** Nếu ngày mai có người sửa lại câu chữ cho hay hơn, dashboard dựng trên dòng này có tắt
tiếng không?

**Ranh giới**

- ↔ `OBSERVABILITY-3`: `-2` cấm nhét dữ liệu **vào trong** tên; `-3` nói dữ liệu đi **bên cạnh** tên.
  Hai mã này thường bị vi phạm cùng lúc bởi một template literal, nhưng chúng là hai lỗi khác nhau:
  một cái làm tên hết group được, một cái làm dữ liệu hết query được.
- ↔ `OBSERVABILITY-4`: `-2` không hỏi sự kiện có đáng log hay không. Một tên enum đặt cho việc "đã
  vào hàm" vẫn là vi phạm `-4` dù đúng chuẩn `-2`.

**Chuỗi viết thẳng cũng bị cấm**, không chỉ chuỗi có nội suy. Một chuỗi cứng chỉ cách việc trở thành
một sự kiện khác đúng **một** lần sửa chữ, và không ai coi việc sửa chữ là đổi hành vi.

**Tình huống nghiệp vụ hay gặp.** Tạo đơn hàng · huỷ đơn · gia hạn thuê bao · webhook nhận được ·
retry lần thứ n · job xong · job chết · đồng bộ bỏ qua vì trùng.

---

## `OBSERVABILITY-3` — phần thay đổi được đi cạnh cái tên

**Tình huống.** Sự kiện đã có tên, và còn id, số lượng, thời lượng, kết cục cần ghi lại kèm.

**Dấu hiệu nhận biết**

- Đối số thứ hai vắng mặt, trong khi câu chuyện rõ ràng có "cái nào" và "bao nhiêu".
- Dữ liệu bị nhét vào tên để "đọc cho tiện".
- Muốn thêm một trường mà lại phải sửa chính cái tên.

**Tự hỏi.** Sáu tháng nữa cần lọc theo tenant, mình thêm một trường hay phải viết lại tên sự kiện?

**Ranh giới**

- ↔ `OBSERVABILITY-2`: xem trên.
- ↔ `OBSERVABILITY-5`: `-3` nói về dữ liệu của một sự kiện bình thường; `-5` nói riêng về dữ liệu của
  một **thất bại**, nơi trường quan trọng nhất là danh tính của exception.

**Kiểu dữ liệu là một phần của luật.** Object đi kèm có kiểu riêng cho từng sự kiện thì trường mới
được thêm vào một chỗ, và mọi call site sai kiểu đỏ ngay lúc build chứ không im lặng tới lúc tra cứu.

**Tình huống nghiệp vụ hay gặp.** `orderId` + `amount` + `currency` · `jobId` + `queueName` +
`durationMs` · `tenantId` + `count` · `attempt` + `maxAttempts` · `outcome` + `reason`.

---

## `OBSERVABILITY-4` — log quyết định, không log việc đi ngang qua

**Tình huống.** Đang chọn chỗ đặt dòng log trong một hàm. Có hai chỗ hấp dẫn: đầu hàm, và chỗ code
vừa **chọn** một nhánh.

**Dấu hiệu nhận biết**

- Tên sự kiện nghe như tên hàm: `MethodEntered`, `HandlerStarted`, `LeavingService`.
- Đọc dòng log lên không biết được **vì sao** code làm thế, chỉ biết là nó có chạy.
- Xoá dòng log đi thì chẳng ai mất thông tin gì, vì source đã nói y hệt.

**Tự hỏi.** Người đọc học được gì từ dòng này mà đọc source không suy ra được?

**Ranh giới**

- ↔ `OBSERVABILITY-3`: một dòng ghi đúng quyết định mà thiếu bằng chứng thì vẫn hỏng, nhưng hỏng theo
  `-3` — thiếu dữ liệu, không phải sai chỗ đặt.
- ↔ `OBSERVABILITY-2`: mã `-2` chỉ xét hình dạng của tên. Một tên enum hoàn hảo cho một sự kiện vô
  nghĩa vẫn là vi phạm `-4`.

**Bước của pipeline là ranh giới mờ nhất.** Một sự kiện "step xong" chỉ đáng tồn tại khi step đó là
một **kết cục** có thể khác đi — thành công, bỏ qua, thất bại — chứ không phải khi nó chỉ đánh dấu
con trỏ đã đi tới đâu.

**Tình huống nghiệp vụ hay gặp.** Cấp quyền dùng thử vì chưa từng mua · bỏ qua tạo bản ghi vì đã tồn
tại · chọn nhà cung cấp dự phòng vì cái chính hết hạn mức · từ chối webhook vì chữ ký sai · dừng
retry vì đã chạm ngưỡng.

---

## `OBSERVABILITY-5` — thất bại ghi danh tính, không ghi câu chữ

**Tình huống.** Dòng log nằm trong một `catch`, và nó sẽ là thứ alert group theo.

**Dấu hiệu nhận biết**

- Có `error.message`, `String(error)` hoặc `${error}` đi vào trường dữ liệu.
- Một sự cố duy nhất hiện ra thành nhiều nhóm alert khác nhau trên dashboard.
- Sửa một câu thông báo cho dễ hiểu hơn xong thì alert cũ im lặng.

**Tự hỏi.** Nếu ngày mai có người viết lại câu thông báo của exception này, alert có tách làm hai
không?

**Ranh giới**

- ↔ `OBSERVABILITY-3`: `-5` là trường hợp riêng và **nghiêm hơn** của `-3`: dữ liệu bắt buộc ở đây là
  `code` và metadata của exception.
- ↔ `OBSERVABILITY-4`: `-5` không nói dòng đó có đáng log hay không, chỉ nói khi đã log thì khoá
  group phải là danh tính.

**Câu chữ vẫn được phép tồn tại**, miễn là nó không phải khoá group. Nó là một trường phụ để người
đọc dễ hiểu, không phải thứ dashboard đếm.

**Tình huống nghiệp vụ hay gặp.** Job chết · gọi API bên thứ ba lỗi · vi phạm ràng buộc CSDL ·
timeout · hết hạn mức · payload không hợp lệ.

---

## `OBSERVABILITY-6` — chương trình đứng một mình là lối ra duy nhất

**Tình huống.** Một CLI, một agent, một script chạy ngoài vòng đời request. Không có request để
correlate, không có transport được cấu hình sẵn cho nó.

**Dấu hiệu nhận biết**

- Entry point là `main.ts` của một chương trình tự chạy rồi thoát.
- Logger được cần **trước khi** injector tồn tại.
- Không có `traceId` nào để gắn vào, vì không có ai gọi tới.

**Tự hỏi.** Có tồn tại một request hoặc một job để dòng này gắn vào không? Nếu có thì đây **không**
phải lối ra.

**Ranh giới**

- ↔ `OBSERVABILITY-1`: lối ra dựa trên **có request hay không**, không dựa trên "chương trình này nhỏ
  mà". Một worker xử lý queue có job để gắn vào, nên nó nằm ở `-1`.

**Khai một lần theo path.** Lối ra là một dòng trong lint config trỏ vào thư mục của những chương
trình đó, không phải một comment tắt rule trên từng dòng. Hai chỗ khai cùng một ngoại lệ là cách một
trong hai chỗ âm thầm phình ra mà không ai thấy.

**Tình huống nghiệp vụ hay gặp.** CLI quản trị · agent chạy trong sandbox · script migrate chạy tay ·
tool build · bootstrap trước DI.

---

## `OBSERVABILITY-7` — Minimal trước, Full khi có bằng chứng

**Tình huống.** Đang dựng hoặc mở rộng đường đi của tín hiệu: log, metric, trace, alert.

**Dấu hiệu nhận biết**

- Brief liệt kê một danh sách công cụ thay vì một danh sách tín hiệu.
- Lý do thêm là "nó tích hợp sẵn rồi", "cloud có mà", "bật cho đủ bộ".
- Không ai nói được cái gì **đã** có, cái gì đang thêm, cái gì cố tình hoãn.

**Tự hỏi.** Con đường nhỏ nhất **đầy đủ** để thu được các tín hiệu lõi đã nêu, giữ hoặc chuyển tiếp
chúng qua một backend đã duyệt, xem được sức khoẻ và bắn được các alert nguy cấp — con đường đó là
gì?

**Ranh giới**

- ↔ `OBSERVABILITY-8`: `-7` hỏi **có nên mở rộng phạm vi tín hiệu không**; `-8` hỏi **ai trả giá vòng
  đời** cho tiến trình sẽ chở tín hiệu đó. Một Phase 2 hợp lệ vẫn phải qua `-8`.

**Phase 2 không phải nợ của Phase 1.** Minimal xong là xong. Full mở lại ở một Review sau, khi có một
khoảng trống SLO hoặc debug đo được, một giới hạn scale/cardinality, một ràng buộc tuân thủ hay cư
trú dữ liệu, một yêu cầu độ tin cậy, hoặc một chi phí đã chứng minh.

**Tình huống nghiệp vụ hay gặp.** Thêm tracing phân tán · thêm metric tuỳ biến · thêm profiling liên
tục · thêm bộ dashboard thứ hai · nâng retention.

---

## `OBSERVABILITY-8` — mỗi tiến trình telemetry tự trả giá vòng đời của nó

**Tình huống.** Sắp có một agent, collector, exporter, store hay dashboard service trở thành một phần
của runtime.

**Dấu hiệu nhận biết**

- Brief nói về tính năng của công cụ, không nói về tín hiệu mà đường hiện tại **không** chở nổi.
- Không ai trả lời được: ai sở hữu, chiếm bao nhiêu tài nguyên, mở cổng nào, credential ở đâu, lưu
  bao lâu, health check ra sao, ai backup, khi nào thì gỡ đi.
- Câu "cứ dựng lên đã, sau tính" xuất hiện.

**Tự hỏi.** Tín hiệu này có đi được qua tiến trình đã có hoặc một backend đã duyệt không? Nếu có thì
tiến trình mới bị từ chối.

**Ranh giới**

- ↔ `OBSERVABILITY-7`: xem trên.
- ↔ `OBSERVABILITY-1`: `-1` nói về **một dòng** đi qua đâu; `-8` nói về **cả một tiến trình** được
  thêm vào runtime.

**Managed không xoá nghĩa vụ.** Backend được quản lý làm giảm phần vận hành tại chỗ, nhưng PII,
cardinality, egress, retention và chi phí vẫn phải được kiểm soát **trước khi** telemetry vượt qua
ranh giới. Và "cloud-first" không có nghĩa là "cloud-only": bảo mật, cư trú dữ liệu, độ tin cậy hoặc
chi phí đều có thể làm managed thành lựa chọn sai — khi đó lý do được ghi lại, không phải bỏ qua.

**Tình huống nghiệp vụ hay gặp.** Dựng collector tại chỗ · thêm một TSDB · thêm dashboard service ·
sidecar log shipper · store trace riêng.

---

## Luật

1. Log đi ra qua house logging service; không dùng logger của framework, không dùng `console`.
2. Đối số đầu tiên là một thành viên enum đóng, không bao giờ là chuỗi dựng tại call site.
3. Phần thay đổi được đi bên cạnh cái tên, dưới dạng object có kiểu.
4. Log quyết định và bằng chứng của quyết định, không log việc code đã chạy qua.
5. Trong `catch`, khoá group là danh tính của exception: code và metadata.
6. Chương trình chạy ngoài vòng đời request là lối ra duy nhất, và khai một lần theo path.
7. Phase 1 Minimal là biên mặc định của một thay đổi production; Phase 2 Full cần bằng chứng đo được.
8. Tiến trình telemetry mới phải khai đủ vòng đời trước khi được chạy, hoặc bị từ chối vì đường cũ đã
   chở được.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Chương trình đứng một mình** (`OBSERVABILITY-6`). Được dùng logger thường. Khai **một lần theo
  path** trong lint config; không khai bằng comment tắt rule trên từng dòng, vì ngoại lệ khai theo
  dòng lớn dần cho tới lúc không ai đo được nó rộng bao nhiêu.
- **Bổ sung Phase 2** (`OBSERVABILITY-7`). Được mở lại khi có SLO hoặc khoảng trống debug đo được,
  giới hạn scale/cardinality, ràng buộc tuân thủ hay cư trú dữ liệu, yêu cầu độ tin cậy, hoặc chi phí
  đã chứng minh. Công cụ **có sẵn** không phải bằng chứng.
- **Backend được quản lý** (`OBSERVABILITY-8`). Giảm phần sở hữu runtime tại chỗ, không giảm nghĩa vụ
  kiểm soát PII, cardinality, egress, retention và chi phí. Sở hữu tại chỗ vẫn hợp lệ khi bảo mật, cư
  trú dữ liệu, độ tin cậy hoặc chi phí đòi hỏi — và khi đó ràng buộc được ghi lại.
- **Câu chữ của lỗi** (`OBSERVABILITY-5`). Được phép nằm trong dữ liệu như một trường phụ cho người
  đọc. Không được là thứ alert group theo.
