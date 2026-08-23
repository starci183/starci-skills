---
title: Lint-escape-hatch · Vietnamese
---

# Cửa thoát lint

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | bộ máy frontend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt — một component, một block config, một rule mà repo đã quyết định
ship. Kết quả là kiến trúc source: file nào giữ rule, config bật rule đó còn phải mang theo cái gì, ca
hợp lệ được ghi ở đâu, và file đang bị báo lỗi được phép nói gì về chính nó. Pattern này không mở lại
câu hỏi rule đúng hay sai. Nó hạ quyết định đã có xuống source, và câu duy nhất nó trả lời là từng
phần của quyết định ấy nằm ở đâu.

## Luật

Escape hatch là đoạn text trong source làm đổi tập luật đang áp cho chính file chứa nó:
`eslint-disable`, các biến thể theo dòng, và `eslint-enable`. Nó biến một luật của cả repo thành một
lựa chọn cục bộ, nên người viết ra vi phạm cũng là người quyết định đó có phải vi phạm hay không.

Chính sự đảo ngược đó là toàn bộ chủ đề. Mọi thuộc tính khác của một directive — hẹp tới đâu, chỉ đích
danh rule nào, lý do viết bên cạnh hay tới mức nào — đều chỉ nói về **hình dạng** của cái bypass.
Không cái nào đổi được **ai đã quyết**. Rule là chính sách của repo ở mức `error`; file không phải một
bên trong quyết định đó, và một file trả lời được câu hỏi ấy thì không còn đang bị cai quản, nó đang
mặc cả.

> Đoạn text này có cho phép một file tự quyết rule có áp cho nó hay không?

**Đây là luật bắt buộc, không phải lời khuyên.** Không có kích thước bypass nào nhỏ tới mức chỉ còn là
một ghi chú thay vì một quyết định, và không có lý do nào tốt tới mức biến cái này thành cái kia. Rule
sai thì sửa ở matcher hoặc sửa kiến trúc, cho tất cả mọi người, trong một diff review được — đúng cái
sửa mà directive đang né.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `LINT-ESCAPE-<n>`. Mã đặt tên cho TÌNH HUỐNG; các
cột nói tình huống đó là gì và source phải trông ra sao sau khi nó được giải.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `LINT-ESCAPE-1` | Một file sản phẩm gặp rule chặn nó | Source sản phẩm không chứa directive inline nào của ESLint — không `eslint-disable`, không `-next-line`, không `-line`, không `eslint-enable`. Nó cấm một file tự hạ, tự treo hay tự khôi phục chính sách repo cho riêng mình, và cấm một bypass được bào chữa bằng lý do viết bên cạnh |
| `LINT-ESCAPE-2` | Rule đã được bật, nhưng config đã resolve vẫn honour inline config | Chính flat config bật rule cũng phải áp `linterOptions.noInlineConfig`, để cái nỗ lực đó vừa bị báo cáo vừa vô hiệu. Nó cấm một hàng rào mà directive nằm trong chính file bị báo lỗi tắt được |
| `LINT-ESCAPE-3` | Áp lực rời khỏi file và chuyển vào config | Ca hợp lệ được nêu ở config dùng chung hoặc ở một type đóng, và nợ được trả trước khi merge. Nó cấm allowlist theo đường dẫn, thư mục, vendor hay component, và cấm rule kiến trúc ở mức cảnh báo |

`LINT-ESCAPE-1` và `LINT-ESCAPE-2` là hai nửa của cùng một hàng rào và không cái nào thay được cái
kia: một cái giải thích vì sao hỏng, cái kia bảo đảm directive không tự bịt miệng được người canh nó.
Repo chỉ giữ cái thứ nhất thì đang báo cáo một cú bypass đã thành công.

Cách đánh số là cố định và được trích dẫn từ bên ngoài module này. Một mã không bao giờ được đánh số
lại để lấp một khoảng trống trong dãy.

## Đọc một shape đã duyệt

1. Đọc cái shape nói ra. Nó nói rằng có một rule, rule đó ship ở mức nào, và repo lint những cây source
   nào. Đó là những sự thật đã chốt; pattern này không xét lại.
2. Đọc cái shape **không** nói, vì đó chính là cái nó không giải. Một shape gọi tên một rule không nói
   `linterOptions` đã resolve có tới được block config bật rule đó hay chưa, và cũng không nói có block
   nào sau đó thu hẹp tầm với của rule hay không. Không cái nào được quyết ở đây bằng phỏng đoán — mỗi
   cái là một mã riêng với bằng chứng riêng.
3. Giải từ ngoài vào trong. Config quyết định rule có chạy hay không **trước khi** rule chạy, nên hãy
   chốt `LINT-ESCAPE-3` và `LINT-ESCAPE-2` — tầm với và options của config đã resolve — rồi mới xét
   text comment bên trong file theo `LINT-ESCAPE-1`.
4. Hỏi lần lượt câu hỏi của từng mã. Với `LINT-ESCAPE-1`: nếu xoá comment này đi, code có đỏ không? Với
   `LINT-ESCAPE-2`: một comment đặt đúng chỗ có tắt được chính rule đang báo lỗi dòng đó không? Với
   `LINT-ESCAPE-3`: cái tôi sắp thêm vào config nói lên một **ca**, hay nói lên một **cái tên**?
5. Khi hai mã cùng khớp thì chúng không tranh nhau — cả hai đều đang mở và cả hai đều phải được giải.
   `LINT-ESCAPE-1` là text nằm trong source; `LINT-ESCAPE-2` là điều kiện của config làm text đó vô
   hiệu. Xoá hết directive mà config vẫn cho phép inline thì mã 1 xanh và hàng rào vẫn chưa dựng.
   `LINT-ESCAPE-1` là một file tự miễn trừ cho mình; `LINT-ESCAPE-3` là cả repo tạo sẵn một chỗ miễn
   trừ để không ai phải tự viết directive nữa — mã 3 nguy hiểm hơn vì nó không để lại dấu vết trong
   file nào cả.

## `LINT-ESCAPE-1` — source sản phẩm không chứa directive

**Khi nào gặp.** Một file gặp rule chặn nó. Cách rẻ nhất là viết một dòng comment cho rule đó im lặng —
và cách đó luôn hoạt động, nên nó là cách hay được chọn nhất. Cái nó đổi không phải một dòng code: nó
chuyển quyền phán quyết từ repo về đúng file vừa vi phạm. Điều làm mã này khó nhìn ra là nó *trông
giống một hành động kỹ thuật* trong khi nó là một hành động quản trị. Hai người review một PR có
`eslint-disable-next-line` sẽ bàn xem lý do bên cạnh có hợp lý không. Câu hỏi thật thì không nằm ở đó:
từ giây phút dòng đó tồn tại, không còn ai ngoài file đó trả lời được câu "rule này có áp cho đây
không".

**Source phải thể hiện gì.** Một rule duy nhất được publish, `no-inline-lint-config`, nằm ở
`@canon-fe`. Nó duyệt mọi comment trong một file sản phẩm bằng visitor
`Program()` đi qua `getAllComments()` thay vì match text nguồn, và báo bất kỳ comment nào có phần thân
mở đầu bằng một directive. Pattern là `INLINE_DIRECTIVE`, được neo ở đầu thân comment. `isProductSource`
là điều kiện đường dẫn duy nhất trong file đó. Twin test ở `@canon-fe` mang
các ca hợp lệ giữ cho prose nói về directive vẫn viết được, kèm comment giải thích vì sao pattern được
neo và bản không neo đã phải trả giá gì. Còn source sản phẩm thì không sinh ra gì cả: không một
directive nào, dưới bất kỳ dạng nào.

**Cách nhận ra.** Một comment mở đầu bằng `eslint-disable`, `eslint-disable-next-line`,
`eslint-disable-line` hoặc `eslint-enable` trong file đang ship. Có `eslint-disable` ở đầu file — cả
file ra khỏi luật, và người đọc tiếp theo không biết mình đang đọc dưới tập luật nào. Có cặp
`eslint-disable` … `eslint-enable` ôm một khối, tức là ai đó đã *thiết kế* một vùng miễn trừ chứ không
phải lỡ tay. Bên cạnh directive là một lý do viết rất kỹ: lý do càng kỹ càng đáng ngờ, vì nó là bằng
chứng người viết biết rõ mình đang đi vòng. Có người nói "chỉ một dòng thôi", "tạm để đó rồi sửa sau",
"để merge kịp demo".

**Ranh giới.** Đây không phải `LINT-ESCAPE-2`: mã 1 nói về text nằm trong source, mã 2 nói về điều kiện
của config làm text đó vô hiệu — xoá hết directive mà config vẫn cho phép inline thì mã 1 xanh trong
khi hàng rào vẫn chưa dựng. Đây cũng không phải `LINT-ESCAPE-3`: mã 1 là một file tự miễn trừ cho
mình, mã 3 là cả repo tạo sẵn chỗ miễn trừ để không ai phải viết directive, và mã 3 nguy hiểm hơn vì
không để lại dấu vết trong file nào. Và nó không phải prose về directive: một comment giải thích *vì
sao file này không có* `eslint-disable` là hợp lệ, bởi directive được đọc từ ký tự không-trắng đầu tiên
của comment, còn nhắc tới cái tên ở giữa câu thì không phải là ra lệnh.

**Tình huống nghiệp vụ hay gặp.** Cú pháp khai báo cho một thư viện bên ngoài · một `any` để qua cho
kịp · cảnh báo dependency của hook · một `console` trong nhánh debug · file trông như generated · một
component "sẽ viết lại tuần sau" · một migration đang dở · một PR hotfix lúc nửa đêm.

## `LINT-ESCAPE-2` — config đã resolve làm directive vô hiệu

**Khi nào gặp.** Một rule báo cáo directive là **chưa đủ**. Nếu config vẫn honour inline config thì
directive đó vẫn có tác dụng — kể cả khi nó nhắm vào chính rule đang canh nó. Lúc ấy hàng rào có một
cái cửa, và chìa khoá nằm trong tay người muốn đi qua. Vì thế mã 2 không phải một tuỳ chọn "chặt hơn".
Nó là thứ đổi kết quả từ *bị coi là sai* sang *không xảy ra*. Cần cả hai: mã 1 giải thích vì sao hỏng,
mã 2 bảo đảm directive không tự bịt miệng được người canh nó.

**Source phải thể hiện gì.** `linterOptions` trong `@canon-fe`, được freeze
và export ngay cạnh `rules` để hai thứ không thể bị gắn tách rời do sơ ý, rồi được re-export từ plugin
tổng `@canon-fe` để một config tiêu thụ lấy chúng từ đúng import đã lấy rules. Ca thứ
hai của twin test sinh ra bằng chứng: một linter thật, options đã freeze được áp vào, một disable gọi
đích danh chính người canh, và assertion rằng người canh vẫn báo ở severity `2`. Mã này được giữ ở
tầng `documented`, không phải `enforced`: chưa có gì kiểm tra config tiêu thụ đã spread options thật
hay chưa. Có thể đọc `refusesInlineConfig` từ effective config đã in, nhưng cây này không ship script
đo giá trị ấy trên một repo thật. Repo tiêu thụ vì vậy vẫn phải tự cung cấp bằng chứng đó.

**Cách nhận ra.** Config gắn `plugins` và `rules` nhưng không thấy `linterOptions` đâu.
`linterOptions` có ở block đầu, rồi một block sau ghi đè mất — flat config lấy block sau, và không ai
để ý vì rule vẫn còn nguyên trong danh sách. Rule và linter options được import từ hai chỗ khác nhau,
nên có thể gắn cái này mà quên cái kia. Một PR thêm `eslint-disable <tên-rule-canh-directive>` và CI
vẫn xanh. Có người trả lời "đã bật rule rồi mà" khi được hỏi directive còn tác dụng không.

**Ranh giới.** Đây không phải `LINT-ESCAPE-1`, vốn là text nằm trong source chứ không phải điều kiện
của config. Và đây cũng không phải luật `lint-adoption`: mã 2 nói **artifact phải publish** linter
options và chúng phải rời canon cùng với rule. Việc **đo xem một repo cụ thể đã nhận được chưa** là mã
`LINT-ADOPTION-4` của module kia, đọc ra từ `refusesInlineConfig` của config đã in. Hai mã nhìn cùng
một giá trị từ hai phía: bên xuất bản và bên tiêu thụ. `LINT-ESCAPE-2` đã neo được cho phần artifact
PUBLISH và **chưa neo được** cho phần một repo tiêu thụ RESOLVE: không file nào trong module này quan
sát được options đã tới hay chưa.

**Tình huống nghiệp vụ hay gặp.** Repo mới wiring lần đầu · thêm một block config cho thư mục test ·
gộp hai file config lại · nâng ESLint lên major mới · copy một block config từ một dự án khác sang ·
ai đó thêm `linterOptions` của riêng họ cho một glob hẹp.

## `LINT-ESCAPE-3` — không có allowlist

**Khi nào gặp.** Khi directive bị chặn, áp lực không biến mất — nó chuyển chỗ. Chỗ tiếp theo là
**config**: xin một đường dẫn được miễn, một thư mục được `ignores`, một rule được hạ xuống `warn`
"trong lúc chuyển đổi". Kết quả giống hệt mã 1, chỉ khác là nó không để lại dấu vết trong file nào, nên
không ai đọc code mà thấy được. Component mỏng, ranh giới vendor, file khai báo, file trông như
generated, việc migration tạm thời — không cái nào **kiếm được** một suất miễn trừ cục bộ. Cú pháp hợp
lệ thì được nêu ra **một lần** ở config dùng chung hoặc ở một type đóng, nơi mọi call site thừa hưởng
và người review nhìn thấy. Nợ thì trả trước khi merge, không giấu bên cạnh chỗ nó phát sinh. Rule kiến
trúc ở mức `warn` là cùng một chuyện kể theo cách khác: vi phạm mới vẫn merge được trong khi trông như
đã có người cai quản. Kiến trúc yếu hơn luôn là cái thắng, vì nó là cái không chặn ai.

**Source phải thể hiện gì.** `schema: []` trong phần meta của rule ở
`@canon-fe`, đóng rule lại trước mọi option nên không allowlist nào cấu hình
*vào trong* rule được, và `recommended` publish đúng một entry ở đúng một mức, không có key đường dẫn —
không còn field nào để viết một suất miễn trừ vào. Trong `@canon-fe`, `recommended` được gom
từ mọi module mà không module nào có quyền tự quyết mức, và một rule đã publish không bao giờ bị đổi
tên; đó là hai chỗ mà một carve-out theo đường dẫn hay theo tên buộc phải trú. Một ca hợp lệ thì sinh
ra một bổ sung vào matcher dùng chung hoặc một type đóng, kèm twin test, chứ không bao giờ là một suất
miễn trừ theo file. Mã này được giữ ở tầng `documented`: `schema: []` đóng rule trước option, còn một
allowlist dựng *bao quanh* rule bằng một block config đứng sau thì không có gì giữ cả.

**Cách nhận ra.** Trong config có một `files`/`ignores` mang tên đúng một component hoặc đúng một
thư mục. Có block config đứng sau hạ mức một rule cho một glob "legacy" hoặc "tạm". Rule kiến trúc được
mô tả là "đang rollout, tuần này để `warn`". Có ai đó đề nghị thêm option cho rule để rule tự bỏ qua
một danh sách đường dẫn. Một finding kiến trúc được xử lý bằng cách đổi phạm vi rule thay vì sửa ranh
giới mà nó phát hiện. Có glob bị thu hẹp lại đúng bằng chỗ vừa đỏ.

**Ranh giới.** Đây không phải `LINT-ESCAPE-1`, vốn là một file tự miễn trừ và để lại dấu vết trong
source. Đây cũng không phải glob của chính repo: repo vẫn sở hữu việc luật áp lên cây source nào — một
monorepo và một single-app không cùng một hình dạng thư mục — và điều đó không mở gì cho một file **nằm
trong** vùng đã cai trị. Và đây cũng không phải việc sửa rule: nói ra một ca hợp lệ trong matcher dùng
chung là **sửa luật**, và được review như sửa luật. Đó là đường thoát hợp lệ duy nhất, và nó cố ý đắt
hơn một dòng comment. `LINT-ESCAPE-3` đã neo được trước một allowlist cấu hình vào trong rule và **chưa
neo được** trước một allowlist dựng bao quanh nó — một `ignores` đứng sau, một block override, một glob
bị bẻ hẹp bằng tay.

**Tình huống nghiệp vụ hay gặp.** Một component mỏng bị rule kiến trúc bắt · thư mục sinh ra bởi
codegen · file `.d.ts` khai báo cho thư viện ngoài · một cây source đang migrate dở · một rule mới làm
đỏ 40 file cùng lúc · deadline · ai đó muốn "bật dần cho êm".

## Tầng giữ

Tầng nào thực sự giữ từng mã — `unrepresentable` (một union đóng hoặc branded type khiến giá trị sai
không viết ra được), `enforced` (một lint rule từ `@canon-fe` bắt được, nêu đích
danh ở đây), hay `documented` (không có gì cơ học giữ; chỉ có người đọc giữ).

| Mã | Tầng | Cái thực sự giữ nó |
|---|---|---|
| `LINT-ESCAPE-1` | `enforced` | `no-inline-lint-config`, rule duy nhất module này publish: nó duyệt mọi comment trong một file sản phẩm và báo bất kỳ comment nào có thân mở đầu bằng một directive |
| `LINT-ESCAPE-2` | `documented` | Export `linterOptions` đã freeze, cộng với twin test chạy một linter thật và chứng kiến một disable nhắm vào người canh không ăn được — nhưng không có gì kiểm tra rằng một config tiêu thụ thực sự đã spread nó vào. Cái kiểm tra được điều đó, `refusesInlineConfig`, thuộc module `lint-adoption` và là một script |
| `LINT-ESCAPE-3` | `documented` | `schema: []` trên rule, đóng rule trước mọi option nên không allowlist nào cấu hình *vào trong* rule được — và không có gì cả cho một allowlist dựng *bao quanh* rule bằng một block config đứng sau |

Một hàng là `enforced` và hai hàng là `documented`, và sự chia đôi đó không phải tai nạn của công sức.
Mã duy nhất mà một ESLint rule giữ được là mã có bằng chứng nằm ngay trong text của file. Hai mã còn
lại là sự thật về config đã resolve: một option có được set hay không, một block sau có gỡ một đường
dẫn ra khỏi tầm với của rule hay không. Rule chạy *bên trong* config đó, sau khi config đã quyết
xong rule có chạy hay không — nên rule về cấu trúc là công cụ sai, và kiểu hỏng của nó là im lặng, bởi
một rule bị tắt cho một thư mục thì không báo gì và thư mục đó lint sạch. Ghi `enforced` lên hai hàng
ấy là đặt câu trả lời dễ chịu vào đúng cái cột sinh ra để mang câu trả lời khó chịu.

## Điểm neo

Một luật không chỉ được vào code thật thì chỉ là một đề xuất. Mỗi mã một hàng, kèm đường dẫn và cái cần
tìm ở đó.

| Mã | Đường dẫn | Cần tìm gì ở đó |
|---|---|---|
| `LINT-ESCAPE-1` | `@canon-fe` | `INLINE_DIRECTIVE`, neo ở đầu thân comment; visitor `Program()` đi qua `getAllComments()` thay vì match text nguồn; và `isProductSource`, điều kiện đường dẫn duy nhất trong file |
| `LINT-ESCAPE-2` | `@canon-fe` | `linterOptions`, được freeze và export ngay cạnh `rules` để hai thứ không thể bị gắn tách rời do sơ ý. **Neo một phần** — xem dưới |
| `LINT-ESCAPE-3` | `@canon-fe` | `schema: []` trong meta của rule, và `recommended` publish đúng một entry ở đúng một mức, không có key đường dẫn — không còn field nào để viết một suất miễn trừ vào. **Neo một phần** — xem dưới |

Bằng chứng phụ, dùng khi neo chính đang bị sửa:

- `LINT-ESCAPE-1` — `@canon-fe`: các ca hợp lệ giữ cho prose nói về một
  directive vẫn viết được, kèm comment giải thích vì sao pattern được neo và bản không neo đã phải trả
  giá gì.
- `LINT-ESCAPE-2` — ca thứ hai của chính twin test đó: một linter thật, options đã freeze được áp vào,
  một disable gọi đích danh người canh, và assertion rằng người canh vẫn báo ở severity `2`.
- `LINT-ESCAPE-2` — `@canon-fe`: options được re-export từ plugin tổng, để một config tiêu
  thụ lấy chúng từ đúng import đã lấy rules.
- `LINT-ESCAPE-2` — effective config đã in: phải giữ lại giá trị `refusesInlineConfig`. Hiện chưa có
  script nào trong cây này đo nó trên một repo thật.
- `LINT-ESCAPE-3` — `@canon-fe`: `recommended` được gom từ mọi module mà không module nào có
  quyền tự quyết mức, và việc từ chối đổi tên một rule đã publish — hai chỗ mà một carve-out theo đường
  dẫn hay theo tên buộc phải trú.

`LINT-ESCAPE-2` đã neo được cho phần artifact PUBLISH và **chưa neo được** cho phần một repo tiêu thụ
RESOLVE: không file nào trong module này quan sát được options đã tới hay chưa. `LINT-ESCAPE-3` đã neo
được trước một allowlist cấu hình vào trong rule và **chưa neo được** trước một allowlist dựng bao
quanh nó — một `ignores` đứng sau, một block override, một glob bị bẻ hẹp bằng tay. Cả hai đều được ghi
lại như rủi ro còn mở.

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| file | Đường dẫn file đang bị phán, và nó là source sản phẩm hay là fixture |
| comments | Thân các comment, đọc từ ký tự không-trắng đầu tiên, không phải text nguồn |
| config | `linterOptions` đã resolve, và mọi block đứng sau chạm vào chúng hoặc chạm vào tầm với của rule |
| case | Cú pháp hoặc tình huống mà cái bypass đang bảo vệ, nêu ra như một ca chứ không như một file |
| severity | Mức mà rule resolve ra |

## Quy tắc

1. Escape hatch là text làm đổi tập luật đang áp cho chính file chứa nó.
2. Rule là chính sách của repo; file bị nó báo lỗi không phải một bên trong quyết định. Source sản phẩm
   không chứa directive inline nào của ESLint.
3. Báo cáo và vô hiệu hoá là **hai** nghĩa vụ, không phải một; thiếu một cái thì không có hàng rào.
4. Lý do viết bên cạnh một bypass chỉ ghi lại nó, không bao giờ cho phép nó.
5. Directive được đọc từ ký tự không-trắng đầu tiên của comment và không ở đâu khác, nên prose nhắc tới
   directive không phải directive.
6. Ca hợp lệ được nêu ở config dùng chung hoặc ở một type đóng, không bao giờ ở một suất miễn trừ theo
   file.
7. Rule kiến trúc ship ở mức `error` kèm twin test, hoặc không ship.
8. Nợ được trả trước khi merge, không được giấu bên cạnh.
9. Sửa một rule sai là sửa cho tất cả mọi người, ngay trong rule; nó không bao giờ là một cú treo cục
   bộ.
10. Thiếu lint rule cho một mã là một khoảng trống **được ghi ra**, không bao giờ là lý do hạ mã đó
    xuống.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
vào.

- **Prose về directive.** Thuộc `LINT-ESCAPE-1`. Mã này cai quản directive, không cai quản cái từ.
  Comment giải thích vì sao file này không có `eslint-disable` là comment hữu ích nhất về chủ đề này mà
  một file có thể mang, và pattern được neo đúng để câu đó vẫn viết được. Bắt hụt không phải cái giá
  phải trả: một directive mà linter nghe theo luôn nằm ở đầu comment.
- **Fixture dựng ra chuỗi cấm.** Thuộc `LINT-ESCAPE-1`. Twin test của rule cố ý dựng directive. Fixture
  là cái chuỗi, không phải hành động; và chính path gate của rule là thứ giữ được sự phân định đó mà
  không cần tới một directive để nói ra.
- **Glob là *ở đâu*, không phải *cho ai*.** Thuộc `LINT-ESCAPE-3`, mã từ chối allowlist. Repo lint
  những cây source nào vẫn là sự thật của chính repo — một monorepo và một single-app không cùng một
  hình dạng thư mục. Điều đó không mở gì cho một file nằm trong vùng đã cai trị, và một glob bị bẻ cong
  đúng bằng chỗ vừa đỏ là allowlist mặc áo config.
- **Config dùng chung sở hữu cú pháp hợp lệ.** Thuộc `LINT-ESCAPE-3`. Khai báo cho thư viện ngoài, hình
  dạng do codegen sinh ra, ràng buộc của nền tảng — đều có thể hợp lệ. Mã này đòi cái hợp lệ ấy phải
  được nêu một lần, như một ca ngữ nghĩa trong matcher dùng chung hoặc trong một type đóng, nơi mọi call
  site thừa hưởng và người review nhìn thấy. Nói ở đúng file cần nó là bypass đổi tên.
- **Sửa rule không phải miễn trừ.** Thuộc cả ba mã. Rule sai thì matcher hoặc kiến trúc được sửa. Bản
  sửa hạ xuống artifact dùng chung kèm twin test, không nằm cạnh chỗ vi phạm — và nó được review như
  một thay đổi luật, vì nó đúng là như vậy. Nó cố ý đắt hơn một dòng comment.

## Đầu ra

Mỗi file mà shape sinh ra thì một block.

```text
file: <path judged, product source or fixture>
directive: <the comment body, or none>
situation: <LINT-ESCAPE-1 | LINT-ESCAPE-2 | LINT-ESCAPE-3>
holder: <enforced | documented>
verdict: <legal | stop>
repair: <shared rule | closed type | shared config | architecture>
```

## Ví dụ đã giải

Shape đã duyệt: một repo đã quyết định ship một rule kiến trúc ở mức `error`, và một component sản phẩm
mỏng không qua được rule đó, nên component mang `/* eslint-disable-next-line */` kèm một lý do viết rất
kỹ bên cạnh, trong khi flat config gắn `plugins` và `rules` từ import của plugin.

```text
file: src/components/thin-card.tsx
directive: eslint-disable-next-line
situation: LINT-ESCAPE-1
holder: enforced
verdict: stop
repair: shared rule
```

Sự thật loại `LINT-ESCAPE-3` ra ở đây là suất miễn trừ được viết ngay trong file sản phẩm, để lại dấu
vết trong source; còn mã 3 là repo dựng sẵn một suất miễn trừ trong config, thứ không để lại dấu vết
trong file nào. Lý do viết bên cạnh directive chỉ ghi lại nó chứ không cho phép nó, nên nó không đổi gì
trong phán quyết này.

```text
file: eslint.config.mjs
directive: none
situation: LINT-ESCAPE-2
holder: documented
verdict: stop
repair: shared config
```

Sự thật loại `LINT-ESCAPE-1` ra là ở đây không có thân comment nào dính vào cả: phát hiện này là một
điều kiện của config đã resolve — `linterOptions.noInlineConfig` vắng mặt trong đúng block đã bật rule
— nên một directive nhắm vào chính người canh vẫn sẽ ăn. Xoá directive trong component sẽ khiến mã 1
xanh trong khi hàng rào này vẫn chưa dựng.

Cái shape không nói ra, và vì thế không giải: nó không nói có block config nào đứng sau thu hẹp tầm với
của rule hay hạ mức rule cho một glob hay không, nên `LINT-ESCAPE-3` không được shape này giải và phải
đọc ra từ config đã resolve. Nó cũng không nói một repo tiêu thụ có thực sự spread options đã publish
vào hay chưa — không gì trong module này quan sát được điều đó, và cái kiểm tra được, `refusesInlineConfig`,
thuộc về module `lint-adoption`.

## Phạm vi

Luật này đúng với mọi front end có lint, với mọi đoạn code cùng loại trong stack này. Nó không gọi tên
sản phẩm nào, thư viện component nào, repo nào, và không gọi tên một feature đơn lẻ nào. Mọi ví dụ đều
là flat config thường và TSX thường; namespace plugin trong ví dụ chỉ là chỗ điền tạm, và luật không
đổi khi nó được viết khác đi.
