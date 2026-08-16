---
id: fe-layouts-proof-dashboard-page
title: DashboardPage
slug: /gates/layouts/proofs/dashboard-page
sidebar_label: DashboardPage
description: Chấm bản dựng mù của trang tổng quan học viên so với cấu trúc thật, và ghi lại những câu luật gate còn thiếu.
---

# DashboardPage

> Trang: dashboard · Gate: layouts · Ngày: 2026-08-16

## Yêu cầu nghiệp vụ

Học viên đã đăng nhập cần một chỗ mở đầu mỗi ngày để biết mình đang đứng ở đâu và học tiếp cái gì; người chưa đăng nhập không được xem gì ở đây mà bị đưa về màn đăng nhập. Dù đang xem phần nào, họ cũng luôn nhìn thấy danh tính của mình cùng ba con số theo dõi thường xuyên là chuỗi ngày học, tín dụng AI và ví phần thưởng, kèm các lối tắt sang những khu vực hay dùng nhất. Phần nội dung chính đổi theo việc họ đang muốn làm: xem tiến độ của chính mình (bài đang học dở, nhiệm vụ ngày, chuỗi ngày, mục tiêu tuần, độ sẵn sàng đi làm, thử thách tuần, lịch sử đóng góp, thông báo cập nhật sản phẩm), khám phá bài viết và người đáng theo dõi, quản lý khoá đã mua cùng gợi ý khoá mới và buổi live sắp tới, hoặc xem mình đứng đâu so với cộng đồng. Mỗi mảng số liệu lấy dữ liệu riêng nên cái nào có trước hiện trước chứ không chờ nhau, và việc đang chọn phải quay lại hoặc chia sẻ được bằng đường dẫn.

## Cấu trúc thật

| # | Mục | Sự thật | Neo |
|---|---|---|---|
| 1 | Archetype trang | `rail-then-main`, contract `dashboard-rail-then-main`, đúng 2 slot cứng `rail` + `main`, không có slot thứ ba | contracts/index.ts:1048 |
| 2 | Ai mở landmark | Trang KHÔNG tự mở `main`; route layout mở qua contract `routed-page-main`. Trang chỉ là một `<div>` Tree bên trong | src/app/[lang]/dashboard/layout.tsx:30 · contracts/index.ts:741 |
| 3 | Số slot cấp trang | 2 | contracts/index.ts:1048 |
| 4 | Rail chứa gì | `IdentityRail` + `QuickActions`, restingCount 2 | pages/DashboardPage/component.tsx:56-61 |
| 5 | Rail đứng yên | Dựng TRƯỚC nhánh rẽ, không đọc `selectedTab`; cả 4 tab nhận đúng một cây rail | component.tsx:51-61 |
| 6 | Danh tính người xem | Là một KHỐI (`IdentityRail`) có request riêng, không phải state của layout | blocks/dashboard/IdentityRail/index.tsx:24-40 |
| 7 | Ba con số theo dõi | Nằm TRONG cùng khối `IdentityRail` (render `profile-over-stat-rows`), không phải ba khối rời | IdentityRail/index.tsx:26-37 |
| 8 | Bộ chuyển mode | KHÔNG thuộc trang. Nằm ở navbar của route layout (`ShellNav`, double-navbar) | layouts/ShellNav/index.tsx:36-41,122-133 |
| 9 | Số mode và tên | 4: overview, explore, courses, community | pages/DashboardPage/index.tsx:19 |
| 10 | Mode lên URL bằng gì | Query param `?tab=` trên MỘT route, đọc bằng `useSearchParams` | index.tsx:19,29-31 |
| 11 | Mode không hợp lệ | Whitelist `TAB_IDS`, fallback `overview` | index.tsx:29-31 |
| 12 | Mount theo mode | Ternary 4 tầng: chỉ tab đang chọn được dựng | component.tsx:63-90 |
| 13 | Trang sở hữu request nào | KHÔNG cái nào. 15 SWR hook nằm trong các block | component.tsx:22 · pending-gate.test.tsx:25-42 |
| 14 | Chưa đăng nhập | `useEffect` redirect `router.replace("/authentication")`; không tồn tại hình dạng dashboard cho khách | index.tsx:33-37 |
| 15 | Đang giải phiên | `if (session.isRestoring \|\| token === undefined) return null` — KHÔNG vẽ khung nghỉ | index.tsx:33-37 |
| 16 | State lỗi cấp màn | Không có. Nửa pure là hàm thuần, không useState/useEffect/useRef | component.tsx:49-101 |
| 17 | loading/empty/error cấp trang | Không có. Mỗi block tự settle | component.tsx:26-29 |
| 18 | overview | 8 section, thứ tự khoá cứng: ContinueLearning, DailyQuest, StreakStrip, WeeklyGoals, JobReadinessWidget, WeeklyChallengeCard, OverviewContributions, ChangelogList | component.tsx:71-83 · contracts/index.ts:1063 |
| 19 | explore | 1 section `ExploreTab` → `explore-main { feed: FeedExplorer, suggestions: WhoToFollow }` | blocks/dashboard/ExploreTab/index.tsx:8-13 |
| 20 | courses | 3: MyCoursesProgress, RecommendedCourses, UpcomingLivestreamCard | blocks/dashboard/CoursesTab/index.tsx:24-38 |
| 21 | community | 2: LeagueCard, TopLearners | blocks/dashboard/CommunityTab/index.tsx:6 |
| 22 | Overlay giá ở tab courses | `CoursesTab` tự giữ `pricedCourseId` và render `<CoursePriceOverlay>` như sibling của Tree; state KHÔNG thuộc trang | CoursesTab/index.tsx:21,39-43 |
| 23 | Nhánh dự phòng | `centred-empty-notice`, chết trong đường sống; bên trong còn một ternary chết thứ hai. i18n cả trang đúng 1 key `dashboard.unavailable` | component.tsx:84-90 · messages/en.json:75 |
| 24 | Hẹp lại | Dưới 768px: `flex-col`, rail xếp TRÊN main, `w-full`. Không mất gì, không ẩn, không thu gọn, không thanh đáy, không sticky | contracts/index.ts:1049,1054 |
| 25 | Loại truy vấn | Viewport media query (`md:`), KHÔNG phải container query — anh em `profile-identity-rail` lại dùng `@app-md:` | contracts/index.ts:1049,813 |
| 26 | Bề rộng rail | `md:w-72` (288px) + `shrink-0`; main `min-w-0 grow` | contracts/index.ts:1049 |
| 27 | Cách nhận cây con | Đúng một prop `props: DashboardPageData`; không React children ở bất kỳ đâu; cây con truyền bằng prop `render` của `Tree` | component.tsx:40-42,93-99 |
| 28 | Rail bên nào | Con đầu tiên → bên trái | contracts/index.ts:1049 |

## Bản dựng mù

| # | Mục | Bản mù | Căn cứ bản mù nêu |
|---|---|---|---|
| 1 | Archetype trang | `frame-with-identity`: rail + hốc body | Có thứ đứng yên và có state cấp màn hình |
| 2 | Ai mở landmark | Layout cấp hốc body, page con nằm trong đó | L5 |
| 3 | Số slot cấp trang | 2 (rail, body socket) | — |
| 4 | Rail chứa gì | Danh tính + 3 con số + lối tắt + bộ chuyển mode | Câu 1 của gate |
| 5 | Rail đứng yên | Mount MỘT lần, đổi mode không refetch, không remount | Luật gốc |
| 6 | Danh tính người xem | KHÔNG phải khối — state cấp màn hình của layout | Chữ "rail giữ danh tính" của frame-with-identity |
| 7 | Ba con số theo dõi | Ba khối `standing-figure` rời, mỗi cái một request | Archetype standing-figure |
| 8 | Bộ chuyển mode | `seating-plan` nằm trong rail | Rail giữ điều hướng |
| 9 | Số mode và tên | 4: progress, explore, courses, community | Câu 2 |
| 10 | Mode lên URL bằng gì | Bốn route con `/home/(progress\|explore\|courses\|community)` | L5 đòi page owner thật mỗi route |
| 11 | Mode không hợp lệ | Chuẩn hoá về `progress`, không vẽ màn lỗi | Câu 6 |
| 12 | Mount theo mode | Chỉ mount mode đang mở, không prefetch | Câu 4 |
| 13 | Trang sở hữu request nào | Không; mỗi khối tự fetch, không gate chờ đủ | Yêu cầu nghiệp vụ |
| 14 | Chưa đăng nhập | Điều hướng về đăng nhập, không vẽ gì | Câu 6 |
| 15 | Đang giải phiên | Vẽ khung + rail ở dạng pending để tránh nháy layout | Tự quyết, có ghi uncertain |
| 16 | State lỗi cấp màn | Có `identity-failed`: rail vẽ khối hỏng, body không mount | Tự đặt |
| 17 | loading/empty/error cấp trang | Không có trang pending phủ body | Thang state chuẩn |
| 18 | overview | 8 khối, đúng thứ tự nghiệp vụ liệt kê | B10 |
| 19 | explore | article-feed + people-to-follow | Câu 2 |
| 20 | courses | my-courses, course-suggestions, upcoming-live | Câu 2 |
| 21 | community | my-standing + leaderboard | Câu 2 |
| 22 | Overlay giá ở tab courses | Không nói | — |
| 23 | Nhánh dự phòng | Không có; mode lạ chuẩn hoá thẳng về progress | Câu 6 |
| 24 | Hẹp lại | Rail tách đôi: dải đỉnh mang danh tính + 3 số, thanh đáy 4 mục cho bộ chuyển, lối tắt gộp vào overflow overlay | Mượn nhánh hẹp của frame-with-nav-rail |
| 25 | Loại truy vấn | Không nói | — |
| 26 | Bề rộng rail | Không nói, "thuộc layout owner" | L10 |
| 27 | Cách nhận cây con | Dữ liệu đóng, không ReactNode | B13 |
| 28 | Rail bên nào | Trái | Thói quen đọc, tự nhận là đoán |

## Chấm

| # | Mục | Thật | Mù | Kết |
|---|---|---|---|---|
| 1 | Archetype trang | rail-then-main, 2 slot | frame-with-identity, rail + hốc | TRÚNG |
| 2 | Ai mở landmark | route layout | layout | TRÚNG |
| 3 | Số slot | 2 | 2 | TRÚNG |
| 4 | Rail chứa gì | danh tính + số + lối tắt | đúng, cộng bộ chuyển | TRÚNG |
| 5 | Rail đứng yên | có | có | TRÚNG |
| 6 | Danh tính | khối có request | state của layout | LỆCH |
| 7 | Ba con số | trong cùng 1 khối | 3 khối rời | LỆCH |
| 8 | Bộ chuyển mode | navbar route layout | rail | LỆCH |
| 9 | Số mode | 4, cùng tập | 4, cùng tập | TRÚNG |
| 10 | URL | `?tab=` một route | 4 route con | KHÁC MÀ ĐƯỢC |
| 11 | Mode lạ | fallback overview | fallback progress | TRÚNG |
| 12 | Mount theo mode | chỉ tab đang chọn | chỉ mode đang mở | TRÚNG |
| 13 | Request của trang | không | không | TRÚNG |
| 14 | Chưa đăng nhập | redirect | redirect | TRÚNG |
| 15 | Đang giải phiên | `return null` | vẽ khung pending | LỆCH |
| 16 | Lỗi cấp màn | không tồn tại | bịa `identity-failed` | LỆCH |
| 17 | Pending cấp trang | không có | không có | TRÚNG |
| 18 | overview | 8, thứ tự cố định | 8, đúng thứ tự | TRÚNG |
| 19 | explore | feed + suggestions | feed + people | TRÚNG |
| 20 | courses | 3, đúng thứ tự | 3, đúng thứ tự | TRÚNG |
| 21 | community | league + top learners | standing + leaderboard | TRÚNG |
| 22 | Overlay giá tab courses | CoursesTab tự giữ | — | THIẾU |
| 23 | Nhánh dự phòng + i18n | có, chết | — | THIẾU |
| 24 | Hẹp lại | chỉ xếp dọc, không mất gì | thanh đáy + overflow overlay | LỆCH |
| 25 | Loại truy vấn | viewport | — | THIẾU |
| 26 | Bề rộng rail | w-72 cố định | — | THIẾU |
| 27 | Nhận cây con | prop, không children | dữ liệu đóng | TRÚNG |
| 28 | Rail bên nào | trái | trái | TRÚNG |

Điểm: 17/28 trúng (+1 khác mà được) · 6 lệch · 4 thiếu.

## Gate thiếu gì

- **Danh tính người xem là một KHỐI có request riêng, không phải state của layout.** Layout chỉ mang state khi state đó quyết định trang có tồn tại hay không (phiên đăng nhập); mọi thứ đọc được từ máy chủ đều là khối. — chữa mục 6.
- **Một hàng danh tính cộng các con số kèm theo là MỘT khối, không phải một khối cho mỗi con số.** Tách thành nhiều standing-figure chỉ hợp lệ khi mỗi con số đến từ một request riêng và có thể về lệch giờ nhau. — chữa mục 7.
- **Bộ chuyển mode cấp trang thuộc chrome của route cluster (tầng hai của navbar), không thuộc rail của trang.** Rail giữ thứ đứng yên; thanh chuyển mode đứng yên ở tầng CAO HƠN trang nên nó thuộc navbar. Gate đã có L3 mô tả tầng hai của navbar nhưng không có câu nào bắt phải nhận ra thanh chuyển mode chính là nó. — chữa mục 8.
- **Trong lúc phiên chưa giải, trang trả về rỗng chứ không vẽ khung nghỉ.** Hình dạng của người chưa đăng nhập không tồn tại, nên vẽ khung rồi mới redirect là vẽ một màn không ai được xem. — chữa mục 15.
- **Không được thêm một state cấp màn hình nào mà nghiệp vụ không nêu.** B5 đã cấm bịa field ở tầng khối; chưa có câu tương đương ở tầng màn hình, nên bản mù bịa `identity-failed`. — chữa mục 16.
- **Rail chỉ đổi thành thanh dính đáy khi rail chứa một CAM KẾT (hành động phải luôn với tới được). Rail chỉ mang danh tính, số liệu và lối tắt thì khi hẹp xếp dọc lên trên body và không dính.** Gate chỉ cho nhánh hẹp của `frame-with-nav-rail` nên bản mù mượn sai. — chữa mục 24.
- **Overlay do page owner hoặc block owner của vùng mount như sibling; trang không giữ state của overlay thuộc một vùng con.** Gate không có câu nào về nơi mount overlay, chỉ có L6 nói bên trong overlay. — chữa mục 22.
- **Khai rõ ngưỡng là viewport hay container, và mặc định là viewport; container query chỉ dùng khi cùng một khối phải sống ở hai bề rộng khác nhau.** Gate im lặng hoàn toàn về loại truy vấn. — chữa mục 25.
- **Bề rộng cố định của rail là một con số phải khai ở archetype (ở đây 288px), không phải "để layout owner quyết" rồi bỏ trống.** L10 nói ai sở hữu nhưng không bắt phải nói ra con số. — chữa mục 26.
- **Nhánh không thể đạt tới từ đường sống là mã chết, không phải một trạng thái.** Gate không có câu nào phân biệt trạng thái có thật với nhánh chỉ test chạm tới. — chữa mục 23.

## Chỗ phải đoán

Nguyên văn trường `uncertain` của bản dựng mù:

- Gate không nói rail nằm bên nào. Tôi chọn rail TRÁI, thuần theo thói quen đọc trái-sang-phải, không có căn cứ nào trong gate.
- Gate không quyết giữa route con và query param cho mode. Cả hai đều hợp lệ dưới L4/L5. Tôi chọn bốn route con vì frame-with-identity đòi một layout owner thật và L5 đòi page owner thật cho mỗi route; nếu canon thật sự coi bốn mode là 'tab' thì phải là ?view= trên một page owner duy nhất và L3 (dính liền navbar, sticky, không gap) sẽ áp cho thanh chuyển — lúc đó cấu trúc rail của tôi phải sửa.
- Gate không có archetype cho khối 'danh tính người xem'. Tôi coi nó là state cấp màn hình của layout thay vì một block, dựa vào chữ 'rail giữ danh tính' — nhưng gate không nói danh tính có thang state riêng hay không, và tôi tự cho nó một state failed cấp màn hình.
- standing-figure 'không có failed riêng' — gate không nói khi request của một figure lỗi thì nó rơi vào pending hay empty. Tôi chọn empty (figure vẫn đứng, giá trị ở dạng nghỉ), nhưng đây là đoán.
- Mọi con số restingCount (3, 5, 7, 10, 12, 2) là tôi tự chọn. Gate chỉ nói 'repeats kèm restingCount', không cho quy tắc suy ra số hàng nghỉ.
- Gate không nói 'bài đang học dở' là một mục tiếp-tục duy nhất hay một danh sách. Tôi chọn danh sách (named-run). Nếu nghiệp vụ chỉ có một bài gần nhất thì nó là standing-offer với control tiếp tục mọc/rụng.
- 'Nhiệm vụ ngày' có control nhận thưởng hay không thì yêu cầu không nói. Tôi giữ named-run và không vẽ control nhận thưởng (B5 cấm bịa field) — nếu backend có claim thì khối phải thành standing-offer.
- 'Mục tiêu tuần' có do người học tự đặt không thì yêu cầu không nói. Tôi giữ standing-figure vì không dám bịa control đặt mục tiêu.
- 'Thử thách tuần' tôi cho là standing-offer với control tham gia. Yêu cầu chỉ nói 'xem thử thách tuần', nên việc có control tham gia là suy diễn.
- 'Người đáng theo dõi' tôi cho mọc control theo dõi. Từ 'đáng theo dõi' gợi ý điều đó nhưng yêu cầu không xác nhận có hành động follow.
- 'Độ sẵn sàng đi làm' tôi cho là một nhãn một giá trị. Nếu nó là bảng phân rã theo kỹ năng thì phải là named-run, và tôi không có dữ kiện để biết.
- 'Lịch sử đóng góp' tôi mô hình hoá là named-run theo chu kỳ. Nếu nó là lưới nhiệt theo ngày thì gate không có archetype nào mô tả một lưới hai chiều — đây là chỗ bộ archetype có thể thiếu.
- Thứ tự các khối bên trong mỗi mode và việc chia mấy cột là tôi tự sắp. Gate nói nhóm ngữ nghĩa trước gap sau nhưng không cho thứ tự ưu tiên giữa các khối cùng mode.
- Gate không liệt kê tập state cấp màn hình chuẩn (chỉ hỏi câu 6). Năm state tôi đưa ra là tôi tự định nghĩa, gồm cả cách xử lý mode không hợp lệ trong URL.
- Gate không nói lúc auth-resolving thì vẽ khung hay không vẽ gì. Tôi chọn vẽ khung ở dạng pending để tránh nháy layout, nhưng cách kia (chờ trắng rồi mới vẽ/redirect) cũng không bị luật nào cấm.
- Hành vi hẹp lại của frame-with-identity không được gate mô tả — tôi mượn nhánh hẹp của frame-with-nav-rail (thanh đáy) và tự quyết rằng danh tính + ba con số sống sót dưới dạng dải đỉnh còn lối tắt rụng vào overflow.
- Gate không nói ba con số ở rail có tự làm mới theo thời gian không (ví dụ tín dụng AI vừa bị tiêu ở nơi khác). Tôi giả định chúng chỉ fetch một lần cho mỗi phiên màn và được cập nhật bởi hành động, không polling.
- Gate không nói bảng xếp hạng có phạm vi chọn được (tuần / mọi thời điểm). Tôi không đưa phạm vi vào URL vì nghiệp vụ chỉ đòi 'việc đang chọn' — nếu có phạm vi thì phải quyết lại nó thuộc URL hay bộ nhớ.
- Tôi giả định màn này nằm dưới một navbar toàn cục đã tồn tại. Yêu cầu không nói, và nếu không có navbar thì rail phải gánh thêm điều hướng cấp app, làm đổi nội dung của seating-plan lối tắt.
