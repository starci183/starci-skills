---
id: fe-patterns-vendor-boundary-audit
title: audit.md
slug: /fe/patterns/vendor-boundary/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật vendor boundary.
---

# audit.md

> Version: `2.00` · Module: `vendor-boundary`

Audit này kiểm ba thứ: luật có phán quyết được **từ đường dẫn file và package được import** hay
không, mỗi mã đang được **tầng nào** giữ, và mỗi mã có **neo được vào code thật** hay không.

## Verdict

Chấp nhận, kèm bốn khoảng hở đã ghi tên và một bất đồng giữa văn bản luật cũ với rule đang chạy.

Luật phân định tốt vì tiêu chí của nó là **đường dẫn**, không phải ý định. Một file hoặc nằm trong
danh sách chủ sở hữu đóng hoặc không; không có phán quyết nào phụ thuộc vào việc người viết thấy nó
tiện hay không. Đó là lý do mười trên mười bốn mã giữ được bằng máy.

Điểm yếu không nằm ở phân định mà nằm ở **độ phủ**: bốn mã hiện chỉ có người đọc giữ, và hai trong số
đó có rule tồn tại nhưng đang canh một đường dẫn cây không có.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `VENDOR-1` vs `VENDOR-2` | Loại trừ được: một bên hỏi *file này được import không*, bên kia hỏi *thư mục này được thêm thành viên không* |
| `VENDOR-1` vs `VENDOR-5` | Loại trừ được bằng prefix package; đây cũng chính là chỗ khoảng hở nằm |
| `VENDOR-2` vs `VENDOR-4` | Loại trừ được khi đã nêu file có sở hữu hành vi nào không |
| `VENDOR-2` vs `VENDOR-3` | Loại trừ được khi đã nêu slot là `children` không diễn giải hay contract có kiểu |
| `VENDOR-3` vs `VENDOR-4` | Loại trừ được: một bên nói về **ruột**, bên kia nói về **ai giữ wrapper** |
| `VENDOR-6` vs `VENDOR-12` | Loại trừ được khi đã nêu inset dọc đến từ shell hay từ màn dùng shell |
| `VENDOR-6` vs `VENDOR-8` | Loại trừ được khi đã nêu mặt thứ hai do shell tạo hay do nội dung mang vào |
| `VENDOR-7` vs `VENDOR-9` | Loại trừ được: mặt của ô nhập, hay label của nó |
| `VENDOR-10` vs `VENDOR-14` | Loại trừ được: *cái gì vẽ ra link* khác *link đi đâu*; một control sai được cả hai cùng lúc |
| `VENDOR-11` vs `VENDOR-2` | Loại trừ được khi đã nêu file sở hữu cơ chế hay ý nghĩa |
| `VENDOR-13` vs `VENDOR-1` | Loại trừ được: import đúng chỗ vẫn ráp sai được |
| Thiếu dữ kiện | Đường dẫn file luôn có sẵn, nên hiếm khi thiếu. Chỗ thật sự thiếu là **hình dạng ruột**, phải đọc data type mới biết |

## Findings

- **Tiêu chí phân loại là đường dẫn, không phải ý định.** Đây là điểm mạnh nhất của luật: nó không
  hỏi người viết định làm gì, nó đọc file đang nằm ở đâu.
- **Nửa soi-vào-trong là phần có giá trị nhất và dễ mất nhất.** Nửa soi-ra-ngoài ai cũng nghĩ ra;
  nửa soi-vào-trong sinh ra vì thư mục wrapper là chỗ những thứ khó xếp trôi về, và thứ đầu tiên xin
  vào luôn là thứ khó xếp nhất.
- **Mười mã có rule, bốn mã chỉ có người đọc.** Chi tiết ở bảng `Tầng giữ` trong `INDEX.md`.
- **Hai trong bốn mã "documented" có rule tồn tại nhưng chết.** `field-input-uses-secondary-variant`
  và `field-label-is-text-only` cùng scope vào `src/components/leaves/Field/index.tsx`. Cây thật có
  `src/components/composites/Field/index.tsx` và `src/components/leaves/Input/index.tsx`. Hai rule
  return sớm cho **mọi** file, nên chúng không bao giờ chạy. Một rule không bao giờ chạy không giữ gì
  cả, nên hai mã này được ghi là `documented` chứ không phải `enforced`.
- **Nội dung luật của hai mã ấy hiện vẫn đúng trong code thật**, nhưng đúng do quy ước chứ không do
  gate: variant bị cố định ở `leaves/Input/index.tsx`, và `composites/Field` mount label chỉ với chữ
  dù leaf label có nhận `icon`. Đúng-mà-không-được-canh là trạng thái sẽ trôi mà không ai biết.
- **Văn bản luật cũ nói `shells/` đóng ở BA; rule và cây thật đều nói BỐN.** Rule nhận thêm
  `RouteShell` và tự ghi trong message rằng một danh sách lệch với canon là **gate bug**. Module này
  carry con số **bốn**, vì cây thật có bốn và tuyên bố ba sẽ khiến luật sai ngay lần đọc đầu tiên.
  Đây là một bất đồng được khai báo, không phải một lần sửa lặng lẽ — xem "Rủi ro còn mở".
- **Ba tên riêng trong luật cũ không tồn tại trong cây thật:** `SurfaceAccordionCard` (không có trong
  `branches/`), `leaves/Field` (đã thành `composites/Field`), `QuickActionRow` (cây có
  `QuickActionsList`). Mã và ý nghĩa được giữ nguyên; drift được ghi thành finding.
- **`VENDOR-5` là một khoảng trống có chủ ý, và cái giá của nó đã hiện thực hoá một lần.** Một caret
  từng được import thẳng từ package glyph ở một kích thước không tồn tại ở đâu khác, và không có gì
  báo. Mã tồn tại để lần sau không phải phát hiện lại.
- **`VENDOR-13` là mã duy nhất mà một test xanh làm hại.** Truyền chữ vào root giữ được accessible
  name mà không vẽ ra ô nào, nên truy vấn theo semantic xanh trong khi cả hình lẫn tương tác đều hỏng.
- **Rule của `VENDOR-12` khớp theo TÊN được import chứ không theo đường dẫn**, sau khi bản khớp
  đường dẫn chỉ nhận ra layout một-app và bắt một workspace phát hành cùng branch từ package phải
  import một module không tồn tại ở đó. Đây là quyết định đúng và cần được giữ.

## Decisions

- Giữ đúng **mười bốn** mã, nguyên số và nguyên nghĩa: `VENDOR-1` … `VENDOR-14`. Không đánh số lại,
  không thêm, không bớt. Các mã này được trích dẫn từ file luật khác và từ record công việc cũ.
- Danh sách chủ sở hữu là **đóng**, và ranh giới soi **hai chiều**. Nửa soi-vào-trong được giữ nguyên
  hiệu lực.
- Ghi tầng giữ **trung thực**: chỉ gọi `enforced` khi tìm được rule và gọi được tên nó. Một rule
  không bao giờ chạy được ghi là `documented`, kèm lý do.
- Ghi neo **trung thực**: hai mã được đánh dấu `neo lệch` vì luật neo được vào code thật nhưng **rule
  canh chỗ khác**. Không mã nào bị bỏ trống neo.
- Carry con số **bốn shell** và khai báo bất đồng với văn bản cũ, thay vì tuyên bố ba và để luật sai
  so với cây.
- Mọi ví dụ dùng vendor thay thế `@vendor/ui` / `@vendor/glyphs`. Đường dẫn thật chỉ xuất hiện trong
  bảng `Anchor`, vì một pattern module nợ người đọc một chỗ để kiểm.
- Không hạ mức bất kỳ rule nào để bảng đẹp hơn.

## Rủi ro còn mở

### Bốn mã chỉ được người đọc giữ

- **`VENDOR-3` — surface branch giữ ruột có kiểu.** Một rule muốn giữ mã này phải thấy: trong bốn
  file surface branch có tên, (a) data type không có property `children`, (b) tham số component
  không destructure `children`, (c) không có alias type nào lén đưa `children` vào — đúng ba cửa mà
  một cái lỗ đi qua. Nửa (a)+(b) đã có ở module `props-and-slots` dưới tên `no-children-slot`; phần
  còn thiếu là câu **"import wrapper không tạo ra quyền ấy"**, và câu đó là lý lẽ chứ không phải một
  hình dạng AST — chỗ này nhiều khả năng không có rule nào giữ được, chỉ có `vi.md` giữ.

- **`VENDOR-5` — thư viện glyph có ranh giới riêng.** Không rule nào **trong file này** giữ được,
  theo thiết kế: một rule gọi tên một package thì bảo vệ một package. Rule cần thiết đã tồn tại ở
  module icon (`no-vendor-icon-outside-icon-leaf`, rule khoá package glyph về đúng một vendor, và
  `no-off-scale-glyph-size`). Rủi ro thật không phải thiếu rule mà là **thiếu người kiểm rằng cả hai
  module cùng được bật**: tắt một trong hai thì khoảng trống mở lại đúng chỗ cũ. Một gate muốn đóng
  hẳn rủi ro này phải kiểm **effective config** chứ không kiểm từng rule.

- **`VENDOR-7` — Field nhà cố định variant input.** Rule `field-input-uses-secondary-variant` tồn tại
  nhưng scope vào `src/components/leaves/Field/index.tsx`, đường dẫn không có trong cây. Để giữ được
  mã này, rule phải thấy: (a) file sở hữu vendor input — hiện là `leaves/Input/index.tsx` — truyền
  `variant` là literal cố định, và (b) data type của field không khai báo property nào thuộc nhóm
  appearance (`variant`, `appearance`, `surface`, `tone`). Nửa (b) mới là nửa quan trọng: cố định giá
  trị mà vẫn mở slot thì slot sẽ được dùng.

- **`VENDOR-9` — label của field chỉ có chữ.** Rule `field-label-is-text-only` tồn tại nhưng scope
  vào cùng đường dẫn không có. Để giữ được, rule phải thấy **chỗ gọi**: file composite mount leaf
  label với property `icon` được truyền, hoặc có một map từ `kind` sang tên icon trong cùng file.
  Bản cũ tìm `Icon` nằm trong thẻ `<label>` — hình dạng đó không còn đúng khi label đã thành một leaf
  riêng nhận `icon` qua prop. Nói cách khác rule phải chuyển từ *tìm glyph trong markup* sang *tìm
  glyph được truyền vào label*.

### Khoảng hở bên trong những mã đã `enforced`

- **`VENDOR-1` chưa giữ được chữ "một".** Rule bắt vendor import ngoài danh sách đóng, nhưng hai leaf
  cùng import một primitive thì im lặng. Muốn giữ, rule phải gom theo **tên được import** trên toàn
  cây và báo khi một primitive có nhiều hơn một chủ — một phép kiểm liên-file, đắt hơn hẳn mọi rule
  hiện có ở đây.
- **`VENDOR-13` chỉ được giữ ở một đường dẫn.** Rule đọc `leaves/Checkbox/index.tsx` và tên
  `HeroCheckbox.*`. Câu tổng quát "compound control giữ giải phẫu" hiện không phủ radio, switch hay
  bất kỳ compound nào thêm sau. Muốn tổng quát, luật phải khai báo được **bảng giải phẫu bắt buộc**
  cho từng compound; không có bảng đó thì rule không có gì để so.
- **`VENDOR-11` giữ được mọi nửa cấu trúc nhưng chỉ chặn được nửa sản phẩm.** Message `direct` cấm
  gắn hành động thẳng vào icon tài khoản; nó không mô tả được rằng lần bấm ấy phải mở ra bản tóm tắt
  khách cộng hai lựa chọn. Một rule không đọc được ý nghĩa của một câu; nửa này gần như chắc chắn
  vĩnh viễn thuộc về người đọc.
- **`VENDOR-6` khớp `p-0` bằng so sánh literal.** `className={cn("p-0")}` hoặc `p-[0px]` sẽ bị báo
  dù đúng ý. Đây là đánh đổi có chủ ý: chính xác đổi lấy chặt chẽ. Nếu chỗ gọi cần biểu thức, đó là
  một rule change chứ không phải một lần lách.

### Bất đồng với văn bản luật cũ

- **Số shell: luật cũ nói ba, rule và cây nói bốn.** Module này carry **bốn** và ghi rõ ở đây. Nếu
  thầy quyết `RouteShell` không phải shell thì việc phải làm là **đổi cây và đổi rule**, không phải
  đổi con số trong văn bản; và nếu thầy quyết nó là shell thì `VENDOR-2` nên được viết lại thành
  "ba covering shell cộng một framework shell" ở lần tăng version sau. Cho tới lúc đó, chênh lệch này
  là một finding đang mở, không phải một luật hai nghĩa.

### Neo lệch và tên đã trôi

- **`SurfaceAccordionCard` không tồn tại trong `branches/`.** Nó vẫn nằm trong danh sách chủ sở hữu
  của `VENDOR-1`/`VENDOR-3` và trong danh sách cấm của `VENDOR-8`. Một tên trong regex mà cây không
  có là một dòng luật không bao giờ khớp: vô hại hôm nay, và là một cái bẫy vào ngày ai đó tạo file
  ấy với hình dạng khác.
- **`QuickActionRow` trong `VENDOR-14` không tồn tại; cây có `QuickActionsList`.** Leaf thật đang
  **không** được nửa `leaf` của rule canh. Nửa `internal` vẫn phủ nó, nên rủi ro là một `href` được
  **khai báo** trong data type mà không ai báo.
- **`leaves/Field` đã thành `composites/Field`.** Đây là gốc của cả `VENDOR-7` lẫn `VENDOR-9`.

## Re-audit Triggers

- Có đề xuất thêm một chủ sở hữu vào danh sách đóng, hoặc thêm một file vào `shells/`.
- Có file trong `shells/` không import vendor mà không phải framework shell.
- `leaves/Field` được tạo lại, hoặc `composites/Field` được đổi tên/di chuyển lần nữa.
- `SurfaceAccordionCard` hoặc `QuickActionRow` được tạo thật.
- Một package vendor thứ ba xuất hiện trong cây component mà chưa module rule nào gọi tên nó.
- Một rule trong `sources/fe/vendor-boundary.mjs` bị hạ mức, tắt, hoặc bị suppress tại chỗ gọi.
- Một compound control mới (radio, switch, select) được đưa vào `leaves/` mà không có bảng giải phẫu.
- Một `href` nội bộ lọt qua review, hoặc một URL ngoài bị ép qua router.
- Con số shell trong văn bản luật và trong rule vẫn chưa được hợp nhất ở lần tăng version kế tiếp.
