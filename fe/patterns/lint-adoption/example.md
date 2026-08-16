---
id: fe-patterns-lint-adoption-example
title: example.md
slug: /fe/patterns/lint-adoption/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã LINT-ADOPTION-N, viết bằng flat config thường và TSX thường.
---

# example.md

> Version: `2.00` · Module: `lint-adoption` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **flat config thường và TSX thường**. Namespace plugin viết là `fe-canon` chỉ
để đọc được; luật không đổi khi nó được đánh vần khác đi. Nếu một ví dụ cần tên riêng của một sản
phẩm mới hiểu được thì ví dụ đó nằm sai chỗ.

Mỗi mã có **nhiều case**, từng case đặt ĐÚNG cạnh SAI, sau đó là mục **ngoại lệ và nhầm lẫn**. Phần
cuối trang ánh xạ từ yêu cầu bằng lời sang một hành động duy nhất.

---

## `LINT-ADOPTION-1` — gắn nguyên khối, không tự cắt subset

### Case: config tự liệt kê tên rule

```js
// SAI — eslint.config.mjs
import feCanon from "./plugins/eslint-canon/index.mjs"

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "fe-canon": feCanon },
    rules: {
      "fe-canon/no-inline-lint-config": "error",
      "fe-canon/contract-why-is-a-reason": "error",
      "fe-canon/no-public-classname-prop": "error",
    },
  },
]
```

```js
// ĐÚNG — eslint.config.mjs
import feCanon, {
  canonConfig,
  linterOptions,
  recommended,
} from "./plugins/eslint-canon/index.mjs"

export default [
  canonConfig({
    layout: "single-app",
    plugin: feCanon,
    recommended,
    linterOptions,
  }),
]
```

Danh sách viết tay ở bản SAI đúng vào ngày nó được viết. Vấn đề nằm ở ngày canon thêm rule thứ tư:
bản SAI vẫn xanh, vẫn "đã import plugin", và không ai được báo là repo này đang thiếu một luật.

### Case: lấy plugin nhưng tự chọn mức

```js
// SAI
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "fe-canon": feCanon },
    rules: Object.fromEntries(
      Object.keys(recommended).map((name) => [name, "warn"]),
    ),
  },
]
```

```js
// ĐÚNG
export default [canonConfig({ layout: "single-app", plugin: feCanon, recommended, linterOptions })]
```

Bản SAI chứng minh chính xác vì sao ba thứ phải đi cùng nhau: nó nhận tên rule từ canon rồi thay mức
bằng ý kiến của mình. Recommendation không phải một danh sách tên — nó là **tên kèm mức**.

### Case: quên linter options

```js
// SAI — đủ rule, thiếu điều kiện làm directive vô hiệu
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "fe-canon": feCanon },
    rules: { ...recommended },
  },
]
```

```js
// ĐÚNG
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions,
    plugins: { "fe-canon": feCanon },
    rules: { ...recommended },
  },
]
```

### Case: cùng một luật, hai hình dạng repo

```js
// ĐÚNG — monorepo
export default [canonConfig({ layout: "monorepo", plugin: feCanon, recommended, linterOptions })]
```

```js
// ĐÚNG — single app
export default [canonConfig({ layout: "single-app", plugin: feCanon, recommended, linterOptions })]
```

Khác nhau đúng một chữ, và chữ đó là **nơi luật áp**, không phải luật. Hai danh sách glob nuôi tay ở
hai repo từng lệch nhau tới mức một bên bật 43 rule, bên kia 53, trong khi canon có 49 — và không
bên nào sai có chủ ý, chỉ là không có gì nói cho họ biết.

### Ngoại lệ và nhầm lẫn

- **Plugin khác của repo vẫn được giữ.** Ngoại lệ này thuộc `LINT-ADOPTION-1` và chỉ nói về những
  rule không thuộc canon:

  ```js
  // ĐÚNG
  export default [
    { ignores: ["dist/**", ".next/**"] },
    someUnrelatedPlugin.configs.recommended,
    canonConfig({ layout: "single-app", plugin: feCanon, recommended, linterOptions }),
  ]
  ```

- **Sửa tay vào thư mục mirror là tạo canon thứ hai**, kể cả khi nội dung sửa là đúng:

  ```text
  SAI:  plugins/eslint-canon/tokens.mjs      ← sửa trực tiếp tại đây
  ĐÚNG: sources/fe/tokens.mjs                ← sửa ở cây trust, rồi mirror lại
  ```

- **Import xuyên repo không phải "một nguồn duy nhất":**

  ```js
  // SAI — chỉ resolve được khi hai checkout nằm cạnh nhau
  import feCanon from "../../trust-workspace/.claude/sources/fe/index.mjs"
  ```

  Clone một repo, chạy CI chỉ fetch một repo, build Docker chỉ copy một thư mục — config không load
  nổi. Một bộ rule biến mất khi thiếu hàng xóm không phải nguồn duy nhất, nó là một dependency không
  ai khai báo.

- **Recommendation rỗng phải nổ, không được im lặng:**

  ```js
  // SAI — spread nhầm một tầng, block ra đời với zero rule và repo vẫn xanh
  rules: { ...recommended.rules.rules }
  ```

  Đây là kiểu hỏng tệ nhất của mã này: xanh, im lặng, và không phân biệt được với thành công.

---

## `LINT-ADOPTION-2` — đo trên file production thật

### Case: đọc config bằng mắt so với in config ra

```text
SAI:  mở eslint.config.mjs, thấy tên plugin quen, kết luận "repo đã adopt"
```

```powershell
# ĐÚNG
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe src/components/pages/settings/component.tsx
```

File config nói **ý định**. `--print-config` nói **kết quả sau khi ESLint merge mọi tầng**. Hai thứ
này chỉ trùng nhau khi không có gì bất ngờ, và nếu chắc chắn không có gì bất ngờ thì đã không cần
đo.

### Case: probe trỏ nhầm chỗ

```powershell
# SAI — file test không phải thứ được ship
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe src/utils/date.test.ts
```

```powershell
# ĐÚNG — một file thật trong cây source production
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe src/components/blocks/enrollment-summary/component.tsx
```

### Case: đọc kết quả, không đọc cảm giác

```json
{
  "ok": false,
  "missing": ["fe-canon/no-public-classname-prop"],
  "nonError": ["fe-canon/contract-why-is-a-reason"],
  "refusesInlineConfig": false
}
```

Ba dòng, ba mã khác nhau: `missing` chỉ về `LINT-ADOPTION-1`, `nonError` về `LINT-ADOPTION-3`,
`refusesInlineConfig` về `LINT-ADOPTION-4`. Một chữ "lint đang hỏng" không phân biệt được ba việc
phải làm khác nhau.

### Ngoại lệ và nhầm lẫn

- **Source candidate cũng nằm trong tập được đo:**

  ```js
  // ĐÚNG — glob cố ý phủ cả cây candidate
  files: ["src/**/*.{ts,tsx}", "**/candidate/src/**/*.{ts,tsx}"]
  ```

  ```js
  // SAI — đúng cái file sẽ thành production là file duy nhất không ai soi
  files: ["src/**/*.{ts,tsx}"]
  ```

- **`npm run lint` xanh không phải bằng chứng adoption:**

  ```text
  SAI:  "lint xanh" → repo được cai trị bởi bao nhiêu rule? không ai trả lời được
  ĐÚNG: ok: true, missing: [], nonError: [], refusesInlineConfig: true
  ```

  Xanh dưới zero rule và xanh dưới 49 rule in ra giống hệt nhau.

---

## `LINT-ADOPTION-3` — mọi rule resolve ra `error`

### Case: rollout bằng warning

```js
// SAI
rules: Object.fromEntries(Object.keys(recommended).map((name) => [name, "warn"]))
```

```js
// ĐÚNG
rules: { ...recommended }
```

`warn` không phải một giai đoạn. Nó là một tuyên bố rằng ranh giới kiến trúc này là tuỳ chọn, và mọi
tác giả tới sau đều đọc được tuyên bố đó.

### Case: một glob "legacy" được miễn

```js
// SAI
export default [
  canonConfig({ layout: "single-app", plugin: feCanon, recommended, linterOptions }),
  {
    files: ["src/legacy/**/*.{ts,tsx}"],
    rules: { "fe-canon/no-public-classname-prop": "off" },
  },
]
```

```js
// ĐÚNG — nợ được ghi ra, mức thì không đổi
export default [
  canonConfig({ layout: "single-app", plugin: feCanon, recommended, linterOptions }),
]
```

Block đứng sau trong flat config **thắng**. Một dòng `off` cho một glob trông như phạm vi hẹp, thực
tế là gỡ hẳn rule khỏi phần source đang cần nó nhất.

### Case: mức viết dạng mảng

```js
// SAI — có option, nhưng mức là warn
rules: { "fe-canon/icon-size-is-a-token": ["warn", { allow: ["inline"] }] }
```

```js
// ĐÚNG
rules: { "fe-canon/icon-size-is-a-token": ["error", { allow: ["inline"] }] }
```

Audit quy mọi cách đánh vần mức về một con số, nên `"warn"`, `1` và `["warn", …]` rơi vào cùng một
danh sách `nonError`. Cấu hình option không phải là chỗ để giấu một mức thấp hơn.

### Ngoại lệ và nhầm lẫn

- **`missing` không sửa bằng cách thêm tay vào `rules`:**

  ```js
  // SAI — vá đúng cái triệu chứng mà mã 1 đang cố nói
  rules: { ...recommended, "fe-canon/rule-vua-them": "error" }
  ```

  ```text
  ĐÚNG: mirror lại từ cây trust, rồi chạy lại audit
  ```

- **Rule chưa mang sang được thì ghi vào sổ nợ, không hạ mức ở nơi khác:**

  ```text
  ĐÚNG: sổ nợ ghi tên rule, module nó sẽ về, và giá của việc mang nó về
  SAI:  hạ cả bộ xuống warn cho tới khi mang đủ
  ```

- **Hai repo cùng canon mà đếm ra hai số lỗi khác nhau là một phát hiện**, không phải một khác biệt
  tự nhiên giữa hai codebase.

---

## `LINT-ADOPTION-4` — config đã resolve từ chối inline config

### Case: đủ rule, thiếu `noInlineConfig`

```js
// SAI
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "fe-canon": feCanon },
    rules: { ...recommended },
  },
]
```

```js
// ĐÚNG
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: { noInlineConfig: true },
    plugins: { "fe-canon": feCanon },
    rules: { ...recommended },
  },
]
```

### Case: một block sau ghi đè mất

```js
// SAI — block cuối thắng, và nó vừa mở lại toàn bộ đường thoát
export default [
  canonConfig({ layout: "single-app", plugin: feCanon, recommended, linterOptions }),
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: { reportUnusedDisableDirectives: true },
  },
]
```

```json
{ "ok": false, "missing": [], "nonError": [], "refusesInlineConfig": false }
```

Đây chính là loại lỗi mà đọc file config bằng mắt không bắt được: cả hai block đều trông hợp lý, chỉ
có kết quả merge là sai. Output audit gọi tên nó bằng một trường duy nhất.

### Case: directive trong source sản phẩm

```tsx
// SAI
/* eslint-disable fe-canon/no-public-classname-prop */
export const PriceTag = ({ className, amount }: Props) => (
  <span className={className}>{amount}</span>
)
```

```tsx
// ĐÚNG
export const PriceTag = ({ tone, amount }: Props) => (
  <span className={tone === "muted" ? "text-sm text-neutral-500" : "text-sm"}>{amount}</span>
)
```

Hai bản khác nhau đúng một thứ: bản dưới không còn cho người gọi mở một cánh cửa CSS vào node mà họ
không sở hữu. Bản trên bảo toàn cánh cửa đó và chỉ tắt người đang chỉ vào nó.

### Case: directive kèm lý do rất hợp lý

```tsx
// SAI
// eslint-disable-next-line fe-canon/no-inline-lint-config -- vendor chưa hỗ trợ, sẽ bỏ sau sprint
export const Chart = ({ data }: Props) => <VendorChart data={data} />
```

```tsx
// ĐÚNG — cú pháp hợp lệ được biểu đạt ở tầng cấu hình dùng chung, không ở một file
export const Chart = ({ data }: Props) => <VendorChart data={data} />
```

Một lý do viết bên cạnh **ghi lại** việc lách luật; nó không ngăn việc lách luật. Và với
`noInlineConfig: true`, dòng comment ấy còn không có tác dụng — nó chỉ còn là một ghi chú sai.

### Ngoại lệ và nhầm lẫn

- **Không có allowlist theo đường dẫn.** File vendor, file declaration, file trông như generated và
  công việc migration tạm đều không mua được ngoại lệ cục bộ.
- **Rule báo directive và `noInlineConfig` là hai thứ khác nhau, cần cả hai.** Chỉ có rule: directive
  vẫn tắt được chính rule đó. Chỉ có option: hỏng thì im lặng, không ai biết vì sao dòng comment
  không ăn.

---

## `LINT-ADOPTION-5` — audit đỏ thì dừng trước khi sửa source

### Case: bắt đầu một pass trên repo đang đỏ

```text
SAI:  audit ok:false → vẫn mở file .tsx và sửa tiếp, "lint tính sau"
ĐÚNG: audit ok:false → dừng, sửa wiring trong boundary đã duyệt, chạy lại, rồi mới sửa sản phẩm
```

```powershell
# ĐÚNG — thứ tự trong một pass
node <trust-root>/scripts/sync-fe-lint.mjs --target <repo> --write
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe src/components/pages/settings/component.tsx
# chỉ khi ok: true mới bắt đầu sửa source sản phẩm
```

### Case: trộn diff wiring và diff sản phẩm

```text
SAI:  một commit chứa cả mirror mới, cả 14 file .tsx sửa theo rule mới
ĐÚNG: commit 1 = wiring; commit 2… = từng nhóm sửa sản phẩm mà wiring vừa làm lộ ra
```

Trộn lại thì không ai đọc được cái nào gây ra cái nào, và một sửa sai trong nhóm sau kéo theo việc
revert cả hàng rào.

### Case: một pass đo lường trên repo chưa adopt

```text
SAI:  khảo sát trùng lặp component, báo kết quả, trong khi audit đang ok:false
ĐÚNG: dừng khảo sát, trả về pass lint-sync, quay lại đo sau khi ok:true
```

Số liệu đo dưới một tập luật không đầy đủ không phải số liệu sai một chút — nó là số liệu của một
repo khác.

### Ngoại lệ và nhầm lẫn

- **Sửa wiring không phải sửa sản phẩm.** Ngoại lệ này thuộc `LINT-ADOPTION-5` và chỉ mở đúng một
  việc: chữa cái config vừa đỏ, trong boundary đã duyệt trước khi bắt đầu.
- **`ok: true` là điều kiện mở pass, không phải điều kiện đóng pass.** Đóng pass còn cần chính lint
  của repo đích chạy sạch.
- **Không có "sửa một dòng nên bỏ qua".** Kích thước diff không quyết định nó được chấm bởi tập luật
  nào.

---

## Ánh xạ yêu cầu sang một hành động

Nêu repo, file probe và pha công việc. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Repo này adopt canon chưa?" | Sự hiện diện của plugin không trả lời được | `LINT-ADOPTION-2` | Chạy audit với một probe production, đọc bốn trường |
| "Thêm giúp mấy rule canon vào config" | Danh sách viết tay là canon thứ hai | `LINT-ADOPTION-1` | Spread khối gắn kèm, không liệt kê tên rule |
| "Bật dần, tuần này để warn thôi" | Warning làm ranh giới thành tuỳ chọn | `LINT-ADOPTION-3` | Sửa nợ trước, rồi bật đủ ở `error` |
| "Cho `src/legacy` được miễn rule này" | Block sau gỡ hẳn rule khỏi nơi cần nhất | `LINT-ADOPTION-3` | Từ chối miễn trừ, ghi nợ nếu chưa sửa kịp |
| "Thêm `eslint-disable` một dòng thôi cho kịp demo" | File tự quyết luật có áp cho nó không | `LINT-ADOPTION-4` | Sửa code hoặc sửa rule dùng chung; giữ `noInlineConfig: true` |
| "Audit đỏ nhưng cứ làm tính năng trước đi" | Code được chấm bởi tập luật không đầy đủ | `LINT-ADOPTION-5` | Dừng, sửa wiring trong boundary đã duyệt, đo lại |
| "Monorepo thì glob khác, sửa luôn rule cho hợp" | Glob thuộc repo, rule thì không | `LINT-ADOPTION-1` | Đổi `layout`, không đụng vào rule |
| "Mirror bị lệch, sửa nhanh tại chỗ nhé" | Bản sao sửa tay là canon thứ hai | `LINT-ADOPTION-1` | Sửa ở cây trust rồi mirror lại |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `LINT-ADOPTION-1` / `LINT-ADOPTION-2` | Đang hỏi rule có tới nơi không, hay hỏi lấy gì chứng minh nó tới? |
| `LINT-ADOPTION-1` / `LINT-ADOPTION-3` | Rule vắng mặt (`missing`), hay có mặt mà yếu (`nonError`)? |
| `LINT-ADOPTION-3` / `LINT-ADOPTION-4` | Mức của rule sai, hay một comment trong file tắt được nó? |
| `LINT-ADOPTION-2` / `LINT-ADOPTION-5` | Chưa đo, hay đã đo ra đỏ mà vẫn đi tiếp? |
| `LINT-ADOPTION-4` / luật `lint-escape-hatch` | Đang nói về điều kiện của config, hay về directive nằm trong source? |
| Mọi mã / ngoại lệ glob | Thứ đang khác nhau là **luật nói gì**, hay **luật áp ở đâu**? |

## Sai lầm lặp lại nhiều nhất

1. Kết luận adoption từ một dòng import hoặc một tên thư mục.
2. Viết tay lại danh sách rule "cho gọn", rồi đứng yên khi canon thay đổi.
3. Nhận tên rule từ canon nhưng tự quyết mức.
4. Gắn đủ rule mà quên linter options, hoặc để một block sau ghi đè mất.
5. Probe bằng một file test hay file config thay vì file đang ship.
6. Hạ `warn` để repo xanh, rồi gọi đó là rollout.
7. Sửa trực tiếp vào bản mirror thay vì sửa ở cây trust.
8. Đọc `ok: false` như một cảnh báo rồi vẫn mở file sản phẩm ra sửa.
