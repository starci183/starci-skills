---
id: fe-lints-translation-audit
title: audit.md
slug: /gates/lints/translation/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức che phủ thật của hai luật máy giữ luật chữ nghĩa.
---

# audit.md

> Phiên bản: `2.00`

Phản biện này chỉ hỏi một câu: **những gì trang này nói máy bắt được, máy có thật sự bắt được không**
— và những gì máy không bắt được đã được viết ra hết chưa.

## Kết luận

Chấp nhận, kèm ba nhận định phải đọc trước khi tin vào một lần chạy xanh.

Tệp nguồn công bố **đúng hai** luật máy, khớp với con số dự kiến. Cả hai đều ánh xạ được vào một mã
luật có thật: `no-copy-resolution-below-block` → `COPY-1`, `no-hardcoded-copy-in-vocabulary` →
`COPY-2`. Không phải bịa ánh xạ nào.

Nhưng che phủ thì hẹp hơn tên gọi rất nhiều: **bốn trong sáu mã của luật không có luật máy**, và luật
thứ hai bỏ lọt đúng hình dạng mà ví dụ phản diện trong chính văn bản luật được viết ra. Kệ tài liệu
này chấp nhận được vì nó **nói ra** điều đó; bộ luật máy thì chưa đủ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số luật đếm được trong `rules` | 2 — `no-copy-resolution-below-block`, `no-hardcoded-copy-in-vocabulary` |
| Mỗi luật có một mã luật để giữ | Có: `COPY-1` và `COPY-2` |
| Mã luật nào không có luật máy | `COPY-3`, `COPY-4`, `COPY-6`; `COPY-5` được thoả bằng cấu trúc thư mục |
| Tên luật có bị đặt lại ở đây không | Không. Đề mục là tên đã công bố, đúng từng ký tự |
| Có mã số nào được bịa thêm cho luật máy không | Không. Danh tính là tên, và chỉ là tên |
| Luật máy có tự sửa mã không | Không. Cả hai `type: "problem"`, không `fixable` |
| Có cấu hình nới lỏng được không | Không. Cả hai `schema: []` |
| Mức nghiêm ngặt mặc định | `error`, sinh ra từ `recommended` cho mọi luật trong tệp |
| Cổng thư mục có chạy trên Windows không | Có. Mọi `\` được đổi thành `/` trước phép thử chuỗi con |
| Mỗi luật có ít nhất một cửa còn mở trung thực không | Có: mười lăm cửa, năm cửa chạm luật thứ nhất và mười hai chạm luật thứ hai |

## Phát hiện

1. **Luật thứ hai bỏ lọt hình dạng túi prop.** `<Input props={{ placeholder: "Search courses" }} />`
   không sinh báo cáo nào: thuộc tính tên là `props`, chuỗi nằm trong một `ObjectExpression`. Văn bản
   luật minh hoạ `COPY-2` bằng đúng hình dạng này, nên khoảng cách giữa điều được dạy và điều được
   giữ nằm ngay ở ví dụ trung tâm.

2. **Phép thử "trông như câu" chỉ biết bảng chữ ASCII.** `/^[A-Z]/` không nhận `Đ`, `Ê`, `Ô`, `Ơ`,
   `Ư`, `Á`, `Ổ`. Một luật sinh ra để người đọc ngôn ngữ khác không phải nhìn thấy tiếng Anh lại mù
   trước chữ viết bằng chính ngôn ngữ ấy — nên một tệp đã dịch dở dang vẫn xanh.

3. **Chữ một từ không được coi là chữ.** `Submit`, `Close`, `Avatar` đều lọt. Đây là hệ quả cố ý của
   một phép thử thô, và cái giá của nó phải được nêu thay vì được ngầm hiểu.

4. **Cả hai luật khớp cách viết, không khớp ký hiệu.** Đổi tên khi import, gọi dạng thuộc tính, hoặc
   gán rồi mới gọi đều thắng luật thứ nhất. Không có phân giải binding, không có kiểm đường dẫn
   import.

5. **Cổng thư mục vừa là tầm nhìn vừa là điểm gãy.** Tất cả sức mạnh của cả hai luật nằm trong một
   phép thử chuỗi con trên đường dẫn tệp. Đổi tên thư mục, thêm một tầng dưới block, hoặc lint bằng
   đường dẫn tương đối đều làm cả hai luật **im lặng tắt** — và một lần chạy tắt không phân biệt được
   với một lần chạy sạch.

6. **`COPY-3` là mã đắt nhất trong nhóm chưa có luật máy.** Một khoá dịch là một token đơn, chữ
   thường, không dấu cách: nó nằm ngoài mọi phép thử hiện có, trong khi hậu quả — kéo cả runtime
   xuống nửa vẽ hình — đúng bằng hậu quả mà `COPY-1` được lập ra để chặn.

7. **`COPY-6` gây báo động nhầm và không có kênh miễn trừ đúng nghĩa.** Một giá trị đem so khớp có
   dạng chữ nghĩa sẽ bị báo cáo. Luật đòi đánh dấu lý do trên dòng; máy chỉ chấp nhận một chỉ thị tắt
   luật, và chỉ thị đó không đòi lý do nào cả.

8. **Tên luật thứ nhất rộng hơn phạm vi thật của nó.** "Below block" trong tên là một quan hệ kiến
   trúc; thứ được kiểm là bốn tên thư mục. Một thành phần nằm dưới block mà đứng chỗ khác thì không
   thuộc tầm nhìn của luật, dù tên luật nói ngược lại.

9. **Luật thứ nhất cũng rộng hơn chữ "copy" trong tên nhóm.** `useFormatter` và `useLocale` không tra
   một câu; chúng tra một cách trình bày. Bắt chúng là đúng theo tinh thần phụ thuộc, nhưng người đọc
   tên luật sẽ không đoán ra.

## Quyết định

- Giữ đúng hai luật, đúng hai tên đã công bố, không đặt thêm mã số nào cho chúng.
- Ghi ánh xạ `COPY-1` và `COPY-2`, và ghi thẳng ra bốn mã còn lại là **luật chưa được giữ** thay vì
  bịa cho mỗi mã một luật máy.
- Bảng **Những chỗ còn lọt** là bắt buộc và đặt ngang hàng với bảng **Đã đóng** ở `INDEX.md`. Kệ tài liệu
  này tồn tại vì bảng đó.
- Không đề xuất luật máy mới ở đây. Một luật chưa trỏ tay vào được là một đề xuất, không phải một
  luật; mọi đề xuất nằm ở mục dưới.
- Ví dụ và văn xuôi không mang tên sản phẩm nào; tên luật, tiền tố `starci-fe/` và tên gói là định
  danh có thật nên được giữ nguyên.

## Rủi ro còn mở

Từng cửa còn mở, kèm thứ mà luật máy sẽ phải soi để đóng được nó — hoặc lý do đóng đắt hơn để mở.

| Những chỗ còn lọt | Muốn đóng thì phải soi gì | Đáng đóng không |
|---|---|---|
| Túi prop `props={{ … }}` | Đi vào `ObjectExpression` bên trong `JSXExpressionContainer` và kiểm từng `Property` có khoá nằm trong tập tên nhìn/nghe thấy | **Đáng.** Đây là hình dạng thường dùng nhất và là chỗ mù lớn nhất; chi phí là vài chục dòng visitor |
| Hằng số giặt sạch chuỗi | Phân giải binding qua scope, hoặc kiểm mọi `Literal` chuỗi trong tệp bất kể vị trí | **Nửa đáng.** Kiểm mọi `Literal` sẽ nổ vào khoá, className, tên biến; muốn đúng thì phải lần theo scope, đắt nhưng làm được trong một tệp |
| Template literal, nối chuỗi, ba ngôi | Mở rộng `attributeText` sang `TemplateLiteral` không có phần thay thế, `BinaryExpression` toàn chuỗi, `ConditionalExpression` hai nhánh chuỗi | **Đáng, và rẻ.** Ba nhánh thêm vào một hàm đã có sẵn |
| `{"…"}` giữa thẻ | Thêm visitor `JSXExpressionContainer` khi cha là `JSXElement` | **Đáng, và rẻ** |
| Câu bị chen biểu thức | Ghép các `JSXText` cùng cha lại rồi mới thử, thay vì thử từng đoạn | **Đáng.** Cần đổi chỗ đặt phép thử từ node sang phần tử cha |
| Chữ một từ | Bỏ điều kiện `/\s/` | **Chưa nên.** Bỏ ra thì nổ vào mọi token, khoá và giá trị; muốn đúng thì phải phân biệt từ hiển thị với token, đúng thứ mà phép thử thô cố tránh |
| Chữ hoa ngoài ASCII | Đổi `/^[A-Z]/` sang một phép thử Unicode, ví dụ `/^\p{Lu}/u` | **Đáng, và rẻ nhất trong bảng này.** Một ký tự trong biểu thức chính quy |
| Thuộc tính ngoài tập năm tên | Nới `VISIBLE_ATTRS`, hoặc kiểm mọi thuộc tính có tiền tố `aria-` cộng một danh sách tên prop mang chữ | **Nửa đáng.** Nới theo `aria-*` là an toàn; nới sang tên prop tự đặt sẽ thành danh sách không bao giờ đủ |
| `JSXSpreadAttribute` | Kiểm `ObjectExpression` trong spread giống như với túi prop | **Đáng**, và cùng một đoạn mã với dòng đầu bảng |
| Mảng và đối tượng chữ | Chỉ đóng được cùng lúc với hằng số giặt chuỗi | Xem dòng hằng số |
| Đổi tên khi import, gọi dạng thuộc tính, gán rồi gọi | Phân giải binding về đường dẫn import thay vì so tên | **Đáng.** Đây là hình dạng dễ vô tình rơi vào nhất trong nhóm này |
| Tên hàm tra chữ ngoài bốn tên | Kiểm **module specifier** của import thay vì tên hàm | **Đáng**, và đóng luôn dòng trên bằng cùng một cơ chế |
| Tra chữ ở tệp ngoài bốn thư mục rồi import vào | Phân tích liên tệp: lần theo đồ thị import từ một tệp trong tầm | **Không đáng ở tầng lint.** Chi phí và độ giòn của phân tích liên tệp vượt xa giá trị; chỗ này thuộc về soát mã |
| Đường dẫn tương đối làm cổng tắt | Chuẩn hoá đường dẫn về tuyệt đối, hoặc bỏ dấu `/` đầu khỏi phép thử chuỗi con | **Đáng, và rẻ.** Rủi ro hiện tại là im lặng, mà im lặng thì không ai phát hiện |
| Thư mục tầng mới không có trong danh sách | Không đóng được bằng cách liệt kê; cần một quy ước mà thư mục **tự khai** mình là tầng nhận chữ | **Chưa đóng được.** Ghi nhận là rủi ro thường trực, không phải một lần sửa |
| `COPY-3`, `COPY-4`, `COPY-6` không có luật máy | `COPY-3` cần một luật riêng nhìn tên prop kết thúc bằng `Key` và giá trị là token có dấu chấm; `COPY-4` trùng phần lớn với luật hàng rào dữ liệu ở nơi khác; `COPY-6` cần một dấu máy đọc được thay cho chú thích tự do | `COPY-3` **đáng làm và làm được**; `COPY-6` đáng, nhưng phải thống nhất một dấu trước đã |

## Khi nào cần kiểm lại

- Tệp nguồn thêm, bớt hoặc đổi tên một luật — kể cả khi hành vi không đổi.
- `VOCABULARY_DIRS`, `VISIBLE_ATTRS` hoặc `RESOLVES_COPY` đổi phần tử.
- `looksLikeProse` đổi phép thử, đặc biệt nếu chuyển sang Unicode.
- `attributeText` nhận thêm một loại node.
- Có luật nào mọc ra `schema` — lúc đó cấu hình trở thành một mặt phải kiểm.
- Văn bản luật thêm hoặc bỏ một mã `COPY-<n>`.
- Một lần chạy báo xanh trên một thư mục mà mắt người thấy chữ cứng: nghi cổng thư mục tắt trước khi
  nghi phép thử.
- Xuất hiện một tầng thư mục mới nằm dưới block.
