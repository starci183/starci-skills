---
id: fe-patterns-proof-dashboard
title: dashboard
slug: /gates/patterns/proofs/dashboard
sidebar_label: dashboard
description: Chấm gate patterns trên màn dashboard — split, meta, tên hàm và cây file trúng cao; chỗ hỏng là các file mà lược đồ không có ô để khai.
---

# dashboard · gate patterns

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate principles: 25 entry, danh sách khối, tập state. Không có nguyên văn trong chuỗi mù ngoài phần gate lints chép lại.

## EXPECTED OUT

| Mục | Kỳ vọng | Neo |
|---|---|---|
| cây file route | `page.tsx`, `layout.tsx`, `access.test.tsx` | `src/app/[lang]/dashboard/` |
| cây file page | `index.tsx` + `component.tsx` | `src/components/pages/DashboardPage/` |
| 22 khối có split | ActivityFeed … WhoToFollow | `src/components/blocks/dashboard/` |
| 4 khối chỉ-index | CommunityTab, CoursesTab, ExploreTab, IdentityRail | như trên |
| test chung | `pending-gate.test.tsx` — mock toàn bộ `@/hooks` về unresolved rồi render từng khối | như trên |
| split | `index.tsx` = "use client" + hook + next-intl + router; `component.tsx` = `_X`, không hook dữ liệu, không locale | `the-split` |
| hai file mỗi thư mục | không thư mục helper | `file-layout` |
| props | `type` alias, mọi field `readonly`, handler trong object `on` với tiền tố động từ TRẦN (`resume`, `claim`, `activate`) | `props.ts` |
| hai kiểu mô hình state cùng trang | union phân biệt (ContinueLearning/DailyQuest/StreakStrip) VÀ string union phẳng (JobReadiness/WeeklyChallenge/Contributions/Changelog) | `component.tsx` các khối |
| resting | DailyQuest và ChangelogList đọc `CONTRACTS[...].restingCount`; ContinueLearning/WeeklyGoals/JobReadiness khai hằng số cục bộ | như trên |
| không skeleton twin | cùng một cây nhận `isLoading` | `loading` |
| meta | mọi file `export const meta = { world, domain } as const` | mọi file |
| ngoại lệ đã ghi | `CoursesTab` khai `world: "pure"` nhưng giữ `useState` + `"use client"` | `CoursesTab/index.tsx` |
| lệch định dạng đã ghi | `CommunityTab/index.tsx` viết dồn một dòng | như trên |

## ACTUAL OUT

```
app/[lang]/dashboard/page.tsx                 DashboardRoute, không meta
pages/DashboardPage/{index,component}.tsx     DashboardPage / _DashboardPage, có meta
pages/DashboardPage/{index,component}.test.tsx
contracts/index.ts                            CONTRACTS (sửa)
leaves/DayCell/index.tsx                      DayCell (mới)
blocks/dashboard/*  16 cặp index+component + 3 file chỉ-index (ExploreTab, CoursesTab, CommunityTab)
blocks/courses/MyCoursesProgress, RecommendedCourses  ← đặt theo MIỀN, không theo màn hình
hooks/swr/*  17 file, mỗi file một truy vấn hoặc một mutation

split: pureExport _DashboardPage, connectedExport DashboardPage, reExportsComponent false
meta:  { world: "connected", domain: "dashboard", shape: "page" }
props: type alias, readonly, on.onSelect / on.onPress — tiền tố `on`
state: DailyQuest 6 thành viên union phân biệt; mọi khối gửi xuống một TÊN, không túi cờ
resting: 3, 4, 3, 5, 2, 53, 7 — khai tại contract
mọi hàm module-level là arrow const; không skeleton twin; không children
34 khoá dịch, tất cả giải ở tầng khối
pragma `// vn-ok: matched against the URL` cho bốn giá trị tab
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| route file chỉ mount | có | `DashboardRoute` chỉ mount | TRÚNG | gốc |
| `layout.tsx` của route family | có | KHÔNG có trong danh sách | THIẾU | kế thừa (layouts) |
| `access.test.tsx` | có | không có | THIẾU | kế thừa (state khách bị bỏ) |
| page hai nửa + twin test | có | có, đủ bốn file | TRÚNG | gốc |
| `_X` cho nửa vẽ | có | `_DashboardPage`, `_DailyQuest`, `_QuickActions`… | TRÚNG | gốc |
| nửa nối không vẽ gì ngoài twin | có | có, ghi thành SPLIT-5 | TRÚNG | gốc |
| khối chỉ-index khi không đọc gì | 4 khối | 3 khối (ExploreTab/CoursesTab/CommunityTab) | LỆCH | kế thừa (IdentityRail bị cho request) |
| khối đặt theo MIỀN chứ không theo màn | `MyCoursesProgress` ở `blocks/courses` | đúng, có lý do viết ra | TRÚNG | gốc |
| hai file mỗi thư mục, không helper folder | có | có | TRÚNG | gốc |
| hook ở `src/hooks/swr`, một file một truy vấn | có | có | TRÚNG | gốc |
| test chung `pending-gate.test.tsx` | có | không có | THIẾU | gốc |
| props là `type` alias, mọi field `readonly` | có | có | TRÚNG | gốc |
| handler trong object `on` | tiền tố **động từ trần** (`resume`, `claim`, `activate`) | tiền tố **`on`** (`onSelect`, `onPress`) | LỆCH | gốc |
| state gửi xuống là một TÊN, không túi cờ | có | có | TRÚNG | gốc |
| hai kiểu mô hình state cùng tồn tại | union phân biệt + string union phẳng | chỉ union phân biệt | LỆCH | gốc |
| resting đọc từ CONTRACTS | DailyQuest, ChangelogList | khai tại contract cho cả bảy slot | TRÚNG | gốc |
| không skeleton twin | có | có | TRÚNG | gốc |
| không nhận children | có | có | TRÚNG | gốc |
| mọi export là arrow | có | có | TRÚNG | gốc |
| `meta` ở mọi file | `{ world, domain }` | `{ shape, world, domain }` — thêm `shape` | KHÁC MÀ ĐƯỢC | gốc |
| chữ giải ở tầng khối | có | 34 khoá, đều ở tầng khối | TRÚNG | gốc |
| hai file locale được sửa | phải | thừa nhận trong `owed` nhưng KHÔNG có trong `files` vì enum `role` không có ô | THIẾU (lỗi lược đồ) | gốc |

**Điểm: 14 TRÚNG · 1 KHÁC MÀ ĐƯỢC · 3 LỆCH · 4 THIẾU trên 22 = 14.5/22.**

## GATE THIẾU GÌ

- **Enum `role` của `SourceFile` phải có ô cho kho copy theo locale, cho file test chung, và cho `layout.tsx` của route family.** Ba loại file bắt buộc của một màn hình hiện không khai được, nên chúng biến mất khỏi kế hoạch dù gate biết chúng cần có — chính gate ghi điều này thành một dòng nợ.
- **`SourcePlan` phải có ô cho VĂN BẢN mã.** Cả ba trang đều phải tự chế field (`sourceSketch`, `tsx`, `propTypes`, `metaByFile`) vì lược đồ `additionalProperties:false` không có chỗ nào cho mã. Đây là lý do gate lints chỉ lint được 8 trên 60 file ở dashboard.
- **Quy ước đặt tên handler phải được chốt một lần.** Bảng thật dùng động từ trần trong `on` (`on.resume`, `on.claim`); rule `handler-on-prefix` lại chỉ cấm `handleX`. Cả hai cách đều xanh, nên hai màn hình cạnh nhau sẽ đặt tên khác nhau mãi mãi.
- **Nếu một trang có nhiều hơn một kiểu mô hình state, gate phải nói ra tiêu chí chọn.** Bảng thật có bốn khối dùng string union phẳng và ba khối dùng union phân biệt trên cùng một màn; kế hoạch ép tất cả về một kiểu và không ai biết điều đó là tốt hay xấu.

## GATE IM LẶNG Ở ĐÂU

Từ `owed` của gate lints trang này, đều là câu hỏi thuộc gate patterns:

> "Hai file `src/messages/vi.json` và `src/messages/en.json` phải được sửa cho ba mươi tư khoá, nhưng chúng không nằm trong danh sách files. Enum role của SourceFile không có thành viên nào cho một kho copy theo locale, mà bịa role sai còn tệ hơn bỏ trống."

> "Ba lược đồ meta cùng tồn tại trong repo sống và không gate nào đọc meta, nên nhãn meta trong kế hoạch này là lời khai chứ không phải bằng chứng. Marker `shape` của layout chỉ có ở ba trên sáu layout sống, nên chọn shape cho tầng page là một quy ước tôi đặt ra chứ không phải một luật tôi đọc được."

> "Nửa vẽ `_DashboardPage` KHÔNG render được từ một fixture thuần, vì con của nó là các khối nối tự gọi request. Lời hứa fixture của SPLIT-1 dừng lại ở seam khối, và không luật nào nói ra điều đó."

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Đầu ra gate principles lượt hai: 10 entry mới, 9 khoá tham chiếu, helper `restingSlotCount`.

### ACTUAL OUT (lượt 2)

Đây là ô mà lược đồ vá ăn rõ nhất. `SourceFile.source` được đặt thành **bắt buộc**, và lượt hai giao
**23 file với văn bản mã đầy đủ**, so với 8 trên 60 file có mã ở lượt một.

```
app/[lang]/dashboard/  layout.tsx · page.tsx · explore/page.tsx · courses/page.tsx
                       community/page.tsx · landmark.test.tsx
components/contracts/index.ts        (vùng entry được thêm + helper restingSlotCount)
components/leaves/DayCell/index.tsx
components/pages/DashboardOverviewPage/index.tsx      (một file, không có twin)
components/pages/DashboardCommunityPage/index.tsx     (một file, không có twin)
components/blocks/dashboard/DashboardTabStrip/  index + component
components/blocks/profile/IdentityRail/         index + component
components/blocks/dashboard/DailyQuest/         index + component
components/blocks/dashboard/ContributionCalendar/ index + component
components/blocks/dashboard/pending-gate.test.tsx
hooks/swr/  use-viewer-key · use-daily-quests-swr · use-contribution-year-swr · use-viewer-summary-swr

meta: { shape, world, domain } trên component; { world, domain } trên index; hook KHÔNG có meta
JSDoc: có trên mọi hàm export, KHÔNG có trên `export type` và `export const meta` (18 chỗ)
```

### CHẤM (lượt 2)

Cùng 22 mục của lượt một.

| Mục | Expected | L1 | L2 | Kết L2 | Delta |
|---|---|---|---|---|---|
| route file chỉ mount | có | TRÚNG | bốn route file, mỗi cái một dòng | TRÚNG | = |
| `layout.tsx` của route family | có | THIẾU | **có** | TRÚNG | tăng |
| `access.test.tsx` | có | THIẾU | không có (`landmark.test.tsx` thay chỗ, khác việc) | THIẾU | = |
| page hai nửa + twin test | có | TRÚNG | **page chỉ có `index.tsx`**, không component, không twin test | LỆCH | giảm |
| `_X` cho nửa vẽ | có | TRÚNG | `_IdentityRail`, `_DailyQuest`, `_ContributionCalendar`, `_DashboardTabStrip` | TRÚNG | = |
| nửa nối không vẽ gì ngoài twin | có | TRÚNG | có, và bốn index đều đạt cả ba nhánh của rule | TRÚNG | = |
| khối chỉ-index khi không đọc gì | 4 khối | LỆCH | 0 khối chỉ-index; 4 PAGE chỉ-index | LỆCH | = |
| khối đặt theo MIỀN chứ không theo màn | `MyCoursesProgress` ở `blocks/courses` | TRÚNG | `IdentityRail` chuyển sang `blocks/profile`, `ContinueLearning` sang `blocks/learn` — bảng thật để cả hai ở `blocks/dashboard` | LỆCH | giảm |
| hai file mỗi thư mục, không helper folder | có | TRÚNG | có | TRÚNG | = |
| hook ở `src/hooks/swr`, một file một truy vấn | có | TRÚNG | có, bốn file bốn truy vấn | TRÚNG | = |
| test chung `pending-gate.test.tsx` | có | THIẾU | **có, và mô tả khớp fixture: mock toàn bộ hook về unresolved rồi render từng khối** | TRÚNG | tăng |
| props là `type` alias, mọi field `readonly` | có | TRÚNG | có | TRÚNG | = |
| handler trong object `on`, tiền tố động từ trần | có | LỆCH | không handler nào được viết | không đo được | giảm |
| state gửi xuống là một TÊN, không túi cờ | có | TRÚNG | có | TRÚNG | = |
| hai kiểu mô hình state cùng tồn tại | union phân biệt + string union phẳng | LỆCH | chỉ union phân biệt | LỆCH | = |
| resting đọc từ CONTRACTS | DailyQuest, ChangelogList | TRÚNG | **helper `restingSlotCount` đọc bảng và NÉM LỖI khi slot không lặp** | TRÚNG | = (mạnh hơn) |
| không skeleton twin | có | TRÚNG | có | TRÚNG | = |
| không nhận children | có | TRÚNG | chỉ `layout.tsx` nhận, đúng ngoại lệ | TRÚNG | = |
| mọi export là arrow | có | TRÚNG | không một `function` nào ở mức module | TRÚNG | = |
| `meta` ở mọi file | `{ world, domain }` | KHÁC MÀ ĐƯỢC | `{ shape, world, domain }`, và 4 hook không có meta | KHÁC MÀ ĐƯỢC | = |
| chữ giải ở tầng khối | có | TRÚNG | có, 4 namespace, `useFormatter` cũng ở tầng khối | TRÚNG | = |
| hai file locale được sửa | phải | THIẾU (lỗi lược đồ) | vẫn không có file locale nào trong `files` | THIẾU | = |
| JSDoc trên MỌI export kể cả `meta` | fixture đòi | (không có ở L1) | thiếu 18 chỗ; chính bước sau chặn lại | LỆCH | mục mới |

**Điểm: 14.5/21 mục đo được = 69%** (13 TRÚNG, 1 KHÁC MÀ ĐƯỢC, 4 LỆCH, 3 THIẾU, 1 không đo được).
**Delta so với lượt một: 14.5/22 = 66% thành 69%, +3 điểm phần trăm.**

Ba điểm phần trăm là gần như đứng yên, nhưng **chất lượng bằng chứng thì không đứng yên chút nào**.
Lượt một chấm 22 mục trên 8 file có mã; lượt hai chấm 21 mục trên 23 file có mã. Cùng một điểm số,
gần gấp ba lượng mã được soi. Đó là ô `SourceFile.source` trả về đúng thứ nó hứa.

Hai mục tụt đều là tụt thật, không phải hiệu ứng đo: page bỏ nửa vẽ (và bỏ luôn twin test của page),
và hai khối bị chuyển sang miền khác miền bảng thật đặt.

### GATE THIẾU GÌ (lượt 2)

- **Một page không đọc thế giới vẫn phải có twin test, hoặc phải nói ra vì sao không cần.** Lượt hai
  lập luận rằng page không giữ request nên không nợ sinh đôi — lập luận đúng theo `the-split`, nhưng
  nó xoá luôn cái test duy nhất chứng minh thứ tự đọc của tám section. Câu luật: *một cây có thứ tự
  đọc do sản phẩm quy định phải có một phép khẳng định đếm được, độc lập với việc cây đó có nửa nối
  hay không.*
- **Miền của một khối là một dữ kiện của bảng thật, không phải một suy luận về ngữ nghĩa.**
  `blocks/profile/IdentityRail` nghe hợp lý hơn `blocks/dashboard/IdentityRail` và vẫn sai, vì miền
  quyết định đường import của mọi call site.
- **`export const meta` phải được hoà giải với `require-export-jsdoc` một lần cho cả nhà.** Nêu ở lượt
  một trên cả ba trang; lượt hai vẫn 18 chỗ đỏ ở riêng trang này. Chưa vá.
- **`SourceFile.role` phải có ô cho cây thông điệp locale.** Nêu lượt một, chưa vá; lượt hai hứa 21
  khoá dịch trên trang courses và không file nào khai chúng.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

> "Tôi không đọc được `props.ts` nên không biết literal props của slot có được trộn vào lane props
> lúc render hay không; điều đó quyết định `size` trong `DayCellData` là thừa hay bắt buộc, và tôi
> để nó ở `owed` thay vì sửa kiểu."

Đây là câu hỏi của gate patterns: *hình dạng props của một leaf gồm những gì.* Nó im lặng ở cả hai
lượt và nó là câu quyết định mọi `defineLeafComponent` trên trang.
