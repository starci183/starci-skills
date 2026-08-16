---
id: fe-lints-proof-courses
title: courses
slug: /gates/lints/proofs/courses
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

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Kế hoạch 19 file, 16 contract entry, các quyết định COMMENTS/SLOTS/FILE/COPY/LOCALE. Trường
`source` bắt buộc của lược đồ **không được phát**; bước này nhận mã qua trích đoạn.

### ACTUAL OUT (lượt 2)

```
measurementMethod (nguyên văn):
  "EYE-CHECK AGAINST THE GATE DOCUMENTS. ESLint was NOT executed.
   No lab, no fixture, no --print-config run."
  Đã đọc: 16 shelf .claude/fe/gates/lints/*/INDEX.md · .claude/fe/gates/lints/proofs/courses.md · 5 file .mjs
  Không đọc: hai kho đích.

verdict RED · blocking 7 · lawBrokenButUnenforced 6 · unprovable 3 · suppressions 0
Legend tự chế, ngoài enum lược đồ: fires / silent / hatch / oos / unprovable

F-01  BUILD-STOPPER  cả 16 entry viết `classes:`, kiểu đóng đòi `classNames:` và BẮT BUỘC
                     -> bảng không biên dịch, mà mọi rule contract vẫn xanh vì contract.mjs
                        cố ý nhận cả hai chính tả
F-02  BUILD-STOPPER  restingCard() / restingLine() được gọi, không được khai ở đâu
F-03  fires x9       require-export-jsdoc
F-04  fires x4       no-inline-parameter-type
F-05  twin test của page KHÔNG MOUNT ĐƯỢC: nó render _CoursesCatalogPage, mà mọi state của
                     nó mount CourseCatalogCard (connected) -> useTranslations ném trước
                     phép khẳng định đầu tiên
F-06  fixture thiếu `lessonCount`
F-07  hai test truy vấn data-testid; getAllByTestId ném, queryByTestId('badge') XANH VĨNH VIỄN

P-03  audit effective-config = "FAIL — NOT MEASURED", và trích thẳng rằng lượt một bị chấm LỆCH
      vì khai PASS trong khi measurementMethod nói không mở kho
P-01  no-duplicate-entry-shape = "unprovable", và trích .claude/fe/gates/lints/proofs/courses.md:21
```

### CHẤM (lượt 2)

Cùng 15 mục của lượt một.

| Mục | Expected | L1 | L2 | Kết L2 | Delta |
|---|---|---|---|---|---|
| mọi rule có kết quả | 59 | TRÚNG | 58 + 1 audit = 59 | TRÚNG | = |
| chạy thật | phải | TRÚNG (5 lab) | **"ESLint was NOT executed"** | LỆCH | giảm |
| kỷ luật đối chứng | nên | TRÚNG (43/59 có probe) | **không lab nào** | THIẾU | giảm |
| bắt được neo bị đọc sai | phải | TRÚNG (`nav` thuộc NEUTRAL) | bắt neo khác: `MainFrame` không phải một trong hai frame canon biết | TRÚNG | = |
| bắt va chạm meta / jsdoc | phải | TRÚNG (16 export) | bắt, 9 chỗ, gọi đúng là "một thói quen chứ không phải một lần quên" | TRÚNG | = |
| bắt kiểu inline ở tham số | phải | TRÚNG (1 chỗ) | 4 chỗ, hai chỗ mới ở module operations | TRÚNG | = |
| `no-duplicate-entry-shape` trên cụm ba entry cùng chuỗi lớp | điểm căng nhất | THIẾU (chấm PASS nhầm) | **`unprovable`, từ chối chấm PASS** | TRÚNG | tăng |
| phán xử nợ của gate trước | nên | TRÚNG (4 dòng) | 7 dòng, 4 UPHELD / 3 PARTLY WRONG, một dòng được NÂNG lên chặn | TRÚNG | = |
| chứng minh bản vá xanh | nên | TRÚNG (`afterFix` 0 finding) | có `fixedCode` nhưng **không chạy lại** | THIẾU | giảm |
| audit adoption trung thực | **bắt buộc** | **LỆCH** (khai PASS) | **"FAIL — NOT MEASURED"** | TRÚNG | tăng |
| `at` trỏ vào repo sống | schema đòi | LỆCH lược đồ | vẫn đường dẫn kế hoạch | LỆCH lược đồ | = |
| phủ hết file | nên | THIẾU (14/29) | 19 file, **không file nào có `source`**, chỉ có `fixedCode` | THIẾU | = |
| bắt import treo | nên | TRÚNG (1) | **2 định danh treo + fixture thiếu field + 2 khẳng định test không khớp** | TRÚNG | = (sắc hơn) |
| bắt được thứ đã sai từ gate trước (nghiệp vụ) | — | THIẾU | vẫn không bắt: vùng header, nhóm owned, dedupe, 5 state | THIẾU | = |
| tách "ngoài phạm vi" khỏi "đã xét và chấp thuận" | phải | (không có ở L1) | **legend 5 giá trị tự chế ngoài enum**, và tự khai "không phân biệt được oos với mù" | LỆCH lược đồ | mục mới |

**Điểm: 8/16 = 50%** (8 TRÚNG, 4 LỆCH, 4 THIẾU).
**Delta so với lượt một: 10/15 = 67% thành 50%, −17 điểm phần trăm.**

### Hai mục tăng, và một cảnh báo về cách chúng tăng

Hai chỗ trừ nặng của lượt một đều được vá: audit không còn khai xanh khi chưa đo, và
`no-duplicate-entry-shape` không còn chấm PASS trên một cụm không có trong kế hoạch.

**Nhưng chúng được vá bằng cách ĐỌC HỒ SƠ CHẤM LƯỢT MỘT, không phải bằng suy luận.** Bước này ghi
`.claude/fe/gates/lints/proofs/courses.md` vào danh sách đã đọc, trích đúng dòng 21, và nói thẳng "bản ghi
proof của chính gate cho trang này ghi rằng lượt trước bị chấm THIẾU / LỆCH ở đúng chỗ này". Đó là
một hồ sơ proof làm đúng việc của nó — nhưng nó cũng có nghĩa là **lượt hai không còn mù ở hai mục
đó**, và hai mục tăng ấy không phải bằng chứng gate đã khá lên. Ghi lại để lượt ba biết mà tách hai
loại tiến bộ.

### Ba phát hiện MỚI đáng giữ

1. **F-01 được nâng từ ghi chú thành lỗi chặn build.** Lượt một dashboard tìm ra `classes` /
   `classNames` bằng probe và xếp vào `unenforced`. Lượt hai courses đọc kiểu đóng và kết luận đúng
   hơn: trường bắt buộc thiếu + trường thừa, bảng không biên dịch, **mà lint vẫn xanh vì rule rộng hơn
   kiểu**. Một cổng xanh trên một file compiler từ chối.
2. **Bản vá và độ phủ đi ngược chiều nhau.** `tokens.mjs` chỉ đọc mảng dưới tên `classes`. Sửa cho
   đúng kiểu thành `classNames` sẽ **gỡ bốn rule token ra khỏi bảng contract hoàn toàn**. Không có ở
   lượt một và đây là loại phát hiện chỉ có khi đọc mã rule.
3. **F-05: một twin test không mount được.** Lượt một xếp nó vào `owed` như một lời hứa "dừng ở biên
   khối"; lượt hai đọc lại và kết luận nó ném lỗi trước phép khẳng định đầu tiên. Một test ném lỗi
   không chứng minh gì, và gọi nó là bằng chứng một phần là sai đắt hơn.

### GATE THIẾU GÌ (lượt 2)

- **`contract.mjs` nhận `classes` và `classNames`; `ContractSpec` chỉ nhận `classNames`;
  `tokens.mjs` chỉ đọc `classes`. Ba nơi, hai chính tả, một sự thật.** Nêu ở lượt một, chưa vá, và
  lượt hai chứng minh nó nặng hơn ta tưởng.
- **Một bước không chạy lệnh nào phải bị hạ mức bằng chứng ở MỌI dòng, tự động.** Lượt này tự chế một
  legend năm giá trị vì enum lược đồ không diễn đạt được điều đó, và một legend tự chế thì không tổng
  hợp được qua ba trang.
- **`auditResults` phải có ô "chưa đo" và mặc định FAIL.** Đã vá bằng `chua-do-duoc`, và trang này
  chứng minh nó ăn — dù trang này diễn đạt bằng chữ chứ không bằng ô.
- **`surface-folder-two-files-only` chỉ khớp `pages`, `layouts`, `overlays`** — nêu lượt một, chưa vá.
- **`connectedBlock` của `the-split` khoá bằng `blocks/**/index.tsx`, nửa nối của một PAGE không ai
  canh** — nêu lượt một, chưa vá, và lượt hai chỉ ra hậu quả cụ thể qua F-05.
- **Một khẳng định test phải truy vấn thuộc tính frame thật sự sơn ra.** Mới ở lượt hai; hậu quả nặng
  nhất là một phép khẳng định xanh vĩnh viễn.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

`uncertain`, nguyên văn, bảy mục:

1. "F-05's repair is a product decision and the gate does not choose. Hai con đường hợp pháp… Gate im
   lặng: `the-split/INDEX.md` ghi 'reaching through a child' là một cửa mở không có phán quyết, và
   `proofs/INDEX.md` nói một fixture render chứng minh cái gì mà không nói ai được ngồi dưới nó."
2. "Tôi đổi `MainFrame` thành `Tree` nhưng KHÔNG viết đối số `render=`, vì cách `children` của một
   route hợp pháp đi tới một slot contract không được nêu ở đâu trong gate. Ba ứng viên, không phán
   quyết."
3. "Tôi không biết leaf `Button` báo `isPending` bằng cách nào — data attribute, `aria-busy`, disabled,
   hay một Spinner. Nothing in the gate says."
4. "Gate tự mâu thuẫn về thành viên của union class… Tôi không phân biệt được nếu không mở được file."
5. "`export const meta` … §2.6 kết thúc bằng câu đừng phát minh trục thứ tư — nó không nói phải làm gì
   với một giá trị thứ ba trên một trục đã có."
6. "`BlockProps` là `{ state, props }` và `ComponentData` cấm hàm, nên nửa vẽ của một block theo canon
   KHÔNG có làn nào cho handler. Mọi block trong kế hoạch đều mang `on`, và tôi không báo đó là vi phạm."
7. "Mười sáu trên năm mươi chín rule bị loại chỉ bằng một cửa lọc tên file… tôi không phân biệt được
   'đúng là không áp dụng' với 'mù', và không có fixture đối chứng nào trong phạm vi bài này."

Sáu câu của lượt một, bảy câu lượt hai. Ba câu cũ đã hết (ô cho mã nguồn, ô cho "chưa đo", `at`);
bốn câu mới, và ba trong bốn câu mới là **câu hỏi sản phẩm hoặc mâu thuẫn nội bộ của canon**, không
phải thiếu dữ liệu.
