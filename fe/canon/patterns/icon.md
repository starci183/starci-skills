# biểu tượng

## Định nghĩa

Biểu tượng là một sản phẩm khép kín có ý nghĩa được vẽ ra thông qua vốn từ vựng của Heroicons. Người gọi gọi tên gì
Ý NGHĨA của hình tượng và vai trò của nó; riêng chiếc lá biểu tượng đã chọn SVG cụ thể.

Câu hỏi phân loại vai trò của nó là: **là nó giới thiệu nội dung, dẫn dắt một điều khiển thông thường
hoặc hàng hay ngồi bên trong một con chip nhỏ gọn?** Biểu tượng tiêu đề không phải là biểu tượng hàng đầu được làm lớn hơn và
biểu tượng chip không phải là biểu tượng được làm nhỏ hơn. Heroicons là tác giả của các bản vẽ riêng cho những công việc đó.

Điều giữ luật này là[`sources/fe/icon.mjs`](../../../sources/fe/icon.mjs). TypeScript đóng
ý nghĩa và vai trò của đoàn thể; lint đóng hai loại thoát không thể nhìn thấy: nhập gói glyph tại
một trang web cuộc gọi và thay đổi nhà cung cấp từ bên trong lá biểu tượng.

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Icon/index.tsx` and `src/components/leaves/Icon/icon.md`.

## Quy tắc

**ICON-1 · Một icon có đúng ba vai trò ngữ nghĩa.**

`heading` là glyph outline Heroicons 24 ở `size-6`. `leading` dùng cùng vocabulary outline ở `size-5` cho navigation, list row, field và control icon thông thường. `chip` là glyph micro solid Heroicons 16 ở `size-4`. Đây là tên vai trò, không phải lựa chọn styling; caller không truyền pixel, Tailwind size class hay weight tùy ý.
Heroicons 16 glyph rắn ở`size-4`. Đây là tên vai trò, không phải lựa chọn kiểu dáng; một người gọi làm
không chuyển pixel, lớp kích thước Tailwind hoặc trọng số tùy ý.

**ICON-2 · Biểu tượng tiêu đề có 24 đường viền ở kích thước 6.**

Tiêu đề cần có bản vẽ 24 pixel mở vì nó giới thiệu một vùng mà không trở thành huy hiệu.
Việc sử dụng tác phẩm nghệ thuật mini hoặc micro sẽ thay đổi cả hình học và trọng lượng hình ảnh của nó, ngay cả khi CSS phát triển
hộp cuối cùng có cùng số đo.

**ICON-3 · Biểu tượng hàng đầu có đường viền ở kích thước 5.**

Các tab điều hướng, danh sách hàng, trường, công tắc và điều khiển biểu tượng sử dụng từ vựng phác thảo ở 20px.
Họ dẫn dắt các từ hoặc một tương tác thông thường; họ không yêu cầu trọng lượng của một tiêu đề và không
nén thành một con chip.

**ICON-4 · Biểu tượng chip là bản vẽ vi mô 16 khối nguyên bản.**

Một con chip nhỏ gọn và đã có hình dạng riêng của nó. Do đó biểu tượng của nó xuất phát từ`@heroicons/react/16/solid`Tại`size-4`; thu nhỏ glyph 24 phác thảo xuống là không tương đương bởi vì
các đường dẫn được vẽ cho một kích thước quang học khác nhau.

**ICON-5 · Glyph kế thừa màu.**

Glyph vẽ vào`currentColor`, vì vậy các trạng thái bị vô hiệu hóa, tắt tiếng, được chọn và theo chủ đề vẫn là một trạng thái
với những từ xung quanh nó. Nhà cung cấp chính xác và nhãn hiệu nhà có thể giữ nguyên màu sắc tác giả của họ vì
việc tô màu lại chúng sẽ thay đổi danh tính của chúng.

**ICON-6 · Caller nêu meaning, không bao giờ nêu vendor component.**

Chỉ`src/components/leaves/Icon/index.tsx`có thể nhập thư viện glyph. Một người anh em như`brands.tsx`sở hữu đường dẫn SVG cục bộ chính xác, không phải đường dẫn khác vào Heroicons. Người gọi nhập thành phần SVG
chọn nhà cung cấp, hình ảnh, dòng và kích thước cục bộ, tạo từ vựng biểu tượng thứ hai bên ngoài
bản đồ khép kín

**ICON-7 · Heroicons là vendor glyph duy nhất.**

Lá biểu tượng có thể nhập`@heroicons/react/24/outline`Và`@heroicons/react/16/solid`. Phốt pho,
Lucide, React Icons, Tabler và Font Awesome đều bị từ chối ngay cả trong thư mục đó. SVG thương hiệu chính xác
vẫn là tài sản cục bộ chứ không phải là tài sản gần đúng được chọn từ gói mục đích chung khác.

**ICON-8 · Glyph không bao giờ bị co lại.**

Mỗi vai trò đều mang`shrink-0`. Khi một hàng trở nên chặt chẽ, các từ sẽ được ngắt dòng hoặc cắt bớt trước; làm biến dạng
glyph làm cho hàng khó nhận biết nhất tại điểm chính xác nhất khó đọc nhất.

**ICON-9 · Bản đồ tính năng nguồn sở hữu lựa chọn ý nghĩa cho glyph.**`src/components/leaves/Icon/icon.md`lập bản đồ mọi`IconName`cho một tính năng sản phẩm và một bê tông
Biểu tượng anh hùng. Tính năng tương tự sẽ sử dụng lại ý nghĩa của nó ở mọi vị trí; ý nghĩa khác nhau không chia sẻ
một hình tượng đơn thuần chỉ vì nó ở gần hoặc có vẻ hợp lý về mặt thị giác.`IconName`, `GLYPHS`và cái bàn di chuyển
cùng nhau và kiểm tra tính chẵn lẻ của nguồn sẽ loại bỏ một hàng bị thiếu, tên thành phần cũ hoặc hình tượng trùng lặp
quyền sở hữu.

**ICON-10 · Thông tin kinh doanh nhỏ gọn không có biểu tượng tính năng trang trí.**

Một số liệu nhỏ gọn, mục tiêu, nhãn loại, chú thích dòng hoặc ô dữ kiện có tham chiếu chỉ ở dạng văn bản
vẫn chỉ ở dạng văn bản. Các ký tự nội tuyến nhỏ được dành riêng cho ý nghĩa trạng thái và hành động chung mà
tham chiếu thực sự mang - ví dụ: hoàn thành, không thành công, đang chờ xử lý, đóng hoặc tiết lộ. một cuốn sách
bên cạnh`Content`hoặc một ngọn lửa bên cạnh số đếm lặp lại có nghĩa là các từ đã đóng lại; thêm
nó tạo ra chỉ mục trực quan thứ hai, tăng độ nhiễu và biến công cụ tái cấu trúc thành thiết kế lại. điều hướng,
các điểm nhập đối tượng được đặt tên và các tiêu đề vùng trống lớn giữ các biểu tượng tham chiếu của chúng vì
glyph là một phần của việc định vị hoặc xác định vùng đó ở đó.

**ICON-11 · Mỗi IconTile chứa một hình tượng ở đầu có kích thước năm.**

IconTile có thể sử dụng một tấm nhỏ hoặc vừa, nhưng hình tượng của nó luôn là đường viền của Heroicons 24`leading`vai trò tại`size-5`. Kích thước tấm thay đổi không gian thở và điểm nhấn của bề mặt; nó
không quảng bá glyph vào tiêu đề`size-6`hoặc nén nó vào chip`size-4`. `IconTile`sở hữu cái này
sự lựa chọn, vì vậy người gọi không bao giờ lấy được vai trò glyph từ kích thước ô xếp.

**ICON-12 · Biểu tượng dẫn đầu phải phân biệt được các biểu tượng khác.**

Biểu tượng dẫn đầu thông thường thuộc về một tập hợp các lựa chọn hoặc đích đến ngang hàng không đồng nhất - chẳng hạn như
danh sách, menu, tab hoặc điều hướng - nơi người đọc có thể xác định một mục trước khi đọc nhãn của nó.
Một hàng tóm tắt hoặc tiêu đề đơn lẻ đã được đặt tên theo phần của nó thì không có danh tính ngang hàng để phân biệt, vì vậy
lặp lại khái niệm đó như một glyph là trang trí. Hiển thị nhãn chính của nó một cách bình thường và dấu vết của nó
hỗ trợ thực tế như`text-xs muted`.

**ICON-13 · Phản ứng sản phẩm sử dụng tác phẩm nghệ thuật Fluent Emoji đã được đăng ký.**

Phản ứng là tác phẩm nghệ thuật mang tính biểu cảm của sản phẩm, không phải là hình tượng giao diện ngữ nghĩa. Lá phản ứng sở hữu
đã sửa`like`, `love`, `haha`, `wow`, `sad`, `angry`ánh xạ tới các SVG phẳng được kiểm tra bên dưới`public/reactions/`và thuộc tính Microsoft Fluent Emoji MIT đi cùng với những nội dung đó.
Người gọi chỉ chuyển danh tính phản ứng và nhãn đã giải quyết. Họ không chuyển biểu tượng cảm xúc Unicode, nội dung
đường dẫn, hình ảnh tùy ý hoặc các thành phần của nhà cung cấp. Đây là một ranh giới nghệ thuật hẹp; Biểu tượng anh hùng vẫn còn
từ vựng duy nhất cho các biểu tượng điều hướng, trạng thái và hành động.

Canon phản ánh bảng hoạt động bên dưới để đọc AI`.claude`có câu trả lời lựa chọn
trước khi nó mở nguồn sản phẩm. Thay đổi ánh xạ sẽ cập nhật bảng này và bảng nguồn trong
thay đổi logic tương tự.

| Meaning (`IconName`) | Tính năng sản phẩm | Heroicon |
|---|---|---|
| `brand` | Bản sắc học tập/học tập | `AcademicCapIcon` |
| `streak`| Chuỗi học tập |`FireIcon` |
| `credit`| Tín dụng/hạn ngạch AI |`BoltIcon` |
| `reward`| Phần thưởng và điểm quà tặng |`GiftIcon` |
| `course`| Các khóa học và nội dung |`BookOpenIcon` |
| `email`| Nhận dạng email |`EnvelopeIcon` |
| `password`| Trường mật khẩu |`LockClosedIcon` |
| `revealPassword`| Tiết lộ mật khẩu bị che giấu |`EyeIcon` |
| `hidePassword`| Ẩn mật khẩu hiển thị |`EyeSlashIcon` |
| `code`| Mã xác minh/bảo mật |`ShieldCheckIcon` |
| `complete`| Trạng thái hoàn thành/thành công |`CheckCircleIcon` |
| `pending`| Tiến độ chưa hoàn thành/đang chờ xử lý |`CircleIcon`bắt nguồn từ con đường bên ngoài của`CheckCircleIcon`; chỉ xóa phần kiểm tra bên trong |
|`signIn`| Nhập tài khoản/phiên |`ArrowRightOnRectangleIcon` |
| `signUp`| Tạo tài khoản/phiên |`UserPlusIcon` |
| `close`| Loại bỏ/đóng |`XMarkIcon` |
| `next`| Tiếp tục/đi tiếp |`ArrowRightIcon` |
| `disclosure`| Mở chi tiết/hồ sơ được đặt tên theo hàng này |`ChevronRightIcon` |
| `retry`| Thử lại/làm mới công việc thất bại |`ArrowPathIcon` |
| `send`| Gửi/gửi tin nhắn |`PaperAirplaneIcon` |
| `home`| Tổng quan về trang tổng quan |`HomeIcon` |
| `explore`| Khám phá/khám phá danh mục |`GlobeAltIcon` |
| `community`| Cộng đồng người học |`UserGroupIcon` |
| `league`| Bảng xếp hạng và cạnh tranh |`TrophyIcon` |
| `review`| Xem xét công việc được giao |`ClipboardDocumentCheckIcon` |
| `light`| Chủ đề nhẹ nhàng |`SunIcon` |
| `dark`| Chủ đề tối |`MoonIcon` |
| `locale`| Chuyển đổi ngôn ngữ/địa phương |`LanguageIcon` |
| `google`| Nhà cung cấp Google |`GoogleMark` |
| `github`| Nhà cung cấp GitHub |`GithubMark` |
| `search`| Tìm kiếm toàn cầu |`MagnifyingGlassIcon` |
| `cart`| Giỏ hàng |`ShoppingCartIcon` |
| `notification`| Thông báo |`BellIcon` |
| `account`| Tài khoản người dùng hiện tại |`UserCircleIcon` |
| `profile`| Hồ sơ người học hiện tại |`UserIcon` |
| `cv`| CV người học |`DocumentTextIcon` |
| `settings`| Cài đặt tài khoản/hồ sơ |`Cog6ToothIcon` |
| `signOut`| Kết thúc phiên hiện tại |`ArrowLeftStartOnRectangleIcon` |
| `saved`| Nội dung đã lưu/đánh dấu |`BookmarkIcon` |
| `blog`| Nội dung blog/biên tập |`NewspaperIcon` |
| `talents`| Khám phá tài năng |`SparklesIcon` |
| `jobs`| Việc làm CNTT |`BriefcaseIcon` |
| `practice`| Thực hành lập trình/viết mã |`CodeBracketIcon`|

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Nhập Phosphor hoặc gói glyph khác | Nó mở ra một ngôn ngữ hình ảnh thứ hai | Ánh xạ ý nghĩa của các Heroicons trong lá biểu tượng |
| Nhập Heroicons bên ngoài lá biểu tượng | Nhà cung cấp, glyph, gia đình và kích thước thoát đến trang web cuộc gọi | Vượt qua một`IconName`và vai trò ngữ nghĩa |
| Phát triển tác phẩm nghệ thuật vi mô thành tiêu đề | Kích thước CSS không thể khôi phục hình học được tạo cho kích thước quang học khác | Sử dụng phác thảo 24 tại`size-6`|
| Thay đổi hình tượng IconTile bằng kích thước tấm của nó | Dấu hiệu ngữ nghĩa tương tự nhảy giữa chip, trọng lượng đầu và tiêu đề | Giữ mọi biểu tượng IconTile ở vị trí dẫn đầu`size-5`; chỉ thay đổi tấm |
| Thu nhỏ 24 tác phẩm nghệ thuật phác thảo thành một con chip | Nó không phải là bản vẽ vi mô gốc | Sử dụng 16 rắn lúc`size-4`|
| Sử dụng`mini`cho một con chip | Nhỏ là 20px; vai trò của chip sản phẩm là vi mô | Sử dụng`@heroicons/react/16/solid`|
| Vượt qua kích thước, hạng hoặc trọng lượng thô | Người gọi âm thầm tạo một vai trò khác | Chọn`heading`, `leading`hoặc`chip`|
| Tạo cho sản phẩm một màu sắc riêng | Nó mâu thuẫn với trạng thái được chứa bởi container của nó | Kế thừa`currentColor`|
| Để một glyph co lại thành một hàng linh hoạt | Hình dạng của nó sụp đổ dưới áp lực | Giữ`shrink-0`; hãy để lời nói nhường đường |
| Tái sử dụng một glyph cho các tính năng không liên quan | Người đọc không phân biệt được đích đến và các tác giả sau này sao chép sự mơ hồ | Thêm một hàng tính năng độc đáo vào bản đồ nguồn |
| Thêm biểu tượng tính năng vào thông tin kinh doanh nhỏ gọn | Các từ đã đóng nghĩa nên hình tượng sẽ tạo thêm tiếng ồn và chuyển hướng khỏi tham chiếu chỉ có văn bản | Giữ nguyên văn bản các số liệu, loại, mục tiêu và chú thích; chỉ sử dụng các glyph nhỏ cho ngữ nghĩa trạng thái/hành động chung được hỗ trợ tham chiếu |
| Đặt biểu tượng hàng đầu trên một dòng tóm tắt hoặc dòng tiêu đề | Không có danh tính ngang hàng nào để glyph phân biệt và tiêu đề phần đã cung cấp khái niệm | Hiển thị nhãn và phần đuôi bị tắt tiếng nhỏ hơn của nó mà không có biểu tượng |
| Hiển thị phản ứng dưới dạng biểu tượng cảm xúc Unicode | Phông chữ nền tảng thay đổi tác phẩm nghệ thuật và phá vỡ sự tương đồng với sản phẩm cũ | Sử dụng sáu SVG Fluent Emoji Flat đã đăng ký thông qua lá phản ứng |
| Truyền hình ảnh phản ứng hoặc đường dẫn nội dung từ người gọi | Từ vựng sản phẩm cố định rò rỉ vào mỗi hàng nguồn cấp dữ liệu | Vượt qua nhận dạng phản ứng ngữ nghĩa; hãy để lá phản ứng sở hữu bản đồ tài sản của nó |
| Nhập biểu tượng cảm xúc thông thạo dưới dạng danh mục glyph | Tác phẩm nghệ thuật phản ứng trở thành nhà cung cấp biểu tượng thứ hai đặc biệt | Giữ tập hợp con SVG được phân bổ trong`public/reactions/`; Heroicons vẫn là nhà cung cấp glyph |
| Thay đổi`GLYPHS`mà không thay đổi bảng nguồn | Hướng dẫn về mã và AI ngay lập tức không đồng ý | Cập nhật`icon.md`, `IconName`Và`GLYPHS`cùng nhau |

## Ví dụ

### Nhóm heading

```tsx
<Icon props={{ name: "course", role: "heading" }} />
```

```tsx
<BookOpenIcon className="size-6" />
```
Chúng khác nhau ở một điểm: cái đầu tiên chọn 24 bản vẽ phác thảo thông qua bản đồ ý nghĩa đóng;
cái thứ hai rò rỉ thành phần nhà cung cấp cho người gọi.

### Nhóm chip

```tsx
<Icon props={{ name: "close", role: "chip" }} />
```

```tsx
<XMarkIcon className="size-4" />
```
Chúng khác nhau ở một điều: cái đầu tiên chọn 16 bản vẽ vi mô rắn nguyên gốc; chiếc lá thứ hai
họ này không rõ ràng mặc dù hộp CSS cuối cùng của nó có kích thước 16px.

### Leading và heading

```tsx
<Icon props={{ name: "home", role: "leading" }} />
```

```tsx
<Icon props={{ name: "home", role: "heading" }} />
```
Chúng khác nhau ở một điểm: biểu tượng dẫn đầu một hàng điều hướng thông thường hay giới thiệu một
vùng tiêu đề.

### Ranh giới thương hiệu

```tsx
<Icon props={{ name: "google", role: "chip" }} />
```

```tsx
<SomeGenericGoogleIcon className="size-4" />
```
Chúng khác nhau ở một điều: cái đầu tiên bảo tồn chính xác nhà cung cấp SVG; cái thứ hai thay thế a
glyph mục đích chung cho một dấu hiệu nhận dạng.
