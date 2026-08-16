---
id: fe-patterns-file-layout-audit
title: audit.md
slug: /fe/patterns/file-layout/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo vào code thật của luật file layout.
---

# audit.md

> Version: `2.00` · Module: `file-layout`

Audit này kiểm hai thứ. Thứ nhất: luật có chọn được **một đích đến** từ bản chất của file, và chỉ từ
đó. Thứ hai — phần riêng của shelf `patterns` — mỗi mã có thật sự **được giữ** ở tầng mà nó khai, và
có **neo được vào code thật** không.

## Verdict

Chấp nhận, kèm hai điều kiện được ghi rõ chứ không được lờ đi.

Sáu mã đều tổng quát, đều có rule mang tên, và không mã nào cần tên của một sản phẩm để đọc được.
Hai điều kiện:

1. **`enforced` ở đây nói rằng có rule, không nói rằng luật đã được giữ đủ.** Bốn trong sáu rule đọc
   **đường dẫn** trong khi luật nói về **nội dung**. Cột cuối của bảng `## Tầng giữ` là chỗ khoảng
   cách đó được nói ra, và nó không được đọc thành chú thích.
2. **`FILE-5` không neo được vào code sản xuất.** Nó ở lại trong luật vì cây một app là một **ảnh
   chụp**, không phải một quyết định.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `FILE-1` vs `FILE-2` | Loại trừ được: một bên hỏi quan hệ tên ↔ export, một bên đếm file trong thư mục màn hình |
| `FILE-1` vs `FILE-4` | Loại trừ được: một bên hỏi tên đã export thuộc họ nào, một bên hỏi hình dạng export. Một namespace object thoả `FILE-1` và vi phạm `FILE-4` — chồng lấn này là **cố ý** |
| `FILE-2` vs `FILE-3` | Loại trừ được: `FILE-2` bắt file thứ ba bất kỳ trong ba tier màn hình; `FILE-3` bắt đúng bốn tên thư mục ở mọi chỗ dưới `components/`. Một `utils/` trong thư mục page vi phạm cả hai, và đó là hai lời khai khác nhau |
| `FILE-3` vs `FILE-5` | Loại trừ được: một bên hỏi *nó có render không*, một bên hỏi *nó có biết feature không* |
| `FILE-5` vs mọi mã | Loại trừ được bằng hình dạng workspace: một app thì mã này không kích hoạt |
| `FILE-6` vs `FILE-2` | Loại trừ được: một bên hỏi **file nào** ở trong `app/`, một bên hỏi **bên trong** hai nửa có gì |
| Thiếu dữ kiện | Hỏi đúng một câu: "file này **là** cái gì, không phụ thuộc ai đang gọi nó?" |

## Findings

- **Sáu mã, sáu rule, không dòng nào `documented`.** Đây là kết quả tốt và cũng là cái bẫy lớn nhất
  của bảng `## Tầng giữ`: một mã có thể `enforced` mà phần lớn vẫn không được giữ.
- **`FILE-1` giữ ít hơn câu chữ của luật.** Luật gốc nói rule "cho phép một component và các biến
  thể có kiểu riêng ở chung thư mục **trong khi một hành khách không cùng họ thì không**". Cài đặt
  thực tế duyệt thư mục ngay khi **có một** export thuộc họ, nên một hành khách ngồi cạnh một export
  khớp tên vẫn qua cửa. Trong cây thật, một thư mục branch đang export cả tên họ của nó lẫn một
  component thứ hai không cùng họ — và không gì đỏ. Đây là **lệch giữa văn bản và cài đặt**, được ghi
  lại chứ không sửa lén.
- **`FILE-2` và `FILE-6` không nhìn được vào nội dung.** Cả hai đã tự khai điều đó trong chính
  source của rule. Một `component.tsx` chứa bốn component, và một `page.tsx` tự fetch tự sắp đặt, đều
  qua cửa.
- **`FILE-3` bắt thư mục, không bắt file lẻ.** `InvoiceRow/format.ts` không phải một `utils/`, nên
  nó vô hình với rule trong khi vẫn vô hình với người thứ hai — đúng cái hại mà mã này sinh ra để
  chặn.
- **`FILE-4` phân biệt bằng chữ hoa đầu tên.** Một namespace đặt tên thường, hoặc chỉ có một thành
  viên, không bị bắt.
- **`FILE-5` trơ theo thiết kế trong cây một app.** Cả hai biểu thức đòi một đoạn `packages/*/src/`
  hoặc `apps/*/src/`. Không có gì sai với rule; chỉ là hiện không có gì để nó đọc.
- **Có những khẳng định trong luật gốc không mang mã nào.** Bảng Forbidden cấm "category folder dưới
  `leaves/` hoặc `branches/`" và cấm "`blocks/<Name>/` phẳng không có category". Hai điều này là luật
  thật, được giữ nguyên trong `## Law`, nhưng chúng **không thuộc `FILE-1..6`** và không có rule
  nào. Module này có sáu mã và kết thúc với sáu mã, nên chúng được ghi ở đây thay vì được đánh số.
- **Đích đến `modules/types/` lệch với cây thật.** Cây hiện tại có `src/types/` ở gốc. Rule không hề
  vi phạm — nó chỉ cấm bốn tên đó **dưới `components/`** — nhưng luật nêu đích đến là `modules/types/`,
  và hai thứ đang không khớp.
- **`resources/` chưa tồn tại.** Điều này **đúng luật**: đích đến được tạo ở lần dùng đầu tiên, không
  được giữ rỗng sẵn.

## Decisions

- Giữ đúng sáu mã, đúng số và đúng nghĩa: `FILE-1` … `FILE-6`. Chúng là **địa chỉ** mà file luật
  khác và task record cũ đã trích dẫn; đánh số lại một mã là làm gãy một trích dẫn đã có người viết
  ra.
- Ghi `enforced` cho cả sáu, vì cả sáu đều có một rule gọi được tên. Phần rule **không** giữ được
  không được phép làm mờ tầng, mà được ghi thành một cột riêng.
- Neo mỗi mã vào **file test của chính rule** làm neo chính, vì file đó gọi thẳng tên từng mã, và vào
  glob của cây làm neo phụ, vì đó là nơi luật thật sự được sống.
- Ghi `FILE-5` là `chưa neo được` trong code sản xuất, và giữ nguyên mã.
- Giữ mọi ví dụ ở dạng cây thư mục thường và TSX thường, không tên sản phẩm, không tên repository.
  Nơi luật gốc gọi tên một component riêng, ví dụ được viết lại thành tên tổng quát.
- Không sửa `sources/fe/file-layout.mjs` trong lần chuyển shelf này. Mọi bất đồng ở trên là **đề xuất
  rule change**, không phải giấy phép sửa im lặng.

## Rủi ro còn mở

**Không mã nào ở tầng `documented`.** Cả sáu đều có rule mang tên, nên phần này không liệt kê mã
`documented` — nó liệt kê **phần luật mà rule không nhìn thấy**, và với mỗi phần, nói rõ một rule sẽ
phải **thấy được cái gì** thì mới giữ nổi.

- **`FILE-1` — hành khách đi nhờ.** Rule dùng "có ít nhất một export thuộc họ", trong khi luật nói
  "một component, một thư mục". Để giữ được, rule sẽ phải thấy **mọi** export giá trị của `index.tsx`
  và đòi tất cả đều thuộc họ, cộng một danh sách miễn cho những export không phải component (`meta`,
  các `type`). Việc này làm được bằng AST, và nó là một đề xuất rule change chứ không phải một lần
  đọc khác đi.

- **`FILE-2` — bốn component trong một `component.tsx`.** Rule đếm file. Để giữ được, rule sẽ phải
  đếm **số khai báo component** trong một file và phân biệt component với hàm thường — nghĩa là suy ra
  "cái này trả về JSX và được dùng như một element". Đây là heuristic, và một heuristic sai ở tier này
  sẽ chặn cả những `component.tsx` hợp lệ có sub-render nội bộ. Chưa có đề xuất nào đủ chắc.

- **`FILE-3` — helper là file lẻ, không phải thư mục.** Để giữ được, rule sẽ phải thấy rằng một
  module dưới `components/**` **không export gì render được** — không JSX, không component. Đây là
  phép thử khả thi và hẹp hơn phép thử của `FILE-2`, nên nó là ứng viên rule change đáng làm nhất
  trong danh sách này.

- **`FILE-4` — namespace tên thường, hoặc một thành viên.** Để giữ được, rule sẽ phải thấy rằng các
  **giá trị** trong object là component (identifier trỏ tới một khai báo trả về JSX) thay vì suy từ
  chữ hoa đầu **tên**. Việc này cần phân giải scope, không chỉ đọc key.

- **`FILE-5` — không có neo trong code sản xuất.** Không rule nào chữa được điều này, vì không có
  gì để đọc: workspace hiện chỉ có một app. Neo sẽ xuất hiện đúng vào ngày app thứ hai ra đời, và
  ngày đó là một trong các re-audit trigger dưới đây.

- **`FILE-6` — `page.tsx` tự vẽ.** Source của rule đã tự khai: "vẽ" không phải thuộc tính đo được
  bằng đường dẫn. Để giữ được, phải là một rule đọc nội dung, và nó sẽ phải phân biệt "mount một
  component" với "sắp đặt sáu thứ" — trong khi cả hai đều trả về JSX. Cách rẻ hơn và chắc hơn là để
  `FILE-2` giữ phần này qua việc tách hai nửa, và đó là lý do hai mã không được gộp.

- **Khẳng định không mang mã.** "Category dưới `leaves/`/`branches/`" và "`blocks/<Name>/` phẳng không
  có category" là luật thật, không có mã và không có rule. Một rule giữ được chúng chỉ cần đọc đường
  dẫn: đếm số đoạn giữa tên tier và tên component. Việc chúng chưa có mã là **hệ quả của việc giữ
  nguyên sáu địa chỉ cũ**, không phải một đánh giá rằng chúng ít quan trọng hơn.

- **`modules/types/` và `src/types/` đang lệch nhau.** Rủi ro là người đọc tiếp theo lấy cây thật làm
  chuẩn rồi kết luận luật đã cũ. Cần một quyết định của người sở hữu luật: hoặc dời cây, hoặc sửa đích
  đến trong luật. Không được để hai bản cùng đúng.

## Re-audit Triggers

- Workspace có app thứ hai — `FILE-5` lần đầu có neo thật, và bảng `## Anchor` phải được viết lại.
- Có đề xuất thêm hoặc bỏ một mã `LAYOUT-<n>`.
- `sources/fe/file-layout.mjs` đổi phạm vi của bất kỳ rule nào — bảng `## Tầng giữ` và cột "rule không
  nhìn thấy" phải được đo lại, không được suy đoán.
- Một mã bị hạ từ `error` xuống `warn` ở repository tiêu thụ, hoặc ngược lại.
- Xuất hiện một tier mới, hoặc một tier đổi giữa "biết feature" và "không biết feature".
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Cùng một lỗi đặt file quay lại lần thứ ba dù rule vẫn xanh — dấu hiệu rằng khoảng cách ở cột cuối
  bảng `## Tầng giữ` đã đủ lớn để thành một rule change.
