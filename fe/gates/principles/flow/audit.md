---
id: fe-principles-flow-audit
title: audit.md
slug: /gates/principles/flow/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Luồng.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `flow`

Phản biện này kiểm xem luật có chọn được một khai báo thường từ **dữ kiện đã nêu về tập con**, và chỉ từ
đó. Nếu một mã chỉ phân biệt được bằng cách nhìn màn hình, mã đó chưa đủ tư cách đứng trong bộ quy tắc.

## Kết luận

Chấp nhận. Tập mã đóng và tổng: mọi vùng chứa hiển thị ra nhiều hơn một thứ đều rơi vào đúng một mã, và
hai mã không phát ra class CSS nào vẫn là mã.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `FLOW-0` so với `FLOW-3` | Loại trừ được khi đã nêu số con ở **mọi** trạng thái, không chỉ trạng thái hôm nay |
| `FLOW-0` so với `FLOW-1` | Loại trừ được: một con, hay nhiều con nội tuyến trong một câu |
| `FLOW-1` so với `FLOW-2` | Loại trừ được bằng phép thử ngắt dòng: gãy **giữa** một phần có đúng không |
| `FLOW-2` so với `FLOW-4` | Loại trừ được khi đã nêu hậu quả của việc phần tử cuối rơi xuống dòng dưới |
| `FLOW-2` so với `FLOW-5` | Loại trừ được khi đã nêu cái gì nhường lúc hẹp: bề rộng của phần tử, hay cả trục |
| `FLOW-4` so với `FLOW-5` | Loại trừ được khi đã nêu phần tử có cần trọn bề rộng lúc hẹp hay không |
| `FLOW-4` so với `FLOW-7` | Loại trừ được bằng phép thử thẳng cột giữa hai dòng |
| `FLOW-6` so với `FLOW-7` | Loại trừ được khi đã nêu số cột đến từ nội dung hay từ bề rộng còn lại |
| `FLOW-6` so với `FLOW-8` | Loại trừ được bằng phép thử hoán đổi: đổi chỗ hai vùng thì nghĩa có đổi không |
| `FLOW-3` so với họ lưới | Loại trừ được bằng sự có mặt của một khai báo số cột ở đâu đó |
| Thiếu dữ kiện | Hỏi **một** câu phân định trong bảng ranh giới rồi dừng; không đoán bằng hình dạng |

## Nhận định

- **Trục là quyết định đứng trước mọi quyết định dựng hình khác.** Chưa có trục thì `gap` không tồn
  tại, và khoảng cách giữa các phần tử buộc phải rơi xuống `margin` của con. Vì vậy một chồng không khai báo `flex-col`
  không phải chuyện phong cách: nó ép người viết vi phạm luật của mô-đun khoảng cách.
- **Hai câu trả lời cho "hết bề rộng" là hai mã khác nhau, không phải hai cách viết.** Gãy dòng
  (`FLOW-4`) giữ nguyên trục; đổi trục (`FLOW-5`) bỏ hẳn trục ngang. Trước bản này, cả hai đều được
  gọi chung là "thiết kế đáp ứng", và đó là chỗ hai tình huống khác hẳn nhau bị trộn làm một.
- **Xuống dòng và lưới chỉ khác nhau ở việc thẳng cột.** Đây là phép thử rẻ nhất và dứt khoát nhất trong
  cả mô-đun, nên nó được đưa lên `INDEX.md` chứ không nằm lẫn trong ví dụ.
- **`minmax(0,1fr)` là một luật, không phải một mẹo.** `1fr` có sàn `min-content`, nên rãnh nội dung
  từ chối co lại và hậu quả hiện ra ở chỗ khác: `truncate` không tác dụng, trang trượt ngang. Lỗi
  này thường bị đi tìm ở mô-đun tràn nội dung, và đó là lý do nó phải được ghi ở đây.
- **`flex-row` gần như luôn thừa.** Bằng chứng trong kho đăng ký cho thấy `flex-row` xuất hiện bằng gần
  một nửa số lần của `flex-col`, trong khi hàng đã là trục mặc định. Phần lớn số đó là khai báo
  không mang thông tin, và phần còn lại là `FLOW-5` — nên luật chỉ cho `flex-row` sống trong đúng
  `FLOW-5`.
- **Phần mơ hồ còn lại nằm ở những yêu cầu không nói ra trạng thái rỗng, trạng thái một phần tử và
  ngôn ngữ dài nhất.** Đó là ba dữ kiện quyết định mà bản mô phỏng không bao giờ chứa.

## Quyết định

- Giữ đúng chín mã: `FLOW-0` … `FLOW-8`.
- Đánh số theo **họ**, không theo độ lớn: `0`–`1` không phát ra class CSS, `2`–`5` là họ một trục, `6`–`8`
  là họ lưới.
- Coi luồng là tuyên bố của **cha** về một tập con trực tiếp; con không khai báo trục của chính mình.
- Chỉ quyết **trục và xuống dòng**. Canh lề, kích thước khoảng cách giữa các phần tử, ai nhường bề rộng và khoảng đệm trong thuộc mô-đun
  khác; chúng có mặt trong ví dụ nhưng không bao giờ là lý do chọn mã.
- Điểm ngắt là **một phần của mã**, không phải một mã khác ở bề rộng khác.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có tập nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Lệch so với tập mã hạt giống, đã ghi lại đầy đủ.** Hạt giống có sáu mã: `FLOW-0` một con ·
  `FLOW-1` hàng · `FLOW-2` cột · `FLOW-3` hàng có xuống dòng · `FLOW-4` lưới số cột cố định · `FLOW-5` lưới
  theo bề rộng tối thiểu. Bản này giữ nguyên **tinh thần** của cả sáu nhưng đánh số lại và thêm ba
  mã:

  1. **Thêm `FLOW-1` (chữ nội tuyến trong một câu).** Nếu không có mã này thì việc đặt `flex` lên một
     đoạn văn không vi phạm gì cả — không có tình huống nào để đối chiếu. Một tình huống không có
     tên là tình huống không ai bị bắt lỗi được, và đây là lỗi hay gặp thật.
  2. **Thêm `FLOW-5` (hàng đổi thành chồng khi hẹp).** Nếu không có mã này thì
     `flex flex-col sm:flex-row` mang hai mã ở hai bề rộng, phá vỡ yêu cầu "mỗi trường hợp thuộc đúng một mã".
  3. **Thêm `FLOW-8` (rãnh có vai trò khác nhau).** Lưới số cột cố định nói "n thứ cùng loại"; một
     thanh dọc cộng vùng nội dung không phải như vậy. Gộp hai thứ này vào một mã chính là cách sinh ra
     `grid-cols-2` cho thanh dọc — một lỗi có thật và tốn kém.

  Hệ quả: hai mã lưới của hạt giống dời từ `4`/`5` xuống `6`/`7`. Đây là lệch **có ý thức**, đổi lấy
  việc số mã đọc được theo họ. Nếu về sau nhóm yêu cầu giữ nguyên số của hạt giống, đó là một luật
  thay đổi và phải đi qua `changelog.md`.

- **`FLOW-7` gánh cả `auto-fill` lẫn `auto-fit`.** Hai từ khoá cho hai hành vi khác nhau ở trạng thái
  một phần tử. Bản này coi đó là **một** tình huống với một tham số phải nói ra. Nếu thực tế cho thấy
  trạng thái một phần tử bị chọn sai lặp lại, việc tách làm hai mã là một đề xuất thay đổi luật, không
  phải một lần chọn khác đi.
- **`FLOW-2` hứa nhiều hơn nó tự làm được.** Nó tuyên bố "chỉ một dòng" nhưng không tự quyết ai
  nhường bề rộng — phần đó nằm ở mô-đun tràn nội dung. Ranh giới này đúng, nhưng nó là chỗ dễ dừng lại
  giữa chừng nhất: khai báo xong `FLOW-2` rồi quên mất nửa còn lại của quyết định.
- **Chín mã là nhiều.** Rủi ro là người đọc nhớ sáu mã và ép ba mã còn lại vào chúng. Cách chống đỡ
  duy nhất trong bản này là bảng phân định ranh giới: mỗi cặp kề nhau có đúng một câu hỏi, và câu
  hỏi đó trả lời được bằng nghiệp vụ chứ không bằng mắt.

## Điều kiện phản biện lại

- Có đề xuất thêm một mã mới, hoặc gộp hai mã đang có.
- Xuất hiện `flex-row` ở một chỗ không phải `FLOW-5`.
- Xuất hiện `1fr` không bọc `minmax(0,…)` ở rãnh nội dung.
- Một lưới do dữ liệu quyết độ dài lại mọc thêm điểm ngắt thứ ba.
- Khung chờ và nội dung thật dùng hai mã khác nhau.
- `*-reverse` hoặc `order-*` được dùng để sửa thứ tự đọc.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
