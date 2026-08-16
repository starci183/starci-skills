---
id: fe-lints-file-layout-audit
title: audit.md
slug: /fe/lints/file-layout/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phủ của sáu luật lint file-layout, và toàn bộ cửa còn mở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `file-layout`

Phản biện này kiểm một câu hỏi duy nhất: **máy nhìn thấy được bao nhiêu phần của luật, và phần còn
lại nằm ở đâu.** Mọi kết luận dưới đây đã được chạy thật trên chính các luật lint đó, không suy ra từ
tên luật.

## Kết luận

Chấp nhận, có điều kiện. Sáu luật lint, sáu mã luật, ánh xạ một-đối-một — không mã nào thiếu máy giữ,
không luật lint nào không neo vào một mã. Điều kiện là mô-đun này phải được đọc cùng bảng **Cửa còn
mở**: bốn trong sáu luật có một cửa lách nằm ngay trên **cách viết thông dụng nhất** của chính thói
quen mà chúng chặn, và ba luật có hành vi thật khác với điều tên gọi hoặc phần mô tả của chúng gợi
ra.

Mã nguồn publish **sáu** luật. Bản tóm tắt đầu file mã nguồn nói "bốn luật". Bảng `export const
rules` là nguồn sự thật; phần đầu file đã cũ và cần sửa.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Mỗi luật lint có đúng một mã luật | Đạt — `FILE-1` … `FILE-6`, mỗi mã đúng một luật |
| Mỗi mã luật có ít nhất một luật lint | Đạt — không mã nào chỉ còn là văn xuôi |
| Tên luật là danh tính duy nhất | Đạt — không có mã số thứ hai nào được đặt ra trong mô-đun này |
| Một luật đường dẫn có bị mô tả như đọc nội dung không | Đạt — cả sáu mục đều nêu rõ cơ chế thật |
| Cửa lách có được nêu bằng mã chạy được không | Đạt — 34 cửa, mỗi cửa có mã hoặc cây thư mục cụ thể |
| Phân biệt "im lặng" với "ngoài phạm vi" | Đạt — nêu thành một dòng riêng trong `Output` |
| Ví dụ có cần tên riêng của sản phẩm mới đọc được không | Không — mọi ví dụ là đường dẫn thường và `className` thường |
| Tên luật có bị viết lại cho "sạch" không | Không — giữ nguyên chuỗi mà bản dựng in ra |

## Phát hiện

1. **Phần đầu mã nguồn nói "bốn luật", thực tế publish sáu.** Bảng `rules` liệt kê
   `surface-folder-two-files-only`, `route-tree-holds-routes-only`, `no-helper-folder-in-components`,
   `export-matches-folder`, `no-runtime-namespace`, `monorepo-tier-belongs-to-its-side`. Đây là một
   dòng chú thích cũ, không phải một luật thiếu; nhưng nó là đúng loại sai lệch mà mô-đun này tồn tại
   để bắt.

2. **`no-helper-folder-in-components` không bắt được chỗ đặt nông nhất.** Biểu thức
   `/src/components/.*/(constants|utils|types|hooks)/` đòi ít nhất một đoạn đường dẫn giữa gốc cây
   thành phần và tên thư mục, nên `src/components/utils/format.ts` **im lặng** trong khi
   `src/components/blocks/x/Y/utils/format.ts` báo lỗi. Hành vi thật hẹp hơn hẳn cái tên gợi ra.

3. **Phần mô tả của `export-matches-folder` nói ngược với cách nó chạy.** Mô tả khẳng định "một
   thành phần và các biến thể có kiểu của nó có thể ở chung một thư mục, còn một hành khách không
   liên quan thì không". Cách kiểm tra thật là `[...names].some(belongsToFamily)`: chỉ cần **một**
   tên thuộc họ là toàn bộ file được thông qua, kể cả khi bên cạnh có ba export không liên quan.

4. **`export-matches-folder` im lặng với tập tên rỗng, và tập tên rỗng phổ biến hơn tưởng.**
   `export *`, `export default`, `export class`, `export enum`, `export type X = …` đều không góp
   tên nào. Trường hợp "file không export gì thì không có gì để mâu thuẫn" là có chủ ý và có kiểm thử
   song sinh; hệ quả rằng dạng barrel thông dụng nhất cũng rơi vào đó thì không được nêu ở đâu cả.

5. **`no-runtime-namespace` không có cổng đường dẫn, nên nó chạy trên cả file không phải thành
   phần.** `export const Status = { Draft: "draft", Live: "live" }` trong `modules/` bị báo lỗi. Phép
   thử "trông giống thành viên của một họ" chỉ là phép thử chữ hoa, và mã nguồn nói thẳng điều đó,
   nhưng hệ quả là một bản đồ dữ liệu với khoá viết hoa sẽ báo đỏ với một thông điệp nói về bundler.

6. **`no-runtime-namespace` bỏ lọt cách dựng họ có dấu chấm phổ biến nhất.** `Object.assign`, gán
   thuộc tính sau khai báo, khai-báo-rồi-export, `export default {}`, `satisfies`, khoá trong ngoặc
   kép, và một khoá viết thường — bảy cách viết, tất cả đều im lặng, tất cả đều tạo ra đúng cái object
   lúc chạy mà `FILE-4` cấm.

7. **Cổng miễn trừ của `route-tree-holds-routes-only` neo vào đầu chuỗi, không neo theo đoạn.**
   `app/_components/Card.tsx` được miễn; `app/dashboard/_components/Card.tsx` bị báo. Chú thích trong
   mã nguồn mô tả cổng này là "thư mục opt-out của khung nền", nhưng nó chỉ có tác dụng ở gốc cây, và
   nó miễn cả một **file** đơn lẻ bắt đầu bằng gạch dưới.

8. **`monorepo-tier-belongs-to-its-side` bất đối xứng một đoạn thư mục.** Phía ứng dụng có
   `(?:components\/)?`, phía gói thì không, nên `packages/ui/src/components/blocks/…` thoát trong khi
   `packages/ui/src/blocks/…` bị bắt.

9. **`surface-folder-two-files-only` từ chối đúng nhưng báo sai tên khi thư mục màn hình bị đặt
   nhóm.** Với `components/pages/dashboard/DashPage/component.tsx`, biểu thức đọc `dashboard` là tên
   màn và `DashPage/component.tsx` là phần thừa, nên thông điệp nói "`pages/dashboard/` chứa
   `DashPage/component.tsx`". Kết luận vẫn đúng — tầng page phải phẳng — nhưng lý do in ra không phải
   lý do thật.

10. **Hai dương tính giả hẹp ở `export-matches-folder`.** `export { Paragraph as default }` thu được
    tên `default` và bị báo là lệch họ; `export type { ParagraphProps } from "./component"` trong thư
    mục `Text` cũng bị báo, dù không có thành phần nào liên quan. Cả hai đều hiếm và cả hai đều sửa
    được bằng cách viết lại, nên không đề xuất nới luật.

11. **Cổng của `export-matches-folder` là "thư mục PascalCase bất kỳ", không phải "cây thành phần".**
    `src/hooks/Text/index.ts` cũng bị xét bằng đúng phép thử đó. Trong một cây theo đúng luật thì
    không có thư mục PascalCase nào ngoài cây thành phần, nên hiện tại vô hại; nó chỉ đáng ghi vì đó
    là một giả định chưa được viết ra.

## Quyết định

- Giữ nguyên sáu luật, sáu mã, ánh xạ một-đối-một. Không đặt thêm mã số cho luật lint: tên đã publish
  là chuỗi mà bản dựng in ra và là danh tính duy nhất.
- Ghi cả 34 cửa còn mở vào bảng `Open` của `INDEX.md`, mỗi cửa kèm cách viết cụ thể. Không rút gọn,
  không viết "không có" cho gọn bảng.
- Không đề xuất nới bất kỳ biểu thức đường dẫn nào trong lần này. Mã nguồn đã ghi lại bài học rằng
  một luật đường dẫn nới thêm một đoạn là bắt đầu báo trên cả một tầng cùng lúc; sửa một cửa lách
  bằng cách mở rộng mù là đổi một rủi ro đã biết lấy một rủi ro chưa biết.
- Coi mọi hành vi ở phần **Findings** là hành vi hiện tại của mã nguồn, không phải hành vi mong muốn.
  Sửa chúng là một thay đổi luật lint, đi qua kênh nâng cấp, không phải một lần chỉnh tại chỗ.
- Luật nào **đáng có** mà chưa có thì không được viết vào mô-đun này. Một luật không chỉ tay vào được
  là một đề xuất, không phải một luật.

## Rủi ro còn mở

Ba mươi tư cửa. Mỗi dòng nêu luật đang hở, cửa đó là gì, và **luật lint sẽ phải soi thêm cái gì** mới
đóng được — hoặc vì sao đóng nó đắt hơn để mở.

### `surface-folder-two-files-only` — 6 cửa

| Cửa | Đóng được bằng cách soi thêm cái gì |
|---|---|
| Gom nhiều thành phần vào `component.tsx` | Phải đọc AST và đếm số hàm trả về JSX được export, cộng một định nghĩa "thành phần" mà `FILE-2` chưa từng nêu. Đắt và dễ dương tính giả với thành phần con thuần trình bày; nên để mở và ghi lại |
| Thư mục chỉ có một nửa | Phải soi hệ thống tệp chứ không soi từng file — lint chạy theo file, nên đây là việc của một cổng cấu trúc riêng, không phải của một luật lint |
| Lớp phủ đặt phẳng | Thêm một biểu thức thứ ba cho `overlays/<Tên>/<phần còn lại>`. Rẻ và an toàn; đề xuất được. Chưa làm vì đó là thay đổi hành vi |
| File thứ ba trong block/composite/branch/leaf/shell | Phải mở rộng danh sách tầng, nhưng `FILE-2` **cố ý** chỉ nói về ba tầng. Đóng cửa này là sửa luật trước, sửa luật lint sau |
| `.json`, `.md`, `.css` cạnh hai nửa | Phải mở rộng glob của kho tiêu thụ, không phải sửa luật. Thuộc về cấu hình adoption |
| Thư mục màn hình ngoài `src/components/` | Phải bỏ tiền tố `components/`, và như thế biểu thức sẽ bắt cả `packages/ui/src/pages/`, chồng lấn với `monorepo-tier-belongs-to-its-side`. Cần quyết định luật trước |

### `route-tree-holds-routes-only` — 6 cửa

| Cửa | Đóng được bằng cách soi thêm cái gì |
|---|---|
| Cây định tuyến ở gốc kho, không `src/` | Nới biểu thức thành `(?:/src)?/app/`. Rẻ, nhưng sẽ khớp cả một thư mục tên `app/` bất kỳ ở đâu trong kho; cần neo vào gốc workspace |
| Route vẫn vẽ được | Không đóng được bằng đường dẫn. Cần một luật AST riêng đo "route trả về nhiều hơn một phần tử" hoặc "route gọi hook dữ liệu" — một luật khác, không phải luật này |
| Gạch dưới miễn cả một FILE ở gốc cây | Đổi cổng thành phép thử theo **đoạn**: bất kỳ đoạn nào bắt đầu bằng `_` thì miễn, và một file bắt đầu bằng `_` thì không. Rẻ, đúng ý khung nền hơn hiện tại |
| Gạch dưới ở tầng sâu **không** được miễn | Cùng một sửa đổi như trên, theo chiều ngược lại. Hai cửa này là một, và hiện đang lệch nhau |
| Đội tên một khe (`template.tsx`, `default.tsx`) | Không đóng được bằng tên. Cùng loại với "route vẫn vẽ được" |
| Đội tên kiểm thử | Đóng được bằng cách đòi tên kiểm thử phải nằm trong cây `tests/`, nhưng thế là bỏ thói quen kiểm thử song sinh mà mọi tầng khác đang theo. Đắt hơn để mở |

### `no-helper-folder-in-components` — 4 cửa

| Cửa | Đóng được bằng cách soi thêm cái gì |
|---|---|
| Thư mục tiện ích ngay dưới gốc cây thành phần | Đổi `.*\/` thành `(?:.*\/)?`. Một ký tự, đóng được cửa nghiêm trọng nhất của luật này. Đề xuất được ngay |
| `helpers/`, `lib/`, `shared/`, `util/`, `models/` | Mở rộng danh sách tên. Rẻ nhưng vô hạn: cái tên kế tiếp luôn có thể được nghĩ ra. Cách đóng thật là đảo ngược — chỉ cho phép một danh sách tầng đã biết dưới `components/` — và đó là một luật khác |
| Tiện ích viết thành FILE thay vì thư mục | Cần một luật cấm file không phải `component`/`index`/kiểm thử ở **mọi** tầng thành phần, tức là mở rộng `FILE-2` sang mọi tầng. Sửa luật trước |
| `.json` trong `constants/` | Cấu hình adoption, không phải luật |

### `export-matches-folder` — 6 cửa

| Cửa | Đóng được bằng cách soi thêm cái gì |
|---|---|
| `export * from "./component"` | Phải đi theo import sang file kia, tức là cần thông tin liên-file mà một luật lint thường không có. Cách rẻ hơn: **cấm** `export *` trong `index.tsx` bằng một luật riêng, rồi luật này lại có tên để đọc |
| `export default` | Cùng cách: cấm `export default` ở tầng thành phần bằng một luật riêng. Rẻ, và hợp với `FILE-1` vốn đòi tên |
| `export class` / `export enum` | Thu thêm `ClassDeclaration` và `TSEnumDeclaration` vào tập tên. Rẻ, an toàn, đề xuất được |
| Một export đúng họ gánh cả hành khách | Đổi `some` thành `every`, nhưng thế thì `TextProps` hay một hằng nội bộ cũng đỏ. Cần một định nghĩa "export nào phải thuộc họ" mà `FILE-1` chưa nêu. Để mở cho tới khi luật nói rõ |
| Thư mục không PascalCase, `component.tsx`, `.jsx` | Đây là cổng chọn file, và nới nó ra là luật bắt đầu chạy trên cả cây không phải thành phần. Đóng bằng cách neo vào tầng đã biết chứ không neo vào kiểu chữ |
| `export type Foo = …` | Thu thêm `TSTypeAliasDeclaration`/`TSInterfaceDeclaration`. Rẻ, nhưng sẽ kéo theo dương tính giả với các kiểu phụ; cân nhắc cùng cửa "hành khách" |

### `no-runtime-namespace` — 8 cửa, cộng một dòng theo chiều ngược lại

| Cửa | Đóng được bằng cách soi thêm cái gì |
|---|---|
| `Object.assign(Root, { … })` | Nhận thêm `CallExpression` có callee là `Object.assign` và đối số thứ hai là object literal. Rẻ, đóng được cửa nghiêm trọng nhất của luật này |
| `Card.Header = CardHeader` | Cần theo dõi gán thuộc tính lên một binding đã export — phân tích luồng trong một file. Trung bình về chi phí, làm được |
| Khai báo rồi `export { Card }` | Cần tra ngược binding trong scope khi gặp specifier. Rẻ, làm được |
| `export default { … }` | Nhận thêm `ExportDefaultDeclaration`. Rẻ |
| Một khoá viết thường tắt cả luật | Đổi `every` thành một ngưỡng tỉ lệ, hoặc bỏ qua các khoá siêu dữ liệu đã biết (`displayName`). Cần một quyết định luật về việc thế nào là "một họ" |
| `satisfies` | Bóc thêm `TSSatisfiesExpression` bên cạnh `TSAsExpression`. Một dòng |
| Khoá trong ngoặc kép | Nhận thêm khoá `Literal` dạng chuỗi. Một dòng |
| Tên biến viết thường | Đây là phép thử "trông giống một họ", và bỏ nó đi thì mọi object hằng trong kho đều thành ứng viên. Nên để mở |
| *(và chiều ngược lại)* Dương tính giả trên bản đồ dữ liệu | Đóng bằng một cổng đường dẫn giới hạn luật vào cây thành phần. Rẻ, nhưng khi đó một namespace viết ngoài cây thành phần sẽ thoát. Đánh đổi cần quyết định |

### `monorepo-tier-belongs-to-its-side` — 4 cửa

| Cửa | Đóng được bằng cách soi thêm cái gì |
|---|---|
| `packages/<tên>/src/components/<tầng>/` | Thêm `(?:components\/)?` vào biểu thức phía gói, đúng như phía ứng dụng đã có. Một đoạn, đối xứng lại hai vế. Đề xuất được ngay |
| Workspace tên `libs/`, `services/`, `modules/` | Phải đọc `workspaces` trong manifest của kho thay vì đoán theo tên thư mục — tức là cần I/O ngoài file đang lint. Đắt; cách rẻ hơn là để kho tiêu thụ khai báo qua option, mà luật hiện có `schema: []` |
| Thành phần biết nghiệp vụ nằm trong `packages/ui/src/leaves/` | Không đóng được bằng đường dẫn, và có lẽ không đóng được bằng máy: "biết một nghiệp vụ" là một phán đoán về ý nghĩa. Đây là phần mà `FILE-5` vẫn phải do người giữ, và cần được nói ra thay vì để người đọc tưởng luật đã kín |
| Từ vựng dùng chung nằm trong tầng nghiệp vụ của một ứng dụng | Cùng loại với dòng trên, chiều ngược lại |

## Khi nào cần kiểm lại

- Mã nguồn thêm, bớt hoặc đổi tên một luật lint — kể cả khi hành vi không đổi, vì tên là danh tính.
- Một cửa trong bảng `Open` được đóng, hoặc một cửa mới được tìm ra.
- Một mã `LAYOUT-<n>` mới được thêm vào tài liệu luật mà chưa có luật lint nào giữ.
- Một kho tiêu thụ hạ mức nghiêm trọng của bất kỳ luật nào xuống dưới `error` ngoài trường hợp
  `export-matches-folder` đang di trú.
- Có người báo cáo một lỗi bằng một mã số tự đặt thay vì tên luật đã publish.
- Có một dương tính giả được sửa bằng cách viết comment tắt luật thay vì sửa cấu trúc — comment tắt
  luật là một dữ kiện cần đọc, không phải một cách đóng hồ sơ.
- Bố cục kho đổi: cây định tuyến chuyển ra gốc, hoặc kho một ứng dụng tách thành workspace. Bốn trong
  sáu luật đổi phạm vi ngay lập tức.
