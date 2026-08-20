---
title: File-layout · Vietnamese
---

# Bố cục file

## LOADS

None.


## Bản ghi

Gate này nhận mã đã viết xong — một file, một hunk trong diff. Kết quả là một **phán quyết**: file có
thuộc phạm vi hay không, luật lint nào đã nổ, nó báo gì và trên nút nào, mã luật tương ứng là mã nào,
và cách viết lại nào sẽ dập tắt đúng lỗi đó. Mô-đun này không chọn bố cục nào cả. Nó từ chối một bố
cục, và nó phải chỉ được vào đúng đoạn đường dẫn hay đúng cái export mà nó từ chối.

## Luật

Chỗ một file nằm là một lời khẳng định về việc file đó là cái gì. Tài liệu luật phát biểu điều này
mang chín mã, `FILE-1` tới `FILE-9`.

Luật phát biểu chín mã. **Cả chín đều có máy giữ.** Mỗi luật lint giữ đúng một mã, và mỗi mã được giữ
bởi đúng một luật lint — không mã nào thiếu máy giữ, không luật lint nào không neo vào một mã. Ánh xạ
một-đối-một ấy là tin tốt, và cũng là toàn bộ cái bẫy: sáu luật chỉ đọc **đường dẫn**, hai luật đọc
đường dẫn rồi đọc thêm marker hoặc danh sách export, còn một luật chỉ đọc **danh sách export**. Đó là
lý do chúng rẻ và chính xác, và cũng là cái giá phải trả. Một luật đọc đường dẫn phân biệt được thư
mục với thư mục, chứ không phân biệt được một thành phần với một hàm tiện ích, một route đang vẽ với
một route đang gắn, hay một câu nghiệp vụ với một hình dạng thuần. Nên một lần chạy xanh ở đây chỉ có
nghĩa là các chuỗi đường dẫn và vài nút được đọc chấp nhận được, không bao giờ có nghĩa là cây thư mục
đúng.

Một luật không có máy giữ thì ai cũng biết là chưa được giữ; một luật có máy giữ nhưng hở thì mọi
người tin là đã kín, và cái thứ hai đắt hơn nhiều. Vì vậy mọi cửa còn mở bên dưới đều được ghi lại
nguyên độ mạnh của nó.

## Luật máy đã xuất bản

| Luật lint | Mã | Nó báo gì |
|---|---|---|
| `surface-folder-two-files-only` | `FILE-2` | `extra` — gọi tên tầng, tên thư mục màn hình và phần đường dẫn còn lại, rồi gọi tên đích đến của từng loại file lạc |
| `route-tree-holds-routes-only` | `FILE-6` | `stray` — gọi tên đường dẫn dưới cây định tuyến và cái basename không phải khe của khung nền, rồi đẩy một màn hình về tầng page và một câu nghiệp vụ về tầng block |
| `no-helper-folder-in-components` | `FILE-3` | `helper` — gọi tên loại thư mục nào trong bốn loại đã bị tìm thấy, rồi gọi tên cái cây mà thư mục đó thuộc về |
| `export-matches-folder` | `FILE-1` | `mismatch` — gọi tên thư mục, liệt kê mọi export tên trực tiếp đã thu được, và đòi đúng tên thư mục hoặc một thành viên mang tiền tố đó |
| `no-runtime-namespace` | `FILE-4` | `namespace` — gọi tên binding và liệt kê các thành viên, rồi nêu cái giá phải trả ở bản dựng |
| `monorepo-tier-belongs-to-its-side` | `FILE-5` | `featureInPackage` khi một tầng nghiệp vụ nằm trong gói dùng chung, `vocabularyInApp` khi một tầng hình dạng nằm bên trong một ứng dụng; mỗi bên đều gọi tên tầng và đích đến |
| `source-tier-marker-matches-folder` | `FILE-7` | `mismatch` — gọi tên tầng và giá trị `meta.shape` đã khai báo, rồi đòi chủ sở hữu trong đường dẫn và marker nguồn phải đồng nhất |
| `no-shell-tier` | `FILE-8` | `shell` — gọi tên đường dẫn `shells/` không có kiểu và đẩy chủ sở hữu về một branch có tên cùng nội dung contract có kiểu |
| `unit-test-colocated` | `FILE-9` | `suffix` cho unit `.test.` và `bucket` cho cây unit/E2E frontend tách riêng; đẩy spec về cạnh owner |

**Không mã nào bị bỏ lại không có luật máy.** `FILE-1` tới `FILE-9` đều có đúng một máy giữ, nên ở
đây không có gì để tuyên bố là chưa được giữ. Cái phải tuyên bố là **tầm với** của những cái máy đó:
sáu cái chỉ đọc đường dẫn, hai cái đọc nguồn sau cổng đường dẫn, một cái đọc nguồn không có cổng,
và phần Lối thoát hợp lệ bên dưới là danh sách trung thực của những gì lọt qua.

Phần header trong chính mã nguồn nói là "bốn luật". Nó xuất bản chín. Header đã cũ; bảng export mới là
sự thật.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là file
   đã qua — nghĩa là biểu thức không bao giờ khớp và luật không hề phán xét gì. `silent` và
   `out of scope` là hai câu trả lời khác nhau, và ghi cái thứ hai thành cái thứ nhất chính là cách
   một luật hở dần được tin là kín.
2. **Kiểm tra các cổng miễn trừ theo đúng thứ tự đã publish.** Với luật định tuyến: phần đường dẫn còn
   lại bắt đầu bằng `api/` hoặc `_`, rồi basename khớp `\.spec\.(tsx?|jsx?)$`, rồi basename nằm trong
   danh sách khe của khung nền. Cái gì bị cổng trước bắt thì không bao giờ được đưa tới cổng sau.
3. **Chỉ đọc nút AST cho ba luật đọc nguồn.** `export-matches-folder` đọc danh sách export sau cổng tên
   file; `source-tier-marker-matches-folder` đọc object `meta` được export sau cổng tầng; và
   `no-runtime-namespace` đọc các declarator mà không có cổng đường dẫn nào. Sáu luật còn lại chỉ nhận
   một chuỗi và không nhận gì khác.
4. **Phát một khối cho mỗi phát hiện.** Sáu luật chỉ-đọc-đường-dẫn báo một lần cho mỗi file, trên nút
   `Program`; `export-matches-folder` báo ở `Program:exit`, `source-tier-marker-matches-folder` báo
   trên literal `shape` lệch, còn `no-runtime-namespace` báo trên identifier của binding.
5. **Viết dòng `hatch` mỗi khi một cửa còn mở đủ sức dập tắt đúng lỗi đó**, gọi tên chính xác cách viết
   lại ấy.
6. **Không báo cái mà không luật nào canh.** Không luật nào ở đây phán xét việc một file route có đang
   vẽ hay không, một leaf trong gói dùng chung có biết nghiệp vụ hay không, hay một phần mở rộng không
   được lint có tồn tại hay không; một phán quyết nói ngược lại là hiểu sai mô-đun này.

## `surface-folder-two-files-only` — FILE-2

**Nó báo cái gì.** `extra` — gọi tên tầng, tên thư mục màn hình và phần đường dẫn còn lại, rồi gọi tên
đích đến của từng loại file lạc. Một lần cho mỗi file, trên `Program`.

**Nó phát hiện bằng gì.** `context.filename`, đổi dấu gạch chéo ngược thành gạch chéo xuôi, so với
`/src/components/(pages|layouts)/<Name>/<rest>` hoặc
`/src/components/overlays/<category>/<Name>/<rest>`; rồi `<rest>` được so với
`^(component|index)(\.spec)?\.tsx?$`.

**Điểm mù.** Chuyển thành phần thứ ba vào thẳng `component.tsx` rồi export từ đó — luật đếm
**file**, và ba thành phần trong một file vẫn là một file. Một thư mục màn hình chỉ có `index.tsx` và
vẽ luôn bên trong: luật đọc đường dẫn nhìn thấy file đang tồn tại, không bao giờ nhìn thấy file đang
thiếu. Lớp phủ đặt phẳng, `components/overlays/<Name>/extra.tsx`, vì biểu thức cho lớp phủ đòi một
tầng nhóm giữa tên tầng và tên màn; bỏ tầng nhóm đi là cả thư mục ra ngoài vùng phủ. File thứ ba trong
thư mục block, composite, branch, leaf hay shell — chỉ `pages`, `layouts` và `overlays` là tầng màn
hình. `constants.json`, `copy.md`, `styles.css` nằm cạnh hai nửa, vì trình chạy chỉ ghé những phần mở
rộng mà cấu hình giao cho nó. Và một thư mục màn hình nằm ngoài `components/` — một gói dùng chung
đặt page thẳng dưới `src/` thiếu đúng đoạn `components/` mà biểu thức đòi.

**Ranh giới.** Luật này đếm cái nằm cạnh hai nửa, trong ba tầng. Việc một thư mục tiện ích có hợp lệ ở
bất cứ đâu trong cây thành phần hay không là `FILE-3`; việc bản thân cái tầng có nằm đúng phía của
workspace hay không là `FILE-5`.

## `route-tree-holds-routes-only` — FILE-6

**Nó báo cái gì.** `stray` — gọi tên đường dẫn dưới cây định tuyến và cái basename không phải khe của
khung nền, rồi đẩy một màn hình về tầng page và một câu nghiệp vụ về tầng block. Một lần cho mỗi file,
trên `Program`.

**Nó phát hiện bằng gì.** `context.filename` khớp `/src/app/<rest>`; ba cổng chạy theo đúng thứ tự —
`<rest>` bắt đầu bằng `api/` hoặc `_`, rồi basename khớp `\.spec\.(tsx?|jsx?)$`, rồi basename nằm
trong danh sách khe của khung nền.

**Điểm mù.** Cây định tuyến đặt ở gốc kho, không có `src/`: biểu thức là `/src/app/`, một
`app/` ở gốc không bao giờ khớp, và đó lại là bố cục phổ biến hơn ngoài đời. Một file route vẫn fetch
và sắp xếp thoải mái ngay trong `page.tsx` — luật đọc **tên**, và "đang vẽ" không phải một tính chất
mà tên file mang được; chính mã nguồn nói thẳng điều đó. Gạch dưới trên một FILE ở ngay gốc cây,
`app/FleetPageBase.tsx`, vì cổng miễn trừ so với cả phần đường dẫn còn lại chứ không so theo từng đoạn.
Và tấm gương lật ngược của nó: `app/dashboard/_components/Card.tsx` **bị** báo trong khi
`app/_components/Card.tsx` thì không — cùng một quy ước, hai phán quyết ngược nhau, thư mục riêng chỉ
được miễn ở ngay gốc cây, đúng chỗ ít ai viết nó nhất. Một thành phần đặt tên theo một khe — một màn
hình đầy đủ viết trong `template.tsx` hay `default.tsx` — được nhận vào mà không ai xem bên trong, vì
danh sách khe là một allow-list. Một thành phần đội lốt file kiểm thử, `Hero.spec.tsx`, được miễn
trước khi danh sách khe được hỏi tới.

**Ranh giới.** Luật này phán xét một basename dưới một cây định tuyến. File chứa gì, và cái thành phần
nó đang giấu lẽ ra nên nằm ở đâu, là chuyện của tài liệu luật, không phải của cái máy này.

## `no-helper-folder-in-components` — FILE-3

**Nó báo cái gì.** `helper` — gọi tên loại thư mục nào trong bốn loại đã bị tìm thấy, rồi gọi tên cái
cây mà thư mục đó thuộc về. Một lần cho mỗi file, trên `Program`.

**Nó phát hiện bằng gì.** `context.filename` khớp
`/src/components/.*/(constants|utils|types|hooks)/`. Dấu gạch chéo cuối biến nó thành phép thử **thư
mục**; đoạn `.*/` phía trước bắt buộc phải có ít nhất một đoạn đường dẫn nằm giữa gốc cây thành phần
và tên thư mục tiện ích.

**Điểm mù.** Thư mục tiện ích đặt thẳng dưới gốc cây thành phần —
`components/utils/format.ts` — vì biểu thức đòi ít nhất một đoạn ở giữa, nên chỗ đặt nông nhất và
hiển nhiên nhất lại đúng là chỗ luật không nhìn thấy. `helpers/`, `lib/`, `shared/`, `util/`,
`const/`, `models/`, `data/`: bốn cái tên là một danh sách đóng, và một từ đồng nghĩa là một thư mục
luật chưa từng nghe tới. Một tiện ích viết thành FILE chứ không phải thư mục —
`blocks/<category>/<Name>/utils.ts` — vì dấu gạch chéo cuối biến đây thành phép thử thư mục, và tầng
block lại nằm ngoài tầm luật thư mục màn hình, nên file đó thoát cả hai cùng lúc. `constants/tone.json`,
`types/schema.json`: phần mở rộng không được lint thì không tới được luật nào.

**Ranh giới.** Luật này cấm một **tên thư mục** bên trong cây thành phần. Nó không bao giờ mở thư mục
ra, nên việc nội dung bên trong có thật sự là mã không dựng hình hay không thì không ai phán xét.

## `export-matches-folder` — FILE-1

**Nó báo cái gì.** `mismatch` — gọi tên thư mục, liệt kê mọi export tên trực tiếp đã thu được, và đòi
đúng tên thư mục hoặc một thành viên mang tiền tố đó. Báo trên `Program:exit`.

**Nó phát hiện bằng gì.** Cổng tên file `/<PascalCaseFolder>/index.tsx?$` chọn file; sau đó là AST —
mỗi `ExportNamedDeclaration` góp `id.name` của declarator từ một `VariableDeclaration`, `id.name` từ
một `FunctionDeclaration`, và `exported.name` từ mọi specifier. Tới `Program:exit`, nó báo khi tập tên
thu được **không rỗng** mà không thành viên nào bằng tên thư mục hoặc bắt đầu bằng tên thư mục cộng
một chữ cái viết hoa.

**Điểm mù.** `export * from "./component"` — chính là dạng barrel thông dụng nhất — vì star
export là một nút khác loại, không góp tên nào, và tập rỗng khiến luật thoát ra trước khi phán xét bất
cứ điều gì. `export default Paragraph` trong thư mục `Text`: cũng một nút khác loại, cũng im lặng như
thế. `export class Paragraph {}` hay `export enum Paragraph {}`: chỉ khai báo biến và khai báo hàm
được thu. Một export đúng họ gánh theo bao nhiêu hành khách không liên quan cũng được — `export const
Text` đi cạnh `export const formatSomething` — vì chỉ cần **một** tên thuộc họ là cả file được thông
qua; phần mô tả của chính luật nói ngược lại điều này. Một thư mục không PascalCase, một nửa không tên
`index`, hoặc phần mở rộng khác — `text/index.tsx`, `Text/component.tsx`, `Text/index.jsx` — vì cổng
tên file **chính là** luật, và đổi tên là làm luật ngừng tồn tại cho file đó. `export type Paragraph =
…` trong thư mục `Text` không góp tên nào, nên một họ kiểu đặt lệch tên đi qua mà không ai đọc.

**Ranh giới.** Luật này đọc danh sách export của một nửa `index`. Nó không nói gì về những file khác
trong thư mục export ra cái gì, và không nói gì về việc thứ được export có phải một thành phần hay
không.

## `no-runtime-namespace` — FILE-4

**Nó báo cái gì.** `namespace` — gọi tên binding và liệt kê các thành viên, rồi nêu cái giá phải trả ở
bản dựng. Báo trên `id` của declarator.

**Nó phát hiện bằng gì.** Thuần AST, **không có cổng đường dẫn**. `ExportNamedDeclaration` →
`VariableDeclaration` → mỗi declarator có `id.name` bắt đầu bằng chữ hoa và có `init` (sau khi bóc lớp
`TSAsExpression`) là một `ObjectExpression`; thành viên là những khoá `Property` không tính toán và có
dạng `Identifier`. Nó báo khi có từ hai thành viên trở lên và **mọi** thành viên đều bắt đầu bằng chữ
hoa.

**Điểm mù.** `export const Card = Object.assign(CardRoot, { Header, Footer })` — cách dựng
một họ có dấu chấm phổ biến nhất — vì phần khởi tạo bắt buộc phải là object literal, còn một lời gọi
thì vô hình. `Card.Header = CardHeader` viết sau khai báo: các biểu thức gán không được xem tới, nên
object được lắp ráp bên ngoài đúng cái nút mà luật đang canh. `const Card = { Root, Header }` rồi
`export { Card }` ở dòng sau: nút export khi đó mang specifier chứ không mang khai báo, và luật chỉ đi
xuống khai báo. `export default { Root, Header }` là một nút khác loại hoàn toàn. Một thành viên viết
thường — `{ Root, Header, displayName: "Card" }` — vì mọi thành viên đều phải có dáng thành phần, nên
thêm `displayName` là tắt luật cho cả object đó. `export const Card = { Root, Header } satisfies
Parts`: chỉ lớp `as` được bóc, người anh em của nó thì không. Khoá đặt trong ngoặc kép,
`{ "Root": CardRoot, "Header": CardHeader }`, không phải nút `Identifier`, nên cả hai thành viên bị
loại và số đếm tụt xuống dưới ngưỡng. Một binding viết thường, `export const card = { Root, Header }`,
trượt ngay cổng đầu tiên.

**Ranh giới.** Luật này không có cổng đường dẫn, nên nó áp lên **mọi** file được lint trong kho, kể cả
những file hoàn toàn không phải thành phần. Chỗ một file nằm là chuyện của sáu luật đường dẫn, không
bao giờ là chuyện của luật này.

## `monorepo-tier-belongs-to-its-side` — FILE-5

**Nó báo cái gì.** `featureInPackage` khi một tầng nghiệp vụ nằm trong gói dùng chung,
`vocabularyInApp` khi một tầng hình dạng nằm bên trong một ứng dụng; mỗi bên đều gọi tên tầng và đích
đến. Một lần cho mỗi file, trên `Program`.

**Nó phát hiện bằng gì.** `context.filename` khớp
`/packages/<name>/src/(blocks|overlays|pages|layouts)/` và
`/apps/<name>/src/(components/)?(contracts|leaves|composites|branches|shells)/`. Phép thử phía gói
chạy trước và thoát ngay.

**Điểm mù.** `packages/ui/src/components/blocks/<category>/<Name>.tsx` — phía ứng dụng chấp
nhận đoạn `components/` tuỳ chọn, phía gói thì không, nên cùng một vi phạm viết thừa một thư mục là
không ai thấy. Một workspace đặt tên thư mục là `libs/`, `services/` hay `modules/`, vì cả hai biểu
thức đều hard-code `packages/` và `apps/`. Một thành phần biết nghiệp vụ đặt trong
`packages/ui/src/leaves/<Name>/`: đây đúng là thất bại mà tài liệu luật mô tả, và nó hợp lệ theo đường
dẫn, vì luật giữ **vị trí của tầng**, không bao giờ giữ việc file bên trong có biết một nghiệp vụ hay
không. Và chiều ngược lại — hình dạng dùng chung đặt trong một ứng dụng dưới một tầng nghiệp vụ,
`apps/web/src/components/blocks/<category>/Badge/` — là một hình dạng nằm trong thư mục hợp lệ, nên
không có gì nhìn tới nó.

**Ranh giới.** Luật này quyết định một thư mục tầng nằm ở phía nào của workspace. Việc thư mục đó sau
đó có tuân thủ luật màn hình, luật thư mục tiện ích, luật định tuyến, luật export, luật namespace,
luật marker hay luật shell hay không là chuyện của các luật file-layout còn lại.

## `source-tier-marker-matches-folder` — FILE-7

**Nó báo cái gì.** `mismatch` — gọi tên tầng và giá trị `meta.shape` được export nhưng lệch với tầng
đó. Báo cáo trỏ đúng vào literal shape, một lần cho mỗi khai báo `meta` bị lệch.

**Nó phát hiện bằng gì.** Tên file được chuẩn hoá rồi so với
`/(?:src\\/components|packages\\/[^/]+\\/src|apps\\/[^/]+\\/src\\/(?:components\\/)?)\\/(leaves|composites|branches|blocks|layouts|overlays|pages)\\//`.
Marker đúng lần lượt là `leaf`, `composite`, `branch`, `block`, `layout`, `overlay` và `page`. Trong
`VariableDeclaration` được export, chỉ declarator tên `meta` được đọc; các wrapper
`TSAsExpression` và `TSSatisfiesExpression` được bóc, rồi một property `shape` không tính toán được
đọc khi value của nó là string literal.

**Điểm mù.** Tầng nằm ngoài biểu thức đường dẫn đóng — gồm `contracts/`, `shells/`, cây package có
`src/components/`, hoặc cây `components/` ở gốc — đều ngoài phạm vi. `meta` không export, export không
phải variable, `shape` tính toán, spread hoặc method, shape không phải literal, và `meta` lồng trong
một khai báo khác đều không được đọc. Entry `contracts` trong map marker của implementation không thể
chạm tới vì `contracts` không có trong biểu thức đường dẫn. Luật cũng chỉ kiểm tra marker được khai
báo; nó không chứng minh file thật sự hành xử như tầng đó.

**Ranh giới.** Luật này nối một sự thật từ đường dẫn với một sự thật từ source. `no-shell-tier` giữ
đường dẫn shell bị cấm; các luật file-layout khác giữ số lượng file, helper, export, namespace và phía
của workspace.

## `no-shell-tier` — FILE-8

**Nó báo cái gì.** `shell` — gọi `shells/` là một ngoại lệ branch không có kiểu và đẩy chủ sở hữu về
branch có tên, có nội dung contract có kiểu và mechanics vendor đóng kín. Báo một lần cho mỗi file được
lint, trên `Program`.

**Nó phát hiện bằng gì.** Tên file đã chuẩn hoá được so với
`/(?:src\\/components|packages\\/[^/]+\\/src|apps\\/[^/]+\\/src\\/(?:components\\/)?)\\/shells\\//`. Vì vậy
`src/components/shells/`, `packages/<name>/src/shells/`, `apps/<name>/src/shells/` và
`apps/<name>/src/components/shells/` đều nổ. Luật không đọc AST và không kiểm tra import hay metadata.

**Điểm mù.** `shells/` nằm ngoài ba prefix trên, cây `app/` hoặc `components/` ở gốc, và thư mục gần
nghĩa shell nhưng mang tên khác đều ngoài phạm vi. Import có chứa `/shells/` trong một file hợp lệ và
`meta.shape = "shell"` cũng không bị thấy: rule đã publish này chỉ đọc đường dẫn. Extension không nằm
trong glob ESLint của consumer thì không tới luật nào.

**Ranh giới.** Luật này cấm tầng shell vật lý. Nó không tự di chuyển file, không kiểm tra branch có tên,
không đọc slot contract, và không thực thi luật marker riêng của `FILE-7`.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hoá dấu phân cách | Mọi luật đường dẫn đổi gạch chéo ngược thành gạch chéo xuôi trước khi so, nên một biểu thức phục vụ cả hai nền tảng |
| phạm vi màn hình | `/src/components/(pages\|layouts)/<Name>/<rest>` hoặc `/src/components/overlays/<category>/<Name>/<rest>`, rồi `<rest>` so với `^(component\|index)(\.spec)?\.tsx?$` |
| phạm vi định tuyến | `/src/app/<rest>`, rồi ba cổng miễn trừ theo thứ tự: `<rest>` bắt đầu bằng `api/` hoặc `_`, basename khớp `\.spec\.(tsx?\|jsx?)$`, basename nằm trong danh sách khe của khung nền |
| phạm vi thư mục tiện ích | `/src/components/.*/(constants\|utils\|types\|hooks)/` — dấu gạch chéo cuối biến nó thành phép thử thư mục, `.*/` đòi một đoạn ở giữa |
| phạm vi workspace | `/packages/<name>/src/(blocks\|overlays\|pages\|layouts)/` và `/apps/<name>/src/(components/)?(contracts\|leaves\|composites\|branches\|shells)/`; phép thử phía gói chạy trước và thoát ngay |
| phạm vi marker nguồn | `/(?:src/components\|packages/[^/]+/src\|apps/[^/]+/src/(?:components/)?)/(leaves\|composites\|branches\|blocks\|layouts\|overlays\|pages)/`; chỉ declarator `meta` dạng variable được export, bóc `TSAsExpression` / `TSSatisfiesExpression`, rồi đọc `shape` literal |
| phạm vi shell | `/(?:src/components\|packages/[^/]+/src\|apps/[^/]+/src/(?:components/)?)/shells/`; file khớp báo trên `Program` mà không đọc AST |
| bộ đọc export | Cổng tên file `/<PascalCaseFolder>/index.tsx?$`, rồi `ExportNamedDeclaration` thu `id.name` của declarator, `id.name` của hàm và `exported.name` của mọi specifier, quyết định ở `Program:exit` |
| bộ đọc declarator | Không có cổng đường dẫn nào: `id.name` viết hoa, `init` bóc qua `TSAsExpression` và bắt buộc là `ObjectExpression`, thành viên là các khoá `Property` không tính toán dạng `Identifier` |
| cái gì với ra ngoài file | Không gì ngoài glob của trình chạy. Sáu luật không bao giờ mở file; hai luật đọc source sau cổng đường dẫn; một luật không bao giờ đọc đường dẫn; extension mà cấu hình tiêu thụ không lint thì không tới được luật nào ở đây |

Ba điều rút ra từ bảng này, đáng nói thẳng. **Sáu trên chín luật không bao giờ đọc file** — toàn bộ
đầu vào của chúng là một chuỗi, và đổi chuỗi đi là luật **ngừng tồn tại** cho file đó, chứ không phải
file đó qua. **Hai luật chỉ đọc source sau cổng đường dẫn** — bộ đọc export và bộ đọc `meta.shape`.
**Một luật không bao giờ đọc đường dẫn** — `no-runtime-namespace` áp lên mọi file được lint trong kho.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lách được, nhưng không.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| Đường dẫn gạch chéo ngược trên nền tảng dùng nó | Mọi luật chuẩn hoá về gạch chéo xuôi trước khi so |
| Giấu file lạc trong một route group hay một đoạn động — `(marketing)/`, `[id]/` | Chỉ basename được so với danh sách khe; ngoặc tròn hay ngoặc vuông ở các đoạn phía trên không thay đổi gì |
| Một khe của khung nền có hậu tố bổ nghĩa — `page.module.css`, `opengraph-image.alt.ts` | Biểu thức khe cho phép đúng một đoạn chấm ở giữa, nên file khung nền thật đi qua còn một basename tự chế thì vẫn không |
| Chôn thư mục tiện ích sâu hơn — `blocks/<category>/<Name>/parts/utils/x.ts` | Biểu thức cho phép mọi độ sâu giữa gốc cây thành phần và tên thư mục |
| `export const Card = { Root, Header } as const` | Lớp `as` được bóc trước phép thử object |
| Một cái tên suýt trùng mượn tiền tố — thư mục `Text` export `Textual` | Thuộc họ đòi ký tự ngay sau tiền tố phải viết hoa, nên chỉ một thành viên thật như `TextLink` mới đi qua |
| Re-export một tên lạ qua specifier — `export { Paragraph } from "./component"` | Tên trong specifier được thu y hệt tên trong khai báo, nên một barrel đổi tên không rửa được lỗi lệch |
| Bỏ JSX để nửa kia thành `component.ts` | Biểu thức cho phép chấp nhận cả `.ts` lẫn `.tsx`, nên phép chia hai nửa được giữ bằng **TÊN**, không phải bằng cú pháp |
| Marker export bọc trong `as const` hoặc `satisfies Meta` — `export const meta = { shape: "block" } as const` | Luật marker bóc cả hai wrapper trước khi đọc `shape` literal |
| Marker literal nằm sai tầng — `src/components/leaves/Card/index.tsx` với `meta.shape = "block"` | Đường dẫn tầng được chọn trước và giá trị shape bị lệch được báo đúng tại literal |
| Đường dẫn shell trong layout được hỗ trợ — `packages/ui/src/shells/Modal/index.tsx` | `no-shell-tier` báo mọi file được lint dưới các prefix `shells/` đóng |
| Một kho hoàn toàn không có workspace | Không biểu thức nào khớp, nên luật im lặng theo thiết kế thay vì nổ trên mọi thư mục của một cây một ứng dụng |

**Còn mở** — điểm mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Luật lint | Cái gì đi qua |
|---|---|
| `surface-folder-two-files-only` | **Thành phần thứ ba chuyển vào thẳng `component.tsx`**, một thư mục chỉ có `index.tsx` và vẽ luôn bên trong, **lớp phủ đặt phẳng** không có tầng nhóm, file thứ ba trong thư mục block, composite, branch, leaf hay shell, `constants.json` / `copy.md` / `styles.css` nằm cạnh hai nửa, và mọi thư mục màn hình ngoài `components/` |
| `route-tree-holds-routes-only` | **Cây định tuyến ở gốc kho, không có `src/`**, một file route vừa fetch vừa sắp xếp ngay trong `page.tsx`, gạch dưới trên một FILE ở gốc cây, tấm gương lật ngược nơi `app/dashboard/_components/Card.tsx` nổ còn `app/_components/Card.tsx` thì không, một màn hình đầy đủ đội tên khe như `template.tsx` hay `default.tsx`, và một thành phần đội tên `.spec.tsx` |
| `no-helper-folder-in-components` | **Thư mục tiện ích đặt thẳng dưới gốc cây thành phần**, mọi từ đồng nghĩa — `helpers/`, `lib/`, `shared/`, `util/`, `const/`, `models/`, `data/` — một tiện ích viết thành FILE chứ không phải thư mục, và những phần mở rộng không được lint như `constants/tone.json` |
| `export-matches-folder` | **`export * from "./component"`**, `export default`, `export class` và `export enum`, **một export đúng họ gánh theo bao nhiêu hành khách không liên quan cũng được**, thư mục không PascalCase hoặc nửa không tên `index` hoặc phần mở rộng không phải `.ts`/`.tsx`, và `export type` |
| `no-runtime-namespace` | **`Object.assign(CardRoot, { Header, Footer })`**, `Card.Header = CardHeader` viết sau khai báo, khai báo trước rồi `export { Card }`, `export default { Root, Header }`, **một thành viên viết thường như `displayName`**, `satisfies` thay cho `as`, khoá đặt trong ngoặc kép, và binding viết thường |
| `monorepo-tier-belongs-to-its-side` | **`packages/ui/src/components/blocks/…`** — cùng một vi phạm, thừa một đoạn — một workspace đặt tên `libs/`, `services/` hay `modules/`, **một thành phần biết nghiệp vụ trong `packages/ui/src/leaves/<Name>/`**, và hình dạng dùng chung đặt trong tầng nghiệp vụ của một ứng dụng |
| `source-tier-marker-matches-folder` | **Đường dẫn `contracts/` và `shells/`**, đường dẫn package `src/components/`, cây ở gốc, `meta` không export hoặc không phải variable, `shape` tính toán/spread/method, shape không phải literal, `meta` lồng, entry `contracts` không thể chạm tới trong map marker, và extension không được lint |
| `no-shell-tier` | **`shells/` ngoài ba prefix hỗ trợ**, tên gần nghĩa shell nhưng khác `shells`, import có `/shells/`, `meta.shape = "shell"`, cây ở gốc và extension không được lint; luật chỉ đọc đường dẫn |

Đó là bản tổng kết trung thực: cả chín mã đều có máy giữ. Sáu cái quyết định chỉ từ chuỗi đường dẫn,
hai cái nối cổng đường dẫn với một lần đọc source hẹp, và một cái đọc source không có cổng đường dẫn.
Vì vậy một lần đổi tên bình thường hay một đoạn thư mục thừa có thể gỡ luật đi chứ không phải làm luật
nổ.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| filename | Đường dẫn mà trình chạy đưa vào `context.filename`, trước khi chuẩn hoá |
| đoạn tầng | Đường dẫn gọi tên tầng nào trong `pages`, `layouts`, `overlays`, `blocks`, `leaves`, `composites`, `branches`, `shells`, `contracts` |
| hình dạng workspace | Kho có chia `packages/` và `apps/` hay không, và cây có lồng dưới `components/` hay không |
| danh sách export | Với ba luật đọc source: mọi export tên trực tiếp, loại nút của nó và phần khởi tạo của nó |
| marker nguồn | Với `source-tier-marker-matches-folder`: variable export tên `meta`, object literal sau khi bóc wrapper và property `shape` dạng literal |
| glob của trình chạy | Cấu hình tiêu thụ thật sự lint những phần mở rộng nào — một file không được lint thì không tới được luật nào |

## Quy tắc

1. Tên đã publish là danh tính duy nhất của một luật lint. Đó là chuỗi mà bản dựng in ra, mà một
   comment tắt luật gọi tên, và mà một báo cáo trích dẫn. Không có mã số thứ hai.
2. Một luật lint giữ đúng một mã luật, và một mã luật được giữ bởi đúng một luật lint.
3. Một luật đọc đường dẫn thì chỉ đọc đường dẫn. Không được mô tả nó như thể nó đọc nội dung file.
4. Sáu luật chỉ-đọc-đường-dẫn báo một lần cho mỗi file, trên nút `Program`. `export-matches-folder`
   báo ở `Program:exit`, `source-tier-marker-matches-folder` báo trên literal `shape` lệch, còn
   `no-runtime-namespace` báo trên identifier của binding. Một file hoặc thuộc phạm vi hoặc không;
   không có phán quyết nửa vời.
5. Mức nghiêm trọng thuộc về cấu hình của kho tiêu thụ. Gói luật chỉ publish một ý kiến, không publish
   một thiết lập.
6. Một luật lint chỉ được từ chối những gì máy nhìn thấy. Phần còn lại thuộc về tài liệu luật, và
   khoảng cách giữa hai bên thuộc về phần Lối thoát hợp lệ ở trên.

## Ngoại lệ

Mỗi ngoại lệ đều đóng và gọi tên luật lint mà nó áp vào.

- **`export-matches-folder` là `suggestion`, không phải `problem`.** Đây là luật duy nhất mà mã nguồn
  khuyên bật ở mức cảnh báo trước trong một cây đã có sẵn: nó báo trên mọi thư mục có quy ước ra đời
  trước nó, và con số đó là một cuộc di trú chứ không phải một đống lỗi. Nó không giải phóng gì về bản
  thân lỗi lệch tên — chỉ giải phóng mức nghiêm trọng.
- **File kiểm thử nằm cạnh file route được miễn**, giải phóng `route-tree-holds-routes-only` cho mọi
  basename khớp `\.spec\.(tsx?|jsx?)$`. Một file kiểm thử không đi vào bản dựng nào và không route nào
  dựng nó, nên nó không thể trở thành màn hình thứ hai mà luật này sinh ra để chặn. Tên của nó **cố ý**
  không bị bắt phải trùng với tên khe, vì kiểm thử của một route chia theo mối quan tâm.
- **Mã máy chủ và thư mục riêng của khung nền được miễn khỏi luật định tuyến**, giải phóng mọi phần
  đường dẫn còn lại bắt đầu bằng `api/` hoặc `_` — nhưng chỉ ở ngay gốc cây định tuyến. Độ hẹp của chữ
  "chỉ" đó là một cửa còn mở, đã ghi ở trên.
- **Kho một ứng dụng nằm ngoài phạm vi `monorepo-tier-belongs-to-its-side`.** Nới biểu thức thêm một
  đoạn là nó bắt đầu báo trên mọi block của mọi kho một ứng dụng.
- **Block, composite, branch, leaf và shell nằm ngoài phạm vi `surface-folder-two-files-only`.** Những
  tầng đó được phép giữ nhiều hơn hai file. Tuy vậy, đường dẫn shell vẫn bị `no-shell-tier` từ chối
  độc lập khi khớp prefix của luật đó.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule: <published rule name>
code: <FILE-1 … FILE-9>
file: <path the rule was given>
mechanism: <path match | export list | both>
verdict: <reported | silent | out of scope>
hatch: <none | the exact rewrite that would silence it>
```

`silent` và `out of scope` là hai câu trả lời khác nhau. Một luật đã xem file rồi chấp nhận là đã phán
xét; một luật mà biểu thức của nó không bao giờ khớp thì chưa phán xét gì. Một file sạch nằm trong
phạm vi phát `verdict: silent`; một file không biểu thức nào chọn phát `verdict: out of scope`, và nó
chưa hề qua.

## Ví dụ đã giải

**Đầu vào.** Một thư mục màn hình, `components/pages/FleetPage/`:

```
src/components/pages/FleetPage/index.tsx
src/components/pages/FleetPage/component.tsx
src/components/pages/FleetPage/PriceTag.tsx
src/components/pages/FleetPage/utils/format.ts
```

```tsx
// src/components/pages/FleetPage/index.tsx
export const Fleet = () => <FleetPageBase />
```

```text
rule: surface-folder-two-files-only
code: FILE-2
file: src/components/pages/FleetPage/PriceTag.tsx
mechanism: path match
verdict: reported
hatch: none
```

```text
rule: surface-folder-two-files-only
code: FILE-2
file: src/components/pages/FleetPage/utils/format.ts
mechanism: path match
verdict: reported
hatch: none
```

```text
rule: no-helper-folder-in-components
code: FILE-3
file: src/components/pages/FleetPage/utils/format.ts
mechanism: path match
verdict: reported
hatch: none
```

```text
rule: export-matches-folder
code: FILE-1
file: src/components/pages/FleetPage/index.tsx
mechanism: both
verdict: reported
hatch: none
```

File tiện ích bị báo hai lần, bởi hai luật giữ hai mã khác nhau, vì nó vừa là một đường dẫn thứ ba
trong thư mục màn hình vừa là một thư mục tiện ích trong cây thành phần.

**Sau khi sửa.** `PriceTag` chuyển về tầng block, `format` chuyển về cây mã không dựng hình dùng
chung, và index export đúng tên thư mục của chính nó:

```
src/components/pages/FleetPage/index.tsx
src/components/pages/FleetPage/component.tsx
```

```tsx
// src/components/pages/FleetPage/index.tsx
export const FleetPage = () => <FleetPageBase />
```

Nhưng hai cửa còn mở vẫn sống sót qua bản sửa. Người viết nào chuyển `PriceTag` vào trong
`component.tsx` thay vì ra khỏi thư mục sẽ nhận đúng sự im lặng đó:

```text
rule: surface-folder-two-files-only
code: FILE-2
file: src/components/pages/FleetPage/component.tsx
mechanism: path match
verdict: silent
hatch: luật đếm FILE — ba thành phần trong một file vẫn là một file, nên thứ lạc kia vô hình chứ không phải hợp lệ
```

Và người viết nào thay export tên bằng dạng barrel thông dụng cũng nhận đúng sự im lặng ấy lần nữa:

```tsx
// src/components/pages/FleetPage/index.tsx
export * from "./component"
```

```text
rule: export-matches-folder
code: FILE-1
file: src/components/pages/FleetPage/index.tsx
mechanism: export list
verdict: silent
hatch: một star export không góp tên nào, nên tập tên rỗng và luật thoát ra trước khi phán xét bất cứ điều gì
```

Không sự im lặng nào trong hai cái đó là sự tuân thủ.

## Phạm vi

Mô-đun này ghi lại **việc thực thi**, không ghi lại phong cách. Nó không gọi tên sản phẩm nào, thư
viện thành phần nào, kho nào hay khoá registry nào. Tên luật và định danh thông báo được chép lại đúng
như chúng xuất xưởng, vì chính những chuỗi đó là thứ bản dựng in ra; mọi thứ viết quanh chúng chỉ là
văn xuôi bình thường về những đường dẫn bình thường và những đoạn markup bình thường. Việc một file
route có đang vẽ hay không, một leaf trong gói dùng chung có biết nghiệp vụ hay không, một thư mục tiện
ích có thật sự chứa mã không dựng hình hay không, marker có mô tả đúng hành vi hay branch có tên đã thay
shell hay chưa — tất cả đều thuộc về tài liệu luật phát biểu `FILE-1` tới `FILE-9`, không bao giờ thuộc
về chín cái máy này.
