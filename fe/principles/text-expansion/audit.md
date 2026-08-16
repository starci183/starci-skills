---
id: fe-principles-text-expansion-audit
title: audit.md
slug: /fe/principles/text-expansion/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Độ giãn văn bản.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `text-expansion`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **nguồn chuỗi và tập ngôn ngữ đã nêu**, và
chỉ từ đó — chứ không từ chuỗi đang hiện trên màn hình người viết mã.

## Kết luận

Chấp nhận. Tập mã đóng và phủ kín, không phụ thuộc tên sản phẩm, tên thành phần hay một thư viện i18n
cụ thể. Phần lời gọi `t(…)` và `Intl.*` trong ví dụ là **hình dạng của lời gọi**, không phải một API
riêng của ai.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `EXPANSION-0` so với `EXPANSION-1` | Loại trừ được bằng một dữ kiện kiểm tra được: chuỗi có mục trong danh mục hay không |
| `EXPANSION-0` so với `EXPANSION-6` | Loại trừ được khi đã nêu giá trị đến từ tập đóng hay từ bộ định dạng |
| `EXPANSION-1` so với `EXPANSION-2` | Loại trừ được bằng phép đếm: bề rộng này ràng buộc bao nhiêu đoạn liền mạch |
| `EXPANSION-1` so với `EXPANSION-3` | Loại trừ được khi đọc thử một đoạn liền mạch tách rời: câu đúng hay mảnh cụt |
| `EXPANSION-3` so với `EXPANSION-6` | Loại trừ được khi tách **vị trí trong câu** khỏi **hình dạng giá trị** |
| `EXPANSION-4` so với `EXPANSION-5` | Loại trừ được khi đã nêu chiều của vật đến từ hệ nào: câu văn, thời gian, số học hay thương hiệu |
| `EXPANSION-4` so với `EXPANSION-2` | Loại trừ được vì hai câu hỏi khác nhau: **bên nào** và **bao nhiêu chỗ** |
| Thiếu tập ngôn ngữ | Không suy đoán. Dải nở lấy theo độ dài nguồn; nếu chưa biết có ngôn ngữ RTL nào không thì hỏi **một** câu |
| Thiếu nguồn chuỗi | Không đoán theo nội dung chuỗi. `Save` và `SKU` trông giống nhau về độ dài và khác nhau về mã |

## Nhận định

- **Chuỗi đang thấy đã bị loại khỏi tập tiêu chí.** Mã được chọn từ **nguồn** của chuỗi và **tập
  ngôn ngữ**, không từ độ dài của bản đang hiển thị. Đây là điểm khác biệt lớn nhất so với cách làm bằng
  mắt, và cũng là điểm khó giữ nhất.
- **Chuỗi càng ngắn rủi ro càng cao.** Bảng dải nở làm cho điều này thành một con số thay vì một cảm
  giác: đoạn liền mạch 4 ký tự cần chừa tới 200%, đoạn liền mạch 80 ký tự chỉ cần 30%. Trực giác thường đi ngược, vì mắt
  nhìn thấy chỗ trống tuyệt đối chứ không nhìn thấy tỉ lệ.
- **`EXPANSION-3` là mã duy nhất mà mọi class CSS đều sai.** Sửa nó là sửa mã đánh dấu. Việc để nó nằm chung
  bảng với các mã có class CSS là cố ý: nếu tách nó ra thành "ghi chú kỹ thuật" thì nó sẽ không bao giờ bị
  nêu ra trong một buổi đánh giá giao diện, và nó là lỗi i18n xuất hiện nhiều nhất.
- **`EXPANSION-4` và `EXPANSION-5` không đối xứng.** `EXPANSION-4` phát ra class CSS; `EXPANSION-5` phát ra
  một lời khẳng định rằng **không** có class CSS nào được thêm, cộng với `dir` ở chỗ có chuỗi nhúng. Một
  mã "không làm gì" chỉ có giá trị khi nó được nêu tên — nếu không, "quên lật" và "cố ý không lật" là
  hai thứ không phân biệt được trong mã đánh giá.
- **Cặp thanh tiến độ là phép thử mạnh nhất của mô-đun.** Hai đoạn mã đánh dấu gần như giống hệt nhau, hai
  mã khác nhau, và điều phân định hoàn toàn nằm ngoài mã đánh dấu. Bất kỳ ai đọc mô-đun này mà chọn đúng
  hai thanh đó thì đã hiểu luật; chọn theo hình dạng thì chưa.
- **Phần mơ hồ còn lại nằm ở những yêu cầu bỏ sót tập ngôn ngữ.** Không biết sản phẩm có ship ngôn ngữ
  RTL nào không thì câu hỏi 2 không trả lời được — nhưng câu hỏi 1 vẫn trả lời được đầy đủ, nên mô-đun
  không bị chặn.

## Quyết định

- Giữ đúng bảy mã: `EXPANSION-0` … `EXPANSION-6`.
- Đơn vị quyết định là **một đoạn liền mạch và cái hộp giữ nó**, và ba câu hỏi hỏi theo thứ tự cố định. Câu hỏi
  độ dài là câu phủ kín; hai câu còn lại chỉ áp khi có hình học phụ thuộc chiều hoặc có giá trị máy.
- Dải nở lấy theo **độ dài chuỗi nguồn**, và là **sàn của hộp**, không phải hạn mức của người dịch.
- Ví dụ phải có nhiều hơn một ngôn ngữ. Ví dụ một ngôn ngữ không chứng minh được điều gì ở mô-đun này.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm, không thư viện i18n cụ thể.
- Luật là **bắt buộc**: không có chuỗi nào ngắn tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Lệch khỏi tập mã bộ nguồn.** Bản bộ nguồn có năm mã: `EXPANSION-0` từ vựng đóng, `EXPANSION-1` hộp sống
  được với 30–50% ký tự thêm, `EXPANSION-2` không đo vùng chứa từ một chuỗi, `EXPANSION-3` cái gì lật
  và cái gì không lật khi RTL, `EXPANSION-4` số, ngày và tiền tệ theo ngôn ngữ. Bản này lệch ba chỗ, và
  ghi lại ở đây để lần sau còn cãi được:

  1. **Tách bộ nguồn `EXPANSION-3` thành hai mã.** "Lật" và "không lật" đã được tách thành `EXPANSION-4` và
     `EXPANSION-5`. Lý do: một mã gộp cả hai **không phân định được gì cả** — người đọc gặp nút Phát
     vẫn phải tự quyết, và mã không giúp được. Quan trọng hơn, một quyết định "cố ý không lật" chỉ tồn
     tại trong mã đánh giá khi nó có tên riêng; gộp vào cùng mã với "phải lật" là xoá đúng cái tên đó.
  2. **Thêm `EXPANSION-3` mới: câu ghép từ nhiều mảnh.** Bộ nguồn không có chỗ cho nó, và nó không thuộc
     bất kỳ mã bộ nguồn nào: nó không phải chuyện bề rộng hộp, cũng không phải chuyện định dạng giá trị.
     Nó thuộc mô-đun này vì nó là **giao của hai câu hỏi mô-đun sở hữu** — mảnh cụt bị đo độ dài riêng,
     và ở RTL trật tự các mảnh hiện ra ngược. Bỏ nó ra thì tập mã không còn phủ kín.
  3. **Đổi số bộ nguồn `EXPANSION-4` thành `EXPANSION-6`.** Chỉ là hệ quả của hai thay đổi trên. Nội dung
     giữ nguyên, và mở rộng thêm số nhiều và nối danh sách, vì cả hai đều là "ngôn ngữ in ra" chứ không
     phải "người dịch viết".

  Rủi ro của việc lệch: ai đã đọc bản bộ nguồn sẽ nhớ `EXPANSION-3` là chuyện RTL. Đây là lý do phần
  `changelog.md` nêu rõ cách đánh số, và là lý do bảng mã không bao giờ được trích dẫn rời khỏi
  `INDEX.md`.

- **Mã bộ nguồn `EXPANSION-1` nói "30–50%" trong khi bảng dải nở lên tới 200%.** Con số 30–50% là dải của
  chuỗi nguồn dài 31–50 ký tự — đúng cho một câu, và **quá thấp gấp bốn lần** cho một nhãn nút. Giữ
  nguyên tên "30–50%" mà không kèm bảng là cách chắc chắn để mọi nút trong sản phẩm bị đo thiếu chỗ.
- **Ranh giới với mô-đun cắt/tràn có thể bị đọc nhầm thành trùng lặp.** Một thư điện tử dài mang
  `EXPANSION-0` ở mô-đun này và vẫn cần một quyết định cắt ở mô-đun kia. Ai đọc "`EXPANSION-0` — không
  có gì để chừa" thành "không phải làm gì" sẽ bỏ sót quyết định thứ hai. Đã nói rõ ở `vi.md` và ở ví
  dụ hàng đơn hàng, nhưng đây vẫn là chỗ dễ trượt nhất giữa hai mô-đun.
- **`EXPANSION-2` gánh nhiều tình huống nhất** — cột nhãn, dải thẻ tab, phần đầu bảng, thanh bên, nhóm nút
  phân đoạn. Nếu thực tế cho thấy "rãnh thẳng hàng" và "hàng có thể xuống dòng" cần tách, đó là một
  đề xuất thay đổi luật, không phải một lần chọn khác đi.
- **Không có điều kiện tự động cho `EXPANSION-5`.** Thiếu một class CSS là thứ không kiểm tra tĩnh được, vì "không có
  `rtl:`" và "quên `rtl:`" giống hệt nhau trong nguồn. Bằng chứng duy nhất là một lần hiển thị ở ngôn ngữ
  RTL, và mô-đun chỉ có thể **bắt buộc phải có** lần hiển thị đó chứ không thay thế được nó.

## Điều kiện phản biện lại

- Sản phẩm bật thêm một ngôn ngữ, đặc biệt là ngôn ngữ RTL đầu tiên.
- Có một bề rộng, `basis` hay số cột nào ra đời ngay sau khi ai đó nhìn một bản dịch.
- Có `whitespace-nowrap` hoặc `truncate` xuất hiện trên một đoạn liền mạch đến từ danh mục.
- Có một câu bị ghép từ hai phần tử anh em trở lên.
- Có `ml`, `mr`, `left`, `right`, `text-left` hoặc `rounded-l-*` mới trong một bố cục có ngôn ngữ RTL.
- Có `rtl:-scale-x-100` dán lên một hình dạng ký tự không chỉ hướng, hoặc thiếu trên một nửa của một cặp.
- Có chuỗi ngày, tiền tệ hoặc số nhiều được dựng bằng nối chuỗi.
- Bản bản dựng giả-bản địa hoá bị đem ra làm bằng chứng "đã xong" thay vì bằng chứng cho một mã.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm hoặc một thư viện mới đọc được.
