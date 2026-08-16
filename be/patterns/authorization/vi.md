---
id: be-patterns-authorization-vi
title: vi.md
slug: /be/patterns/authorization/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống AUTHZ-N, nhận diện bằng nghiệp vụ chứ không bằng hình dạng code.
---

# vi.md

> Version: `2.00` · Module: `authorization`

# Authorization

Xác thực (authentication) hỏi **người này là ai**. Phân quyền (authorization) hỏi **người này có được
làm việc này, lên chính bản ghi này không**. Hai câu hỏi khác nhau, được trả lời ở hai chỗ khác nhau,
và lý do phải tách là: một câu trả lời được mà không cần đọc dữ liệu nào, câu kia thì không.

Guard nhìn thấy request. Nó chứng minh được token, dựng được user, từ chối được người vô danh — và
hết. Bản ghi mà người gọi đang với tới **chưa được load**. Người này có sở hữu bản ghi kia không, có
đang giữ quan hệ đã trả tiền không, có thuộc tenant sở hữu dòng dữ liệu đó không — đều là câu hỏi về
một **dòng dữ liệu**, và chỉ handler mới cầm cả dòng dữ liệu lẫn danh tính cùng một lúc.

Câu hỏi quyết định một check nằm ở đâu:

> Câu trả lời có phụ thuộc vào dữ liệu của request không?

"Có ai đang đăng nhập không" thì không — đó là việc của cửa. "Người này có được sửa **cái đó** không"
thì có — đó là việc của handler.

**Đây là luật bắt buộc.** Mọi cửa có đọc danh tính và mọi handler có với tới một bản ghi đều rơi vào
đúng một mã dưới đây. Không có operation nào nhỏ đến mức được miễn: một mutation xoá một dòng là
`AUTHZ-3`, đúng cùng một lý do mà một query nội dung trả phí là `AUTHZ-5`. Câu "có mỗi mutation nội bộ
thôi mà" là chỗ luật này bị bỏ qua nhiều nhất — vì mutation nội bộ chính là cái sau này mọc thêm caller
thứ hai.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Nơi trả lời |
|---|---|---|
| `AUTHZ-1` | Handler tự khai điều kiện tiên quyết của nó, kể cả khi cửa đã có guard | Handler |
| `AUTHZ-2` | Cửa có đọc danh tính thì phải mang guard dựng ra danh tính đó | Method hoặc class của cửa |
| `AUTHZ-3` | Quyền sở hữu quyết định trên **dòng đã load**, không trên request | Handler |
| `AUTHZ-4` | Từ chối kiểu nào — forbidden hay not-found — là một quyết định có chủ đích | Handler |
| `AUTHZ-5` | Entitlement là một **trạng thái**; có dòng quan hệ không có nghĩa là có trạng thái | Handler hoặc guard chuyên trách |
| `AUTHZ-6` | Operator, service token và người dùng sản phẩm là ba chủ thể khác nhau | Một guard cho mỗi chủ thể |

---

## `AUTHZ-1` — handler tự sở hữu điều kiện tiên quyết của nó

**Tình huống.** Handler nhận `user` trong command và tự kiểm tra `user` có tồn tại không, dù resolver
đứng trước nó đã gắn guard. Người đọc sau thấy hai lớp check và tưởng là thừa.

**Dấu hiệu nhận biết**

- Handler nằm sau một bus (command bus, query bus, event bus), không nằm sau một cửa duy nhất.
- Cùng một command đã hoặc sẽ được gọi từ CLI, từ job, từ test harness, từ một transport khác.
- Người review đề nghị "bỏ cái `if (!user)` đi cho gọn, resolver có guard rồi".

**Tự hỏi.** Nếu ngày mai có một caller thứ hai gọi thẳng handler này mà không đi qua cửa cũ, operation
còn an toàn không?

**Ranh giới**

- ↔ `AUTHZ-2`: `AUTHZ-2` nói về **cửa** — chỗ danh tính được dựng ra. `AUTHZ-1` nói về **handler** —
  chỗ danh tính được dùng. Một hệ thống đúng có cả hai, không phải chọn một.
- ↔ `AUTHZ-3`: `AUTHZ-1` chỉ hỏi "có ai không". Ngay khi câu hỏi thành "có phải người này không" thì
  đã sang `AUTHZ-3`, và câu đó cần một dòng dữ liệu.

**Tình huống nghiệp vụ hay gặp.** Command handler viết dữ liệu · job chạy lại một mutation cho đơn
tồn · CLI backfill gọi cùng một handler · saga gọi lại bước đã fail · e2e gọi qua transport thật ·
harness gọi thẳng handler để đo một nhánh.

---

## `AUTHZ-2` — cửa nào đọc danh tính thì cửa đó mang guard

**Tình huống.** Một resolver method (hoặc controller method) có tham số đọc user đã xác thực, nhưng
không method nào và không class nào gắn guard. Code vẫn compile, vẫn chạy, handler vẫn nhận được một
thứ gọi là `user`.

**Dấu hiệu nhận biết**

- Có decorator tham số đọc danh tính, không có decorator guard ở method lẫn ở class.
- Cửa mới thêm được copy từ một cửa cũ, và dòng guard bị rơi lúc copy.
- Lỗi **không nhìn thấy được**: không exception, không log, không 401 — chỉ là một danh tính không ai
  chứng minh.

**Tự hỏi.** Cái gì đã chứng minh rằng danh tính mà cửa này đọc thuộc về người gọi?

**Ranh giới**

- ↔ `AUTHZ-1`: xem trên.
- ↔ `AUTHZ-6`: `AUTHZ-2` hỏi **có guard hay không**. `AUTHZ-6` hỏi **guard của chủ thể nào**. Một cửa
  operator gắn guard người dùng thì thoả `AUTHZ-2` và vi phạm `AUTHZ-6`.

**Nửa duy nhất máy kiểm được.** Đây là mã duy nhất trong module có lint rule, vì câu hỏi trả lời được
trong phạm vi **một file**: method này, hoặc class của nó, có mang guard không. Không cần biết dòng dữ
liệu nào cả.

**Tình huống nghiệp vụ hay gặp.** Mutation mới copy từ mutation cũ · resolver tách ra khỏi một class
đã có guard ở cấp class · controller webhook thêm tham số user "cho tiện log" · subscription resolver ·
query đọc dữ liệu riêng của người gọi.

---

## `AUTHZ-3` — quyền sở hữu quyết định trên dòng đã load

**Tình huống.** Request nói bản ghi nào, không nói bản ghi đó **của ai**. `request.reviewId` là bản ghi
người gọi **gọi tên**, không phải bản ghi người gọi **sở hữu**.

**Dấu hiệu nhận biết**

- Có một `userId` (hoặc `ownerId`, `tenantId`) đi trong payload của request.
- Check so sánh hai giá trị mà **cả hai** đều do người gọi cung cấp.
- Bỏ check đi thì không test nào đỏ, vì mọi test đều gửi id của chính mình.

**Tự hỏi.** Check này có đọc thứ gì mà người gọi **không** tự chọn được không?

**Ranh giới**

- ↔ `AUTHZ-1`: xem trên.
- ↔ `AUTHZ-4`: `AUTHZ-3` quyết định **có từ chối không**. `AUTHZ-4` quyết định **từ chối bằng câu
  nào**. Làm đúng `AUTHZ-3` rồi vẫn có thể rò rỉ ở `AUTHZ-4`.
- ↔ `AUTHZ-5`: `AUTHZ-3` hỏi "dòng này của ai". `AUTHZ-5` hỏi "quan hệ này đang ở trạng thái nào".

**Ngoại lệ đã đóng.** Được phép đưa chủ sở hữu vào `where` khi load thay vì so sánh sau, **miễn là**
giá trị chủ sở hữu lấy từ danh tính đã xác thực chứ không lấy từ request. Điều bất biến là: bên nào
của phép so sánh do người gọi điều khiển.

**Tình huống nghiệp vụ hay gặp.** Sửa/xoá bình luận của chính mình · huỷ đơn của chính mình · đọc chi
tiết hoá đơn · đổi thiết lập của một hồ sơ · thao tác trên bản nháp · gỡ một mục đã ghim.

---

## `AUTHZ-4` — từ chối kiểu nào là một quyết định

**Tình huống.** "Bạn không được sửa cái này" và "cái này không tồn tại" là hai **sự thật khác nhau**, và
client hiển thị hai thứ khác nhau cho chúng. Bình thường mỗi cái xứng đáng một exception riêng.

Ngoại lệ nằm ở bản ghi mà người gọi **lẽ ra không thể biết là có**: ở đó, trả lời "forbidden" chính là
xác nhận bản ghi tồn tại, mà sự tồn tại mới là bí mật.

**Dấu hiệu nhận biết**

- Id của bản ghi đoán được hoặc duyệt được (tăng dần, hoặc lấy từ một nguồn khác).
- Người gọi không có đường hợp lệ nào để biết bản ghi này có mặt trên hệ thống.
- Lặp id trong một vòng lặp và đọc mã lỗi là đã dựng được bản đồ dữ liệu.

**Tự hỏi.** Nếu tôi lặp id và chỉ đọc **mã lỗi** thôi, tôi có học được điều gì mà mình không được phép
biết không?

**Ranh giới**

- ↔ `AUTHZ-3`: xem trên.
- **Lỗi gương.** Trả "not found" cho bản ghi mà người gọi **biết chính đáng** (họ vừa thấy nó trong một
  danh sách hợp lệ) là lỗi ngược lại: nó bắt một người dùng hợp lệ đi truy một cái bug không tồn tại.
  Cả hai chiều đều vô hình, nên phải **nói ra** mình đang chọn cái nào.

**Nhật ký giữ lý do thật.** Người gọi nhận câu trả lời đã làm mềm; log nhận lý do thật. Nếu log cũng
mất lý do thì lần điều tra sau không còn gì để đọc.

**Tình huống nghiệp vụ hay gặp.** Bản nháp riêng tư · kế hoạch trả góp của người khác · tin nhắn riêng ·
liên kết chia sẻ chưa công khai · hồ sơ đã khoá · bản ghi thuộc tenant khác.

---

## `AUTHZ-5` — entitlement là một trạng thái, không phải một dòng

**Tình huống.** Ghi danh, thành viên, gói đăng ký, bản dùng thử. Một dòng nói rằng người này **có quan
hệ** với một sản phẩm; nó không nói **quan hệ nào**. Một dòng dùng thử và một dòng đã trả tiền đều là
"ghi danh", và chúng cho hai quyền khác nhau.

**Dấu hiệu nhận biết**

- Check viết bằng `exists` hoặc `count > 0` trên bảng quan hệ.
- Bảng quan hệ có cột trạng thái (`isEnrolled`, `status`, `plan`, `expiresAt`) mà câu query không nhắc
  tới.
- Có một đường nào đó **tự tạo** dòng quan hệ (trial placeholder, resolve-or-create) — nghĩa là sự tồn
  tại của dòng gần như miễn phí.

**Tự hỏi.** Nếu hệ thống tự tạo dòng quan hệ này cho mọi khách ghé qua, check của tôi còn từ chối được
ai không?

**Ranh giới**

- ↔ `AUTHZ-3`: xem trên.
- ↔ `AUTHZ-6`: `AUTHZ-5` là trạng thái của **cùng một chủ thể**. `AUTHZ-6` là **chủ thể khác nhau**.

**Đặt tên trạng thái trong câu query, đừng đặt trong comment.** Đây là check dễ bị viết đúng một lần
rồi copy sang chỗ khác và rơi mất đúng cái cột phân biệt.

**Tình huống nghiệp vụ hay gặp.** Nội dung trả phí · nộp bài capstone · tải chứng chỉ · tính năng của
gói cao hơn · quyền bình luận sau khi mua · hạn mức còn hiệu lực · ghế trong một tổ chức.

---

## `AUTHZ-6` — operator là một chủ thể khác với người dùng

**Tình huống.** Người vận hành nền tảng, một service token, và một người dùng sản phẩm là **ba danh
tính**. Treo cả ba lên một guard nghĩa là quản trị viên của một khách hàng có thể vận hành nền tảng.

**Dấu hiệu nhận biết**

- Một guard nhận cả session người dùng lẫn khoá máy.
- Một cờ `isAdmin` trên bảng người dùng quyết định quyền vận hành.
- Một endpoint vận hành nằm chung class với endpoint người dùng và dùng chung guard ở cấp class.

**Tự hỏi.** Nếu một người dùng sản phẩm được nâng quyền trong phạm vi tổ chức của họ, họ có với tới
được cửa này không?

**Ranh giới**

- ↔ `AUTHZ-2`: xem trên.
- **Chủ thể quyết định cả transport.** Một cửa phục vụ chủ thể không-phải-người-dùng thì nói ra điều
  đó, và đó là một trong số ít lý do hợp lệ để cửa ấy không phải GraphQL — xem `transport.md`.

**Ngoại lệ đã đóng.** Một màn hình vận hành **được phép** đọc dữ liệu của một người dùng, miễn là nó
xác thực với tư cách operator và nói rõ nó đang đọc dữ liệu của ai. Cái bị cấm là một guard trả lời
"được" cho cả hai chủ thể.

**Tình huống nghiệp vụ hay gặp.** Trang trạng thái hạ tầng · xoay khoá · phát lại một job · webhook của
đối tác · pod tự đăng ký lúc khởi động · công cụ vận hành nội bộ · export dữ liệu toàn hệ thống.

---

## Luật

1. Cửa nào **đọc** danh tính thì cửa đó mang guard dựng ra danh tính.
2. Handler tự khai điều kiện tiên quyết của nó, không phụ thuộc cửa nào đang đứng trước.
3. Quyền sở hữu đọc từ **dòng đã load**, không đọc từ request.
4. Từ chối phải nói rõ là forbidden hay not-found; bản ghi riêng tư thì trả not-found và log giữ lý do
   thật.
5. Check entitlement phải **gọi tên cột trạng thái** trong câu query.
6. Một guard phục vụ một chủ thể.
7. Luật phân quyền nằm trong handler, chỗ mà caller thứ hai với tới được — không nằm trong service
   cạnh handler, vì service không có message nên cửa sau sẽ mọc bản sao của riêng nó.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Cửa công khai.** `AUTHZ-2` chỉ áp cho cửa **có đọc** danh tính. Cửa không đọc danh tính nào thì
  không được miễn phân quyền — nó đơn giản là không có danh tính để phân quyền, và đó là một sự thật
  khác, phải viết ra trong mô tả của operation.
- **Danh tính tuỳ chọn.** `AUTHZ-2` chấp nhận guard cho phép người vô danh đi qua và chỉ điền danh tính
  khi có, vì danh tính vẫn được **dựng ra** chứ không bị **giả định**. Cái bị từ chối là không có guard
  nào cả.
- **Sở hữu bằng quan hệ.** `AUTHZ-3` chấp nhận đưa chủ sở hữu vào `where` thay vì so sánh sau, miễn là
  giá trị đó lấy từ danh tính đã xác thực.
- **Bản ghi người gọi biết chính đáng.** `AUTHZ-4` muốn một forbidden **có tên** khi người gọi tới được
  bản ghi qua một danh sách họ được phép thấy.
- **Quan hệ chỉ có một trạng thái.** `AUTHZ-5` cho phép rút về check tồn tại **chỉ khi** quan hệ đó chỉ
  mang đúng một nghĩa và schema không diễn đạt được nghĩa thứ hai. Ngay khi trạng thái thứ hai xuất
  hiện, mọi check tồn tại trên quan hệ đó thành lỗi.
- **Operator đọc dữ liệu người dùng.** `AUTHZ-6` cho phép, miễn là xác thực bằng danh tính operator và
  nói rõ đang đọc của ai.
