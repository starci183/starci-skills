---
id: fe-layouts-laws-l11-full-width-run-versus-compact-control-vi
title: vi.md
slug: /gates/layouts/laws/l11-full-width-run-versus-compact-control/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L11-N nhận diện bằng việc bấm vào thì cái gì bị thay, và vì sao thầy phán hai chiều ngược nhau trên đúng một điều khiển mà cả hai lần đều còn hiệu lực.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l11-full-width-run-versus-compact-control` · Luật: [`INDEX.md`](./INDEX.md)

# Chạy hết chiều ngang hay đứng gọn cạnh hình

Luật này sinh ra từ một chỗ mà canon không được phép chọn hộ. Trên đúng một điều khiển, cái nút chọn
năm của biểu đồ đóng góp ở Dashboard, thầy đã phán hai lần theo hai chiều ngược nhau. Vòng đầu thầy
bảo nó phải là một hàng dài như ShellNav. Vòng sau chính thầy lật lại, và lý do không phải là thầy đổi
ý về tầm quan trọng mà là về vai trò: cái nút ấy đổi một tham số của một hình vẽ chứ không đổi vùng
nội dung của trang. Bản ghi tự gọi tên cú lật ở dòng `:207` và giữ nguyên vòng một lại làm lịch sử ở
dòng `:235`, nên hai phán quyết cùng còn hiệu lực theo đúng nghĩa của chúng.

Vì vậy mô-đun này không phát ra một chiều ngang. Nó phát ra một câu hỏi, và câu hỏi đó có hai vế đi
theo thứ tự. Vế thứ nhất hỏi bấm vào thì cái nằm dưới đổi **giá trị** hay đổi **mặt**. Vế thứ hai chỉ
mở ra khi câu trả lời là mặt, và nó hỏi mặt ấy thuộc về vùng của chính trang hay thuộc về một vùng
nằm bên trong trang. Trả lời được hai câu đó thì hình dạng theo sau, và không cần đến một tính từ nào.

Ai đọc mô-đun này rồi rút ra rằng cái nút chọn năm phải chạy hết chiều ngang là đã đọc ngược. Vòng một
được ghi lại ở đây vì nó là lý do tiêu chí tồn tại, không phải vì nó là kết quả.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Plan khai gì |
|---|---|---|
| `L11-1` | Bấm vào thì vùng của chính trang được thay bằng một loại nội dung khác, còn điều khiển vẫn đứng đó | một hàng chạy hết chiều ngang, có landmark hoặc đường nền chrome của riêng nó |
| `L11-2` | Bấm vào thì cái nằm dưới vẫn là nó, chỉ trả lời khác đi | một điều khiển gọn ở một đầu hàng của chính cái đó, rộng bằng đúng những chữ nó đưa ra |
| `L11-3` | Hai điều khiển khác loại đứng chung một hàng | hàng đầy chiều ngang, hai điều khiển bên trong đều intrinsic, mỗi cái phân loại riêng |
| `L11-4` | Mặt được chọn thuộc về một vùng bên trong trang chứ không thuộc về trang | gọn, nằm trong hàng của chính vùng ấy |
| `L11-5` | Token của vendor và chỗ đứng nói hai sản phẩm khác nhau | phân loại theo chỗ đứng và cơ chế, rồi đổi tên cho tên và hình khớp nhau |
| `L11-6` | Cả hai cách đọc đều bảo vệ được | **không phát gì**, trả câu hỏi về cho thầy |

## `L11-1` — hàng chạy hết chiều ngang

Tình huống nghiệp vụ: bấm vào thì cả vùng nội dung của trang được thay bằng một loại nội dung khác,
và bản thân điều khiển không bị thay theo. Người đọc vẫn đang ở cùng một địa chỉ, nhưng cái họ đang
đọc bây giờ là một thứ khác hẳn.

Trong repo sống có đúng ba chỗ trả lời được cả hai vế theo cách này. Hàng tab thứ hai của navbar là một anh em ngang hàng với hàng
thương hiệu ở trên nó, và cả cụm navbar đứng trên phần thân được route vẽ lại. Hàng tab của hồ sơ công
khai là anh em ngang hàng với `body` trong chính khung `profile-tabs-over-body`, tức là cái tên hợp
đồng đã nói ra quan hệ ấy. Và hàng bốn mục của trang chi tiết khoá học là anh em ngang hàng với toàn
bộ `body` ở tầng cao nhất của hợp đồng trang, nó khai `host: "nav"` và dính vào đường nền của navbar.

Cả ba đều mang `w-full`, cả ba đều dùng cơ chế gạch chân, và cả ba đều có một landmark hoặc một chỗ
đứng trong chrome. Ba dấu hiệu ấy đi cùng nhau chứ không phải chọn một trong ba, và một plan khai
`L11-1` mà không gọi tên được landmark thì chưa chứng minh được điều mình khai.

Có một chỗ thứ tư dùng cùng cơ chế mà không thoả vế thứ hai. Cột đọc của trang bài luyện mã đặt một
hàng `ExtendedTabs` chạy hết chiều ngang lên trên bốn mặt đề bài, gợi ý, lời giải và các lần nộp,
trong khi cột ấy chỉ là một trong hai cột của trang và rộng `md:w-2/5`. Theo tiêu chí thì nó thuộc
`L11-4`, nên đây là vi phạm còn sống duy nhất của mô-đun và nó được chứng minh trong
[`audit.md`](./audit.md) chứ không được hợp thức hoá ở đây.

Chỗ hay bị trượt nằm ở chỗ mục thứ ba, hàng bốn mục của trang chi tiết khoá học, thật ra chỉ cuộn màn
hình chứ không thay gì cả. Nó vẫn là `L11-1`, vì bốn mục ấy là bốn vùng của chính trang và dải điều
khiển mở một landmark riêng. Cái handler đằng sau nó thuộc về [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md)
và không tham gia vào việc phân loại ở đây.

## `L11-2` — điều khiển gọn cạnh cái nó đổi

Tình huống nghiệp vụ: bấm vào thì cái nằm dưới vẫn nguyên là nó, chỉ trả lời khác đi. Biểu đồ đóng
góp vẫn là biểu đồ ấy, vẽ lại cho một năm khác. Bảng xếp hạng vẫn là bảng ấy, tính lại cho một phạm vi
khác. Danh sách khoá học vẫn là danh sách ấy, bày ra theo một cách sắp khác.

Đây là mã mà cú lật của thầy chốt lại, và nó đã đóng băng thành hợp đồng. `contribution-calendar-heading-row`
viết ra bằng lời của chính nó rằng con số tổng và cái nút chọn năm cùng nói về một biểu đồ, nên lựa
chọn segmented của nó ngồi ở mép cuối hàng thay vì trở thành một dòng điều hướng kiểu ShellNav.

`scope-switch-row` còn nói thẳng chế độ hỏng ngay trong comment cạnh chỗ ra quyết định. Trước đó cái
điều khiển ấy là con trực tiếp của một `flex-col`, mà `flex-col` thì kéo con của nó ra hết chiều ngang,
và một segmented control trải hết measure được đọc thành một dải chia đôi trang chứ không thành một
cái nút bấm được. Cách sửa là bọc nó trong một `flex-row` để nó lấy lại đúng chiều rộng của hai chữ.

Một dữ kiện quan trọng để không hiểu sai mã này. `scope-switch-row` là anh em ngang hàng với bảng xếp
hạng ở tầng cao nhất của hợp đồng trang, tức là nó đứng đúng vị trí mà một hàng `L11-1` sẽ đứng, và nó
vẫn gọn. Vị trí không quyết định gì cả khi vế thứ nhất đã trả lời là giá trị.

## `L11-3` — hàng thì đầy, điều khiển thì không

Tình huống nghiệp vụ: một hàng chứa hai thứ khác loại, hoặc hai điều khiển độc lập, hoặc một nhãn và
một điều khiển, và hàng ấy cần trải ra để đẩy hai đầu về hai phía.

`dual-tabs-toolbar` là ví dụ rõ nhất. Nó khai `w-full` cùng `justify-between`, bên trong là hai
`choice-tabs` độc lập, một cái chọn mặt nội dung và một cái chọn ngôn ngữ, mỗi cái giữ selection và
nhãn trợ năng riêng. `contribution-calendar-heading-row` cũng cùng hình dạng ấy với một nhãn ở đầu này
và điều khiển ở đầu kia.

Mã này tồn tại để chặn một cách đọc sai rất dễ xảy ra khi người ta đọc mảng `classes`: thấy `w-full`
rồi kết luận điều khiển bên trong là loại chạy hết chiều ngang. Chiều rộng ấy thuộc về cái hàng, và
cái hàng cần nó để làm việc của một hàng. Muốn biết điều khiển thuộc loại nào thì phải hỏi lại vế thứ
nhất cho từng cái một.

## `L11-4` — mặt của một vùng bên trong trang

Tình huống nghiệp vụ: bấm vào thì đúng là một loại nội dung khác hiện ra, nhưng vùng được thay không
phải vùng của trang mà là một vùng nằm bên trong trang. Người đọc đang ở trong một cột, một rail hay
một overlay, và cái ranh giới ấy đã đặt tên cho ngữ cảnh rồi.

Ba mặt nội dung của trang học là ca khó nhất và cũng là ca dạy được nhiều nhất. Đọc, mã nguồn và bài
tập là ba loại nội dung khác hẳn nhau, nên vế thứ nhất trả lời là mặt chứ không phải giá trị. Nhưng
cái bị thay là `body` của `learn-content-page`, mà `learn-content-page` chính là `main`, một trong ba
cột của `content-reader-frame`, đứng giữa một panel mục lục và một rail dàn ý. Vế thứ hai vì thế trả
lời là vùng bên trong, và điều khiển giữ hình dạng gọn.

Rail mua khoá học và overlay thanh toán cũng rơi vào đây. Bên trong rail, chuyển giữa mua và dùng thử
thay hẳn phần thân của rail, nhưng rail đã là một vật có ranh giới. Bên trong overlay thì
[`l6`](../l6-overlay-is-already-a-surface/INDEX.md) đã phán rằng overlay tự nó là mặt phẳng có ranh
giới, nên không thứ gì bên trong được lấy measure của ruột làm một dải.

Bỏ vế thứ hai đi thì hậu quả nhìn thấy ngay: một hàng gạch chân chạy hết chiều ngang mọc lên giữa một
cột đọc vốn đã bị kẹp giữa hai cột khác, và người đọc sẽ hiểu nhầm nó là điều hướng của cả trang.

## `L11-5` — tên vendor không phải bằng chứng

Tình huống nghiệp vụ: cái token mà thư viện dùng để gọi một kiểu vẽ và cái tên mà sản phẩm dùng để gọi
vai trò đá nhau. HeroUI gọi lớp gạch chân của nó là `secondary`, trong khi ShellNav dùng đúng lớp ấy
làm điều hướng chính của cả cụm route. Thầy đã bác chuyện đọc token thành thứ bậc ở dòng `:172`, rồi
bác luôn một adapter gọi là primary mà lại vẽ ra underline của vendor ở dòng `:241`, với lý do rằng
tên và hình phải mô tả cùng một sản phẩm.

Chính cái leaf đã ghi lại tiêu chí này bằng giọng của vòng hai, rằng primary là một lựa chọn segmented
gọn bên trong một ngữ cảnh có ranh giới còn secondary là một lớp điều hướng gạch chân giữa những vùng
nội dung lớn, và hai cái tên ấy chọn hai sản phẩm ổn định chứ không phải một thang tầm quan trọng.

Nửa còn lại của mã này đi theo chiều ngược. Lớp sơn gạch chân tự nó chưa làm nên một hàng chạy hết
chiều ngang. Trục chọn ngôn ngữ của trang học giữ lớp sơn ấy mà vẫn intrinsic, và lý do ghi ngay cạnh
giá trị nói rằng ngôn ngữ chỉ định tính cho các ví dụ bên trong mặt đang đọc chứ không chọn mặt, nên
nó không được cạnh tranh với cái pill ở đầu kia hàng. Muốn biết một điều khiển có phải là hàng chạy
hết chiều ngang hay không thì phải thấy đủ cả ba dấu hiệu, chứ không chỉ thấy lớp sơn.

Có một cái bẫy đi kèm và nó im lặng. `ChoiceTabs` mặc định về `"secondary"` khi không ai khai, nghĩa
là bỏ trống ô ấy sẽ nhận lấy hình dạng điều hướng mà không hề phán một câu nào. Trên trang chi tiết
khoá học thì việc bỏ trống lại ra đúng kết quả, vì hàng ấy là `L11-1` thật. Trên một điều khiển gọn
thì cùng một chỗ bỏ trống là một cái tật, và diff của hai chỗ nhìn giống hệt nhau.

## `L11-6` — trả câu hỏi về cho thầy

Tình huống nghiệp vụ: cùng một điều khiển mà cả hai cách đọc đều bảo vệ được bằng lý do sản phẩm, chứ
không phải người viết đang lưỡng lự.

Mã này phát ra không gì cả, đúng như [`l5`](../l5-every-route-has-a-real-owner/INDEX.md) `L5-5` làm với
đích của một cửa vào. Plan nêu cả hai cách đọc, gọi tên cái sẽ bị thay theo từng cách, và dừng lại.
Nếu đã có một lời phán thì plan chép nguyên văn lời ấy mang theo.

Cái mã này chặn không phải sự lười mà là một phản xạ nghe rất hợp lý: lấy điều khiển gần nhất từng làm
rồi làm giống thế. Chính phản xạ ấy đã tạo ra cú lật mà mô-đun này được viết ra từ đó, vì vòng một đã
lấy ShellNav làm mẫu cho một cái nút chọn năm.

## Luật

Bấm vào điều khiển rồi hỏi cái gì bị thay. Nếu cái nằm dưới vẫn là nó và chỉ trả lời khác đi thì điều
khiển đứng gọn, rộng bằng đúng những chữ nó đưa ra, ở một đầu hàng của chính cái đó. Nếu vùng bị thay
bằng một loại nội dung khác thì hỏi tiếp vùng ấy là của ai. Vùng của chính trang, với điều khiển đứng
trên nó và sống lâu hơn nó, thì điều khiển chạy hết chiều ngang trong một landmark của riêng mình.
Vùng nằm bên trong trang thì điều khiển vẫn gọn, vì cái ranh giới của vùng ấy đã đặt tên cho ngữ cảnh.

Token của vendor viết sau cùng, sau khi đã phân loại xong, và viết sao cho tên gọi với hình vẽ mô tả
cùng một sản phẩm. Khi cả hai cách đọc đều đúng thì không phát giá trị nào.

## Ngoại lệ

- **Hàng chạy hết chiều ngang mà handler chỉ cuộn.** `L11-1`. Bốn mục của trang chi tiết khoá học
  không thay gì cả, chúng chỉ đưa màn hình đến một chỗ khác trong cùng một tài liệu, và chúng vẫn giữ
  hàng đầy vì bốn mục ấy là bốn vùng của chính trang.
- **Điều khiển chọn mặt mà vẫn gọn.** `L11-4`. Ba mặt của trang học và cặp mua hoặc dùng thử trong
  rail đều thay hẳn một phần thân, và cả hai vẫn intrinsic, vì phần thân ấy thuộc về một cột và một
  rail.
- **Điều khiển bên trong overlay.** `L11-4`, và [`l6`](../l6-overlay-is-already-a-surface/INDEX.md)
  đóng nó lại. Chiều rộng của chính cái overlay là chuyện khác và không phán ở đây.
- **Bỏ trống `variant` trên một hàng `L11-1`.** Trang chi tiết khoá học không khai gì và nhận đúng
  underline, và đó là kết quả đúng. Cũng chỗ bỏ trống ấy trên một điều khiển gọn là một cái tật.
- **Cả hai cách đọc đều đúng.** `L11-6`. Nêu cả hai, chép lời phán nếu có, rồi dừng.

## Vì sao cả hai vòng phán quyết đều còn hiệu lực

Rất dễ đọc cú lật này thành thầy đổi ý, rồi kết luận rằng vòng sau xoá vòng trước. Bản ghi không nói
thế. Nó xếp phản hồi vòng hai vào loại `correction-of-prior-interpretation`, tức là sửa cách hiểu chứ
không phải đổi yêu cầu, và nó giữ vòng một lại làm lịch sử từ chối.

Đọc kỹ thì hai vòng nói về hai chuyện khác nhau. Vòng một nói rằng cái điều khiển ấy là **chính** chứ
không phải phụ, và lúc đó chữ chính bị hiểu thành một dải rộng như ShellNav vì đó là thứ chính duy
nhất đang có trên màn hình để mà so. Vòng hai giữ nguyên việc nó là chính, và chỉ sửa cái nghĩa của
chữ ấy: chính có nghĩa là được sơn thành một pill segmented gọn, còn gạch chân rộng hết cột là tên của
một sản phẩm khác.

Kết quả trong repo sống là vòng hai, nhưng thứ được canon giữ lại không phải kết quả ấy. Cái được giữ
là câu hỏi đã phân biệt được hai vòng, vì một canon chỉ chép lại kết quả sẽ trả lời sai ngay ở điều
khiển tiếp theo mà nó chưa từng gặp.
