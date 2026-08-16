# CONTINUE — bàn giao phiên 2026-08-16

Đọc file này trước khi làm tiếp. Nó nói **cây đang ở đâu**, **cổng nào đỏ và vì sao**, và **việc gì
còn nợ, theo thứ tự nên làm**.

Ba cổng đang đỏ. **Hai trong ba là đỏ đúng** — chúng vừa được sửa để có thể kêu, và chúng đang kêu.
Đừng làm chúng xanh bằng cách nới; xanh lại chỉ khi lỗi thật được xử.

---

## 1. Cây đang ở đâu

Shelf `fe/design/` đã tách làm ba, và hai shelf mới được dựng.

| Shelf | Module | File | Mã | Trạng thái |
|---|---|---|---|---|
| `fe/principles/` | 26 | 130 | 195 | xong, `2.00` |
| `fe/patterns/` | 18 | 90 | 128 | xong, `2.00` |
| `be/patterns/` | 15 | 75 | 99 | xong, `2.00` |
| `fe/lints/` | 16 | 80 | — | xong, `2.00` |
| `be/lints/` | 15 | 75 | — | xong, `2.00` |
| `fe/senses/` | 5 | 27 | — | **còn `1.02–1.03`** |
| `fe/governance/` | 2 | 10 | — | **còn `1.02–1.03`** |

Mỗi module năm record: `INDEX.md` · `vi.md` · `example.md` · `audit.md` · `changelog.md`.
`prompt.md` đã gộp vào `example.md` ở mọi shelf mới; hai module `senses` (`call-to-action`, `input`)
vẫn còn nó.

**Hình dạng từng shelf** — validator ở `docs/scripts/validate-design-modules.mjs` biết ba template:

- `principles-v2` — `Law` · `Situation Codes` · `Inputs` · `Invariants` · `Exceptions` · `Output` ·
  `Load Policy` · `Scope` · `Version Rule`
- `patterns-v2` — như trên, cộng **`Tầng giữ`** (mã này ai giữ: *unrepresentable* / *enforced* /
  *documented*) và **`Anchor`** (mã này trỏ vào code thật nào)
- `lints-v2` — `Rules` · `Detection` · **`Escape Hatches`** (hai bảng: *Closed* và *Open*)

### Con số đáng nhìn nhất

**572 cửa lách còn mở** (FE 292, BE 280) — đếm từ bảng `Open` của 31 module `lints`. Đó là số cách
viết mà lint **không bắt được** và trước phiên này **không ai biết**. Nó là thước đo canon đang tự
tin quá mức bao nhiêu phần.

**230 mã luật / 95 rule = 41% leo lên tầng thi hành.** Bảng `Tầng giữ` biến con số đó từ thứ ai đó
phải đi đo thành sổ mà cây tự khai.

---

## 2. Hai npm package đã phát hành

| Package | Version | Rule | Luật |
|---|---|---|---|
| `@starci/eslint-canon-fe` | `1.0.1` | 58 | 16 |
| `@starci/eslint-canon-be` | `1.0.1` | 37 | 15 |

Cả hai **public**. Manifest nằm ngay trong `sources/fe/` và `sources/be/` — **không có thư mục
`packages/` nào copy rule vào**. Tarball publish ra **chính là** source được viết, nên drift không
bị phát hiện, nó **không tồn tại được**.

`scripts/verify-lint-packages.mjs` chứng minh thứ `npm publish` không bao giờ kiểm: mọi file
`index.mjs` import đều nằm trong tập publish. Chạy nó trước mỗi lần publish.

```bash
node scripts/verify-lint-packages.mjs
```

---

## 3. Ba cổng đỏ

### ĐỎ ĐÚNG — `no two laws publish the same rule name` + `every declared rule survives`

`sources/be/` có **ba rule bị hai luật cùng khai**. Xem phiếu
[`debt/three-be-rules-are-declared-by-two-laws-and-one-copy-is-discarded.md`](debt/three-be-rules-are-declared-by-two-laws-and-one-copy-is-discarded.md).

Tóm tắt: `e2e-flow.mjs` và `testing.mjs` mỗi file khai 5 rule, trùng nhau 3
(`e2e-uses-production-transport`, `e2e-asserts-persisted-state`, `no-model-call-in-e2e`).
`Object.fromEntries` gộp → `testing` thắng, bản `e2e-flow` **biến mất**. Laws khai **40**, plugin
ship **37**.

Và cái test lẽ ra bắt được thì **không thể kêu**: nó duyệt `ruleOwners`, mà `ruleOwners` chính nó
được dựng bằng `Object.fromEntries` — trùng đã bị gộp trước khi test nhìn. `owners.length > 1` không
bao giờ đúng. **Test PASS suốt đời trong khi ba va chạm ship bên dưới.**

Đã sửa: cả hai trục export `ruleDeclarations` (danh sách thô, một entry mỗi **lần khai** thay vì mỗi
tên còn sống), guard duyệt nó. Thêm một test so **số khai** với **số ship** — sai lệch là đỏ, dù va
chạm có thoát khỏi phép so tên vì lý do gì.

**Việc còn lại là một QUYẾT ĐỊNH, không phải sửa máy móc.** Hai bản khác nhau: bản `e2e-flow` có
thêm nhánh bắt receiver kết thúc bằng `Worker` hoặc `Handler`. Chọn hướng nào cũng **đổi thứ linter
báo trong repo đang chạy**. Theo tên và theo nghĩa, ba rule đọc như của `e2e-flow`; theo thứ đang
ship, chúng là của `testing`.

FE đã chứng minh sạch: **58 khai = 58 ship**.

### ĐỎ CŨ — `every phase carries the workflow contract`

`skills/starci-be-audit-apply/SKILL.md` thiếu mục `## PROCESS`. Có từ **trước** phiên này. Bộ ba
`starci-be-audit-*` cũng **không có trong bảng capability của `INDEX.md`** — `skills/` có 10 bộ ba,
INDEX liệt kê 9.

---

## 4. Việc còn nợ, theo thứ tự

### 4.1 Revoke token npm — **làm trước, đây là thứ duy nhất rủi ro tăng theo thời gian**

Token đã xuất hiện trong khung chat của một phiên. npmjs.com → Access Tokens → revoke → tạo mới.
Mấy việc dưới chỉ là nợ; cái này là lỗ hổng.

### 4.2 Trả 7 rule về canon rồi ra `1.1.0`

`no-per-part-classname-prop` · `no-public-classname-prop` · `no-public-frame-css-props` ·
`no-css-door-type-laundering` · `source-tier-marker-matches-folder` · `contract-children-are-typed` ·
`no-parallel-skeleton`

Bảy rule này **đang chạy trong `starci-academy-fe`** mà canon không có — phiếu
[`debt/seven-fe-lint-rules-live-only-in-a-repository-plugin.md`](debt/seven-fe-lint-rules-live-only-in-a-repository-plugin.md).
Nên `1.0.1` phát hành ra **yếu hơn** bộ luật repo thật sự đang chạy. Kéo về thì FE lên **65 rule**.

### 4.3 Quyết ba rule trùng tên (mục 3), rồi hai cổng kia xanh lại

### 4.4 Sửa `gate:canon` bên `starci-academy-fe`

```
"gate:canon": "node ../starci-academy-backend/.claude/scripts/sync-fe-lint.mjs --target ."
```

Dòng này trỏ `C:\Repositories\starci-academy-backend`, backend thật nằm trong `ac/`. Chạy ra
`MODULE_NOT_FOUND`, kéo `npm run lint` **và** `npm run verify` chết theo. Giờ có package rồi thì
thay bằng dependency là hết phụ thuộc vị trí checkout.

Cùng repo, `npm run test:rules` glob `plugins/eslint/*.test.mjs` trong khi thư mục thật tên
`plugins/eslint-canon/` → `tests 0 … fail 0`, **xanh vì không kiểm gì**.

### 4.5 Viết `scripts/validate-code-uniqueness.mjs`

Quét toàn cây, báo mã nào có **hai chủ**, phân biệt **định nghĩa** với **trích dẫn chéo**. Logic đã
có sẵn trong gate của workflow `patterns`, chỉ cần rút ra thành script.

Phiên này va chạm mã bị dời **hai lần** mới đặt đúng chỗ, lần thứ hai do chính việc sửa lần đầu gây
ra. Không có gate, chuyện đó sẽ lặp lại.

### 4.6 Hai module `lints` thiếu ví dụ

`be/lints/cdc/example.md` (15) và `be/lints/event-delivery/example.md` (16) — dưới ngưỡng 20. Mọi
module khác ≥ 20, cao nhất `fe/lints/contract` 85.

### 4.7 Nâng `senses` và `governance` lên `2.00`

7 module còn `1.02–1.03`, chưa có mã `<NAME>-<index>`, 2 module còn `prompt.md`.

### 4.8 `starci-be-audit-*`

Thêm `## PROCESS` vào `starci-be-audit-apply/SKILL.md`, và thêm bộ ba vào bảng capability của
`INDEX.md`.

---

## 5. Cạm bẫy đã trả giá trong phiên — đừng trả lại

**Mã phải có đúng một chủ, và đổi mã thì phải quét TOÀN cây trước.** Ba va chạm đã tìm ra:

| Mã | Hai chủ | Xử lý |
|---|---|---|
| `TYPE-2` | `fe/typography` *"bốn cấp heading"* vs `be/type-safety` *"no double cast"* | FE → `TYPESET-*` |
| `LAYOUT-1…6` | `fe/patterns/file-layout` vs `fe/canon/uxui/layers/layout` | `file-layout` → `FILE-*` |
| `FLOW-1` | `be/e2e-flow` vs `fe/principles/flow` | BE → `E2E-*` |

Lần `TYPOGRAPHY` là **lỗi tự gây**: gạt va chạm với BE sang thì đâm vào `principles`. Đổi mã mà
không kiểm không gian tên đích chỉ là **dời va chạm**.

Tám tiền tố trong `fe/canon/uxui/layers/` nhất quán tuyệt đối — `BLOCK` `BRANCH` `COMPOSITE`
`LAYOUT` `LEAF` `OVERLAY` `PAGE` `SHELL`. **Đừng đổi cái nào trong đó**; kẻ khác phải nhường.

**Đừng tin báo cáo tự chấm.** Đợt `principles` đầu, 7 agent verify chấm 7/7 pass trong khi `margin`
dùng mã chữ sai luật, và 5/7 báo số ví dụ cao hơn thật. Từ đợt sau trò bỏ verify agent, thay bằng
gate chạy lệnh thật — và chính gate đó tìm ra ba rule bị nuốt.

**Định danh đang ship không phải "tên sản phẩm".** `starci-fe/no-double-cast` phải giữ nguyên trong
tài liệu vì đó là **đúng chuỗi build log in ra**. Lệnh cấm tên sản phẩm nhắm vào **văn xuôi và ví
dụ**. Mục `Scope` của 11 module `patterns` đã được ghi rõ ngoại lệ này.

**Cổng quét markdown phải bỏ code trước.** `links.test.mjs` từng đọc `foo[i](bar)` trong ví dụ JS
thành link chết. Nó đúng một cách tình cờ khi cây chưa có mấy code block; qua mốc hơn một nghìn ví
dụ thì nó báo động giả hàng loạt. Đã sửa để strip fenced block và inline span trước khi tìm link.

**Đừng chạy hai workflow nặng song song** trừ khi cái đang chạy sắp xong. Và **đừng sửa file trong
thư mục một agent đang ghi** — đó là lý do `fe/lints/file-layout/` phải đổi mã ở lượt sau.

---

## 6. Chạy lại mọi cổng

```bash
npm test
```

```bash
cd docs && npm run validate
```

```bash
node scripts/verify-lint-packages.mjs
```

Cổng thứ hai kiểm `fe/{principles,senses,governance}` — **chưa** kiểm `patterns` và `lints`. Mở rộng
nó là việc đáng làm sớm, vì hai shelf lớn nhất hiện không có cổng nào canh hình dạng.
