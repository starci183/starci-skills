# Boundary presentation

File này trả lời đúng một câu hỏi: một cạnh mà ứng dụng sở hữu thì được vẽ bằng separator hay border
nào, và cạnh nào trong một tập lặp lại thì bỏ đường kẻ đó.

Theme công bố hai token đường mảnh và chúng mang hai nghĩa khác nhau: `--separator` vẽ đường giữa
những thứ khác nhau, còn `--border` vẽ đường viền của một thứ. Ranh giới bên trong một Grammar
component là của chính component đó, không bao giờ của ứng dụng, và không cạnh nào của ứng dụng được
vẽ bằng một giá trị màu thô.

## Danh mục

Boundary không có thang giá trị, nên số của rule là địa chỉ trên tập các loại cạnh chứ không phải vị
trí trên một dải. Ưu tiên rule đứng trước nếu nó đủ dùng: một đường trước đường theo từng hàng, đường
theo từng hàng trước khai báo ở cha, đường mảnh trước đường viền.

| Rule | Loại cạnh | Vẽ cái gì |
| --- | --- | --- |
| BOUNDARY-1 | Một đường | Đường duy nhất giữa hai dải xếp chồng |
| BOUNDARY-2 | Đường theo từng hàng | Đường cuối của mỗi hàng, bỏ ở hàng cuối |
| BOUNDARY-3 | Đường của cả tập | Một khai báo ở cha vẽ mọi đường bên trong tập |
| BOUNDARY-4 | Đường theo trục inline | Đường giữa các cột của grid hoặc của một vùng chẻ đôi |
| BOUNDARY-5 | Đường viền | Border bao quanh một đối tượng |
| BOUNDARY-6 | Không border | Đối tượng được tách bằng độ nổi thay vì bằng đường kẻ |

Một tập lặp lại có số đường ít hơn số hàng đúng một. Rule nào vẽ tập cũng vậy, mép ngoài của hàng cuối
đã do chính surface đóng lại, nên một tập còn vẽ đường ở mép của chính nó là thừa một ranh giới.

## Owner

Mỗi case gọi tên ai sở hữu cạnh đó. Owner quyết định ứng dụng có được viết class hay không.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Cạnh thuộc về ứng dụng | Viết class |
| Tên component | Common đã vẽ cạnh này bên trong component đó | Không viết gì, chỉ truyền prop |
| `—` | Common chưa có đường dùng công khai cho cạnh này | Viết class, ghi nhận là workaround |

Viết class ở chỗ owner là một component chính là `APP_REIMPLEMENTATION`. Viết class ở chỗ owner là `—`
thì gắn liền với `COMMON_CAPABILITY_MISSING`. Thêm một đường của ứng dụng cạnh đường mà component đã
vẽ là `DOUBLE_OWNER`, và nó hiện ra thành một đường mảnh đôi nhìn thấy được.

## Boundary mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `ChatWorkspace` | composer | BOUNDARY-1 |
| `ChatWorkspace` | rail trigger boundary, hasRail, isCompactRail | BOUNDARY-1 |
| `Divider` | rule | BOUNDARY-5 |
| `MediaFrame` | root, treatment!="plain" | BOUNDARY-5 |
| `NavigationFeatureNav` | root | BOUNDARY-1 |
| `StaticStateRow` | root | BOUNDARY-3 |
| `Subnav` | root | BOUNDARY-1 |
| `SurfaceAccordionCard` | accordion row | BOUNDARY-3 |
| `SurfaceAccordionCard` | accordion shell, depth="nested" | BOUNDARY-5 |
| `SurfaceAccordionCard` | accordion shell, depth="top" | BOUNDARY-6 |
| `SurfaceCard` | card content, depth!="nested" | BOUNDARY-6 |
| `SurfaceCard` | card content, depth="nested" | BOUNDARY-5 |
| `WorkspaceShell` | compact navigation, hasCompactNavigation | BOUNDARY-1 |
| `WorkspaceShell` | leading rule, railPosition="leading" | BOUNDARY-4 |

## BOUNDARY-1 — `border-t border-separator` / `--separator`

Một đường giữa hai dải xếp chồng bên trong một surface tràn viền. Hai dải chạm nhau, và đường kẻ là
thứ phân biệt chúng.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Hai dải do app sở hữu xếp chồng trong một card nối liền | `—` | `<div aria-hidden className="border-t border-separator" />` đặt giữa hai dải |
| Case 2 | Một dải tự mang đường dẫn đầu của nó thay vì một phần tử riêng | `—` | `<div className="min-w-0 border-t border-separator">` trên chính dải đó |
| Case 3 | Dải action đóng lại của một card, tách khỏi nội dung phía trên | `—` | `<div className="border-t border-separator px-4 pb-4 pt-3">` |
| Case 4 | Mép block của chrome trang đối với nội dung bên dưới | `Subnav`, `NavigationFeatureNav` | Ghép component, không viết class border |

Không phải rule này: từ ba hàng cùng loại trở lên thì dùng BOUNDARY-2 hoặc BOUNDARY-3.

Một phần tử separator là trang trí và phải mang `aria-hidden`; nghĩa nằm ở các dải mà nó chia.

## BOUNDARY-2 — `border-b border-separator last:border-b-0` / `--separator`

Một tập lặp lại mà mỗi hàng tự vẽ đường kết của nó, còn hàng cuối bỏ đường đó vì mép của chính surface
đã đóng tập lại rồi.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Các hàng của một tập hợp render sát hai mép trong card nối liền | `—` | `<li className="border-b border-separator px-4 py-3 last:border-b-0">` |
| Case 2 | Cũng tập đó, khi hàng cuối còn mở ra tới inset mép ngoài của card | `—` | Cùng class, thêm `last:pb-4` |
| Case 3 | Một lưới cùng loại hàng, nơi hàng đầy đủ cuối cùng của tập bỏ đường kẻ | `—` | `sm:[&:nth-last-child(-n+2)]:border-b-0` trên tập hai cột |

Không phải rule này: một tập mà các hàng không mang class riêng thì dùng BOUNDARY-3.

`last:border-b-0` chính là trọng tâm của rule này, không phải phần trang trí. Thiếu nó thì tập render
một đường sát mép surface và card đọc lên như chưa hoàn thiện. Case 3 tồn tại vì trong lưới hai cột thì
hàng cuối là hai con cuối, nên chỉ dùng `last:` sẽ bỏ được một đường và bỏ sót đường bên cạnh.

## BOUNDARY-3 — `divide-y divide-separator` / `--separator`

Một khai báo ở cha vẽ mọi đường bên trong tập. Các hàng không nói gì, nên không hàng nào bị bỏ sót và
không hàng nào render được một đường mà tập không định vẽ.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một list mà các hàng đồng nhất và không cần ngoại lệ theo hàng | `—` | `<ul className="m-0 list-none p-0 divide-y divide-separator">` |
| Case 2 | Một lưới các số đo ngang hàng xếp chồng trên một trục | `—` | `<div className="grid min-w-0 grid-cols-1 divide-y divide-separator">` |
| Case 3 | Một list hay disclosure mà Common đã tách hàng sẵn | `StaticStateRow`, `SurfaceAccordionCard` | Ghép hàng, không viết class divide |

Không phải rule này: một tập mà từng hàng cần cạnh khác nhau thì dùng BOUNDARY-2.

Common vẽ Case 3 bằng luật anh em kề chứ không bằng khai báo ở cha. Hai cách cùng một nghĩa, một đường
giữa hai hàng liên tiếp và không đường nào ở hai mép ngoài, nên cả hai đều thoả rule này.

## BOUNDARY-4 — `border-l` / `divide-x` / `--separator`

Một đường trên trục inline, giữa các cột của một lưới hoặc giữa hai nửa của một vùng chẻ đôi. Nó chỉ
xuất hiện ở bề rộng mà các cột thực sự tồn tại.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một tập xếp chồng ở khổ hẹp và thành cột ở khổ rộng | `—` | `divide-y divide-separator lg:divide-y-0 lg:divide-x` trên cha |
| Case 2 | Lưới hai cột mà chỉ cột đầu mang đường ngăn cột | `—` | `sm:[&:nth-child(odd)]:border-r` trên class của hàng |
| Case 3 | Một panel trở thành vùng bên và cần một đường với cột chính | `—` | `lg:border-l lg:border-separator` trên panel |
| Case 4 | Một shell mà rail dẫn đầu được tách khỏi vùng chính bằng một đường kẻ | `WorkspaceShell` | Ghép shell, không viết class border |

Không phải rule này: các đường theo trục block của cùng tập đó. Chúng vẫn là BOUNDARY-2 hoặc
BOUNDARY-3, và mỗi trục phải gọi tên case của riêng nó.

Selector `nth-child` ở Case 2 chính là thứ giữ cho cột cuối không vẽ đường sát mép surface. Nó là dạng
trục inline của `last:border-b-0`.

## BOUNDARY-5 — `border` / `--border`

Đường viền bao quanh một đối tượng, chứ không phải đường giữa hai thứ. Mọi case đều thuộc về một
Grammar component, vì những đối tượng cần đường viền đều là của Grammar.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một card lồng bên trong một surface có ranh giới khác | `SurfaceCard` | `depth="nested"` đã vẽ sẵn đường viền |
| Case 2 | Một viewport media có khung | `MediaFrame` | Ghép frame, không viết class border |
| Case 3 | Một khối code hay khung bảng trong nội dung article | `FencedCodeBlock`, `MarkdownTableFrame` | Ghép khối, không viết class border |
| Case 4 | Một ranh giới có nhãn nêu ra lựa chọn thay thế giữa hai đường đi | `Divider` | `<Divider label="hoặc" />` |

Không phải rule này: đường giữa hai dải chạm nhau. Đó là đường mảnh trên `--separator`, nên dùng
BOUNDARY-1.

## BOUNDARY-6 — không border / `--shadow-surface`

Một đối tượng được tách khỏi trang bằng độ nổi thay vì bằng đường kẻ. Đây là mặt mặc định của card cấp
cao nhất, và nó vẫn là một quyết định ranh giới dù không vẽ border nào.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một card cấp cao nhất nằm thẳng trên canvas trang | `SurfaceCard` | `depth="top"` đã bỏ sẵn border và áp bóng đổ |
| Case 2 | Cũng card đó khi nó được lồng vào bên trong một surface khác | `SurfaceCard` | `depth="nested"` thay bóng đổ bằng BOUNDARY-5 |

Không phải rule này: thêm đường viền cho một card cấp cao nhất. Border và bóng đổ là hai lựa chọn thay
thế nhau, vẽ cả hai là `DOUBLE_OWNER`.

`--shadow-surface` là một điểm móc của theme chứ không phải giá trị cố định, và một theme có thể quy nó
về không bóng đổ. Khi đó card cấp cao nhất chỉ còn được tách bằng chính mặt của nó trên canvas trang,
và đó là quyết định surface, thuộc về [Surface](surface.md).

## File này không quyết định

Mặt nào nằm ở hai bên một cạnh là việc của [Surface](surface.md). Khoảng cách giữa một cạnh và nội
dung của nó là [Padding](padding.md), và một ranh giới được vẽ bằng đường kẻ thay vì bằng khoảng trắng
chính là lý do cạnh giáp separator lấy inset nhỏ hơn cạnh mép ngoài. Khoảng cách giữa các phần tử ngang
hàng mà không cần đường kẻ là [Gap](gap.md), còn việc cắt để giữ một dải tràn viền nằm gọn trong card
là [Overflow](overflow.md).
