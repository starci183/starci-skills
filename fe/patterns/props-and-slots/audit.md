---
id: fe-patterns-props-and-slots-audit
title: audit.md
slug: /fe/patterns/props-and-slots/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo được của luật props-and-slots.
---

# audit.md

> Version: `2.00` · Module: `props-and-slots`

Audit này kiểm hai thứ: luật có chọn được **một** quyết định slot từ dữ kiện đã nêu và chỉ từ đó
không, và mỗi mã có được **giữ bởi thứ mà bảng tầng giữ nói là đang giữ nó** không.

## Verdict

Chấp nhận, có điều kiện. Bảy mã phân định được bằng dữ kiện nghiệp vụ, và bốn trong bảy mã được giữ
bởi kiểu chứ không phải bởi review — đó là thế mạnh thật của luật này. Điều kiện nằm ở `SLOTS-5`:
nó là mã duy nhất không có gì cơ học giữ, và module bảo toàn nó thay vì hạ cấp thành khuyến nghị.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `SLOTS-1` vs `SLOTS-4` | Loại trừ được khi đã nêu thứ đi lạc là handler hay là phần bên trong |
| `SLOTS-1` vs `SLOTS-2` | Loại trừ được khi đã nêu vấn đề nằm ở giá trị hay ở cách khai kiểu |
| `SLOTS-2` vs `SLOTS-3` | Loại trừ được khi đã nêu kiểu thiếu tên hay thiếu công cụ |
| `SLOTS-4` vs `SLOTS-7` | Loại trừ được khi đã trả lời xong câu "caller có được đổ nội dung không" |
| `SLOTS-5` vs `SLOTS-1` | Loại trừ được khi đã nêu **ai** gọi request |
| `SLOTS-6` vs `SLOTS-4` | Loại trừ được khi đã nêu caller đang mở diện mạo hay mở cấu trúc |
| `SLOTS-6` vs `SLOTS-1` | Loại trừ được khi đã nêu chuỗi đó là dữ liệu nghiệp vụ hay là cách vẽ |
| Thiếu dữ kiện | Hỏi đúng một câu về quyền quyết định phần bên trong, rồi dừng |

## Findings

- **Bốn mã được giữ bởi kiểu, ba mã được giữ bởi lint, và ranh giới giữa hai nhóm không tuỳ tiện.**
  Lint chỉ có mặt ở đúng chỗ kiểu không nhìn thấy gì: một shape không có tên, một lỗ markup trong một
  props type viết tay, một attribute ở call site. Mọi thứ còn lại đã bị alias tầng từ chối trước khi
  lint kịp có ý kiến.
- **`SLOTS-2` là ràng buộc bị chẩn đoán sai nhiều nhất.** Lỗi rơi xuống chỗ dùng alias tầng, nên
  người đọc kết luận alias tầng hỏng và "sửa" bằng cách nới ràng buộc. Một lần nới như vậy gỡ hàng
  rào của `SLOTS-1` cho toàn hệ thống để một file khỏi phải đổi một từ khoá.
- **`SLOTS-5` là mã yếu nhất và cũng là mã có hậu quả runtime rõ nhất.** `BlockProps` chứng minh được
  tầng sở hữu request không nhận cờ; không có gì chứng minh một leaf không tự tính cờ.
- **Số shell được miễn ở `SLOTS-4` không khớp giữa luật phẳng và rule đang chạy.** Bảng "Forbidden"
  của luật gốc nêu **ba** shell; `CHILDREN_SHELLS` trong rule liệt **bốn**, thêm chỗ nối route, và
  thông báo lỗi của rule làm rõ lý do: nó chuyển đổi thứ mà layout của framework trao xuống. Module
  này bảo toàn quyết định của luật gốc trong phần Exceptions và ghi lại độ lệch ở đây thay vì âm
  thầm sửa một trong hai bên.
- **`SLOTS-7` được viết cho một component có tên riêng.** Rule bind theo đúng một import path, nên
  luật phát biểu tổng quát mà enforcement thì hẹp. Ví dụ trong `example.md` đã tổng quát hoá tên đó
  theo luật của shelf; độ hẹp của rule vẫn còn nguyên.
- **Bản brief chuyển đổi nói module có tám mã; luật gốc công bố bảy.** `SLOTS-1` đến `SLOTS-7`, không
  có `SLOTS-8` ở bất kỳ đâu trong canon, trong rule, hay trong twin test. Không mã nào bị bịa thêm để
  cho khớp con số, vì bịa một mã là làm hỏng đúng thứ mà luật "mã cố định" đang bảo vệ.

## Decisions

- Giữ đúng bảy mã: `SLOTS-1` … `SLOTS-7`, nguyên số và nguyên nghĩa.
- Giữ nguyên miễn trừ ba shell theo đúng chữ của luật gốc, và ghi độ lệch với rule vào Findings.
- Ghi tầng giữ **theo thứ đang thật sự giữ**, không theo thứ luật mong muốn: `unrepresentable` cho
  `SLOTS-1`, `SLOTS-2`, `SLOTS-6`; `enforced` cho `SLOTS-3`, `SLOTS-4`, `SLOTS-7`; `documented` cho
  `SLOTS-5`.
- Ghi thêm cột "còn escape gì" vào bảng tầng giữ, vì một mã được giữ **một phần** mà ghi là được giữ
  thì tệ hơn ghi là không được giữ.
- Tổng quát hoá mọi tên component riêng trong ví dụ; giữ mọi quyết định của luật gốc.
- Không hạ `SLOTS-5` xuống mức khuyến nghị chỉ vì không lint được. Mức bắt buộc của một luật không do
  công cụ quyết định.

## Rủi ro còn mở

Mọi mã chỉ được `documented` giữ, và điều kiện để một rule giữ được nó.

- **`SLOTS-5` — `isLoading` được nhận, không được tự quyết.** Không type nào và không rule nào trong
  `props-and-slots.mjs` giữ nó. Một rule muốn giữ được phải thấy: trong một file thuộc tầng leaf hoặc
  composite, có một lời gọi hook trả về trạng thái chờ (một danh sách hook fetch đã biết, hoặc một
  `useState` mà tên biến khớp một tập đã đóng) và giá trị đó chảy vào nhánh render skeleton. Hai vế
  đó đều là phân tích luồng dữ liệu trong một file, và ESLint làm được **vế thứ nhất** với một danh
  sách hook khai trong config. Vế thứ hai — "cờ này quyết định skeleton" — thì không: nó phụ thuộc
  vào việc đọc ý nghĩa của nhánh, và một rule đoán sai ở đây sẽ báo đỏ mọi trạng thái tương tác cục
  bộ hợp lệ. Vì vậy `SLOTS-5` neo được **một nửa** (`BlockProps` chứng minh vế "không nhận") và nửa
  còn lại là `chưa neo được`.

Những mã được giữ nhưng **giữ không kín**, ghi ở đây để không ai đọc bảng tầng giữ thành lời hứa
tuyệt đối.

- **`SLOTS-2`.** Ràng buộc chỉ bật khi kiểu dữ liệu đi qua một slot alias. Một kiểu khai bằng
  `interface` rồi chỉ dùng nội bộ sẽ không bao giờ đỏ, và nó sẽ đỏ đúng vào ngày ai đó nối nó vào một
  component. Một rule giữ kín được phải thấy: một `interface` có tên khớp `*Data` nằm trong tầng
  component. Đó là một rule rẻ và chưa ai viết.
- **`SLOTS-3`.** Lint bắt shape ẩn danh, không bắt **tên sai**. `type Foo = { … }` dùng cho component
  `Bar` vẫn xanh. Một rule giữ kín được phải so tên type với tên export của component trong cùng
  file — làm được, và chưa có.
- **`SLOTS-4`.** Rule bắt lỗ markup; không có gì bắt một shape đóng mọc thêm `render`. Chiều đó chỉ
  được kiểu giữ khi component thật sự dùng alias tầng, và một props type viết tay thì không.
- **`SLOTS-6`.** Kiểu giữ kín ở mọi component dùng alias tầng, và **không giữ gì** ở một props type
  viết tay — cùng đúng cái lỗ mà `SLOTS-4` đã phải viết rule để bịt. Một rule đối xứng với
  `no-children-slot`, bắt các member tên `className`, `style`, `classNames`, `*ClassName`, sẽ bịt
  được, và nó chưa tồn tại.
- **`SLOTS-7`.** Rule nhận diện mục tiêu bằng import path. Một surface dùng chung khác mọc làn `items`
  sẽ không đỏ. Muốn giữ tổng quát thì tiêu chí phải chuyển từ "tên import" sang "component nhận
  `contract` + `render`", tức là một điều kiện rule đọc được từ chính JSX call site.

Rủi ro không thuộc về công cụ.

- **Bảng tầng giữ có thể bị đọc thành bảng bảo đảm.** Bốn dòng `unrepresentable` chỉ đúng **khi
  component dùng alias tầng**. Một file viết tay props type của mình đứng ngoài cả bốn dòng đó, và đó
  là con đường quay lại trạng thái trước khi có luật này.

## Re-audit Triggers

- Có đề xuất thêm một slot mới, hoặc thêm một mã `SLOTS-<n>`.
- Có ai nới ràng buộc của một alias tầng để làm biên dịch xanh.
- Có một file thứ năm được thêm vào danh sách shell được miễn.
- Có một props type viết tay xuất hiện trong tầng component thay vì một alias tầng.
- Rule của `SLOTS-7` phải sửa vì có surface dùng chung thứ hai.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm hoặc một component nội bộ mới đọc được.
