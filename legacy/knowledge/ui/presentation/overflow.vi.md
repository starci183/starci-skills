# Overflow presentation

File này trả lời đúng một câu hỏi: khi nội dung vượt quá vùng của nó thì ranh giới nào làm chủ, và
nó làm gì.

Composition đã chọn cây DOM và [Measure](measure.md) đã chặn kích thước vùng. Overflow giải quyết
chuyện gì xảy ra ở mép của một ranh giới do ứng dụng sở hữu. Việc cắt và cuộn bên trong một card,
rail, khung bảng hay shell đều thuộc về Grammar.

## Danh mục

| Rule | Hành vi ở ranh giới | Nội dung vượt mép |
| --- | --- | --- |
| OVERFLOW-1 | Hiện ra ngoài | Thoát khỏi ranh giới và vẫn đọc được |
| OVERFLOW-2 | Bị cắt | Bị cắt và không với tới được |
| OVERFLOW-3 | Cuộn một trục | Với tới được bằng cách cuộn trục đó |
| OVERFLOW-4 | Cuộn khi cần | Chỉ với tới được khi nó thật sự tồn tại |
| OVERFLOW-5 | Giữ lại trong vùng | Cuộn mà không trao cử chỉ đó cho trang |

Mỗi trục chỉ đúng một ranh giới làm chủ. Hai vùng cuộn lồng nhau trên cùng một trục nhốt người đọc ở
giữa, và không vùng nào tới cuối được một cách đáng tin.

## Owner

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Ranh giới thuộc về ứng dụng | Viết class |
| Tên component | Common đã sở hữu ranh giới này | Không viết gì, chỉ ghép component |
| `—` | Common chưa có đường dùng công khai | Viết class, ghi nhận là workaround |

Một ranh giới cuộn không bao giờ viết một mình. Nó đi kèm một cái chặn từ [Measure](measure.md), vì
một vùng không có chặn chiều cao thì không bao giờ tràn, và class cuộn của nó chẳng làm gì cả.

## Overflow mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `ChatWorkspace` | conversation | OVERFLOW-4 |
| `ChatWorkspace` | conversation | OVERFLOW-5 |
| `ChatWorkspace` | drawer body, hasRail, isCompactRail | OVERFLOW-2 |
| `ChatWorkspace` | overlay rail, hasRail, isCompactRail | OVERFLOW-4 |
| `ChatWorkspace` | overlay rail, hasRail, isCompactRail | OVERFLOW-5 |
| `ChatWorkspace` | overlay rail, hasRail, not isCompactRail | OVERFLOW-4 |
| `ChatWorkspace` | overlay rail, hasRail, not isCompactRail | OVERFLOW-5 |
| `FencedCodeBlock` | root | OVERFLOW-4 |
| `HorizontalScrollRegion` | root | OVERFLOW-5 |
| `HorizontalScrollRegion` | root, overflow!="needed" | OVERFLOW-3 |
| `HorizontalScrollRegion` | root, overflow="needed" | OVERFLOW-4 |
| `IconTile` | root | OVERFLOW-2 |
| `MarkdownTableFrame` | root | OVERFLOW-4 |
| `MediaFrame` | root | OVERFLOW-2 |
| `OtpInput` | root | OVERFLOW-3 |
| `OtpInput` | root | OVERFLOW-5 |
| `Rail` | body, height!="fill" | OVERFLOW-3 |
| `Sidebar` | root | OVERFLOW-2 |
| `SurfaceAccordionCard` | accordion shell | OVERFLOW-2 |
| `SurfaceAccordionCard` | accordion shell, not bounded | OVERFLOW-1 |
| `SurfaceCard` | card content, frame!="frameless" | OVERFLOW-2 |
| `SurfaceCard` | card content, frame="frameless" | OVERFLOW-1 |
| `SurfaceListCard` | root | OVERFLOW-2 |
| `VerticalScrollRegion` | root, isScrollable, overflow!="needed" | OVERFLOW-3 |
| `VerticalScrollRegion` | root, isScrollable, overflow="needed" | OVERFLOW-4 |
| `WorkspaceShell` | floating layer, hasFloatingLayer | OVERFLOW-4 |

## OVERFLOW-1 — Hiện ra ngoài

Ranh giới không cắt, vì phải cho một thứ gì đó được phép vượt qua nó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một vùng mà phần tử con mang focus ring, đổ bóng hay badge nằm ngoài hộp | `App` | Không viết class. Hiện ra ngoài là mặc định |
| Case 2 | Một surface không được cắt phần highlight của chính nó | `SurfaceCard` | Biến thể frameless đã giữ hiện ra ngoài sẵn |

Không phải rule này: để một vùng có chặn kích thước ở chế độ hiện ra ngoài chỉ vì lười quyết. Nội
dung thoát ra trong im lặng sẽ chồng lên thứ nằm ngay sau nó.

## OVERFLOW-2 — Bị cắt

Nội dung bị cắt ở ranh giới và không với tới được.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một vùng bo góc mà các phần tử con phải nằm gọn trong bán kính | `SurfaceCard` | Ghép card, nó đã cắt sẵn |
| Case 2 | Một viewport media crop ảnh theo khung cố định | `MediaFrame` | Ghép khung, nó đã cắt sẵn |
| Case 3 | Một vùng trang trí do app sở hữu, phần tràn không mang thông tin gì | `App` | `overflow-hidden` |

Cắt mất nội dung mà người đọc cần là mất dữ liệu trong im lặng. Nó trông đúng trên ảnh chụp ở một khổ
và hỏng ở khổ khác, và đó là lý do đây là loại lỗi overflow khó tìm nhất.

Không phải rule này: chữ không vừa chỗ. Cái đó thuộc [Text flow](text-flow.md), và nó cắt cụt một
cách nhìn thấy được chứ không biến mất.

## OVERFLOW-3 — Cuộn một trục

Ranh giới luôn cuộn một trục, vì nội dung của nó vốn được dự tính là sẽ vượt quá.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một hàng các mục cố ý rộng hơn viewport | `HorizontalScrollRegion` | Ghép region |
| Case 2 | Một panel hoặc danh sách có chặn kích thước mà nội dung cứ dài thêm | `VerticalScrollRegion` | Ghép region |
| Case 3 | Thân rail cuộn trong khi shell của nó đứng yên | `Rail` | Ghép rail |

Trục còn lại giữ bị cắt hoặc hiện ra ngoài, có chủ ý. Một vùng cuộn cả hai trục là giấu nội dung theo
một hướng mà người đọc chẳng có lý do gì để nhìn tới.

Không phải rule này: một vùng mà nội dung thường là vừa. Dùng OVERFLOW-4 để thanh cuộn chỉ hiện khi
nó có nghĩa.

## OVERFLOW-4 — Cuộn khi cần

Ranh giới chỉ cuộn khi nội dung thật sự vượt quá nó.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một bảng rộng nằm trong cột hẹp hơn | `MarkdownTableFrame` | Ghép khung |
| Case 2 | Những dòng code dài không được xuống dòng | `FencedCodeBlock` | Ghép khối |
| Case 3 | Một dải tab chỉ vượt chiều rộng ở một số ngôn ngữ | `Tabs` | Ghép tabs |
| Case 4 | Một vùng do app sở hữu, có chặn kích thước, nội dung thỉnh thoảng mới vượt | `App` | `overflow-auto` cùng cái chặn chiều cao tương ứng |

Không phải rule này: một thanh cuộn luôn hiện trên vùng mà nội dung thường vừa, vì lần đầu người đọc
thấy nó rỗng thì nó đọc lên như một lỗi.

## OVERFLOW-5 — Giữ lại trong vùng

Việc cuộn dừng lại ở ranh giới này thay vì chạy tiếp vào trang phía sau.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một panel, drawer hay overlay đang cuộn, nằm trên nội dung trang | `—` | `overscroll-contain` đi cùng rule cuộn |
| Case 2 | Một hàng ngang nằm trong một trang cuộn dọc | `HorizontalScrollRegion` | Ghép region, nó đã giữ trục ngang sẵn |

Không giữ lại thì khi cuộn tới cuối vùng bên trong, cử chỉ đó được trao cho trang và người đọc mất
dấu chỗ đang xem. Trên thiết bị cảm ứng còn tệ hơn, vì trang trôi ngay dưới ngón tay đang cuộn thứ
khác.

Không phải rule này: giữ lại trên chính vùng cuộn của trang, vì như vậy là nhốt người đọc.

## File này không quyết định

Vùng lớn cỡ nào, và có chặn chiều cao hay không, thuộc về [Measure](measure.md). Chữ làm gì khi không
vừa thuộc về [Text flow](text-flow.md).
