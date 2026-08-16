---
id: fe-principles-margin-audit
title: audit.md
slug: /gates/principles/margin/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Lề ngoài.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `margin`

Phần phản biện này kiểm xem luật có chọn được một class CSS thông thường từ **dữ kiện bố cục đã nêu**, và chỉ từ đó — và
quan trọng hơn, có từ chối được đúng những chỗ lề ngoài không có việc gì để làm hay không.

## Kết luận

Chấp nhận. Tập đóng ở năm mã, phủ được việc xoá lề ngoài, căn giữa và phân phối phần dư bằng lề ngoài tự
động mà không cần tới một giá trị lề ngoài đo bằng số nào. Không mã nào phụ thuộc tên sản phẩm hay
thành phần.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `MARGIN-0` so với `MARGIN-1` | Loại trừ được khi đã gọi tên lề ngoài đang tồn tại và ai đặt nó |
| `MARGIN-0` so với `MARGIN-2` | Loại trừ được khi đã nêu ràng buộc chiều rộng |
| `MARGIN-0` so với `MARGIN-3` | Loại trừ được khi đã nêu phần tử cha là hàng flex và quan hệ con trực tiếp |
| `MARGIN-0` so với `MARGIN-4` | Loại trừ được khi đã nêu nguồn chiều cao của cột |
| `MARGIN-2` so với `MARGIN-3` | Loại trừ được khi đã nêu phần dư chia đôi hay dồn một phía |
| `MARGIN-3` so với `MARGIN-4` | Loại trừ được khi đã nêu trục còn dư chỗ |
| Lề ngoài tự động so với phân bố ở phần tử cha | Loại trừ được khi đã nêu **một** phần tử con dịch hay **mọi** phần tử con xếp lại |
| Yêu cầu về khoảng cách giữa các phần tử cùng cấp | Định tuyến về khoảng cách của phần tử cha; không tạo lề ngoài |
| Yêu cầu về khoảng thở bên trong | Định tuyến về khoảng đệm trong của chủ ranh giới; không tạo lề ngoài |
| Thiếu dữ kiện bố cục | Tạo `MARGIN-0`; chỉ một câu hỏi khi bên yêu cầu nói rõ cần lề ngoài tự động |

## Nhận định

- Các “công thức bố cục” gắn với một ứng dụng cụ thể không phải luật thiết kế phổ quát và đã bị rút
  khỏi bộ quy tắc từ trước; phiên bản này giữ nguyên quyết định đó.
- Lề ngoài âm mời gọi việc vượt qua ranh giới sau lưng người sở hữu ranh giới, nên nó nằm ngoài
  mọi mã. Nó không bị "hạn chế" — nó không có mã nào để mà thuộc về.
- Lề ngoài đo bằng số cũng vậy. Đây là quyết định gắt nhất của mô-đun và là quyết định mà nó tồn tại để
  bảo vệ: một khi `mt-4` hợp lệ ở một chỗ, khoảng cách sẽ bắt đầu sống ở hai nơi và không nơi nào tra được.
- Lề ngoài tự động chỉ xác định được khi trục và phần dư được nêu ra. Không nêu thì kết quả không đoán
  trước được, và một class CSS không có tác dụng còn tệ hơn không có class CSS: nó là một lời giải thích sai
  để lại vĩnh viễn.
- `m-0` chỉ an toàn khi có một lề ngoài đang tồn tại được gọi tên. Viết `m-0` "cho chắc" là bịa ra một
  sự thật về DOM.
- `MARGIN-0` được nâng thành **mã tình huống** trong khi `m-0` vẫn thuộc một mã riêng. Đây là chỗ dễ
  đọc nhầm nhất của phiên bản này và đã được nói rõ ở cả ba tài liệu: hai mã là hai lời khẳng định khác
  nhau, một cái nói *không ai đặt lề ngoài ở đây*, một cái nói *có người khác đặt và tôi biết là ai*.

## Quyết định

- Giữ đúng năm mã: `MARGIN-0`, `MARGIN-1`, `MARGIN-2`, `MARGIN-3`, `MARGIN-4`.
- Tập className đóng ở: không class CSS, `m-0`, `mx-auto`, `ms-auto`, `mt-auto`.
- Coi lề ngoài là **vị trí bên ngoài của một phần tử**, không phải một hệ thống khoảng cách.
- Định tuyến nhịp giữa các phần tử cùng cấp về mô-đun khoảng cách và khoảng đệm bên trong về mô-đun khoảng đệm trong. Mô-đun này chỉ
  **từ chối** hai việc đó, không quyết lại chúng.
- Dùng lề ngoài chiều ngang theo lô-gic thay vì giả định trái/phải vật lý.
- Mặc định không viết lề ngoài khi hình học chưa rõ; chỉ hỏi một câu về bố cục của phần tử cha khi bên yêu cầu
  nói rõ họ cần lề ngoài tự động.
- Tràn toàn chiều rộng và phần tử chồng lớp là cấu trúc bố cục và bài toán định vị, không phải giấy
  phép dùng lề ngoài âm.
- Luật là **bắt buộc**: không có phần tử nào nhỏ, sâu hay tạm tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Chỉ mục bằng số không tự nói ra nó làm gì.** Đọc `MARGIN-3` không biết ngay đó là `ms-auto`, trong
  khi mã chữ trước đây nói thẳng. Đây là chỗ dễ bị chất vấn nhất của phiên bản này, và cái giá đó
  được trả có ý thức: một mã chỉ **trích dẫn được** khi cách đặt tên không có ngoại lệ nào, mà mã chữ
  thì buộc phải có ngoại lệ ngay từ mã đầu tiên — `MARGIN-0` là số, bốn mã kia là chữ, nên không có
  câu nào nói đúng được cả năm. Nghĩa không mất đi: nó nằm ở **cột Tình huống**, chỗ xoá lề ngoài,
  `mx-auto`, `ms-auto` và `mt-auto` vẫn được gọi tên, và mọi tài liệu đều dẫn mã kèm cột đó.
- **Số có thể bị đọc nhầm thành thang đo, khác với các mô-đun cùng nhóm.** Ai quen `GAP-1`…`GAP-8`
  sẽ tưởng `MARGIN-2` "lớn hơn" `MARGIN-1`. Câu trả lời nằm ở `INDEX.md`: lề ngoài không phải một nhịp,
  nên không có gì để so xa gần; con số chỉ là thứ tự đọc, và mỗi mã là một việc đặt chỗ, hoặc áp dụng
  hoặc không.
- **`MARGIN-0` gánh gần như toàn bộ mặt bằng.** Một mã đúng trong 99% trường hợp có nguy cơ bị đọc
  thành "mặc định khỏi nghĩ". Phản biện: chính vì nó phổ biến nên nó phải có tên — thứ không có tên
  thì không ai bị bắt lỗi được khi làm sai, và bốn mã kia chỉ có nghĩa khi tồn tại một mã để chúng
  phải chứng minh mình khác.
- **Cấm tuyệt đối lề ngoài đo bằng số có thể bị coi là quá gắt** với những phần tử thật sự đứng một
  mình ngoài mọi bố cục của phần tử cha. Quyết định cũ giữ nguyên: những phần tử như vậy hoặc không tồn tại,
  hoặc là dấu hiệu cha đang thiếu. Nếu thực tế cho thấy có một lớp trường hợp thứ ba, đó là một đề
  xuất thay đổi luật, không phải một lần chọn khác đi trong một thành phần.
- **`mb-auto` và `me-auto` bị bỏ khỏi tập đóng.** Chúng là đối xứng hợp lệ về mặt CSS nhưng chưa có
  tình huống nghiệp vụ nào trong mô-đun này cần tới; giữ tập nhỏ để mọi lần dùng đều tra được. Nếu
  một tình huống thật xuất hiện, mở bằng một mã mới, không mở bằng cách nới nghĩa mã cũ.

## Điều kiện phản biện lại

- Lề ngoài đo bằng số hoặc lề ngoài âm trở nên phổ biến trong giao diện thông thường.
- Lề ngoài tự động được áp dụng khi không có khoảng trống trên trục tương ứng.
- `ml-auto`/`mr-auto` vật lý thay chỗ `ms-auto` lô-gic mà không có lý do bắt buộc.
- Xuất hiện hai `ms-auto` trong cùng một hàng, hoặc hai `mt-auto` trong cùng một cột.
- `m-0` xuất hiện trên phần tử không có lề ngoài mặc định nào.
- Có một việc đặt chỗ mới không diễn đạt được bằng tập đóng năm mã.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
