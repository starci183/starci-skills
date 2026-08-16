---
id: fe-principles-motion-audit
title: audit.md
slug: /gates/principles/motion/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Chuyển động.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `motion`

Phản biện này kiểm xem luật có chọn được một cặp nhịp thời gian thường từ **thứ đã thật sự đổi giữa hai khung
hình**, và chỉ từ đó.

## Kết luận

Chấp nhận. Tập mã đóng, loại trừ lẫn nhau, và mọi phân định đều dựa vào một sự kiện quan sát được —
sự tồn tại, bố cục, đích đến, người gây ra, tuỳ chọn — chứ không dựa vào cảm giác về nhịp.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `MOTION-0` so với `MOTION-2` | Loại trừ được khi đã nêu ai gây ra thay đổi |
| `MOTION-0` so với `MOTION-3` | Loại trừ được khi đã nêu người dùng có chủ động yêu cầu hay không |
| `MOTION-1` so với `MOTION-2` | Loại trừ được khi đã nêu vật có tồn tại ở cả hai phía |
| `MOTION-2` so với `MOTION-3` | Loại trừ được khi đã so hai ảnh bố cục trước và sau |
| `MOTION-3` so với `MOTION-4` | Loại trừ được khi đã nêu đích đến đã biết hay chưa |
| `MOTION-4` so với `MOTION-0` | Loại trừ được khi đã nêu khoảng chờ có vượt ngưỡng cảm nhận |
| `MOTION-5` so với mọi mã | Loại trừ được vì hai tuỳ chọn không bao giờ hiển thị cùng lúc |
| Thiếu dữ kiện | Lấy mã im hơn; chỉ một câu hỏi khi bên yêu cầu nói rõ cần chuyển động lớn hơn |

Phép thử mạnh nhất của mô-đun này là **đọc ngược**: nhìn một chuỗi class CSS và nói ra mã của nó mà
không cần xem mã đánh dấu. Nó chạy được vì bốn họ class CSS không giao nhau — `transition-*` cho `1/2/3`,
`animate-*` vô hạn cho `4`, `motion-reduce:`/`motion-safe:` cho `5`, không class CSS cho `0` — và vì mỗi
cặp `duration` + `easing` chỉ thuộc một mã.

## Nhận định

- **Thuộc tính không phân định mã, cặp nhịp thời gian mới phân định.** Cả `MOTION-1` và `MOTION-2` đều có thể
  chạy `opacity`; cả `MOTION-2` và `MOTION-3` đều có thể chạy `transform`. Nếu để thuộc tính làm tiêu
  chí, luật vỡ ngay ở nút bị vô hiệu hoá và ở mũi tên vùng thu gọn. Ràng buộc "một cặp nhịp thời gian thuộc đúng
  một mã" là thứ giữ cho tập mã còn loại trừ được.
- **Ranh giới `MOTION-2` / `MOTION-3` được quy về một phép đo, không về cảm giác.** Câu hỏi là "có
  phần tử nào khác phải nhích, hoặc vật có tự trượt trong vùng chứa", trả lời được bằng cách so hai
  ảnh bố cục. Kích thước cảm giác của chuyển động đã bị loại khỏi tập tiêu chí.
- **Ranh giới `MOTION-3` / `MOTION-4` được quy về một sự kiện thời điểm.** "Đích đã biết chưa, ngay
  lúc chuyển động bắt đầu" là câu hỏi có đúng một câu trả lời và không mời thương lượng.
- **`MOTION-0` gánh phần khó nhất và đó là chủ ý.** Nó nhận cả bốn nhóm: không có gì đổi, chữ để đọc,
  thay đổi hệ thống đẩy xuống, và trang trí. Điểm chung là "không ai cần bám theo một vật đang di
  chuyển", và đó là một câu hỏi trả lời được. Nhóm thứ ba là nhóm bị bỏ sót nhiều nhất trong thực tế:
  cùng một chuyển động, đúng khi người dùng gây ra và sai khi máy chủ gây ra.
- **`MOTION-5` được nâng thành mã tình huống bằng cách đổi đơn vị phân loại.** Đơn vị không phải "một
  phần tử" mà là "một chuyển động được hiển thị dưới một tuỳ chọn". Đây là chỗ dễ đọc nhầm nhất của
  mô-đun và đã được nói rõ ở cả ba tài liệu.
- **Ngưỡng nhấp nháy ba lần một giây là sàn, không phải một mã.** Nó áp cho mọi mã và không có ngoại
  lệ nào mở ra được.
- **Phần mơ hồ còn lại chỉ nằm ở những yêu cầu bỏ sót người gây ra thay đổi.** Một yêu cầu nói "hàng
  chạy sang chỗ mới" mà không nói ai bấm thì không quyết được giữa `MOTION-3` và `MOTION-0`.

## Quyết định

- Giữ đúng sáu mã: `MOTION-0`, `MOTION-1`, `MOTION-2`, `MOTION-3`, `MOTION-4`, `MOTION-5`.
- Coi chuyển động là **lời khẳng định hai khung hình là cùng một vật**, do chính phần tử đổi sở hữu.
- Đóng thang thời lượng ở `100 · 150 · 200 · 300`, thủng ở `250`, `500`, `700`, `1000`, và chặn cứng
  ở `300` cho mọi thứ trừ vòng lặp `MOTION-4`.
- Cho `MOTION-1` giữ **hai** cặp nhịp thời gian, vì vào và ra là hai sự kiện không đối xứng.
- Cấm `transition-all` tuyệt đối, không có ngoại lệ nào.
- Bắt mọi chuỗi class CSS phát ra chuyển động mang sẵn vế `MOTION-5` của nó, để nghĩa vụ trợ năng không
  thể bị hoãn sang một lượt dọn dẹp sau.
- Mặc định lấy mã **im hơn**; chỉ hỏi một câu khi bên yêu cầu nói rõ cần chuyển động lớn hơn.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có thay đổi nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Lệch khỏi bộ nguồn: `MOTION-5` được định nghĩa lại thành một tình huống hiển thị, không phải một
  modifier.** Bộ nguồn gọi nó là "nghĩa vụ giảm chuyển động", mà nghĩa vụ thì chồng lên cả năm mã kia và
  phá vỡ yêu cầu "mỗi trường hợp rơi vào đúng một mã". Cách giữ cả hai là đổi đơn vị phân loại sang "một
  chuyển động dưới một tuỳ chọn": dưới `no-preference` phần tử là `MOTION-0`…`MOTION-4`, dưới
  `reduce` chính nó là `MOTION-5`, và hai tình huống không bao giờ đồng thời. Rủi ro còn lại là người
  đọc vẫn quen coi nó như một hậu tố; đó là lý do nó được nói rõ ba lần.
- **Lệch khỏi bộ nguồn: `MOTION-3` gộp "đổi vị trí" và "đổi kích thước" thay vì tách đôi.** Đã cân nhắc
  tách, và bỏ, vì cùng một sự thật: vật ở lại và hình học của nó đổi. Tách ra sẽ đẻ một ranh giới
  không đo được — một thanh bên thu hẹp vừa đổi cỡ vừa đẩy nội dung sang, và không có câu hỏi nào chia
  được nó.
- **Đã cân nhắc và bỏ một mã cho thị sai / chuyển động theo cuộn.** Nó luôn phân giải về `MOTION-0`
  (không mang nghĩa) hoặc `MOTION-5` (chỉ tồn tại khi được cho phép). Đặt một mã riêng cho nó là cấp
  giấy phép cho trang trí, và đó là điều mô-đun này tồn tại để chặn.
- **Đã cân nhắc và bỏ một mã cho tiến trình có phần trăm.** Nó là `MOTION-3` đúng nghĩa: một vật ở
  lại, đổi kích thước, đích đã biết. Một mã riêng sẽ làm mờ đúng ranh giới quan trọng nhất của
  `MOTION-4`.
- **`MOTION-0` gánh nhiều tình huống nhất** — không đổi, chữ để đọc, thay đổi hệ thống đẩy xuống,
  trang trí. Nếu thực tế cho thấy bốn nhóm này cần tách, đó là một đề xuất thay đổi luật, không phải
  một lần chọn khác đi.
- **Ngưỡng "chờ đủ dài để cảm nhận" của `MOTION-4` chưa được đóng thành một con số.** Đóng nó lại sẽ
  cho một phép thử sắc hơn, nhưng cũng sẽ khoá một con số mà từng sản phẩm đo khác nhau. Hiện tại nó
  là câu hỏi chứ chưa là hằng số.
- **Thang thời lượng có thể bị đọc thành thang liên tục.** Ai đó thấy `100`…`300` sẽ hỏi `250` đâu.
  Câu trả lời nằm ở `INDEX.md`: thang thủng là cố ý, vì thang liền mời người ta chia đôi.

## Điều kiện phản biện lại

- Có đề xuất thêm một giá trị `duration` hoặc một đường cong nhịp chuyển động mới.
- Có chuỗi class CSS mang `transition-*` hoặc `animate-*` mà thiếu vế `MOTION-5`.
- Có `transition-all` xuất hiện trở lại ở bất kỳ đâu.
- Có chuyển động chạy vì hệ thống đẩy dữ liệu xuống, không phải vì người dùng yêu cầu.
- Có trạng thái chỉ đọc được qua hoạt ảnh và không có chữ hoặc thuộc tính nào báo lại.
- Có vòng lặp bị gỡ dưới `reduce` mà không để lại chỉ báo tĩnh.
- Yêu cầu lặp lại mà một câu hỏi phân định vẫn không giải quyết được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
