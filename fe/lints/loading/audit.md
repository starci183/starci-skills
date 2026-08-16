---
id: fe-lints-loading-audit
title: audit.md
slug: /fe/lints/loading/audit
sidebar_label: audit.md
sidebar_position: 3
description: Ba quy tắc giữ được bao nhiêu phần của luật loading, và phần còn lại nằm ở đâu.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `loading`

Phản biện này kiểm đúng một câu hỏi: **máy nhìn thấy được bao nhiêu phần của luật này, và người đọc
báo cáo lint có bị dẫn tới kết luận sai không.**

## Kết luận

Chấp nhận **có điều kiện**. Ba quy tắc là thật, đọc được, và mỗi quy tắc bắt đúng cái nó nói. Điều
kiện nằm ở chỗ khác: **hai trên bảy mã luật có người giữ**, và cả ba quy tắc đều dựa trên những dấu
hiệu rẻ tiền — tên tệp, tên thuộc tính, văn bản điều kiện, tên thẻ gốc — nên đều đổi tên là thoát.
Rủi ro lớn nhất của mô-đun này không phải một quy tắc sai, mà là **một bản báo cáo xanh bị đọc thành
"đã theo luật"**.

Tệp nguồn công bố **đúng ba** quy tắc trong `export const rules`, khớp với số dự kiến. Không có quy
tắc thứ tư nào bị bỏ sót, và không có quy tắc nào được khai báo mà không được xuất.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Ba quy tắc có phân biệt được nhau không | Có. Một quy tắc theo tên tệp, một theo thuộc tính và lần nhập, một theo biểu thức ba ngôi. Không có mã nào rơi vào hai quy tắc |
| Mỗi quy tắc có neo được vào một mã luật không | `no-resting-twin-component` → `LOADING-1`; `no-placeholder-prop` → `LOADING-1`; `no-resting-branch-at-call-site` → `LOADING-2`, theo đúng dấu phân mục trong tệp nguồn |
| Mỗi mã luật có neo được vào một quy tắc không | **Không.** `LOADING-3`, `LOADING-4`, `LOADING-5`, `LOADING-6`, `LOADING-7` không có quy tắc nào |
| Phạm vi có được quyết định trước mọi thứ khác không | Có. Cả ba đều `return {}` khi ngoài phạm vi, nên không tốn gì trên phần còn lại của kho |
| Có quy tắc nào tự vá không | Không. Không quy tắc nào khai báo `fixable`, và điều đó là đúng: mọi phát hiện đều là một quyết định hình dạng |
| Có quy tắc nào nhận tuỳ chọn không | Không. Cả ba `schema: []`, nên một kho không thể nới lỏng bằng cấu hình, chỉ có thể tắt hẳn |
| Thông báo lỗi có nói được **cách sửa** không | Có, cả ba. Mỗi thông báo đều kết thúc bằng một hành động: cho thành phần một trạng thái nghỉ, hoặc đẩy cờ chờ xuống |

## Phát hiện

1. **`no-placeholder-prop` chỉ đúng một nửa với cái tên của nó.** Nó công bố hai `messageId`: `prop`
   và `import`. Nửa `import` không xét prop nào cả — nó xét câu lệnh nhập. Một người đọc tên quy tắc
   trong nhật ký build sẽ đi tìm một thuộc tính không tồn tại. Tên vẫn giữ nguyên ở đây vì tên là
   danh tính; ghi lại để người đọc không mất thời gian.

2. **`no-resting-twin-component` là một quy tắc tên tệp, không phải quy tắc AST.** Nó đăng ký một
   visitor `Program` chỉ để có một nút mà báo. Nội dung tệp **không bao giờ** được xét. Hệ quả trực
   tiếp: một bản sao khai báo bên trong một tệp có tên hợp lệ đi qua sạch, còn một tệp chỉ chứa kiểu
   mà lỡ tên `*Skeleton.ts` thì bị báo là bản sao.

3. **Hai quy tắc bất đồng về tên trần `Skeleton`.** Nửa `import` của `no-placeholder-prop` miễn nó
   bằng một dòng bình luận rõ ràng — "đây là nguyên thuỷ mà thành phần nghỉ **bằng**". Nhưng
   `TWIN_NAME` là `^[A-Za-z0-9]*Skeleton$`, mà `[A-Za-z0-9]*` khớp được chuỗi rỗng, nên
   `no-resting-twin-component` **báo chính tệp định nghĩa nguyên thuỷ đó**. Một kho muốn có nguyên
   thuỷ nghỉ phải đặt nó ngoài cây thành phần, hoặc đặt tên khác, hoặc tắt quy tắc cho một tệp. Đây
   là chỗ hành vi thật lệch xa nhất khỏi ý định đã viết trong chính tệp nguồn.

4. **`fallback` là tên prop dành riêng của ranh giới tải chậm và ranh giới lỗi.** Quy tắc báo mọi
   `fallback={<X/>}`, kể cả những chỗ hoàn toàn không phải hình dạng nghỉ. Theo luật thì vẫn nhất
   quán — một cây trao từ ngoài vào vẫn là cây thứ hai — nhưng đây là nguồn báo động nhiều nhất khi
   một kho mới bật quy tắc, và nếu không biết trước thì rất dễ bị kết luận là quy tắc hỏng.

5. **Quy tắc nhánh so tên thẻ gốc, không so cây.** `armName` rút mỗi nhánh về **một chuỗi**. Đây là
   quyết định thiết kế hợp lý — so cây là việc không có điểm dừng — nhưng nó để lọt đúng cách viết
   phổ biến nhất: một `div` xám đối đầu một `div` thật.

6. **Mẫu cờ chờ không nhận ra chính đường nối mà luật mô tả.** `loading.md` viết hẳn một mục về
   `const isLoading = input.state === "pending"`. Nếu một tác giả bỏ dòng đó và viết
   `input.state === "pending"` thẳng vào ba ngôi, quy tắc không thấy gì. Nghĩa là: **tuân theo luật
   một nửa (đặt tên cờ) thì bị kiểm; bỏ qua luật hoàn toàn (không đặt tên) thì không bị kiểm.**

7. **Tệp `.stories.tsx` bị coi là mã sản phẩm.** `isTestFile` chỉ nhận `.test.` và `.spec.`. Một tệp
   trưng bày các trạng thái — vốn là nơi hợp pháp để dựng hình dạng nghỉ cạnh nhau — sẽ bị báo.

8. **Ánh xạ mã của quy tắc nhánh có một chỗ mờ.** Dấu phân mục trong tệp nguồn ghi `LOADING-2`, và
   tài liệu này theo đúng nguồn. Nhưng câu tiêu đề của `LOADING-1` — "một hình dạng, hai trạng thái;
   không bao giờ hai cây" — cũng mô tả đúng tội này. Ghi lại như một chỗ mờ của luật, không tự chọn
   lại.

## Quyết định

- **Chỉ ghi ba quy tắc có thật.** Không quy tắc nào được suy ra, không mã luật nào được ánh xạ cho
  đủ bảng. Năm mã không có người giữ được nêu tên thẳng ở `INDEX.md` và ở bảng ánh xạ yêu cầu trong
  `example.md`.
- **Danh tính là tên công bố.** Không đặt thêm mã số cho quy tắc. Tên quy tắc, `messageId`, tiền tố
  plugin và tên gói được chép nguyên văn kể cả khi chúng chứa tên sản phẩm.
- **Theo dấu phân mục của nguồn** cho ánh xạ `LOADING-2` của quy tắc nhánh, và ghi chỗ mờ ở
  Findings 8 thay vì tự quyết.
- **Giữ nguyên hành vi bất đồng ở Finding 3 trong tài liệu**, không mô tả nó thành ý định. Tài liệu
  của một tầng thi hành phải nói cái mã **làm**, không nói cái mã **định làm**.
- **Bảng "cửa còn mở" là bắt buộc và không được rút gọn.** Mỗi quy tắc có ít nhất một hàng thật, đọc
  ra từ mã.

## Rủi ro còn mở

Từng cửa còn mở, kèm **thứ quy tắc sẽ phải xét để đóng nó** — hoặc lý do đóng đắt hơn để mở.

| Những chỗ còn lọt | Phải xét thêm gì để đóng | Đáng đóng không |
|---|---|---|
| Ra khỏi `/src/components/` là cả ba quy tắc biến mất | Một danh sách thư mục lấy từ cấu hình, thay cho phép kiểm tra chuỗi con cứng | **Đáng.** Đây là cửa rộng nhất và rẻ nhất để đóng: chuyển phạm vi sang `files` của cấu hình lint, để mỗi kho tự khai chỗ áp dụng. Rủi ro hiện tại là một lần đổi tên thư mục vô hiệu hoá cả mô-đun mà không ai biết |
| Bản sao khai báo **bên trong** một tệp tên hợp lệ | Duyệt khai báo cấp cao nhất và tên biến/hàm được xuất, thay vì chỉ tên tệp | **Đáng.** Chi phí thấp, và nó biến quy tắc tên tệp thành quy tắc thật. Đây là lỗ hổng làm quy tắc số một gần như vô nghĩa với một tác giả đã biết nó tồn tại |
| Đổi tên: `Placeholder`, `Loading`, `Shimmer`, `Resting`, gạch nối, dấu chấm, `.jsx` | Mở rộng danh sách từ và cho phép dấu ngăn cách trong tên tệp | **Đáng một phần.** Mở rộng danh sách từ là rẻ; nhưng danh sách từ nào cũng đóng được bằng một từ mới. Cửa này chỉ **hẹp lại**, không đóng được, và cần nói thẳng như vậy |
| Hằng số rửa sạch phần tử: `const resting = <X/>` rồi `skeleton={resting}` | Lần theo biến trong phạm vi qua `sourceCode.getScope`, để biết một `Identifier` có trỏ tới `JSXElement` không | **Đáng, trong phạm vi một tệp.** Lần theo trong cùng tệp là việc làm được. Lần theo qua tệp khác thì cần thông tin kiểu và một vòng phân giải module — chỗ đó đắt hơn nhiều so với thứ nó cứu |
| Tên thuộc tính thứ tư: `loadingView`, `restingSlot`, `renderSkeleton` | Xét **kiểu** của prop thay vì tên: bất kỳ prop nào nhận `ReactNode` mà tên gợi ý trạng thái chờ | **Không đáng ngay.** Cần thông tin kiểu, tức là bật `parserServices` với chương trình đầy đủ, làm lint chậm hẳn. Rẻ hơn là mở rộng danh sách tên khi thấy trường hợp thật |
| Cây nằm trong prop dạng đối tượng: `props={{ fallback: <X/> }}` | Thăm thêm `Property` bên trong `ObjectExpression` của một `JSXExpressionContainer` | **Rất đáng.** Ở một kho có quy ước dồn mọi thứ vào một prop đối tượng, đây không phải cửa hẹp mà là cửa chính. Chi phí gần bằng không: thêm một visitor |
| Nhập theo alias: `from "@/components/…"` | Bỏ điều kiện đường dẫn tương đối, hoặc đọc alias từ cấu hình đường dẫn của trình biên dịch | **Đáng.** Bỏ hẳn điều kiện tương đối là một dòng. Điều kiện này gần như chỉ còn tác dụng với các lần nhập từ thư mục bên cạnh |
| Đổi tên khi nhập: `import { XSkeleton as Resting }` | Xét `specifier.imported.name` bên cạnh `specifier.local.name` | **Đáng.** Một dòng, và nó chặn cách lách hiển nhiên nhất |
| Quy tắc nhánh: cùng tên thẻ gốc, ruột khác nhau | So sánh sâu hơn — số con, tên các con, hoặc sự có mặt của cùng những thành phần | **Không đáng đóng hết.** So cây là việc không có điểm dừng và sẽ đẻ ra báo động giả. Nhưng một bước nông — so tên các con trực tiếp khi tên gốc trùng — bắt được phần lớn cặp `div`/`div` với chi phí chấp nhận được |
| Cờ chờ viết dưới dạng khác: `state === "pending"`, `isLoadingCourses`, `loading`, `isFetching` | Nới mẫu thành `\b(?:is\|has)?\s*(?:Loading\|Pending\|Skeleton\|Fetching\|Busy)`, hoặc nhận ra phép so sánh với chuỗi `"pending"` | **Đáng.** Nhận thêm `=== "pending"` là quan trọng nhất, vì đó chính là hình thái luật mô tả. Nới mẫu cờ thì phải cân với báo động giả |
| `if`/`&&`/`switch` thay cho ba ngôi | Thêm visitor `IfStatement`, `LogicalExpression` và `SwitchStatement` | **Đáng một phần.** `IfStatement` với `return` phần tử ở hai nhánh là mẫu rõ và bắt được. `&&` viết thành hai câu tách rời thì phải nhìn cả hai cùng lúc — đắt hơn nhiều |
| `.stories.tsx` bị coi là mã sản phẩm | Thêm `.stories.` vào phép kiểm tệp không phải sản phẩm | **Đáng, nhưng phải hỏi.** Một tệp trưng bày trạng thái có thể là chỗ hợp pháp để dựng hình dạng nghỉ, hoặc là chỗ bản sao trốn vào. Đây là quyết định của luật, không phải của quy tắc |
| Năm mã `LOADING-3` … `LOADING-7` không có quy tắc | Chiều cao và im lặng với trình đọc màn hình cần xét `className`/`aria-hidden` trên cây nghỉ; một cờ dùng chung cần đếm số nguồn dữ liệu; union trạng thái cần thông tin kiểu | **Chưa quyết được ở đây.** `LOADING-4` (`aria-hidden` trên phần tử nghỉ) là cái rẻ nhất và nên là quy tắc tiếp theo. `LOADING-7` cần thông tin kiểu và có lẽ thuộc về trình biên dịch chứ không phải lint |

Và rủi ro bao trùm, không thuộc quy tắc nào: **một bản báo cáo lint xanh ở mô-đun này chứng minh
được rất ít.** Nó chứng minh không có tệp nào tên `*Skeleton` trong cây thành phần, không có ba tên
thuộc tính đó nhận phần tử trực tiếp, và không có ba ngôi nào với cờ đúng chính tả chọn hai tên gốc
khác nhau. Nó **không** chứng minh màn hình không nhảy, không chứng minh trình đọc màn hình im, và
không chứng minh hình dạng lúc chờ là cùng một hình dạng.

## Khi nào cần kiểm lại

- `sources/fe/loading.mjs` thêm, bớt hoặc đổi tên một quy tắc trong `export const rules`.
- Một mã `LOADING-<n>` mới xuất hiện trong luật, hoặc một mã hiện có đổi nghĩa.
- Một cửa còn mở ở bảng trên được đóng — tài liệu phải hạ hàng đó khỏi bảng và ghi vào changelog.
- Một cửa còn mở **mới** được phát hiện trong mã đang chạy; đó là thay đổi tài liệu và vẫn tăng
  phiên bản, vì lỗ hổng có sẵn từ trước chỉ là chưa được viết ra.
- Cây thư mục của một kho áp dụng đổi khỏi `/src/components/`, làm cả ba quy tắc im mà không sửa gì.
- Một kho phải tắt quy tắc cho tệp nguyên thuỷ nghỉ (Finding 3) — đó là lúc bất đồng đó phải được
  giải quyết trong mã chứ không phải trong tài liệu.
- Số báo động giả từ `fallback` (Finding 4) đủ lớn để có người đề nghị bỏ tên đó khỏi danh sách.
