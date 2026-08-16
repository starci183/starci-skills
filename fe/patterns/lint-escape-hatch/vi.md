---
id: fe-patterns-lint-escape-hatch-vi
title: vi.md
slug: /fe/patterns/lint-escape-hatch/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống LINT-ESCAPE-N, nhận diện bằng việc ai đang quyết định chứ không bằng độ hẹp của directive.
---

# vi.md

> Version: `2.00` · Module: `lint-escape-hatch`

# Lint escape hatch

Escape hatch là **đoạn text trong source làm đổi tập luật đang áp cho chính file chứa nó**:
`eslint-disable`, các biến thể theo dòng, và `eslint-enable`.

Nó biến một luật của cả repo thành một lựa chọn cục bộ. Hệ quả nằm gọn trong một câu:

> Người viết ra vi phạm cũng là người quyết định đó có phải vi phạm hay không.

Mọi thuộc tính khác của một directive — hẹp tới đâu, chỉ đích danh rule nào, lý do viết bên cạnh hay
tới mức nào — đều nói về **hình dạng** của cái bypass. Không cái nào đổi được **ai đã quyết**.

**Đây là luật bắt buộc.** Không có kích thước bypass nào nhỏ tới mức chỉ còn là một ghi chú, và không
có lý do nào tốt tới mức biến một quyết định thành một ghi chú. Rule sai thì sửa matcher hoặc sửa
kiến trúc, cho tất cả mọi người — đúng cái sửa mà directive đang né.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Bằng chứng phải có |
|---|---|---|
| `LINT-ESCAPE-1` | Source sản phẩm **không chứa** directive nào của ESLint | Không comment nào bắt đầu bằng `eslint-disable`/`-next-line`/`-line`/`eslint-enable` |
| `LINT-ESCAPE-2` | Config đã gắn rule thì cũng gắn `linterOptions.noInlineConfig` | Một directive nhắm vào chính rule đang báo lỗi vẫn không tắt được nó |
| `LINT-ESCAPE-3` | Ca hợp lệ được nói ở **config dùng chung hoặc type đóng** | Không có allowlist theo đường dẫn, thư mục, vendor hay component; không rule kiến trúc nào ở mức `warn` |

---

## `LINT-ESCAPE-1` — source sản phẩm không chứa directive

**Tình huống.** Một file gặp rule chặn nó. Cách rẻ nhất là viết một dòng comment cho rule đó im
lặng — và cách đó luôn hoạt động, nên nó là cách hay được chọn nhất. Cái nó đổi không phải một dòng
code: nó chuyển quyền phán quyết từ repo về đúng file vừa vi phạm.

Điều làm mã này khó nhìn ra là nó **trông giống một hành động kỹ thuật** trong khi nó là một hành
động quản trị. Hai người review một PR có `eslint-disable-next-line` sẽ bàn xem lý do bên cạnh có hợp
lý không. Câu hỏi thật thì không nằm ở đó: từ giây phút dòng đó tồn tại, không còn ai ngoài file đó
trả lời được câu "rule này có áp cho đây không".

**Dấu hiệu nhận biết**

- Một comment mở đầu bằng `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line` hoặc
  `eslint-enable` trong file đang ship.
- Có `eslint-disable` ở đầu file — cả file ra khỏi luật, và người đọc tiếp theo không biết mình đang
  đọc dưới tập luật nào.
- Có cặp `eslint-disable` … `eslint-enable` ôm một khối, tức là ai đó đã **thiết kế** một vùng miễn
  trừ chứ không phải lỡ tay.
- Bên cạnh directive là một lý do viết rất kỹ. Lý do càng kỹ càng đáng ngờ: nó là bằng chứng người
  viết biết rõ mình đang đi vòng.
- Có người nói "chỉ một dòng thôi", "tạm để đó rồi sửa sau", "để merge kịp demo".

**Tự hỏi.** Nếu xoá dòng comment này đi, code có đỏ không? Nếu có — dòng đó không phải comment, nó là
một quyết định về luật, và nó đang được ký bởi đúng người bị luật đó chặn.

**Ranh giới**

- ↔ `LINT-ESCAPE-2`: mã 1 nói về **text nằm trong source**; mã 2 nói về **điều kiện của config** làm
  text đó vô hiệu. Xoá hết directive mà config vẫn cho phép inline thì mã 1 xanh và hàng rào vẫn
  chưa dựng.
- ↔ `LINT-ESCAPE-3`: mã 1 là một file tự miễn trừ cho mình; mã 3 là **cả repo** tạo sẵn một chỗ miễn
  trừ để không ai phải tự viết directive nữa. Mã 3 nguy hiểm hơn vì nó không để lại dấu vết trong
  file nào cả.
- ↔ **prose về directive**: một comment giải thích *vì sao file này không có* `eslint-disable` là hợp
  lệ. Directive được đọc từ ký tự không-trắng đầu tiên của comment; nhắc tới cái tên ở giữa câu không
  phải là ra lệnh.

**Tình huống nghiệp vụ hay gặp.** Cú pháp khai báo cho một thư viện bên ngoài · một `any` để qua cho
kịp · cảnh báo dependency của hook · một `console` trong nhánh debug · file trông như generated · một
component "sẽ viết lại tuần sau" · một migration đang dở · một PR hotfix lúc nửa đêm.

**Cái vẫn hợp lệ.** Fixture của chính twin test: nó **dựng ra** chuỗi directive để chứng minh rule bắt
được. Fixture là cái chuỗi, không phải hành động; và chỗ phân định đó nằm ở path gate của rule chứ
không cần tới một directive để nói ra.

---

## `LINT-ESCAPE-2` — config đã resolve làm directive vô hiệu

**Tình huống.** Một rule báo cáo directive là **chưa đủ**. Nếu config vẫn honour inline config thì
directive đó vẫn có tác dụng — kể cả khi nó nhắm vào chính rule đang canh nó. Lúc ấy hàng rào có một
cái cửa, và chìa khoá nằm trong tay người muốn đi qua.

Vì thế mã 2 không phải một tuỳ chọn "chặt hơn". Nó là thứ đổi kết quả từ *bị coi là sai* sang *không
xảy ra*. Cần cả hai: mã 1 giải thích vì sao hỏng, mã 2 bảo đảm directive không tự bịt miệng được
người canh nó.

**Dấu hiệu nhận biết**

- Config gắn `plugins` và `rules` nhưng không thấy `linterOptions` đâu.
- `linterOptions` có ở block đầu, rồi một block sau ghi đè mất — flat config lấy block sau, và không
  ai để ý vì rule vẫn còn nguyên trong danh sách.
- Rule và linter options được import từ hai chỗ khác nhau, nên có thể gắn cái này mà quên cái kia.
- Một PR thêm `eslint-disable <tên-rule-canh-directive>` và CI vẫn xanh.
- Có người trả lời "đã bật rule rồi mà" khi được hỏi directive còn tác dụng không.

**Tự hỏi.** Một comment đặt đúng chỗ có tắt được **chính rule đang báo lỗi dòng đó** không? Nếu có —
cái đang đứng đó không phải hàng rào, nó là một lời khuyên có kèm thông báo lỗi.

**Ranh giới**

- ↔ `LINT-ESCAPE-1`: xem trên.
- ↔ luật `lint-adoption`: mã 2 nói **artifact phải publish** linter options và chúng phải rời canon
  cùng với rule. Việc **đo xem một repo cụ thể đã nhận được chưa** là mã `LINT-ADOPTION-4` của module
  kia, đọc ra từ `refusesInlineConfig` của config đã in. Hai mã nhìn cùng một giá trị từ hai phía:
  bên xuất bản và bên tiêu thụ.

**Tình huống nghiệp vụ hay gặp.** Repo mới wiring lần đầu · thêm một block config cho thư mục test ·
gộp hai file config lại · nâng ESLint lên major mới · copy một block config từ một dự án khác sang ·
ai đó thêm `linterOptions` của riêng họ cho một glob hẹp.

---

## `LINT-ESCAPE-3` — không có allowlist

**Tình huống.** Khi directive bị chặn, áp lực không biến mất — nó chuyển chỗ. Chỗ tiếp theo là
**config**: xin một đường dẫn được miễn, một thư mục được `ignores`, một rule được hạ xuống `warn`
"trong lúc chuyển đổi". Kết quả giống hệt mã 1, chỉ khác là nó không để lại dấu vết trong file nào,
nên không ai đọc code mà thấy được.

Component mỏng, ranh giới vendor, file khai báo, file trông như generated, việc migration tạm thời —
không cái nào **kiếm được** một suất miễn trừ cục bộ. Cú pháp hợp lệ thì được nói ra **một lần** ở
config dùng chung hoặc ở một type đóng, nơi mọi call site thừa hưởng và người review nhìn thấy. Nợ
thì trả trước khi merge, không giấu bên cạnh chỗ nó phát sinh.

Rule kiến trúc ở mức `warn` là cùng một chuyện kể theo cách khác: vi phạm mới vẫn merge được trong
khi trông như đã có người cai quản. Kiến trúc yếu hơn luôn là cái thắng, vì nó là cái không chặn ai.

**Dấu hiệu nhận biết**

- Trong config có một `files`/`ignores` mang tên đúng một component hoặc đúng một thư mục.
- Có block config đứng sau hạ mức một rule cho một glob "legacy" hoặc "tạm".
- Rule kiến trúc được mô tả là "đang rollout, tuần này để `warn`".
- Có ai đó đề nghị thêm option cho rule để rule tự bỏ qua một danh sách đường dẫn.
- Một finding kiến trúc được xử lý bằng cách đổi phạm vi rule thay vì sửa ranh giới mà nó phát hiện.
- Có glob bị thu hẹp lại đúng bằng chỗ vừa đỏ.

**Tự hỏi.** Cái tôi sắp thêm vào config nói lên một **ca**, hay nói lên một **cái tên**? Ca thì thuộc
về luật; tên thì là allowlist, và allowlist chỉ có một chiều — dài thêm.

**Ranh giới**

- ↔ `LINT-ESCAPE-1`: xem trên.
- ↔ **glob của repo**: repo vẫn sở hữu việc luật áp **ở đâu** — monorepo và single-app không cùng một
  hình dạng thư mục. Cái đó không mở gì cho một file **nằm trong** vùng đã cai trị. Một glob bị bẻ
  cong đúng bằng chỗ vừa đỏ là allowlist mặc áo config.
- ↔ **sửa rule**: nói ra một ca hợp lệ trong matcher dùng chung là **sửa luật**, và được review như
  sửa luật. Đó là đường thoát hợp lệ duy nhất, và nó cố ý đắt hơn một dòng comment.

**Tình huống nghiệp vụ hay gặp.** Một component mỏng bị rule kiến trúc bắt · thư mục sinh ra bởi
codegen · file `.d.ts` khai báo cho thư viện ngoài · một cây source đang migrate dở · một rule mới
làm đỏ 40 file cùng lúc · deadline · ai đó muốn "bật dần cho êm".

---

## Luật

1. Escape hatch là text làm đổi tập luật đang áp cho chính file chứa nó.
2. Source sản phẩm không chứa directive nào của ESLint.
3. Báo cáo và vô hiệu hoá là **hai** nghĩa vụ, không phải một; thiếu một cái thì không có hàng rào.
4. Lý do viết bên cạnh một bypass chỉ ghi lại nó, không bao giờ cho phép nó.
5. Directive được đọc từ ký tự không-trắng đầu tiên của comment; prose nhắc tới directive không phải
   directive.
6. Ca hợp lệ nói ở config dùng chung hoặc type đóng, không nói ở file cần nó.
7. Rule kiến trúc ship ở mức `error` kèm twin test, hoặc không ship.
8. Nợ được trả trước khi merge, không được giấu bên cạnh.
9. Rule sai thì sửa matcher hoặc sửa kiến trúc, cho tất cả mọi người.
10. Thiếu lint rule cho một mã là một khoảng trống **được ghi ra**, không bao giờ là lý do hạ mã đó
    xuống.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp vào.

- **Prose về directive.** Thuộc `LINT-ESCAPE-1`. Comment giải thích vì sao file này **không** có
  `eslint-disable` là hợp lệ. Pattern được neo ở đầu comment đúng để câu đó viết được; bắt hụt không
  phải cái giá phải trả, vì directive mà linter nghe theo luôn nằm ở đầu.
- **Fixture dựng ra chuỗi cấm.** Thuộc `LINT-ESCAPE-1`. Twin test cố ý dựng directive để chứng minh
  rule bắt được. Fixture là cái chuỗi, không phải hành động.
- **Glob là *ở đâu*, không phải *cho ai*.** Thuộc `LINT-ESCAPE-3`. Repo sở hữu việc luật áp lên cây
  source nào; nó không mở gì cho một file nằm trong cây đó.
- **Config dùng chung sở hữu cú pháp hợp lệ.** Thuộc `LINT-ESCAPE-3`. Khai báo cho thư viện ngoài,
  hình dạng do codegen sinh ra, ràng buộc của nền tảng — đều có thể hợp lệ, nhưng phải nói **một lần**
  ở chỗ dùng chung, nơi mọi call site thừa hưởng. Nói ở đúng file cần nó là bypass đổi tên.
- **Sửa rule không phải miễn trừ.** Thuộc cả ba mã. Rule sai thì matcher hoặc kiến trúc được sửa, kèm
  twin test, trong một diff review được. Nó cố ý đắt hơn một dòng comment, vì nó là một thay đổi luật.
