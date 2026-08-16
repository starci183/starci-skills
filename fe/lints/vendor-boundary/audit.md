---
id: fe-lints-vendor-boundary-audit
title: audit.md
slug: /fe/lints/vendor-boundary/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thi hành — rule nào giữ được mã nào, và luật còn hở ở đâu.
---

# audit.md

> Version: `2.00` · Mô-đun: `vendor-boundary`

Phản biện này không hỏi luật có đúng không. Nó hỏi **máy nhìn thấy được bao nhiêu phần của luật**, và
phần không nhìn thấy có được ghi ra hay không.

## Verdict

Chấp nhận, kèm bảy nhận định và một danh sách cửa mở dài.

Nguồn công bố **10 rule**. Đếm được đúng 10 trong `rules`, khớp con số dự kiến. Cả 10 đều ánh xạ
được vào một mã `VENDOR-<n>` có thật trong văn bản luật; không rule nào phải bịa mã. Một rule
(`vendor-boundary`) giữ **hai** mã.

Chiều ngược lại thì hụt: văn bản luật có 14 mã, kệ này giữ 11. `VENDOR-5` là uỷ quyền có chủ ý cho
mô-đun biểu tượng, không tính là hở. `VENDOR-3` và `VENDOR-4` **không có rule nào** — ghi ở "Rủi ro
còn mở", không được vá bằng một ánh xạ tưởng tượng.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Mọi rule có tên công bố duy nhất? | Có. Mười khoá trong `rules`, không trùng, dùng nguyên văn làm tiêu đề mục |
| Có rule nào giữ một mã luật không tồn tại? | Không |
| Có mã luật nào bị hai rule cùng giữ? | Không. Mỗi mã có đúng một rule, trừ `VENDOR-1`/`VENDOR-2` chung một rule |
| Mỗi rule có ít nhất một cửa mở trung thực? | Có. Không rule nào ghi "không có" |
| Cửa mở nào là do **cách viết**, cửa nào do **phạm vi**? | Cách viết: hằng số, biểu thức, alias, re-export. Phạm vi: cổng tên file, cổng thư mục, đường dẫn import tương đối |
| Phát hiện theo tên hay theo đường dẫn? | Chín rule theo đường dẫn; `auth-overlay-owns-single-content-host` cố ý theo **tên được import**, và nguồn ghi rõ vì sao |
| Có rule nào nổ **oan** không? | Có, năm chỗ — ghi ở Findings. Nổ oan không phải hở, nhưng là chi phí nuôi rule |
| Nhận diện thư viện ngoài có nhất quán không? | **Không.** Một rule dùng tiền tố, ba rule dùng so bằng chính xác |

## Findings

**F1 · Danh sách vỏ không khớp văn bản luật.** Rule nhận **bốn** vỏ; `VENDOR-2` viết **ba**. Vỏ thứ
tư là vỏ của framework, và rule cho nó một ngoại lệ riêng ở phép kiểm rỗng vì nó không import thư
viện nào. Chính thông điệp `unknownShell` tự thú chuyện này: nó nói việc danh sách lệch với luật là
một **lỗi cổng**, và kể rằng thông điệp từng nêu hai tên trong khi cây có ba. Nay cây có bốn.
Hướng sửa thuộc về văn bản luật, không thuộc rule: rule mô tả cái đang chạy.

**F2 · Thông điệp `outside` liệt kê thiếu chủ sở hữu.** Nó nêu lá, hai vỏ và họ nhánh bề mặt, trong
khi mã cho phép lá, **bốn** vỏ và bốn nhánh. Một người đọc thông điệp rồi đi tìm chỗ đặt file sẽ
được dẫn sai.

**F3 · Hai mã luật không có rule.** `VENDOR-3` (nhánh bề mặt giữ nội thất có kiểu — không phát
`children`) và `VENDOR-4` (không có vỏ thẻ riêng) không được máy nào giữ.

**F4 · Cổng file test bất đối xứng.** Trong `vendor-boundary`, `isTestFile` chỉ chặn hai báo cáo ở
`Program:exit`. Báo cáo `outside` trên import **vẫn nổ trong file test**, nên một file test dựng
kịch bản với nguyên thể của thư viện bị báo lỗi. Hoặc là ngoại lệ nên phủ cả ba, hoặc là không nên
tồn tại; hiện trạng không phải một quyết định, mà là một chỗ quên.

**F5 · Cổng thư mục vỏ bắt cả file không phải thành phần.** `unknownShell` nổ cho mọi file dưới thư
mục vỏ không mang một trong bốn tên — kể cả `types.ts`, một barrel `index.ts`, hay một helper. Và
`emptyShell` nổ cho một file phụ **bên trong** một thư mục vỏ hợp lệ (ví dụ `ModalShell/parts/…`),
vì regex khớp theo thư mục chứ không theo file.

**F6 · Re-export hở hai chiều cùng lúc.** Một vỏ lấy nguyên thể bằng `export … from` thì
`importsVendor` không bao giờ bật: thư viện vào mà không ai thấy, **và** vỏ bị báo là rỗng. Một lối
viết vừa lọt chiều ra vừa nổ oan chiều vào là dấu hiệu rằng phép đo sai node, không phải sai ngưỡng.

**F7 · Ba phép kiểm literal nổ oan với mã đúng ý.** `className={"p-0"}`, `className={cn("p-0")}`,
`variant={"secondary"}` đều bị báo. Đây là **ngả về phía an toàn** và có thể chấp nhận, nhưng phải
được nói ra, vì nó dạy người ta bỏ dấu ngoặc chứ không dạy họ hiểu luật.

**F8 · Import tương đối làm cờ sở hữu chết.** Trong `account-control-owns-dropdown`, cả ba cờ
`hasOwner` đều bật bằng phép khớp đường dẫn có chứa đoạn `components/…`. Một import tương đối leo ra
khỏi thư mục hiện tại không chứa đoạn đó, nên **mã đúng bị báo** `menu` hoặc `shell`. Cùng cơ chế
làm `no-surface-branch-in-overlay` **bỏ lọt** — cùng một điểm yếu, hai hướng hỏng ngược nhau.

**F9 · Biểu thức đệm neo vào dấu nháy.** Phép kiểm `inset` của lớp phủ xác thực chỉ khớp khi class
đệm dọc là token đầu tiên của chuỗi. Đảo thứ tự class — một việc không ai coi là thay đổi gì — làm
phép kiểm biến mất trong khi render y hệt.

**F10 · Ba biến giải phẫu là toàn file.** `checkbox-keeps-compound-anatomy` chứng minh "có tồn tại
một cây đúng", không chứng minh "mọi cây đều đúng". Trong một file xuất hai biến thể, biến thể hỏng
được biến thể đúng bảo lãnh.

**F11 · Hai helper trùng nhau từng ký tự.** `memberName` và `jsxMemberName` là cùng một hàm khai báo
hai lần trong cùng một file. Không sai nghiệp vụ, nhưng là hai chỗ để sửa khi cần sửa một.

**F12 · Bốn rule hành xử khác điều tên gọi gợi ra.**
- `vendor-boundary` không chỉ giữ import; nó giữ **danh sách tên thư mục vỏ**, một luật về chỗ đặt
  file, không phải về thư viện ngoài.
- `text-link-uses-hero-link` không chỉ đòi mượn nguyên thể; nó cấm **mọi** thẻ nút thô và **mọi**
  chuỗi class chứa `hover:` hay `underline` ở bất kỳ đâu trong file, kể cả trên phần tử không liên
  quan.
- `no-internal-starci-href` rộng hơn tên: ở bốn lá chỉ-nội-bộ, nó cấm cả việc **khai báo kiểu**
  `href`, không xét giá trị có nội bộ hay không.
- `field-label-is-text-only` hẹp hơn tên: nó chỉ biết **một** đường dẫn biểu tượng và **một** loại
  tổ tiên là thẻ `label` chữ thường; nhãn dựng bằng bất cứ cách nào khác nằm ngoài tầm nhìn.

**F13 · Nhận diện thư viện ngoài không nhất quán trong cùng một file nguồn.** `vendor-boundary` dùng
**tiền tố** nên bắt mọi gói con; `field-input-uses-secondary-variant`, `text-link-uses-hero-link` và
`account-control-owns-dropdown` dùng **so bằng chính xác** nên gói con vô hình. Hệ quả cụ thể: một
import gói con trong lá trường bị `vendor-boundary` cho qua (đúng, vì lá được sở hữu) và đồng thời
làm luật biến thể **im lặng hoàn toàn**.

**F14 · Địa chỉ không-giao-thức bị đọc nhầm thành nội bộ.** `isInternal` bắt đầu bằng
`value.startsWith("/")`, nên một địa chỉ ngoài viết dạng `//host/path` bị báo `internal`.

## Decisions

- Giữ đúng **10 mục**, đặt tên bằng **tên rule đã công bố**, nguyên văn, kể cả khi tên chứa một từ
  sản phẩm. Không gán mã số thứ hai cho rule: một rule hai tên là một rule không truy được nguồn
  thông điệp.
- Ghi mã luật vào cột riêng, không nhập vào tên. Mã đặt tên cho **luật**; tên rule đặt tên cho **phép
  thi hành**.
- Không tạo mục cho `VENDOR-3`, `VENDOR-4`. Rule không chỉ tay được là một đề xuất, không phải một
  rule.
- Ghi bảng **Cửa còn mở** là bắt buộc, mỗi rule ít nhất một dòng. Không rule nào được ghi "không có".
- Trong prose và ví dụ, gói thư viện ngoài viết là `@vendor/react` / `<tiền-tố-vendor>`; định danh
  ship thật (tên rule, `messageId`, tên thành viên JSX được so chuỗi) giữ nguyên văn.
- Không sửa nguồn từ tài liệu này. Mọi F ở trên là **nhận định**, không phải bản vá.

## Rủi ro còn mở

Mỗi mục nêu cửa mở, rồi nêu rule phải soi thêm **cái gì** mới đóng được — hoặc vì sao đóng đắt hơn
lợi.

**Chưa có rule nào giữ `VENDOR-3` và `VENDOR-4`.** Muốn giữ `VENDOR-3` phải soi được rằng bốn nhánh
bề mặt không khai `children` trong kiểu và không vẽ `props.children` — làm được, vì cả hai đều là
node tĩnh. `VENDOR-4` (cấm một vỏ thẻ riêng) rẻ hơn nữa: nó là một phép kiểm tên thư mục, cùng loại
với `unknownShell`. Cả hai đáng làm; hiện trạng là **hai mã luật không được giữ**, và điều đó phải
được biết chứ không được đoán.

**`vendor-boundary` — re-export, `require`, `import()`.** Đóng được bằng cách thăm thêm
`ExportNamedDeclaration`/`ExportAllDeclaration` có `source`, và `CallExpression` với callee
`import`/`require`. Rẻ, và sửa luôn F6. Nên đóng.

**`vendor-boundary` — barrel trong thư mục lá.** Muốn đóng phải phân giải mô-đun và đi theo
re-export, tức là bỏ tính chất một-file của toàn bộ kệ. **Đắt hơn lợi** ở tầng lint; chỗ này thuộc
về review kiến trúc, và tài liệu phải nói thẳng rằng nó không được giữ.

**`vendor-boundary` — thư mục lá là chứng cứ duy nhất của quyền sở hữu.** Không đóng được bằng cú
pháp: "có phải một nguyên thể đóng không" là một câu hỏi về ý nghĩa. Chấp nhận mở, và ghi lại.

**Cổng tên file, có ở bảy rule.** `ModalShell/index.tsx`, `Field/index.tsx`, `TextLink/index.tsx`,
`Checkbox/index.tsx`, `DropdownShell/index.tsx`, `AccountMenu/component.tsx`,
`ShellNav/component.tsx`, `SignInOverlay/component.tsx`, `contracts/index.ts`. Đổi tên file là mất
rule, và **không có gì đỏ lên**. Đóng được một nửa bằng cách nới regex sang cả thư mục thay vì đúng
một tên file; nửa còn lại — đổi tên thư mục — cần một phép kiểm rằng thư mục đó vẫn tồn tại, tức là
một rule thứ mười một canh chính bộ rule. Đề xuất tối thiểu: nới `index.tsx` thành `index|component`
ở những chỗ mà cả hai tên đều xuất hiện trong repo, và ghi hằng số đường dẫn ra một chỗ.

**Hằng số rửa sạch chuỗi, ở `text-link-uses-hero-link`.** Muốn đóng phải lần được giá trị của một
định danh trong cùng phạm vi — làm được cho hằng khai báo cùng file bằng `context.sourceCode.getScope`
và một phép giải hằng nông. Không đóng được cho hằng import từ file khác. **Nên đóng phần nông**,
vì dạng nông là dạng người ta hay viết khi dọn dẹp.

**Alias và namespace, ở bốn rule.** `Modal.Body` đổi tên, `Vendor.Input`, `HeroCheckbox` ghi cứng.
Đóng được bằng cách dựng tập ràng buộc từ import thay vì so chuỗi tên thành viên — đúng cách mà
`field-input-uses-secondary-variant` đã làm cho định danh thuần, chỉ cần mở rộng sang biểu thức
thành viên. Nên đóng; đây là chỗ ba rule đang so văn bản trong khi một rule cùng file đã làm đúng.

**Đường dẫn import tương đối, ở `no-surface-branch-in-overlay` và `account-control-owns-dropdown`.**
Đóng được bằng cách phân giải định danh tương đối về đường dẫn tuyệt đối dựa trên
`context.filename` trước khi khớp — không cần resolver, chỉ cần `path.posix.resolve`. **Nên đóng**,
vì hiện tại cùng một điểm yếu vừa gây bỏ lọt vừa gây nổ oan.

**Phép kiểm dựa trên sự hiện diện của import**, ở `text-link-uses-hero-link`,
`account-control-owns-dropdown` và `auth-overlay-owns-single-content-host`. Import cho có là đủ để
tắt báo cáo. Đóng được bằng cách đòi thêm một lần **vẽ**: ràng buộc từ import phải xuất hiện ở một
`JSXOpeningElement`. Chi phí thấp, và nó biến ba phép kiểm hình thức thành ba phép kiểm thật.

**Biểu thức đệm neo vào dấu nháy** (F9). Đóng bằng một biểu thức có ranh giới từ, và cân nhắc thêm
token đệm bốn phía khi nó cũng dựng lại dải dọc:

```js
/(?:^|[\s"'`])(?:py|pt|pb|p)-/
```

Rẻ, nên đóng.

**Ba biến giải phẫu toàn file** (F10). Đóng bằng cách gom trạng thái **theo từng cây gốc** thay vì
theo file: bắt đầu một bản ghi ở mỗi phần tử gốc của hợp thành, kết luận khi rời phần tử đó. Vừa
sức, và nó chuyển kết luận từ "có tồn tại" sang "mọi cây".

**`no-internal-starci-href` — mọi đích tính toán được.** Đây là cửa mở **lớn nhất trên kệ**, vì dạng
đi lọt lại là dạng phổ biến nhất trong mã thật. Đóng được một phần: template literal có nội suy mà
**phần chữ đầu tiên** bắt đầu bằng `/` là nội bộ ở mọi giá trị nội suy — bắt được ngay bằng
`quasis[0]`. Phần còn lại (biến, tra cứu hằng, phép nối) cần lần giá trị và không đóng được ở tầng
này; hướng khả thi hơn là **đảo chiều luật**: cấm `href` ở mọi thành phần thuần trừ danh sách trắng
đích ngoài, thay vì cố đọc giá trị. Đó là một thay đổi luật, nên thuộc về văn bản luật chứ không
thuộc bản vá rule.

**`no-internal-starci-href` — khoá khác và mảng chuỗi.** Thêm khoá thì rẻ (`to`, `url`, `path`).
Mảng chuỗi thuần thì không đóng được nếu không biết mảng đó dùng làm gì. Chấp nhận mở.

**`no-internal-starci-href` — địa chỉ không-giao-thức** (F14). Đóng bằng một dòng: loại trừ tiền tố
`//` trước khi kết luận nội bộ. Nên đóng.

**`field-label-is-text-only` — nhãn không phải thẻ `label`.** Đóng được một phần bằng cách thêm
thuộc tính `label` của phần tử ô nhập vào tập vị trí bị soi. Nhãn dựng bằng một thành phần của nhà
thì cần biết thành phần đó là nhãn — tức là cần một quy ước đặt tên được ghi thành luật trước, rồi
mới có rule. Ghi lại như một phụ thuộc, không phải một bản vá.

**Nhận diện thư viện ngoài không nhất quán** (F13). Đóng bằng cách để ba rule so-bằng-chính-xác dùng
chung hằng tiền tố sẵn có. Rẻ nhất trong danh sách này, và nó bịt một chỗ mà hiện tại **một import
gói con làm cả một rule im lặng**.

**Cổng file test bất đối xứng** (F4) và **file phụ trong thư mục vỏ** (F5). Cả hai là nổ oan, không
phải bỏ lọt, nên không nguy hiểm — nhưng nổ oan là thứ dạy người ta viết comment tắt luật, và một
comment tắt luật đặt trong thư mục vỏ thì tắt luôn phần chiều-vào vốn là lý do luật này tồn tại.

## Re-audit Triggers

- Nguồn công bố thêm hoặc bớt một rule, hoặc đổi một khoá trong `rules` — vì khoá **là** danh tính.
- Văn bản luật thêm hoặc bớt một mã `VENDOR-<n>`, hoặc sửa danh sách vỏ (F1).
- Một thông điệp (`messageId` hoặc nội dung) đổi chữ: kệ này chép nội dung báo cáo, nên nó cũ đi
  cùng lúc.
- Một cổng tên file trong nguồn đổi, hoặc repo đổi quy ước `index.tsx` ↔ `component.tsx`.
- Một cửa mở ở trên bị đóng — dòng tương ứng phải rời bảng **Open** sang bảng **Closed**, kèm cơ chế
  mới.
- Có người thêm một comment tắt luật cho một trong 10 rule: đó là bằng chứng của nổ oan hoặc của một
  ngoại lệ chưa được viết ra.
- Rule đầu tiên trong mô-đun này bắt đầu phân giải mô-đun hoặc đọc nhiều file — vì khi đó tuyên bố
  "tĩnh và trong một file" ở `INDEX.md` hết đúng.
