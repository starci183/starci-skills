---
id: fe-blocks-proof-daily-quest
title: DailyQuest
slug: /fe/blocks/proofs/daily-quest
sidebar_label: DailyQuest
description: Chấm bản dựng mù của khối nhiệm vụ ngày so với cấu trúc thật, và ghi lại những câu luật gate còn thiếu.
---

# DailyQuest

> Trang: dashboard · Gate: blocks · Ngày: 2026-08-16

## Yêu cầu nghiệp vụ

Học viên đã đăng nhập, mỗi ngày mở trang tổng quan để biết hôm nay còn phải làm gì mới được nhận thưởng. Hệ thống giao một nhóm việc trong ngày, mỗi việc có tên và con số đã làm trên tổng cần làm, kèm số xu nhận được nếu làm xong toàn bộ. Ràng buộc: chỉ khi hoàn thành hết mới được phép nhận, và mỗi ngày chỉ nhận đúng một lần, vì "làm xong hết" và "đã nhận thưởng" là hai sự thật riêng, không suy ra được nhau. Mốc ngày do máy chủ chốt chứ không theo đồng hồ máy người dùng, và có ngày hệ thống không giao việc nào.

## Cấu trúc thật

| # | Mục | Sự thật | Neo |
|---|---|---|---|
| 1 | Cặp pure/connected | Có. `component.tsx` export `_DailyQuest` (world pure, domain quest); `index.tsx` export `DailyQuest` ('use client', world connected). Không story | DailyQuest/component.tsx:17 · index.tsx:31 |
| 2 | Archetype khối | Danh sách có tên + một control mọc/rụng theo nghiệp vụ | component.tsx:47 |
| 3 | Tự gọi request | Có, đúng một: `useQueryMyDailyQuestSwr()` → GraphQL `MyDailyQuest` (withAuth) | hooks/swr/useQueryMyDailyQuestSwr.ts:13 |
| 4 | Khoá SWR | Nối danh tính người xem; key = null khi viewer chưa resolve nên không bắn request nặc danh; thiếu payload thành `null` chứ không `undefined` | useQueryMyDailyQuestSwr.ts:22 |
| 5 | Số state | 6, union phân biệt bằng `state`: pending \| empty \| failed \| open \| claimable \| claimed | component.tsx:47-62 |
| 6 | Thứ tự settle | error→failed; undefined→pending; null hoặc tasks rỗng→empty; `claimed===true`→claimed; `allDone===true`→claimable; còn lại→open | index.tsx:42-74 |
| 7 | empty gồm những gì | `data === null` HOẶC `tasks.length === 0` | index.tsx:51 |
| 8 | pending và open | CÙNG một cây, chỉ khác `isLoading` | component.tsx:91 |
| 9 | empty và failed | Rẽ sang cây khác: `SurfaceCard` + contract `empty-notice-card` + composite `EmptyNotice` icon 'review'. empty không nút, failed có retry gọi `quest.mutate()`. Cả hai giữ nguyên `label` | component.tsx:150,170 |
| 10 | Nút nhận thưởng | VẮNG MẶT chứ không disabled ở open và claimed; test khẳng định container không có button | component.test.tsx:63 |
| 11 | Retry ở failed | Có | component.tsx:170 |
| 12 | restingCount | 5 (`marked-row-list.row`, repeats true) | contracts/index.ts:1169 |
| 13 | Nguồn restingCount | Đọc ngược từ `CONTRACTS['marked-row-list'].children.row.restingCount`, KHÔNG hardcode; sinh id `resting-<i>` | component.tsx:88 |
| 14 | Hình dạng một hàng | contract `task-mark-title-fact-row`: mark (leaf icon) + title (text sm) + fact (text xs muted) | contracts/index.ts:1650 |
| 15 | fact là gì | `current/target`, KHÔNG phải phần trăm — quest đếm bằng số việc nguyên | index.tsx:22-27 |
| 16 | Badge | Không có badge nào trong khối | component.tsx:129 |
| 17 | Dấu hoàn tất | Leaf icon `complete` khi percent===100, ngược lại `pending` | component.tsx:129 |
| 18 | Câu thưởng | Text xs muted dưới surface; nhãn nhận thưởng là Button size sm variant primary | component.tsx:129 |
| 19 | Trường `date` | Fetch về nhưng KHÔNG hiển thị ở bất kỳ đâu | index.tsx:42 |
| 20 | Nhận gì từ nơi gọi | KHÔNG GÌ CẢ — `DailyQuest` được gọi không props, bọc trong projection `label-row-over-card` của `dashboard-main` | pages/DashboardPage/component.tsx:75 |
| 21 | Dữ liệu đóng | Nửa pure nhận đúng một union đã chốt; không ReactNode | component.tsx:47 |
| 22 | Nhãn section do ai phát | `SurfaceListCard` tự in `<Heading level=3>` phía trên Card; test khẳng định `data-node='title-with-end-action'` là null, tức contract cha KHÔNG phát nhãn | branches/SurfaceListCard/index.tsx:86 |
| 23 | Một surface owner | Có; contract cha khai nhãn ngoài surface nhưng khối không vẽ contract đó | contracts/index.ts:1077 |
| 24 | Hành động nhận thưởng | Nhánh `claimable` CHẾT trong đường sống: nửa connected không truyền `on`, và toàn repo không có mutation claim nào | index.tsx:78 |
| 25 | percent | Tính trong `toRow` (clamp, chống chia 0) nhưng chỉ dùng để chọn icon; không có leaf progress nào được vẽ | component.tsx:88 |
| 26 | Vỏ layout | Khối là một section trong `dashboard-main` của DashboardPage, không có layout riêng | DashboardPage/component.tsx:75 |

## Bản dựng mù

| # | Mục | Bản mù | Căn cứ bản mù nêu |
|---|---|---|---|
| 1 | Cặp pure/connected | Không nói | — |
| 2 | Archetype khối | `standing-offer` | named-run + một control mọc/rụng, vắng mặt chứ không disabled |
| 3 | Tự gọi request | Một lần đọc duy nhất cho ngày hiện tại | Câu 4 |
| 4 | Khoá SWR | Không nói | — |
| 5 | Số state | 4 bậc dữ liệu (failed/pending/empty/ready) + 3 nhánh nghiệp vụ trong ready (chưa-xong / xong-chưa-nhận / đã-nhận) | Thang state chuẩn + standing-offer |
| 6 | Thứ tự settle | Đọc `claimed` TRƯỚC, không suy từ tiến độ | Nghiệp vụ "hai sự thật riêng" |
| 7 | empty gồm những gì | Máy chủ không giao việc nào cho ngày này | B4 |
| 8 | pending và open | Chính cây ready với isLoading=true và data rỗng; cấm skeleton twin | Thang state chuẩn |
| 9 | empty và failed | Khối vẫn được vẽ, một phát biểu; empty không nút, failed có retry | B4 |
| 10 | Nút nhận thưởng | Chỉ CÓ MẶT ở nhánh xong-chưa-nhận; vắng mặt chứ không disabled | standing-offer |
| 11 | Retry ở failed | Có (tự nhận là chỗ đoán) | — |
| 12 | restingCount | 3 | Tự chọn |
| 13 | Nguồn restingCount | Không nói | — |
| 14 | Hình dạng một hàng | Tên việc (chữ) + đã làm/cần làm (chữ, thẳng cột phải) + dấu hoàn tất | B7 |
| 15 | fact là gì | `đã làm / cần làm` | B2 |
| 16 | Badge | Không badge; con số là CHỮ | B2 |
| 17 | Dấu hoàn tất | Tick/icon khi đã-làm = cần-làm, vì đó là state thật | B2 |
| 18 | Câu thưởng | Số xu nếu làm xong toàn bộ, luôn hiện khi có việc; chỗ của control nhận nằm cạnh | B8 |
| 19 | Trường `date` | `dayKey` là sự thật trung tâm, chủ sở hữu vô hình giữ nó, và thêm state `ngay-da-lat` khi lệch | Nghiệp vụ "mốc ngày do máy chủ chốt" |
| 20 | Nhận gì từ nơi gọi | Vị trí + một object dữ liệu đóng (dayKey, tasks, rewardCoins, claimed, isLoading, error) + handler nhận thưởng | B3, B13 |
| 21 | Dữ liệu đóng | Có, không ReactNode | B13 |
| 22 | Nhãn section do ai phát | Không nói | — |
| 23 | Một surface owner | Đúng một card cho toàn khối; hàng không phải card | B1 |
| 24 | Hành động nhận thưởng | Giả định có, kèm 5 trạng thái riêng (idle/đang chạy/lỗi/thành công/xung đột) | B11 |
| 25 | percent | Không vẽ thanh tiến độ; cân nhắc rồi bỏ một con số tổng hợp | B5 |
| 26 | Vỏ layout | `invisible-owner`, tự hedge rằng có thể khối chỉ là một phần của trang | Câu 7 |

## Chấm

| # | Mục | Thật | Mù | Kết |
|---|---|---|---|---|
| 1 | Cặp pure/connected | có | — | THIẾU |
| 2 | Archetype | danh sách + control mọc/rụng | standing-offer | TRÚNG |
| 3 | Tự gọi request | 1 request | 1 lần đọc | TRÚNG |
| 4 | Khoá SWR gắn danh tính | có | — | THIẾU |
| 5 | Số state | 6 | 4 + 3 nhánh, ánh xạ khớp | TRÚNG |
| 6 | Thứ tự settle | claimed trước allDone | claimed trước | TRÚNG |
| 7 | empty | null hoặc rỗng | không giao việc | TRÚNG |
| 8 | pending = open | cùng cây | cùng cây | TRÚNG |
| 9 | empty/failed | phát biểu, failed có retry | như vậy | TRÚNG |
| 10 | Nút nhận | vắng mặt | vắng mặt | TRÚNG |
| 11 | Retry | có | có | TRÚNG |
| 12 | restingCount | 5 | 3 | LỆCH |
| 13 | Nguồn restingCount | đọc từ contract | — | THIẾU |
| 14 | Hàng | mark + title + fact | dấu + tên + số | TRÚNG |
| 15 | fact | x/y | x/y | TRÚNG |
| 16 | Badge | không | không | TRÚNG |
| 17 | Dấu hoàn tất | icon | tick | TRÚNG |
| 18 | Câu thưởng | text xs + button | như vậy | TRÚNG |
| 19 | `date` | lấy về rồi bỏ | thành sự thật trung tâm + 1 state thêm | LỆCH |
| 20 | Nhận từ nơi gọi | KHÔNG GÌ | object đóng + handler | LỆCH |
| 21 | Dữ liệu đóng | có (nửa pure) | có | TRÚNG |
| 22 | Nhãn do branch phát | SurfaceListCard | — | THIẾU |
| 23 | Một surface owner | có | có | TRÚNG |
| 24 | Hành động nhận thưởng | nhánh chết, không có mutation | giả định có | THIẾU |
| 25 | percent / thanh tiến độ | tính mà không vẽ | không vẽ | TRÚNG |
| 26 | Vỏ layout | section của DashboardPage | invisible-owner (có hedge) | KHÁC MÀ ĐƯỢC |

Điểm: 16/26 trúng (+1 khác mà được) · 3 lệch · 6 thiếu.

## Gate thiếu gì

- **Mỗi khối có dữ liệu là một CẶP: `component.tsx` thuần nhận một union đã chốt và không import i18n hay hook nào; `index.tsx` connected sở hữu request, dịch chuỗi và chọn state.** Gate không có một chữ nào về cặp này, nên bản mù mô tả một khối duy nhất vừa fetch vừa vẽ. — chữa mục 1 và 20.
- **Nửa connected được gọi KHÔNG PROP; nơi gọi chỉ đặt nó vào một slot.** Bản mù nói khối "nhận một object dữ liệu đóng" — đúng cho nửa pure, sai cho thứ mà trang thật sự mount. — chữa mục 20.
- **Khoá cache của một khối có dữ liệu riêng người xem phải nối danh tính người xem, và bằng null khi danh tính chưa giải.** Không có khoá thì khối bắn một request nặc danh rồi vẽ dữ liệu của người khác. Gate im lặng hoàn toàn về cache. — chữa mục 4.
- **Phân biệt `undefined` (chưa về) với `null` (máy chủ trả lời là không có gì): `null` rơi vào empty, `undefined` rơi vào pending.** Thang state chuẩn chỉ nói "chưa có data" và "data rỗng", không nói hai thứ đó khác nhau ở tầng envelope. — chữa mục 7 (bản mù trúng bằng trực giác chứ không bằng luật).
- **restingCount khai ở contract; khối đọc ngược từ contract, không viết con số trong mã.** — chữa mục 12 và 13.
- **Một trường được lấy về mà không hiển thị là một trường THỪA trong query, không phải một trục để dựng thêm state.** Bản mù biến `date` thành chủ sở hữu vô hình và một state `ngay-da-lat` mà mã thật không có. — chữa mục 19.
- **Nhãn của một section do BRANCH phát (SurfaceListCard tự in heading), không do contract cha; contract cha chỉ khai hình dạng.** Đây là chỗ hai nơi cùng tuyên bố sở hữu một nhãn và không luật nào phân xử. — chữa mục 22.
- **Trước khi vẽ một control hành động, xác nhận mutation tương ứng có tồn tại; không có mutation thì control là một nhánh chết và phải báo là thiếu backend.** Ở đây `claimable` không đạt tới được từ đường sống. B11 nói mỗi action một pending owner nhưng không bắt kiểm action có thật hay không. — chữa mục 24.

## Chỗ phải đoán

Nguyên văn trường `uncertain` của bản dựng mù:

- Gate không nói khối việc-hôm-nay là TOÀN BỘ trang tổng quan hay chỉ một khối trong đó. Tôi coi nó là một khối trên một trang có nội dung khác mà yêu cầu không kể, nên layout không vẽ chrome nào.
- Gate không nói số xu / cờ đã-nhận có được đọc ở nơi khác không (ví dụ số dư xu trên navbar). Tôi chọn invisible-owner để một lần nhận cập nhật đúng một chủ sở hữu. Nếu chỉ trang này đọc, owner co lại thành page owner và KHÔNG có layout archetype nào cả — đây là chỗ đoán lớn nhất của tôi.
- restingCount = 3 là tôi bịa. Gate không cho con số, nghiệp vụ không nói một ngày thường giao mấy việc.
- Gate không nói khi pending thì dòng số xu có vẽ ở dạng nghỉ hay biến mất. Tôi cho vẽ dạng nghỉ để khung không nhảy.
- Không biết backend có trả mốc reset / đếm ngược không. B5 cấm bịa nên tôi không vẽ, dù 'hôm nay' theo giờ máy chủ rất cần một chỉ dấu cho học viên. Nếu có resetAt thì phải vẽ.
- Không biết có muốn một con số tổng hợp kiểu '3/5 việc đã xong' không. Nó suy được từ danh sách nên không vi phạm B5, nhưng vẫn là thêm nội dung — tôi bỏ, để sự có mặt/vắng mặt của nút nhận tự nói 'đã xong hết'.
- B2 nói tick/icon chỉ khi là state thật. Tôi cho một hàng đã xong được đeo tick vì hoàn tất từng việc chính là thứ chặn quyền nhận. Cách đọc an toàn hơn là chỉ dùng chữ. Đây là phán đoán, không phải suy ra từ gate.
- Ngày trống: gate không nói empty có nên hiện số xu hay một câu 'mai quay lại'. Tôi chọn đúng một phát biểu, không xu, không control.
- Nếu claimed = true nhưng tiến độ lại chưa đủ (lệch dữ liệu, reset lỗi), gate không nói bên nào thắng. Tôi cho claimed thắng vì nghiệp vụ nói hai sự thật không suy ra nhau, nên phải đọc trực tiếp cái nào nói về việc nhận.
- Gate không nói lỗi của hành động nhận nằm ở đâu: nâng cả khối lên failed, hay lỗi cục bộ cạnh control. B11 chỉ nói pending owner riêng. Tôi chọn lỗi cục bộ cạnh control.
- Ngày lật giữa lúc tab đang mở: gate không có state này. Tôi tự thêm 'ngay-da-lat' + đọc lại.
- Vị trí và chiều rộng của khối trên trang: L10 nói chiều rộng thuộc layout owner của vùng, nên tôi CỐ TÌNH không quyết. Nhưng gate cũng không nói ai là layout owner đó ở trang này.
- Không rõ nút nhận nằm trong khối hay là CTA cấp trang. standing-offer nói control thuộc khối nên tôi để trong khối.
- Danh sách dài thì có cuộn trong khối không? B3 nói khối sở hữu scroll của mình nhưng gate không cho ngưỡng chiều cao. Tôi chọn không cuộn, vẽ hết, vì tập việc một ngày là nhỏ.
- Định dạng số xu, đơn vị, số nhiều của 'đã làm / cần làm', locale — không có gì nói.
- Trạng thái failed có nên có nút thử lại không: nút thử lại là cơ chế chứ không phải nghiệp vụ, mà standing-offer chỉ nói về control nghiệp vụ mọc/rụng. Tôi vẫn cho một retry và ghi nhận đây là chỗ đoán.
- B6 nói hai chỗ giống nhau phải dùng chung owner thật. Tôi không có bằng chứng nào cho thấy khối này xuất hiện ở chỗ thứ hai nên không đòi chia sẻ owner.
- Trạng thái chưa đăng nhập / hết phiên: yêu cầu nói học viên đã đăng nhập, câu hỏi 6 của gate không nhắc auth. Tôi giả định tầng trên trang xử lý, khối không có state đó.
