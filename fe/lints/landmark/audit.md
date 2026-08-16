---
id: fe-lints-landmark-audit
title: audit.md
slug: /fe/lints/landmark/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức enforcement của luật landmark — cái gì thật sự được giữ, cái gì chỉ được tin là đã giữ.
---

# audit.md

> Version: `2.00` · Mô-đun: `landmark`

Phản biện này không hỏi luật có đúng không. Nó hỏi **máy giữ được bao nhiêu phần của luật**, và mọi
chỗ máy không giữ được đã được **viết ra** hay chưa.

Tiền đề: một luật không có rule là luật **biết mình không được giữ**. Một rule rò rỉ là luật **được
tin là đã giữ**. Cái thứ hai nguy hiểm hơn.

## Verdict

**Chấp nhận, kèm ba finding.** Nguồn publish **đúng hai** rule — số đếm khớp với con số dự kiến. Cả
hai đều ánh xạ được vào một mã luật có thật, không phải bịa. Nhưng ba trong năm mã luật không có rule
nào, và cửa mở nghiêm trọng nhất — chuyển chrome vào một component vỏ — làm **cả hai rule cùng im**
trên một tài liệu không có landmark nào.

Điểm mạnh hiếm gặp: **nguồn tự khai giới hạn của nó**. Phần đầu file nói thẳng rằng rule đọc một file
mỗi lần nên không thấy được trường hợp layout và trang cùng mở landmark, và gọi việc giả vờ ngược lại
là "rule tự nhận một bảo đảm nó không có". Tài liệu này giữ nguyên thái độ đó và mở rộng nó.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số rule publish so với con số dự kiến (khoảng 2) | **Đúng 2.** `routed-page-is-a-main-landmark`, `main-landmark-belongs-to-a-route-file` |
| Mỗi rule có ánh xạ được vào một mã `LANDMARK-<n>` không | Có. `LANDMARK-4` và `LANDMARK-5`, khớp cả câu chữ lẫn thông điệp lỗi |
| Có mã luật nào bị gán bừa cho một rule không | Không. Ba mã còn lại được để trống và ghi thành finding |
| Danh tính rule có bị đặt thêm mã số không | Không. Tên publish là danh tính duy nhất, dùng nguyên văn làm tiêu đề mục |
| Tên rule có mô tả đúng hành vi thật không | **Không, ở một rule.** Xem Finding 2 |
| Mỗi rule có ít nhất một cửa mở trung thực không | Có. 16 cửa: 8 riêng rule một, 6 riêng rule hai, 2 chung |
| Tài liệu có mô tả rule nào không tồn tại không | Không. Mọi mục đều chỉ được vào một `export` có thật |
| Văn xuôi và ví dụ có nêu tên sản phẩm nào không | Không. Định danh publish được giữ nguyên văn theo đúng quy định |

## Findings

**Finding 1 — Ba mã luật không có rule nào.** `LANDMARK-1` (mỗi phần tử landmark một nhánh),
`LANDMARK-2` (nhánh không mang class), `LANDMARK-3` (không truyền phần tử vào khung bằng prop) đều
không có gì giữ ở mô-đun này. Chúng là luật, và chúng chỉ được giữ bằng mắt người review. Đặc biệt
`LANDMARK-3` đáng chú ý: nó cấm đúng cái cách viết **rẻ nhất** để phá luật.

**Finding 2 — Tên rule thứ hai nói hẹp hơn hành vi thật.** `main-landmark-belongs-to-a-route-file`
nghe như "chỉ file route". Đọc mã thì thấy **hai tập file khác nhau**: nhánh landmark chỉ được ở file
route, còn khung mà entry khai host thì được ở file route **hoặc** bề mặt trang. Người đọc tên rule
mà không đọc mã sẽ kết luận sai về bề mặt trang, theo cả hai chiều. Đây không phải lỗi — bất đối xứng
là cố ý và có lý do đầy đủ — nhưng cái tên không mang được nó.

Rule thứ nhất cũng lệch nhẹ theo hướng khác: `routed-page-is-a-main-landmark` nghe như đang kiểm
**trang**. Nó chỉ kiểm **layout**, và chỉ layout nào vừa vẽ `children` vừa gọi tên nhánh khung.

**Finding 3 — Vị từ đường dẫn ở đây bất đồng với vị từ đường dẫn của mô-đun contract.** Mô-đun
contract giữ một danh sách gốc component gồm nhiều layout, và ghi lại rất rõ cái giá của việc viết
cứng tiền tố: chĩa vào một kho đa-gói, nó từng báo hàng chục file đúng là hỏng. Mô-đun landmark thì
viết cứng `/components/pages/` và `/app/`. Cùng một loại lỗi, cùng một kho, khác mô-đun.

**Finding 4 — Cửa sổ đọc entry nhạy với thụt lề.** Comment trong nguồn kể rằng lát cắt cố định 2000
ký tự từng khiến một entry thừa hưởng host của entry bên dưới, và cửa sổ theo khoá đã sửa việc đó.
Cửa sổ ấy đòi **đúng bốn dấu cách**. Đổi cấu hình formatter sang hai dấu cách là lỗi cũ quay lại
nguyên vẹn, dưới một cái vỏ khác.

**Finding 5 — Không có rule nào bắt phần tử landmark viết tay bằng chữ thường.** Cách viết sai trực
tiếp nhất nằm ngoài phạm vi cả hai rule ở đây. Một mô-đun luật khác có cấm nó, nhưng đó là một mô-đun
khác: nếu nó không được bật, luật landmark không nói gì.

## Decisions

- Giữ **đúng hai** rule làm đơn vị tài liệu, theo đúng những gì nguồn publish. Không viết mục cho rule
  "đáng lẽ phải có".
- Dùng **tên publish** làm tiêu đề mục, nguyên văn. Không đặt mã số song song: một rule hai tên là một
  rule không ai biết thông điệp lỗi đến từ đâu.
- Ghi cửa mở thành **bảng riêng**, tách khỏi bảng cửa đóng, và nói rõ ở `example.md` rằng mã trong mục
  cửa lách là mã **đi lọt**, không phải mã được phép.
- Không gán mã luật cho rule nào không thật sự giữ mã đó. Ba mã trống được ghi lại ở đây.
- Giữ nguyên tên định danh có chứa từ khoá sản phẩm nếu chúng là chuỗi được publish. Cấm tên sản phẩm
  áp cho **văn xuôi và ví dụ**, không áp cho định danh xuất hiện trong log build.

## Rủi ro còn mở

Mỗi mục nêu rule sẽ phải **nhìn thêm cái gì** mới đóng được cửa — hoặc vì sao đóng đắt hơn để mở.

**1. Chrome chuyển vào một component vỏ.** Rule sẽ phải theo được import: từ layout đi vào `AppShell`,
xem file đó có gọi tên nhánh khung không. Đó là **phân giải liên file**, thứ một rule chạy trên một
file dưới một parser không làm được nếu không tự đọc và tự parse file khác. Đắt, và nó biến rule thành
một trình biên dịch nhỏ. Rẻ hơn nhiều: một test dựng cả tài liệu rồi đếm landmark. **Đây là rủi ro
nghiêm trọng nhất còn mở** và nó không nên đóng bằng lint.

**2. Đổi tên `children` khi destructure.** Rule sẽ phải lần theo scope: tìm tham số thứ nhất của
component, xem nó destructure `children` ra tên gì, rồi theo dõi tên đó. Khả thi bằng scope analysis
của ESLint, tốn khoảng vài chục dòng. **Nên đóng.** Chi phí thấp, và đây là cửa duy nhất mà một lần
đổi tên vô hại làm rule biến mất hoàn toàn.

**3. Bí danh và member expression, ở cả hai rule.** Rule sẽ phải phân giải mỗi `JSXIdentifier` về
binding của nó và so nguồn import thay vì so chuỗi tên. Khả thi, và có ích cho **mọi** rule của mọi
mô-đun so tên component. **Nên đóng ở tầng dùng chung**, không đóng lẻ trong file này.

**4. Khoá contract không phải literal.** Rule sẽ phải suy ra giá trị của một biến hoặc giá trị trả về
của một hàm — bài toán không giải được nói chung. Có thể thu hẹp: nếu biến là `const` khởi tạo bằng
literal trong cùng file thì đọc được. **Đóng một phần.** Trường hợp hàm trả khoá thì để mở, và phải
nói rõ rằng nó mở.

**5. Landmark bọc nhầm thứ.** Rule sẽ phải so **quan hệ cấu trúc**: landmark có phải tổ tiên của node
mang `children` không. Với JSX trực tiếp thì làm được; với `children` đi qua callback dựng slot — đúng
hình dạng phổ biến ở đây — thì không, vì quan hệ chỉ tồn tại lúc chạy. **Đóng một phần được, và phần
không đóng được chính là phần hay dùng nhất.**

**6. Tập landmark có đúng một thành viên.** Không cần nhìn thêm gì cả: chỉ cần thêm tên vào tập, mỗi
lần thêm một nhánh landmark mới. Rủi ro không nằm ở kỹ thuật mà ở **quy trình** — không có gì nhắc
người thêm nhánh phải sửa file này. Cách đóng đúng là một test đọc thư mục nhánh và đối chiếu với tập.

**7. Miễn trừ theo đoạn đường dẫn của thư mục nhánh.** Rule sẽ phải giới hạn miễn trừ vào đúng file
cài đặt của nhánh — tên file cụ thể, không phải cả thư mục. Rẻ. **Nên đóng**, vì hiện tại chuyển một
block vào thư mục đó bằng một lệnh `mv` là miễn nhiễm toàn bộ rule.

**8. Vị từ bề mặt trang viết cứng một layout.** Rule sẽ phải dùng danh sách gốc component dùng chung
thay vì chuỗi `/components/pages/`. Đã có sẵn danh sách đó ở mô-đun contract. **Nên đóng**, và
Finding 3 là lý do.

**9. Cửa sổ entry đòi đúng bốn dấu cách.** Rule sẽ phải cân bằng ngoặc thay vì đếm dấu cách — đúng
cách mà bộ đọc khoá trong cùng cây nguồn đã làm. **Nên đóng**, vì lỗi cũ đã từng xảy ra thật và cách
đóng hiện tại chỉ chặn được một biến thể của nó.

**10. Layout và trang cùng mở landmark.** Rule sẽ phải nhìn hai file cùng lúc, hoặc nhìn tài liệu đã
render. **Không đóng bằng lint.** Nguồn đã tuyên bố điều này, và tuyên bố ấy là cách xử lý đúng: một
gate ngụ ý một bảo đảm nó không có thì tệ hơn một gate im lặng có ghi chú.

**11. Phần tử landmark viết tay bằng chữ thường.** Ở mô-đun này thì rule sẽ phải kiểm tên thẻ chữ
thường. **Không nên đóng tại đây**: một mô-đun khác đã cấm mọi hộp trung tính viết tay, và nhân đôi
luật ra hai chỗ là cách hai bản sao bắt đầu trôi khỏi nhau. Thay vào đó phải ghi rõ **sự phụ thuộc**:
luật landmark chỉ kín ở điểm này khi mô-đun kia cũng đang bật.

**12. Ba mã luật không có rule.** `LANDMARK-1` và `LANDMARK-2` giữ được bằng máy với chi phí thấp —
đếm phần tử landmark viết tay trong mỗi thư mục nhánh, và cấm thuộc tính class trên file nhánh.
`LANDMARK-3` cần biết prop nào của khung chọn phần tử, và tên prop đó là quy ước chứ không phải kiểu.
**Cả ba nên có rule.** Cho tới lúc đó, chúng là luật được giữ bằng mắt, và câu này phải nằm ở chỗ
người ta đọc được.

## Re-audit Triggers

- Nguồn publish thêm hoặc bớt một rule, hoặc đổi tên một rule đang có.
- Tập nhánh landmark có thêm thành viên thứ hai.
- Bất kỳ vị từ đường dẫn nào đổi, hoặc kho đích đổi layout thư mục.
- Cấu hình formatter đổi mức thụt lề của bảng entry.
- Một mã `LANDMARK-<n>` mới được thêm vào luật.
- Một rule ở đây bị hạ mức khỏi `error` ở bất kỳ kho tiêu thụ nào.
- Một cửa trong bảng **Open** được đóng, hoặc bị phát hiện là đã đóng sẵn.
- Có báo cáo một tài liệu thật ra đời không có landmark nào trong khi cả hai rule đều xanh.
