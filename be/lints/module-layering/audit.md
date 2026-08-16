---
id: be-lints-module-layering-audit
title: audit.md
slug: /be/lints/module-layering/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện phần cưỡng chế của luật phân tầng mô-đun — đo được tới đâu, và hụt ở đâu.
---

# audit.md

> Version: `2.00` · Mô-đun: `module-layering`

Phản biện này kiểm xem hai quy tắc có giữ được đúng phần luật mà tài liệu nói chúng giữ, và chỉ phần
đó.

## Verdict

Chấp nhận, kèm ba khoảng trống đã ghi tên.

Nguồn công bố **đúng hai** quy tắc trong `rules` và **đúng hai** trong `recommended`; hai danh sách
khớp nhau, cả hai đều xin mức `error`, cả hai đều `meta.type: "problem"` và cả hai đều `schema: []`.
Con số đó khớp với con số đã dự kiến khi mở mô-đun này, nên không có gì phải cải chính.

Cả hai quy tắc đều làm đúng một việc mà chúng có thể làm chắc chắn: so chuỗi trên một specifier tĩnh,
trong một tệp, không phân giải gì. Đó là lý do chúng để được ở `error`. Cái giá của lựa chọn đó là
mọi thứ cần tệp thứ hai đều nằm ngoài tầm, và bảng dưới đây ghi lại chính xác phần nằm ngoài đó.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `LAYERING-1` so với `LAYERING-2` | Phân định được: một bên đo hình dạng specifier, một bên đo quan hệ giữa specifier và đường dẫn tệp đang import. Một dòng có thể vi phạm cả hai, và hai báo cáo là đúng chứ không phải trùng |
| Barrel so với tệp | **Không phân định được.** Quy tắc đếm số đoạn; `index`, một thư mục con và một đoạn rỗng đều bằng một tệp |
| Năng lực so với thư mục nhóm | Phân định được, nhưng bằng một `Set` ba tên viết tay. Sai một tên là sai cả hai chiều |
| Đường dài so với đường ngắn của cùng một năng lực | Phân định được nhờ hai khoá tự thân — và chính chỗ đó sinh ra một báo nhầm khi có một năng lực khác trùng tên ngắn |
| Năng lực anh em so với năng lực con lồng | **Không phân định được bằng một tệp.** Đây là lý do `LAYERING-3` không có quy tắc |
| Vượt ranh giới bằng alias so với bằng đường tương đối | Chỉ thấy vế alias. Vế tương đối vô hình với cả hai quy tắc |
| Tệp trong cây năng lực so với tệp ngoài | Phân định được bằng `lastIndexOf` ba chuỗi root — tức bằng hình dạng thư mục, không bằng cấu hình |

## Findings

1. **Ba trên năm mã luật không có quy tắc nào giữ.** `LAYERING-3`, `LAYERING-4`, `LAYERING-5`.
   `LAYERING-3` bị bỏ ra **có chủ ý** và nguồn nói rõ lý do; hai mã còn lại chỉ đơn giản là không
   được nhắc tới.
2. **`LAYERING-5` là khoảng trống nguy hiểm nhất, vì nó trông như đã được giữ.**
   `must-deep-module-import` giữ nửa bên **gọi**; không gì giữ nửa bên **khai báo**. Viết một
   `index.ts` tái xuất cả thư mục là hợp lệ với mọi quy tắc ở đây, và một khi tệp đó tồn tại thì mọi
   đường tương đối tới nó cũng hợp lệ.
3. **Tên quy tắc hứa nhiều hơn phần nó đo.** `must-deep-module-import` gợi ý "import sâu tới tệp";
   phần thực sự được cưỡng chế là "có ít nhất một đoạn sau tên năng lực". Thông điệp `barrel` nói
   "gọi tên một năng lực và không tệp nào" — mệnh đề "không tệp nào" là câu của **luật**, không phải
   thứ quy tắc đo được.
4. **`no-self-module-alias` neo vào hình dạng thư mục, không vào cấu hình.** Ba chuỗi root
   `/src/modules/`, `/src/features/`, `/src/tests/` nằm trong nguồn quy tắc. Một kho có cây năng lực
   ở chỗ khác nhận **im lặng hoàn toàn**: không lỗi, không cảnh báo, không dấu vết.
5. **`ALIASES` và `META_ROOTS` đều là danh sách đóng viết tay, và cả hai đều hụt theo hai chiều.**
   Thiếu một tên thì barrel dưới nó qua được; thừa hoặc lệch một tên thì mã đúng bị báo. Chiều thứ
   hai đắt hơn chiều thứ nhất, vì nó dạy người đọc thói quen cuộn qua báo lỗi.
6. **Đoạn rỗng và đoạn `"."` được đếm như đoạn thật.** `@modules/ai/`, `@modules//ai`,
   `@modules/./ai` đi lọt cả hai quy tắc bằng cùng một phép cộng. Không phải phá hoại — chỉ cần một
   lần dán tay là ra.
7. **`lastIndexOf` chứ không phải `indexOf`.** Đường dẫn chứa root hai lần thì năng lực được suy từ
   lần xuất hiện **sâu nhất**. Với cây bình thường thì không khác gì, nhưng với thư mục fixture lồng
   nhau thì nó quyết định khác đi mà không có gì báo.
8. **Thứ tự `ALIASES` là thứ tự thắng.** Một tệp mà đường dẫn chứa nhiều root chỉ nhận **một** bộ
   khoá tự thân, và `@modules/` luôn thắng vì nó đứng đầu mảng.
9. **Ba loại nút, không hơn.** Chỉ `ImportDeclaration`, `ExportNamedDeclaration` có `source` và
   `ExportAllDeclaration`. `import()`, `require()` và `import X = require()` không được thăm — và
   dạng thứ ba là dạng một tệp cấu hình hay dùng nhất.
10. **Không quy tắc nào không tắt được.** Một dòng `eslint-disable-next-line` mở mọi cửa đã đóng ở
    trên.

## Decisions

- Chỉ ghi lại **hai** quy tắc có thật trong nguồn. Quy tắc đáng có mà chưa có thì nằm ở mục "Rủi ro
  còn mở", không được lẻn vào bảng `## Rules`.
- Không đặt mã số cho quy tắc. Danh tính là **tên đã công bố**; một quy tắc hai tên là một quy tắc
  không thể truy nguyên từ log build về tài liệu.
- Giữ nguyên `LAYERING-3` ở trạng thái không có quy tắc. Viết nó thành một quy tắc đọc từng tệp rồi
  đoán sẽ phá đúng thứ khiến hai quy tắc hiện có để được ở `error`; nếu cần cưỡng chế thì phải là một
  cổng duyệt cây, và cổng đó không thuộc shelf này.
- Nói thẳng rằng `must-deep-module-import` đo **số đoạn**, ở cả `INDEX.md`, `vi.md` và `example.md`.
  Đây là chỗ dễ đọc quá tay nhất của mô-đun.
- Giữ mọi ví dụ ở dạng tổng quát: tên năng lực chung chung, không tên sản phẩm, không tên kho mã.
  Tên quy tắc, tên thông điệp, tiền tố alias và tên thư mục mà quy tắc so khớp là **định danh có
  thật trong sản phẩm biên dịch** nên được chép nguyên văn; miễn trừ đó không mở rộng ra chỗ nào
  khác.
- Coi "im lặng" là một kết quả phải báo cáo, ngang với "có bắn". Với hai quy tắc này, im lặng gồm cả
  trường hợp *không nhìn tới*.

## Rủi ro còn mở

Mỗi mục ghi: cửa mở, và **quy tắc phải soi thêm cái gì** thì mới đóng được — hoặc vì sao đóng lại
đắt hơn để mở.

- **Đoạn cuối là thư mục, không phải tệp** (`@modules/ai/index`, `@modules/ai/services`). Muốn đóng
  thì quy tắc phải **phân giải specifier trên đĩa** hoặc đọc ánh xạ đường dẫn của trình biên dịch:
  biết `services` là thư mục có `index.ts`. Đó là chạm vào hệ thống tệp trong một quy tắc lint —
  chậm, phụ thuộc thứ tự, và sai khác giữa máy trạm với CI. Rẻ hơn nhiều là một cổng riêng cấm chính
  **sự tồn tại** của tệp barrel; xem mục `LAYERING-5` dưới đây.
- **Đoạn rỗng và đoạn `"."`** (`@modules/ai/`, `@modules//ai`, `@modules/./ai`). Đóng được và nên
  đóng: chuẩn hoá phần còn lại trước khi tách — bỏ đoạn rỗng và đoạn `"."`, rồi mới đếm. Vài dòng,
  không phụ thuộc gì thêm. Đây là cửa rẻ nhất trong danh sách này.
- **Dạng động** (`import()`, `require()`, `import X = require()`). Đóng được: thêm bộ thăm cho
  `ImportExpression`, cho `CallExpression` có `callee.name === "require"` và đối số đầu là literal
  chuỗi, và cho `TSImportEqualsDeclaration`. Chi phí thấp, phần khó chỉ là lấy đúng nút chuỗi để báo.
- **Đường tương đối vượt ranh giới** (`../../ai`, `../billing/billing.service`). Đây là cửa **rộng
  nhất** và cũng là cửa **đắt nhất**. Muốn đóng thì phải phân giải đường tương đối về đường tuyệt
  đối, so nó với năng lực suy từ `context.filename`, và quyết định xem đích có nằm ngoài năng lực đó
  không — tức là biến một quy tắc so chuỗi thành một quy tắc biết cây thư mục. Làm được, nhưng nó
  cùng loại việc với `LAYERING-3`, nên nên gộp vào cùng một cổng duyệt cây thay vì nhét vào đây.
- **Alias và thư mục nhóm là danh sách đóng viết tay.** Muốn đóng thì hai danh sách phải thành
  **tuỳ chọn của quy tắc** (`schema` thay vì `[]`) và được nạp từ ánh xạ đường dẫn của dự án. Đổi lại
  là mất tính "một luật, một hình dạng": mỗi kho tự khai alias của mình thì hai kho lại lệch nhau,
  đúng thứ mà việc để rule trong nguồn đang ngăn. Cân nhắc rõ: giữ danh sách đóng, và coi việc thêm
  một alias là một thay đổi luật có tăng số phiên bản.
- **Root của `no-self-module-alias` neo vào `/src/<lớp>/`.** Muốn đóng thì phải suy năng lực từ ánh
  xạ đường dẫn thay vì từ chuỗi cứng. Cùng đánh đổi như trên. Rủi ro thật nằm ở chỗ **thất bại của nó
  là im lặng**: một kho lệch bố cục sẽ xanh mà không được kiểm. Chốt bù rẻ nhất không nằm trong quy
  tắc mà nằm ở kiểm chứng khi áp dụng: chạy một tệp cố tình sai và **thấy nó đỏ** trước khi tin cổng.
- **Tệp nằm thẳng trong thư mục nhóm** (`src/modules/platform/config.service.ts`). Khoá tự thân lấy
  nhầm tên tệp làm tên năng lực. Đóng được bằng cách đòi đoạn thứ hai **không có phần mở rộng** thì
  mới coi là tên năng lực. Rẻ, và nên làm cùng đợt với chuẩn hoá đoạn rỗng.
- **Báo nhầm khi tên ngắn trùng với một năng lực có thật.** Từ trong `platform/exceptions/`, một
  import tới `@modules/exceptions/...` khác hẳn vẫn bị báo `self`. Muốn đóng thì quy tắc phải biết
  **danh sách năng lực đang tồn tại** — lại là đọc cây thư mục. Chi phí để mở: một báo nhầm hiếm gặp
  nhưng dạy đúng thói quen xấu nhất. Cần theo dõi; nếu một kho thật gặp nó thì đó là lý do đủ để đưa
  việc suy năng lực ra khỏi chuỗi cứng.
- **Tự trỏ đi vòng qua tệp thứ ba.** Không đóng được bằng bất kỳ quy tắc một-tệp nào, kể cả về
  nguyên tắc. Thuộc về cổng phát hiện chu trình trên đồ thị import, và nên nói thẳng là như vậy thay
  vì giả vờ có ai đó giữ.
- **`LAYERING-5` nửa khai báo — không gì cấm viết ra một barrel.** Đóng được và **rẻ**: một quy tắc
  chỉ cần `context.filename` khớp `/index\.ts$/` trong cây năng lực và trong tệp có
  `ExportAllDeclaration`. Đây là đề xuất mạnh nhất của lần rà này, vì nó đóng luôn gốc của khe hở
  đếm-đoạn ở mục đầu tiên: không có tệp barrel thì không có gì để `@modules/ai/index` trỏ tới.
- **`LAYERING-4` không có quy tắc nào.** "Chỉ composition root biết toàn cục" là một mệnh đề về
  **vai trò của một tệp**, không phải về hình dạng một dòng mã; một quy tắc lint không có khái niệm
  "toàn cục". Nhiều khả năng đây là mã phải giữ bằng review kiến trúc, và nói thế thì trung thực hơn
  là để trống mà không giải thích.
- **`LAYERING-3` không có quy tắc, có chủ ý.** Không đóng ở tầng này. Nếu cưỡng chế thì viết thành
  cổng duyệt cây có phạm vi theo glob đường dẫn, và ghi rõ nó không phải quy tắc đọc từng tệp.
- **Mọi quy tắc đều tắt được bằng một dòng.** Không đóng. Một bộ quy tắc không tắt được là một bộ
  quy tắc người ta sẽ gỡ khỏi cấu hình; cửa này để mở là cố ý, nhưng phải được đếm khi đọc một cổng
  xanh.

## Re-audit Triggers

- Nguồn công bố thêm hoặc bớt một quy tắc, hoặc `rules` và `recommended` thôi khớp nhau.
- `ALIASES` hoặc `META_ROOTS` đổi một phần tử.
- Ba chuỗi root của `no-self-module-alias` đổi, hoặc một kho áp dụng có cây năng lực không nằm dưới
  `/src/<lớp>/`.
- Có ai đề xuất mở `schema` để cấu hình alias theo từng kho.
- Có quy tắc mới giữ `LAYERING-3`, `LAYERING-4` hoặc nửa khai báo của `LAYERING-5`.
- Phát hiện một cửa mở chưa có trong bảng — kể cả khi không sửa gì, một cửa tìm ra mà không ghi lại
  chính là thất bại mà shelf này sinh ra để ngăn.
- Một mức `error` được hạ xuống `warn` trong lúc áp dụng mà không kèm con số đo được.
- Có báo nhầm thật xảy ra ở khoá ngắn dưới thư mục nhóm.
