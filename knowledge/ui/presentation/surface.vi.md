# Surface presentation

File này trả lời đúng một câu hỏi: một vùng mà ứng dụng đã quyết định render thì nhận token surface
ngữ nghĩa nào, và token foreground nào đi kèm với nó.

Surface và foreground luôn đi thành cặp. Ứng dụng không bao giờ chọn riêng phần nền, vì một nền chọn
mà thiếu foreground đi kèm sẽ để phần copy nằm trên đó không được đo, và đó là lỗi tương phản chứ
không phải chuyện sở thích. Phần sơn bên trong một Grammar object thuộc về Grammar; file này chỉ giải
quyết những mặt do ứng dụng sở hữu.

## Danh mục

Surface không có thang giá trị, nên số của rule là địa chỉ trên tập các mặt ngữ nghĩa chứ không phải
vị trí trên một dải. Ưu tiên rule đứng trước nếu nó đủ dùng: không surface trước mặt card, mặt card
trước dải phụ, dải trung tính trước dải mang nghĩa.

| Rule | Surface | Foreground đi kèm | Mang nghĩa |
| --- | --- | --- | --- |
| SURFACE-1 | không có, trong suốt | kế thừa | Nội dung đã nằm trên mặt của người khác |
| SURFACE-2 | `--surface` | `--surface-foreground` | Mặt của một đối tượng có ranh giới |
| SURFACE-3 | `--surface-secondary` | `--foreground` | Dải trung tính bên trong một surface nối liền |
| SURFACE-4 | `--accent-soft` | `--accent-soft-foreground` | Dải mà sản phẩm cố ý nâng lên |
| SURFACE-5 | `--success-soft` | foreground của dải mà nó thay thế | Một kết quả đã được chứng minh |
| SURFACE-6 | `--accent` | không có, vì không có copy nằm trên | Một mảng trang trí |

`--surface`, `--surface-secondary` và `--accent` là token nền của theme; `--accent-soft`,
`--success-soft` cùng các bản `-foreground` của chúng được dẫn xuất từ `--accent` và `--success` trên
cùng một element, nên ghi đè token gốc là dịch cả họ. Không token nào trong danh sách này được viết
lại bằng giá trị hex, literal `oklch()`, hay một bậc palette, kể cả khi literal đó trùng giá trị.

## Owner

Mỗi case gọi tên ai sở hữu cái mặt đó. Owner quyết định ứng dụng có được viết class hay không.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Vùng thuộc về ứng dụng | Viết cặp class |
| Tên component | Grammar đã sơn mặt này | Không viết gì, chỉ truyền prop |
| `—` | Grammar chưa có đường dùng công khai cho mặt này | Viết cặp class, ghi nhận là workaround |

Viết class ở chỗ owner là một component chính là `APP_REIMPLEMENTATION`. Viết class ở chỗ owner là `—`
thì gắn liền với `COMMON_CAPABILITY_MISSING`. Thò vào một Grammar component bằng selector hay class
truyền xuống để sơn lại nó là `APP_OVERRIDE`.

## Surface mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `ChatWorkspace` | drawer close, hasRail, isCompactRail | SURFACE-2 |
| `ChatWorkspace` | rail trigger, hasRail, isCompactRail | SURFACE-2 |
| `IconTile` | root, not (isSkeleton || showsArtwork), tone="accent" | SURFACE-4 |
| `IconTile` | root, not (isSkeleton || showsArtwork), tone="success" | SURFACE-5 |
| `MediaFrame` | root, treatment!="plain" | SURFACE-3 |
| `MediaFrame` | root, treatment="plain" | SURFACE-1 |
| `Sidebar` | list box item | SURFACE-4 |
| `SurfaceAccordionCard` | accordion shell, bounded | SURFACE-2 |
| `SurfaceAccordionCard` | accordion shell, not bounded | SURFACE-1 |
| `SurfaceCard` | card content, frame!="frameless" | SURFACE-2 |
| `SurfaceCard` | card content, frame="frameless" | SURFACE-1 |
| `SurfaceCard` | root, wholeAction!=undefined | SURFACE-4 |
| `SurfaceListCard` | root | SURFACE-2 |
| `TextAction` | root, isCurrent, appearance="choice"|"route"|"section" | SURFACE-4 |

## SURFACE-1 — không có surface / foreground kế thừa

Vùng không sơn gì cả, vì cái mặt bên dưới nó đã đúng rồi và phần copy kế thừa đúng foreground đã được
đo trên mặt đó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Nội dung mà các ranh giới nhìn thấy được đã do chính con của nó vẽ | `SurfaceCard` | `frame="frameless"` đã đặt sẵn trong suốt và `color: inherit` |
| Case 2 | Media phải nằm thẳng trên canvas trang, không khung lót | `MediaFrame` | `treatment="plain"` đã bỏ sẵn phần nền và border |
| Case 3 | Container gom nhóm do app sở hữu, chỉ xếp chồng các con mà mỗi con tự có mặt riêng | `App` | `<div className="flex min-w-0 flex-col">` không có class nền |

Không phải rule này: một vùng cần mặt đọc được của riêng nó thì dùng SURFACE-2.

## SURFACE-2 — `bg-surface` / `text-surface-foreground`

Mặt của một đối tượng có ranh giới. Đây là mặt mà một card trình ra với trang, và Grammar sơn nó theo
cặp để phần copy bên trong không bao giờ phải tự khai màu.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một đối tượng nội dung có ranh giới nằm trên canvas trang | `SurfaceCard` | Ghép card, không viết class nền |
| Case 2 | Một list hay disclosure trình ra cùng cái mặt có ranh giới đó | `SurfaceListCard`, `SurfaceAccordionCard` | Ghép card, không viết class nền |
| Case 3 | Các hàng phải để lộ mặt card qua một list nối liền ở độ trong nhất định | `—` | `<li className="bg-surface/90">` bên trong thân card nối liền |

Không phải rule này: một dải cần đọc thành lõm xuống so với mặt card thì dùng SURFACE-3.

Case 3 chồng hai lớp lên nhau, nên tương phản được đo trên pixel kết quả chứ không phải trên riêng
`--surface`.

## SURFACE-3 — `bg-surface-secondary` / `text-foreground`

Dải trung tính bên trong một surface nối liền. Nó đọc thành lõm xuống so với mặt card mà không tự
nhận nghĩa nào, nên phần copy trên đó vẫn ở mức chú ý đọc bình thường.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Dải tóm tắt hoặc diễn giải chạy sát hai mép trong một card nối liền | `—` | `<div className="bg-surface-secondary px-4 py-3 text-foreground">` |
| Case 2 | Dải minh hoạ tràn viền dùng chung cái mặt trung tính đó | `—` | `<div className="min-w-0 bg-surface-secondary">` với ảnh bên trong |
| Case 3 | Nền lõm phía sau media có khung | `MediaFrame` | Ghép frame, không viết class nền |

Không phải rule này: dải mà sản phẩm cố ý nâng lên thì dùng SURFACE-4, còn dải báo một kết quả đã
chứng minh thì dùng SURFACE-5.

Theme cũng công bố `--surface-secondary-foreground`, nhưng các dải ở trên ghép mặt phụ với
`--foreground`. Hai token này quy về cùng một giá trị ở cả hai theme, nên cặp này được ghi đúng như nó
đang được viết chứ không sửa lại ở đây.

## SURFACE-4 — `bg-accent-soft` / `text-accent-soft-foreground`

Một dải mà sản phẩm cố ý nâng lên. Accent là thứ khan hiếm: lặp lại trên mọi dải ngang hàng thì nó
thôi đánh dấu điều gì, và dải được nâng vẫn phải nói bằng chữ vì sao nó được nâng.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một dải tóm tắt trong card nối liền mà sản phẩm đã xếp trên các dải ngang hàng | `—` | `<div className="bg-accent-soft px-4 py-3 text-accent-soft-foreground">` |
| Case 2 | Một dấu dẫn đầu bên trong vùng được nâng, chỉ lấy riêng foreground đi kèm | `—` | `<Icon className="text-accent-soft-foreground" />` trên dải được nâng |
| Case 3 | Một card mà cả mặt của nó phản hồi khi hover hoặc focus bàn phím | `SurfaceCard` | `interaction="whole-action"` đã đổi sẵn cái mặt |

Không phải rule này: một mảng accent nguyên độ nằm dưới copy. Chỉ dùng SURFACE-6 ở chỗ không có copy
nào nằm trên.

Một dải được nâng mà bỏ `text-accent-soft-foreground` sẽ để copy của nó nằm trên foreground kế thừa
của cái mặt mà nó vừa thay, và đó chính là lỗi mà rule này sinh ra để chặn.

`--accent-soft` là một `color-mix` của `--accent` pha về phía trong suốt, nên dải này không đục và mặt
bên dưới vẫn lộ qua. Vì vậy tương phản ở rule này được đo trên pixel đã chồng, không bao giờ đo trên
token.

## SURFACE-5 — `bg-success-soft` / foreground của dải mà nó thay thế

Một dải báo kết quả đã được chứng minh bằng cách đổi mặt trung tính của nó lấy mặt trạng thái, và giữ
nguyên foreground mà dải trung tính đã thiết lập.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Dải mà kết quả đã ngã ngũ và có bằng chứng, không phải mới chỉ hứa | `—` | Class dải trung tính rồi tới `bg-success-soft` |
| Case 2 | Chính dải đó khi kết quả chưa được chứng minh | `—` | Ở lại SURFACE-3, không sơn trước kết quả |

Không phải rule này: lấy màu làm phương tiện duy nhất chở kết quả. Dải vẫn phải nói kết quả bằng chữ,
và màu trạng thái không bao giờ được chọn như một tone chữ.

Mặt trạng thái được đổi mà không đổi foreground kèm theo, nên cặp thực tế là `--success-soft` dưới
`--foreground`. Tổ hợp đó phải được đo ở cả hai theme, không được suy đoán.

## SURFACE-6 — `bg-accent` / không có foreground đi kèm

Một mảng trang trí ở độ accent nguyên. Nó chỉ được chấp nhận vì không có gì đọc được nằm trên đó, và
cũng chính vì thế nó không gọi tên foreground nào.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Dải hero chỉ mang một ảnh trang trí và không mang copy | `—` | `<div className="relative isolate min-h-32 overflow-hidden bg-accent">` với một ảnh `aria-hidden` |

Không phải rule này: bất kỳ mảng nào mang chữ, nhãn hay control. Đặt copy lên SURFACE-4, nơi có sẵn
một foreground đi kèm.

## File này không quyết định

Một dòng copy lấy foreground nào sau khi surface của nó đã chốt là việc của [Tone](tone.md). Các cạnh
tách hai mặt là [Boundary](boundary.md). Khoảng cách giữa một mặt và nội dung của nó là
[Padding](padding.md), còn việc cắt để giữ một dải nằm gọn trong card là [Overflow](overflow.md).
