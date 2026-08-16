---
id: be-patterns-event-delivery-audit
title: audit.md
slug: /be/patterns/event-delivery/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức giữ và khả năng chống bịa của luật event delivery.
---

# audit.md

> Version: `2.00` · Module: `event-delivery`

Audit này kiểm hai chuyện. Một: luật có chọn được đúng một mã từ **dữ kiện nghiệp vụ đã nêu**, và chỉ
từ đó. Hai: bảng `Tầng giữ` có nói thật về việc thứ gì đang thực sự giữ mỗi mã hay không.

## Verdict

Chấp nhận. Sáu mã đóng, mỗi mã neo được vào code thật đang chạy. Nhưng phải đọc kèm một điều kiện:
**bốn trên sáu mã không có gì cơ học giữ**, và hai mã còn lại chỉ được giữ **tại đúng một file**. Đây
là một luật chủ yếu do người đọc giữ, và nó được viết cẩn thận chính vì lý do đó.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `DELIVERY-1` vs `DELIVERY-3` | Loại trừ được khi đã nêu envelope **có** danh tính hay chưa |
| `DELIVERY-1` vs `DELIVERY-4` | Loại trừ được khi đã nêu digest đã tồn tại hay chưa |
| `DELIVERY-2` vs `DELIVERY-6` | Loại trừ được khi đã nêu đang thiếu lời khai hay thiếu bằng chứng |
| `DELIVERY-3` vs `DELIVERY-4` | Loại trừ được khi đã nêu bản sao đến từ chính pod này hay từ broker |
| `DELIVERY-5` vs `DELIVERY-6` | Loại trừ được khi đã nêu vấn đề nằm ở assertion hay ở số instance |
| Thiếu dữ kiện phạm vi | Hỏi đúng một câu: ai phải phản ứng — process này, hay mọi process giữ kết nối? |

## Findings

- Transport bị loại khỏi tập tiêu chí phân loại. Mã được chọn từ **hậu quả** và **phạm vi**, không
  từ tên broker; điều đó giữ cho luật vẫn đúng nếu transport bị thay.
- Thứ tự là toàn bộ nội dung của `DELIVERY-3` và `DELIVERY-4`. Cả hai mã đều có thể có mặt đầy đủ về
  mặt code mà vẫn sai, chỉ vì đứng sau lời gọi emit. Rule cũng kiểm đúng thứ tự đó chứ không kiểm sự
  tồn tại.
- Một rule giữ **hai** mã. `nats-bridge-delivery-contract` báo hai message độc lập, `origin` và
  `digest`, nên đếm thành hai dòng `enforced` là đếm đúng. Số rule không phải số mã.
- Rule chỉ chạy trên **một đường dẫn file**. Nó thoát ngay nếu tên file không kết thúc bằng đường dẫn
  của service bridge trung tâm. Một bridge thứ hai đặt ở chỗ khác sẽ không được giữ, và gate vẫn
  xanh.
- Rule kiểm bằng **tìm chuỗi trên toàn văn bản file**, không đi theo luồng điều khiển. Một guard nằm
  trong nhánh không bao giờ chạy, hoặc một chuỗi nằm trong comment, vẫn làm rule hài lòng.
- `DELIVERY-2` có một chỗ hở về mặt kiểu: `configMap` là một object literal không bị ràng buộc bởi
  kiểu nào, và metadata mà bridge dùng để lọc khai `useNats` là **optional**. Không có gì ngăn một
  entry mới ra đời mà thiếu cờ.
- `DELIVERY-1` cũng vậy: envelope được dựng qua một kiểu `Partial<>`, và `digest` là optional để
  chừa chỗ cho ngoại lệ heartbeat. Chính chỗ chừa đó là chỗ một event nghiệp vụ có thể lọt qua.
- Bốn trên sáu mã là thuộc tính của một quyết định nằm **ngoài** file mà rule nhắm tới: `DELIVERY-1`
  ở factory, `DELIVERY-2` ở config, `DELIVERY-5` và `DELIVERY-6` ở việc một test đã chọn khẳng định
  gì và boot mấy process.

## Decisions

- Giữ đúng sáu mã: `DELIVERY-1` … `DELIVERY-6`. Không đổi số, không đổi nghĩa, không thêm mã thứ bảy.
- Giữ nguyên mọi quyết định của bản luật phẳng: envelope mang danh tính và digest; transport khai
  theo event; bỏ self-origin trước emit; giành digest trước emit; assert người nhận và nội dung;
  chứng minh bằng hai instance thật.
- Ghi `enforced` cho `DELIVERY-3` và `DELIVERY-4`, có nêu tên rule và tên message; ghi `documented`
  cho bốn mã còn lại thay vì làm tròn lên.
- Ghi `unrepresentable` cho **không mã nào**. Không có union đóng hay branded type nào ở đây làm cho
  giá trị sai trở thành không viết được.
- Nâng các ngoại lệ vốn nằm rải trong văn xuôi của bản phẳng thành ngoại lệ **đóng**, mỗi ngoại lệ
  nêu rõ mã nó áp vào — đặc biệt là heartbeat không digest, và phạm vi cache digest là cục bộ.
- Giữ mọi ví dụ ở dạng TypeScript/NestJS tổng quát, không tên sản phẩm, không tên module riêng.

## Rủi ro còn mở

- **`DELIVERY-1` chỉ `documented`.** Một rule giữ được nó sẽ phải thấy: mọi lời gọi tới hàm dựng
  envelope đều đặt `id` từ một lời gọi dịch vụ instance (không phải từ tham số subject), và đặt
  `digest` từ chính đối tượng payload. Viết được, nhưng nó phải nhận diện đúng **một** factory theo
  tên và sẽ mù ngay khi có factory thứ hai. Phần "digest băm từ nội dung chứ không từ thời điểm" thì
  không rule nào thấy được, vì đó là một tính chất của giá trị lúc chạy, không phải của cú pháp.
- **`DELIVERY-2` chỉ `documented`.** Rule sẽ phải thấy: mọi property của `configMap` đều có cả
  `useLocal` lẫn `useNats` là literal boolean. Cái này **hoàn toàn viết được** và là ứng viên rẻ
  nhất trong cả module — một quy tắc AST duyệt các property của object literal đã export tên
  `configMap`. Có một cách còn rẻ hơn và không cần rule: ràng `configMap` vào một kiểu
  `Record<EventName, { useLocal: boolean, useNats: boolean, eventPayload: unknown }>` và bỏ dấu `?`
  ở metadata mà bridge dùng để lọc. Làm thế thì mã này chuyển thẳng lên `unrepresentable`. Cả hai
  đều là **đề xuất**, không phải luật; chừng nào chưa làm, dòng này vẫn phải đọc là `documented`.
- **`DELIVERY-5` chỉ `documented`.** Rule sẽ phải thấy một file test realtime mà **mọi** assertion
  đều là phép đếm, và không assertion nào chạm tới danh tính người nhận hoặc trường trong payload.
  Hình dạng này giống rule "spec chỉ toàn call assertion" ở module test, nên không phải bất khả. Cái
  không rule nào thấy được là nửa quan trọng hơn: **người ngoài cuộc không nhận được gì**. Không có
  cú pháp nào phân biệt được một assertion phủ định đúng chỗ với một assertion phủ định vô nghĩa.
- **`DELIVERY-6` chỉ `documented`.** Rule sẽ phải thấy một file khẳng định về hành vi xuyên instance
  mà chỉ boot **một** app, hoặc mock kết nối broker. Số app boot lên thì đếm được bằng cú pháp; còn
  "hai app này có thật sự là hai instance độc lập trên một broker thật hay không" thì không. Đây là
  mã yếu nhất về mặt cơ học, và cũng là mã mà **phép thử âm bản** trong `example.md` là biện pháp
  thay thế thật sự: xoá guard self-origin, chạy lại, và test phải đỏ.
- **Hai mã `enforced` chỉ được giữ tại một đường dẫn.** Rule thoát ngay nếu tên file không khớp
  đường dẫn service bridge trung tâm. Nếu ngày mai có bridge thứ hai, `DELIVERY-3` và `DELIVERY-4`
  trên thực tế tụt xuống `documented` cho bridge đó mà bảng này vẫn ghi `enforced`. Đây là rủi ro
  đọc nhầm nguy hiểm nhất của module, vì gate vẫn xanh.
- **Rule tìm chuỗi, không đọc luồng.** Nó so vị trí xuất hiện của ba chuỗi trong toàn văn bản file.
  Một guard đúng đặt trong nhánh chết, hoặc một chuỗi trong comment, vẫn làm nó hài lòng. Rule đang
  giữ **thứ tự viết ra**, không giữ **thứ tự chạy**. Đây là chỗ luật và enforcement lệch nhau, và nó
  được ghi ra đây thay vì được sửa im lặng.
- **`DELIVERY-3` và `DELIVERY-4` gánh chung một rule.** Nếu một trong hai cần siết riêng, việc tách
  rule là một thay đổi enforcement chứ không phải một lần chọn khác đi. Số mã vẫn là sáu.
- **Nghi vấn về đánh số, giữ nguyên theo luật.** `DELIVERY-3` và `DELIVERY-4` mô tả hai mặt của cùng
  một bất biến "đúng một hậu quả mỗi instance", và có lập luận rằng chúng nên là một mã với hai vế.
  Chúng **không** bị gộp: hai mã này được trích dẫn từ nơi khác, và gộp lại sẽ làm hỏng một trích
  dẫn đã có người viết ra. Ghi lại ở đây theo đúng chỗ dành cho bất đồng.

## Re-audit Triggers

- Xuất hiện một bridge thứ hai, hoặc file bridge trung tâm bị đổi đường dẫn — rule sẽ im lặng bỏ qua.
- `configMap` mọc thêm một entry thiếu một trong hai cờ.
- Có đề xuất ràng kiểu cho `configMap`, hoặc bỏ dấu `?` ở `digest`/`useNats`: khi đó `Tầng giữ` đổi
  và cả năm record phải tăng version.
- Một test realtime mới khẳng định bằng phép đếm.
- Một test xuyên instance mới boot ít hơn hai instance, hoặc mock kết nối broker.
- Phép thử âm bản không còn làm test đỏ khi gỡ guard self-origin.
- Transport bị thay bằng một broker khác: kiểm lại xem mã nào vẫn đúng và mã nào chỉ đúng với ngữ
  nghĩa giao lại của broker cũ.
