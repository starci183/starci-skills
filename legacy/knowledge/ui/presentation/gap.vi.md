# Gap presentation

File này trả lời đúng một câu hỏi: một container mà ứng dụng đã quyết định render thì nhận giá trị
gap nào.

Bước composition đã chọn xong cây DOM, hướng flex hay grid, và các Grammar object. Gap presentation
chỉ giải quyết khoảng cách giữa những object đó, và chỉ ở nơi ứng dụng sở hữu container. Khoảng cách
bên trong một Grammar object thuộc về Grammar.

## Thang giá trị

`COMMON_SPACING_SCALE` là thang đóng. Số của rule là thứ tự trên thang đó. Nó không phải số bậc
Tailwind, và hai số này lệch nhau từ GAP-5 trở đi.

| Rule | Class | Giá trị | Token Common |
| --- | --- | --- | --- |
| GAP-0 | `gap-0` | `0` | không có |
| GAP-1 | `gap-1` | `.25rem` | không có |
| GAP-2 | `gap-2` | `.5rem` | `--grammar-inline-gap` |
| GAP-3 | `gap-3` | `.75rem` | `--grammar-row-gap` |
| GAP-4 | `gap-4` | `1rem` | `--grammar-section-gap` |
| GAP-5 | `gap-6` | `1.5rem` | `--grammar-region-gap` |
| GAP-6 | `gap-8` | `2rem` | không có |

Các giá trị rem chỉ quy ra `0 / 4 / 8 / 12 / 16 / 24 / 32` pixel CSS khi root font size tính được là
`16px`. Khi kiểm tra lúc chạy thì dùng `expectedPx = remFactor * observedRootFontPx`.

## Owner

Mỗi case gọi tên ai sở hữu khoảng cách. Owner quyết định ứng dụng có được viết class hay không.

| Owner | Nghĩa | Ứng dụng viết |
| --- | --- | --- |
| `App` | Container thuộc về ứng dụng | Viết class |
| Tên component | Common đã áp gap bên trong component đó | Không viết gì, chỉ truyền prop |
| `—` | Common chưa có đường dùng công khai cho quan hệ này | Viết class, ghi nhận là workaround |

Viết class ở chỗ owner là một component chính là `APP_REIMPLEMENTATION`. Viết class ở chỗ owner là
`—` thì gắn liền với `COMMON_CAPABILITY_MISSING`.

## Gap mà Common đã sở hữu

Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.

| Component | Phần tử hoặc điều kiện | Rule |
| --- | --- | --- |
| `ChatWorkspace` | layout | GAP-5 |
| `Divider` | root | GAP-3 |
| `EmptyNotice` | root | GAP-3 |
| `Input` | root | GAP-2 |
| `MediaFrame` | root | GAP-2 |
| `NavigationFeatureNav` | actions, actions!=undefined | GAP-2 |
| `NavigationFeatureNav` | primary | GAP-3 |
| `PressableField` | content | GAP-2 |
| `PressableField` | root | GAP-2 |
| `PrimaryRailLayout` | root | GAP-5 |
| `Rail` | frame | GAP-4 |
| `SectionHeader` | copy | GAP-2 |
| `SectionHeader` | root | GAP-5 |
| `Sidebar` | item, not collapsed | GAP-3 |
| `Sidebar` | list | GAP-1 |
| `Sidebar` | section | GAP-1 |
| `StaticStateRow` | root | GAP-3 |
| `StaticStateRow` | row copy | GAP-1 |
| `Subnav` | identity | GAP-2 |
| `Subnav` | root | GAP-3 |
| `SurfaceAccordionCard` | label, label!=undefined | GAP-2 |
| `SurfaceCard` | content, composition="joined" | GAP-0 |
| `SurfaceCard` | label, label!=undefined | GAP-2 |
| `SurfaceCopyGroup` | root, density!="comfortable" | GAP-2 |
| `SurfaceCopyGroup` | root, density="comfortable" | GAP-3 |
| `SurfaceListCard` | label, not (label === undefined || labelHidden) | GAP-2 |
| `Tabs` | tab content | GAP-2 |
| `Text` | root, not isSkeleton, showsStartContent | GAP-2 |
| `TextAction` | root | GAP-2 |
| `WorkspaceShell` | layout | GAP-5 |
| `WorkspaceShell` | primary | GAP-5 |

## GAP-0 — `gap-0` / `0`

Hai mặt kề nhau chạm nhau, vì đường ranh đã do một phần tử khác vẽ.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Các dải xếp chồng mà ranh giới do separator vẽ | `App` | `<div className="flex flex-col gap-0">` với `<Divider />` giữa các dải |
| Case 2 | Danh sách mà các hàng cách nhau bằng border chứ không bằng khoảng trắng | `SurfaceListCard` | Ghép card, không viết gap |
| Case 3 | Các mặt nối liền bên trong một surface | `SurfaceCard` | `composition="joined"` đã đặt sẵn `0` |

## GAP-1 — `gap-1` / `.25rem`

Hai dòng xếp dọc đọc lên thành một danh tính. Dòng thứ hai bổ nghĩa cho dòng đầu chứ không mở ra một
mục mới.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một tiêu đề và dòng phụ ngắn thuộc về nó, kiểu tên nằm dưới nhãn phân loại | `—` | `<div className="flex flex-col gap-1">` với hai `<Text>` |
| Case 2 | Một giá trị và đơn vị hoặc mốc thời gian dính liền với nó | `—` | Cùng container |
| Case 3 | Cặp copy bên trong một hàng trạng thái | `StaticStateRow` | Ghép hàng, không viết gap |

Không phải rule này: hai mục đọc độc lập được, kể cả khi ngắn, thì dùng GAP-3.

## GAP-2 — `gap-2` / `.5rem`

Những thành phần đi kèm nằm trong cùng một control, hoặc hai mục nhỏ hoạt động như một khối.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một icon nằm cạnh label của nó bên trong một control | `Text` | `<Text startContent={<Icon source={check} />}>Active</Text>` |
| Case 2 | Một tiêu đề và phần giải thích bên trong một surface | `SurfaceCopyGroup` | `<SurfaceCopyGroup>` với density mặc định |
| Case 3 | Hai inline action đứng cạnh nhau trong hàng do app sở hữu | `App` | `<div className="flex items-center gap-2">` với hai `<TextAction>` |
| Case 4 | Một hàng badge hoặc chip trạng thái ngắn | `App` | `<div className="flex flex-wrap gap-2">` với các `<Badge>` |

## GAP-3 — `gap-3` / `.75rem`

Các mục ngang hàng trong một hàng hoặc một nhóm chặt. Mỗi mục đọc riêng được, nhưng chúng thuộc về
nhau.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Một field và action gửi nó, đặt cạnh nhau | `App` | `<div className="flex items-end gap-3">` với `<Input>` và `<Button>` |
| Case 2 | Tiêu đề và phần giải thích cần thoáng hơn mức compact mặc định | `SurfaceCopyGroup` | `<SurfaceCopyGroup density="comfortable">` |
| Case 3 | Hai control ngang hàng phục vụ chung một quyết định, kiểu một cặp bộ lọc | `App` | `<div className="flex gap-3">` |
| Case 4 | Section header có phần copy và action xếp chồng vì container hẹp | `SectionHeader` | Ghép header, không viết gap |

Không phải rule này: các khối mà mỗi khối tự mang tiêu đề riêng thì dùng GAP-4.

## GAP-4 — `gap-4` / `1rem`

Các khối ngang hàng trong cùng một section. Mỗi khối là một mảng nội dung riêng, nhưng cả section
vẫn đọc lên thành một nhóm.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Các khối nội dung xếp chồng dưới một tiêu đề section | `App` | `<section className="flex flex-col gap-4">` |
| Case 2 | Các card trong một lưới cùng thuộc một tập hợp | `App` | `<div className="grid grid-cols-2 gap-4">` với các `<SurfaceCard>` |
| Case 3 | Các nhóm field của một form trong cùng một bước | `App` | `<div className="flex flex-col gap-4">` với các `<Input>` |
| Case 4 | Các khối văn bản bên trong nội dung article đã render | `MarkdownArticle` | Ghép article, không viết gap |

## GAP-5 — `gap-6` / `1.5rem`

Các vùng của một trang. Mỗi vùng có mục đích riêng và tiêu đề riêng, người đọc nhảy giữa các vùng chứ
không đọc xuyên qua.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Hai vùng trang khác mục đích, kiểu phần tóm tắt nằm trên danh sách lịch sử | `App` | `<main className="flex flex-col gap-6">` với hai `<section>` |
| Case 2 | Nhịp thường trực giữa các section cấp cao nhất của một dashboard | `App` | `<div className="flex flex-col gap-6">` |
| Case 3 | Cột chính đặt cạnh rail của nó | `PrimaryRailLayout` | Ghép layout, không viết gap |
| Case 4 | Các vùng shell bao quanh nội dung trang được route | `WorkspaceShell` | Ghép shell, không viết gap |

Không phải rule này: các khối chung một tiêu đề và một mục đích thì dùng GAP-4.

## GAP-6 — `gap-8` / `2rem`

Một bước chuyển lớn có tên. Đây là mức ngắt mạnh nhất mà thang cung cấp, chỉ dùng khi nhịp vùng
thông thường không đủ tách hai phần của trang.

| Case | Dùng khi | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Trang mà hai nửa phục vụ hai việc không liên quan, để `1.5rem` thì đọc thành một cột liền mạch | `—` | `<main className="flex flex-col gap-8">` |
| Case 2 | Một surface marketing mà các section cố ý để thoáng | `—` | Cùng container |

Không phải rule này: áp đồng loạt cho mọi vùng thì mất hết phân cấp. Dùng GAP-5.

## Biến thể theo trục

`gap-x-*` và `gap-y-*` không phải rule riêng. Chúng áp một rule đã có lên một trục, khi hai trục mang
hai quan hệ khác nhau, thường gặp trên container wrap hoặc grid.

| Trục | Class | Nghĩa |
| --- | --- | --- |
| Inline | `gap-x-*` | Rule đã chọn chỉ áp giữa các cột |
| Block | `gap-y-*` | Rule đã chọn chỉ áp giữa các hàng |

Một danh sách wrap mà theo chiều ngang là các thành phần đi kèm còn theo chiều dọc là các mục ngang
hàng thì viết `gap-x-2 gap-y-3`, tức GAP-2 trên trục inline và GAP-3 trên trục block. Mỗi trục vẫn
phải gọi tên case của riêng nó.

## File này không quyết định

Padding bên trong ranh giới của app thuộc về [Padding](padding.md). Khoảng lệch ra ngoài thuộc về
[Margin](margin.md). Việc chọn cấu trúc DOM, hướng flex, hay Grammar object nào đã được quyết trước
khi đọc file này, và không giá trị gap nào cứu được một composition sai.
