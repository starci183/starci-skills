# cột mốc

## Định nghĩa

Cột mốc là tập hợp nhỏ các phần tử mà người đọc có thể nhảy GIỮA mà không cần đọc nội dung bên trong
họ -`main`, `nav`, `aside`, `header`, `footer`. Chúng không phải là hình dạng. MỘT`div`và một`main`bố trí
giống hệt nhau và một trong số đó là lý do tồn tại "chuyển đến nội dung chính".

Luật này tồn tại vì cơ quan đăng ký dễ mắc lỗi. Một khóa có tên`dashboard-main`ghi lại ý định một cách hoàn hảo và hiển thị`div`, bởi vì nhánh vẽ các nút đăng ký sẽ vẽ
div. Không có gì chuyển sang màu đỏ: **tên trong khóa không phải là thành phần trong tài liệu.** Toàn bộ ứng dụng
được vận chuyển theo cách đó - mọi khu vực đều được đặt tên chính xác, không có một mốc nào trong DOM và không có cổng nào có
bất cứ điều gì để nói về nó.

Điều giữ luật này là[`sources/fe/landmark.mjs`](../../../sources/fe/landmark.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/branches/Main/index.tsx` and `src/app/dashboard/layout.tsx`.

## Quy tắc

**LANDMARK-1 · Một nhánh cho mỗi phần tử mốc.**`Tree`vẽ một`div`. Một địa danh có chi nhánh riêng —`Main`Hôm nay,`Nav`Và`Aside`khi một màn hình
cần chúng - giống hệt với`Tree`ở mọi khía cạnh ngoại trừ phần tử nó mở ra. Thêm một cái là một
thay đổi một tập tin, đó là nguyên nhân khiến giải pháp thay thế không thể giành chiến thắng do rẻ hơn.

**LANDMARK-2 · Chi nhánh không có lớp, giống hệt`Tree`.**

Khóa đăng ký cung cấp các lớp, những đứa trẻ mà nó thừa nhận và lý do chúng ngồi như vậy. các
nhánh cung cấp phần tử. Đó là toàn bộ sự khác biệt giữa hai điều này và đó là lý do tại sao một cột mốc
chi nhánh không thể trở thành cơ quan đăng ký thứ hai.

**LANDMARK-3 · Không phải chỗ dựa trên`Tree`.**

`<Tree as="main">`đặt cột mốc vào tay người gọi, bên cạnh các quyết định về kiểu dáng và
Màn hình đầu tiên cần quên đó là màn hình mà không ai có thể bỏ qua. Một yếu tố làm thay đổi những gì
tài liệu MEANS không phải là một biến thể của một tài liệu không có.

**LANDMARK-4 · Trang được định tuyến được đánh dấu bằng bố cục tạo nên chrome của nó.**

Bố cục hiển thị một`Tree`xung quanh những đứa trẻ được định tuyến là tập tin biết điều hướng ở đâu
kết thúc và trang bắt đầu, vì vậy nó bao bọc những đứa trẻ đó trong`Main`. Hai bố cục không đủ điều kiện và
không được yêu cầu: bố cục ROOT vẽ`html`Và`body`và các nhà cung cấp dịch vụ gắn kết cũng như bố cục TRUYỀN THÔNG
đại biểu cho người khác sở hữu chrome. Yêu cầu một trong hai sẽ mất một giây`main`trong
tài liệu.

**LANDMARK-5 · Một`main`cho mỗi tài liệu và nó thuộc về người sở hữu toàn bộ màn hình.**

Một giây`main`không phải là một điểm mốc mạnh hơn, nó là một điểm không rõ ràng. Vì vậy mốc bị từ chối
ở mọi nơi ngoại trừ các tệp sở hữu toàn bộ màn hình: tệp lộ trình - nó`layout.tsx`, hoặc nó`page.tsx`— và chính bề mặt trang,`components/pages/<Name>/{index,component}.tsx`. Mỗi
tầng bên dưới vẽ một PHẦN của màn hình và một cột mốc được thêm vào sẽ có cột thứ hai.

**Hai hình dạng được giữ thành các bộ khác nhau và việc thu gọn chúng thực sự là một khiếm khuyết.** Cột mốc
BRANCH là một thành phần mà ai đó nhập vào để bao bọc màn hình; nó vẫn nằm trong các tập tin lộ trình, bởi vì một
trang đạt được nó chính là cái bẫy mà luật này được viết ra. Một khung có MỤC NHẬP HỢP ĐỒNG khai báo`host: "main"`không phải vậy - không ai nhập một mốc, cơ quan đăng ký cho biết khóa của phần tử nào
nút mở ra và khung tuân theo. Mục nhập đó được hiển thị bởi bất kỳ ai hiển thị phần ngoài cùng của màn hình
nút và[FILE-6](file-layout.md)nói rằng tập tin tuyến đường rõ ràng không phải là nó: một tuyến đường gắn kết một
trang và không vẽ gì cả.

Được tổ chức chỉ để định tuyến các tập tin, hai luật đã từ chối lẫn nhau. Mỗi trang được chuyển ra khỏi`app/`để thỏa mãn
FILE-6 đã được báo cáo vì đặt sai vị trí mốc của nó và cách duy nhất để đáp ứng cả hai cùng một lúc là
để chủ sở hữu trang trong cây định tuyến - lỗi chính xác FILE-6 tồn tại để ngăn chặn. Một quy luật mà
chỉ có thể hài lòng bằng cách phá vỡ một quy tắc khác là phát hiện về quy tắc đó.

Sự từ chối đó chính là nguyên nhân giải quyết cái bẫy mà luật này được viết ra nhằm mục đích: các khóa đăng ký có tên`dashboard-main`,
`profile-main`Và`explore-main`đang đọc các CỘT bên trong một trang và vẽ bất kỳ cột nào trong số đó bằng
nhánh mốc sẽ yêu cầu mốc ba lần trên một màn hình. Mục nhập của khóa như vậy không được
tuyên bố`host: "main"`- tên là tên, và chủ nhà là lời hứa.

**Điều luật này KHÔNG áp dụng.** Quy tắc tệp tại một thời điểm không thể thấy bố cục và trang bên dưới nó
cả hai đều mở ra một cột mốc. Các quy tắc thu hẹp nơi định tuyến tệp và từ chối mọi cấp độ bên dưới, điều này
sai lầm thực sự xảy ra ở đâu; trường hợp còn lại là câu hỏi ôn tập. Nói như vậy là rẻ hơn
hơn là một cánh cổng ngụ ý một sự đảm bảo mà nó không có.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một bản viết tay`<main>`| Nó không mang chìa khóa nên không có gì ghi lại các lớp, con của nó hoặc lý do nó tồn tại |`Main`bằng khóa đăng ký |
|`as` / `element`chống đỡ`Tree`| Ý nghĩa của tài liệu trở thành sự lựa chọn kiểu dáng cho trang web cuộc gọi | Một nhánh cho mỗi phần tử mốc |
| Một nhánh mốc bên trong một trang hoặc khối | Tài liệu có được một giây`main`và cột mốc không còn ý nghĩa gì nữa | Để nó theo cách bố trí tuyến đường |
| Điều trị một`*-main`chìa khóa làm cột mốc | Các phím đó đang đọc cột; ba người trong số họ sẽ yêu cầu một cột mốc |`Tree`cho cột,`Main`cho trang |
| Một lớp học trên nhánh mốc | Chi nhánh trở thành cơ quan đăng ký thứ hai không có`why`| Đặt nó vào chìa khóa |

## Ví dụ

### Trường hợp thông thường — layout đánh dấu trang

```tsx
// layout: navigation is a sibling of the routed page, and the page is the landmark.
<Tree
    contract="nav-over-body-page"
    render={defineContractComponent("nav-over-body-page", {
        navigation: defineContractProjection("double-navbar", () => <ShellNav />),
        body: defineContractProjection("routed-page-main", () => (
            <Main
                contract="routed-page-main"
                render={defineContractComponent("routed-page-main", {
                    page: defineLeafComponent("page", {}, () => children),
                })}
            />
        )),
    })}
/>
```

```tsx
// Wrong: the key says "main" and the DOM says "div". The intent is recorded and unreachable.
body: defineLeafComponent("page", {}, () => children),
```
Chúng khác nhau ở một điều: liệu người đọc có thể bỏ qua điều hướng để đến trang hay không.

### Cái bẫy mà luật này được viết ra để ngăn chặn

```tsx
// Wrong: `dashboard-main` is the reading column beside the rail, not the page. Drawn with the
// landmark branch it becomes a second `main` under the one the layout already opened.
<Main contract="dashboard-main" render={...} />
```

```tsx
// Right: the column is a shape, so it stays a Tree. The landmark was claimed one level up.
<Tree contract="dashboard-main" render={...} />
```
Chúng khác nhau ở một điều: tài liệu có một hay nhiều mốc.
