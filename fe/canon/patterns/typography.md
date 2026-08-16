# kiểu chữ

## Định nghĩa

Loại mang cấp bậc. Một đường lớn bao nhiêu, nặng bao nhiêu và lấy màu gì không phải là bốn điều độc lập
các lựa chọn — họ cùng nhau cho biết điều gì trên màn hình là quan trọng nhất và người đọc
quyết định nơi cần tìm trước khi đọc một từ.

Vì vậy, quy mô nhỏ và các bước được ghép nối chứ không phải miễn phí. Tiêu đề không phải là kích thước và
trọng lượng được chọn cùng nhau; đó là CẤP ĐỘ và cấp độ quyết định cả hai.

Điều giữ luật này là[`sources/fe/typography.mjs`](../../../sources/fe/typography.mjs), cộng với
công đoàn khép kín trên hai thành phần sở hữu kiểu đó.

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Text/index.tsx` and `src/components/leaves/Heading/index.tsx`.

## Quy mô, như thực tế

Tiêu đề có bốn cấp độ và mỗi cấp độ cố định một kích thước và trọng lượng cùng một lúc:

| Cấp độ | Kích thước | Cân nặng |
|---|---|---|
| 1 | 20px | nửa đậm |
| 2 | 16px | nửa đậm |
| 3 | 14px | trung bình |
| 4 | 12px | trung bình |

Văn bản nội dung sử dụng 14px và 16px. Bước chú thích 12px bị hạn chế thứ ba chỉ tồn tại cho bản sao hỗ trợ
bên dưới hoặc bên cạnh đường chính hoặc bề mặt được nối; nó không phải là một kích thước cơ thể có mục đích chung khác.
Vì bước đó vốn đã có nghĩa là “hỗ trợ” nên mọi`text-xs`bị tắt tiếng. Kích thước và giai điệu là một cấp bậc
ở đây: không có ngoại lệ 12px có tông màu mặc định hoặc màu nền trước. Cân có ba quả cân
và hai âm báo, đồng thời người gọi không tạo ra các bước tiếp theo từ các pixel lân cận.

Hãy lưu ý điều mà bảng tiêu đề KHÔNG làm: nó không bao giờ kết hợp kích thước lớn với trọng lượng nặng nhất. Xếp hạng
đến từ BƯỚC, không phải từ việc hét to một dòng như hệ thống loại cho phép.

### Bảng quyết định tiêu đề nội dung

| Vai trò nội dung | Thành phần | Kích thước | Cân nặng | Điều kiện |
|---|---|---|---|---|
| Tiêu đề trang hoặc phần |`Heading`| Cấp độ sở hữu | Cấp độ sở hữu | Có cấp bậc phác thảo; đừng giả mạo tiêu đề với nội dung`Text`|
| Tiêu đề nổi bật của một đồ vật/thẻ lớn hoặc quan trọng |`Text` | `text-base`| trung bình | Ngắn gọn, nổi bật và tiêu biểu cho đối tượng quan trọng; di chuột là tùy chọn và không phải là tiêu chí |
| Tiêu đề nhỏ gọn, lặp lại hoặc dài |`Text` | `text-sm`| trung bình | DailyStats, hàng, đàn accordion, danh sách dày đặc và tiêu đề dài hoặc lặp lại |
| Nội dung, mô tả, siêu dữ liệu hoặc giá trị thông thường |`Text` | `text-sm`| bình thường | Nội dung liên tục; một giá trị số không tự thăng hạng |
| Nhãn ngang hàng nhỏ gọn cần sự khác biệt |`Text` | `text-sm`| trung bình | Trọng lượng tạo nên thứ bậc; giá trị ngang hàng vẫn còn`text-sm`bình thường hoặc tắt tiếng |
| Chú thích hỗ trợ |`Text` | `text-xs`| bình thường + tắt tiếng | Chỉ giải thích đường chính hoặc bề mặt |

## Quy tắc

**TYPESET-1 · Tiêu đề là một cấp độ và cấp độ quyết định thẻ cũng như giao diện.**

Thẻ mà trình đọc màn hình xây dựng dàn ý tài liệu và kích thước mà trình đọc nhìn thấy là hai sự thật
về một điều. Được viết riêng biệt, chúng trôi dạt: văn bản lớn thứ ba trên màn hình sẽ trở thành văn bản đầu tiên
tiêu đề, và dàn ý ngừng mô tả trang. Một chỗ dựa quyết định cả hai, vì vậy họ không thể không đồng ý.

**TYPESET-2 · Bốn cấp độ và cấp độ thứ năm có nghĩa là trang được lồng quá xa.**

Nếu một bề mặt cần một phần năm, câu trả lời không phải là một bước nhỏ hơn - đó là phần đó đã được lồng vào nhau.
xa hơn mức người đọc có thể nắm giữ. Đó là vấn đề về cấu trúc khi mặc quần áo về kiểu dáng.

**TYPESET-3 · Xếp hạng đến từ kích thước, trọng lượng và âm sắc. Không bao giờ từ hộp.**

Đường viền, nền hoặc con chip được vẽ xung quanh thứ bạn muốn chú ý là đồ trang sức không
tương ứng với thứ hạng, và một khi một bề mặt đã dạy cho người đọc rằng các hộp của nó chẳng có ý nghĩa gì, thì hộp đó
có nghĩa là một cái gì đó cũng vô hình.

**TYPESET-4 · Khi thứ gì đó đang tranh giành sự chú ý, hãy làm cho những thứ xung quanh nó im lặng.**

Nhấn mạnh là tương đối. Việc làm cho điều quan trọng trở nên to hơn sẽ nâng cao nền tảng cho mọi việc và
tác giả tiếp theo lại nêu lên. Hầu hết các vấn đề về thứ hạng đều được giải quyết sớm hơn một bước, bằng cách thực hiện mọi thứ
xung quanh mọi thứ yên tĩnh hơn.

**TYPESET-5 · Dòng phụ xếp bên dưới tiêu đề mà nó thuộc về.**

Một lông mày, một con số, một danh mục, một phần meta: nhỏ hơn và mờ hơn, không bao giờ lớn hơn hoặc nặng hơn. A
thẻ có thành phần ồn ào nhất là thẻ danh mục của nó là thẻ có tên không ai đọc và đó là
khiếm khuyết hơn là một sự nhấn mạnh thành công.

Chú thích bị tắt tiếng bên dưới phần chính`text-sm`do đó nhãn sử dụng dành riêng`text-xs`bước chân. Giai điệu
thôi thì chưa đủ: hai dòng có cùng kích thước vẫn có cùng thứ hạng ngay cả khi một dòng có màu xám.

**TYPESET-6 · Trọng lượng là trục nội dung-văn bản. Một tiêu đề không lấy một tiêu đề.**

Các tiêu đề đã có trọng lượng như một phần cấp độ của chúng. Đẩy cái khác lên một cái là yêu cầu hai hệ thống
quyết định điều tương tự, và người thua cuộc là người mà người đọc nhìn thấy thứ hai.

**TYPESET-7 · `text-xs` luôn có nghĩa là supporting copy muted.**

Bước nhỏ hơn không phải là phiên bản thu gọn của bản sao chính. Đó là sự thật bên phải bên cạnh một`text-sm`nhãn, thời gian tương đối chẳng hạn như "55 phút trước" hoặc chú thích bên dưới sự việc được giải thích.
Nếu các từ phải giữ tông màu nổi bật thì chúng đủ cơ bản để duy trì`text-sm`hoặc lớn hơn.
các`Text`lá mã hóa việc ghép nối này: chọn`size: "xs"`giải quyết và nhập âm báo bị tắt tiếng.

**TYPESET-8 · Điểm đánh dấu kết quả tạm thời là phụ đề bị tắt tiếng, không phải tiêu đề.**

Hôm nay, Hôm qua và các phân vùng theo giờ địa phương tương đương đủ điều kiện cho các kết quả được nối ngay bên dưới
họ. Chúng hiển thị bên ngoài bề mặt đó dưới dạng`text-sm`với giai điệu tắt tiếng. Họ vẫn còn`text-sm`bởi vì
họ đặt tên cho một phân vùng quét; chúng không phải là bản sao chú thích mang tính giải thích. Cung cấp cho họ một cấp độ tiêu đề hoặc
việc xử lý nhãn của`SurfaceListCard`quảng bá sai mỗi nhóm thời gian vào một phần trang.

**TYPESET-9 · Xếp hạng tiêu đề nội dung tuân theo quyền sở hữu nội dung, không di chuột, giá trị số hoặc không gian có sẵn.**`text-base font-medium`thuộc về một tiêu đề nổi trội ngắn đại diện cho một đối tượng quan trọng hoặc lớn
thẻ. Sử dụng tiêu đề nhỏ gọn, lặp đi lặp lại hoặc dài`text-sm font-medium`; mô tả, siêu dữ liệu của họ và
sử dụng giá trị thông thường`text-sm`ở cân nặng bình thường. Hiệu ứng di chuột có thể xác nhận rằng một bề mặt
tương tác, nhưng nó không thể quảng bá văn bản của nó. Một số có thể là một giá trị thông thường và khoảng trống còn lại là
không phải là một thứ hạng ngữ nghĩa.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Thẻ tiêu đề được viết bằng tay | Sau đó, đường viền và kích thước hiển thị được đặt riêng và chúng trôi | Thành phần tiêu đề, có cấp độ |
| Kích thước và trọng lượng được tập hợp thành một tiêu đề | Đó là một tiêu đề mà không ai khác biết đến: dàn ý không chứa nó | Tương tự |
| Cấp độ tiêu đề thứ năm | Phần này đã lồng nhau xa hơn mức mà người đọc có thể nắm giữ | Làm phẳng phần |
| Một hộp được vẽ để nhấn mạnh | Đồ trang sức không phù hợp với thứ hạng dạy người đọc bỏ qua các ô | Kích thước, trọng lượng, tông màu |
| Làm cho điều quan trọng trở nên to hơn | Nhấn mạnh là tương đối, vì vậy việc nâng cao nó sẽ nâng tầm cho mọi thứ | Làm yên tĩnh hàng xóm của nó |
| Một dòng phụ có cùng kích thước, lớn hơn hoặc nặng hơn tiêu đề của nó | Hai dòng yêu cầu thứ hạng bằng nhau hoặc tên thẻ không được đọc | Bước chú thích 12px bị hạn chế cộng với âm bị tắt tiếng |
| Một trọng lượng được đẩy lên một tiêu đề | Hai hệ thống quyết định một điều, người đọc thấy kẻ thua cuộc | Hãy để cấp độ quyết định |
|`text-xs`không bị tắt tiếng | Một đường kích thước hỗ trợ xác nhận màu chính và gửi hai tín hiệu xếp hạng trái ngược nhau | Đôi`text-xs`với`text-muted`, hoặc giữ bản sao chính tại`text-sm`|
| Lựa chọn`text-base`vì quân bài di chuyển nên có giá trị là số hoặc có phòng | Tương tác, kiểu dữ liệu và dung lượng trống không thiết lập thứ hạng nội dung | Sử dụng bảng quyết định tiêu đề nội dung và phân loại chủ sở hữu nội dung |

## Ví dụ

### Một prop, hai sự thật

```tsx
<Heading props={{ content: title, level: 2 }} />
```

```tsx
<h2 className="text-2xl font-bold">{title}</h2>
```
Chúng khác nhau ở một điểm: liệu phác thảo mà trình đọc màn hình xây dựng có khớp với những gì người đọc nhìn thấy hay không.

### Xếp hạng không cần trang trí

```tsx
<Text props={{ content: category, size: "sm", tone: "muted" }} />
<Heading props={{ content: name, level: 3 }} />
```

```tsx
<Badge props={{ label: category }} />
<Text props={{ content: name, size: "sm" }} />
```
Chúng khác nhau ở một điều: mắt nhìn vào đường nào đầu tiên - và đường thứ hai, đó là danh mục.

### Nhấn mạnh bằng cách giảm bớt

```tsx
// the row that matters keeps its default; the rows around it drop to muted
<Text props={{ content: value, weight: "semibold" }} />
<Text props={{ content: other, tone: "muted" }} />
```

```tsx
// every row climbs, and the next author climbs again
<Text props={{ content: value, size: "md", weight: "semibold" }} />
```
Chúng khác nhau ở một điều: liệu cái cân có còn chỗ trống phía trên nó hay không.

### Tiêu đề chủ đạo và tiêu đề lặp lại

```tsx
// One large card represents one important course object.
<Text props={{ content: courseName, size: "base", weight: "medium" }} />

// Repeated rows and long accordion labels remain compact.
<Text props={{ content: moduleName, size: "sm", weight: "medium" }} />
<Text props={{ content: moduleSummary, size: "sm" }} />
```

```tsx
// Wrong: hover and available room promote every repeated title.
<Text props={{ content: moduleName, size: "base", weight: "medium" }} />
```
Chúng khác nhau ở một điểm: kích thước tuân theo xếp hạng của chủ sở hữu nội dung hay cách trình bày ngẫu nhiên.
