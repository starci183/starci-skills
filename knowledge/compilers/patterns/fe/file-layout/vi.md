---
title: File layout · Vietnamese
description: Một shape đã duyệt thì code của nó đi đâu — file nào, tier nào, export ra gì, đặt tên là gì.
module: file-layout
kind: pattern
codes: [FILE-1, FILE-2, FILE-3, FILE-4, FILE-5, FILE-6, FILE-7, FILE-8, FILE-9]
---

# Bố cục file

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | bộ máy frontend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã có người duyệt — một màn hình, một câu nói nghiệp vụ, một
container, một fetch, một hàm thuần, một mẩu chữ nghĩa. Chuyện nó có nên tồn tại hay không đã khép
lại, và pattern này không mở lại. Kết quả là kiến trúc source: file nào giữ nó, tier nào sở hữu file
đó, thư mục tên gì, `index.tsx` export ra gì, và cái gì không được ngồi cạnh nó.

## Luật

Chỗ một file nằm là một lời khai về việc nó là cái gì. Thư mục dưới `components/` khai rằng "cái này
vẽ ra thứ gì đó"; dưới `hooks/` khai rằng "cái này đi lấy dữ liệu"; dưới `modules/` khai rằng "cái này
không phải React". Đặt file sai chỗ không phải là bừa bộn — nó là khai sai, và giá phải trả là người
đáng lẽ đã tái sử dụng được nó thì không tìm thấy nó.

Câu hỏi quyết định mọi thứ: **file này LÀ cái gì, không phụ thuộc vào việc hiện giờ ai đang gọi nó?**
Câu "chỉ mỗi màn này dùng thôi" mô tả call graph của hôm nay, không mô tả bản chất — và nó chính là
câu đã biến thư mục của một màn hình thành một codebase thứ hai.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi file được ship đều đã có chỗ do luật quyết định
sẵn. Không có file nào nhỏ đến mức được miễn, và "có mỗi một hàm helper thôi mà" là chỗ luật này bị bỏ
qua nhiều nhất.

Cái cây mà luật này hạ cánh xuống:

```text
src/
    app/                    routes only - a route mounts a page and draws nothing
        api/
        <segment>/
    components/
        contracts/                  the entry table and the slot types - two files, no more
        leaves/<Name>/              one vendor primitive each, flat, no category
        composites/<Name>/          closed arrangements, flat
        branches/<Name>/            open containers, flat
        blocks/<category>/<Name>/   domain sentences, grouped by feature
        overlays/<category>/<Name>/ summoned surfaces, grouped by feature
        layouts/<Name>/             route-stable chrome, flat
        pages/<Name>/               one screen each, flat
    hooks/
        swr/                        one file per query or mutation
        <area>/
    modules/
        api/graphql/                clients, queries, mutations, and their types
    i18n/                   the translation runtime
    messages/               the copy itself, per locale
```

**Tầng category không phải để trang trí.** `blocks/` và `overlays/` gom theo feature vì chúng biết
domain, và feature là cách gom duy nhất còn đúng khi sản phẩm lớn lên. `leaves/`, `branches/`,
`layouts/` và `pages/` để phẳng vì chúng không biết feature nào — đặt category ở đó chỉ là phỏng đoán
của ai đó về việc màn hình nào sở hữu một thứ vốn thuộc về tất cả.

Trong một workspace nhiều app, đường cắt xảy ra ở đúng một chỗ, và đó không phải sở thích đóng gói —
đó chính là đường feature vẽ ở trên.

```text
packages/ui/src/            THE VOCABULARY - knows no feature
    contracts/                  the entry table and the slot types
    leaves/<Name>/
    composites/<Name>/
    branches/<Name>/

apps/<app>/src/             THE SENTENCES - each knows its own domain
    app/                        routes only
    components/
        blocks/<category>/<Name>/
        overlays/<category>/<Name>/
        layouts/<Name>/
        pages/<Name>/
```

**Mọi thứ dưới block là dùng chung; block và mọi thứ trên nó thì không.** Leaf, composite, branch và
bảng contract mô tả HÌNH DẠNG, và một hình dạng thì giống nhau ở mọi app — đó là lý do một bản là đủ,
và cũng là lý do một bản là bắt buộc. Block là một câu nói nghiệp vụ: nó biết course, invoice hay
fleet resource là gì. Đặt một block vào package dùng chung thì package học được một feature nó không
có việc gì phải biết, và app tiếp theo thừa kế một mớ từ vựng nó sẽ không bao giờ dùng.

Phép thử vẫn là câu hỏi mà tier trả lời, chỉ hỏi ở tầm workspace: **app thứ hai có muốn thứ này mà
không muốn cái feature nó được viết ra để phục vụ không?** `Badge` — có. `FleetRow` — không.

Ngoài ra không có gì dịch chuyển. Các tier giữ nguyên tên, giữ nguyên quy tắc phẳng-hay-có-category và
giữ nguyên hình dạng hai file; nhiều app chỉ quyết định mỗi tier nằm ở phía nào của đường feature.

Những đích đến mà luật gọi tên được tạo khi dùng lần đầu chứ không giữ rỗng sẵn: hàm thuần về
`modules/utils/`, shape dùng chung về `modules/types/`, config map hoặc chữ nghĩa không dịch về
`resources/`. Thư mục chưa tồn tại không phải lý do để bỏ file lại trong cây component.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã. Mã gọi tên TÌNH HUỐNG; cột rule trong phần **Tầng
giữ** gọi tên thứ giữ nó về mặt cơ học. Hai thứ đó không phải một, và một trong hai giữ ít hơn cái mã
tuyên bố.

| Mã | Tình huống | Source phải trông ra sao |
|---|---|---|
| `FILE-1` | Người đọc biết tên component thì phải suy ra được đường dẫn, và ngược lại | Một component một thư mục, thư mục đặt tên theo thứ nó export; `index.tsx` mang một named export trực tiếp thuộc họ của thư mục. Cấm: thư mục có export không khớp tên; một hành khách đi nhờ ngồi chung thư mục |
| `FILE-2` | Một màn hình — page, layout, overlay — đang được cấp thư mục | Thư mục giữ `index.tsx` và `component.tsx` cộng bài test sinh đôi của mỗi nửa. Cấm: một thứ thứ ba trong thư mục đó — component khác, một `constants/`, một `utils/`, một shape chép tay |
| `FILE-3` | Shape sinh ra thứ không phải component code — một fetch, một hàm thuần, một type, chữ nghĩa, một config map | Helper sống trong cây gọi đúng tên bản chất của nó: fetch ở `hooks/`, hàm thuần ở `modules/utils/`, shape ở `modules/types/`, chữ nghĩa hoặc config map ở `resources/`. Cấm: `constants/`, `utils/`, `types/` hoặc `hooks/` ở bất cứ đâu dưới `components/` |
| `FILE-4` | Một component và các thành viên trong họ của nó đang được export | Family export ra từng thành viên một. Cấm: `export const X = { A, B }` — một object runtime đứng thay cho một namespace |
| `FILE-5` | Workspace có một package dùng chung và một hoặc nhiều app, và một tier phải rơi về một phía | Package dùng chung giữ `contracts/`, `leaves/`, `composites/`, `branches/`; `blocks/`, `overlays/`, `layouts/`, `pages/` thuộc về app sở hữu feature. Cấm: tier biết feature nằm trong package dùng chung; tier từ vựng nằm trong một app; một tier wrapper song song |
| `FILE-6` | Shape cần một URL, nên có thứ gì đó đang được viết dưới `app/` | File dưới `app/` nói page nào render ở URL nào, và là một trong các slot của chính framework. Cấm: fetch, sắp đặt hay contract key trong route file; bất kỳ file component có tên riêng nào dưới `app/` |
| `FILE-7` | Một file tự khai nó thuộc tầng nào, trong source, ngay cạnh đường dẫn vốn đã khai điều đó | Một dấu hiệu trong source phải khớp với thư mục sở hữu nó. Cấm: một file nằm dưới tầng này lại tự khai mình là tầng khác |
| `FILE-8` | Một component cần một cơ chế của vendor hoặc của nền tảng bọc quanh nội dung đã được kiểm | Chủ của nó là một **branch có tên**, giữ cơ chế đóng kín bên trong. Cấm: một tầng `shells/`, và mọi tầng đóng thế vai trò đó |
| `FILE-9` | Một frontend unit test đang được đặt | Unit là twin `.spec.` nằm cạnh owner. Cấm tên `.test.` và cây frontend `src/tests`, `test/unit` hay `e2e` tách riêng |

`FILE-2` VÀ `FILE-3` KHÔNG PHẢI CÙNG MỘT LỜI TỪ CHỐI. `FILE-2` đếm file trong một thư mục màn hình và
không quan tâm chúng là gì; `FILE-3` gọi tên bốn thư mục sai ở mọi chỗ dưới `components/`, kể cả cạnh
một block mà `FILE-2` không hề ngó tới. Một `utils/` trong thư mục page vi phạm cả hai, và đó không
phải tính hai lần — đó là hai lời khai khác nhau tình cờ gặp nhau.

Cách đánh số không hàm ý xếp hạng. `FILE-6` không nặng hơn `FILE-1`; các mã là địa chỉ, và là địa chỉ
mà các file luật khác cùng các hồ sơ task cũ đã trích dẫn.

## Đọc một shape đã duyệt

1. **Đọc những gì shape nói ra.** Nó nói thứ đó LÀ cái gì — một màn hình, một câu nói nghiệp vụ, một
   container, một shape, một fetch, một hàm thuần, chữ nghĩa — và nó nói thay cho domain nào, hoặc nói
   rõ là nó không nói thay cho domain nào.
2. **Đọc những gì shape không nói, và vì thế không giải quyết.** Shape không đặt đường dẫn, không đặt
   tên thư mục, không liệt kê export, không chọn tier, không chọn phía workspace. Nó cũng không bao giờ
   nói ai import thứ đó, và nếu có nói thì cũng không giải quyết được gì: chỗ của một file suy ra từ nó
   là gì, không bao giờ suy ra từ ai đang import nó.
3. **Giải từ ngoài vào trong.** Phía workspace trước tier (`FILE-5`), tier trước thư mục, thư mục
   trước số file (`FILE-2`), số file trước hình dạng export (`FILE-1`, rồi `FILE-4`). Cửa route
   (`FILE-6`) được giải từ màn hình, sau khi màn hình đã có nhà — không bao giờ trước đó.
4. **Hỏi lần lượt câu hỏi của từng mã.** App thứ hai có muốn thứ này mà không muốn feature không
   (`FILE-5`)? Tên có dự đoán được đường dẫn và đường dẫn có dự đoán được tên không (`FILE-1`)? Đây có
   phải thư mục màn hình không, và trong đó có gì ngoài hai nửa cùng bản sinh đôi của chúng không
   (`FILE-2`)? Thứ này có render ra gì không (`FILE-3`)? Bundler có phân biệt được các thành viên của
   họ này không (`FILE-4`)? File này có phải một slot của chính framework không (`FILE-6`)?
5. **Khi hai mã cùng khớp thì cả hai đều đúng.** Mỗi mã ứng với đúng một tình huống, và không tình
   huống nào mang hai mã — nhưng một file có thể đứng trong hai tình huống cùng lúc. Một thư mục
   `utils/` trong thư mục page là lời từ chối `FILE-2` về số lượng và lời từ chối `FILE-3` về cái nhà;
   một `export const Card = { Root, Header }` trong `Card/` thoả `FILE-1` và vi phạm `FILE-4`. Xuất một
   khối output cho mỗi file, và để nó nêu đủ mọi tình huống mà nó đang đứng trong đó.

## `FILE-1` — một thư mục, một component, tên khớp thứ nó export

**Khi nào gặp.** Người đọc biết tên component thì phải suy ra được đường dẫn, và người đứng ở đường dẫn
thì phải suy ra được cái tên. Grep một cái tên phải ra một chỗ, không phải ba chỗ và cũng không phải
không chỗ nào.

**Source phải thể hiện gì.** Một thư mục cho mỗi component, viết PascalCase, đặt tên theo thứ nó
export, với `index.tsx` mang một named export trực tiếp bằng đúng tên thư mục — hoặc bắt đầu bằng tên
đó rồi nối tiếp bằng một chữ hoa. Các biến thể có kiểu riêng của cùng một component được ở chung thư
mục vì mọi tên đều thuộc họ của thư mục: `Card`, `CardRoot`, `CardHeader`. Thứ không được ở chung là
hành khách đi nhờ: một component khác họ, khác tên, ngồi đó vì tiện.

**Cách nhận ra.** Tên thư mục là PascalCase nhưng `index.tsx` không export cái tên đó. Hai
component không họ hàng ở chung một thư mục, một cái "tiện tay để đây". Phải mở file lên mới biết
trong thư mục có gì.

**Ranh giới.** Đây không phải `FILE-2`: `FILE-1` nói về quan hệ tên ↔ export và áp cho mọi tier, còn
`FILE-2` đếm file trong thư mục màn hình. Một thư mục page có `index.tsx` khớp tên nhưng mang thêm file
thứ ba thì `FILE-1` xanh và `FILE-2` đỏ. Nó cũng không phải `FILE-4`: `FILE-1` hỏi tên đã export có
thuộc họ không, `FILE-4` hỏi nó được export ra bằng HÌNH DẠNG gì — một `export const Card = { Root,
Header }` trong thư mục `Card/` thoả `FILE-1` và vi phạm `FILE-4`.

**Tình huống nghiệp vụ hay gặp.** Đổi tên component nhưng quên đổi tên thư mục · tách một variant ra
rồi để lại tên cũ · thư mục `Card/` export `Panel` vì "trước nó tên Card" · một helper component nhỏ
được thả vào thư mục của component lớn.

## `FILE-2` — thư mục màn hình giữ đúng hai nửa

**Khi nào gặp.** Một `page`, một `layout` hoặc một `overlay` là một màn hình, và một màn hình có đúng
hai nửa: `index.tsx` là phần đấu dây — request, tình huống, chữ nghĩa — còn `component.tsx` là hình
dạng. Cộng thêm bài test sinh đôi của mỗi nửa. Hết.

**Source phải thể hiện gì.** Đúng `index.tsx` và `component.tsx` trong thư mục màn hình, kèm
`component.spec.tsx` và `index.spec.tsx` ở nơi có test. Mọi thứ khác mà shape sinh ra thì đi về tier
của nó: một row nghiệp vụ về `blocks/<category>/<Name>/`, một hàm format về `modules/utils/`, một shape
của response về `modules/types/`, một cấu hình cột về `resources/`.

**Cách nhận ra.** Trong thư mục page xuất hiện một file `.tsx` có tên riêng. Xuất hiện
`constants/`, `utils/`, `types/` hoặc một file `shapes.ts` chép tay. Ai đó vừa nói câu "chỉ mỗi page
này dùng thôi".

**Ranh giới.** Đây không phải `FILE-3`: `FILE-3` cấm bốn thư mục helper ở mọi chỗ dưới `components/`,
kể cả cạnh một block mà `FILE-2` không hề ngó tới. Một `utils/` trong thư mục page vi phạm cả hai, và
đó không phải tính hai lần — đó là hai lời khai khác nhau tình cờ gặp nhau. Nó cũng không phải
`FILE-1`, thứ chỉ xét quan hệ tên ↔ export và dửng dưng với số lượng.

Việc này luôn bắt đầu vô hại — "chỉ page này dùng thôi" — và kết thúc bằng một thư mục màn hình chứa
bốn component, một thư mục constants, một thư mục utils và ba cái resting shape chép tay; lúc đó màn
hình đã là một codebase thứ hai với từ vựng riêng mà không ai khác dùng lại được.

**Tình huống nghiệp vụ hay gặp.** Row của một bảng chỉ màn này có · badge trạng thái "chỉ dùng ở đây" ·
hàm format tiền tệ nằm cạnh page · type của response chép tay · mảng cấu hình cột · một sub-section
được tách ra cho `component.tsx` đỡ dài.

## `FILE-3` — thứ không phải component code không nằm trong cây component

**Khi nào gặp.** `constants/`, `utils/`, `types/` và `hooks/` không phải thư mục component. Mỗi thứ đó
đã có một cái nhà thật, và cái nhà đó mới là điểm chính.

**Source phải thể hiện gì.** Đích đến do bản chất quyết định, tạo ra khi dùng lần đầu: fetch →
`hooks/`; hàm thuần → `modules/utils/`; shape dùng chung → `modules/types/`; chữ nghĩa hoặc config map
→ `resources/`. Thư mục đích chưa tồn tại không phải lý do để bỏ file lại trong cây component — nó được
tạo, không đi vòng.

**Cách nhận ra.** Có một thư mục tên đúng bằng một trong bốn từ đó nằm đâu đó dưới `components/`.
Có một hàm thuần không nhận props, không render gì, nằm trong cây component. Người thứ hai vừa viết lại
đúng hàm đó ở chỗ khác.

**Ranh giới.** Đây không phải `FILE-2`: `FILE-2` đếm file trong một thư mục màn hình và không quan tâm
chúng là gì, còn `FILE-3` gọi tên bốn tên thư mục sai ở mọi chỗ dưới `components/`, cạnh bất kỳ tier
nào. `FILE-2` không bao giờ ngó vào thư mục block; `FILE-3` thì có.

Lý do là cái nhà, không phải sự gọn gàng. Để cạnh component, helper vô hình với mọi người đáng lẽ đã
dùng lại nó, nên người thứ hai viết lại nó. Rồi hai bản trôi khỏi nhau — và không có gì báo động, vì cả
hai đều "đúng" trong phạm vi của mình.

**Tình huống nghiệp vụ hay gặp.** Hàm format ngày · map mã trạng thái sang nhãn · type của một response
· hằng số số lượng mỗi trang · một `useX` chỉ để gọi API · bảng cấu hình cột.

## `FILE-4` — family export ra từng thành viên

**Khi nào gặp.** `export const Card = { Root, Header }` gói cả họ thành một đơn vị lúc build. Call site
chỉ import cái header cũng kéo cả họ vào, và không mảnh nào rơi ra được khỏi bundle.

**Source phải thể hiện gì.** Mỗi thành viên trong họ là một câu lệnh export riêng từ `index.tsx`,
mỗi tên đều thuộc họ của thư mục. Không có `export const <Capital> = { … }` chỉ chứa các thành viên
viết hoa.

**Cách nhận ra.** Một `export const` viết hoa, giá trị là object literal, các key đều viết hoa.
Call site viết `Card.Header`. Bundle to lên mà không ai giải thích được vì sao.

**Ranh giới.** Đây không phải `FILE-1`: một namespace object vẫn khớp tên thư mục, nên `FILE-1` không
bắt được nó. Hai mã nhìn hai thứ khác nhau trên cùng một dòng code.

Call site có dấu chấm là một tiện nghi, và bundler là bên trả tiền cho tiện nghi đó.

**Tình huống nghiệp vụ hay gặp.** `Card.Root` / `Card.Header` · `Table.Row` / `Table.Cell` ·
`Form.Field` / `Form.Error` · gom icon thành một object · gom variant thành một object.

## `FILE-5` — package dùng chung dừng lại ngay dưới block

**Khi nào gặp.** Trong một workspace nhiều app, đường ranh giới đi qua đúng một chỗ: giữa block và mọi
thứ dưới nó.

**Source phải thể hiện gì.** `contracts/`, `leaves/`, `composites/` và `branches/` nằm dưới
`packages/<name>/src/`; `blocks/`, `overlays/`, `layouts/` và `pages/` nằm dưới `apps/<app>/src/`,
trong đúng app sở hữu feature. Không có tier biết feature nằm trong package dùng chung, không có tier
từ vựng nằm trong một app, và không có tier wrapper song song nào được bịa ra để cưỡi lên đường ranh.

**Cách nhận ra.** `packages/*/src/` có `blocks/`, `overlays/`, `layouts/` hoặc `pages/`.
`apps/*/src/` có `contracts/`, `leaves/`, `composites/` hoặc `branches/`. Header của package tự nói
"block thuộc về app", còn cây thư mục thì nói ngược lại.

**Ranh giới.** Kích thước, độ đẹp, độ "tái sử dụng được về mặt kỹ thuật" không phải tiêu chí; tiêu chí
duy nhất là tier này có biết một feature không. Đó là lý do `FILE-5` là một mã chứ không phải một sở
thích đóng gói: leaf, composite, branch và bảng contract mô tả HÌNH DẠNG, và một hình dạng thì giống
nhau ở mọi app, còn block là một câu nói nghiệp vụ biết course, invoice hay fleet resource là gì.

Hậu quả là kép, không phải một: một block nằm sai chỗ được ship trong app không cần domain đó, và
người viết sau đọc cây thư mục rồi kết luận hợp lý rằng đường ranh nằm ở chỗ khác — nên đặt luôn một
page vào đó.

**Tình huống nghiệp vụ hay gặp.** Row nghiệp vụ đưa sang package "để dùng chung cho tiện" · một overlay
đăng nhập trong package · một `Badge` chép sang app thứ hai · một `Tree` contract chỉ có ở một app.

## `FILE-6` — route chỉ mount, và `app/` chỉ chứa route

**Khi nào gặp.** File dưới `app/` nói URL nào render page nào. Không fetch, không sắp đặt, không contract
key. Và ngược lại: `app/` không chứa thứ gì khác ngoài slot của chính framework.

**Source phải thể hiện gì.** Một file slot của framework trong segment — `page`, `layout`,
`template`, `loading`, `error`, `not-found`, `default`, `route` và anh em của chúng — mount một màn hình
sống ở `components/pages/<Name>/`. Cộng thêm `providers` và `globals.css`, hai thứ được root layout
mount và không có chỗ nào khác để đi. `app/api/**` là server code, `_folder` là cửa thoát của chính
framework, và file `.spec.` được miễn vì test không ship trong bundle nào và không route nào render nó.
**Mọi file khác ở đó là một component nằm trong thư mục không ai grep.**

**Cách nhận ra.** Route file gọi hook, đọc session, dựng cây layout. Trong `app/` có một file tên
riêng kiểu `fleet-page.tsx`. Không tìm thấy screen ở `components/pages/` dù màn đó rõ ràng đang chạy.

**Ranh giới.** Đây không phải `FILE-2`: `FILE-6` không nhìn được vào BÊN TRONG `page.tsx`. Một
`page.tsx` tự vẽ vẫn qua cửa. Việc tách hai nửa là chuyện của `FILE-2`, không phải của mã này.

Câu thứ hai của mã này từng chỉ là văn xuôi, và giá của việc đó có hồ sơ. Một page owner được viết vào
`app/<segment>/fleet-page.tsx` và đi qua build, lint, typecheck, bốn ảnh chụp niêm phong và một lần phê
duyệt, tới sát mép một lần ghi vào production với **mọi cổng đều xanh** — vì mọi cổng đều đang đọc rule,
còn cái này thì chỉ là văn xuôi.

**Tình huống nghiệp vụ hay gặp.** Route tự gọi `useSession` · route dựng shell rồi mới mount page · một
component đặt tạm trong `app/` "cho gần route" · một file `helpers.ts` trong segment.

## `FILE-7` — dấu hiệu trong source là bằng chứng, không phải một cách phân loại thứ hai

**Khi nào gặp.** Một file component tự khai tầng của nó trong source — `meta.shape`, hay bất cứ tên gì
repository đó đặt — trong khi đường dẫn của nó đã khai một tầng rồi. Hai câu nói về cùng một sự thật.

**Source phải thể hiện gì.** Không gì mới. Mã này không thêm dấu hiệu nào và cũng không đòi phải có:
một repository không khai dấu hiệu ở đâu cả thì không hỏng mã này, nó đơn giản là không có gì cho mã này
đọc. Thứ mã này chi phối là trường hợp dấu hiệu **có** tồn tại.

**Cách nhận ra.** Một file trong `blocks/` nói mình là leaf. Một thư mục được chuyển tầng mà dấu
hiệu bị bỏ lại. Một dấu hiệu đi theo một file được sao chép từ tầng khác.

**Ranh giới.** Không phải `FILE-1`: mã đó so thư mục với **tên** export. Mã này so thư mục với một lời
khẳng định mà source đưa ra về tầng — một câu khác, ở một chỗ khác.

**Vì sao một sự thật bị nói hai lần còn tệ hơn không nói.** Đường dẫn và dấu hiệu không thể bất đồng một
cách có ích. Mọi người đọc phía sau — một rule, một script, một con người — buộc phải chọn một trong hai,
và mỗi bên chọn trong im lặng, nên cùng một file là block với người này và leaf với người kia. Dấu hiệu
chỉ đáng tồn tại chừng nào nó lặp lại đúng đường dẫn; khoảnh khắc nó không còn lặp lại, nó thành cách
phân loại thứ hai mà không ai bỏ phiếu cho.

**Tình huống nghiệp vụ thường gặp.** Một component được nâng từ composite lên branch · một file được
copy ra để bắt đầu file mới · một tầng bị đổi tên cả thư mục mà một file còn giữ chữ cũ.

## `FILE-8` — không có tầng shell

**Khi nào gặp.** Một component phải bọc nội dung đã kiểm vào một cơ chế do người khác viết — dialog,
drawer, thân card của vendor — và phản xạ đầu tiên là dựng một tầng để chứa những thứ như vậy.

**Source phải thể hiện gì.** Một **branch có tên**, giữ cơ chế đóng kín bên trong và nhận nội dung hợp
đồng có kiểu đi qua biên của nó. Không gì khác đổi; từ vựng có thêm một cái tên, không phải một tầng.

**Cách nhận ra.** Một thư mục `shells/`. Một tầng mà các thành viên không chung hình dạng nào, chỉ
chung ở chỗ mỗi cái bọc một thứ gì đó. Một cái tên kết thúc bằng `Shell` cho thứ không phải một trong hai
cái mà từ vựng có.

**Ranh giới.** Không phải `FILE-5`: mã đó quyết định một tầng đứng về **phía** nào. Mã này nói tầng đó
không tồn tại để mà xếp.

**Vì sao ở đây phải là một cái tên chứ không phải một tầng.** Mọi tầng khác trả lời *cái này hình dạng
gì*. Một tầng shell trả lời *markup của ai nằm bên trong* — một câu hỏi khác — nên các thành viên của nó
không có gì chung để kiểm và không có gì để từ chối. Nó thành cái thư mục mà thứ gì cũng vào được: một
ngoại lệ không kiểu với một cái tên gọn gàng, và là chỗ duy nhất hợp đồng thôi chi phối.

**Tình huống nghiệp vụ thường gặp.** Một dialog của vendor · một drawer bọc quanh form · thân card từ một
thư viện component · bất cứ thứ gì được với tới khi một cơ chế có vẻ quá nhỏ để đáng một branch riêng.

## Tầng giữ

Tier nào thật sự giữ mỗi mã, và — ở chỗ tier hứa quá tay — chính xác thứ mà cơ chế không nhìn thấy
được. Cột cuối là phần trung thực của bảng này.

| Mã | Tier | Rule trong `@canon-fe` | Thứ rule không nhìn thấy |
|---|---|---|---|
| `FILE-1` | `enforced` | `export-matches-folder` | Thư mục có giữ MỘT component hay không. Rule chấp nhận một thư mục ngay khi MỘT export thuộc họ, nên một hành khách đi nhờ ngồi cạnh một export khớp tên vẫn qua. |
| `FILE-2` | `enforced` | `surface-folder-two-files-only` | Bên trong hai file đó. Một `component.tsx` đã phình ra bốn component trong một file thì không phải file thứ ba, nên nó qua. |
| `FILE-3` | `enforced` | `no-helper-folder-in-components` | Một helper không nằm trong thư mục. `components/blocks/billing/InvoiceRow/format.ts` là một file rời, không phải một `utils/`, và không rule đường dẫn nào gọi tên nó. |
| `FILE-4` | `enforced` | `no-runtime-namespace` | Một namespace mang tên viết thường, một object chỉ một thành viên, hoặc các thành viên được ráp bên ngoài một `export const`. Rule đòi chữ cái đầu viết hoa và ít nhất hai thành viên viết hoa. |
| `FILE-5` | `enforced` | `monorepo-tier-belongs-to-its-side` | Mọi thứ trong một cây một app. Cả hai regex đều đòi một đoạn `packages/<name>/src/` hoặc `apps/<name>/src/`, nên trong một checkout một app thì rule bất hoạt ngay từ cấu tạo. |
| `FILE-6` | `enforced` | `route-tree-holds-routes-only` | Việc vẽ. "Fetch và sắp đặt" không phải thuộc tính một rule đường dẫn đo được: một route mount một component và một route sắp đặt sáu thứ đều trả về JSX. Một `page.tsx` tự vẽ vẫn qua. |
| `FILE-7` | `enforced` | `source-tier-marker-matches-folder` | Một repository không khai dấu hiệu nào. Rule đọc dấu hiệu nếu gặp; nó không bao giờ đòi phải có, nên một cây không dùng quy ước này thì im lặng chứ không đỏ — inert theo cấu tạo, giống `FILE-5` trong checkout single-app. |
| `FILE-8` | `enforced` | `no-shell-tier` | Một branch mà mọi thứ đều là shell trừ cái thư mục của nó. Rule đọc đường dẫn, nên một cơ chế đậu trong `branches/` dưới một cái tên mơ hồ vẫn qua — đặt tên là câu hỏi của `FILE-1`. |
| `FILE-9` | `enforced` | `unit-test-colocated` | Rule thấy suffix và bucket path bị cấm; nó không chứng minh spec thật sự exercise owner kề bên. |

Cả sáu mã đều được một rule có tên giữ, nên không dòng nào ghi `documented`. Đó là tin tốt, và cũng là
toàn bộ cái bẫy của bảng này: một mã có thể `enforced` mà vẫn gần như không được giữ, vì rule đọc ĐƯỜNG
DẪN còn luật thì nói về NỘI DUNG. Cột phải là chỗ khoảng hở đó được nói ra, và nó được mang theo tiếp
chứ không bị cái chữ tier che đi.

## Điểm neo

Code thật để đối chiếu từng mã. File unit test là điểm neo chính vì nó gọi thẳng tên các mã; glob trên
cây thư mục là điểm neo phụ vì đó là nơi luật thật sự được sống.

| Mã | Điểm neo | Cần nhìn gì |
|---|---|---|
| `FILE-1` | `@canon-fe`, case `FILE-1: the path predicts the name` · `components/*/**/<Name>/index.tsx` | Một named export trực tiếp bằng đúng tên thư mục, hoặc bắt đầu bằng tên đó rồi nối tiếp bằng một chữ hoa |
| `FILE-2` | Cùng file, case `FILE-2: a surface folder holds its two halves and their twins` · `components/pages/*/` và `components/overlays/*/*/` | Mỗi thư mục liệt kê đúng `component.tsx` và `index.tsx`, cộng bản sinh đôi `.spec.tsx` ở nơi có |
| `FILE-3` | Cùng file, case `FILE-3: a helper folder under components has a real home elsewhere` · `hooks/`, `modules/utils/` | Các đích đến tồn tại và có nội dung, và tìm đệ quy các thư mục `constants`, `utils`, `types` hoặc `hooks` dưới `components/` thì không ra gì |
| `FILE-4` | Cùng file, case `FILE-4: a family is exported as members, not as one object` · mọi `index.tsx` dưới `components/` | Thành viên của họ được export mỗi câu lệnh một cái; không có `export const <Capital> = { … }` chỉ chứa các thành viên viết hoa |
| `FILE-5` | Cùng file, case `FILE-5: each tier sits on its own side of the feature line` — **chưa neo được trong code production** | Không có workspace nào có `packages/` và `apps/` để chỉ vào; bằng chứng sống duy nhất là các đường dẫn fixture của chính rule |
| `FILE-6` | Cùng file, case `FILE-6: the routing tree holds route files and nothing else` · `app/**` | Mọi tên file đều là một slot của framework, `providers`, `globals.css`, một bản sinh đôi `.spec.`, nằm dưới `api/`, hoặc nằm dưới một thư mục `_` — và không gì khác |

`FILE-5` là mã duy nhất không có điểm neo production, và nó vẫn ở lại trong luật vì cây một app là một
lát cắt thời điểm, không phải một quyết định. Nó được ghi lại như một rủi ro còn mở chứ không bị lặng lẽ
hạ cấp.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| file | Đường dẫn đang được đặt hoặc đang bị xét, chuẩn hoá bằng dấu gạch chéo xuôi |
| identity | File này LÀ gì — một màn hình, một câu nói nghiệp vụ, một shape, một fetch, một hàm thuần, chữ nghĩa |
| tier | Bản chất đó thuộc về thư mục nào trong các thư mục đã gọi tên |
| feature | Domain mà file nói thay, hoặc sự thật rằng nó không nói thay domain nào |
| workspace | Một app, hay một package dùng chung cộng nhiều app |
| exports | Các named export trực tiếp của `index.tsx`, khi thư mục đang bị xét |

## Quy tắc

1. Chỗ của một file suy ra từ nó là gì, không bao giờ suy ra từ ai đang import nó.
2. Tên thư mục và tên export dự đoán được nhau theo cả hai chiều.
3. Thư mục page, layout hoặc overlay giữ hai nửa của nó và bài test sinh đôi của chúng.
4. Thứ không phải component code không nằm trong cây component, dù nó lồng bên trong cái gì.
5. Family export ra từng thành viên; một object runtime không phải một family.
6. Tier biết feature thuộc về app; tier không biết feature thuộc về package dùng chung.
7. `app/` chỉ chứa slot của framework; một component có tên riêng ở đó là một component không ai grep.
8. Thư mục đích chưa tồn tại thì tạo, không đi vòng.
9. Mỗi mã ứng với đúng một tình huống, và không tình huống nào mang hai mã.
10. Mọi frontend unit test nằm cạnh owner và dùng `.spec.`; frontend không có cây unit hay E2E tách riêng.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp vào.

- **Test sinh đôi.** `FILE-2` cho phép `component.spec.tsx` và `index.spec.tsx` trong thư mục màn hình —
  chúng là bản sinh đôi của hai nửa, không phải thứ thứ ba.
- **Test của route.** `FILE-6` miễn mọi file `.spec.` dưới `app/`. Test không ship trong bundle nào và
  không route nào render nó, nên nó không thể trở thành cái "page thứ hai" mà mã này sinh ra để chặn.
  Tên của nó cố ý không bị bắt phải khớp `page` hay `layout`: test của một route tách theo MỐI QUAN TÂM,
  và ép tất cả vào một file chỉ đổi lấy một file dài hơn.
- **Server code và cửa thoát của framework.** `FILE-6` miễn `app/api/**` và mọi `_folder`. Không cái nào
  là một màn hình.
- **Hai thứ không phải slot nhưng được nhận.** `providers` và `globals.css` ở dưới `app/` vì root layout
  mount chúng và chúng không có chỗ nào khác để đi.
- **Biến thể cùng họ.** `FILE-1` cho phép nhiều export trong một thư mục khi mọi tên đều thuộc họ của
  thư mục. Một component và các biến thể của nó là một component; một hành khách đi nhờ thì không.
- **Cây candidate.** Một candidate dưới `.artifacts/**/candidate/` được phép soi theo bất kỳ hình dạng
  workspace nào, và `FILE-5` đọc cái nào nó tìm thấy.
- **Thứ tự áp dụng.** `export-matches-folder` là rule đáng bật ở mức `warn` trước trong một cây có sẵn:
  nó nổ ở mọi thư mục có quy ước ra đời trước rule, và con số đó là một cuộc di cư chứ không phải một
  đống lỗi. Mức nghiêm khắc thật do config của repository tiêu thụ quyết định.

## Đầu ra

Mỗi file mà shape sinh ra là một khối.

```text
file: <path being placed>
identity: <what it is, independent of who calls it>
tier: <contracts | leaves | composites | branches | blocks | overlays | layouts | pages | route | hooks | modules | resources>
situation: <FILE-1 | FILE-2 | FILE-3 | FILE-4 | FILE-5 | FILE-6 | FILE-7 | FILE-8 | FILE-9>
destination: <the path it belongs at>
reason: <the fact about the file that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một màn hình Fleet Resources ở `/fleet` liệt kê các fleet resource thành từng row,
mỗi row có một badge trạng thái và một khoản chi phí hàng tháng hiển thị dưới dạng tiền tệ; màn hình
được duyệt trong một cây một app.

Shape nói mỗi thứ LÀ gì và nói thay cho domain nào. Nó không nói đường dẫn, tên thư mục, danh sách
export, tier hay tên file route, và nó cũng không giải quyết những thứ đó — chúng suy ra từ các bản chất
dưới đây, không suy ra từ shape và cũng không suy ra từ việc hôm nay chỉ đúng một màn hình dùng cái row.

```text
file: src/components/pages/FleetResources/component.tsx
identity: the shape half of one screen
tier: pages
situation: FILE-2
destination: src/components/pages/FleetResources/component.tsx
reason: it is the shape half of a surface folder, so the folder may hold it and index.tsx and their twins and nothing else; FILE-3 does not apply because it renders
```

```text
file: src/components/pages/FleetResources/index.tsx
identity: the wiring half of one screen - request, situation, copy
tier: pages
situation: FILE-1
destination: src/components/pages/FleetResources/index.tsx
reason: it carries a direct named export FleetResources equal to the folder name; this is the name-to-export claim, not the file count claim FILE-2 makes
```

```text
file: src/components/blocks/fleet/FleetRow.tsx
identity: a domain sentence - it knows what a fleet resource is
tier: blocks
situation: FILE-2
destination: src/components/blocks/fleet/FleetRow/index.tsx
reason: it is a third thing in the screen folder if left there, and it knows a feature, so it is grouped under a category; FILE-3 does not apply because it renders
```

```text
file: src/components/pages/FleetResources/StatusBadge.tsx
identity: a shape that knows no feature - a label with a state
tier: leaves
situation: FILE-1
destination: src/components/leaves/StatusBadge/index.tsx
reason: it is a passenger in another component's folder, not a typed variant of that folder's family, and it names no feature so it is flat with no category
```

```text
file: src/components/pages/FleetResources/utils/formatCurrency.ts
identity: a pure function - renders nothing, takes no props
tier: modules
situation: FILE-3
destination: src/modules/utils/formatCurrency.ts
reason: it is a helper folder name under components/, wrong beside any tier - FILE-2 also fires here on the count, and the two refusals are different claims that happen to meet
```

```text
file: src/app/fleet/page.tsx
identity: the route entry - which page renders at which URL
tier: route
situation: FILE-6
destination: src/app/fleet/page.tsx
reason: it is one of the framework's own slots and it mounts FleetResources rather than drawing; FILE-2 does not apply because this code cannot see inside page.tsx
```

`FILE-4` không được chạm tới: shape này không sinh ra family component nào, nên không có hình dạng
export nào đang bị hỏi. `FILE-5` cũng không được chạm tới: cây là một app, và các regex của rule đòi một
đoạn `packages/<name>/src/` hoặc `apps/<name>/src/`, nên ở đây nó bất hoạt ngay từ cấu tạo.

## Phạm vi

Module này phát biểu một luật đúng với bất kỳ front end nào có một cây component và một cây routing dựa
trên file. Nó không gọi tên sản phẩm nào, thư viện component nào, registry key nào hay repository nào.
Mọi ví dụ đều là TSX thường và tên thư mục thường.
