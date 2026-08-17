---
title: Lint-escape-hatch · Vietnamese
---

# Cấm tự tắt lint

## LOADS

None.


## Bản ghi

Gate này nhận mã đã viết xong — một tệp, một mảnh diff. Kết quả là một **phán quyết**: tệp có nằm trong
phạm vi hay không, luật máy nào đã nổ, nó báo cái gì và trên node nào, ánh xạ vào mã luật nào, và cửa
hở nào lẽ ra đã che được đúng cái sai đó. Mô-đun này không chọn gì cả. Nó từ chối, và nó phải chỉ được
đúng dòng chú thích mà nó từ chối.

## Luật

Tệp vi phạm không được là tệp quyết định có vi phạm hay không. Khi một dòng chú thích tắt được rule
ngay tại chỗ, người viết ra lỗi cũng đồng thời là người phán rằng đó không phải lỗi.

Luật mang **ba mã**: `LINT-ESCAPE-1`, `LINT-ESCAPE-2` và `LINT-ESCAPE-3`. Tập rule xuất bản **một
rule**, và một rule ấy giữ trọn `LINT-ESCAPE-1`, giữ một nửa `LINT-ESCAPE-2`, và không giữ gì của
`LINT-ESCAPE-3`. Thứ tài liệu này ghi lại là **việc thực thi**, không phải luật: không phải luật nói
gì, mà bộ lint nhìn thấy được bao nhiêu phần của luật và không nhìn thấy phần nào. Một luật không có
rule thì ai cũng biết là luật suông. Một rule **tưởng là kín** mà thật ra hở thì nguy hơn nhiều, vì
chính niềm tin "đã có máy gác" là thứ khiến không ai đi kiểm lại.

## Luật máy đã xuất bản

| Rule | Mã luật | Bắt gì |
|---|---|---|
| `no-inline-lint-config` | `LINT-ESCAPE-1` | Chú thích trong mã nguồn sản phẩm mà **mở đầu** bằng directive `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` hoặc `eslint-enable` |

`LINT-ESCAPE-2` chỉ được giữ **một nửa** bằng rule. Rule báo cáo hành vi né luật; phần làm cho hành vi
đó **vô hiệu** là `linterOptions.noInlineConfig` — một mẩu cấu hình phẳng mà kho tiêu thụ phải tự áp
vào, không phải một rule có thể tự làm đỏ bản dựng. Vậy nên nửa còn lại là phần **không rule nào thực
thi**, chứ không phải phần đã được che.

`LINT-ESCAPE-3` **không có rule nào cả**. Không có gì đi quét danh sách miễn trừ. Thứ thay thế nó là
`schema: []`: rule không nhận tuỳ chọn nào, nên không ai truyền được một ngoại lệ theo đường dẫn vào
cho nó. Cửa đó khép; cửa cấu hình thì vẫn mở toang. Một lần chạy xanh không nói được điều gì về
`LINT-ESCAPE-3`.

## Đọc một diff

1. **Quyết phạm vi trước hết, và ghi lại.** Cổng đường dẫn là phép kiểm chuỗi con `/src/` sau khi
   chuẩn hoá dấu phân cách. Nằm ngoài phạm vi ở đây không có nghĩa là tệp đã sạch — nghĩa là `create`
   đã trả về `{}` và rule không hề tồn tại với tệp đó.
2. **Kiểm ngoại lệ.** Trong mã không có ngoại lệ nào. Ranh giới duy nhất hay bị đọc nhầm thành ngoại
   lệ là các tệp kiểm thử nằm ngoài mọi đoạn `/src/` — đó là cái cổng làm đúng việc, không phải một
   suất miễn trừ.
3. **Đọc các node.** Mọi chú thích `Line` và `Block` mà bộ phân tích đã gắn vào cây, thân chú thích
   giữ nguyên không cắt khoảng trắng, mỗi cái đều được so từ đầu thân.
4. **Xuất một khối cho mỗi phát hiện** — một khối cho mỗi node chú thích khớp mẫu.
5. **Viết dòng `hatch`** mỗi khi có một cửa còn mở lẽ ra đã che được đúng cái sai đó, kể cả trên một
   tệp không báo gì.
6. **Không báo cái mà không rule nào canh.** Chú thích đổi mức nghiêm trọng, danh sách miễn trừ viết
   trong cấu hình phẳng, plugin chưa nối dây: không thứ nào có máy giữ, và một phán quyết nói khác đi
   là nói sai về mô-đun này.

## `no-inline-lint-config` — LINT-ESCAPE-1

**Nó báo cái gì.** Một báo cáo cho mỗi node chú thích mà **thân chú thích bắt đầu** bằng một directive
đổi tập rule đang chạy: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`,
`eslint-enable`. Báo ngay trên chính node chú thích, `messageId: "directive"`. Kèm lý do phía sau cũng
không thay đổi gì — lý do chỉ ghi lại việc né luật, nó không ngăn việc né luật.

**Nó phát hiện bằng gì.** Cổng đường dẫn: lấy `context.filename`, thiếu thì lấy
`context.getFilename()`, đổi mọi dấu `\` thành `/`, rồi đòi chuỗi kết quả **chứa** `/src/`; không chứa
thì `create` trả về `{}`. Điểm móc: đúng một handler `Program`. Nguồn dữ liệu:
`context.sourceCode.getAllComments()`. Phép so: `comment.value` khớp với
`/^\s*eslint-(?:disable(?:-next-line|-line)?|enable)\b/`. Tuỳ chọn: `schema: []`.

**Điểm mù.** Chú thích cấu hình trần `/* eslint some-rule: "off" */` — mẫu chỉ biết họ
`disable`/`enable`, nên đúng cái dạng đổi cấu hình lint tại chỗ ở nghĩa đen nhất lại không khớp, và
tên rule hứa rộng hơn phần bắt. `/* eslint-env node */` và `/* globals FLAG */` rơi qua cùng lỗ hổng họ
hàng. Mọi tệp không có đoạn `/src/` trong đường dẫn, và cũng chính tệp ấy khi đưa vào bộ lint dưới tên
tương đối `src/thing.tsx` không có dấu phân cách đứng trước `src`. Miễn trừ viết trong cấu hình phẳng
thay vì viết trong tệp. Directive cất trong chuỗi rồi mới ghi ra sau. Chú thích ở bề mặt mà bộ phân
tích không giao lại. Cấu hình tiêu thụ quên áp `linterOptions.noInlineConfig`. Và việc plugin đơn giản
là chưa được nối dây.

**Ranh giới.** Rule **báo cáo**; hàng rào cấu hình **vô hiệu hoá**. Không cái nào thay được cái kia, và
tài liệu này phải nói rõ cái nào đang giữ phần nào. Bắt hụt ở phần văn xuôi là cố ý: một câu chỉ nhắc
tới directive thì không bị báo, vì directive mà bộ lint chịu nghe thì luôn nằm ở đầu chú thích.

## Cách phát hiện

| Phần | Cơ chế |
|---|---|
| chuẩn hoá dấu phân cách | `normalizePath` đổi `\` thành `/` trước khi qua cổng, nên một đường dẫn Windows được phán y hệt |
| cổng tệp | Đường dẫn đã chuẩn hoá phải chứa chuỗi con `/src/`; không thì `create` trả về `{}` và rule không tồn tại với tệp đó |
| điểm móc | Đúng một handler `Program`, chạy một lần khi vào chương trình |
| bộ đọc | `context.sourceCode.getAllComments()` — mọi node chú thích `Line` và `Block` mà bộ phân tích đã gắn vào cây |
| phép so | `comment.value` khớp `/^\s*eslint-(?:disable(?:-next-line|-line)?|enable)\b/` |
| báo cáo | Ngay trên node chú thích, `messageId: "directive"` |
| tuỳ chọn | `schema: []` — không có bề mặt cấu hình nào |
| thứ nằm ngoài tệp | `linterOptions.noInlineConfig` trong cấu hình phẳng của kho tiêu thụ; đó là một export riêng, không phải rule |

Ba chi tiết trong mẫu đó quyết định gần hết hành vi ở phần dưới:

- **`^` neo ở đầu thân chú thích**, vì đó là chỗ duy nhất một directive được công nhận. Mẫu không neo
  thì bắt trúng **chữ** thay vì bắt trúng **directive** — một câu giải thích rằng tệp này không hề tắt
  lint lại bị báo là đang tắt lint, và thế là viết lời giải thích trở thành hành vi vi phạm.
- **`\s` bao cả ký tự xuống dòng**, nên chú thích khối để directive ở dòng thứ hai vẫn bị bắt.
- **`\b` đóng phép khớp ngay sau tên directive**, nên phần lý do phía sau không được đọc tới, và một từ
  dài hơn như `eslint-disabled` thì không khớp.

## Lối thoát hợp lệ

**Đã khép** — người đọc có thể tưởng mấy dạng này lọt được, nhưng không.

| Dạng viết | Vì sao vẫn không lọt |
|---|---|
| `//eslint-disable-next-line rule` viết sát không có dấu cách | `^\s*` chấp nhận không khoảng trắng cũng dễ như chấp nhận một khoảng trắng |
| `// eslint-disable-next-line rule -- lý do` | `\b` đóng phép khớp ngay tại directive; phần sau không bao giờ được đọc tới, nên lý do chẳng mua được gì |
| Chú thích khối để directive ở dòng thứ hai | `\s` gồm cả ký tự xuống dòng, nên `^\s*` vẫn với tới directive |
| `{/* eslint-disable rule */}` đặt trong đánh dấu | Biểu thức chú thích trong đánh dấu vẫn chứa một node chú thích thường; `getAllComments()` trả về nó |
| Đường dẫn tuyệt đối viết bằng dấu `\` | `normalizePath` đổi dấu phân cách trước phép kiểm `/src/`, nên dạng đường dẫn không phải một lối lách |
| `/* eslint-disable */` nhắm vào chính rule này | Nó bị báo như mọi directive khác, và ở nơi cấu hình phẳng có áp `linterOptions.noInlineConfig` thì nó đã vô hiệu trước khi kịp giúp được ai |
| `/* eslint-enable */` dùng một mình để mở lại một đoạn | `enable` là một nhánh riêng trong mẫu, không phải thứ nghĩ thêm sau |
| Từ `eslint-disabled` xuất hiện như một chữ | `\b` không khớp được giữa `e` và `d`, nên từ dài hơn không phải directive |
| Một câu giải thích rằng tệp này không mang directive nào như thế | Cố ý không báo. Rule bắt hụt đúng ở chỗ chính bộ lint cũng không công nhận, nên đó là ranh giới của thứ đang được thực thi chứ không phải một lỗ hổng |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được nói rằng mấy chỗ này đã được phán.

| Dạng viết | Vì sao rule bỏ sót |
|---|---|
| Chú thích cấu hình trần: `/* eslint some-rule: "off" */` | Mẫu chỉ biết họ `disable`/`enable`. Một chú thích đổi mức nghiêm trọng chính là cấu hình lint tại chỗ, bộ lint nghe theo nó, và nó không khớp. Tên rule hứa nhiều hơn phần bắt làm được |
| `/* eslint-env node */`, `/* globals FLAG */` | Cùng một lỗ hổng họ hàng. Cả hai đều đổi cách tệp được lint; không cái nào mở đầu bằng `eslint-disable` hay `eslint-enable` |
| Mọi tệp không có đoạn `/src/` trong đường dẫn | Thư mục route, view hay tiện ích đặt thẳng ở gốc kho nằm ngoài cổng. Ở đó rule không yếu đi — nó **không có mặt** |
| Đường dẫn đưa vào không có dấu phân cách đứng trước, ví dụ nguồn được lint dưới tên `src/thing.tsx` | Cổng đòi đúng `/src/`, mà đường dẫn tương đối thì không có dấu phân cách trước `src`. Cùng một tệp, gọi hai kiểu tên, một kiểu bị canh và một kiểu vô hình |
| Miễn trừ viết trong cấu hình phẳng thay vì viết trong tệp: một khối khoanh theo đường dẫn rồi hạ rule xuống `off` hoặc `warn` | Rule đọc chú thích trong mã nguồn. Nó không bao giờ đọc cấu hình, nên đúng cái dạng `LINT-ESCAPE-3` cấm gắt nhất lại là dạng không có gì soi tới |
| Directive cất trong chuỗi rồi mới ghi ra sau: `const BANNER = "// eslint-disable-next-line"` | Chuỗi ký tự không phải chú thích. Bất cứ thứ gì đem chuỗi đó ghi vào một tệp đều đã đưa directive lọt qua một phép quét chỉ nhìn chú thích |
| Chú thích ở bề mặt mà bộ phân tích không giao lại: chú thích trong đánh dấu, trong một phương ngữ khuôn mẫu, trong loại tệp chưa đăng ký bộ phân tích | `getAllComments()` chỉ trả về thứ đã được gắn vào cây. Thứ chưa gắn thì không thể bị báo |
| Cấu hình tiêu thụ quên áp `linterOptions.noInlineConfig` | Khi đó một dòng `/* eslint-disable <id của chính rule này> */` đặt ở đầu tệp sẽ bịt miệng người gác **trước khi** người gác kịp báo — một rule bị tắt bằng đúng cái chú thích mà nó cấm. Báo cáo và hàng rào là hai export khác nhau, và chỉ một trong hai là rule |
| Gỡ rule khỏi plugin, hoặc không trải `recommended` vào cấu hình | Không rule nào tự canh việc mình có được đăng ký hay không. Một hàng rào chưa nối dây thì không khác gì một luật chưa ai viết |

Từng cửa còn mở ở trên đều là **thiếu sót đã ghi nhận**, không phải giấy phép. Viết theo một trong các
dạng đó để khỏi bị báo lỗi vẫn là đúng cái hành vi luật cấm, dù bản dựng có xanh.

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| filename | Giá trị bộ lint báo cho tệp, ở dạng trước khi chuẩn hoá |
| tập chú thích | Mọi node chú thích bộ phân tích đã gắn vào chương trình |
| thân chú thích | Phần văn bản sau dấu mở, giữ nguyên không cắt khoảng trắng |
| cấu hình phẳng | `linterOptions.noInlineConfig` có được áp cạnh tập rule `recommended` hay không |
| mức nghiêm trọng | Cấu hình hiệu lực có giữ rule ở `error` hay không |

## Quy tắc

1. Danh tính của rule là **tên đã công bố** của nó. Nó không mang mã số riêng nào.
2. Rule **báo cáo**; hàng rào cấu hình **vô hiệu hoá**. Không cái nào thay được cái kia.
3. Rule không nhận tuỳ chọn, nên không có chỗ để truyền một ngoại lệ vào tại chỗ gọi.
4. Bắt hụt ở phần văn xuôi là cố ý; một directive mà bộ lint chịu nghe thì luôn nằm ở đầu chú thích
   của nó.
5. Mọi cửa còn mở ở trên đều là thiếu sót đã ghi nhận, không phải giấy phép. Viết theo một trong các
   dạng đó để khỏi bị báo lỗi vẫn là đúng cái hành vi luật cấm, dù bản dựng có xanh.
6. Nằm ngoài phạm vi nghĩa là `create` đã trả về `{}` và không visitor nào được cài, chứ không phải
   tệp đã sạch.
7. Chỉ ghi vào đây những rule **thật sự tồn tại** trong tập rule. Rule "đáng lẽ nên có" là một rủi ro
   được ghi nhận, không phải một rule đã xuất bản.
8. Mỗi rule phải có **ít nhất một** cửa còn mở được viết ra một cách thật thà, hoặc một lập luận rõ
   ràng rằng nó kín. Viết "không có" cho gọn bảng là điều cấm.

## Ngoại lệ

Không có. `LINT-ESCAPE-3` nói không có danh sách miễn trừ, và `schema: []` khiến không có chỗ nào để
viết danh sách ấy. Trong mã không có gì thả một tệp, một đường dẫn hay một directive ra khỏi luật.

Có đúng một ranh giới hay bị đọc nhầm thành ngoại lệ: các tệp kiểm thử cố tình dựng ra directive bị cấm
đều nằm **ngoài** mọi đoạn `/src/`. Đó là cái cổng làm đúng việc của nó trên một tệp không phải mã
nguồn sản phẩm, chứ không phải một suất miễn trừ cấp cho mã nguồn sản phẩm.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule: no-inline-lint-config
code: LINT-ESCAPE-1
file: <path containing a /src/ segment>
node: <the comment node, Line or Block>
message: Inline ESLint configuration makes this file the author of whether repository law
         applies. Remove the directive and fix the code or the shared rule; there is no local
         exception path.
hatch: <the open hatch that would have hidden this, or none>
```

Một tệp nằm trong `/src/` mà không có chú thích nào khớp thì xuất một khối với `node: none`,
`message: none`, kèm dòng `hatch` gọi tên cửa còn mở nào đang áp dụng. Một tệp nằm ngoài `/src/` thì
xuất một khối với `node: none`, `message: none` và `hatch: no /src/ segment — create returned {}, the
rule did not exist for this file`; nó không hề được phán là sạch.

## Ví dụ đã giải

**Đầu vào.** `/repo/src/checkout/total.tsx`:

```tsx
// eslint-disable-next-line react-hooks/exhaustive-deps -- the id never changes
const total = useMemo(() => sum(lines), [])

/* eslint no-restricted-imports: "off" */
import {legacyFormat} from "../../legacy/format"
```

Đường dẫn có chứa `/src/`, nên cổng mở và handler `Program` đọc mọi chú thích đã được gắn vào cây.

```text
rule: no-inline-lint-config
code: LINT-ESCAPE-1
file: /repo/src/checkout/total.tsx
node: Line comment above the useMemo call
message: Inline ESLint configuration makes this file the author of whether repository law
         applies. Remove the directive and fix the code or the shared rule; there is no local
         exception path.
hatch: none
```

Lý do viết kèm phía sau chẳng mua được gì: `\b` đóng phép khớp ngay tại `eslint-disable-next-line` và
phần chữ sau đó không bao giờ được đọc tới. Chú thích thứ hai là chú thích đổi mức nghiêm trọng, không
thuộc họ `disable`/`enable`, nên nó hoàn toàn không bị báo.

**Sau khi sửa.** Mảng phụ thuộc được sửa lại và import cũ được thay, nên chú thích thứ nhất bị xoá. Chú
thích thứ hai vẫn nằm nguyên như cũ, và tệp giờ im lặng:

```tsx
const total = useMemo(() => sum(lines), [lines])

/* eslint no-restricted-imports: "off" */
import {legacyFormat} from "../../legacy/format"
```

```text
rule: no-inline-lint-config
code: LINT-ESCAPE-1
file: /repo/src/checkout/total.tsx
node: none
message: none
hatch: the bare configuration comment /* eslint some-rule: "off" */ is honoured by the linter and
       is not in the disable/enable family, so this file changes its own rule set and the matcher
       never sees it — silence here is not compliance
```

## Phạm vi

Mô-đun này ghi lại việc thực thi một luật, trong một tập rule, đóng gói thành một gói. Nó không phán
xem cái rule bị tắt kia có đúng hay không, cũng không phán xem cấu hình phẳng đã nối dây hay chưa —
việc thứ nhất thuộc về mô-đun sở hữu rule đó, việc thứ hai thuộc về cổng kiểm tra mức độ áp dụng lint
của kho. Phần văn xuôi và mọi ví dụ đều không gọi tên sản phẩm, thư viện giao diện hay kho mã nào. Định
danh rule được trích nguyên văn, vì định danh là thứ hiện ra trong nhật ký bản dựng, và một cách viết
thứ hai đồng nghĩa với một rule mang hai cái tên.
