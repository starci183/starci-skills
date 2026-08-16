---
id: fe-lints-file-layout-vi
title: vi.md
slug: /fe/lints/file-layout/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng luật lint của file-layout — bắt gì, giữ mã nào, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `file-layout`

# Sáu luật lint giữ file-layout

Tài liệu luật nói **nên đặt file ở đâu**. Tài liệu này nói **máy nhìn thấy được gì** — và, phần
quan trọng hơn, **máy không nhìn thấy được gì**.

Năm trên sáu luật ở đây chỉ đọc **đường dẫn**, không đọc nội dung file. Một luật còn lại chỉ đọc
**danh sách export**, không đọc đường dẫn. Đó là lý do chúng rẻ và chính xác, và cũng là toàn bộ cái
giá phải trả: một luật đọc đường dẫn phân biệt được thư mục với thư mục, chứ không phân biệt được
một thành phần với một hàm tiện ích, một route đang vẽ với một route đang gắn, hay một câu nghiệp vụ
với một hình dạng thuần.

**Một luật không có máy giữ thì ai cũng biết là chưa được giữ. Một luật có máy giữ nhưng hở thì mọi
người tin là đã kín.** Cái thứ hai đắt hơn nhiều. Vì vậy mỗi mục dưới đây đều kết thúc bằng phần
**Cửa còn mở**, và không mục nào được phép ghi "không có".

## Bảng tra nhanh

| Luật lint | Mã luật | Bắt gì |
|---|---|---|
| `surface-folder-two-files-only` | `LAYOUT-2` | Một file thứ ba nằm trong thư mục của một màn hình, một khung hoặc một lớp phủ |
| `route-tree-holds-routes-only` | `LAYOUT-6` | Một file trong cây định tuyến mà tên của nó không phải một khe của khung nền |
| `no-helper-folder-in-components` | `LAYOUT-3` | Thư mục `constants/`, `utils/`, `types/`, `hooks/` nằm lồng trong cây thành phần |
| `export-matches-folder` | `LAYOUT-1` | `index.tsx` trong thư mục PascalCase mà không export tên nào thuộc họ của thư mục |
| `no-runtime-namespace` | `LAYOUT-4` | Một object literal viết hoa gom từ hai thành viên viết hoa trở lên |
| `monorepo-tier-belongs-to-its-side` | `LAYOUT-5` | Tầng biết nghiệp vụ nằm trong gói dùng chung, hoặc tầng không biết nghiệp vụ nằm trong một ứng dụng |

Sáu luật, sáu mã, ánh xạ một-đối-một. Không mã nào thiếu máy giữ, không luật lint nào không neo vào
một mã.

---

## `surface-folder-two-files-only`

**Bắt gì.** Một thư mục màn hình chỉ được chứa hai nửa của chính nó — `component.tsx` là hình dạng,
`index.tsx` là phần nối dây — cộng với file kiểm thử song sinh của mỗi nửa. Thứ ba xuất hiện ở đó là
tín hiệu rằng có một thứ dùng lại được vừa được phát minh ở chỗ không ai tìm thấy.

**Giữ mã nào.** `LAYOUT-2`.

**Cách phát hiện.** Đọc `context.filename`, đổi dấu gạch chéo ngược thành gạch chéo xuôi, rồi so với
hai biểu thức: `/src/components/(pages|layouts)/<Tên>/<phần còn lại>` và
`/src/components/overlays/<nhóm>/<Tên>/<phần còn lại>`. Nếu khớp, phần còn lại được so với
`^(component|index)(\.test)?\.tsx?$`. Không khớp thì báo lỗi một lần trên nút `Program`.

**Vì sao luật này đáng có máy giữ.** Câu mở đầu luôn vô hại: "chỉ mỗi màn này dùng thôi". Câu đó mô
tả đồ thị lời gọi của hôm nay, không mô tả bản chất của cái file. Kết cục thì đã biết trước: một thư
mục màn hình ôm bốn thành phần, một thư mục hằng số, một thư mục tiện ích và ba hình dạng chờ được
chép tay — tới lúc đó màn hình đã thành một cơ sở mã thứ hai với từ vựng riêng mà không ai dùng lại
được. Đây là loại sai không bao giờ vỡ ở lần commit đầu, nên không có máy đếm file thì nó chỉ bị bắt
khi đã quá muộn.

**Cửa còn mở.**

- **Chuyển thành phần thứ ba vào thẳng `component.tsx`.** Luật đếm **file**, không đếm thành phần.
  Ba thành phần trong một file vẫn là một file.
- **Thiếu một nửa thì không ai thấy.** Thư mục chỉ có `index.tsx` và vẽ luôn trong đó thì hợp lệ. Một
  luật đọc đường dẫn nhìn thấy file đang tồn tại, không bao giờ nhìn thấy file đang thiếu.
- **Lớp phủ đặt phẳng thì thoát sạch.** Biểu thức cho lớp phủ đòi một tầng nhóm giữa tên tầng và tên
  màn. Bỏ tầng nhóm đi là biểu thức hết khớp, và cả thư mục ra ngoài vùng phủ.
- **Chỉ ba tầng bị canh.** File thứ ba trong một thư mục block, composite, branch, leaf hay shell
  không bị luật này đụng tới.
- **File không được lint thì không tồn tại.** `constants.json`, `copy.md`, `styles.css` nằm cạnh hai
  nửa vẫn im lặng, vì trình chạy chỉ ghé những phần mở rộng mà cấu hình giao cho nó.
- **Ngoài `src/components/` là ngoài tầm.** Một cây đặt màn hình thẳng dưới `src/` không khớp tiền
  tố nào.

---

## `route-tree-holds-routes-only`

**Bắt gì.** Một file nằm dưới cây định tuyến mà tên của nó không phải một khe do khung nền định
nghĩa. File đó là một thành phần, và một thành phần thuộc về tầng gom nó với anh em của nó.

**Giữ mã nào.** `LAYOUT-6`.

**Cách phát hiện.** Đọc `context.filename`, khớp `/src/app/<phần còn lại>`. Ba cổng miễn trừ chạy
theo đúng thứ tự: phần còn lại bắt đầu bằng `api/` hoặc `_`; tên file kết thúc bằng
`.test.tsx`/`.test.ts`/`.test.jsx`/`.test.js`; tên file nằm trong danh sách khe của khung nền. Qua cả
ba cổng mà vẫn còn thì báo lỗi một lần trên `Program`.

**Vì sao luật này đáng có máy giữ.** Vì đã có một lần trả giá và lần đó được ghi lại trong chính mã
nguồn: một file chủ của màn hình được viết vào cây định tuyến, đi qua một lần build, một lần lint,
một lần kiểm kiểu, bốn ảnh chụp niêm phong và một lần phê duyệt, rồi dừng ngay trước một lần ghi vào
môi trường thật — **với mọi cổng đều xanh**, bởi vì mọi cổng đều đang đọc luật lint, còn điều này thì
mới chỉ là văn xuôi.

**Cửa còn mở.**

- **Cây định tuyến đặt ở gốc kho, không có `src/`.** Biểu thức đòi `/src/app/`. Bố cục không có
  `src/` là bố cục phổ biến hơn ngoài đời, và luật này không tồn tại ở đó.
- **File route vẫn vẽ được thoải mái.** Luật đọc **tên**, và "đang vẽ" không phải một tính chất mà
  tên file mang được. Chính mã nguồn nói thẳng ra điều này.
- **Gạch dưới trên một FILE ở ngay gốc cây.** `app/_FleetPage.tsx` được miễn, vì cổng miễn trừ so với
  cả phần còn lại của đường dẫn chứ không so theo từng đoạn.
- **Và tấm gương lật ngược của nó.** `app/dashboard/_components/Card.tsx` **bị** báo lỗi trong khi
  `app/_components/Card.tsx` thì không. Cùng một quy ước thư mục riêng, hai phán quyết khác nhau, chỉ
  vì nó nằm sâu hơn một tầng.
- **Đặt tên theo một khe là đi qua được.** Một màn hình đầy đủ viết trong `template.tsx` hay
  `default.tsx` được nhận vào mà không ai xem bên trong.
- **Đội lốt file kiểm thử.** Bất cứ tên nào kết thúc bằng `.test.tsx` đều được miễn trước khi danh
  sách khe được hỏi tới.

---

## `no-helper-folder-in-components`

**Bắt gì.** Thư mục `constants/`, `utils/`, `types/` hoặc `hooks/` nằm bên trong cây thành phần. Đó
không phải mã dựng hình, nên thư mục đang gắn nhãn sai và nội dung bên trong thì vô hình.

**Giữ mã nào.** `LAYOUT-3`.

**Cách phát hiện.** Một biểu thức duy nhất trên đường dẫn:
`/src/components/.*/(constants|utils|types|hooks)/`. Dấu gạch chéo cuối biến nó thành phép thử
**thư mục**; đoạn `.*/` phía trước bắt buộc phải có **ít nhất một đoạn đường dẫn** nằm giữa gốc cây
thành phần và tên thư mục tiện ích.

**Vì sao luật này đáng có máy giữ.** Vì cái giá không nằm ở chỗ lộn xộn mà ở chỗ **vô hình**. Hàm
định dạng nằm cạnh thành phần thì người thứ hai cần đúng hàm đó sẽ không bao giờ tìm ra, nên họ viết
lại, rồi hai bản trôi khỏi nhau và không có gì báo động. Một quy ước như thế không tự sửa được bằng
đọc code review, vì mỗi lần thêm chỉ là một thư mục nhỏ và luôn có lý do.

**Cửa còn mở.**

- **Thư mục tiện ích đặt thẳng dưới gốc cây thành phần thì thoát.** `src/components/utils/format.ts`
  **không** khớp, vì biểu thức đòi ít nhất một đoạn ở giữa. Chỗ đặt nông nhất và hiển nhiên nhất lại
  đúng là chỗ luật không nhìn thấy.
- **Bốn cái tên là một danh sách đóng.** `helpers/`, `lib/`, `shared/`, `util/`, `const/`, `models/`,
  `data/` — tất cả đều đi qua.
- **Cấm thư mục không phải là cấm file.** `blocks/<nhóm>/<Tên>/utils.ts` là một file, nên luật này
  không thấy; và tầng block nằm ngoài tầm luật thư mục màn hình, nên nó thoát cả hai cùng lúc.
- **Phần mở rộng không được lint thì không tới được luật nào.** `constants/tone.json` là một ví dụ.

---

## `export-matches-folder`

**Bắt gì.** `index.tsx` trong một thư mục PascalCase phải có ít nhất một export tên trực tiếp thuộc
họ của thư mục — đúng tên thư mục, hoặc tên thư mục cộng thêm một hậu tố bắt đầu bằng chữ hoa.

**Giữ mã nào.** `LAYOUT-1`.

**Cách phát hiện.** Cổng đường dẫn `/<ThưMụcPascalCase>/index.tsx?$` chọn file. Sau đó là AST: mỗi
`ExportNamedDeclaration` góp tên từ khai báo biến, từ khai báo hàm, và từ mọi specifier. Tới
`Program:exit`, nếu tập tên **rỗng** thì im lặng; nếu không rỗng mà không tên nào thuộc họ thì báo
lỗi kèm danh sách tên đã thu được.

**Vì sao luật này đáng có máy giữ.** Vì đường dẫn có nhiệm vụ **đoán trước cái tên**. Ai biết tên thì
biết đường dẫn, và một lần tìm theo tên phải ra đúng một chỗ. Khi hai thứ đó lệch nhau, chi phí không
rơi vào người viết mà rơi vào mọi người đọc sau đó, mỗi lần một ít, mãi mãi.

**Cửa còn mở.**

- **`export * from "./component"` — chính là dạng barrel thông dụng nhất — không góp tên nào**, nên
  tập tên rỗng và luật thoát ra trước khi phán xét bất cứ điều gì.
- **`export default` cũng vậy.** Một nút khác loại, cùng một kết cục im lặng.
- **`export class` và `export enum` cũng vậy.** Chỉ khai báo biến và khai báo hàm được thu.
- **Một export đúng họ là gánh được cả file.** Chỉ cần **một** tên thuộc họ là mọi hành khách không
  liên quan đi cùng đều lọt. Phần mô tả của chính luật nói ngược lại điều này.
- **Đổi tên là gỡ luật.** Thư mục không PascalCase, nửa không tên `index`, hoặc phần mở rộng `.jsx` —
  ba cách đều làm luật ngừng tồn tại cho file đó.
- **`export type Foo = …` không góp tên**, nên một họ kiểu đặt lệch tên vẫn đi qua.

---

## `no-runtime-namespace`

**Bắt gì.** Một object literal gán cho một tên viết hoa, gom từ hai thành viên viết hoa trở lên. Nó
đóng gói thành một khối duy nhất, nên một chỗ gọi chỉ cần một thành viên là kéo theo cả họ và không
thứ gì rụng ra khỏi bản dựng được.

**Giữ mã nào.** `LAYOUT-4`.

**Cách phát hiện.** Thuần AST, **không có cổng đường dẫn**. Với mỗi `ExportNamedDeclaration` là khai
báo biến: tên phải bắt đầu bằng chữ hoa; phần khởi tạo, sau khi bóc lớp `as`, phải là một
`ObjectExpression`; thành viên là những khoá `Property` không tính toán và có dạng `Identifier`. Báo
lỗi khi có từ hai thành viên trở lên và **mọi** thành viên đều bắt đầu bằng chữ hoa.

**Vì sao luật này đáng có máy giữ.** Vì chi phí là chi phí **bản dựng**, mà bản dựng thì không ai
nhìn thấy khi đọc code. Cú pháp gọi có dấu chấm đọc rất dễ chịu, và chính vì dễ chịu nên nó lan.
Không có máy đếm, không ai phát hiện ra rằng một trang nhập một thành viên đang phải tải cả họ.

**Cửa còn mở.**

- **`Object.assign(CardRoot, { Header, Footer })` — cách dựng họ có dấu chấm phổ biến nhất — thoát
  hoàn toàn**, vì phần khởi tạo là một lời gọi chứ không phải object literal.
- **Gán thuộc tính sau khai báo** (`Card.Header = CardHeader`) cũng thoát: object được lắp ráp bên
  ngoài cái nút mà luật đang canh.
- **Khai báo trước, export sau.** `const Card = { … }` rồi `export { Card }` thì nút export mang
  specifier chứ không mang khai báo, và luật chỉ đi xuống khai báo.
- **`export default { Root, Header }`** là một nút khác loại.
- **Một thành viên viết thường là tắt luật.** Thêm `displayName: "Card"` vào object là điều kiện "mọi
  thành viên đều viết hoa" hỏng, và cả khai báo bị bỏ qua.
- **`satisfies` không được bóc**, chỉ `as` được bóc.
- **Khoá đặt trong ngoặc kép** không phải `Identifier`, nên cả hai thành viên bị loại và số đếm tụt
  xuống dưới ngưỡng.
- **Tên biến viết thường** (`export const card = { Root, Header }`) không qua cổng đầu tiên.

---

## `monorepo-tier-belongs-to-its-side`

**Bắt gì.** Trong một workspace nhiều ứng dụng, gói dùng chung giữ những tầng **không biết nghiệp
vụ**; những tầng **biết nghiệp vụ** thuộc về ứng dụng sở hữu nghiệp vụ đó. Luật báo hai chiều: tầng
nghiệp vụ nằm trong gói, và tầng từ vựng nằm trong ứng dụng.

**Giữ mã nào.** `LAYOUT-5`.

**Cách phát hiện.** Hai biểu thức đường dẫn:
`/packages/<tên>/src/(blocks|overlays|pages|layouts)/` và
`/apps/<tên>/src/(components/)?(contracts|leaves|composites|branches|shells)/`. Phép thử phía gói
chạy trước và thoát ngay; phía ứng dụng chạy sau.

**Vì sao luật này đáng có máy giữ.** Vì đây là trường hợp mà **tài liệu đã đúng và cây thư mục đã
sai, và không bên nào đỏ lên cả**. Một gói dùng chung mang trong nó đúng một thư mục nghiệp vụ, trong
khi phần đầu của chính tài liệu đó khẳng định rằng tầng ấy thuộc về ứng dụng. Một đoạn văn không giữ
được một cây thư mục; đó là toàn bộ lập luận cho việc viết luật này thành mã.

**Cửa còn mở.**

- **Bất đối xứng một đoạn.** Phía ứng dụng chấp nhận đoạn `components/` tuỳ chọn, phía gói thì không.
  `packages/ui/src/components/blocks/…` là cùng một vi phạm, viết thừa một thư mục, và không ai thấy.
- **Chỉ hai cái tên thư mục workspace được biết tới.** Một kho đặt tên `libs/`, `services/` hay
  `modules/` thì luật không tồn tại.
- **Một thành phần biết nghiệp vụ đặt trong `packages/ui/src/leaves/<Tên>/` là hợp lệ theo đường
  dẫn.** Đây đúng là thất bại mà luật mô tả. Luật lint giữ **vị trí của tầng**, không bao giờ giữ
  việc file bên trong có biết một nghiệp vụ hay không.
- **Chiều ngược lại cũng vậy.** Một hình dạng dùng chung viết vào `apps/web/src/components/blocks/`
  đang nằm trong một thư mục hợp lệ, nên không có gì nhìn tới nó.

---

## Luật

1. **Tên đã publish là danh tính duy nhất của một luật lint.** Đó là chuỗi mà bản dựng in ra, mà một
   comment tắt luật gọi tên, và mà mọi cuộc trao đổi về lỗi đó dùng tới. Không đặt thêm mã số thứ
   hai.
2. Một luật lint giữ đúng một mã luật, và một mã luật được giữ bởi đúng một luật lint.
3. Một luật đọc đường dẫn thì chỉ đọc đường dẫn. Không được mô tả nó như thể nó đọc nội dung file.
4. Năm luật đọc đường dẫn báo lỗi **một lần cho mỗi file**, trên nút `Program`. Một file hoặc thuộc
   phạm vi hoặc không; không có phán quyết nửa vời.
5. Mức nghiêm trọng thuộc về cấu hình của kho tiêu thụ. Gói luật chỉ publish một ý kiến.
6. Một luật lint chỉ được từ chối những gì máy nhìn thấy. Phần còn lại thuộc về tài liệu luật, và
   khoảng cách giữa hai bên phải được ghi vào phần **Cửa còn mở**, không được im lặng cho gọn.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và gọi tên
luật lint mà nó áp vào.

- **`export-matches-folder` là `suggestion`, không phải `problem`.** Đây là luật duy nhất mà mã nguồn
  khuyên bật ở mức cảnh báo trước trong một cây đã có sẵn: nó báo trên **mọi** thư mục có quy ước ra
  đời trước nó, và con số đó là một cuộc di trú chứ không phải một đống lỗi.
- **File kiểm thử nằm cạnh file route được miễn.** Một file kiểm thử không đi vào bản dựng nào và
  không route nào dựng nó, nên nó không thể trở thành màn hình thứ hai mà luật này sinh ra để chặn.
  Tên của nó **cố ý** không bị bắt phải trùng với tên khe, vì kiểm thử của một route chia theo **mối
  quan tâm**.
- **Mã máy chủ và thư mục riêng của khung nền được miễn khỏi luật định tuyến** — nhưng chỉ ở ngay gốc
  cây. Độ hẹp của chữ "chỉ" đó là một cửa còn mở, đã ghi ở trên.
- **Kho một ứng dụng nằm ngoài phạm vi luật monorepo.** Nới biểu thức thêm một đoạn là nó bắt đầu báo
  trên mọi block của mọi kho một ứng dụng.
- **Block, composite, branch, leaf và shell nằm ngoài phạm vi luật thư mục màn hình.** Những tầng đó
  được phép giữ nhiều hơn hai file.
