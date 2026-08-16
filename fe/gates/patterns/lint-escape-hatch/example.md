---
id: fe-patterns-lint-escape-hatch-example
title: example.md
slug: /gates/patterns/lint-escape-hatch/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã LINT-ESCAPE-N, viết bằng TSX thường và flat config thường.
---

# example.md

> Version: `2.00` · Module: `lint-escape-hatch` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường và flat config thường**. Namespace plugin viết là `fe-canon` chỉ
để đọc được; luật không đổi khi nó được đánh vần khác đi. Nếu một ví dụ cần tên riêng của một sản
phẩm mới hiểu được thì ví dụ đó nằm sai chỗ.

Mỗi mã có **nhiều case**, từng case đặt ĐÚNG cạnh SAI, sau đó là mục **ngoại lệ và nhầm lẫn**. Phần
cuối trang ánh xạ từ yêu cầu bằng lời sang một hành động duy nhất.

---

## `LINT-ESCAPE-1` — source sản phẩm không chứa directive

### Case: cú pháp khai báo cho một thư viện bên ngoài

```ts
// SAI — src/types/vendor.d.ts
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace VendorTypes {}
```

```ts
// ĐÚNG — src/types/vendor.d.ts
declare module "vendor" {
  namespace VendorTypes {}
}
```

Hai bản chỉ khác nhau đúng một điều: **cấu hình của repo sở hữu cú pháp khai báo hợp lệ**, hay một
file tự treo luật cho riêng nó. Bản SAI đúng vào ngày nó được viết và sai kể từ file thứ hai cần
cùng cú pháp đó — vì file thứ hai không thừa hưởng được gì, nó phải tự viết lại directive.

### Case: một `any` để qua cho kịp

```tsx
// SAI — src/components/Report/index.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parse = (payload: any) => payload.rows
```

```tsx
// ĐÚNG — src/components/Report/index.tsx
type ReportPayload = { rows: ReadonlyArray<ReportRow> }

const parse = (payload: ReportPayload) => payload.rows
```

Directive ở bản SAI không mua thời gian, nó mua **sự im lặng**. Kiểu dữ liệu vẫn không được biết,
chỉ khác là từ giờ không còn ai được báo là nó không được biết.

### Case: cảnh báo dependency của hook

```tsx
// SAI — src/components/Filters/index.tsx
useEffect(() => {
  refetch(query)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

```tsx
// ĐÚNG — src/components/Filters/index.tsx
useEffect(() => {
  refetch(query)
}, [query, refetch])
```

Rule này báo một sự thật về vòng đời, không báo một sở thích. Tắt nó đi thì effect vẫn chạy sai, chỉ
là sai lặng lẽ, và người tìm ra sẽ tìm ở chỗ khác.

### Case: disable cả file

```tsx
// SAI — src/components/LegacyTable/index.tsx
/* eslint-disable */
export const LegacyTable = () => {
  return <table />
}
```

```tsx
// ĐÚNG — src/components/LegacyTable/index.tsx
export const LegacyTable = () => {
  return <table />
}
```

Một dòng ở đầu file đưa **toàn bộ** file ra khỏi luật, kể cả những rule chưa tồn tại vào ngày dòng đó
được viết. Người đọc tiếp theo không có cách nào biết mình đang đọc dưới tập luật nào.

### Case: cặp `eslint-disable` … `eslint-enable` ôm một khối

```tsx
// SAI — src/components/Chart/index.tsx
/* eslint-disable fe-canon/no-inline-style */
const axis = <g style={{ transform: "translate(0,8px)" }} />
/* eslint-enable fe-canon/no-inline-style */
```

```tsx
// ĐÚNG — src/components/Chart/index.tsx
const axis = <g className="translate-y-2" />
```

Cặp mở–đóng là bằng chứng nặng nhất của mã này: nó cho thấy vùng miễn trừ được **thiết kế**, có biên
trên và biên dưới, chứ không phải một lần lỡ tay. `eslint-enable` bị cấm cùng lý do với
`eslint-disable` — nó cũng là text làm đổi tập luật đang áp cho file.

### Ngoại lệ và nhầm lẫn

- **Prose nhắc tới directive là hợp lệ.** Directive được đọc từ ký tự không-trắng **đầu tiên** của
  comment. Câu dưới đây không bị bắt, và đó là chủ đích:

  ```tsx
  // src/components/Report/index.tsx
  // Ở đây không có eslint-disable: rule sẽ tắt dòng này chưa từng được bật trong repo.
  const rows = useRows()
  ```

  Pattern từng không được neo, và hậu quả là **đúng cái comment giải thích** bị báo lỗi — nên cách
  duy nhất để gate xanh là xoá lời giải thích đi. Đó là điều ngược hẳn với thứ luật này muốn.

- **Fixture của twin test không phải vi phạm.** Test cố ý dựng ra chuỗi directive để chứng minh rule
  bắt được:

  ```js
  // sources/fe/<law>.test.mjs
  { filename: "/repo/plugins/eslint/rule.test.mjs", code: "const fixture = 'eslint-disable'" }
  ```

  Rule chỉ soi source sản phẩm, và đó là **path gate duy nhất** trong artifact. Nó tồn tại cho fixture,
  không phải cho miễn trừ — xem `LINT-ESCAPE-3`.

- **Lý do viết càng kỹ càng đáng ngờ.** Một directive kèm ba dòng giải thích không phải một bypass
  được biện minh; nó là bằng chứng người viết biết rõ mình đang đi vòng và vẫn đi.

---

## `LINT-ESCAPE-2` — config đã resolve làm directive vô hiệu

### Case: gắn rule nhưng quên linter options

```js
// SAI — eslint.config.mjs
import feCanon, { recommended } from "./plugins/eslint-canon/index.mjs"

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "fe-canon": feCanon },
    rules: recommended,
  },
]
```

```js
// ĐÚNG — eslint.config.mjs
import feCanon, { linterOptions, recommended } from "./plugins/eslint-canon/index.mjs"

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "fe-canon": feCanon },
    rules: recommended,
    linterOptions,
  },
]
```

Bản SAI có **đủ** rule, ở **đủ** mức, và vẫn không có hàng rào: rule sẽ báo cáo directive, còn
directive thì vẫn có tác dụng. Đó là lý do artifact publish hai thứ này cạnh nhau và từ cùng một
import — để quên một cái đòi hỏi phải cố ý gỡ nó ra.

### Case: một block sau ghi đè `linterOptions`

```js
// SAI — eslint.config.mjs
export default [
  { files: ["src/**/*.{ts,tsx}"], plugins: { "fe-canon": feCanon }, rules: recommended, linterOptions },
  { files: ["src/legacy/**/*.tsx"], linterOptions: { noInlineConfig: false } },
]
```

```js
// ĐÚNG — eslint.config.mjs
export default [
  { files: ["src/**/*.{ts,tsx}"], plugins: { "fe-canon": feCanon }, rules: recommended, linterOptions },
]
```

Flat config lấy block đứng sau. Danh sách rule không đổi, nên mọi kiểm tra đếm rule vẫn xanh; thứ vừa
mất là điều kiện làm rule có nghĩa. Đây là ca mã 2 hỏng mà **không lộ ra ở bất kỳ file source nào**.

### Case: directive nhắm vào chính người canh

```text
SAI:  /* eslint-disable fe-canon/no-inline-lint-config */
      → không có noInlineConfig: rule bị tắt bởi đúng dòng nó phải báo cáo. Build xanh.
```

```text
ĐÚNG: /* eslint-disable fe-canon/no-inline-lint-config */
      → có noInlineConfig: directive không có tác dụng, rule vẫn report ở severity 2,
        kèm một report thứ hai nói chính directive đó không có tác dụng.
```

Hai report chứ không phải một, và đó là hình dạng đúng: một cái nói **luật nào bị vi phạm**, một cái
nói **cái bypass vừa rồi không đi tới đâu**. Twin test của artifact kiểm đúng ca này bằng một linter
thật chứ không bằng mô tả.

### Ngoại lệ và nhầm lẫn

- **"Đã bật rule rồi mà" không trả lời được mã này.** Rule có mặt là điều kiện của mã 1. Directive có
  tác dụng hay không là một sự thật khác, đọc ở `linterOptions` của config **đã resolve**, không phải
  ở file config đọc bằng mắt.
- **Đo một repo cụ thể là việc của luật khác.** Trường `refusesInlineConfig` thuộc mã
  `LINT-ADOPTION-4`. Mã ở đây nói: artifact phải **publish** options và chúng phải rời canon cùng
  với rule.
- **Block config cho thư mục test được thêm rule, không được thêm `linterOptions` riêng:**

  ```js
  // ĐÚNG — thêm ngôn ngữ và rule cho test, không đụng tới linterOptions
  { files: ["src/**/*.test.tsx"], rules: { "fe-canon/no-fixture-in-product": "off" } }
  ```

---

## `LINT-ESCAPE-3` — không có allowlist

### Case: miễn trừ theo đường dẫn cho đúng một component

```js
// SAI — eslint.config.mjs
export default [
  base,
  {
    files: ["src/components/StatRow/**"],
    rules: { "fe-canon/connected-block-has-presentational-twin": "off" },
  },
]
```

```js
// ĐÚNG — eslint.config.mjs
export default [base]
```

Ngoại lệ theo tên trở thành vĩnh viễn và **vô hình tại call site**: người dùng `StatRow` ở màn hình
thứ tư không có cách nào biết component đó đang sống ngoài một ranh giới kiến trúc. Danh sách này chỉ
có một chiều — dài thêm.

### Case: `ignores` cho một thư mục "trông như generated"

```js
// SAI — eslint.config.mjs
export default [base, { ignores: ["src/generated/**"] }]
```

```js
// ĐÚNG — sources/fe/<law>.mjs — nói ra *ca*, không nói ra *tên*
const isGeneratedArtifact = (sourceCode) =>
  /^\s*(@generated|Code generated by)\b/.test(sourceCode.getAllComments()[0]?.value ?? "")
```

"Trông như generated" là một **cảm giác về đường dẫn**; "khai báo mình là generated ở dòng đầu" là
một **sự thật kiểm được**. Cái thứ hai áp cho mọi file có cùng tính chất, kể cả file chưa tồn tại;
cái thứ nhất chỉ áp cho một thư mục cho tới lần đổi tên thư mục tiếp theo.

### Case: rule kiến trúc ở mức `warn`

```js
// SAI — eslint.config.mjs
export default [
  base,
  { rules: { "fe-canon/connected-block-has-presentational-twin": "warn" } },
]
```

```js
// ĐÚNG — eslint.config.mjs — bảo toàn mức của canon, trả nợ trước khi merge
export default [base]
```

`warn` cho phép **vi phạm mới** merge vào trong khi bảng điều khiển vẫn nói rằng ranh giới này có
người cai quản. Trong hai kiến trúc song song, cái yếu hơn luôn thắng, vì nó là cái không chặn ai.

### Case: xin thêm option allowlist cho chính rule

```js
// SAI — sources/fe/<law>.mjs
meta: {
  schema: [{ type: "object", properties: { allow: { type: "array" } } }],
}
```

```js
// ĐÚNG — sources/fe/<law>.mjs
meta: {
  schema: [],
}
```

`schema: []` là chỗ mã này được neo: rule **không nhận option**, nên không có trường nào để viết một
danh sách miễn trừ vào. Mở schema ra là biến luật thành một giá trị mặc định mà mỗi repo tự chỉnh.

### Case: một finding kiến trúc, xử lý bằng directive thay vì bằng ranh giới

```tsx
// SAI — src/components/StatRow/index.tsx
/* eslint-disable fe-canon/connected-block-has-presentational-twin */
return <StatRow props={{ label }} isLoading />
```

```tsx
// ĐÚNG — src/components/StatRow/index.tsx
return <_StatRow state="pending" props={{ label }} />
```

Hai bản khác nhau đúng một điều: **ranh giới connected/presentational còn tồn tại hay không**. Bản
SAI không giữ lại một khoản nợ nhỏ; nó xoá mất chỗ mà trạng thái `pending` lẽ ra phải được diễn đạt,
và mỗi state sau đó sẽ được thêm vào cùng chỗ sai đó.

### Ngoại lệ và nhầm lẫn

- **Glob là *ở đâu*, không phải *cho ai*.** Monorepo và single-app không cùng hình dạng thư mục, và
  đó là sự thật của repo:

  ```js
  // ĐÚNG — cùng một bộ rule, khác nơi áp
  { files: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"], ...canon }
  ```

  Cái này không mở gì cho một file **nằm trong** vùng đã cai trị. Một glob bị bẻ cong đúng bằng chỗ
  vừa đỏ là allowlist mặc áo config.

- **Migration dở dang không kiếm được suất miễn trừ:**

  ```text
  SAI:  ignores: ["src/v1/**"] cho tới khi migrate xong
  ĐÚNG: ghi vào sổ nợ kèm giá, giữ `error` ở mọi nơi rule đã có, sửa theo từng nhóm
  ```

  Ghi lại một khoảng thiếu giữ cho con số trung thực; hạ mức hoặc `ignores` làm ranh giới thành tuỳ
  chọn cho tất cả những người tới sau.

- **Sửa rule là đường thoát hợp lệ duy nhất, và nó cố ý đắt.** Một ca hợp lệ được nêu ra trong matcher
  dùng chung, kèm twin test, trong một diff được review như một thay đổi luật — vì nó là một thay đổi
  luật.
- **Component mỏng, ranh giới vendor, file khai báo: không cái nào là một hạng miễn trừ.** Chúng là
  những **ca**, và ca thì thuộc về config dùng chung hoặc một type đóng.

---

## Ánh xạ yêu cầu sang một hành động

Nêu file, directive (nếu có) và ca mà nó đang bảo vệ. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng. Câu trả lời phải là một hành động hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Thêm `eslint-disable-next-line` một dòng cho kịp demo" | File tự quyết luật có áp cho nó không | `LINT-ESCAPE-1` | Từ chối; sửa code, hoặc sửa rule dùng chung |
| "Mình ghi lý do rõ ràng bên cạnh rồi mà" | Lý do ghi lại bypass, không cho phép bypass | `LINT-ESCAPE-1` | Từ chối; nói ca đó ra ở config dùng chung hoặc type đóng |
| "Disable cả file này thôi, nó sắp bị viết lại" | Cả file ra khỏi luật, kể cả rule chưa tồn tại | `LINT-ESCAPE-1` | Từ chối; ghi nợ, sửa theo nhóm |
| "Rule chạy rồi, có cần `linterOptions` không?" | Báo cáo không phải vô hiệu hoá | `LINT-ESCAPE-2` | Gắn `linterOptions` từ cùng import với rule |
| "Cho `src/legacy` được honour inline config" | Block sau gỡ mất điều kiện làm rule có nghĩa | `LINT-ESCAPE-2` | Từ chối; bỏ block ghi đè |
| "Tắt rule này cho đúng thư mục `generated`" | Allowlist theo tên, vĩnh viễn và vô hình | `LINT-ESCAPE-3` | Nói ra *ca* trong matcher: file tự khai báo là generated |
| "Bật dần, tuần này để `warn`" | Vi phạm mới vẫn merge trong khi trông như đã được cai quản | `LINT-ESCAPE-3` | Giữ `error`; trả nợ trước khi merge |
| "Thêm option `allow` cho rule để bỏ qua vài chỗ" | Luật thành giá trị mặc định mỗi repo tự chỉnh | `LINT-ESCAPE-3` | Giữ `schema: []`; sửa ca trong matcher |
| "Monorepo thì glob khác, chỉnh luôn rule cho hợp" | Glob thuộc repo, rule thì không | `LINT-ESCAPE-3` | Đổi glob, không đụng rule hay mức |
| "Rule này bắt sai comment giải thích của mình" | Directive được đọc từ đầu comment | `LINT-ESCAPE-1` | Kiểm pattern đã neo chưa; nếu chưa, sửa matcher kèm twin test |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `LINT-ESCAPE-1` / `LINT-ESCAPE-2` | Thứ đang sai nằm **trong source**, hay nằm ở **điều kiện của config**? |
| `LINT-ESCAPE-1` / `LINT-ESCAPE-3` | Một file tự miễn trừ cho mình, hay repo tạo sẵn chỗ miễn trừ để không ai phải tự viết? |
| `LINT-ESCAPE-2` / `LINT-ESCAPE-3` | Directive còn tác dụng không, hay rule đã bị gỡ khỏi tầm với của một đường dẫn? |
| `LINT-ESCAPE-1` / prose hợp lệ | Ký tự không-trắng đầu tiên của comment có phải `eslint-` không? |
| `LINT-ESCAPE-3` / glob của repo | Thứ đang khác nhau là **luật nói gì**, hay **luật áp ở đâu**? |
| `LINT-ESCAPE-3` / sửa rule | Cái sắp thêm vào nói lên một **ca**, hay nói lên một **cái tên**? |
| `LINT-ESCAPE-2` / `LINT-ADOPTION-4` | Đang hỏi artifact publish gì, hay hỏi một repo cụ thể đã resolve ra gì? |

## Sai lầm lặp lại nhiều nhất

1. Coi `eslint-disable-next-line` là một hành động kỹ thuật, trong khi nó là một hành động quản trị.
2. Tin rằng lý do viết bên cạnh làm bypass hợp lệ.
3. Gắn đủ rule rồi quên `linterOptions`, và gọi đó là đã dựng hàng rào.
4. Để một block config đứng sau ghi đè `linterOptions` mà không ai đọc ra, vì danh sách rule không đổi.
5. Xin `ignores` cho một thư mục thay vì nói ra ca hợp lệ trong matcher.
6. Hạ rule kiến trúc xuống `warn` và gọi đó là rollout.
7. Mở `schema` của rule ra để nhận allowlist.
8. Bẻ glob đúng bằng chỗ vừa đỏ, rồi gọi đó là cấu hình của repo.
9. Xử lý một finding kiến trúc bằng directive, làm mất luôn chỗ mà state lẽ ra được diễn đạt.
10. Viết pattern bắt directive **không neo**, rồi báo lỗi đúng cái comment giải thích vì sao file
    không có directive.
