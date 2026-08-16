---
id: fe-principles-typography-audit
title: audit.md
slug: /fe/principles/typography/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Kiểu chữ.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `typography`

Phản biện này kiểm xem luật có chọn được một công thức `className` thường từ **cấp độ dàn ý và nội dung
quyền sở hữu đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận. Vốn từ đóng, hai dữ kiện quyết định là nghiệp vụ chứ không phải thị giác, và không công thức
nào phụ thuộc tên sản phẩm hay tên thành phần nào.

Điểm mới cần theo dõi ở phiên bản này: thang không còn là một dãy số như mô-đun `gap`, nên mã được
đánh từ `1` theo **thứ tự người đọc gặp**. Đổi lại, không thể suy ra "mã lớn hơn thì chữ to hơn" —
`TYPOGRAPHY-8` to hơn `TYPOGRAPHY-5`, và `TYPOGRAPHY-11` không phát ra gì. Điều này đã được nói rõ ở
cả `INDEX.md` lẫn `vi.md`, nhưng nó là chỗ đọc nhầm dễ xảy ra nhất.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TYPOGRAPHY-1` so với `TYPOGRAPHY-2` | Loại trừ được khi đã nêu tuyến trang và cái tên bao trùm |
| `TYPOGRAPHY-2` so với `TYPOGRAPHY-5` | Loại trừ được khi đã nêu dòng này thuộc cấu trúc trang hay thuộc dữ liệu |
| `TYPOGRAPHY-3` so với `TYPOGRAPHY-6` | Loại trừ được khi đã nêu ai sinh ra cái tên: thiết kế hay một hàng dữ liệu |
| `TYPOGRAPHY-4` so với `TYPOGRAPHY-9` | Loại trừ được khi đã nêu dòng này có buộc phải nằm trong dàn ý không |
| `TYPOGRAPHY-5` so với `TYPOGRAPHY-6` | Loại trừ được khi đã nêu tính duy nhất **và** rủi ro dài |
| `TYPOGRAPHY-6` so với `TYPOGRAPHY-7` | Loại trừ được khi đã nêu dòng này gọi tên hay phát biểu |
| `TYPOGRAPHY-7` so với `TYPOGRAPHY-8` | Loại trừ được khi đã nêu công việc đọc là quét hay đọc liên tục |
| `TYPOGRAPHY-7` so với `TYPOGRAPHY-9` | Loại trừ được bằng phép thử tách khỏi dòng chính |
| `TYPOGRAPHY-9` so với `TYPOGRAPHY-10` | Loại trừ được khi đã nêu dòng gắn vào một dòng hay chia một luồng |
| `TYPOGRAPHY-10` so với `TYPOGRAPHY-2` | Loại trừ được khi đã nêu dấu do dữ liệu hay do thiết kế sinh ra |
| `TYPOGRAPHY-11` so với mọi mã | Loại trừ được bằng vị trí: trong thành phần điều khiển hay cạnh thành phần điều khiển |
| Thiếu chủ sở hữu | Trả `TYPOGRAPHY-12`; chỉ hỏi một câu khi bên yêu cầu thật sự muốn thăng cấp |
| Xin độ sâu 5 | Không phát công thức; hỏi phẳng lại dàn ý. Đây là ngoại lệ duy nhất kiểu này |

## Nhận định

- Tính từ thị giác đã bị loại khỏi tập tiêu chí: "nổi", "to", "đậm", rê chuột, khoảng trống, điểm ngắt
  và ảnh chụp màn hình không còn là dữ kiện đầu vào.
- Hai dữ kiện cấp độ dàn ý và quyền sở hữu nội dung đủ để phân định mọi trường hợp thường gặp trong
  `example.md`.
- `text-xs` gắn liền với giảm nhấn; ngoại lệ duy nhất là `TYPOGRAPHY-4`, và ngoại lệ ấy được phân biệt
  bằng **hai** dấu hiệu cùng lúc (`font-medium` và phần tử `h4`), không phải một.
- Trần bốn bậc tiêu đề là chỗ duy nhất mô-đun trả lời bằng câu hỏi. Mọi chỗ còn lại đều có công thức.
- `TYPOGRAPHY-11` được nâng thành **mã tình huống** trong khi vẫn cấm phát ra class CSS chữ. Đây là chỗ
  dễ đọc nhầm thứ hai của phiên bản này và đã được nói rõ ở cả ba tài liệu: mã đặt tên cho một tình
  huống, công thức đặt tên cho một dáng chữ, và tình huống này không có dáng chữ nào để nơi gọi tuyên.
- `TYPOGRAPHY-12` là sàn công khai, không phải điểm dừng giả. Bảng công khai không bao giờ trả về một
  lời từ chối.

## Quyết định

- Giữ đúng mười hai mã, `TYPOGRAPHY-1` … `TYPOGRAPHY-12`, đánh số theo thứ tự người đọc gặp.
- Giữ nguyên **mọi công thức** của phiên bản `1.03`. Không công thức nào bị đổi cỡ, đổi độ đậm hay đổi
  tông trong lần viết lại này; chỉ cách trình bày và độ phủ ví dụ thay đổi.
- Cấp độ dàn ý quyết định **cả** phần tử ngữ nghĩa **lẫn** cấp bậc hiển thị, một chủ sở hữu duy nhất.
- Trần bốn bậc tiêu đề giữ nguyên; độ sâu 5 là yêu cầu phẳng lại cấu trúc nội dung.
- `TYPOGRAPHY-5` cần đủ hai dữ kiện; thiếu một là rơi xuống `TYPOGRAPHY-6`.
- `text-xs` không tách khỏi giảm nhấn, trừ `TYPOGRAPHY-4`.
- Chữ do thành phần điều khiển sở hữu không nhận ghi đè từ ngoài, và mã ấy thắng mọi mã khác.
- Mặc định lấy mã **giành ít quyền sở hữu hơn**; chỉ hỏi một câu khi bên yêu cầu nói rõ cần quyền
  lớn hơn.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm, không bản xem trước trực tiếp.
- Luật là **bắt buộc**: không có dòng chữ nào ngắn tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Mã không phải thang.** Ai quen mô-đun `gap` sẽ đọc `TYPOGRAPHY-<n>` như một thang tăng dần và
  suy ra sai. Câu trả lời nằm ở `INDEX.md`: mô-đun này không có thang số, mã chỉ là chỉ số theo thứ
  tự đọc. Nếu thực tế cho thấy người đọc vẫn suy ra thang, đó là một đề xuất đổi cách đánh mã, không
  phải một lần chọn khác đi.
- **Cặp `TYPOGRAPHY-4` / `TYPOGRAPHY-9` vẫn là chỗ mỏng nhất.** Hai công thức chỉ khác nhau ở
  `font-medium` so với `font-normal` cộng với phần tử. Một `h4` bị viết thành `p` sẽ trông đúng và
  sai dàn ý; kiểm tra tĩnh kiểu thị giác không bắt được. Đây là chỗ nên có một kiểm tra tự động soi phần tử
  chứ không soi class CSS.
- **`TYPOGRAPHY-7` gánh nhiều tình huống nhất** — mô tả, siêu dữ liệu, giá trị, câu trạng thái. Nếu thực
  tế cho thấy bốn thứ đó cần tách, đó là một đề xuất thay đổi luật, không phải một lần chọn khác đi.
- **`text-foreground` và `text-muted-foreground` là biến thiết kế, không phải giá trị.** Mô-đun tuyên bố mọi
  chủ đề phải định nghĩa đúng hai tông nội dung. Một giao diện chỉ có một tông sẽ không diễn đạt được
  `TYPOGRAPHY-9`. Giữ nguyên quyết định này của phiên bản trước, và ghi lại đây như một điều kiện
  tiên quyết chưa được kiểm chứng ở nơi khác.
- **Phản đối được ghi lại, không tự sửa.** `TYPOGRAPHY-12` cho phép trả về một công thức khi yêu cầu
  chưa nêu chủ sở hữu. Có thể lập luận rằng như vậy là hợp thức hoá việc không hỏi, và một luật bắt buộc
  thì nên dừng lại thay vì đoán. Phiên bản `1.03` đã cân nhắc và chọn sàn đọc được vì bảng công khai
  không được trả về điểm dừng giả. Quyết định ấy được **giữ nguyên**; phản đối ghi ở đây để lần phản biện
  sau còn thấy.
- **Truncate và xuống dòng vẫn nằm ngoài luật.** Mô-đun từ chối quyết định chuyện đó, nên một tiêu đề dài
  vẫn có thể vỡ bố cục mà không mã nào sai. Cần một luật khác sở hữu reachability.

## Điều kiện phản biện lại

- Thang tiêu đề tăng hoặc giảm một bậc.
- Bất kỳ công thức đóng nào đổi cỡ, độ đậm hoặc tông.
- Xuất hiện một công việc chữ mới mà cấp độ dàn ý và quyền sở hữu nội dung không phân định được.
- Một bộ hiển thị cho thấy cấp bậc khác nhau giữa trạng thái settled và đang tải/rỗng/lỗi.
- Có `text-xs` không giảm nhấn mà không phải `h4`.
- Có chữ do thành phần điều khiển sở hữu bị đè kiểu chữ từ nơi gọi.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
