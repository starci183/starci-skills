---
id: fe-lints-proof-dashboard
title: dashboard
slug: /fe/lints/proofs/dashboard
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
