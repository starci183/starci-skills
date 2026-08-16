# bố cục tập tin

## Định nghĩa

Vị trí của một tập tin là một xác nhận về nó là gì. Một thư mục dưới`components/`nói "điều này thu hút
cái gì đó"; một thư mục dưới`hooks/`nói "cái này lấy"; một thư mục dưới`modules/`nói "đây không phải
Phản ứng chút nào". Một hồ sơ đặt sai vị trí không phải là bừa bộn - nó bị dán nhãn sai và cái giá phải trả là
không ai đã sử dụng lại nó có thể tìm thấy nó.

Câu hỏi giải quyết nó: **tập tin này là gì, không phụ thuộc vào người hiện đang gọi nó?** "Chỉ
màn hình này sử dụng nó" mô tả biểu đồ cuộc gọi ngày hôm nay, không phải sự vật và đó là câu chuyển hướng
thư mục của một màn hình vào cơ sở mã thứ hai.

Điều giữ luật này là[`sources/file-layout.mjs`](../../../sources/fe/file-layout.mjs), cộng với cây
bên dưới, đây là bản đồ mà các quy tắc gửi mọi thứ trở lại.

Implementation anchors in `starci-academy-fe`: `src/components/blocks/dashboard/CreditStatRow/index.tsx` and
`src/components/blocks/dashboard/CreditStatRow/component.tsx`.

## Cây thư mục

```
src/
    app/                    routes only - a route mounts a page and draws nothing
        api/
        <segment>/
    components/
        contracts/                  the entry table and the slot types - two files, no more
        leaves/<Name>/              one vendor primitive each, flat, no category
        composites/<Name>/          closed arrangements, flat
        branches/<Name>/            open containers, flat
        blocks/<category>/<Name>/   domain sentences, grouped by feature
        overlays/<category>/<Name>/ summoned surfaces, grouped by feature
        layouts/<Name>/             route-stable chrome, flat
        pages/<Name>/               one screen each, flat
    hooks/
        swr/                        one file per query or mutation
        <area>/
    modules/
        api/graphql/                clients, queries, mutations, and their types
    i18n/                   the translation runtime
    messages/               the copy itself, per locale
    tests/
```
**Cấp độ danh mục không phải là trang trí.**`blocks/`Và`overlays/`nhóm theo tính năng bởi vì họ
biết tên miền và tính năng là nhóm duy nhất vẫn đúng khi sản phẩm phát triển.`leaves/`, `branches/`, `layouts/`Và`pages/`phẳng vì họ không biết tính năng nào - một danh mục
sẽ có người đoán xem màn hình nào sở hữu một thứ thuộc về tất cả chúng.

## Cùng một cây trong monorepo

Một không gian làm việc có nhiều ứng dụng sẽ chia cây ở chính xác một nơi và phần chia không phải là một gói
ưu tiên — đó là feature line được vẽ ở trên.
```
packages/ui/src/            THE VOCABULARY - knows no feature
    contracts/                  the entry table and the slot types
    leaves/<Name>/
    composites/<Name>/
    branches/<Name>/
    shells/<Name>/

apps/<app>/src/             THE SENTENCES - each knows its own domain
    app/                        routes only
    components/
        blocks/<category>/<Name>/
        overlays/<category>/<Name>/
        layouts/<Name>/
        pages/<Name>/
```
**Mọi thứ bên dưới một khối đều được chia sẻ; một khối và mọi thứ phía trên nó thì không.** Một chiếc lá, một tổ hợp,
một nhánh và bảng hợp đồng mô tả SHAPE và một hình dạng có hình dạng giống nhau trong mọi ứng dụng - nghĩa là
tại sao một bản sao có thể tồn tại và tại sao nó phải tồn tại. Một khối là một câu miền: nó biết một khóa học, một
hóa đơn hoặc nguồn lực nhóm là. Đặt một cái vào gói chia sẻ và gói đó bây giờ đã biết một tính năng
không cần phải biết kinh doanh và ứng dụng tiếp theo sẽ kế thừa từ vựng mà nó sẽ không bao giờ sử dụng.

Bài kiểm tra là cùng một câu hỏi mà các câu trả lời của cấp độ, được hỏi về không gian làm việc: **ứng dụng thứ hai có muốn không
điều này mà không muốn có tính năng mà nó được viết ra?** A`Badge`Đúng. MỘT`FleetRow`KHÔNG.

Không có gì khác di chuyển. Các tầng giữ nguyên tên của chúng, quy tắc phẳng hoặc phân loại và hai tệp của chúng
hình dạng; monorepo chỉ quyết định phía nào của dòng tính năng mà mỗi tầng tồn tại. Một ứng cử viên dưới`.artifacts/**/candidate/`có thể phản ánh bố cục và lint đọc bất cứ thứ gì nó tìm thấy.

Các đích đến mà tên quy tắc được tạo trong lần sử dụng đầu tiên thay vì để trống: một người trợ giúp thuần túy sẽ đi tới`modules/utils/`, một hình dạng được chia sẻ để`modules/types/`, bản đồ cấu hình hoặc bản sao chưa được dịch sang`resources/`. Việc một thư mục chưa tồn tại không phải là lý do để để lại một tệp trong thành phần
cây.

## Quy tắc

**FILE-1 · Một thành phần, một thư mục và thư mục được đặt tên theo nội dung nó xuất.**

Tên thư mục là tên của thành phần. Một người đọc biết tên sẽ biết đường dẫn và grep cho
cái tên tìm thấy một nơi. Quy tắc giữ điều này chỉ yêu cầu xuất khẩu có tên trực tiếp có tên
thuộc về họ thư mục, do đó một thành phần và các biến thể được gõ của nó có thể chia sẻ một thư mục trong khi một
hành khách không liên quan không thể.

**FILE-2 · Một thư mục màn hình chứa hai nửa của nó và không có gì khác.**

Một trang, một bố cục hoặc một thư mục lớp phủ chứa`index.tsx`Và`component.tsx`- hệ thống dây điện và
hình dạng - cộng với bài kiểm tra song sinh của mỗi loại. Điều thứ ba xuất hiện đó là thông báo rằng có điều gì đó
có thể tái sử dụng được phát minh ở một nơi mà không ai khác có thể tìm thấy.

Điều này luôn bắt đầu một cách vô hại: "chỉ trang này sử dụng nó". Nó kết thúc dưới dạng một thư mục màn hình chứa bốn
các thành phần, một thư mục hằng, một thư mục utils và ba hình dạng còn lại được sao chép bằng tay, tại thời điểm đó
màn hình là một cơ sở mã thứ hai với vốn từ vựng riêng của nó.

**FILE-3 · Những gì không phải là mã component không nằm trong cây component.** `constants/`, `utils/`, `types/` và `hooks/` không phải là thư mục component. Mỗi loại có một nơi phù hợp, và
ngôi nhà là điểm: bên cạnh thành phần, người trợ giúp sẽ vô hình đối với tất cả những người sẽ
đã sử dụng lại nên tác giả thứ hai viết lại và cả hai trôi dạt.

**FILE-4 · Một thư mục export một family, không bao giờ là runtime namespace object.** `export const Card = { Root, Header }` gói tại thời điểm build thành một đơn vị, vì vậy import một member
kéo cả nhà vào, không gì có thể lay chuyển được. Xuất khẩu các thành viên. Một cuộc gọi chấm
trang web là một sự tiện lợi mà người đóng gói trả tiền.

**FILE-5 · Trong monorepo, shared package dừng bên dưới block.** `packages/ui/src/` chứa `contracts/`, `leaves/`, `composites/`, `branches/` và `shells/` — các
các tầng không biết tính năng.`blocks/`, `overlays/`, `layouts/`Và`pages/`thuộc về ứng dụng đó
sở hữu tính năng mà họ nói đến.

Một khối trong gói chia sẻ là toàn bộ lỗi trong một tệp: gói hiện đã biết tên miền,
các ứng dụng không bao giờ muốn miền đó vẫn gửi miền đó và tác giả tiếp theo kết luận dòng này một cách hợp lý
ở một nơi khác và cũng đặt một trang ở đó.

**FILE-6 · Tệp tuyến đường được gắn kết và không có gì khác, và`app/`không chứa gì ngoài các tập tin lộ trình.**

Một tập tin dưới`app/`đặt tên trang nào hiển thị tại URL nào. Không lấy, không sắp xếp, không có hợp đồng
chìa khóa. Nếu tệp tuyến đường đang được vẽ thì trang cần tải lên chưa tồn tại - và bản vẽ
bây giờ đang ở một nơi không ai tìm kiếm nó.

Cây định tuyến giữ các vị trí riêng của khung —`page`, `layout`, `template`, `loading`, `error`,
`not-found`, `default`, `route`và anh chị em của họ - cộng thêm`providers`Và`globals.css`, mà
gắn kết bố cục gốc và không có nơi nào khác.`app/api/**`là mã máy chủ và`_folders`là lựa chọn không tham gia của riêng Next; cũng không phải là một màn hình. **Bất kỳ tệp nào khác đều có thành phần trong đó
thư mục không ai grep.** Một màn hình chuyển đến`components/pages/<Name>/`, một câu tên miền để`components/blocks/<category>/<Name>/`.

Câu thứ hai đó không phải lúc nào cũng được viết ra và cái giá phải trả cho việc để nó ngầm được ghi lại:
một chủ sở hữu trang đã được viết thư cho`app/<segment>/fleet-page.tsx`và mang một dáng người, một đường chạy, một
kiểm tra đánh máy, bốn ảnh chụp màn hình được niêm phong và phê duyệt ở phần cuối của bản viết sản xuất với mỗi cổng
màu xanh lá cây - bởi vì mọi cổng đều đọc quy tắc, và cổng này chỉ là văn xuôi.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Tệp thứ ba trong thư mục trang, bố cục hoặc lớp phủ | Một thứ có thể tái sử dụng được phát minh ở nơi không ai có thể tìm thấy | Một thành phần của riêng nó đi tới`blocks/<category>/`, tìm nạp tới`hooks/`, một người trợ giúp thuần túy để`modules/utils/` |
| `constants/`, `utils/`, `types/`, `hooks/`dưới`components/`| Nó không phải là mã thành phần nên thư mục bị gắn nhãn sai và nội dung không hiển thị | Di chuyển nó đến cây đặt tên cho nó là gì |
| Một thư mục danh mục bên dưới`leaves/`hoặc`branches/`| Các cấp đó không biết tính năng nên bất kỳ danh mục nào cũng có thể đoán xem màn hình nào sở hữu chúng | Giữ chúng phẳng |
| Một căn hộ`blocks/<Name>/`không có danh mục | Một thành phần miền không có tính năng sẽ không được người tiếp theo làm việc trên tính năng đó tìm thấy ở đâu | Đặt nó dưới tính năng mà nó đại diện |
|`blocks/`, `overlays/`, `layouts/`hoặc`pages/`bên trong một gói chia sẻ | Gói này sẽ tìm hiểu một tính năng và mọi ứng dụng không bao giờ muốn nó đều sẽ gửi nó | Di chuyển nó đến`apps/<app>/src/components/`|
| Một lá, tổ hợp, nhánh hoặc hợp đồng bên trong một ứng dụng của monorepo | Ứng dụng thứ hai viết lại và cả hai đều không có gì đáng chú ý | Di chuyển nó đến`packages/ui/src/`|
| Một thư mục xuất ra không khớp với tên của nó | Đường dẫn ngừng dự đoán tên và grep không tìm thấy gì | Đổi tên một trong số họ để cả hai đồng ý |
|`export const X = { A, B }`như một không gian tên | Nó tập hợp thành một đơn vị, vì vậy việc nhập một thành viên sẽ kéo theo tất cả chúng | Xuất trực tiếp các thành viên |
| Tìm nạp hoặc vẽ trong tệp lộ trình | Lộ trình trở thành trang thứ hai, trong tệp không ai nhìn vào | Gắn trang; chuyển công việc vào đó |
| Một tập tin thành phần được đặt tên bên dưới`app/`| Cây định tuyến được xử lý theo URL chứ không phải được duyệt theo cấp, vì vậy thành phần này không thể nhìn thấy đối với những người đang tìm kiếm anh chị em của nó |`components/pages/<Name>/`cho một màn hình,`components/blocks/<category>/<Name>/`cho một câu miền |

## Ví dụ

### Trường hợp thông thường — block nằm đúng feature

```
components/blocks/dashboard/DailyQuest/
    index.tsx           the wiring: the request, the situation, the words
    component.tsx       the shape
    component.test.tsx  the twin
```

```
components/pages/DashboardPage/
    index.tsx
    component.tsx
    DailyQuest.tsx      <- wrong: invented here, so the feature that needs it next cannot find it
    utils/format.ts     <- wrong: not component code at all
```
Chúng khác nhau ở một điều: liệu các bộ phận đó có tên bên ngoài màn hình mà lần đầu tiên cần đến chúng hay không.

### Bẫy category

```
components/leaves/Text/                     flat: a line of copy belongs to no feature
components/blocks/dashboard/StreakStrip/    grouped: a streak is a dashboard sentence
```

```
components/leaves/dashboard/Text/           wrong: this leaf is not the dashboard's
components/blocks/StreakStrip/              wrong: no feature, so nobody owns it
```
Chúng khác nhau ở một điều: cấp độ đó có biết một tính năng nào không.

### Bẫy namespace

```tsx
export const CardRoot = ({ contract, render }: CardRootProps) => /* ... */
export const CardHeader = ({ props }: CardHeaderProps) => /* ... */
```

```tsx
// Wrong: one runtime object, so a call site importing the header links the whole family and
// nothing can be dropped from the bundle.
export const Card = { Root: CardRoot, Header: CardHeader }
```
Chúng khác nhau ở một điều: liệu người đóng gói có thể phân biệt các thành viên hay không.

### Bẫy route

```tsx
// route: it says which page renders here.
const DashboardRoute = () => <DashboardPage />
export default DashboardRoute
```

```tsx
// Wrong: the route fetches and arranges, so there are now two pages and only one of them is
// where anybody would look.
export default function DashboardRoute() {
    const session = useSessionToken()
    return <Tree contract="nav-over-body-page"><ShellNav /><DashboardPage /></Tree>
}
```
Chúng khác nhau ở một điều: liệu tuyến đường có rút ra hay không.
