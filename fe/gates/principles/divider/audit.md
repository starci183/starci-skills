---
id: fe-principles-divider-audit
title: audit.md
slug: /gates/principles/divider/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Đường phân cách.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `divider`

Phản biện này kiểm xem luật có chọn được **có kẻ hay không kẻ**, **ai kẻ**, và **kẻ theo trục nào** từ
những dữ kiện đã nêu, và chỉ từ đó.

## Kết luận

Chấp nhận. Tập mã đóng và tổng quát; mỗi đường kẻ có đúng một chủ sở hữu; và mã duy nhất trùng địa
phận với mô-đun khác đã được chuyển đi thay vì trả lời hai lần.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `DIVIDER-0` so với mọi mã | Loại trừ được khi đã nêu phần tử cha có hay không giữ khoảng trống qua khoảng cách giữa các phần tử |
| `DIVIDER-1` so với `DIVIDER-0` | Loại trừ được khi đã nêu các mục dính nhau hay cách nhau |
| `DIVIDER-1` so với `DIVIDER-2` | Loại trừ được khi đã nêu phần đó là thành viên hay là thứ gọi tên cả tập |
| `DIVIDER-1` so với `DIVIDER-3` | Loại trừ được khi đã nêu N-cùng-loại hay 2-khác-loại |
| `DIVIDER-2` so với `DIVIDER-3` | Loại trừ được khi đã nêu bên nào chi phối bên nào |
| `DIVIDER-1` so với `DIVIDER-5` | Loại trừ được khi đã nêu một ô có nghĩa nhờ một trục hay hai trục |
| `DIVIDER-3` so với `DIVIDER-4` | Loại trừ được khi đã nêu đường nằm giữa hai thứ hay quanh một thứ |
| `DIVIDER-2` so với `DIVIDER-6` | Loại trừ được khi đã nêu có phần tử nào sở hữu được cạnh đó không |
| Thiếu dữ kiện adjacency | Lấy `DIVIDER-0`; chỉ một câu hỏi khi bên yêu cầu nói rõ hai bên phải sát nhau |

## Nhận định

- Trục ngang/dọc đã bị loại khỏi tập tiêu chí phân loại. Trục là **hệ quả** của trục cái tập, nên nó
  không bao giờ là thứ chọn ra mã. Đây là chỗ dễ trượt nhất, vì tên class CSS (`divide-y`, `border-l`)
  đọc như thể trục là quyết định chính.
- Tiêu chí quyết định thật sự là **adjacency**, không phải hình thức. Câu hỏi "hai bên có chạm nhau
  không" tách được `DIVIDER-0` khỏi cả `DIVIDER-1`, `DIVIDER-2`, `DIVIDER-3` và `DIVIDER-5` bằng một
  dữ kiện duy nhất, quan sát được, không phụ thuộc thẩm mỹ.
- **Quyền sở hữu** được nâng lên ngang hàng với sự tồn tại của đường kẻ. Một bộ quy tắc chỉ nói "có kẻ"
  vẫn để lọt hai lỗi phổ biến nhất: `border-b` trên từng thành viên (thừa một đường ngoài) và hai vế
  cùng khai cạnh đối diện (đường dày gấp đôi). Cả hai lỗi này hiển thị ra "gần đúng", nên không có
  chủ-sở-hữu-là-một-phần-của-mã thì chúng không bao giờ bị bắt trong đánh giá.
- `DIVIDER-0` là câu trả lời của **đa số** các bố cục kết hợp, và nó là mã duy nhất được chọn khi thiếu dữ
  kiện. Điều này đặt gánh nặng chứng minh đúng chỗ: thêm một đường kẻ phải nêu được lý do, còn không
  kẻ thì không.
- `DIVIDER-4` là mã duy nhất không phát class CSS. Nó không bị bỏ đi vì bỏ đi thì đường bao trở thành một
  tình huống **không tên**, và một tình huống không tên là tình huống không ai bị bắt lỗi được — đúng
  lý lẽ mà `DIVIDER-0` đang dựa vào.
- Ngoại lệ điểm ngắt là chỗ duy nhất mã được phép đổi giữa hai kích thước màn hình, và nó đổi vì
  **quyền sở hữu ranh giới thật sự đổi tay** từ khoảng trống sang đường kẻ, không phải vì màn hình
  hẹp đi.

## Quyết định

- Giữ đúng bảy mã: `DIVIDER-0` … `DIVIDER-6`.
- Coi đường phân cách là **cách vẽ thứ hai của cùng một ranh giới mà khoảng trống đã có thể vẽ**, nên nó phải
  loại trừ nhau với khoảng cách chứ không cộng thêm vào khoảng cách.
- Đưa **chủ sở hữu** vào chính định nghĩa mã: tập-phần tử cha, dải, vế sau, ma trận + hàng, phần tử độc
  lập, hoặc không ai.
- Chuyển câu hỏi đường-bao sang luật quan hệ nhóm thay vì trả lời tại đây.
- Không phát ngôn về biến thiết kế màu, khoảng đệm bên trong, bo góc hay khoảng cách; những thứ đó có mô-đun riêng.
- Mặc định `DIVIDER-0` khi hai mã cùng khớp.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có kích thước cách kết hợp nào được miễn khai báo mã.

## Rủi ro còn mở

- **Lệch so với tập mã hạt giống, đã ghi lại ở đây theo yêu cầu.** Bản dựng này giữ sáu mã hạt giống
  nhưng sửa hai chỗ và thêm một mã:
  1. `DIVIDER-3` được định nghĩa lại từ "một đường kẻ **dọc** giữa hai vùng" thành "**một** khoảng cách giữa các phần tử giữa
     hai vùng ngang hàng, trục là hệ quả". Lý do: nếu trục nằm trong định nghĩa thì cùng một quan hệ
     sẽ đổi mã khi màn hình xếp chồng, và mã sẽ đo hình dạng thay vì đo quan hệ.
  2. `DIVIDER-4` giữ nguyên tình huống "đường bao quanh một đối tượng" nhưng **không phát class CSS**, vì
     câu hỏi đó là một tuyên bố tư cách thành viên và đã có mô-đun khác cân nó với hai lựa chọn mà
     mô-đun này không nhìn thấy. Trả lời ở đây là chính bộ quy tắc nói một ranh giới hai lần.
  3. Thêm `DIVIDER-6` — đường kẻ tự nó là một phần tử. Không có mã này thì hai tình huống rất hay gặp
     (ngắt chủ đề trong văn bản dài, và đường kẻ mang nhãn kiểu "hoặc" / "hôm nay") sẽ không có nhà,
     và tập mã không còn total. Chúng cũng không thể nhét vào `DIVIDER-2` hay `DIVIDER-3`, vì cả hai
     mã đó yêu cầu có một phần tử **sở hữu được** cạnh, mà ở đây thì không có.
- **Từ vựng thực tế đang mang hai tên cho cùng một biến thiết kế viền trung tính.** Mô-đun này viết tên mà
  luật màu sắc đang dùng và **không** sở hữu lựa chọn đó. Nếu hai tên được hợp nhất, đây là mô-đun bị
  sửa theo, không phải mô-đun quyết.
- **`DIVIDER-1` gánh nhiều tình huống nhất** — danh sách, hàng ô số liệu, kết quả tìm kiếm, các mục
  bấm được. Nếu thực tế cho thấy chúng cần tách, đó là một đề xuất thay đổi luật, không phải một lần
  chọn khác đi.
- **Ranh giới `DIVIDER-1` / `DIVIDER-5` phụ thuộc một phán đoán về nghĩa**, không phải về mã đánh dấu: các
  cột có so sánh được với nhau không. Một hàng hai cột và một hàng ma trận hai cột hiển thị giống hệt
  nhau. Đây là chỗ mơ hồ còn lại lớn nhất của mô-đun, và nó được xử bằng một câu hỏi phân định chứ
  không bằng một quy tắc đếm cột.
- **Ngoại lệ "đường kẻ mang nghĩa khác"** (thanh tiến độ, gạch chân thẻ tab đang chọn, trục biểu đồ) là
  một cửa mở: ai đó có thể gọi bất cứ đường kẻ nào là "mang nghĩa khác" để thoát khỏi luật. Rào chắn
  duy nhất hiện nay là những thứ đó phải nêu được **cái nghĩa** mà chúng mang, và "cho rõ ràng" không
  phải một cái nghĩa.

## Điều kiện phản biện lại

- Có `gap` và `divide-*` cùng tồn tại trên một phần tử cha.
- Có `border-b` đặt trên từng thành viên của một tập, kèm hay không kèm `last:border-b-0`.
- Có hai phần tử cạnh nhau cùng khai cạnh đối diện của nhau.
- Có đường kẻ nằm trên một cạnh không tiếp giáp với thứ gì.
- Có mã đổi giữa hai điểm ngắt mà quyền sở hữu ranh giới **không** đổi tay.
- Có yêu cầu thêm một mã cho một hình dạng đường kẻ mới thay vì cho một quan hệ mới.
- Có ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
