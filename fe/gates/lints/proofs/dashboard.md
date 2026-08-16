---
id: fe-lints-proof-dashboard
title: dashboard
slug: /gates/lints/proofs/dashboard
sidebar_label: dashboard
description: Chấm gate lints trên màn dashboard — 59 rule chạy thật trong lab có đối chứng, hai chỗ chặn đúng, và một phát hiện canon tự mâu thuẫn.
---

# dashboard · gate lints

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate patterns: `SourcePlan` gồm 60 file (8 file có mã thật trong `sourceSketch`), 25 contract entry đầy đủ, `split`, `meta`, `mainLandmarkOwner`, 34 khoá dịch, 47 quyết định, 8 dòng nợ.

## EXPECTED OUT

Gate lints không có `expected` riêng trong fixture. Chuẩn để chấm là `expected.lints` của trang dashboard — tập rule PHẢI được nêu — cộng nghĩa vụ hình thức của chính gate.

Rule mà `expected.lints` liệt kê cho đường này: 11 rule `contract`, 2 `the-split`, 5 `file-layout`, 3 `props-and-slots`, 3 `loading`, 2 `landmark`, 2 `translation`, 3 `naming`, 3 `comments`, 1 `typography`, 4 `tokens`, 5 `icon`, 4 `vendor-boundary`, 1 `type-safety`, 2 `served-locale`, `lint-escape-hatch`, `lint-adoption`.

Nghĩa vụ hình thức: mọi rule có kết quả · bằng chứng phân biệt chạy-thật với đọc-nguồn · mọi `fail` có `at` và cách sửa · `blocking` không đề xuất tắt rule · `unenforced` nêu chỗ luật đúng mà máy không giữ · `owed` nêu chỗ chưa đo · audit adoption không được khai xanh khi chưa đo.

## ACTUAL OUT

```
Phép đo: ESLint chạy THẬT trong lint lab ở scratchpad, cấu hình dựng bằng starciFeConfig
         layout single-app từ .claude/sources/fe/index.mjs. 59/59 rule có kết quả.
         Có lab ĐỐI CHỨNG: 24 rule được chứng minh còn sống bằng probe cố tình vi phạm.

Kết quả: 2 fail · 45 pass · 12 khong-ap-dung · suppressions 0
Chặn:  require-export-jsdoc   (38 dòng meta + mọi kiểu export + 17 hook)
       no-dead-contract-key   (empty-notice-card không có call site nào)
Audit effective-config: FAIL — 59/59 error và noInlineConfig true là số đo trên CANON
       trong lab, KHÔNG phải trên starci-academy-fe; khai thẳng là chưa chứng minh
gates: lint fail · typecheck/build/test chua-chay
unenforced: 7   owed: 8   verdict: do-chan-lai
```

Phát hiện đáng giá nhất, đo được chứ không suy đoán:

> "Bộ thăm `Property` của `tokens.mjs` trả về sớm khi tên thuộc tính khác `classes`, trong khi bảng của kế hoạch và cả `contracts.ts` của canon đều viết `classNames`… Probe hai entry giống hệt nhau chỉ khác tên mảng cho kết quả trái ngược: bản `classes` bị bắt cả ba lỗi `gap-2.5`, `p-[13px]` và `text-2xl font-bold`, bản `classNames` không bị gì. Trớ trêu là `contract.mjs` lại đọc CẢ HAI cách viết."

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| mọi rule của tập canon có kết quả | 59 | 59 | TRÚNG | gốc |
| chạy thật, không kiểm bằng mắt | phải | ESLint 9 trong lab, có lệnh và đường dẫn | TRÚNG | gốc |
| chứng minh rule còn sống | phải | 24 rule bắn thật trong probe đối chứng | TRÚNG | gốc |
| bắt được va chạm meta ↔ jsdoc | phải | bắt, và gọi đúng tên: "va chạm giữa hai luật của chính canon" | TRÚNG | gốc |
| `blocking` không đề xuất tắt rule | phải | cả hai đều kèm cách sửa mã | TRÚNG | gốc |
| phân biệt "rule im vì không đọc được" với "rule đã xét và chấp thuận" | phải | `no-unresolved-token-class` được ghi `khong-ap-dung` + `chua-do`, kèm câu "khi không tìm thấy nó IM LẶNG chứ không phải chấp thuận" | TRÚNG | gốc |
| audit adoption trung thực | phải | FAIL, giải thích rõ số đo thuộc về canon chứ không thuộc repo đích | TRÚNG | gốc |
| `unenforced` nêu chỗ luật đúng mà máy không giữ | phải | 7 mục, trong đó `classes`/`classNames` là một lỗi canon THẬT | TRÚNG | gốc |
| phủ hết file của kế hoạch | nên | 8/60 file có mã; ghi thành owed | THIẾU (kế thừa) | kế thừa |
| `at` trỏ vào repo sống | schema đòi | số dòng của bản dựng lại trong lab; khai thẳng | LỆCH (lỗi lược đồ) | gốc |
| `no-dead-contract-key` đỏ | ? | đỏ trên `empty-notice-card`; nhưng gate tự nói 4/5 khoá chết là hiện vật lab | TRÚNG (một phần) | gốc |
| typecheck / build / test | nên chạy | chưa chạy, có lý do | THIẾU (chấp nhận được) | gốc |
| bắt được thứ đã sai từ gate trước | — | KHÔNG bắt: StreakStrip mất, state khách mất, 23 khoá bịa, 17 hook bịa | THIẾU | gốc |

**Điểm: 9 TRÚNG (+1 phần) · 1 LỆCH · 3 THIẾU trên 13 = 9.5/13.**

Đây là gate mạnh nhất của cả chuỗi, và cách nó mạnh đáng ghi lại: nó không tin sự im lặng của chính mình. `no-dead-contract-key` được kiểm chứng bằng đối chứng cho ra 6 khoá chết trước khi nó dám nói "0 khoá chết" trên kế hoạch.

## GATE THIẾU GÌ

- **`tokens.mjs` và `contract.mjs` phải đồng ý về tên field của một entry.** Đây là một lỗi canon đo được, không phải một quan sát: ba rule token hiện KHÔNG soi một class nào trong bảng contract. Một nửa nấc hay một giá trị trong ngoặc vuông đi thẳng vào bảng và không ai báo.
- **Canon phải nói `export const meta` được miễn `require-export-jsdoc`, hoặc `patterns` phải nói meta cần doc của nó.** Hai luật của cùng một nhà đang mâu thuẫn và hậu quả là 38 dòng đỏ trên một màn hình — cả ba trang đều dính.
- **Gate lints phải có nghĩa vụ đối chiếu kế hoạch với YÊU CẦU, không chỉ với rule.** Một section biến mất, một state khách biến mất, 17 hook trùng chức năng — tất cả đi qua lint xanh. Lint là cổng cuối và nó không có ô nào để nói "kế hoạch này thiếu một thứ nghiệp vụ đòi".
- **`RuleResult` cần một giá trị thứ tư cho "luật im vì không đọc được thứ nó cần".** Gate phải dồn nó vào `khong-ap-dung`, mà chính `file-layout/INDEX.md` nói gộp hai thứ đó lại là cách một rule rò rỉ được tin là đã đóng.

## GATE IM LẶNG Ở ĐÂU

`uncertain`, nguyên văn:

1. "`output.source.markup` đi qua nguyên vẹn theo đúng quy ước gate patterns đã đặt: tôi giữ nguyên object `carriedFromInput` thay vì chép tay 30KB cây node và mười chín đoạn HTML. Phần còn lại của SourcePlan tôi chép đầy đủ. Nếu orchestrator không ghép lại markup thì output này thiếu đúng một trường."
2. "`gate.schema.json` của patterns khai SourcePlan với `additionalProperties false` và KHÔNG có trường `sourceSketch`, nhưng input tôi nhận lại có trường đó và nó chứa toàn bộ mã thật. Tôi chép nguyên `sourceSketch` qua vì bỏ nó đi là vứt mất mã; nếu orchestrator validate chặt thì đây là chỗ sẽ đỏ, và câu trả lời đúng là sửa schema chứ không phải xoá mã."
3. "Trường `at` của RuleResult và blocking bắt buộc là file:dòng trong starci-academy-fe, nhưng hai file đang đỏ chưa tồn tại ở đó… Tôi cần biết orchestrator muốn `at` trỏ vào đâu khi mã còn là kế hoạch; gate không nói."
4. "`no-dead-contract-key` tôi chấm đỏ dựa trên tám file có mã thật; năm mươi hai file còn lại chỉ có đường dẫn nên không đo được. Nếu một trong số đó thật sự vẽ `empty-notice-card` thì finding này rơi."
5. "`auditResults` chỉ có hai giá trị pass và fail, không có ô nào cho 'chưa đo được vì bị cấm mở kho đích'."
6. "Kế hoạch nói `mainLandmarkOwner` là route-file, còn lý do của entry `dashboard-mode-main` lại nói route layout đã mở main bằng khoá `routed-page-main`. Hai lời khai này mâu thuẫn. Không rule nào phân xử được."
7. "`RuleResult` không có trường nào cho 'luật im vì không đọc được thứ nó cần', khác hẳn với 'luật đã xét và chấp thuận'… chính INDEX của file-layout nói rõ gộp chúng lại là cách một rule rò rỉ được tin là đã đóng."

## Lượt 2 — 2026-08-17

### IN (lượt 2)

`SourcePlan` gồm **23 file, cả 23 đều có `source` là văn bản mã đầy đủ** (lượt một: 8 trên 60),
10 contract entry mới, `split`, `meta`, `mainLandmarkOwner: route-file`.

### ACTUAL OUT (lượt 2)

```
Phép đo: KHÔNG chạy lệnh nào. Mọi dòng đều evidence "doc-nguon" — đọc thẳng
         .claude/sources/fe/*.mjs và shelf .claude/fe/gates/lints để suy ra từng visitor sẽ thấy gì.
         KHÔNG có lab đối chứng nào.  (lượt một: ESLint 9 chạy thật + 24 rule có probe)

Kết quả: 58 ruleResult + 1 audit = 59 · 3 fail · 55 pass · 0 khong-ap-dung · suppressions 0
Chặn:  require-export-jsdoc x3 vị trí, đại diện cho 18 chỗ
         (mọi `export type XProps` và mọi `export const meta`)
Audit effective-config: result = "chua-do-duoc"          <- dùng đúng ô mới của lược đồ
gates: cả sáu = "chua-chay", mỗi cái kèm lệnh
unenforced: 5   owed: 8   verdict: do-chan-lai
```

Hai dòng `owed` đáng giá nhất của lượt hai là hai **dự báo lỗi biên dịch chính xác**, và cả hai đều
là lỗi mà không rule nào bắt:

> "`SurfaceListCard` nhận contract `empty-notice-card`, mà một root của surface list phải là
> `JoinedListContractKey` — entry chỉ đủ điều kiện khi có `divide-y` và MỌI slot đều `repeats`."

> "slot `action` của `title-with-end-action` được khai là leaf `button`, còn mã thả vào đó một
> `defineLeafComponent` tên `select`."

Và một phát hiện canon MỚI, không có ở lượt một:

> "`no-unknown-contract-key` chỉ đọc thuộc tính `contract` tĩnh trên phần tử đúng tên `Tree`… năm cái
> tên đi qua `SurfaceListCard`, `SurfaceCard`, `defineContractComponent` và `restingSlotCount`, tức
> bốn trong năm hình dạng mà `no-dead-contract-key` lại TÍNH LÀ tham chiếu — hai rule bất đồng về thế
> nào là gọi tên một khoá."

### CHẤM (lượt 2)

Cùng 13 mục của lượt một.

| Mục | Expected | L1 | L2 | Kết L2 | Delta |
|---|---|---|---|---|---|
| mọi rule của tập canon có kết quả | 59 | TRÚNG | 58 + 1 audit = 59 | TRÚNG | = |
| chạy thật, không kiểm bằng mắt | phải | TRÚNG | **không chạy lệnh nào** | LỆCH | giảm |
| chứng minh rule còn sống | phải | TRÚNG (24 probe) | **không có lab đối chứng nào** | THIẾU | giảm |
| bắt được va chạm meta / jsdoc | phải | TRÚNG | bắt, 18 chỗ, và **cấm luôn cách sửa bằng khối rỗng** | TRÚNG | = |
| `blocking` không đề xuất tắt rule | phải | TRÚNG | cả ba kèm cách sửa mã | TRÚNG | = |
| phân biệt "im vì không đọc được" với "đã xét và chấp thuận" | phải | TRÚNG | **0 mục `khong-ap-dung`**; 16 rule ngoài phạm vi bị ghi `pass` | LỆCH | giảm |
| audit adoption trung thực | phải | TRÚNG (FAIL) | `chua-do-duoc` + lý do | TRÚNG | = (dùng đúng ô mới) |
| `unenforced` nêu chỗ luật đúng mà máy không giữ | phải | TRÚNG (7 mục) | 5 mục, trong đó bất đồng giữa hai rule khoá là phát hiện MỚI | TRÚNG | = |
| phủ hết file của kế hoạch | nên | THIẾU (8/60) | **23/23 file có `source`** | TRÚNG | tăng |
| `at` trỏ vào repo sống | schema đòi | LỆCH lược đồ | trỏ vào đường dẫn chưa tồn tại, khai thẳng | LỆCH lược đồ | = |
| `no-dead-contract-key` | ? | TRÚNG một phần | chấm `pass`; 5 khoá không khai đẩy sang `unenforced` | TRÚNG một phần | = |
| typecheck / build / test | nên chạy | THIẾU chấp nhận được | `chua-chay`, có lệnh, có lý do | THIẾU chấp nhận được | = |
| bắt được thứ đã sai từ gate trước | — | THIẾU | vẫn không bắt (StreakStrip, QuickActions, state khách, hai mặt rỗng) nhưng **có ghi vào `owed` rằng xanh chỉ phủ 23 file** | THIẾU | = (giảm nhẹ) |

**Điểm: 6.5/13 = 50%** (6 TRÚNG, 1 TRÚNG một phần, 3 LỆCH, 3 THIẾU).
**Delta so với lượt một: 9.5/13 = 73% thành 50%, −23 điểm phần trăm.**

Cần đọc con số này cho đúng, vì nó là cú tụt lớn nhất của bảng và nguyên nhân của nó rất hẹp.
**Chất lượng SUY LUẬN không tụt — nó sắc hơn lượt một:** hai dự báo lỗi kiểu chính xác, một phát hiện
canon mới về hai rule bất đồng, và một câu chặn kèm lời cấm cách sửa rỗng. Cái tụt là **kỷ luật đo**:
lượt một chạy ESLint thật trong lab, dựng 24 probe cố tình vi phạm để chứng minh rule còn sống, rồi
mới dám nói pass. Lượt hai đọc mã nguồn rule và suy ra. Đó là mức bằng chứng thấp hơn đúng một bậc,
và chính bước cuối khai điều đó trong `owed`.

Kèm theo là một tụt thứ hai, âm thầm hơn và nguy hơn: **lượt một tách 12 rule ra ô `khong-ap-dung`;
lượt hai ghi tất cả là `pass`.** Ô `chua-do-duoc` vừa được thêm vào `RuleResult` chính là để tránh
chuyện này, và nó chỉ được dùng ở làn audit, không ở làn rule.

### GATE THIẾU GÌ (lượt 2)

- **Ô `chua-do-duoc` phải là BẮT BUỘC ở làn rule khi không có lệnh nào chạy, không phải tuỳ chọn.**
  Đây là phát biểu mới, thay cho câu số 3 của lượt một (vốn đòi thêm giá trị — nay đã có). Bằng chứng:
  giá trị tồn tại, và bước này vẫn ghi `pass` cho 16 rule mà nó chỉ đọc tên file để loại trừ.
- **Một `pass` không có lệnh sinh ra nó phải mang trọng số khác một `pass` có build log.** Không có
  trục đó thì một bảng 55 `pass` đọc-nguồn nhìn y hệt một bảng 55 `pass` chạy-thật.
- **Kỷ luật đối chứng phải là nghĩa vụ, không phải một thói quen tốt.** Lượt một hai trên ba trang có
  probe; lượt hai không trang nào có. Không có probe thì "rule này im" và "rule này mù" là một.
- **Gate lints vẫn không có ô nào để nói "kế hoạch này thiếu một thứ nghiệp vụ đòi".** Nêu lượt một
  trên cả ba trang, chưa vá, và lượt hai để lọt thêm: QuickActions và hai mặt tab rỗng.
- **Canon phải hoà giải `export const meta` với `require-export-jsdoc`.** Nêu lượt một, chưa vá, và
  lượt hai còn tìm ra chứng cứ nặng hơn: chính ví dụ của canon tại
  `patterns/file-layout/example.md:291` viết `export const meta` trần không kèm doc.
- **`no-unknown-contract-key` và `no-dead-contract-key` phải dùng CHUNG một định nghĩa "gọi tên một
  khoá".** Mới ở lượt hai. Hiện tại một khoá bịa ra có thể vừa không-lạ vừa không-chết.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

`uncertain`, nguyên văn, bảy mục:

1. "`require-export-jsdoc`: rule không có ngoại lệ nào cho `export const meta` hay `export type XProps`,
   nhưng chính ví dụ của canon tại `.claude/fe/gates/patterns/file-layout/example.md:291` viết
   `export const meta` trần không kèm khối doc. Gate im lặng ở chỗ này: hoặc rule đang đỏ trên cả kho,
   hoặc có một ngoại lệ không được ghi ở đâu cả."
2. "Tôi không đọc được bảng contract có sẵn của repo sống, nên host của `routed-page-main`, chữ ký của
   mọi entry cũ, và sự tồn tại của các leaf `tab`, `task-mark`, `select`, `day-cell` đều là giả định."
3. "Danh sách hai mươi segment đã romanise của `no-second-language-in-path` không được in ở shelf lints;
   tôi giả định `lang`, `swr` và `dashboard` không nằm trong đó."
4. "Shelf `contract/INDEX.md` khai đúng mười rule và không nhắc `no-structural-arrangement-in-leaf`,
   trong khi `contract.mjs:1279` công bố nó là rule thứ mười một… tài liệu đang lệch mã và đó là một
   finding về chính gate."
5. "Không có luật nào trong gate nói một leaf được phép không bọc primitive vendor nào."
6. "Tôi không đọc được `props.ts` nên không biết literal props của slot có được trộn vào lane props lúc
   render hay không."
7. "`auditResults` chỉ có `effective-config` ở mức `chua-do-duoc`, và mọi cổng máy đều `chua-chay`…
   Phán quyết đỏ ở đây dựa trên một rule đọc từ nguồn, không dựa trên một build log."

So với lượt một: bảy câu, vẫn bảy. Bốn câu của lượt một đã hết (ô cho mã nguồn, ô cho "chưa đo" của
audit, `source` là mã nhận hay mã sửa, `sourceSketch` ngoài lược đồ). Bốn câu MỚI thay vào, và ba
trong bốn câu mới là **mâu thuẫn nội bộ của canon** chứ không phải thiếu dữ liệu — đó là một loại im
lặng đắt hơn.
