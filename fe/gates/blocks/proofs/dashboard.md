---
id: fe-blocks-proof-dashboard
title: dashboard
slug: /gates/blocks/proofs/dashboard
sidebar_label: dashboard
description: Chấm gate blocks trên màn dashboard — thứ tự đọc và tập state của từng khối trúng cao, nhưng một section biến mất và rail bị gộp thành một request.
---

# dashboard · gate blocks

> Ngày: 2026-08-16 · Chuỗi: layouts → blocks → principles → patterns → lints

## IN

Đầu ra gate layouts. Không có trong chuỗi mù dưới dạng nguyên văn; phần đọc lại được:

```
dashboard-rail-then-main { rail: dashboard-rail, main: dashboard-mode-main }
mode = overview | explore | courses | community
page giữ 0 request, chỉ giữ thứ tự đọc
```

Cộng câu nghiệp vụ ở gate layouts (`.claude/fe/gates/layouts/proofs/dashboard.md` § IN).

## EXPECTED OUT

| Vùng | Thành viên | Chi tiết đáng chấm | Neo |
|---|---|---|---|
| rail | `IdentityRail`, `QuickActions` | IdentityRail KHÔNG có request riêng và KHÔNG có twin — ba hàng tự settle độc lập; QuickActions tự quyết 9 shortcut xếp theo tần suất dùng | `blocks/dashboard/IdentityRail/index.tsx`, `QuickActions/index.tsx:22-32` |
| overview (8, thứ tự cố định) | ContinueLearning · DailyQuest · **StreakStrip** · WeeklyGoals · JobReadinessWidget · WeeklyChallengeCard · OverviewContributions · ChangelogList | | `contracts/index.ts:1048-1082` why |
| explore | FeedExplorer, WhoToFollow | hai block giữ request đời riêng | `ExploreTab/index.tsx` |
| courses | MyCoursesProgress, RecommendedCourses, UpcomingLivestreamCard | tab giữ `CoursePriceOverlay` cho CẢ tab | `CoursesTab/index.tsx:21-47` |
| community | LeagueCard, TopLearners | actual 2 < restingCount 3 — hợp lệ | `CommunityTab/index.tsx` |

State từng khối:

| Khối | State | Ghi chú |
|---|---|---|
| ContinueLearning | pending·onboarding·empty·failed·ready | union phân biệt; onboarding ≠ empty |
| DailyQuest | pending·empty·failed·open·claimable·claimed | nút nhận thưởng VẮNG MẶT tới khi xong ngày |
| StreakStrip | pending·failed·ready | tuần im lặng là DỮ LIỆU, không thay bằng empty |
| WeeklyGoals | pending·failed·ready | 6 hàng nghỉ |
| JobReadinessWidget | pending·empty·failed·ready | 3 metric: capstone/interview/cv |
| WeeklyChallengeCard | pending·empty·failed·ready | finishers restingCount 3 |
| OverviewContributions | pending·empty·failed·ready | year là state cục bộ |
| ChangelogList | pending·empty·failed·ready | empty → render `null` |

## ACTUAL OUT

Một phương án đi qua ranh giới; các phương án còn lại không có trong chuỗi mù.

```
rail     : IdentityRail (một request cho cả bốn giá trị, CÓ twin _IdentityRail), QuickActions (4 shortcut)
overview : ContinueLearning, DailyQuest, WeeklyGoals, JobReadinessWidget,
           WeeklyChallengeCard, OverviewContributions, ChangelogList        [7 section]
explore  : FeedExplorer, WhoToFollow
courses  : MyCoursesProgress, RecommendedCourses, UpcomingLivestreamCard
community: LeagueCard, TopLearners

State: ContinueLearning 5 (pending/onboarding/empty/failed/ready)
       DailyQuest 6 (pending/failed/empty/open/claimable/claimed)
       OverviewContributions: nhánh rỗng vẫn vẽ 53 cột ở mức không
       UpcomingLivestreamCard: đã đăng ký thì nút VẮNG MẶT, không disable
       WhoToFollow: isMutating theo TỪNG DÒNG, một hook mutation mỗi dòng
       LeagueCard: dòng người xem là props của dòng, không phải state của khối
17 hook SWR mới ở src/hooks/swr
```

## CHẤM

| Mục | Expected | Actual | Kết | Gốc / kế thừa |
|---|---|---|---|---|
| rail có 2 thành viên | IdentityRail + QuickActions | đúng hai, đúng tên | TRÚNG | gốc |
| IdentityRail không giữ request | 3 hàng tự settle độc lập | MỘT request cho cả bốn giá trị | LỆCH | gốc |
| IdentityRail không có twin | không có `_IdentityRail` | có `_IdentityRail` | LỆCH | gốc |
| QuickActions số lối tắt | 9 | 4 | LỆCH (biz không định) | gốc |
| QuickActions báo id, không giữ href | có | có | TRÚNG | gốc |
| overview số section | 8 | 7 | THIẾU (StreakStrip) | gốc |
| overview thứ tự đọc | 8 tên theo thứ tự | 7 tên đúng thứ tự tương đối | TRÚNG | gốc |
| explore 2 khối, request đời riêng | có | có | TRÚNG | gốc |
| courses 3 khối, đúng tên | có | có | TRÚNG | gốc |
| courses giữ overlay cho cả tab | có | không có dấu vết | THIẾU | gốc |
| community 2 khối, đúng tên | có | có | TRÚNG | gốc |
| ContinueLearning 5 state | có | đúng năm tên | TRÚNG | gốc |
| DailyQuest 6 state | có | đúng sáu tên | TRÚNG | gốc |
| DailyQuest nút vắng mặt chứ không disable | có | có | TRÚNG | gốc |
| StreakStrip | tồn tại, 3 state, tuần im lặng là dữ liệu | không tồn tại | THIẾU | gốc |
| WeeklyGoals 6 hàng nghỉ | 6 | 5 | LỆCH | gốc |
| JobReadiness 3 metric | 3 | 2 hàng phụ | LỆCH | gốc |
| Changelog nghỉ 4 hàng | 4 | 3 | LỆCH | gốc |
| Contributions 53×7 | có | có | TRÚNG | gốc |
| Changelog empty → null | có | không đọc được | không đo được | — |
| mỗi khối tự fetch, không ai giữ ai lại | có | có | TRÚNG | gốc |
| hook có sẵn được dùng lại | `useQueryMeSwr`, `useQueryMyWeeklyStatsSwr`, … | 17 hook MỚI, tên khác hoàn toàn | LỆCH | gốc (đói đầu vào) |

**Điểm best-of-set: không đo được.** **Điểm recommended: 12/21 mục đo được** (12 TRÚNG, 7 LỆCH, 3 THIẾU — làm tròn theo bảng).

## GATE THIẾU GÌ

- **Trước khi đặt tên một hook mới, gate phải liệt kê hook đã có trả lời cùng câu hỏi và nêu vì sao chúng không đủ.** 17 hook mới cho một màn hình mà repo đã có sẵn `useQueryMeSwr`, `useQueryMyWeeklyStatsSwr`, `useQueryMyAiQuotaSwr`, `useQueryMyRewardWalletSwr` là bảy chỗ trùng chức năng đi thẳng vào kế hoạch.
- **Một cụm chỉ số có nhiều nguồn thì mỗi hàng giữ request của mình; gộp lại thành một request là biến một hàng chậm thành cả cụm chậm.** Câu nghiệp vụ nói thẳng "không mảng chậm nào được giữ cả màn hình lại chờ", và gate vẫn gộp bốn giá trị vào một request ở rail.
- **Một khối chỉ ghép các khối đã tự fetch thì không được có twin.** Gate tự cấm điều này ở ba tab nhưng lại vi phạm ở rail.
- **Mỗi danh từ trong câu nghiệp vụ phải đối chiếu ngược ra một khối, và khối bị bỏ phải được nói ra thành một dòng nợ.** "Chuỗi ngày học liên tiếp" xuất hiện một lần trong rail và không ai hỏi nó có cần một dải bảy ngày hay không → StreakStrip biến mất im lặng.
- **`restingCount` là quyết định về số phần tử LÚC CHỜ và phải khớp cardinality thật khi cardinality đó cố định.** Sáu chỉ tiêu tuần là một con số nghiệp vụ nói ra ("sáu chỉ tiêu của tuần"), và gate vẫn hạ xuống 5.

## GATE IM LẶNG Ở ĐÂU

Không có `uncertain` của gate blocks trong chuỗi mù. Dấu vết duy nhất đọc được là một dòng owed do gate patterns để lại và gate lints chép qua:

> "Ba lược đồ meta cùng tồn tại trong repo sống và không gate nào đọc meta, nên nhãn meta trong kế hoạch này là lời khai chứ không phải bằng chứng."

Nghĩa là ở ranh giới blocks, việc một thứ là block hay composite, thuộc miền nào, được khai chứ không được kiểm — và không có ô nào để gate nói ra rằng nó đang đoán.

## Lượt 2 — 2026-08-17

### IN (lượt 2)

Đầu ra gate layouts lượt hai. Không có nguyên văn trong chuỗi mù; phần đọc lại được từ bước cuối:
bốn mặt là bốn URL, rail một thành viên, mặt overview bảy section, mặt community một section, hai
mặt còn lại chỉ có route file.

### ACTUAL OUT (lượt 2)

```
rail   dashboard-rail { identity } -> IdentityRail        (MỘT thành viên)
       IdentityRail = index + component (_IdentityRail), MỘT request useViewerSummarySwr
       QuickActions: không tồn tại

overview  ContinueLearning · DailyQuest · WeeklyGoals · JobReadiness · WeeklyChallenge
          ContributionCalendar · ProductChangelog                       (bảy, StreakStrip vắng)
          chỉ DailyQuest và ContributionCalendar có thân; năm khối còn lại chỉ là import

community WeeklyLeagueBoard                                             (một, kỳ vọng hai)
explore   không có thân
courses   không có thân

DailyQuest      state: pending | empty | ready                          (kỳ vọng sáu)
                RESTING_ROWS = restingSlotCount("marked-row-list", "row")   ← đọc từ bảng
ContributionCalendar  hai tầng slot lặp, cả hai đọc restingCount từ bảng
pending-gate.test.tsx  mock @/hooks về unresolved, render sáu khối       ← khớp kỳ vọng
hook mới: useViewerKey · useViewerSummarySwr · useDailyQuestsSwr · useContributionYearSwr
```

### CHẤM (lượt 2)

Cùng 21 mục của lượt một.

| Mục | Expected | L1 | L2 | Kết L2 | Δ |
|---|---|---|---|---|---|
| rail có 2 thành viên | IdentityRail + QuickActions | TRÚNG | một | THIẾU | ↓ |
| IdentityRail không giữ request | 3 hàng tự settle độc lập | LỆCH | MỘT request, và viết lý do bảo vệ việc gộp | LỆCH | = |
| IdentityRail không có twin | không có `_IdentityRail` | LỆCH | có `_IdentityRail` | LỆCH | = |
| QuickActions số lối tắt | 9 | LỆCH | không tồn tại | THIẾU | ↓ |
| QuickActions báo id, không giữ href | có | TRÚNG | không tồn tại; `DashboardTabStrip` thì GIỮ href | THIẾU | ↓ |
| overview số section | 8 | THIẾU | 7 | THIẾU | = |
| overview thứ tự đọc | 8 tên theo thứ tự | TRÚNG | 7 tên, thứ tự tương đối đúng, 5/7 tên trùng | TRÚNG | = |
| explore 2 khối, request đời riêng | có | TRÚNG | không có thân | THIẾU | ↓ |
| courses 3 khối, đúng tên | có | TRÚNG | không có thân | THIẾU | ↓ |
| courses giữ overlay cho cả tab | có | THIẾU | không có thân | THIẾU | = |
| community 2 khối, đúng tên | có | TRÚNG | một khối, tên khác | LỆCH | ↓ |
| ContinueLearning 5 state | có | TRÚNG | chỉ là import | không đo được | ↓ |
| DailyQuest 6 state | có | TRÚNG | ba | LỆCH | ↓ |
| DailyQuest nút vắng mặt chứ không disable | có | TRÚNG | không có nút nhận thưởng nào | THIẾU | ↓ |
| StreakStrip | tồn tại, tuần im lặng là dữ liệu | THIẾU | vẫn không tồn tại | THIẾU | = |
| WeeklyGoals 6 hàng nghỉ | 6 | LỆCH | chỉ là import | không đo được | ↓ |
| JobReadiness 3 metric | 3 | LỆCH | chỉ là import | không đo được | ↓ |
| Changelog nghỉ 4 hàng | 4 | LỆCH | chỉ là import | không đo được | ↓ |
| Contributions 53×7 | có | TRÚNG | cột 7 ngày đúng; tầng tuần đọc từ một entry chưa được khai | TRÚNG một phần | ↓ |
| Changelog empty → null | có | không đo được | chỉ là import | không đo được | = |
| mỗi khối tự fetch, không ai giữ ai lại | có | TRÚNG | có, và page viết thành lý do | TRÚNG | = |
| hook có sẵn được dùng lại | tên hook thật | LỆCH | 4 hook mới thay vì 17 | LỆCH | ↑ mức độ |

**Điểm best-of-set: vẫn không đo được.**
**Điểm recommended: 2.5/16 mục đo được = 16%** (2 TRÚNG, 1 TRÚNG một phần, 5 LỆCH, 8 THIẾU, 5 mục
tụt xuống không-đo-được).
**Δ so với lượt một: 12/21 = 57% → 16%, −41 điểm phần trăm.**

Phải đọc con số này cho đúng, vì nó dễ bị đọc sai thành "gate blocks tệ đi". **Chất lượng của bốn
khối được viết ra thì TỐT HƠN lượt một** — `DailyQuest` đọc `restingCount` từ `CONTRACTS` thay vì
hằng số tay, `pending-gate.test.tsx` xuất hiện đúng như fixture mô tả và không có ở lượt một, mỗi
khối có JSDoc nêu vì-sao chứ không nêu chữ-ký. Cái sụp là **độ phủ**: kế hoạch chỉ viết 4 trên 13
khối và 2 trên 4 mặt. Năm mục lượt một đo được thì lượt hai không còn gì để đo.

Nói gọn: lượt một sai rộng, lượt hai đúng hẹp. Với một cổng có nhiệm vụ **liệt kê**, đúng-hẹp là
loại thất bại nặng hơn.

### GATE THIẾU GÌ (lượt 2)

- **Gate blocks phải trả về đủ số thành viên cho MỌI vùng mà gate layouts đã mở, và một vùng không
  có thành viên nào là một lỗi chặn chứ không phải một dòng nợ.** Hai mặt `explore` và `courses` có
  route, có tên page, và không có một khối nào — chuỗi vẫn chạy tiếp qua ba gate nữa.
- **Số thành viên của một vùng là một con số phải khai và phải khớp với `restingCount` của slot mở
  vùng đó.** Slot `section` của rail khai `restingCount 2`, kế hoạch giao 1, và không ai đối chiếu.
- **"Ba hàng tự settle độc lập" là một câu NGHIỆP VỤ (không mảng chậm nào giữ cả màn hình lại chờ),
  không phải một sở thích kiến trúc.** Hai lượt liên tiếp gate gộp bốn giá trị vào một request và
  hai lượt liên tiếp viết một lý do nghe rất chỉnh. Câu luật: *nếu câu nghiệp vụ nói các mảng settle
  riêng thì mỗi mảng phải có một khoá cache riêng, và việc gộp phải được nêu là một đề nghị chờ duyệt.*
- **Một khối bị nêu tên nhưng không có thân thì phải được đánh dấu, và các gate sau phải từ chối
  chấm nó là đạt.** Lượt hai có năm khối như vậy và cả năm đi qua gate lints với kết quả `pass`.

### GATE IM LẶNG Ở ĐÂU (lượt 2)

> "Chín file của face explore và face courses cùng năm block còn lại của face overview và community
> vẫn chưa tồn tại, nên phán quyết này chỉ phủ phần mã đã viết… một rule chỉ nói được điều gì đó về
> file có thật, nên xanh ở đây không phải xanh cho cả trang mà chỉ cho hai mươi ba file đang có mặt."

Bước cuối biết chính xác điều gì đang thiếu và ghi nó xuống. Không có ô nào trong chuỗi để lời khai
đó chặn được cái gì.
