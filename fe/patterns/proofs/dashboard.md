---
id: fe-patterns-proof-dashboard
title: dashboard
slug: /fe/patterns/proofs/dashboard
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
