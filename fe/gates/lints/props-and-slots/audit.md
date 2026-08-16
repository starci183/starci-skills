---
id: fe-lints-props-and-slots-audit
title: audit.md
slug: /gates/lints/props-and-slots/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện xem ba rule có thật sự giữ được luật props và slot, và những gì còn hở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `props-and-slots`

Phản biện này kiểm một câu duy nhất: **máy có thật sự thấy thứ mà luật cấm không**, và nếu không thì
hở ở đâu.

## Kết luận

Chấp nhận, có điều kiện. Ba rule đều có thật, đều chạy, đều ánh xạ đúng một mã luật. Nhưng hai trong
ba rule bắt theo **một chữ** chứ không theo **một hình dạng**, nên chúng chặn được cách viết vô tình,
không chặn được cách viết cố ý. Điều đó phải được nói ra ở đây, vì một rule bị tin là kín nguy hiểm
hơn một luật biết rõ là không ai giữ.

Đếm được đúng **ba** rule công bố trong nguồn, khớp với con số dự kiến. Không có rule thứ tư ẩn, và
không có rule nào công bố mà mô-đun này bỏ sót.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Mỗi rule có ánh xạ đúng một mã luật? | Có. `no-inline-parameter-type` → `SLOTS-3`; `no-children-slot` → `SLOTS-4`; `no-surface-list-items-slot` → `SLOTS-7`. Không rule nào giữ một mã mà luật không có. |
| Có mã luật nào không rule nào giữ? | Có bốn: `SLOTS-1`, `SLOTS-2`, `SLOTS-5`, `SLOTS-6`. Ghi ở phần Findings, không bịa ánh xạ. |
| Danh tính rule là tên công bố? | Có. Không có mã số song song, nên không có chuyện một rule hai tên. |
| Mức nghiêm có tương xứng? | Có. Cả ba bắt theo hình dạng cú pháp, không theo phán đoán, nên không có rủi ro báo nhầm đủ để hạ mức. |
| Cổng tên file có chịu được hai bố cục kho? | Có, và đã từng không chịu được. Danh sách gốc thành phần dùng chung là chỗ sửa; viết tay một đường dẫn literal là chỗ hỏng. |
| Có rule nào canh cánh cửa mà kiểu đã đóng? | Không. Không rule nào lặp lại việc kiểm nội dung của một slot, vì kiểu đã từ chối trước. |
| Hành vi thật có khớp tên rule không? | **Không, ở cả ba.** Xem Findings. |

## Phát hiện

1. **`no-inline-parameter-type` rộng hơn tên nó gợi ra.** Nó không có cổng tên file, không kiểm slot,
   không kiểm tầng. Nó nổ trên **mọi tham số của mọi hàm trong mọi file** thuộc glob — kể cả tiện
   ích, script và kiểm thử. Đó có thể là điều mong muốn, nhưng nó không phải điều cái tên nói.
   Comment mở đầu của bài kiểm thử song sinh còn mô tả hẹp hơn nữa ("một mẫu tách cấu trúc với kiểu
   viết thẳng"), trong khi chính bài kiểm thử ấy có ca `(input: { a: string })` là ca vi phạm. Comment
   đã lạc hậu so với hành vi.

2. **`no-children-slot` miễn bốn shell, tài liệu của chính nó nói ba.** `meta.docs.description` viết
   "only the three closed shells", còn danh sách trong mã và câu thông báo lỗi đều kể **bốn**, có
   `RouteShell`. Chuỗi mô tả là thứ hiện ra trong danh mục rule; nó đang nói sai về hành vi.

3. **`no-children-slot` cấm một chữ, không cấm một hình dạng.** Luật từ chối **giao diện đã dựng
   sẵn**. Rule từ chối định danh `children`. `body`, `content`, `slot`, `inner` — cùng hành vi, không
   ai báo. Đây là hở lớn nhất của mô-đun.

4. **`no-surface-list-items-slot` là một rule của chỗ gọi, không phải một rule của slot.** Tên nó có
   chữ "slot", nhưng nó không bao giờ đọc kiểu props của bề mặt. Làn `items` có thể được khai ngay
   trong kiểu của bề mặt và không file nào đỏ cho tới khi có người dùng tới nó, qua đúng dạng import
   mà rule theo dõi.

5. **Bốn mã luật không có rule.** `SLOTS-1` và `SLOTS-2` do hàng rào kiểu giữ — và giữ chặt hơn rule,
   vì một interface làm hỏng hàng rào dữ liệu ở tầng trên chứ không phải bị nhắc khi review. `SLOTS-5`
   (`isLoading` được nhận, không tự quyết) và `SLOTS-6` (không có slot ngoại hình) **không có gì
   trong mô-đun này giữ**. Đây là ghi nhận về mô-đun này, không phải kết luận về toàn bộ bộ luật.

6. **Không rule nào dùng thông tin kiểu.** Đó là lựa chọn về chi phí, không phải sơ suất — nhưng nó
   là nguyên nhân gốc của phần lớn cửa mở bên dưới, nên phải được nêu như một dữ kiện chứ không phải
   một chi tiết cài đặt.

## Quyết định

- Giữ đúng ba rule, viết đúng tên công bố, không gán thêm mã số cho rule.
- Chỉ ghi vào shelf này những rule **có thật** trong nguồn. Rule đáng lẽ nên có thì nằm ở phần "Rủi
  ro còn mở", không nằm ở `INDEX.md` như thể nó đang chạy.
- Bảng **cửa còn mở** là bắt buộc và không được viết "không có". Mỗi rule ở đây đều có ít nhất một
  dòng thật.
- Giữ nguyên cách viết mọi định danh có thật: tên rule, tên thành phần, tên gói. Chỉ phần **văn xuôi
  và ví dụ** mới cấm tên sản phẩm.
- Không đề xuất siết rule ngay trong bản ghi này. Bản ghi này ghi lại **cái đang chạy**; siết rule là
  một thay đổi luật, đi đường của nó.

## Rủi ro còn mở

Mỗi mục nêu cửa còn mở và nói rõ rule sẽ phải soi thêm **cái gì** mới đóng được — hoặc vì sao đóng
đắt hơn để mở.

**`no-inline-parameter-type`**

- **Hình dạng vô danh trong đối số kiểu** (`Readonly<{…}>`, `Partial<{…}>`, `Array<{…}>`,
  `{…}[]`). Để đóng: hàm kiểm tra phải đi tiếp vào `typeArguments` của `TSTypeReference` và vào
  `elementType` của `TSArrayType`. Chi phí thấp, rủi ro báo nhầm thấp — đây là mục đáng đóng nhất.
- **Ràng buộc của tham số kiểu** (`<T extends {…}>`). Để đóng: phải duyệt `typeParameters` của hàm,
  không chỉ `params`. Chi phí thấp, nhưng cần cân nhắc ca một ràng buộc cấu trúc dùng đúng chỗ.
- **`TSFunctionType`.** Để đóng: thêm node đó vào danh sách duyệt. Rủi ro: rất nhiều kiểu callback
  bình thường có tham số object nhỏ, nên đóng chỗ này có thể đổi tính chất của rule từ "hình dạng
  props" sang "mọi object vô danh ở mọi chỗ".
- **Ép kiểu và suy kiểu trong thân hàm.** Để đóng cần thông tin kiểu. Đắt hơn nhiều so với thứ thu
  được, và vẫn không chặn được người cố tình.
- **Không có cổng tên file.** Đây là rủi ro ngược: nó không hở, nó **rộng**. Nếu một kho thấy rule
  ồn ở tầng ngoài thành phần, đường xử lý đúng là thu hẹp glob trong cấu hình, không phải hạ mức
  nghiêm hay dán comment tắt rule.

**`no-children-slot`**

- **Kế thừa, mở rộng và kiểu trợ giúp** (`extends PropsWithChildren<…>`). Để đóng cần **thông tin
  kiểu**: rule phải hỏi trình kiểm kiểu xem shape đã giải quyết có thuộc tính `children` không. Đó là
  bước nhảy về chi phí cho toàn bộ lần chạy lint, và phải được quyết như một thay đổi luật.
- **Đọc thẳng `props.children` không tách cấu trúc.** Để đóng: soi `MemberExpression` có thuộc tính
  `children` trên chính tên tham số của thành phần. Chi phí vừa; nhưng chỉ đóng được một nửa, vì
  không có kiểu thì vẫn không biết tham số ấy có phải props của thành phần hay không.
- **Tách cấu trúc trong thân hàm.** Đang được miễn **có chủ ý**, và phần miễn ấy là cửa khi kiểu nằm
  ở file khác. Để đóng: lần từ `VariableDeclarator` về nguồn của nó và hỏi nguồn ấy có phải tham số
  props không. Làm được mà không cần kiểu, nhưng phải viết cẩn thận để không bắt nhầm một object
  thường có khoá `children`.
- **Khoá dạng chuỗi.** Để đóng: nhận cả `key.type === "Literal"` với giá trị `"children"`. Rẻ nhất
  trong toàn bộ danh sách này, và hiện chưa làm.
- **Slot đổi tên** (`body`, `content`, `slot`). Để đóng, rule phải chuyển từ so **tên** sang so
  **kiểu**: bắt mọi thuộc tính có kiểu nhận được node giao diện. Đó là một rule khác hẳn, cần thông
  tin kiểu, và cần một danh sách kiểu được coi là "giao diện đã dựng sẵn". Chi phí cao — nhưng đây là
  cửa mà luật quan tâm nhất, nên nó phải nằm trong sổ chứ không được lặng lẽ bỏ qua.
- **Cây thành phần đặt ngoài gốc được quản.** Không đóng được bằng mã: đó là một dữ kiện về bố cục
  kho. Cái đóng được là **cách đọc kết quả** — một kho báo không vi phạm phải được kiểm chứng bằng
  một ca âm tính có chủ đích, chứ không được đọc thành tuân thủ. Chuyện này đã xảy ra thật một lần
  với đúng cổng tên file này.
- **Miễn theo thư mục không phải miễn theo danh tính.** Một file lạ đặt nhờ trong thư mục shell hưởng
  luôn phần miễn. Để đóng: miễn theo **đúng file điểm vào** của shell thay vì cả thư mục. Rẻ, và
  đáng cân nhắc.

**`no-surface-list-items-slot`**

- **Trải object tại chỗ gọi.** Để đóng cần lần ngược giá trị được trải về nơi khai báo — tức là phân
  tích luồng dữ liệu trong phạm vi mô-đun. Đắt, và vẫn thua một biến đến từ file khác.
- **Các dạng import không khớp mẫu** (mặc định, namespace, barrel, hậu tố `/index`, đường dẫn anh
  em). Để đóng: nới mẫu nguồn để chấp nhận hậu tố `/index` và đường dẫn tương đối, và nhận cả
  specifier mặc định cùng truy cập qua `JSXMemberExpression`. Chi phí thấp và **nên làm** — mỗi dạng
  hụt hiện đang làm rule im cho cả file, chứ không chỉ cho một lần gọi.
- **Bọc một lớp.** Không đóng được nếu không phân tích liên file. Chấp nhận, nhưng phải biết là nó
  tồn tại.
- **Tên làn khác** (`rows`, `entries`, `records`, `data`). Cùng bản chất với cửa đổi tên của
  `no-children-slot`: rule cấm một chữ, luật cấm một cái làn. Để đóng thật sự, phải khoá **tập slot
  cho phép** ở phía kiểu của bề mặt, không phải cấm từng tên ở phía chỗ gọi — nghĩa là trả việc về
  cho hàng rào kiểu, đúng như phần lớn luật này vốn đã làm.
- **Phía khai báo không bị canh.** Để đóng: thêm một kiểm tra chạy trong chính file kiểu của bề mặt,
  cấm thuộc tính `items` ở đó. Rẻ, và bịt được đúng chỗ mà cửa "tên làn khác" đang lộ ra.

**Toàn mô-đun**

- **`SLOTS-5` và `SLOTS-6` không có rule.** Đây không phải cửa lách của một rule, mà là một khoảng
  luật không có máy. Ghi ở đây để không ai đọc mô-đun này rồi tưởng cả luật đã được canh.
- **Không có thông tin kiểu.** Đây là trần của cả mô-đun. Mọi mục "để đóng cần thông tin kiểu" ở trên
  đều đâm vào cùng một quyết định, và quyết định ấy nên được cân **một lần** cho cả bộ rule, không
  phải cân riêng từng rule.

## Khi nào cần kiểm lại

- Nguồn công bố thêm, bớt hoặc đổi tên một rule.
- Một mã `SLOTS-<n>` được thêm, bỏ hoặc đổi nghĩa trong văn bản luật.
- Danh sách gốc thành phần hoặc danh sách shell được miễn thay đổi.
- Chuỗi `docs.description` của một rule được sửa cho khớp hành vi — mục 2 trong Findings phải được
  đóng lại khi đó.
- Có đề xuất bật thông tin kiểu cho bộ rule này.
- Một kho báo **không có vi phạm** cho một trong ba rule mà không kèm ca âm tính chứng minh rule có
  chạy.
- Xuất hiện một comment tắt rule trên diện rộng cho `no-inline-parameter-type` — đó là dấu hiệu phạm
  vi không có cổng tên file đã chạm phải tầng nó không nên chạm.
