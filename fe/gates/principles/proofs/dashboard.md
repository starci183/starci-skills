---
id: fe-principles-proof-dashboard
title: dashboard
slug: /gates/principles/proofs/dashboard
sidebar_label: dashboard
description: Chấm gate principles trên màn dashboard — 25 entry mới với why đúng thể loại, nhưng chỉ 5 khoá trùng tên với bảng thật và measure của trang biến mất khỏi entry.
---

# dashboard · gate principles

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate blocks. Không có nguyên văn trong chuỗi mù. Phần đọc lại được: rail 2 khối, overview 7 section theo thứ tự, ba tab, tập state từng khối.

## EXPECTED OUT

26 entry, mỗi entry một `classes` + `host` + `children` + `why`. Trích những entry quyết định (`src/components/contracts/index.ts`):

```
dashboard-rail-then-main  host div
  mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-8 px-6 py-6 md:flex-row md:items-start
  md:[&>*:first-child]:w-72 md:[&>*:first-child]:shrink-0
  md:[&>*:last-child]:min-w-0 md:[&>*:last-child]:grow
  { rail: dashboard-rail, main: dashboard-main|dashboard-tab-main|centred-empty-notice }

dashboard-rail       flex w-full flex-col gap-6                   section repeats restingCount 2
dashboard-main       flex min-w-0 grow flex-col gap-6             section repeats restingCount 8
dashboard-tab-main   flex min-w-0 grow flex-col gap-6             section repeats restingCount 3
label-row-over-card  flex flex-col gap-3   { label: title-with-end-action|title-with-baseline-fact, body: $content }
stacked-stat-rows    flex flex-col p-0 [&>*]:w-full [&>*]:p-2     stat composite icon-label-fact-row resting 3
profile-over-stat-rows  flex flex-col gap-3 [&>*]:w-full          { profile: profile-row, stats: stacked-stat-rows }
marked-row-list      overflow-hidden divide-y divide-separator p-0 [&>*]:px-4 [&>*]:py-3
                     [&>*:first-child]:pt-4 [&>*:last-child]:pb-4  row resting 5
changelog-list       (cùng chuỗi lớp)                             entry resting 4
resume-card-grid     grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3   card resting 3
bordered-goal-grid   grid grid-cols-2 overflow-hidden rounded-3xl border border-separator
                     [&>*]:p-3 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+4)]:border-b  goal resting 6
weekly-goals-card · streak-summary-card · job-readiness-card · job-readiness-list ·
weekly-challenge-card · weekly-challenge-finishers · contribution-calendar-card ·
explore-main · suggested-user-list · empty-notice-card · centred-empty-notice ·
title-with-end-action · title-with-baseline-fact · nav-over-body-page · routed-page-main
```

Hai luật hình dạng nằm ngoài từng entry: không entry dashboard nào khai `host`, nên `Tree` dùng mặc định `div`; host duy nhất khác `div` trên đường này là `routed-page-main → main`.

## ACTUAL OUT

25 entry. Trích đủ để so:

```
dashboard-rail-then-main  host div   [flex, flex-col, gap-8, md:flex-row]
dashboard-rail            host aside [flex, flex-col, gap-4, shrink-0, md:w-72]
dashboard-mode-main       host div   [flex, flex-col, gap-6, min-w-0, grow]
profile-over-stat-rows    host div   [flex, flex-col, gap-3]   { identity, figures }
avatar-beside-identity · tracked-figure-rows (ul, resting 3) · label-with-end-figure (li)
quick-action-list (ul, resting 4) · quick-action-item (li)
heading-over-body            ← DÙNG LẠI khoá canon thay vì đẻ heading-over-surface
joined-row-list (ul, resting 3) · title-stack-with-end-slot (li) · stacked-title-over-fact
marked-row-list (ul, resting 5) · glyph-title-fact-row  ← DÙNG LẠI khoá canon
figure-over-supporting-rows · plain-row-run (resting 2) · plain-row-item
total-over-day-grid · week-column-run (resting 53) · day-cell-column (resting 7)
card-over-closing-action · note-with-end-action · empty-notice-card
explore-feed-beside-suggestions
```

Ba lần GỘP có chủ ý được ghi thành quyết định CONTRACT-9: `heading-over-surface`→`heading-over-body`, `task-mark-title-fact-row`→`glyph-title-fact-row`, `value-over-label`→`stacked-title-over-fact`.

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| số entry | 26 | 25 | ~ | gốc |
| `dashboard-rail-then-main` tồn tại | có | có | TRÚNG | gốc |
| chuỗi lớp của nó | 14 class, có measure và `md:items-start` | 4 class | LỆCH | kế thừa (layouts bỏ measure) |
| ràng buộc con bằng selector `[&>*:first-child]:w-72` trên CHA | trên cha | đẩy xuống chính `dashboard-rail` (`md:w-72 shrink-0`) | KHÁC MÀ ĐƯỢC | gốc |
| `dashboard-rail` host | `div` (không khai) | `aside` | LỆCH | gốc |
| main là union 3 khoá | có | một khoá | LỆCH | kế thừa |
| `dashboard-main` resting 8 / `dashboard-tab-main` resting 3 | có | không có slot `section` nào khai | THIẾU | gốc |
| `label-row-over-card` — nhãn NGOÀI mặt nó gọi tên | có, dùng cho mọi section | thay bằng `heading-over-body` (tái dùng canon) | KHÁC MÀ ĐƯỢC | gốc |
| `profile-over-stat-rows` | tên trùng, con `profile`+`stats` | tên trùng, con `identity`+`figures` | TRÚNG (lệch tên slot) | gốc |
| `stacked-stat-rows` `p-0 [&>*]:p-2`, KHÔNG gap | có | `tracked-figure-rows` có `gap-2`, không `p-0` | LỆCH | gốc |
| `marked-row-list` chuỗi lớp | 7 class kể cả `overflow-hidden` | 6 class, thiếu `overflow-hidden` | LỆCH | gốc |
| `marked-row-list` resting | 5 | 5 | TRÚNG | gốc |
| `changelog-list` resting 4 | có | gộp vào `joined-row-list` resting 3 | LỆCH | gốc |
| `resume-card-grid` 1/2/3 cột | có | không tồn tại | THIẾU | gốc |
| `bordered-goal-grid` 2 cột, viền trong, resting 6 | có | không tồn tại | THIẾU | gốc |
| `job-readiness-list` outlined lồng, resting 3 | có | `plain-row-run` không viền, resting 2 | LỆCH | gốc |
| `weekly-challenge-finishers` | có | không tồn tại | THIẾU | gốc |
| `contribution-calendar-card` một mặt duy nhất | có | `total-over-day-grid` + `week-column-run` + `day-cell-column` | KHÁC MÀ ĐƯỢC | gốc |
| `streak-summary-card` | có | không tồn tại | THIẾU (kế thừa StreakStrip) | kế thừa |
| `empty-notice-card` | `flex flex-col gap-3 p-4` | thêm `items-center text-center` | LỆCH (gộp nhầm với `centred-empty-notice`) | gốc |
| `centred-empty-notice` | có, khoá riêng | không tồn tại | THIẾU | kế thừa |
| `title-with-end-action` / `title-with-baseline-fact` | hai khoá | không tồn tại | THIẾU | gốc |
| `nav-over-body-page` + `routed-page-main` | hai khoá của route layout | không tồn tại | THIẾU | kế thừa |
| why là LÝ DO chứ không mô tả class | có | 25/25 viết dạng "bỏ node này đi thì cái gì gãy" | TRÚNG | gốc |
| không entry nào mang class tương tác/sơn/nổi | có | không có | TRÚNG | gốc |
| không hai entry trùng chữ ký | có | không có | TRÚNG | gốc |
| tái dùng khoá thay vì đẻ khoá | có | 3 lần gộp có chủ ý, ghi thành quyết định | TRÚNG | gốc |

**Điểm: 8 TRÚNG · 3 KHÁC MÀ ĐƯỢC · 8 LỆCH · 9 THIẾU trên 28 mục = 9.5/28.**

Đọc lại theo hai trục thì công bằng hơn:
- **Chất lượng entry** (why là lý do, không class cấm, không trùng chữ ký, có gộp): **4/4 — xuất sắc.**
- **Danh tính khoá** (đúng tên, đúng chuỗi lớp, đúng resting): **5/26 tên trùng, 1/26 chuỗi lớp trùng.**

## GATE THIẾU GÌ

- **Trước khi đặt một khoá mới, gate phải nhận vào bảng khoá hiện có và liệt kê mọi khoá cùng chữ ký, rồi nêu vì sao khoá cũ không đủ. Không có bảng thì gate DỪNG và hỏi, không được đặt tên.** Gate này tự làm đúng ba lần (ba lần gộp) nhưng chỉ với ba khoá nó tình cờ biết tên; 23 khoá còn lại là đoán mù. Chính gate đã ghi dòng nợ này và không ai giải.
- **`restingCount` của một slot lặp phải khớp cardinality thật khi cardinality đó cố định bởi nghiệp vụ.** Sáu chỉ tiêu tuần → 6 chứ không 5; ba trụ sẵn sàng → 3 chứ không 2; bốn mục changelog → 4 chứ không 3.
- **Một entry chỉ được mang một hình dạng; canh giữa là một hình dạng khác với bao khối.** Gộp `empty-notice-card` và `centred-empty-notice` thành một khoá làm mọi thẻ trống trên trang bị canh giữa.
- **Host khác `div` phải có lý do ngữ nghĩa được nêu trong why, và `aside` chỉ đúng khi vùng đó thực sự là phần phụ trợ của một `main` đã tồn tại.** Gate mở `aside` cho rail trong khi bảng thật để rail ở `div`, vì `main` chưa được mở ở đâu trên đường này.
- **Chuỗi lớp của một danh sách nối là một bộ đóng; thiếu `overflow-hidden` là góc bo bị con hàng đầu đục thủng.** Không rule nào bắt được, nên nó phải là một luật của gate.

## GATE IM LẶNG Ở ĐÂU

Từ `uncertain` và `owed` mà gate patterns/lints mang qua:

> "Bốn hình dạng slot mà cây này cần không viết ra được trong gate.schema.json: slot nội dung không tên `$content`…; slot nhận MỘT TRONG nhiều khoá…; slot nhận một trong hai leaf…; và slot do một composite lấp. Tôi để trống kiểu thay vì khai một kiểu sai."

Đây là chỗ im lặng nghiêm trọng nhất của gate principles: **lược đồ của chính gate không diễn đạt được ba trong bốn hình dạng slot mà bảng contract thật đang dùng.** Union ba-khoá của slot `main` rơi mất ở đây, và mọi hệ quả xuống dưới là kế thừa.

> "Bảng contract sống chưa được đo, nên hai mươi ba khoá tôi đánh isNew có thể đã tồn tại dưới một cái tên khác."

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Đầu ra gate blocks lượt hai, **cộng một thứ mới: 291 tên khoá registry được cấp làm từ vựng.**
Đây là ô vá cần đo riêng, vì nó là phép thử của một giả thuyết cụ thể: *gate principles đặt tên sai
vì nó không biết bảng thật đang có gì.*

### ACTUAL OUT (lượt 2)

Mười entry MỚI, chín khoá được **tham chiếu mà cố ý KHÔNG khai lại** (`nav-over-body-page` và
`routed-page-main` có một dòng comment nói thẳng "already exist and are NOT redefined here").

```
dashboard-rail-then-main
  mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-8 px-6 py-6 md:flex-row md:items-start
  md:[&>*:first-child]:w-72 md:[&>*:first-child]:shrink-0
  md:[&>*:last-child]:min-w-0 md:[&>*:last-child]:grow      <- trùng bảng thật TỪNG KÝ TỰ
dashboard-rail            flex w-full flex-col gap-6         <- trùng từng ký tự
profile-over-stat-rows    flex flex-col gap-3 [&>*]:w-full   <- trùng từng ký tự
stacked-stat-rows         flex flex-col p-0 [&>*]:w-full [&>*]:p-2   <- trùng từng ký tự
label-row-over-card       flex flex-col gap-3                <- trùng từng ký tự
stacked-label-row-sections  flex min-w-0 grow flex-col gap-6 <- chuỗi lớp của dashboard-main, TÊN SAI
underlined-tab-strip (host nav) · glyph-title-fact-row · title-with-end-status
contribution-calendar-week-column
tham chiếu: nav-over-body-page · routed-page-main · marked-row-list · task-mark-title-fact-row
            empty-notice-card · title-with-end-action · centred-empty-notice
            (+ empty-notice-stack, contribution-calendar-stack — hai tên không có trong bảng thật)

helper restingSlotCount(name, slot) đọc restingCount từ CONTRACTS và ném lỗi khi slot không lặp
```

### CHẤM (lượt 2)

Cùng 28 mục của lượt một.

| Mục | Expected | L1 | L2 | Kết L2 | Δ |
|---|---|---|---|---|---|
| số entry | 26 | 25 (~) | 10 mới + 9 tham chiếu | ~ | giảm phủ |
| `dashboard-rail-then-main` tồn tại | có | TRÚNG | có | TRÚNG | = |
| chuỗi lớp của nó | 15 class | LỆCH (4) | **15/15, đúng thứ tự** | TRÚNG | tăng |
| ràng buộc con bằng selector trên CHA | trên cha | KHÁC MÀ ĐƯỢC | **trên cha** | TRÚNG | tăng |
| `dashboard-rail` host | `div` (không khai) | LỆCH (`aside`) | **không khai, thành div** | TRÚNG | tăng |
| main là union 3 khoá | 3 | LỆCH (1) | 2 | LỆCH | tăng nửa |
| `dashboard-main` resting 8 / `dashboard-tab-main` resting 3 | có | THIẾU | slot `section` có, `restingCount 3`, không có khoá tab | LỆCH | tăng nửa |
| `label-row-over-card` nhãn NGOÀI mặt | có | KHÁC MÀ ĐƯỢC | **đúng khoá, đúng chuỗi lớp, đúng union nhãn** | TRÚNG | tăng |
| `profile-over-stat-rows` | con `profile`+`stats` | TRÚNG (lệch tên slot) | **đúng cả tên slot** | TRÚNG | tăng |
| `stacked-stat-rows` `p-0 [&>*]:p-2`, không gap | có | LỆCH | **trùng từng ký tự** | TRÚNG | tăng |
| `marked-row-list` chuỗi lớp | 7 class | LỆCH | không khai lại, chỉ tham chiếu | TRÚNG một phần | tăng |
| `marked-row-list` resting | 5 | TRÚNG | đọc qua `restingSlotCount` | TRÚNG | = |
| `changelog-list` resting 4 | có | LỆCH | không tồn tại | THIẾU | giảm |
| `resume-card-grid` | có | THIẾU | không tồn tại | THIẾU | = |
| `bordered-goal-grid` resting 6 | có | THIẾU | không tồn tại | THIẾU | = |
| `job-readiness-list` outlined lồng | có | LỆCH | không tồn tại | THIẾU | giảm |
| `weekly-challenge-finishers` | có | THIẾU | không tồn tại | THIẾU | = |
| `contribution-calendar-card` một mặt | có | KHÁC MÀ ĐƯỢC | tách thành `stack` + `week-column` | KHÁC MÀ ĐƯỢC | = |
| `streak-summary-card` | có | THIẾU | không tồn tại | THIẾU | = |
| `empty-notice-card` chuỗi lớp | `flex flex-col gap-3 p-4` | LỆCH | không khai lại, nhưng **dùng sai chỗ** (nhồi vào `SurfaceListCard`) | LỆCH | = |
| `centred-empty-notice` khoá riêng | có | THIẾU | **có trong union của main** | TRÚNG | tăng |
| `title-with-end-action` / `title-with-baseline-fact` | hai khoá | THIẾU | có cái đầu; cái sau vắng; lại đẻ `title-with-end-status` | TRÚNG một phần | tăng |
| `nav-over-body-page` + `routed-page-main` | hai khoá | THIẾU | **có cả hai, cố ý không khai lại** | TRÚNG | tăng |
| why là LÝ DO chứ không mô tả class | có | TRÚNG | 10/10 | TRÚNG | = |
| không class tương tác/sơn/nổi | có | TRÚNG | không có | TRÚNG | = |
| không hai entry trùng chữ ký | có | TRÚNG | tự phân tích cặp gần nhất rồi kết luận | TRÚNG | = |
| tái dùng khoá thay vì đẻ khoá | có | TRÚNG | tái dùng 9, đẻ 10 | TRÚNG | = |
| không entry nào khai host trừ `routed-page-main` | có | (không có ở L1) | khai `host: nav` cho một khoá bịa | LỆCH | mục mới |

**Điểm: 15.5/28 = 55%** (14 TRÚNG, 2 TRÚNG một phần, 1 KHÁC MÀ ĐƯỢC, 4 LỆCH, 6 THIẾU, 1 dấu ngã).
**Delta so với lượt một: 9.5/28 = 34% thành 55%, +21 điểm phần trăm — mức tăng lớn nhất trong cả bảng.**

### Trục danh tính khoá — phép thử của 291 tên

Đây là con số cần đọc riêng, vì nó trả lời đúng một giả thuyết.

| Trục | Lượt 1 | Lượt 2 | Delta |
|---|---|---|---|
| tên khoá trùng bảng thật | **5/26 (19%)** | **11/26 (42%)** | **+6 khoá** |
| chuỗi lớp trùng từng ký tự | **1/26 (4%)** | **5/26 (19%)** | **+4 chuỗi** |
| khoá bịa ra | 21 | 5 | −16 |
| khoá tái dùng mà không khai lại | 3 (tình cờ biết tên) | 9 (có chủ ý, có comment) | +6 |
| chất lượng entry (why, không class cấm, không trùng chữ ký, có gộp) | 4/4 | 4/4 | = |

**Giả thuyết ĐÚNG.** Lượt một gate viết `dashboard-mode-main`, `tracked-figure-rows`,
`label-with-end-figure`, `heading-over-body` — bốn tên không có trong bảng, cho bốn thứ bảng đã có.
Lượt hai, với 291 tên trong tay, gate viết đúng `dashboard-rail-then-main`, `dashboard-rail`,
`profile-over-stat-rows`, `stacked-stat-rows`, `label-row-over-card`, và tái dùng
`nav-over-body-page`, `routed-page-main`, `marked-row-list`, `empty-notice-card`,
`title-with-end-action`, `centred-empty-notice` mà không đẻ bản sao nào.

Nhưng phép thử cũng chỉ ra **cái mà 291 tên KHÔNG chữa được**:

1. **Đúng tên, sai hình dạng con.** `dashboard-rail` đúng tên và đúng chuỗi lớp, nhưng khai một con
   `identity` không lặp thay vì `section repeats restingCount 2` — và đó chính là chỗ QuickActions
   biến mất. Một danh sách TÊN không mang theo GRAMMAR của slot.
2. **Đúng tên, dùng sai chỗ.** `empty-notice-card` được tham chiếu đúng tên rồi nhồi vào
   `SurfaceListCard`, mà nó không phải một joined list. Chính bước cuối dự báo đây sẽ là lỗi biên dịch.
3. **Mười lăm khoá vẫn vắng mặt hoàn toàn** vì mười khối tương ứng chưa được viết. Từ vựng chữa được
   lỗi ĐẶT TÊN, không chữa được lỗi ĐỘ PHỦ.

### GATE THIẾU GÌ (lượt 2)

- **Cấp tên khoá thôi chưa đủ — phải cấp cả `children` và `restingCount` của những khoá được tái
  dùng.** Đây là câu luật mới của lượt hai và nó thay thế câu số một của lượt một, vốn đã được vá
  bằng 291 tên và có kết quả đo được. Bằng chứng: `dashboard-rail` đúng tên, đúng class, sai slot.
- **`restingCount` của một slot lặp phải khớp cardinality nghiệp vụ.** Chưa vá: slot `section` của
  main khai 3 trong khi mặt overview có 8.
- **Một khoá được tham chiếu phải được kiểm là có tồn tại, bằng CÙNG phép kiểm mà rule khoá-chết
  dùng.** Lượt hai tham chiếu `empty-notice-stack` và `contribution-calendar-stack` — hai tên không
  có trong bảng — và bước cuối phải ghi vào `unenforced` vì không rule nào bắt.
- (Đã hết ở lượt hai) Câu "trước khi đặt một khoá mới, gate phải nhận vào bảng khoá hiện có" đã được
  vá, và đo được: trục tên đi từ 19% lên 42%.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

> "`no-unknown-contract-key` chỉ đọc thuộc tính `contract` tĩnh trên phần tử đúng tên `Tree`… năm
> cái tên trên đi qua `SurfaceListCard`, `SurfaceCard`, `defineContractComponent` và
> `restingSlotCount`, tức bốn trong năm hình dạng mà `no-dead-contract-key` lại tính là tham chiếu —
> **hai rule bất đồng về thế nào là gọi tên một khoá**."

Đây là phát hiện canon MỚI của lượt hai và nó thuộc về gate principles: nếu hai rule không đồng ý
"gọi tên một khoá" nghĩa là gì, thì một khoá bịa ra có thể vừa không-lạ vừa không-chết.
