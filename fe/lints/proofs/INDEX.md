---
id: fe-lints-proofs-index
title: Bằng chứng gate lints
slug: /fe/lints/proofs
sidebar_label: INDEX
description: Bảng điểm ba trang cho gate lints — cổng cuối là gate mạnh nhất chuỗi, và nó tìm ra lỗi của chính canon.
---

# Bằng chứng gate lints

> Ngày: 2026-08-16 · Ba trang founder tự tin · Chuỗi: layouts → blocks → principles → patterns → lints

## Bảng điểm

| Trang | Điểm | Phép đo | Rule có kết quả | Chặn | unenforced | owed | verdict |
|---|---|---|---|---|---|---|---|
| [dashboard](./dashboard.md) | **9.5/13 · 73%** | ESLint 9 chạy thật, 24 rule có đối chứng | 59/59 | 2 | 7 | 8 | do-chan-lai |
| [courses](./courses.md) | **10/15 · 67%** | ESLint 9.39.4, **5 lab**, 43/59 rule có đối chứng, có `afterFix` | 59/59 | 3 | 6 | 7 | do-chan-lai |
| [course-details](./course-details.md) | **9/14 · 64%** | **không chạy lệnh nào** — đọc nguồn rule, khai thẳng | 59/59 | 2 rule / 6 vị trí | 7 | 7 | do-chan-lai |
| **Trung bình** | **68%** | | | | | | |

Đây là gate mạnh nhất của cả chuỗi và nó mạnh theo cách đáng ghi lại: **nó không tin sự im lặng của chính mình.** Trang courses chứng minh `no-dead-contract-key` đỏ 6 lần trong lab đối chứng trước khi dám nói "0 khoá chết" trên kế hoạch. Trang dashboard chứng minh 24 rule còn sống bằng probe. Trang course-details không chạy được gì và ghi `evidence: doc-nguon` trên đủ 59 dòng thay vì mượn uy tín của một phép đo không có.

Cả ba đều kết luận đỏ. Không trang nào tắt một rule. `suppressions: 0` ở cả ba.

## Hai lỗi hệ thống mà cả ba trang cùng tìm ra

Ba trang chạy độc lập, hai trang chạy ESLint thật và một trang chỉ đọc nguồn, và cả ba trả về **cùng hai lớp lỗi**. Nghĩa là đây là lỗi của canon và của gate patterns, không phải tai nạn của một trang.

1. **`require-export-jsdoc` va chạm với `export const meta`.** Patterns buộc mọi file component kết bằng dòng `meta`; comments buộc mọi export mở đầu bằng một block doc. Kết quả: 38 dòng đỏ ở dashboard, 16 ở courses, 6 vị trí ở course-details.
2. **`no-inline-parameter-type` bắt làn hành động.** `isInlineObjectType` đi xuyên `TSIntersectionType`, nên `Props & { on: … }` viết tại tham số là hình dạng vô danh. Xuất hiện ở courses (1 chỗ) và course-details (2 chỗ).

Và một phát hiện chỉ dashboard đo được, nhưng nó là lỗi canon thật:

3. **`tokens.mjs` chỉ đọc field `classes`, còn bảng viết `classNames`.** Probe hai entry giống hệt nhau chỉ khác tên mảng: bản `classes` bị bắt cả `gap-2.5`, `p-[13px]` và `text-2xl font-bold`; bản `classNames` không bị gì. `contract.mjs` thì đọc cả hai. **Ba rule token hiện không soi một class nào trong bảng contract.**

## Điểm trừ

| Trang | Chỗ trừ |
|---|---|
| courses | **`auditResults` khai PASS 59/59 "trên một file production thật" trong khi `measurementMethod` của chính nó nói "Repo starci-academy-fe KHÔNG bị đọc, không bị mở, không bị grep".** Hai trang còn lại bị cấm y hệt và cả hai khai FAIL. Một audit khai xanh khi chưa đo là đúng thứ `lint-adoption.mjs` sinh ra để chặn. |
| course-details | Không có lab đối chứng nào, nên với 59 rule thì "im lặng" và "mù" chưa phân biệt được. |
| cả ba | `at` không trỏ được vào repo sống. Ba trang ba cách xử lý khác nhau, cả ba đều khai thẳng. |
| cả ba | Không trang nào bắt được thứ đã sai từ gate trước: một section biến mất, một state khách biến mất, một nhóm khóa đã sở hữu biến mất, ba mệnh đề điều kiện biến mất. Lint là cổng cuối và nó **không có ô nào để nói "kế hoạch này thiếu một thứ nghiệp vụ đòi"**. |

## Gate còn thiếu luật gì

| # | Câu luật lẽ ra đã ngăn được | Trang |
|---|---|---|
| 1 | **Canon phải hoà giải `export const meta` với `require-export-jsdoc` một lần**: hoặc meta được miễn, hoặc patterns bắt meta mang doc của nó. | 3/3 |
| 2 | **`auditResults` phải có giá trị cho "chưa đo", và khi không có thì mặc định là FAIL, không bao giờ PASS.** | 3/3 (một trang trượt) |
| 3 | **`RuleResult` cần một giá trị thứ tư cho "luật im vì không đọc được thứ nó cần"**, tách khỏi "luật đã xét và chấp thuận". Chính `file-layout/INDEX.md` nói gộp hai thứ đó là cách một rule rò rỉ được tin là đã đóng. | 3/3 |
| 4 | **`tokens.mjs` và `contract.mjs` phải đồng ý về tên field của một entry.** | 3/3 |
| 5 | **Gate lints phải có nghĩa vụ đối chiếu kế hoạch với YÊU CẦU, không chỉ với rule.** | 3/3 |
| 6 | **`isInlineObjectType` không soi thân của một type alias** — nên bản vá làm rule xanh cũng là bản vá xoá cái đỏ duy nhất từng chỉ ra rằng khối đang nhận một làn thứ ba mà `BlockProps` không có. Canon phải chọn: hoặc `BlockProps` có làn `on`, hoặc một rule đọc thân alias. | 2/3 |
| 7 | **Không rule nào đòi một tài liệu PHẢI có một `main`.** Hai rule landmark chỉ đòi đúng chỗ khi đã có một cái; một trang không có landmark nào đi qua toàn bộ cổng. | 2/3 |
| 8 | **`surface-folder-two-files-only` chỉ khớp `pages`, `layouts`, `overlays`** — thư mục khối giữ bao nhiêu file cũng không ai đọc. | 1/3 |
| 9 | **`connectedBlock` của `the-split` khoá bằng đường dẫn `blocks/**/index.tsx`** — nửa nối của một PAGE không được rule nào canh. | 1/3 |
| 10 | **`TOKEN_CLASS_FAMILIES` chỉ kiểm `max-w-app-*`, `max-h-*`, `min-h-*`** — họ `top-*` hứa hẹn một biến CSS mà không ai kiểm. | 1/3 |
| 11 | **Bảng contract phải thụt vào ĐÚNG bốn khoảng trắng và khoá không chứa chữ số**, nếu không `readContracts` trả null và ba rule bảng tắt trong im lặng. | 1/3 (nhưng đúng với cả ba) |
| 12 | **`no-decorative-icon-in-metric-cell` gài cổng ở đúng một tên component `LabelledProgressRow`** — mọi ô metric dựng bằng khoá khác đều nằm ngoài tầm nhìn của nó. | 1/3 |

## Gate im lặng ở đâu

Bốn câu hỏi được nêu ở **cả ba** trang, xếp theo số trang rồi theo mức độ chặn:

1. **`at` trỏ vào đâu khi file chưa tồn tại và repo đích bị cấm mở?** — 3/3. Ba trang ba câu trả lời khác nhau.
2. **`SourcePlan` không có ô cho văn bản mã; gate lints lint cái gì?** — 3/3.
3. **`output.source` là mã nhận vào hay mã đã sửa, và mang 40KB qua bằng cách nào?** — 3/3.
4. **`auditResults` không có ô cho "chưa đo".** — 2/3 nêu thẳng, 1/3 trượt vì không có ô đó.

Cộng ba câu chỉ một trang nêu nhưng đúng với cả ba: nhãn đọc được của một landmark do entry mở; làn hành động của một khối; và `SurfaceListCard` có nhận props runtime bên cạnh cặp contract–render hay không.
