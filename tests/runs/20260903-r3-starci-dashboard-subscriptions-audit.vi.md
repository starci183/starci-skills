# R3 — Kiểm định UX/UI bằng ảnh chụp: dashboard và subscriptions

- Ngày: 2026-09-03
- Vai: `frontend.surface.audit` — chỉ đọc mã nguồn, không sửa một tệp nào trong repo đích và không chạy lệnh ghi của git
- Worktree: `D:\Repositories\starci-academy-backend\.worktrees\sessions\20260903-starci-dashboard-subscriptions\checkout`
- Repo / nhánh / head: `starci-academy-fe` / `session/20260903-starci-dashboard-subscriptions` / `a01f0e8`
- Môi trường chạy: Next.js 16.3.1 dev ở cổng 3000 (bật riêng cho lần chạy này, đã tắt khi xong); API backend ở 3001; Postgres ở 5432; **Keycloak 8089 đang chết — không thử đăng nhập và không gõ bất kỳ thông tin xác thực nào**
- Công cụ chụp: Chrome headless điều khiển qua `puppeteer-core`, vì công cụ chụp của Browser pane không ghi được ra tệp; chụp toàn trang, mỗi lần giả lập một giá trị `prefers-color-scheme`
- Bằng chứng: `.claude/tests/evidence/20260903-starci-dashboard-subscriptions/`

## Những gì nhìn thấy được và những gì không

`/vi/subscriptions` hiển thị đầy đủ cho người chưa đăng nhập, mang trọn `ProSubscriptionBlock` cùng `ShellNav`, nên chính bề mặt này gánh toàn bộ phần kiểm định. Ngược lại, cả `/vi` lẫn `/vi/dashboard` đều chuyển hướng sang `/vi/authentication?authState=sign-in`; tôi đã dựng lại điều đó trong các phiên incognito sạch ở cả hai bề ngang và cả hai bảng màu, nên đây là hành vi thật của bề mặt khi chưa đăng nhập chứ không phải cookie sót lại từ lần chụp trước. Keycloak đang chết nên không có đường nào đi qua khỏi lần chuyển hướng ấy. Vì vậy tám tệp `home-*` và `dashboard-*` thực chất chụp biểu mẫu đăng nhập chứ không phải bề mặt được yêu cầu, và cả hai bề mặt được ghi nhận là `RUNTIME_UNAVAILABLE`. Riêng ô tìm kiếm của `ShellNav` mà đề bài muốn xem trên `/vi`, tôi kiểm trên `/vi/subscriptions` vì nơi đó gắn đúng cùng một lớp vỏ.

Còn một trạng thái nữa không với tới được vì cùng lý do: dải trạng thái của gói (`proStatusClassName`, `rounded-xl`) chỉ hiện ở `verification-pending`, `active` và `cancelled`, đều đòi một lần đọc đã đăng nhập. Bán kính góc của nó được ghi là chưa quan sát được, chứ không đoán.

## Bảng phán quyết

| bề mặt | bề ngang | bảng màu | phát hiện | mức độ | luật | ảnh |
| --- | --- | --- | --- | --- | --- | --- |
| subscriptions | 1280 | sáng | Dải điều hướng dính và đường phân cách đều đúng: `header.starci-core-navigation-feature-nav` là `position: sticky; top: 0`, cao 79px, có viền dưới | đạt | LAYOUT-4 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | Ô tìm kiếm đọc ra đúng một trường nhập: viền 1px, bo 12px, kính lúp dẫn đầu, chữ mờ gợi ý, phím tắt `Ctrl K` | đạt | HIERARCHY-1 Case 2 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | `PressableField` lấy bề ngang từ cha (`width: 100%; min-width: 0`, co lại còn 179px trong hàng công cụ 280px đã kín chỗ) — không có bề ngang cố định | đạt | RESPONSIVE-1 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | Nút mua chiếm trọn rãnh của nó (304px trên cột 304px), cao 44px, bo 24px, nhãn nằm gọn một dòng | đạt | CTA-1 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | Khoảng cách trong khối chi tiết gói đều 16px giữa tên gói, giá và ghi chú gia hạn; dải hành động tách bằng `border-t` tràn viền và lề trong 12px | đạt | GAP | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | Không tràn: `scrollWidth == clientWidth == 1280`, không phần tử nào vượt mép ngang | đạt | OVERFLOW | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | **DEF-3** Hai vùng ngang hàng trong cùng một cột lệch nhau 16px. Hộp ngoài của cả hai đều là `x=32 w=808`, nhưng `SurfaceCard` phần quyền lợi mang `padding: 16px` nên bề mặt thấy được và nhãn của nó nằm ở `x=48`, còn `SurfaceAccordionCard` bên dưới có `padding: 0` và nằm ở `x=32` | nặng | MARGIN / HIERARCHY-2 Case 4 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | **DEF-4** Dàn tiêu đề nhảy cấp và kết thúc sai thứ tự: `H1 → H3 → H3 → H3 → H3 → H2`. `H2` duy nhất là tên gói ở rail, đứng cuối trong DOM; bốn nhãn thẻ đều là `H3` mà không có `H2` nào ở trên | nặng | HIERARCHY-1 Case 1 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | **DEF-5** Mọi điều khiển trên hàng điều hướng đều cao 36px — ô tìm kiếm, ba tab, menu ngôn ngữ (22×36), giỏ hàng và tài khoản (36×36) | nặng | sàn vùng chạm 44px | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | **DEF-6** Điểm ngắt theo khung nhìn đang chi phối vùng vốn thuộc container query: `sm:grid-cols-2` ở lưới quyền lợi và `sm:px-6 / sm:pt-6 / sm:pb-6` ở thẻ gói | nhẹ | RESPONSIVE-2 Case 5 | `subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | Bán kính góc của dải trạng thái không quan sát được — dải chỉ hiện ở các trạng thái vòng đời đã đăng nhập | RUNTIME_UNAVAILABLE | RADIUS-5 | — |
| subscriptions | 1280 | tối | Token tối đổi sạch sẽ: nền, bề mặt, đường phân cách, chữ, chữ mờ và màu nhấn đều về đúng giá trị tối; không còn bề mặt trắng chưa gắn token | đạt | TONE | `subscriptions-1280-dark.png` |
| subscriptions | 1280 | tối | DEF-3, DEF-4, DEF-5 và DEF-6 lặp lại y hệt; riêng độ lệch 16px lộ rõ hơn trên nền tối | nặng | như trên | `subscriptions-1280-dark.png` |
| subscriptions | 1280 | tối | **DEF-7** Hình minh hoạ hành trình chỉ có một bản PNG nền sáng, nên hiện thành một khối trắng lớn giữa bề mặt tối | nhẹ | TONE | `subscriptions-1280-dark.png` |
| subscriptions | 390 | sáng | **DEF-1** Bố cục rail không bao giờ xếp chồng. `starci-core-primary-rail-layout` tính ra `grid-template-columns: 0px 334px` trong một container 358px: rãnh chính rộng **0px**, thẻ quyền lợi và lưới 2×2 biến mất, nhãn của các vùng xuống dòng mỗi chữ một hàng trong một cột 32px, thẻ rail đè lên chúng, và khoảng 1500px trong tổng 2071px chiều cao trang là khoảng trống | **chặn** | RESPONSIVE-1 Case 1–2, RESPONSIVE-3 Case 3, LAYOUT-3 Case 1 | `subscriptions-390-light.png` |
| subscriptions | 390 | sáng | **DEF-2** Thứ tự rail khi xếp chồng chưa được quyết: khối không truyền `collapsedOrder`, nên sau khi sửa DEF-1 thì quyết định mua sẽ rơi xuống sau toàn bộ cột diễn giải. Trên một bề mặt chỉ có một quyết định, rail phải đi trước | nặng | RESPONSIVE-1 Case 1 | `subscriptions-390-light.png` |
| subscriptions | 390 | sáng | **DEF-5** Các nút biểu tượng ở dạng gọn (tràn, giỏ hàng, tài khoản) chỉ 40×40 | nặng | sàn vùng chạm 44px | `subscriptions-390-light.png` |
| subscriptions | 390 | sáng | Nút mua vẫn chiếm trọn bề ngang (270px trên 270px), cao 44px, nhãn một dòng; không tràn ngang (`scrollWidth == clientWidth == 390`) | đạt | CTA-1, OVERFLOW | `subscriptions-390-light.png` |
| subscriptions | 390 | tối | DEF-1, DEF-2 và DEF-5 lặp lại y hệt; nguyên nhân không phụ thuộc bảng màu | **chặn** | như trên | `subscriptions-390-dark.png` |
| dashboard | 1280 | sáng | Chuyển hướng sang `/vi/authentication?authState=sign-in`; Keycloak chết, không thử đăng nhập | RUNTIME_UNAVAILABLE | — | `dashboard-1280-light.png` (biểu mẫu đăng nhập) |
| dashboard | 1280 | tối | Cùng lần chuyển hướng ấy | RUNTIME_UNAVAILABLE | — | `dashboard-1280-dark.png` (biểu mẫu đăng nhập) |
| dashboard | 390 | sáng | Cùng lần chuyển hướng ấy | RUNTIME_UNAVAILABLE | — | `dashboard-390-light.png` (biểu mẫu đăng nhập) |
| dashboard | 390 | tối | Cùng lần chuyển hướng ấy | RUNTIME_UNAVAILABLE | — | `dashboard-390-dark.png` (biểu mẫu đăng nhập) |
| home | 1280 | sáng | Chuyển hướng sang `/vi/authentication?authState=sign-in`; `ShellNav` không gắn, nên ô tìm kiếm được kiểm trên `/vi/subscriptions` | RUNTIME_UNAVAILABLE | — | `home-1280-light.png` (biểu mẫu đăng nhập) |
| home | 1280 | tối | Cùng lần chuyển hướng ấy | RUNTIME_UNAVAILABLE | — | `home-1280-dark.png` (biểu mẫu đăng nhập) |
| home | 390 | sáng | Cùng lần chuyển hướng ấy | RUNTIME_UNAVAILABLE | — | `home-390-light.png` (biểu mẫu đăng nhập) |
| home | 390 | tối | Cùng lần chuyển hướng ấy | RUNTIME_UNAVAILABLE | — | `home-390-dark.png` (biểu mẫu đăng nhập) |

## Phán quyết chung — SỬA TRƯỚC ĐÃ

Nhánh rộng của `/vi/subscriptions` gần như đã đi được: thứ bậc đọc đúng, dải điều hướng dính cùng đường phân cách giữ vững, ô tìm kiếm không thể nhầm với thứ gì khác ngoài một trường nhập, nút mua chiếm trọn bề ngang với vùng chạm 44px và một nhãn không xuống dòng bừa, còn chế độ tối đổi đủ mọi token cần đổi. Nhánh gọn thì không đi được chút nào. Ở 390px, cột chính rộng đúng không pixel, nên toàn bộ phần giải thích sản phẩm — hình minh hoạ, bốn quyền lợi, cả hai mục hỏi đáp — biến mất trước mắt người đọc trên điện thoại, thứ còn lại chỉ là một thẻ rail trôi đè lên bốn con chữ xếp dọc của một tiêu đề. Một lỗi ấy thôi đã đủ chặn bề mặt này trên chính thiết bị mà nó hay được mở nhất.

## Danh sách lỗi

### DEF-1 — chặn — `PrimaryRailLayout` không bao giờ xếp chồng

`packages/grammar/src/common/styles.css:186-187` đối lại `packages/grammar/src/common/styles.css:1169-1173`.

Luật xếp chồng được viết bằng một selector lớp trần bên trong container query, còn bề ngang rail lại viết bằng selector thuộc tính nằm ngoài. Container query không cộng thêm độ đặc hiệu nào, nên `(0,2,0)` thắng `(0,1,0)` và dạng hai cột sống sót ở mọi bề ngang container. `ProSubscriptionBlock` xin đúng `railWidth="wide"` tại `src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:204`, tức đúng giá trị kích hoạt luật ấy; con số `0px 334px` quan sát được chính là `358 − 24 khoảng cách − 334 rail`. Bất kỳ nơi nào truyền `railWidth="compact"` cũng hỏng y như vậy, nên đây là lỗi của Grammar chứ không phải của ứng dụng. Chỗ sửa nằm trong Grammar: hoặc viết lại luật xếp chồng cho từng giá trị `[data-grammar-layout-rail-width]` ngay bên trong container query, hoặc đưa rãnh rail vào một custom property để luật gốc đọc và container query đặt về `0`.

### DEF-2 — nặng — chưa quyết thứ tự rail khi xếp chồng

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:203-262` chỉ truyền `railWidth`, không hề truyền `collapsedOrder`. Grammar có sẵn `data-grammar-layout-collapsed-order="rail-first"` tại `packages/grammar/src/common/styles.css:1175-1177`, và trên một bề mặt mà việc duy nhất là mua thì giá cùng cái nút chính là thứ người đọc tìm đến. Sau khi sửa DEF-1, thứ tự mặc định lấy cột chính trước sẽ chôn nút mua xuống dưới hình minh hoạ, bốn quyền lợi và cả hai mục hỏi đáp.

### DEF-3 — nặng — lệch 16px giữa hai vùng ngang hàng

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:207` (`SurfaceCard`, `padding: 16px`, `card--transparent`) đối lại `:237` (`SurfaceAccordionCard`, `padding: 0`). Cả hai nằm trong cùng cột `proMainClassName` (`classNames.ts:15`) và hộp ngoài của cả hai đều đo được `x=32 w=808`, nhưng chỉ một bên thụt bề mặt thấy được cùng nhãn của nó vào trong. Hoặc cho accordion cùng khoảng thụt ấy, hoặc bỏ nó khỏi thẻ quyền lợi.

### DEF-4 — nặng — dàn tiêu đề nhảy cấp

`component.tsx:196-201` phát ra `H1` của trang; các prop `label` của `SurfaceCard` và `SurfaceAccordionCard` tại `:207` và `:239` cùng hai nhãn hỏi đáp phát ra `H3`; `Heading level={2}` của rail tại `:162` là `H2` duy nhất và lại đứng cuối DOM. Dàn ý mà mắt người đọc thấy và dàn ý mà trình đọc màn hình đi qua đều nhảy thẳng từ `H1` sang `H3`.

### DEF-5 — nặng — vùng chạm dưới 44px

`packages/grammar/src/common/styles.css:263-267` đặt `height: 2.25rem` cho `PressableField`; các tab điều hướng, menu ngôn ngữ, giỏ hàng và tài khoản cũng theo đúng con số ấy, 36px ở bản rộng và 40px ở bản gọn. Không một thứ gì trên hàng điều hướng chạm tới 44px ở cả hai bề ngang.

### DEF-6 — nhẹ — điểm ngắt theo khung nhìn nằm trong vùng do container quản

`src/components/blocks/commerce/ProSubscriptionBlock/classNames.ts:38` (`sm:grid-cols-2`) cùng `:77-80` và `:100-101` (`sm:px-6`, `sm:pt-6`, `sm:pb-6`). Đây là các truy vấn theo khung nhìn của Tailwind áp lên phần nội dung mà bề ngang khả dụng do container query của `PrimaryRailLayout` định đoạt, nên một cửa sổ rộng với cột chính hẹp sẽ giải chúng ra sai.

### DEF-7 — nhẹ — hình minh hoạ chỉ có một bảng màu

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:213-221` phục vụ chung một tệp PNG nền sáng cho cả hai bảng màu.

## Ghi chú ngoài phạm vi kiểm định

Bề mặt xác thực trải thẻ của nó trọn 1216px của container trong khi biểu mẫu chỉ chiếm chừng 450px ở giữa, để lại hai dải lề chết rất rộng ở 1280 trong cả hai bảng màu. Ngoài ra, `src/app/[lang]/` đang chứa cả thư mục `subscriptions` lẫn thư mục `subcribtions`; cái viết sai chính tả trông như đồ sót lại, nên xác nhận sớm trước khi có liên kết trỏ vào.

## Cách dựng lại

Máy chủ dev được bật bằng `npm run dev` từ worktree và tiến trình đã bị tắt khi xong, cổng 3000 nay đã trống. Ảnh được chụp bằng một script Chrome headless chạy trên `puppeteer-core`, mỗi bề ngang và mỗi bảng màu một trang riêng, `prefers-color-scheme` giả lập qua CDP, `fullPage: true`, và các số đo `grid-template-columns`, hình chữ nhật bao, danh sách tiêu đề, vị trí dính, tập phần tử tràn cùng kích thước điều khiển đều được đọc ngược ra từ chính trang ấy.

## Vòng 2

- Ngày: 2026-09-03
- Vai: `frontend.surface.audit`, chạy lại trên chính worktree ấy sau khi `@starci/grammar` 0.4.6 được nhập về từ `main`
- Kho / nhánh / đầu nhánh: `starci-academy-fe` / `session/20260903-starci-dashboard-subscriptions` / `be53d58` (commit hợp nhất `cc3f893`, `main` ở `c449152`)
- Cổng kiểm trước khi chụp: `npx eslint --max-warnings=0 .` thoát 0, `npx vitest run` thoát 0 (498 tệp, 3015 đạt, 35 bỏ qua), `npx tsc --noEmit` thoát 0, `sweep-presentation.mjs` sạch trên 40 tệp
- Môi trường: Next.js 16.3.1 dev ở cổng 3000, bật riêng cho lượt này và tắt khi xong; **Keycloak 8089 vẫn nằm — không thử đăng nhập, không gõ một thông tin xác thực nào**
- Bộ chụp: Chrome không giao diện qua `puppeteer-core`, mỗi ảnh một ngữ cảnh trình duyệt mới, `prefers-color-scheme` giả lập qua CDP, `fullPage: true`
- Chứng cứ: `r2-subscriptions-{1280,390}-{light,dark}.png`, `r2-authentication-390-light.png`, cùng ba tệp số đo `r2-measurements.json`, `r2-taste-probe.json`, `r2-taste-1280-light.json`, tất cả nằm trong `.claude/tests/evidence/20260903-starci-dashboard-subscriptions/`

### Giữa hai vòng đã đổi những gì

Ba trong bảy lỗi vốn là của Grammar và được vá ngay trong gói chứ không phải trong ứng dụng: `PrimaryRailLayout` giờ lấy dạng xếp chồng làm mặc định và đẩy mọi biến thể rộng vào trong một container query `min-width`, nên không bộ chọn thuộc tính nào còn vượt mặt được luật xếp chồng nữa (DEF-1); hai khe hành động của `NavigationFeatureNav` cấp cho điều khiển của mình `min-inline-size` và `min-block-size` 44px (DEF-5, một phần); và `.starci-core-surface-card` được đưa về `padding: 0 !important`, gỡ bỏ lề trong mà `Card.Root` của HeroUI áp lên, thứ đã đẩy bề mặt quyền lợi thụt vào 16px so với người anh em accordion (DEF-3). Phía ứng dụng thì truyền `collapsedOrder="rail-first"` (DEF-2), neo lại các tiêu đề vùng để dàn tiêu đề thôi nhảy cấp (DEF-4), chuyển lưới quyền lợi và thẻ gói sang container query `@app-sm:` (DEF-6), và ngừng đưa ảnh hành trình nền sáng cho người đọc chế độ tối (DEF-7). Ghi chú `// GRAMMAR-GAP:` từng ghi nhận DEF-3 đã được gỡ trong vòng này, bởi 0.4.6 đóng nó ngay tại gốc và trong ứng dụng chẳng có chỗ nào đệm quanh nó cả.

### Bảng phán quyết

| bề mặt | bề ngang | bảng màu | phát hiện | mức độ | luật | ảnh |
| --- | --- | --- | --- | --- | --- | --- |
| subscriptions | 390 | sáng | **DEF-1 đã sửa.** `starci-core-primary-rail-layout` tính ra `grid-template-columns: 358px` trong khung 358px. Vùng chính là `x=16 w=358 h=806.38` và mang đủ hình minh hoạ, cả bốn quyền lợi lẫn hai mục hỏi đáp | đã đóng | RESPONSIVE-1 Case 1–2 | `r2-subscriptions-390-light.png` |
| subscriptions | 390 | sáng | **DEF-2 đã sửa.** `data-grammar-layout-collapsed-order="rail-first"`; vùng rail tính ra `order: -1` và nằm ở `y=278`, vùng chính ở `y=563`. Giá và nút mua dẫn đầu dòng chảy khi xếp chồng | đã đóng | RESPONSIVE-1 Case 1 | `r2-subscriptions-390-light.png` |
| subscriptions | 1280 | sáng | **DEF-3 đã sửa.** `.starci-core-surface-card` tính ra `padding: 0px`; thẻ quyền lợi và người anh em accordion đều đo được `x=32 w=808`, hai bề mặt bên trong cũng cùng bắt đầu ở `x=32`. Độ lệch 16px biến mất ở cả hai mép | đã đóng | MARGIN / HIERARCHY-2 Case 4 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | **DEF-4 đã sửa.** Dàn tiêu đề đọc ra `H1 → H2 → H2 → H3 → H3 → H2`. Không cấp nào bị nhảy; hai `H3` hỏi đáp nằm dưới đúng `H2` sở hữu chúng, còn `H2` của rail là một vùng ngang hàng chứ không phải hậu duệ | đã đóng | HIERARCHY-1 Case 1 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 | sáng | **DEF-5 sửa được một phần.** Ô tìm kiếm là `164.3 × 44` (`min-height: 44px`, `min-width: 44px`), menu ngôn ngữ, giỏ hàng và tài khoản mỗi cái `44 × 44`. **Còn dưới sàn:** ba đích đến chính `Trang chủ` / `Khóa học` / `Liên hệ` đo được `91.31 × 36`, `88.81 × 36` và `72.89 × 36`, còn công tắc đổi màu là `64 × 36` | nặng | sàn vùng chạm 44px | `r2-subscriptions-1280-light.png` |
| subscriptions | 390 | sáng | **DEF-5 đã sửa ở bề ngang này.** Dải gọn gom các đích đến vào một nút mở ngăn kéo; mọi thứ bấm được trong dải — ngăn kéo, giỏ hàng, tài khoản — đều `44 × 44`. Không điều khiển nào của dải còn dưới sàn | đã đóng | sàn vùng chạm 44px | `r2-subscriptions-390-light.png` |
| subscriptions | 1280 | sáng | **DEF-6 đã sửa.** `classNames.ts:52,64,65` giờ là container query `@app-sm:`. `sm:` duy nhất còn sống là `proPageClassName` (`classNames.ts:13`), dải ngoài của chính tuyến đường, nằm trên `PageContainer` và ngoài mọi container, điều mà tệp ấy đã ghi rõ ở `:6-9` | đã đóng | RESPONSIVE-2 Case 5 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 | tối | **DEF-7 đã sửa đúng như đã ghi.** Không còn mảng trắng nào hiện ra; người đọc chế độ tối nhận thẻ quyền lợi mà không có hình minh hoạ. Cái giá của cách vá ấy thì nhìn thấy được: trang tối cao 800px so với 1104px của trang sáng, và bề mặt đọc ra trống trải hẳn | nhẹ (còn mở dạng `MISSING-ASSET`) | TONE | `r2-subscriptions-1280-dark.png` |
| subscriptions | 1280 | sáng | Dải dính vẫn giữ: `header.starci-core-navigation-feature-nav` là `position: sticky; top: 0`, cao 79px | đạt | LAYOUT-4 Case 1 | `r2-subscriptions-1280-light.png` |
| subscriptions | 1280 / 390 | sáng + tối | Không tràn ngang ở bất kỳ bề ngang hay bảng màu nào: `scrollWidth == clientWidth` (1280 và 390), và lượt quét phần tử vượt mép trả về tập rỗng | đạt | OVERFLOW | cả bốn ảnh |
| subscriptions | 1280 | tối | Token tối vẫn đổi sạch sẽ; DEF-1, DEF-3 và DEF-4 tái hiện đúng trạng thái đã sửa, phần còn lại của DEF-5 cũng tái hiện y hệt. Nguyên nhân không phụ thuộc bảng màu, theo cả hai chiều | như trên | như trên | `r2-subscriptions-1280-dark.png` |
| authentication | 390 | sáng | **Tuyến này không có dải điều hướng lẫn `PressableField`.** `/vi/authentication` không gắn `ShellNav`: `header` duy nhất là khối tiêu đề 326×56 của chính thẻ đăng nhập, và trong cây không có `.starci-core-pressable-field` nào. Vùng chạm 44px của dải cùng trường nhập vì thế được kiểm trên `/vi/subscriptions` ở 390 và 1280 — nơi gắn đúng cái shell ấy | SURFACE_NOT_PRESENT | — | `r2-authentication-390-light.png` |
| authentication | 390 | sáng | Ghi nhận bên lề, ngoài phạm vi soát: điều khiển của chính biểu mẫu đăng nhập nằm ở 40px (`Đăng nhập với Google`, `Đăng nhập với GitHub`, hai ô nhập và nút gửi đều `326 × 40`), nút hiện mật khẩu `16 × 16`, ô ghi nhớ `13 × 13`, hai nút chữ `112 × 20` và `56.81 × 20` | nặng, ngoài phạm vi | sàn vùng chạm 44px | `r2-authentication-390-light.png` |
| subscriptions | — | — | Bo góc của dải trạng thái vẫn không quan sát được — nó chỉ hiện ở `verification-pending`, `active` và `cancelled`, cả ba đều cần một lượt đọc đã đăng nhập | RUNTIME_UNAVAILABLE | RADIUS-5 | — |

### Thấu kính thẩm mỹ — `/vi/subscriptions`, 1280 × 800, sáng

Chấm theo `knowledge/ui/proof/taste.md`, đọc từ `r2-subscriptions-1280-light.png` và các số đo trong `r2-taste-1280-light.json`.

| tiêu chí | điểm | đạt | số đo |
| --- | --- | --- | --- |
| `TASTE-1` Một điểm nhìn | 2 | **trượt** (Case 3) | Hình minh hoạ hành trình là `808 × 454.63 = 367.337px²`, so với `H1` `768 × 30.7 = 23.580px²` và nút mua `352 × 44 = 15.488px²`. Tranh vẽ nặng hơn `H1` 15 lần và nặng hơn nút mua 24 lần. Case 1 giữ được (chỉ có một ứng viên) và Case 2 giữ được (`H1` `25.6px/700` so với tiêu đề vùng `16px/600`), nhưng Case 3 trượt: việc của bề mặt này là một quyết định mua — chính vì thế mà hướng thiết kế mới truyền `collapsedOrder="rail-first"` — vậy mà thứ thắng khung hình lại là một bức tranh trang trí |
| `TASTE-2` Không có khoảng trống vô nghĩa | 3 | **trượt** (Case 1) | Cột rail phía dưới thẻ gói là `384 × 616.3 = 236.659px²`, chiếm 16,7% khung ảnh `1280 × 1104`. Nó không mang nội dung và cũng chẳng ngăn cách gì — cột chính cứ thế chạy dài qua bên cạnh. Case 2 giữ được (dải nền phụ có tô màu mang một câu thật), Case 3 giữ được (lưới 2×2 quyền lợi lấp kín), Case 4 giữ được (ở 390 khoảng trống không phình ra; cột đơn không để lại vùng chết nào) |
| `TASTE-3` Lưới và mép | 5 | đạt | Hai thẻ ngang hàng đều đo `x=32 w=808`, tiêu đề vùng cũng bắt đầu ở `x=32`; rail ở `x=864 w=384`. Bên trong thẻ quyền lợi, câu dẫn ở `x=48` còn các ô quyền lợi ở `x=80` và `x=484` — mỗi con số là một lề trong đã khai báo, nhất quán theo từng vùng và từng cột. Đây chính là chỗ bản vá DEF-3 đọc ra đúng |
| `TASTE-4` Nhịp dọc đơn điệu | 5 | đạt | Khoảng cách giữa vùng 24px (`908.33 → 932.33`), giữa mục 12px (đáy tiêu đề `250.7` → đỉnh thẻ `262.7`), giữa hàng 0px với một đường phân cách giữa hai hàng hỏi đáp cao 52px. Thứ tự giữ nguyên, tập bước là tập đóng (0 / 12 / 24 / 36), hai anh em ngang hàng cách đều nhau, và ở 390 thứ tự ấy vẫn sống |
| `TASTE-5` Tiết kiệm màu | 5 | đạt | Đúng một điều khiển tô màu nhấn: `rgb(117, 71, 255)` trên `Đăng nhập để mua StarCi Pro`. Mọi điều khiển tô màu khác trong khung đều trung tính (`lab(93.02 …)` và `lab(99.99 …)`). Chip `Full access` là một mảng nhấn nhạt duy nhất, báo đúng hạng gói. Các nền phân biệt được: bốn sắc xám trung tính, trắng, một màu nhấn và một màu nhấn pha loãng. Case 3 không quan sát được — trong ảnh này không hiện trạng thái cảnh báo hay lỗi nào |
| `TASTE-6` Chữ | 3 | **trượt** (Case 1, 2) | Case 1 trượt ở vùng rail, nơi mang bốn cỡ chữ và ba độ đậm khác nhau: `36px/600`, `16px/600`, `14px/500`, `14px/400`, `12px/500`, `12px/400`. Thẻ quyền lợi (`14px/400`, `14px/600`, `12px/400`) và khối hỏi đáp (`14px/600`, `14px/400`) thì đều nằm trong hạn mức. Case 2 trượt ở câu mô tả dưới tiêu đề: `max-w-3xl` cho nó 768px ở cỡ 14px, tức khoảng 105 ký tự một dòng, vượt trần 80. Case 3 và Case 4 giữ được — không dòng cuối nào rơi lại một chữ mồ côi, bốn tiêu đề quyền lợi đều `14px/600` trên bốn câu mô tả đều `12px/400` |
| `TASTE-7` Hình khối nhất quán | 4 | đạt | Bo góc quy về một họ bước cộng một vai trò dành cho điều khiển: 24px ở gốc hai thẻ và nút mua, 16px ở hai bề mặt bên trong, 12px ở ô tìm kiếm, viên thuốc ở các nút chữ điều hướng và nút biểu tượng. Lồng nhau sâu nhất hai cấp (`surface-card` 24 → `surface` 16 → hàng), hai thẻ ngang hàng mang cùng độ nổi (cả hai đều `card--transparent`), và nút mua thụt vào 16px trong khung 24px của nó nên hai góc không đụng nhau. Chỗ mất một điểm: gốc khối hỏi đáp tính ra `0px` trong khi gốc hai thẻ kia là `24px`, nên phần hỏi đáp đọc ra như một danh sách phẳng đứng cạnh một người anh em có thẻ |
| `TASTE-8` Hình ảnh phải đáng chỗ nó chiếm | 2 | **trượt** (Case 1, 4) | Case 4 trượt trên đúng số đo của `TASTE-1`: ở `367.337px²`, hình minh hoạ là thứ nặng nhất khung hình trong khi việc của bề mặt này không phải là bức ảnh. Case 1 trượt nhờ chính chứng cứ của ảnh chế độ tối — bỏ hình minh hoạ đi đúng là điều bản vá DEF-7 làm, vậy mà `r2-subscriptions-1280-dark.png` vẫn đọc ra một bề mặt trọn vẹn, tức là đúng điều kiện phản chứng mà luật này nêu. Case 2 và Case 3 giữ được: chỉ một ảnh trang trí, và nó chia thẻ với dải dẫn cùng lưới quyền lợi chứ không phải lý do tồn tại của một dải rỗng |
| `TASTE-9` Mật độ hợp với hạng bề mặt | 3 | đạt, có dè dặt | Đây là bề mặt mua bán nên Case 2 chi phối. Các hình chữ nhật đếm cho Case 3: dải điều hướng `1280 × 79 = 101.120`, tiêu đề trang `768 × 59.7 = 45.852`, vùng chính `808 × 845.63 = 683.265`, vùng rail `384 × 261 = 100.224`, cộng lại `930.461` trên `1.413.120` — 65,8%. Chỗ dè dặt nằm ở vế sau của Case 2: khoảng thở không liên tục, bởi 16,7% của nó là đúng cái cột rail chết đã đo ở `TASTE-2`. Case 4 giữ được ở 390 — mật độ đến từ thứ tự và cách gom nhóm, không vùng chạm nào co xuống dưới 44px |
| `TASTE-10` Các trạng thái được thiết kế | — | **vô hiệu** | Bề mặt này không có ảnh trạng thái đang tải, rỗng hay lỗi nào. Trạng thái duy nhất mang được chúng — dải trạng thái gói — chỉ hiện ở `verification-pending`, `active` và `cancelled`, mà Keycloak đang nằm nên không thể đọc ở tư cách đã đăng nhập. Theo `TASTE-13` Case 5, một điểm không có số đo là điểm vô hiệu, nên không ghi điểm nào và thấu kính coi như chưa đầy đủ |
| `TASTE-11` Chạm và phản hồi | 2 | **trượt** (Case 1) | Case 1 trượt ở 1280: ba đích đến chính `91.31 × 36`, `88.81 × 36`, `72.89 × 36`, cộng công tắc đổi màu `64 × 36`. Ở 390 thì đạt, mọi điều khiển của dải đều `44 × 44`. Case 2 đến Case 4 không quan sát được: không chụp trạng thái di chuột, tiêu điểm hay đang xử lý |
| `TASTE-12` Khớp với chuẩn tham chiếu | 2 | **trượt** (Case 1) | Không có quyết định hướng thiết kế nào cho bề mặt này nêu tên chuẩn tham chiếu theo hạng. `tests/runs/20260903-frontend-refine-subscriptions.md` cùng bản R2 của nó là hồ sơ presentation-resolve chứ không phải hồ sơ hướng thiết kế, và cả hai đều không nêu một chuẩn nào. Chính chữ của Case 1 — "một hướng thiết kế không nêu chuẩn nào thì đã làm hỏng lượt soát trước cả khi chấm bất kỳ ảnh nào" — khiến đây là một lượt trượt chứ không phải một ô không quan sát được |

### Phán quyết thẩm mỹ — SỬA TRƯỚC ĐÃ

`TASTE-13` Case 2 đòi không được trượt `TASTE-1`, `TASTE-2`, `TASTE-5`, `TASTE-8` hay `TASTE-12`, và điểm trung bình phải từ 4 trở lên. Ba trong năm cửa ấy trượt (`TASTE-1`, `TASTE-2`, `TASTE-8`), `TASTE-12` cũng trượt nốt, nên chỉ riêng các cửa đã đủ ra phán quyết `sửa trước đã`. Trung bình trên mười một tiêu chí chấm được là `3,27` (`2+3+5+5+5+3+4+2+3+2+2 = 36`, chia 11), cũng dưới ngưỡng, còn `TASTE-10` thì vô hiệu theo Case 5, khiến thấu kính chưa đầy đủ bất kể phép tính ra sao.

Ba lượt trượt ở cửa thật ra là một vấn đề bố cục nhìn từ ba phía, và `TASTE-13` Case 4 đẩy nó về hướng thiết kế chứ không về resolve: một hình minh hoạ cao 455px đang là thứ ồn ào nhất trên một trang có việc là một quyết định 229.000 ₫, thẻ gói mang chính quyết định ấy chiếm 261px trong một cột rail cao 1.104px và bỏ lại 616px chết, còn ảnh chế độ tối thì đã chứng minh sẵn rằng trang vẫn sống mà không cần bức tranh. Không phép đổi giá trị nào chữa được chuyện đó; thứ bậc giữa các vùng phải được quyết lại.

### Phán quyết chung — SỬA TRƯỚC ĐÃ

Mọi lỗi canon mà vòng trước có thể ra tay đều đã đóng. DEF-1, lỗi chặn, biến mất ở cả hai bảng màu: ở 390 cột chính rộng trọn 358px và toàn bộ phần giải thích sản phẩm hiện ra trên điện thoại, với quyết định mua dẫn đầu đúng chỗ. DEF-2, DEF-3, DEF-4 và DEF-6 đều đã đóng và đo được. DEF-5 đóng ở đúng nơi quan trọng nhất — cả dải gọn đạt sàn 44px — và đóng luôn ở hai khe hành động trên desktop. Phần còn sót lại là các đích đến chính trên desktop cùng công tắc đổi màu, thứ mà Grammar 0.4.6 cố ý để ngoài phạm vi. `TASTE-13` Case 3 mới là lý do bề mặt này vẫn `sửa trước đã` chứ chưa `đi được`: canon xanh không mua được một phán quyết thẩm mỹ, và bố cục đang trượt ba trong năm tiêu chí mà người đọc nhận ra trước cả khi đọc một chữ.

### Lỗi còn lại

#### DEF-5 (phần sót) — nặng — điều khiển dải desktop dưới sàn 44px

`packages/grammar/src/common/styles.css:2363` (`.starci-core-text-action`, không đặt `min-block-size` nào) đối lại hai khe hành động đã vá ở `:1163-1164` và `:1333-1334`. Ba đích đến chính hiện ra `91.31 × 36`, `88.81 × 36` và `72.89 × 36` ở 1280, còn công tắc đổi màu của HeroUI (`.switch--md`) hiện ra `64 × 36`. Nhật ký đổi của Grammar 0.4.6 khoanh bản vá vào hai khe hành động và loại tầng feature ra ngoài; khe đích đến chính thì không phải cái nào trong hai, mà lại đúng là cái còn dưới sàn. Chỗ sửa nằm ở Grammar, đặt trên chính thứ bấm được chứ không phải trên khe, y như cách hai khe hành động đã làm. Phía ứng dụng tiêu thụ nó ở `src/components/product-shells/ShellNav/component.tsx`.

#### DEF-7 (còn mở, không đổi) — nhẹ — `MISSING-ASSET`, thiếu hình cho chế độ tối

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:229-250`. Cách vá đúng ở tư cách một sự đánh đổi — một mảng trắng trên nền tối còn tệ hơn là không có ảnh — nhưng lỗi nằm ở tài nguyên thiếu chứ không ở nhánh điều kiện. Nó đóng vào ngày một biến thể tối của `/images/pro-subscription/pro-learning-journey-v1.png` được giao. Ghi chú ở `:229-236` đã ghi lại điều này.

#### TASTE-1 / TASTE-8 — bức tranh át mất việc của bề mặt

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:238-250` vẽ hình minh hoạ hành trình trọn 808px bề ngang cột, cao `454.63px`. Tính theo diện tích, nó gấp 15 lần `H1` và 24 lần nút mua. Chuyện này về hướng thiết kế (`TASTE-13` Case 4): hoặc bức ảnh bị xếp xuống dưới cái quyết định mà nó đang át, hoặc bề mặt thừa nhận bức ảnh chính là việc của mình. Một con số bề ngang hay chiều cao chọn ở tầng presentation không phân xử được vùng nào dẫn đầu.

#### TASTE-2 / TASTE-9 — 616px cột rail chết

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:210-213` (`PrimaryRailLayout`, `railWidth="wide"`) đối lại thẻ gói vốn chỉ cao 261px trong một trang cao 1.104px. Vùng rail kết thúc ở `y=487.7` và không gì chiếm `384 × 616.3` bên dưới nó. Chuyện này về hướng thiết kế: hoặc rail xứng đáng có thêm một vùng thứ hai, hoặc bố cục rộng không phải thứ mà nội dung của bề mặt này đang xin.

#### TASTE-6 Case 1 — bốn cỡ chữ trong một vùng rail

`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx` nhánh rail, `:165-193`. `36px/600`, `16px/600`, `14px/500`, `14px/400`, `12px/500` và `12px/400` cùng hiện ra trong một vùng, đối lại trần ba cỡ và hai độ đậm mà luật đặt.

#### TASTE-6 Case 2 — câu mô tả chạy quá 80 ký tự

`src/components/blocks/commerce/ProSubscriptionBlock/classNames.ts:16` (`proHeroClassName`, `max-w-3xl`). 768px ở cỡ `14px` là chừng 105 ký tự một dòng tại 1280, vượt dải 45–80 mà luật nêu. Riêng cái này là một ranh giới thuộc ứng dụng và đúng là chuyện của presentation.

#### TASTE-12 — không có hồ sơ hướng thiết kế nêu chuẩn tham chiếu

Không quyết định hướng thiết kế nào cho `/vi/subscriptions` nêu tên chuẩn tham chiếu mà nó nhắm tới, theo hạng. Chừng nào chưa có một hồ sơ như thế, `TASTE-12` Case 1 tự nó làm hỏng thấu kính, và không ảnh chụp nào của bề mặt này chấm được tiêu chí ấy.

### Cách dựng lại

Máy chủ dev bật bằng `npm run dev` từ worktree (cổng 3000 lúc ấy trống) và cả cây tiến trình của nó bị kết liễu khi xong; cổng 3000 giờ chỉ còn socket `TIME_WAIT`, không còn ai lắng nghe. Ảnh chụp bằng Chrome không giao diện dưới `puppeteer-core`, mỗi bề ngang và mỗi bảng màu một ngữ cảnh trình duyệt mới, `prefers-color-scheme` giả lập qua CDP, `fullPage: true`, đồng thời đọc ngược từ chính trang ấy ra các rãnh lưới, `order` đã tính, hình chữ nhật bao, danh sách tiêu đề, kích thước điều khiển, thống kê cỡ chữ và bo góc, cùng tập phần tử tràn mép. Ba tệp JSON nằm cạnh các ảnh PNG mang đủ mọi con số đã dẫn ở trên.
