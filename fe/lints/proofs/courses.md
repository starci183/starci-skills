---
id: fe-lints-proof-courses
title: courses
slug: /fe/lints/proofs/courses
sidebar_label: courses
description: Chấm gate lints trên trang kho khóa học — phép đo chặt nhất trong ba trang, ba chỗ chặn đúng, nhưng một lời khai audit tự mâu thuẫn với chính phương pháp đo.
---

# courses · gate lints

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate patterns: 29 file (14 file có mã thật), 19 contract entry, `propTypes` và `metaByFile` — hai field gate patterns tự chế vì `SourcePlan` không có ô cho mã.

## EXPECTED OUT

Chuẩn chấm là `expected.lints` của trang courses. Điểm được fixture đánh dấu là "căng nhất":

> "`no-duplicate-entry-shape` — điểm căng nhất: `catalog-card-list`, `marked-row-list` và `course-progress-list` có chuỗi lớp GIỐNG HỆT nhau."

Cộng nghĩa vụ hình thức như trang dashboard.

## ACTUAL OUT

```
Phép đo: ESLint 9.39.4 chạy THẬT trên 5 lab —
  lintlab  14 file mã thật
  lab2     + 17 file stub để họ rule đọc PATH có đủ cây
  fixed    lab2 sau khi vá, chạy lại để chứng minh bản sửa xanh
  ctrl…ctrl4, excerpt  các lab đối chứng cố tình vi phạm
Kỷ luật đối chứng: 43/59 rule được chứng minh còn sống. 16 rule còn lại ghi thẳng là doc-nguon.
  "no-dead-contract-key đỏ 6 lần trong đối chứng và 0 lần trên mười chín khoá của kế hoạch,
   nên 'không có khoá chết' là kết quả đo chứ không phải khoảng lặng."

Kết quả: 3 fail · pass phần lớn · suppressions 0 · verdict do-chan-lai
Chặn:  no-structural-host-outside-contract-frame  (thẻ nav viết tay ở CatalogPager)
       require-export-jsdoc                       (16 export, 9 trong đó là meta)
       no-inline-parameter-type                   (tham số fetcher của useMutateAddToCartSwr)
afterFix: 0 finding / 59 rule / 29 file / 0 suppressed — nhưng verdict VẪN đỏ vì
          "bản vá là thứ gate này đề xuất và gate sau phải nhận"
resolvedFromPreviousGate: 4 dòng nợ của gate trước được PHÁN XỬ, 3 đúng 1 sai
unenforced: 6   owed: 7
```

Chỗ chặn số một là một phát hiện đọc-luật thật sự tinh:

> "Kế hoạch neo lối thoát này vào `patterns/contract/INDEX.md:152`, nhưng dòng đó nói SEMANTIC element, còn `nav` nằm trong tập NEUTRAL bảy phần tử và tập đó bị báo VÔ ĐIỀU KIỆN, không cần mang class."

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| mọi rule có kết quả | 59 | 59 | TRÚNG | gốc |
| chạy thật | phải | 5 lab, có lệnh, có ESLint version | TRÚNG | gốc |
| kỷ luật đối chứng | nên | 43/59 bắn thật; 16 còn lại khai `doc-nguon` chứ không mượn uy tín | TRÚNG | gốc |
| bắt được neo bị đọc sai | phải | bắt `nav` ∈ NEUTRAL vs SEMANTIC — chỗ chặn nặng nhất, đúng | TRÚNG | gốc |
| bắt va chạm meta ↔ jsdoc | phải | bắt, và gọi đúng là "một thói quen chứ không phải một lần quên" | TRÚNG | gốc |
| bắt kiểu inline ở tham số | phải | bắt, kèm hệ quả "twin test sẽ phải chép lại nó" | TRÚNG | gốc |
| `no-duplicate-entry-shape` trên cụm ba entry cùng chuỗi lớp | điểm căng nhất | chấm PASS trên 19 entry của kế hoạch — nhưng ba entry đó KHÔNG có trong kế hoạch | THIẾU | kế thừa |
| phán xử nợ của gate trước | nên | 4 dòng, có kết luận "gate patterns ĐÚNG / SAI ở nửa sau" | TRÚNG | gốc |
| chứng minh bản vá xanh | nên | `afterFix` 0 finding, và vẫn giữ verdict đỏ | TRÚNG | gốc |
| audit adoption trung thực | **bắt buộc** | khai **PASS 59/59 trên "một file production thật"** trong khi `measurementMethod` nói "Repo starci-academy-fe KHÔNG bị đọc, không bị mở, không bị grep" | **LỆCH** | gốc |
| `at` trỏ vào repo sống | schema đòi | số dòng của bản ghép trong lab; khai thẳng trong owed | LỆCH (lỗi lược đồ) | gốc |
| phủ hết file | nên | 14/29 file có mã; 11 rule rơi vào `khong-ap-dung` chỉ vì thiếu thân file | THIẾU | kế thừa |
| bắt import treo | nên | BẮT — `useQueryCourseRowSwr` không được định nghĩa; ghi vào owed | TRÚNG | gốc |
| bắt được thứ đã sai từ gate trước | — | không bắt: nhóm khóa đã sở hữu, dedupe, view persistence, 5 state | THIẾU | gốc |

**Điểm: 10 TRÚNG · 2 LỆCH · 3 THIẾU trên 15 = 10/15.**

Phép đo của trang này chặt nhất trong ba trang. Nó bị trừ ở đúng một chỗ nhưng là chỗ nặng: **`auditResults` khai PASS mâu thuẫn trực tiếp với `measurementMethod` của chính nó.** Trang dashboard và trang course-details cùng bị cấm y hệt và cả hai khai FAIL. Một audit khai xanh khi chưa đo là loại lỗi mà `lint-adoption.mjs` sinh ra để chặn.

## GATE THIẾU GÌ

- **`auditResults` phải có một giá trị cho "chưa đo", và khi không có thì mặc định là FAIL, không bao giờ là PASS.** Đây là chỗ ba trang cùng chạm và một trang trượt.
- **Một entry mở host landmark phải có đường hợp pháp để mang nhãn đọc được.** Frame chỉ phát `data-node`, `data-why`, `className`. Gate lints ghi đúng: sau khi vá, vùng phân trang là một landmark KHÔNG TÊN và không gate nào sẽ báo điều đó.
- **`surface-folder-two-files-only` chỉ khớp `pages`, `layouts`, `overlays`** — ba thư mục khối của trang này giữ bao nhiêu file cũng không ai đọc. Lời khai FILE-2 của kế hoạch đúng về văn bản nhưng không có máy nào giữ ở tầng block.
- **`connectedBlock` của `the-split` khoá bằng đường dẫn `blocks/**/index.tsx`, nên nửa nối của một PAGE không được rule nào canh.** Trang này tuân thủ tự nguyện, và đó chính là vấn đề.
- **`BlockProps` là hàng rào hai slot, nhưng một intersection trong ALIAS mở lại hàng rào đó** — và chính bản vá làm `no-inline-parameter-type` xanh cũng là bản vá xoá cái đỏ duy nhất từng chỉ vào làn `on` thêm vào.

## GATE IM LẶNG Ở ĐÂU

`uncertain`, nguyên văn:

1. "Lược đồ gate lints đòi `output.source` mang nguyên SourcePlan, mà SourcePlan là 40KB và `additionalProperties:false`. Tôi cần biết: gate muốn source là mã NHẬN VÀO hay mã ĐÃ SỬA? Lược đồ im lặng, vì nó vừa mô tả source là 'nguyên mã đến từ gate patterns' vừa nói 'sau gate này là code, không còn gate nào nữa'."
2. "SourcePlan không có ô nào cho VĂN BẢN mã: không tsx, không propTypes, không metaByFile. Tôi cần biết gate lints được cho là lint cái gì nếu đầu vào hợp lệ chỉ có danh sách đường dẫn."
3. "Ô `at` bắt buộc file:dòng thật trong repo sống, nhưng mã này chưa được ghi vào repo sống và tôi bị cấm đọc repo đó."
4. "Bảng entry: kế hoạch viết field `classes`, template canon tại `.claude/sources/fe/contracts.ts` viết `classNames`, và tài liệu gate lints §1.1 lại nói `classes`. `contract.mjs` cố ý nhận cả hai nên lint không phân xử được."
5. "Sau khi gỡ nav viết tay, vùng phân trang thành một landmark không có tên đọc được. Tôi cần biết cây trust muốn gì ở đây… Gate im lặng."
6. "16 trên 59 rule không dựng được đối chứng trong phạm vi bài này, nên với chúng tôi không phân biệt được 'không áp dụng' với 'mù'."
