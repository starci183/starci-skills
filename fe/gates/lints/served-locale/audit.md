---
id: fe-lints-served-locale-audit
title: audit.md
slug: /gates/lints/served-locale/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phủ của hai rule so với luật, và mọi cửa còn mở kèm giá đóng.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `served-locale`

Phản biện này kiểm một câu hỏi: **hai rule này giữ được bao nhiêu phần của luật, và phần còn lại
được nói ra hay bị lờ đi.**

## Kết luận

Chấp nhận, kèm một cảnh báo lớn.

Tệp nguồn xuất **đúng hai** rule, khớp với con số dự kiến. Cả hai đều bám vào nút cú pháp có thật,
cả hai đều ở mức `error`, không rule nào có lựa chọn cấu hình để nới, không rule nào có bản vá tự
động. Hai miễn trừ của rule thứ nhất đều có lý do được ghi lại, và một trong hai được tìm ra bằng
cách chạy thật chứ không phải bằng cách nghĩ — đó là dấu hiệu của một bộ rule đã va vào mã thật.

Cảnh báo: **xanh cả hai rule vẫn tương thích với việc không lời gọi nào khai báo ngôn ngữ.** Rule
thứ nhất kiểm một cái *tên* đã được gọi; rule thứ hai cấm một chuỗi ký tự ở nơi khác. Không rule nào
đòi mắt xích ngôn ngữ **thật sự** viết header. Sự cố đã sinh ra luật này có thể tái diễn nguyên vẹn
dưới một build hoàn toàn xanh.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Chuỗi so với mắt xích đơn | Phân định được bằng cổng `links/` — nhưng bằng **thư mục**, nên miễn trừ rộng hơn ý định |
| Mã sản phẩm so với mã kiểm thử | Phân định được ở rule chuỗi (`.test.`, `.spec.`); **không** phân định ở rule header |
| Lời gọi hàm so với `new` | Phân định được: một hàm thăm gắn cho cả hai loại nút |
| Gọi trực tiếp so với gọi qua đối tượng | Phân định được: tên rút từ `.property.name` |
| Khoá thường so với khoá tính toán dạng chuỗi | Phân định được: khoá `Literal` chuỗi đọc được ở cả hai dạng |
| Khoá tính toán dạng hằng | **Không** phân định được: trả về `null`, rule im |
| Thứ tự mắt xích trong chuỗi | **Không** phân định được: kết luận ở `Program:exit`, không nhìn mảng |
| Gắn vô điều kiện so với gắn có điều kiện | **Không** phân định được, dù `LOCALE-1` nói rõ là vô điều kiện |
| Giá trị ngôn ngữ đúng so với sai | **Không** phân định được, và tệp nguồn tự nói ra điều đó |

## Phát hiện

1. **Đúng hai rule, khớp số dự kiến.** `api-client-attaches-the-locale` và
   `locale-header-belongs-to-the-link`. Không có rule thứ ba ẩn trong tệp; `recommended` chỉ là ánh
   xạ suy ra từ khoá của `rules`.
2. **Hai trên năm mã luật có rule.** `LOCALE-1` và `LOCALE-5` được giữ. `LOCALE-2`, `LOCALE-3`,
   `LOCALE-4` **không có rule nào**. Cả ba đều là phát biểu về *giá trị*, mà cả hai rule chỉ nhìn
   thấy *tên*. Đây không phải thiếu sót do quên: tệp nguồn nói thẳng điều này trong phần đầu.
3. **Tên rule mô tả nhiều hơn hành vi thật, ở cả hai.**
   - `api-client-attaches-the-locale` nghe như đang kiểm việc *gắn*. Thực tế nó kiểm một cái tên
     thuộc tập hai chuỗi có xuất hiện đâu đó **trong cùng tệp** hay không. Nó không kiểm mắt xích có
     nằm trong mảng chuỗi, không kiểm thứ tự, không kiểm điều kiện.
   - `locale-header-belongs-to-the-link` nghe như đang khẳng định "header thuộc về mắt xích". Thực
     tế nó chỉ **cấm nơi khác viết**, và không bao giờ đòi mắt xích viết. Ghép hai điều này lại thì
     ra cảnh báo ở phần Verdict.
4. **Cổng miễn trừ của rule header đòi TypeScript.** Nhóm đuôi là `[cm]?tsx?`, tức `.ts`, `.tsx`,
   `.mts`, `.cts`. Trong khi đó cổng nhận diện tệp kiểm thử của rule kia dùng `[cm]?[jt]sx?`, có
   chữ `j`. Chênh lệch một ký tự giữa hai biểu thức cạnh nhau trong cùng tệp: một mắt xích ngôn ngữ
   viết bằng JavaScript sẽ bị báo đỏ tại đúng nơi duy nhất được phép viết header. Đây là phát hiện
   **về rule**, không phải việc phải sửa mã sản phẩm.
5. **Rule header không có miễn trừ cho tệp kiểm thử.** Hàm nhận diện spec có tồn tại và được xuất
   ra, nhưng chỉ rule chuỗi dùng. Một câu khẳng định trong spec có nhắc tên header sẽ bị báo, kể cả
   spec của chính mắt xích ngôn ngữ.
6. **Miễn trừ mắt xích là lệnh cấm theo thư mục, không theo tệp.** Mọi tệp nằm trực tiếp trong một
   thư mục tên `links` đều được miễn khỏi rule chuỗi — kể cả một tệp lắp cả chuỗi. Mặt trái: một mắt
   xích tách thành thư mục con thì mất miễn trừ và bị báo sai.
7. **Không rule nào có lựa chọn cấu hình.** `schema: []` ở cả hai, và `recommended` đặt cả hai ở
   `error`. Không có cách nới nào ngoài chú thích tắt rule, mà chú thích tắt rule thì nhìn thấy
   được trong diff.

## Quyết định

- Tài liệu hoá **đúng hai** rule, đặt tiêu đề bằng **tên đã xuất bản**, không gán thêm mã số. Tên đó
  là thứ in ra trong log build và viết trong chú thích tắt rule; một rule hai tên là một rule không
  ai truy được thông báo đến từ đâu.
- Giữ nguyên cách viết của mọi định danh: tên rule, tên hàm dựng mắt xích, chuỗi header. Lệnh cấm
  tên sản phẩm áp cho **văn xuôi và ví dụ**, không áp cho định danh đang chạy thật.
- Ghi ba mã luật không có rule vào **phần rủi ro**, không ghi vào phần rule. Một rule không chỉ tay
  vào được là một đề xuất, không phải một rule.
- Mỗi rule phải có bảng cửa mở với ít nhất một dòng thành thật. Không dòng nào được viết "không có".
- Phân biệt rõ ba loại trong `example.md`: mã bị báo đúng, mã **lọt lưới**, và mã bị **báo sai**. Mã
  lọt lưới được dán nhãn là thứ rule bỏ sót, không phải thứ luật cho phép.

## Rủi ro còn mở

Mỗi mục nêu rule phải **nhìn thêm cái gì** mới đóng được cửa, hoặc vì sao đóng đắt hơn để mở.

1. **Đổi tên khi nhập khẩu (`createHttpLink as createTransport`).** Muốn đóng thì rule phải đọc
   `ImportDeclaration` của tệp, dựng bảng tên gốc sang tên cục bộ, rồi so theo tên gốc kèm đường dẫn
   nguồn. Chi phí vừa phải và vẫn nằm trong một tệp. **Nên đóng.**
2. **Chuỗi lắp từ hằng đã nhập khẩu (`from([localeLink, httpLink])`).** Muốn đóng thì phải giải
   quyết định danh sang tệp khác, tức là bỏ tính chất một-tệp-một-lần. Rẻ hơn nhiều: nhận diện luôn
   lời gọi lắp chuỗi và soi các phần tử của mảng theo **tên định danh**, chứ không chỉ theo lời gọi.
   **Đóng được một phần.**
3. **Có tên mà không nằm trong chuỗi.** Muốn đóng thì phải theo giá trị trả về của lời gọi mắt xích
   ngôn ngữ tới mảng mà mắt xích cuối cùng nằm trong đó — phân tích luồng dữ liệu trong hàm. Đắt, và
   dễ báo sai với những cách viết hợp lệ. **Chấp nhận để mở, ghi nhận trong phản biện mã.**
4. **Gắn có điều kiện.** Đóng được rẻ: nếu nút lời gọi mắt xích ngôn ngữ có tổ tiên là
   `ConditionalExpression`, `IfStatement` hay `LogicalExpression` thì coi như chưa gắn. Có nguy cơ
   báo sai với một điều kiện thực sự vô hại, nhưng `LOCALE-1` không thừa nhận điều kiện vô hại nào.
   **Nên đóng.**
5. **Miễn trừ mắt xích rộng hơn ý định.** Đóng được bằng cách siết thành "tệp trong `links/` và
   **không** chứa nhiều hơn một lời gọi dựng mắt xích", hoặc bằng cách gắn miễn trừ vào việc tệp chỉ
   xuất một mắt xích. Rủi ro là biến một cổng đọc phát một thành một cổng cần đọc kỹ. **Cân nhắc.**
6. **Cổng miễn trừ của rule header đòi TypeScript.** Đóng gần như miễn phí: thêm chữ `j` vào lớp ký
   tự, đúng như biểu thức nhận diện spec đã làm. **Nên sửa ngay ở nguồn.**
7. **Rule header không miễn tệp kiểm thử.** Đóng bằng cách gọi luôn hàm nhận diện spec đã có sẵn.
   Đổi lại, một spec sẽ có thể viết header tuỳ ý — mà spec vốn không gửi lời gọi thật. **Nên đóng.**
8. **Hằng rửa sạch chuỗi header (`{ [HEADER]: locale }`).** Muốn đóng thì phải truy ngược định danh
   về khai báo hằng trong cùng phạm vi và đọc giá trị khởi tạo. Làm được trong một tệp, không làm
   được khi hằng nằm ở tệp khác — mà đó lại chính là cách người ta hay gom hằng. **Đóng được một
   nửa; nửa còn lại nên nói ra thay vì che.**
9. **Chữ hoa chữ thường (`X-Locale`).** Đóng miễn phí: so sau khi hạ chữ thường. Không có lý do nào
   để mở. **Nên sửa ngay ở nguồn.**
10. **Gán và lời gọi (`headers["x-locale"] = v`, `headers.set("x-locale", v)`).** Đóng bằng cách
    thêm hai hàm thăm: `MemberExpression` có khoá tính toán là chuỗi trong vế trái của phép gán, và
    đối số thứ nhất của một lời gọi tên `set` hoặc `append`. Cái sau dễ báo sai vì `set` là một tên
    rất phổ thông. **Đóng vế gán, cân nhắc vế lời gọi.**
11. **Miễn trừ neo vào đuôi đường dẫn.** Bất kỳ tệp nào ở bất kỳ đâu có đường dẫn kết thúc bằng
    `links/locale.ts` đều được miễn. Muốn đóng thì miễn trừ phải neo vào một đường dẫn cấu hình
    được, chứ không phải một mẫu đuôi. Việc đó lại đưa cấu hình vào một bộ rule đang cố ý không có
    cấu hình. **Chấp nhận để mở, có ý thức.**
12. **Không kiểm chiều ngược lại — rủi ro lớn nhất của mô-đun.** Không rule nào đòi mắt xích ngôn
    ngữ viết header. Đóng được bằng một rule **thứ ba**, đảo chiều rule hiện có: trong tệp mắt xích
    ngôn ngữ, phải tồn tại một thuộc tính khoá `x-locale`. Rẻ, cùng một cơ chế, và nó bịt đúng lối
    tái diễn nguyên vẹn sự cố gốc. Rule đó **chưa tồn tại trong nguồn**, nên nó không được ghi vào
    phần rule của mô-đun này — nó là một đề xuất.
13. **Ba mã luật không có rule.** `LOCALE-2`, `LOCALE-3`, `LOCALE-4` nói về giá trị mà mắt xích tính
    ra: đọc từ địa chỉ hay từ tham số, cookie có qua được biên nguồn gốc hay không, mặc định của máy
    chủ là sàn hay là phương án dự phòng. Máy chỉ thấy tên hàm, không thấy thân hàm. Đóng bằng lint
    nghĩa là viết một rule đoán ý một hàm — chi phí cao, độ tin thấp, và một rule sai còn tệ hơn
    không có rule. **Giữ ở phản biện của người, và nói ra ở mọi tài liệu để không ai đọc xanh thành
    an toàn.**

## Khi nào cần kiểm lại

- Tệp nguồn xuất thêm, bớt hoặc đổi tên một rule.
- Một tên trong tập mắt xích cuối cùng hoặc tập mắt xích ngôn ngữ được thêm, bỏ hoặc đổi cách viết.
- Có ai đề xuất một rule đảo chiều, đòi mắt xích ngôn ngữ thật sự viết header.
- Một cổng miễn trừ được sửa — đặc biệt là hai lớp ký tự đuôi tệp đang lệch nhau một chữ `j`.
- Xuất hiện một báo sai mà cách sửa đề nghị là **đổi mã sản phẩm** cho vừa miễn trừ.
- Có ai kết luận từ một build xanh rằng mọi lời gọi đã khai báo ngôn ngữ.
- Luật ở `patterns/served-locale.md` thêm hoặc bỏ một mã.
