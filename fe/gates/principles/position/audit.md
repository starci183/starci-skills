---
id: fe-principles-position-audit
title: audit.md
slug: /gates/principles/position/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Vị trí.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `position`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **hai dữ kiện đã nêu** — giữ chỗ hay không,
và ai sở hữu toạ độ — và chỉ từ đó.

## Kết luận

Chấp nhận. Từ vựng đóng, tổng quát, không phụ thuộc tên sản phẩm hay thành phần nào. Sáu mã phủ kín
mọi phần tử được hiển thị, trong đó hai mã cố ý không phát ra class CSS.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `POSITION-1` so với `POSITION-2` | Loại trừ được khi **gọi tên được** con được định vị đang cần gốc toạ độ |
| `POSITION-1` so với `POSITION-3` | Loại trừ được khi đã nêu phần tử có phải chừa chỗ trong luồng hay không |
| `POSITION-2` so với `POSITION-3` | Loại trừ được khi đã nêu phần tử **là** gốc toạ độ hay **được đo** từ một gốc |
| `POSITION-3` so với `POSITION-4` | Loại trừ được khi đã nêu gốc toạ độ là phần tử tổ tiên hay khung nhìn |
| `POSITION-4` so với `POSITION-5` | Loại trừ được khi đã nêu nó dừng ở ranh giới vùng cuộn hay không |
| `POSITION-1` so với `POSITION-5` | Loại trừ được khi đã nêu cuộn phần tử tổ tiên **và** ngưỡng |
| `POSITION-3` so với `POSITION-6` | Loại trừ được khi đã nêu có vòng đời (va chạm, tiêu điểm, đóng) hay không |
| `POSITION-4` so với `POSITION-6` | Loại trừ được vì hai mã nằm trên hai phần tử khác nhau, không tranh nhau một phần tử |
| Thiếu dữ kiện | Giữ luồng; chỉ một câu hỏi cụ thể khi bên yêu cầu nói rõ cần hành vi rời luồng |

## Nhận định

- Vị trí nhìn thấy trên màn hình ("góc trên bên phải", "nổi lên trên") đã bị loại khỏi tập tiêu chí
  phân loại. Một bức ảnh tương thích với cả sáu mã, nên nó không phải bằng chứng.
- `relative` thừa là vi phạm **vô hình**: nó hiển thị y hệt như khi không có, và chỉ lộ ra khi một
  `POSITION-3` được thêm vào tầng sâu hơn và bám nhầm. Vì vậy `POSITION-2` được nâng thành một mã
  riêng, có nghĩa vụ chứng minh: phải gọi tên được con của nó.
- `fixed` và `sticky` bị nhầm nhiều nhất vì tiếng Việt lẫn tiếng Anh đều mô tả chúng bằng một câu:
  "luôn nhìn thấy". Phép thử dứt điểm đã được viết thành một hành động kiểm tra được: cuộn qua hết
  vùng chứa.
- `sticky` có ba điều kiện chứ không phải một, và hai trong ba (nền đục, không bị `overflow-hidden`
  ở phần tử tổ tiên cắt mất) hỏng **im lặng** — không lỗi, không cảnh báo, chỉ là hành vi không xảy ra.
- `absolute` và `fixed` không giữ chỗ, và hệ quả của điều đó luôn nằm ở **phần tử khác**: `pe-*` trên
  ô nhập liệu, `pb-*` trên `main`. Luật này chỉ đúng khi được đọc thành cặp hai tầng.
- `POSITION-1` và `POSITION-6` cùng không phát class CSS nhưng vì hai lý do ngược nhau. Đây là chỗ dễ đọc
  nhầm nhất của phiên bản này và đã được nói rõ ở cả ba tài liệu.
- Phần mơ hồ còn lại chỉ nằm ở những yêu cầu bỏ sót chủ sở hữu toạ độ hoặc bỏ sót hành vi giữ chỗ —
  và cả hai đều có sẵn một câu hỏi phân định.

## Quyết định

- Giữ đúng sáu mã: `POSITION-1`, `POSITION-2`, `POSITION-3`, `POSITION-4`, `POSITION-5`,
  `POSITION-6`.
- Từ vựng đóng: luồng thường, `relative`, `absolute`, `fixed`, `sticky`. Không có chế độ thứ sáu.
- Không bao giờ viết `static`; vắng mặt class CSS là một sự kiện khác với một khai báo.
- Khoảng tách chỉ được phát ra **sau khi** chủ sở hữu toạ độ và ranh giới đã rõ.
- Vị trí không bao giờ đổi thứ tự đọc, thứ tự tiêu điểm, khoảng cách hay căn chỉnh.
- Điểm neo chưa biết thì giữ luồng thường; câu hỏi chỉ dành cho yêu cầu nói rõ là cần hành vi rời luồng.
- Thiếu dữ kiện sinh ra **một** câu hỏi cụ thể, không sinh ra một toạ độ đoán mò.
- Trình đơn, chú giải, cửa sổ nổi, hộp thoại thuộc `POSITION-6`; bộ quy tắc không dựng lại vòng đời của chúng bằng
  class CSS thô, kể cả khi toạ độ đúng.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có phần tử nào nhỏ tới mức được miễn khai một mã.

## Rủi ro còn mở

- **Mã đánh số có thể bị đọc thành một cái thang.** Ai đó thấy `POSITION-1`…`POSITION-6` sẽ tưởng
  `POSITION-5` "mạnh hơn" `POSITION-3` và đi tìm mã ở giữa. Ở đây **không có thang**: số chỉ là thứ
  tự người đọc gặp. `INDEX.md` và `vi.md` đều nói rõ, nhưng rủi ro đọc nhầm vẫn còn.
- **`POSITION-6` là mã duy nhất từ chối phát ra kết quả.** Nó đúng, nhưng nó cũng là chỗ dễ bị lách
  nhất: người vội sẽ chép đoạn `absolute` được đánh dấu SAI trong `example.md` và bỏ phần giải thích.
  Nếu thực tế cho thấy điều đó xảy ra nhiều, đó là lý do để bổ sung một kiểm tra tĩnh luật, **không** phải lý
  do để hạ `POSITION-6` xuống thành `POSITION-3`.
- **Quyết định `1.03` về từ vựng màu chữ mờ đã bị gác lại.** Bản `1.03` chốt rằng ví dụ công khai
  dùng `text-muted-foreground`. Bản `2.00` dùng `text-neutral-500` vì nhóm này cấm mọi thứ chỉ tồn
  tại khi có một chủ đề cấu hình cụ thể. Quyết định cũ không bị xoá, nó được ghi lại ở đây như một phản
  đối còn mở: nếu nhóm sau này chấp nhận biến thiết kế màu là từ vựng chung, quyết định `1.03` nên được khôi
  phục qua một thay đổi luật chứ không phải qua một lần sửa lặng lẽ.
- **Tám ID hiển thị của bản `1.02`–`1.03` đã bị bỏ cùng bản xem trước trực tiếp.** Quyết định "giữ nguyên tám
  ID hiển thị" là một quyết định thật của bản cũ và nó không còn thoả được: bản xem trước đó hiển thị bằng
  thành phần của một sản phẩm cụ thể, thứ mà nhóm `principles/` cấm. Nếu cần lại bằng chứng hiển thị,
  nó phải nằm ngoài bộ quy tắc và không được là điều kiện để đọc hiểu luật.
- **`fixed` bên trong một phần tử tổ tiên có `transform` hoặc `filter` không còn đo theo khung nhìn.** Đây là
  một sự kiện của CSS, không phải một lựa chọn của bộ quy tắc, nhưng nó có thể làm một `POSITION-4` đúng
  luật hành xử sai. Hiện đang được ghi như một cái bẫy trong `example.md`; nếu nó gây lỗi lặp lại,
  nó xứng đáng thành một điều kiện bất biến.

## Điều kiện phản biện lại

- Có đề xuất thêm một chế độ vị trí mới, hoặc một mã thứ bảy.
- Một ví dụ dùng vị trí để giải quyết khoảng cách, căn chỉnh hoặc thứ tự nguồn.
- Một ví dụ trình đơn/chú giải/hộp thoại viết tay vòng đời tiêu điểm hoặc va chạm bằng class CSS thô.
- Thứ tự nhìn và thứ tự DOM tách khỏi nhau ở bất kỳ đâu.
- `relative` xuất hiện mà không gọi tên được con được định vị của nó.
- `sticky` xuất hiện thiếu ngưỡng hoặc thiếu nền đục.
- Một yêu cầu lặp lại mà một câu hỏi phân định vẫn không giải quyết được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
