---
id: be-lints-event-delivery-vi
title: vi.md
slug: /be/lints/event-delivery/vi
sidebar_label: vi.md
sidebar_position: 1
description: Một luật máy giữ hợp đồng chuyển phát sự kiện — bắt gì, phát hiện bằng gì, và mười hai cửa còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `event-delivery`

# Chuyển phát sự kiện — phần máy giữ được

Một dữ kiện đã được quyết ở một bản chạy phải tới được mọi bản chạy khác, mà **không** quay ngược về
chính nơi sinh ra nó, và **không** gây hậu quả hai lần khi nó tới hai lần. Cây cầu giữa đường truyền
và bộ phát sự kiện trong tiến trình là chỗ duy nhất giữ được cả hai điều đó.

Tài liệu này **không** nhắc lại luật. Nó ghi lại phần **máy giữ**: máy nhìn thấy gì, nhìn bằng cách
nào, và — phần thường không ai chép ra — máy **không** nhìn thấy gì. Một điều luật không có luật máy
thì ai cũng biết là chưa được giữ. Một luật máy bị tin là kín trong khi nó hở thì nguy hơn, vì nó đã
lấy mất sự chú ý của người đọc mà không đổi lại được gì.

Luật máy duy nhất của mô-đun này nằm trong gói `@starci/eslint-canon-be` và đặt ở mức `error`.

## Bảng tra nhanh

| Tên luật máy | Mã luật | Bắt gì |
|---|---|---|
| `nats-bridge-delivery-contract` | `DELIVERY-3` (thông điệp `origin`) và `DELIVERY-4` (thông điệp `digest`) | Trong **đúng một tệp**: phép so danh tính nơi sinh không có, hoặc nằm sau lời gọi phát sự kiện đầu tiên tính theo vị trí ký tự; và chuỗi `parsed.digest` không có, hoặc nằm sau lời gọi ấy |

Ba nhận định phải nói ngay ở bảng này, và được lập luận đầy đủ trong [`audit.md`](./audit.md):

- Nguồn công bố **đúng một** luật máy, ở cả `rules` lẫn `recommended`, hai chỗ khớp nhau. Con số dự
  kiến là một, và thực tế đúng một.
- **Một luật máy gánh hai mã luật.** `origin` giữ `DELIVERY-3`, `digest` giữ `DELIVERY-4`. Nhật ký
  dựng in ra **tên luật**, mà tên ấy là một chuỗi duy nhất cho cả hai; chỉ câu thông điệp mới tách
  chúng ra.
- **Bốn trên sáu mã không có luật máy nào.** `DELIVERY-1`, `DELIVERY-2`, `DELIVERY-5` và
  `DELIVERY-6` hoàn toàn không được giữ trong tệp nguồn này.

---

## `nats-bridge-delivery-contract`

**Bắt gì.** Hai việc, hai thông điệp riêng, tính độc lập nên có thể cùng nổ một lúc:

- `origin` — không tìm thấy phép so danh tính nơi sinh, hoặc tìm thấy nhưng nó nằm **sau** lời gọi
  phát sự kiện đầu tiên trong văn bản tệp.
- `digest` — không tìm thấy chuỗi `parsed.digest`, hoặc tìm thấy nhưng nó nằm **sau** lời gọi ấy.

Cả hai đều báo lên nút `Program`, tức là lên đầu tệp. Luật máy **không bao giờ** chỉ tay vào lời gọi
phát sự kiện có lỗi.

**Giữ mã nào.** `DELIVERY-3` qua thông điệp `origin`, `DELIVERY-4` qua thông điệp `digest`.

**Cách phát hiện.** Không đọc cây cú pháp. Trình tự đúng ba bước:

1. **Cổng tên tệp.** Lấy `context.filename`, rỗng thì lấy `context.getFilename()`, đổi hết `\` thành
   `/`, rồi đòi chuỗi kết quả kết thúc bằng đúng `"/event/nats/nats-bridge.service.ts"`. Không khớp
   thì trả về **bộ thăm rỗng** — tệp không bị kiểm một phần, mà là **không bị kiểm gì cả**.
2. **Đăng ký đúng một bộ thăm**, `Program:exit`, rồi lấy `sourceCode.getText()` — **toàn bộ tệp gộp
   thành một chuỗi**.
3. **Tính ba vị trí ký tự.** `originIndex` bằng `text.search` với biểu thức chính quy
   `/parsed\.id\s*===\s*this\.instanceService\.getId\(\)/`; `digestIndex` bằng
   `text.indexOf("parsed.digest")`; `emitIndex` bằng `text.indexOf("this.eventEmitter.emit")`. Báo
   `origin` khi `originIndex < 0`, hoặc `emitIndex < 0`, hoặc `originIndex > emitIndex`. Báo `digest`
   theo đúng khuôn đó với `digestIndex`.

Bốn tính chất của cơ chế này quyết định toàn bộ trang tài liệu:

- **"Trước" ở đây là trước trong văn bản, không phải trước lúc chạy.** Phép so là so vị trí ký tự.
  Phương thức trong lớp được nâng lên, hàm phụ trợ gọi từ đâu cũng được, nên chỗ một câu lệnh **nằm**
  và lúc nó **chạy** là hai dữ kiện độc lập, và luật máy chỉ biết dữ kiện thứ nhất.
- **`emitIndex` là lần xuất hiện ĐẦU TIÊN.** `indexOf` dừng ở lời gọi phát sự kiện thứ nhất. Mọi lời
  gọi phát sự kiện phía sau trong cùng tệp không được so với gì cả.
- **Phép kiểm dấu vân tay là tìm chuỗi con trần.** `indexOf("parsed.digest")` không có ranh giới từ,
  không có kiểu nút. Nó khớp cả bên trong một tên thuộc tính dài hơn, bên trong một chuỗi ký tự, và
  bên trong một dòng chú thích.
- **Phép kiểm danh tính nơi sinh là một cách viết cố định của ba định danh.** Biểu thức chính quy
  đóng cứng tên biến cục bộ `parsed`, đường dẫn thành viên `this.instanceService.getId()`, toán tử
  `===`, và **thứ tự hai vế**. `\s*` nuốt khoảng trắng và xuống dòng quanh toán tử; ngoài ra không gì
  được co giãn.

Luật máy khai `schema: []` nên không có tuỳ chọn, và không khai `fixable` nên không có bản vá.

**Vì sao luật này đáng có máy giữ.** Vì đây là hai câu lệnh mà **thiếu chúng thì không có gì đỏ lên
cả**. Bỏ phép so danh tính nơi sinh, hệ thống vẫn chạy: mọi bản kiểm thử một bản chạy vẫn xanh, mọi
lời gọi vẫn trả về đúng, và cái sai chỉ hiện ra ở môi trường thật, dưới dạng một hậu quả xảy ra hai
lần cho cùng một người dùng — trên đúng bản chạy đã sinh ra dữ kiện ấy. Bỏ phép nhận dấu vân tay cũng
vậy: đường truyền hứa **ít nhất một lần**, nên bản sao thứ hai không phải sự cố mà là hành vi bình
thường của nó, và ngày nó tới thì không ai đang nhìn.

Hai câu lệnh đó cũng là loại câu lệnh dễ bị dọn đi nhất trong một lần tái cấu trúc, vì đọc riêng ra
thì chúng trông thừa: một điều kiện không làm gì trong phần lớn thời gian, và một lần đọc bộ nhớ đệm
trước mỗi lần phát. Người dọn không thấy chúng bảo vệ cái gì. Cổng tồn tại để lần dọn ấy đỏ lên.

Và nó đáng có máy giữ **kể cả khi cách phát hiện thô như thế này**, vì mất hẳn một câu lệnh là dạng
hỏng thường gặp nhất, và mất hẳn thì luật máy bắt được. Điều không được phép là đọc nó thành "hợp
đồng chuyển phát đã có máy giữ".

**Cửa còn mở.**

- **Phép so có mà không chặn.** `if (parsed.id === this.instanceService.getId()) { }` — không
  `continue`, không `return`. Văn bản khớp, cổng im, và mọi bản vọng về chính mình đều được phát. Luật
  máy chứng minh phép so **tồn tại**, không bao giờ chứng minh nó **bỏ qua**. Đây là cửa nặng nhất mô-đun.
- **Chú thích rửa sạch cả hai chuỗi.** Một dòng `// ngày xưa: parsed.id === this.instanceService.getId()`
  ở đầu tệp cho `originIndex` một giá trị nhỏ, vĩnh viễn. Chuỗi ký tự, khối đã tắt, phương thức chết
  cũng vậy.
- **Đọc dấu vân tay mà không ghi.** Chỉ `get` mà không `set` vẫn qua. Đó đúng là cuộc đua mà
  `DELIVERY-4` sinh ra để đóng: hai bản sao cùng trượt bộ nhớ đệm, cùng phát.
- **Lời gọi phát sự kiện thứ hai trở đi là vô hình.** Chỉ lần đầu tiên được so. Chặn cẩn thận lời gọi
  thứ nhất rồi thêm một lời gọi nữa ở dưới là xong.
- **Thứ tự trên trang không phải thứ tự lúc chạy.** Một hàm phụ trợ chặn đúng nhưng viết dưới chỗ phát
  thì bị báo; một phép so viết trên nhưng chạy sau thì được duyệt.
- **Đổi tên tệp là tắt luật.** Cổng là một hậu tố ba đoạn duy nhất. Đổi thành `nats-bridge.ts`, dời
  sang `event/bridge/`, hay tách phần xử lý ra `nats-bridge.consumer.ts` — bộ thăm rỗng, mà trong nhật
  ký dựng thì bộ thăm rỗng trông y hệt một tệp sạch.
- **Cây cầu thứ hai không phải cây cầu.** `nats-bridge-v2.service.ts`, một cây cầu cho đường truyền
  khác, hay cùng tệp ấy trong một ứng dụng thứ hai — luật quản tất cả, cổng gọi tên đúng một đường dẫn.
- **Dời phần phát sự kiện sang tệp cộng tác**, giữ lại trong tệp cầu một lời gọi đủ để thoả chuỗi.
  Luật máy một-tệp, không giải lệnh nhập nào, nên lời gọi thật không được chặn nằm ngoài tầm với.
- **`parsed.digest` khớp theo kiểu chuỗi con.** `parsed.digestedAt`, `parsed.digestion`, hay chuỗi
  `"parsed.digest"` trong một dòng ghi nhật ký đều thoả `DELIVERY-4`.
- **Không gì kiểm rằng `parsed` là phong bì thật.** `const parsed = { id: "x", digest: "y" }` qua
  sạch. Không lệnh nhập nào được giải, không kiểu nào được đọc, không ai xác nhận `getId()` trả về
  danh tính bản chạy chứ không phải tên chủ đề — mà nhầm chủ đề với danh tính chính là cách viết sai
  mà điều luật này gọi tên đích danh.
- **Một lần chạy không có tên tệp** thì `normalizePath` trả về chuỗi rỗng và cổng đóng lại. Hẹp, nhưng
  đó là một phụ thuộc vào cách bộ chạy đặt tên tệp, không phải vào chỗ tệp nằm.
- **Một dòng tắt luật.** Luật máy không phải loại không tắt được. Mọi cửa đóng ở `INDEX.md` cũng mở
  lại được bằng một dòng, bởi một người đang vội.

Mười hai cửa, và mười một trong số đó cùng một hình dạng: luật máy nhìn thấy **những chuỗi ký tự theo
một thứ tự**, còn luật nói về **một hậu quả không được xảy ra hai lần**. Viết được chuỗi mà không chặn
được hậu quả, và chặn được hậu quả mà không viết đúng chuỗi, đều là chuyện thường ngày.

---

## Luật

1. Luật máy này giữ `DELIVERY-3` và `DELIVERY-4`. `DELIVERY-1`, `DELIVERY-2`, `DELIVERY-5` và
   `DELIVERY-6` **không có luật máy nào** trong tệp nguồn này, và tài liệu này không được viết như thể
   chúng đã có.
2. Tên luật máy là **danh tính** của nó. Chép nguyên văn, kể cả trong tài liệu tiếng Việt, vì đó là
   chuỗi in ra trong nhật ký dựng và chuỗi viết trong một dòng tắt luật.
3. Luật máy đọc **đúng một tệp**. Mọi tệp khác trong kho mã đều nằm ngoài, và nằm ngoài một cách im
   lặng.
4. Luật máy không có tuỳ chọn. Muốn nới thì chỉ còn cách tắt hẳn, và tắt hẳn thì nhìn thấy được.
5. Luật máy không có bộ tự sửa. Câu thông điệp là chữ, không phải bản vá.
6. Mọi cửa còn mở là cửa của **luật máy**, không phải phép của **luật**. Mã lọt qua vẫn là mã sai.

## Ngoại lệ

Ngoại lệ là **một phần của phần máy giữ**, không phải chỗ lách. Mỗi ngoại lệ nêu rõ nó bước qua chỗ
nào và vì lý do gì.

- **Mọi tệp trừ một tệp đều được miễn.** Đây không phải một khoảng trừ dành cho mã kiểm thử hay mã
  sinh tự động; đây là **toàn bộ phạm vi** của luật máy. Một luật về một loại hành vi đang được giữ
  bằng cách khẳng định nội dung của đúng một tệp.
- **Không có làn kiểm thử.** Một bản sao đặt trong thư mục dữ liệu mẫu, một bản sao lưu, hay một bản
  dựng ra — nếu đường dẫn vẫn kết thúc bằng ba đoạn ấy — bị kiểm y như mã sản phẩm. Đặt ở đường dẫn
  khác thì không.
- **Thiếu hẳn lời gọi phát sự kiện bị coi là vi phạm, không phải được miễn.** Một tệp không phát gì cả
  nhận **cả hai** thông điệp, mà câu chữ của chúng lại nói về thứ tự. Khoảng lệch giữa nguyên nhân và
  câu thông điệp được ghi thành một nhận định trong [`audit.md`](./audit.md).
- **Cách viết hai vế đảo chiều** — `this.instanceService.getId() === parsed.id` — không phải ngoại lệ:
  nó **bị báo**, dù nó đúng nghĩa hệt nhau. Ghi ở đây vì đây là báo thừa mà người đọc hay gặp nhất, và
  cách chữa đúng là sửa biểu thức chính quy chứ không phải viết lại đoạn mã đang đúng.
