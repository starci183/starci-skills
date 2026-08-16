# mã thông báo

## Định nghĩa

Mã thông báo là thành viên của một tập hợp đóng. Không phải là một giá trị mà ai đó đồng ý ưa thích - một giá trị là
thứ duy nhất có thể gõ được, vì vậy màn hình ngoài thang đo không phải là màn hình không được đánh giá, mà là một màn hình
màn hình không biên dịch được.

Do đó, hầu hết luật này được nắm giữ bởi một loại và phần còn lại của nó tồn tại để bao trùm một nơi mà
loại không đạt được. Sự phân chia đó là toàn bộ hình dạng của tập tin này: **công đoàn bảo vệ bảng,
và các quy tắc bảo vệ thư mục mà liên minh không thể nhìn thấy.**

Điều giữ nguyên luật này là liên minh khép kín trong[`sources/fe/contracts.ts`](../../../sources/fe/contracts.ts)và, vì điều mà một công đoàn không thể nhìn thấy,[`sources/fe/tokens.mjs`](../../../sources/fe/tokens.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/contracts/index.ts` and `src/components/branches/Tree/index.tsx`.

## Quy mô, như thực tế

Sáu bậc cho đường nối giữa các vật và chúng không cách đều nhau:

| Rừng | Đọc dưới dạng |
|---|---|
| 4px |`gap-1`: hai dòng của MỘT danh tính — một cái tên trên tay cầm của nó, một con số trên từ gắn nhãn nó, một tiêu đề trên phụ đề bị tắt tiếng, một mức giá trên chú thích đủ tiêu chuẩn cho nó |
| 8px |`gap-2`: các thiết bị ngang hàng nhỏ gọn trong một cụm chức năng — biểu tượng và nhãn, tab ngang hàng, thẻ được nhóm hoặc đầu vào và hành động nội tuyến trực tiếp của nó |
| 12px |`gap-3`: các đơn vị cục bộ thuộc sở hữu của chủ sở hữu hoặc có thể đọc độc lập — nhãn vào thẻ/đầu vào, trường này sang trường khác, thẻ này đến chú thích, thanh công cụ cho nội dung được quản lý hoặc các nhóm không liên quan chia sẻ một hàng |
| 16px |`gap-4`: hai người tham gia, mỗi người đã là một cụm — một ngăn xếp trên ngăn xếp bên dưới nó, một cụm nhận dạng dựa trên dữ kiện theo sau ở cuối hàng của nó, một lời nhắc chống lại hành động trả lời nó hoặc các thẻ ngang hàng lặp lại trên một lưới |
| 24px | hai khối trên một trang |
| 32px | đường nối bố trí — một đường ray dựa vào cột bên cạnh nó |`gap-2`yêu cầu hai sự kiện cùng một lúc: các đồng nghiệp nằm ngang VÀ chúng tạo thành một cụm chức năng.
Không đạt một trong hai lần kiểm tra và đường may không bị hỏng`gap-3`. Các mã thông báo được chọn theo mối quan hệ và nhóm,
không bao giờ theo tên thành phần hoặc hướng:
một đầu vào và hành động trực tiếp của nó có thể sử dụng`gap-2`khi họ chia sẻ một điều khiển ngang, trong khi nhãn
ở trên đầu vào đó sử dụng`gap-3`. Các phần ngang là các nhóm ngữ nghĩa riêng biệt cũng sử dụng`gap-3`.
Trình tự thời gian cấp dữ liệu tinh tế có thể sử dụng`gap-2`giữa nhãn ngày và thẻ kết quả, nhưng thanh công cụ phía trên
niên đại đó sử dụng`gap-3`. `gap-4`được lựa chọn theo cùng một cách và bởi riêng những người tham gia: một lần
mỗi bên được cấu tạo riêng, đường nối giữa chúng xếp hạng cao hơn các đường nối bên trong chúng, theo một cột, một
hàng và lưới giống nhau. **không có bậc 0**, và sự vắng mặt của nó là có chủ ý: "chạm vào" và
"gần như chạm vào" không phải là sự khác biệt mà tác giả thứ hai tái tạo từ trí nhớ, vì vậy bề nổi của điều này
thay thế đã kết thúc việc đánh vần một ngăn xếp danh tính theo cả hai cách. Chỉ có bậc thang 4px còn sót lại và nó
tồn tại vì nó đặt tên cho mối quan hệ chứ không phải số tiền - dòng thứ hai mô tả
đầu tiên. Một vùng chứa không có đường nối nào sẽ tuyên bố không có lớp khoảng trống, đây là một tuyên bố khác
từ việc đặt tên cho một bậc thang không đo lường được gì.

Các hình nhỏ có kích thước đối xứng 16px và 24px hoặc không đối xứng 12/8 và 16/12. Và mối quan hệ đó tạo nên
một bề mặt xa lạ có thể quyết định được hiển thị trong bảng thay vì được khẳng định trên nó: **ngôi nhà
bề mặt mang một hình nhỏ 16px xung quanh đường nối bên trong 16px.** Cạnh thở theo nhịp điệu của
nội dung, nên hai là một quyết định chứ không phải hai.

Do đó, Thẻ thông thường sẽ sử dụng`p-4`. Thẻ danh sách đã tham gia giữ nguyên cạnh ngoài 16px đó
mà không cần chèn các dải phân cách: cả Thẻ nhà cung cấp và máy chủ nội dung đều`p-0`, danh sách gốc là`p-0`;
một hàng duy nhất là`p-4`; đầu tiên/giữa/cuối cùng
các hàng tương ứng`px-4 pt-4 pb-3`, `px-4 py-3`, Và`px-4 pt-3 pb-4`.
Khi mã thông báo Thẻ chung được thực thi bằng`!important`, danh sách gốc đã tham gia sử dụng một ngữ nghĩa`data-component`bộ chọn ở cường độ bằng nhau. Sự hiện diện của tiện ích là không đủ; phần đệm được tính toán
trên trang tài khoản thử nghiệm được hiển thị phải`0px`.

Các nút có hai mã thông báo chiều cao, được chọn theo vị trí thay vì tầm quan trọng:

| Mã thông báo | Vị trí |
|---|---|
|`sm`| Hành động được nhúng bên trong một hàng, mục danh sách, thanh công cụ thu gọn, cụm thẻ hoặc đường nối cục bộ của điều khiển khác; phản ứng trong một hàng hoạt động thuộc về đây |
|`md`| Hành động độc lập sở hữu một đường hoặc neo một biểu mẫu hoặc bề mặt |

các`variant`trục vẫn độc lập: nó cho biết một hành động là chính, phụ, phác thảo,
hoặc đại học; nó không chọn chiều cao. Hành động chính có thể là`sm`trong một cụm nhỏ gọn và một
hành động cấp ba có thể là`md`khi nó đứng một mình. Độ dài nhãn không bao giờ thay đổi mã thông báo kích thước.

## Quy tắc

**TOKEN-1 · Từ vựng là một sự kết hợp, vì vậy giá trị ngoài thang đo là không thể biểu thị được.**`gap-[13px]`không bị cấm - nó không phải là thành viên. Tài sản duy nhất đó loại bỏ cả một gia đình
quy tắc tuần tra: cảnh sát không có quyền gì một khi không thể gõ giá trị sai và không có gì để tranh cãi
khoảng một lần trình biên dịch đã từ chối.

**TOKEN-2 · Thành viên mới là một bản chỉnh sửa theo thang đo và được đọc là một.**

Phát triển công đoàn là một quyết định về nhịp điệu ngôi nhà, được thực hiện một cách có chủ ý, trong một danh sách được đặt tên trong đó
sự khác biệt cho thấy nó. Điều đó trái ngược với giá trị đến bên trong một thành phần chưa được ai xem xét
chặt chẽ hơn, đó là cách thang đo đạt được bậc thứ sáu mà chỉ một màn hình sử dụng.

**TOKEN-3 · Bước phân số không bao giờ có trên thang đo.**

Các bậc là toàn bộ bậc và cách đều nhau, nên nửa cung không phải là "giữa hai bậc" — nó bị tắt
thang hoàn toàn và nó sẽ không khớp với bất kỳ thứ gì khác trên bất kỳ màn hình nào. Điều này chính xác hơn là một
vấn đề sở thích: không có trường hợp nào câu trả lời đúng là nửa bậc.

**TOKEN-4 · Một giá trị tùy ý thoát khỏi hệ thống, bất kể nó ước tính là gì.**

Độ dài trong ngoặc hoặc màu thô là giá trị được một người chọn một lần cho một màn hình. Ngay cả khi
nó tình cờ là một bậc thang, bất kỳ ai tìm kiếm trên cân đều không thể tìm thấy nó và nó không di chuyển
khi cân di chuyển.

**TOKEN-5 · Xếp hạng đến từ thang loại, không bao giờ đến từ sự kết hợp được cuộn bằng tay.**

Văn bản lớn cộng với trọng lượng nặng LÀ một tiêu đề, bất kể yếu tố nào mang nó. Được lắp ráp từ các lớp thô
đó là một tiêu đề mà không ai khác biết đến: bản phác thảo mà trình đọc màn hình xây dựng không bao gồm nó và
ngày quy mô loại thay đổi nó vẫn ở phía sau. Các tiêu đề đến từ một thành phần sở hữu cả hai
sự thật cùng một lúc.

**TOKEN-6 · Các quy tắc tồn tại đối với thư mục mà liên minh không thể xem.**

Mỗi tầng phía trên các lá lấy các lớp của nó từ một mục nhập và mục nhập đó được nhập - vì vậy liên kết
đã nắm giữ chúng rồi. Thư mục lá viết các lớp riêng của nó và được miễn các quy tắc đầu vào bởi
chính sách, điều này làm cho nó trở thành nơi duy nhất mà giá trị ngoài quy mô vẫn có thể được nhập. Đó là những gì các quy tắc này
tuần tra và đó là lý do tại sao họ đọc các chuỗi lớp trong nguồn thay vì chỉ các mục nhập.

Họ cũng đọc một chuỗi lớp được đưa vào một hằng số mô-đun, bởi vì hoisting là nơi cuối cùng
giá trị ngoài quy mô trong cơ sở mã này tồn tại trong mọi quy tắc tồn tại.

**TOKEN-7 · Màu ngữ nghĩa được ghép nối bởi bề mặt mang nó.**

Một từ thành công đơn giản hoặc sử dụng glyph`text-success`. Một cặp đĩa thành công mềm mại`bg-success-soft`với`text-success-soft-foreground`; một cặp đĩa thành công vững chắc`bg-success`với`text-success-foreground`. Cảnh báo và nguy hiểm có ba vai trò giống nhau. Mã thông báo nền
không phải là mã thông báo tiền cảnh: sử dụng`text-success-soft`trên séc trần nhầm lẫn màu tấm với
mực được thiết kế để đặt trên đó và phá vỡ sự tương phản giữa các chủ đề.

**TOKEN-8 · Kích thước nút tùy theo vị trí, trong khi biến thể theo mức độ ưu tiên.**

Một hành động được nhúng sử dụng`sm`; một hành động độc lập sở hữu một dòng sử dụng`md`. Đây là những thứ duy nhất
kích thước nút vì mỗi tên đặt tên cho một mối quan hệ có thể lặp lại. Suy ra chiều cao từ sơ cấp so với
cấp ba, từ số lượng từ hoặc từ mức độ trực quan của điều khiển, kết hợp độc lập
các trục và thực hiện cùng một vai trò thay đổi hình học giữa các màn hình.

**TOKEN-9 · Lớp đặt tên cho mã thông báo không có ý nghĩa gì cho đến khi chủ đề xác định nó.**`max-w-app-lg`không phải là chiều rộng. Đó là một YÊU CẦU cho`--container-app-lg`và khi biến đó thực hiện
không tồn tại, lớp vẫn được phát ra, phần tử vẫn hiển thị và không có gì chuyển sang màu đỏ -
liên kết thừa nhận tên, trình biên dịch hài lòng với liên kết và trang âm thầm mất đi
đo lường.

Đây là một giá trị chết mà một liên minh đóng không thể nắm bắt được và nó còn tệ hơn một giá trị ngoài quy mô cho
chính xác đó là lý do: một giá trị ngoài quy mô không thể biên dịch được, trong khi giá trị này vượt qua mọi cổng và tàu.
Một kho lưu trữ đã có thành viên như vậy đủ lâu để viết bình luận về nó bên cạnh thành viên khác
nhập thay vì xóa nó.

Vì vậy, hai nửa được kiểm tra cùng nhau: tên là thành viên của liên minh VÀ biến mà nó yêu cầu
for được xác định trong biểu định kiểu. Tên Tailwind tự giải quyết —`screen`, `full`, `fit`, cái
đơn vị khung nhìn - không hứa hẹn gì về chủ đề và không phải là vấn đề của quy tắc này; một quy tắc đó
báo cáo rằng họ sẽ gửi một tác giả để xác định một biến không có gì đọc được.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một lớp học ngoài đoàn | Nó không phải là thành viên; loại là thang đo | Thêm thành viên một cách có chủ ý hoặc sử dụng bậc thang gần nhất |
| Một bước phân đoạn | Không phải giữa các bậc thang — ngoài thang, không khớp với bất kỳ màn hình nào | Bậc thang gần nhất |
| Chiều dài trong ngoặc hoặc màu thô | Được chọn một lần cho một màn hình, không ai có thể tìm thấy và nó không di chuyển khi tỷ lệ | Một thành viên hoặc mã thông báo ngữ nghĩa |
| Một chữ số 0 được viết | Số 0 là một bước khỏi thang chứ không phải là bước cuối cùng và việc đặt tên cho nó ngụ ý một bậc thang bên dưới | Tuyên bố không có lớp khoảng cách nào cả |
| Nấc thang nhỏ gọn giữa hai dòng của một bản sắc |`gap-2`tách biệt hai sự thật; một dòng đủ điều kiện không phải là sự thật thứ hai |`gap-1`|
| Văn bản lớn cộng với trọng lượng nặng được lắp ráp bằng tay | Đó là một tiêu đề mà đường viền không chứa và nó vẫn ở phía sau khi thang đo di chuyển | Thành phần sở hữu cả hai sự kiện |
| Bậc thứ sáu vì màn hình nhìn hơi sai | Thang đo sau đó mô tả các màn hình thay vì các mối quan hệ | Hỏi mức độ phân nhóm của đường may |
| Một giá trị ngoài quy mô được nâng lên thành hằng số | Nhấc nó ra khỏi đánh dấu sẽ ẩn nó đi; nó không cấp phép cho nó | Bậc thang gần nhất |
| MỘT`*-soft`mã thông báo nền được sử dụng làm màu văn bản | Vai trò của mảng và tiền cảnh là khác nhau và có nhiệm vụ tương phản khác nhau | trần`text-*`, hoặc cặp`bg-*-soft`với`text-*-soft-foreground`|
| Kích thước nút được suy ra từ biến thể | Mức độ ưu tiên trực quan không cho biết hành động được nhúng hay độc lập | Chọn biến thể theo mức độ ưu tiên và kích thước từ vị trí |
| Phần đệm tùy chỉnh được sử dụng để thu nhỏ nút | Nó tạo ra chiều cao điều khiển cục bộ thứ ba bên ngoài tập đóng | Sử dụng`sm`cho một hành động được nhúng |

## Ví dụ

### Type làm phần việc của nó

```ts
classes: ["flex", "flex-col", "gap-4"]
```

```ts
classes: ["flex", "flex-col", "gap-[15px]"]
```
Chúng khác nhau ở một điều: liệu cái thứ hai có biên dịch hay không. Không phải vậy - đó là lý do tại sao không cần có quy tắc nào
để có ý kiến về nó.

### Inset tương ứng

```ts
// the content node the house surface holds: a 16px edge around a 16px interior seam, so the
// edge breathes at the rhythm of what it holds
classes: ["flex", "flex-col", "gap-4", "p-4"]
```

```ts
// the same node with a tighter edge than its contents: every individual value is on the
// scale, and it still reads as crowded
classes: ["flex", "flex-col", "gap-4", "px-3", "py-2"]
```
Chúng khác nhau ở một điều: cạnh và bên trong có thống nhất hay không. Không có giá trị duy nhất là sai. các
mặt đất, bán kính và độ cao đều không xuất hiện, bởi vì nhánh bề mặt thu hút chúng và một
mục nhập chỉ sắp xếp những gì đứng bên trong — xem CONTRACT-12 trong [`contract.md`](contract.md).

### Leaf, nơi rule phát huy tác dụng

```tsx
// inside the one folder that writes its own classes: on the scale
const GLUE = "inline-flex items-center gap-2"
```

```tsx
// the same folder, half a rung: off the ladder, and the entry rules do not look here
const GLUE = "inline-flex items-center gap-1.5"
```
Chúng khác nhau ở một điều: liệu giá trị có tồn tại ở bất kỳ nơi nào khác trong sản phẩm hay không.

### Heading tự lắp ghép

```tsx
<Heading props={{ content: title, level: 2 }} />
```

```tsx
<span className="text-2xl font-bold">{title}</span>
```
Chúng khác nhau ở một điểm: dàn bài của trình đọc màn hình có chứa tiêu đề hay không.

### Action được nhúng

```tsx
<Button props={{ label: reactionLabel, variant: "ghost", size: "sm" }} />
```

```tsx
<Button props={{ label: reactionLabel, variant: "ghost", size: "md" }} />
```
Chúng khác nhau ở một điểm: liệu một hành động được nhúng trong hàng nguồn cấp dữ liệu có sử dụng mã thông báo vị trí thu gọn hay không.

### Priority không phải size

```tsx
<Button props={{ label: submitLabel, variant: "primary", size: "md" }} />
```

```tsx
<Button props={{ label: submitLabel, variant: "primary", size: "sm" }} />
```
Chúng khác nhau ở một điểm: liệu neo biểu mẫu độc lập có sử dụng mã thông báo vị trí nghỉ hay không; cả hai
vẫn là chính.
