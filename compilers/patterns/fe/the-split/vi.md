---
title: The-split · Vietnamese
description: Biến một surface đã duyệt thành hai file — một nửa connected chốt tình huống, một nửa vẽ nó ra.
module: the-split
kind: pattern
codes: [SPLIT-1, SPLIT-2, SPLIT-3, SPLIT-4, SPLIT-5, SPLIT-6]
---

# Đường tách

Đầu vào của pattern này là một shape đã có người duyệt: một layout, một block, một capability hay một
contract đã được chốt. Quyết định thiết kế đã đóng ở đây và không bao giờ được mở lại. Cái mà pattern
này sinh ra là kiến trúc source — surface đã duyệt ấy thành mấy file, file nào giữ request, file nào
giữ cây, cái gì được phép băng qua giữa chúng, file thứ hai tên là gì, và mỗi file được import những
gì.

## Luật

Một surface tự đi lấy dữ liệu thì có hai file. `index.tsx` gọi request, chốt xem người đọc đang ở tình
huống nào, và dịch sẵn chữ. `component.tsx` nhận một tình huống đã được chốt rồi vẽ nó.

Đây không phải chuyện xếp file cho gọn. Đây là một đường vạch ra để **mọi thứ có thể sai về DỮ LIỆU
nằm trong một file, mọi thứ có thể sai về VIỆC VẼ nằm trong file kia** — và người review một bên không
phải mở file bên kia.

Chỉ một câu hỏi quyết định một dòng code thuộc nửa nào: **dòng này có thể sai trong khi mạng vẫn tốt
không?** Cây sai, seam sai, thiếu một trạng thái: đó là việc vẽ. Request sai, chốt nhầm tình huống,
chọn nhầm chữ: đó là dữ liệu.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi surface đọc thế giới đều bị sáu mã dưới đây soi,
và mỗi mã hoặc giữ được hoặc bị phá. Không có kích thước nào nhỏ đến mức được miễn: "có mỗi một leaf"
và "chưa có state nào đâu" chính là hai chỗ đường ranh bị vượt nhiều nhất, vì đó là hai chỗ mà hôm nay
vượt qua không tốn gì cả.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `SPLIT-<n>`. Mã đặt tên cho TÌNH HUỐNG; cột cuối
nói tình huống ấy buộc source phải trông như thế nào.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `SPLIT-1` | Nửa vẽ nhận mọi thứ đã quyết định sẵn, không tự đi hỏi ai | Nửa vẽ nhận mọi giá trị đã được quyết định, nên nó render được từ một fixture. Cấm: mọi request, mọi lần đọc store, đọc locale hay gọi dịch nằm trong `component.tsx` |
| `SPLIT-2` | Nửa connected chốt tình huống, không chốt cách nó trông ra sao | Nửa connected quyết định đây là tình huống có tên nào, rồi đưa xuống. Cấm: nửa connected quyết định một trạng thái trông thế nào, cách nhau bao xa, hay element nào vẽ cái gì |
| `SPLIT-3` | Tình huống băng qua đường ranh dưới dạng một cái tên, không phải một nắm cờ | Tình huống băng qua như một giá trị lấy từ một tập đóng. Cấm: một nắm boolean băng qua đường ranh — `isLoading`, `hasError`, `isEmpty` làm props đi vào |
| `SPLIT-4` | Chữ được dịch xong trước khi băng qua | Chữ băng qua ở dạng đã resolve: nửa vẽ nhận chữ. Cấm: một translation key, một message id hay một locale băng qua đường ranh |
| `SPLIT-5` | Nửa connected không tự vẽ gì | Nửa connected import đúng `_${FolderName}` từ `./component` và render đúng component đó ở mọi nhánh JSX. Cấm: một file connected tự render một leaf, một branch hay một cây thay thế của riêng nó |
| `SPLIT-6` | Surface không có request thì không tách | Surface không có request thì ở nguyên một file. Cấm: dựng thêm file thứ hai cho một component chẳng fetch gì |

`SPLIT-6` LÀ MỘT GIỚI HẠN, KHÔNG PHẢI MỘT CỬA THOÁT. Nó nói luật dừng lại ở đâu, và chính điều đó giữ
cho năm mã kia không biến thành nghi lễ. Đường tách tồn tại vì request tồn tại; ở đâu không có request
thì không có nửa dữ liệu, nên file thứ hai chẳng giữ điều gì mà file thứ nhất có thể làm sai.

`SPLIT-5` KHÔNG CÓ NGOẠI LỆ CHO BLOCK MỎNG. Chỉ một leaf, một cây giống nhau ở mọi trạng thái, không
có local domain state, hay một sinh đôi chỉ forward props — đó chính là những trường hợp dễ mọc thêm
tình huống thứ hai nhất. Chúng vẫn băng qua đúng cái sinh đôi ấy.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói ra surface: folder nào sở hữu mảng màn hình này, nó hiện cái gì,
   và người đọc có thể rơi vào những tình huống nào.
2. **Đọc xem shape không nói gì, và vì thế không giải quyết gì.** Một shape đã duyệt không bao giờ nói
   nó thành mấy file, chữ tới nơi ở dạng key hay dạng câu, vòng đời băng qua bằng một cái tên hay bằng
   mấy cái boolean, và sinh đôi tên là gì. Đó không phải chỗ hổng của quyết định; đó chính là đầu ra
   của pattern này, và chỉ các mã bên dưới mới chốt được chúng.
3. **Giải từ ngoài vào.** Lấy surface ngoài cùng trong shape, hỏi `SPLIT-6` cho nó trước, rồi mới đi
   xuống. Một cha mà mỗi đứa con tự giữ request của mình thì bản thân nó chẳng giữ request nào; giải
   nó trước sẽ tránh việc bịa ra một nửa dữ liệu cho một file chẳng đọc gì.
4. **Hỏi câu hỏi của từng mã cho từng surface, theo thứ tự.** File này có đọc thế giới không
   (`SPLIT-6`)? Nửa vẽ có đi hỏi ai điều gì không (`SPLIT-1`)? Nửa connected có quyết định hình thức
   không (`SPLIT-2`)? Vòng đời có băng qua dưới một cái tên không (`SPLIT-3`)? Chữ có băng qua ở dạng
   đã dịch không (`SPLIT-4`)? Mọi nhánh JSX có đi qua `_X` không (`SPLIT-5`)? Mỗi câu trả lời là *giữ*
   hoặc *phá*; không có đáp án thứ ba.
5. **Khi hai mã cùng khớp thì ghi cả hai.** Gọi hook dịch trong `component.tsx` phá `SPLIT-1` vì nửa
   vẽ đã đi hỏi thế giới, và phá `SPLIT-4` vì chữ lẽ ra đã phải dịch xong cách đó một file. Các mã
   không loại trừ nhau và mã thứ hai không bị mã thứ nhất nuốt — thứ phân biệt là lỗi nằm bên nào của
   đường ranh, chứ không phải bạn nhìn thấy mã nào trước. Khi hai mã tả cùng một file từ hai phía
   ngược nhau (`SPLIT-2` là quyết định trình bày rò rỉ qua props; `SPLIT-5` là markup nằm thẳng trong
   file connected), cái quyết định là hình dạng của chỗ rò: truyền `variant="compact"` phá `SPLIT-2`,
   viết `<div>` phá `SPLIT-5`.

## `SPLIT-1` — nửa vẽ nhận hết, không hỏi gì

**Tình huống.** `component.tsx` cần render được từ một fixture: đưa cho nó một object props là nó vẽ
ra đúng cái nó phải vẽ, không cần dựng request, không cần dựng store, không cần dựng runtime dịch.

Lý do không phải là "cho sạch". Một component không render được từ fixture thì không test được, vì
muốn test phải dựng cả thế giới lên trước. Chi phí đó không nằm ở lần viết đầu tiên; nó nằm ở mọi lần
sau, mỗi lần ai đó muốn kiểm một trạng thái.

**Nó sinh ra gì trong source.** Một `component.tsx` mà import chỉ gồm component, type và helper thuần,
và props của nó mang sẵn mọi giá trị nó vẽ ra.

**Dấu hiệu nhận biết.**

- File `component.tsx` có gọi hook request, hook store, hook dịch, hook đọc locale hoặc formatter.
- Muốn viết test cho nó thì phải mock một cái gì đó không phải props.
- Trong file có `if` phân nhánh theo dữ liệu chưa được đặt tên — nó đang tự chốt tình huống.

Tự hỏi: đưa cho file này một object props thuần, nó có vẽ đủ mọi trạng thái mà không cần thêm gì
không?

**Ranh giới.** Nó không phải `SPLIT-2`: `SPLIT-1` nói nửa vẽ không được hỏi, `SPLIT-2` nói nửa
connected không được vẽ — hai chiều của cùng một đường, và một file có thể phá đúng một chiều. Nó
cũng không chỉ là `SPLIT-4`: gọi `useTranslations` trong nửa vẽ phá cả hai, `SPLIT-1` vì nó đi hỏi thế
giới và `SPLIT-4` vì chữ lẽ ra đã phải dịch xong cách đó một file.

**Tình huống nghiệp vụ hay gặp.** Hàng số liệu trên rail; thẻ tóm tắt đơn hàng; danh sách hoá đơn;
khung kết quả tìm kiếm; bảng tiến độ; card khoá học; dòng thông báo.

## `SPLIT-2` — nửa connected chốt tình huống, không chốt cách trông

**Tình huống.** Nửa connected biết một điều mà không ai bên dưới biết: dữ liệu về rồi hay chưa, rỗng
hay có, hỏng hay lành. Nó chốt tình huống và đưa xuống. Nó không quyết định trạng thái đó trông thế
nào, cách nhau bao xa, hay element nào vẽ cái gì.

Lý do: nửa connected không nhìn thấy hậu quả của quyết định trình bày mà nó đưa ra. Nó không biết cạnh
nó có gì, không biết trạng thái kia trông ra sao, nên nó đang chọn một khoảng cách hoặc một biến thể
trong tình trạng mù. Nửa vẽ thì nhìn thấy cả cây.

**Nó sinh ra gì trong source.** Một `index.tsx` mang request và tình huống, trong đó không có
`className`, không có giá trị spacing, và không có lựa chọn element nào cả.

**Dấu hiệu nhận biết.**

- Trong `index.tsx` có `className`, có giá trị spacing, có tên biến thể hình thức.
- Nó truyền xuống một prop kiểu `size`, `tone`, `compact` mà không phải một sự kiện nghiệp vụ.
- Nó truyền xuống một chuỗi đã format sẵn để cho vừa chỗ, chứ không phải vì đó là con số thật.

Tự hỏi: quyết định này có sai được khi mạng vẫn tốt không? Nếu có, nó thuộc nửa vẽ.

**Ranh giới.** Nó không phải `SPLIT-1`, mã cai quản chiều ngược lại của cùng một đường. Nó cũng không
phải `SPLIT-5`: `SPLIT-2` là quyết định trình bày rò rỉ qua props, `SPLIT-5` là markup nằm thẳng trong
file connected. Truyền `variant="compact"` phá `SPLIT-2`; viết `<div>` phá `SPLIT-5`.

**Tình huống nghiệp vụ hay gặp.** Chờ dữ liệu; rỗng vì chưa có gì; rỗng vì lọc ra không ra gì; hỏng và
cho thử lại; hết hạn; chưa đủ quyền; đã hoàn tất.

## `SPLIT-3` — tình huống băng qua dưới dạng một cái tên

**Tình huống.** Cái băng qua đường ranh là một giá trị lấy từ một tập đóng: `state="pending"`,
`state="failed"`, `state="settled"`. Không phải `isLoading`, `hasError`, `isEmpty` đi thành ba prop
song song.

Lý do là số học. Bốn cờ boolean mở ra mười sáu tổ hợp, mà phần lớn chưa ai từng thấy: đang tải và lỗi
và rỗng là một trạng thái không tồn tại, nhưng kiểu dữ liệu vẫn cho phép viết ra. Một cái tên lấy từ
union làm hai việc cùng lúc: mọi tình huống có thật đều bắt buộc phải được vẽ, và mọi tình huống không
có thật đều không viết ra được.

**Nó sinh ra gì trong source.** Một props type export trong `component.tsx` là một union gồm các thành
viên phân biệt nhau bằng một literal `state`.

**Dấu hiệu nhận biết.**

- Props của nửa vẽ có từ hai boolean độc lập trở lên mô tả cùng một vòng đời.
- Trong nửa vẽ có `if (isLoading) … else if (hasError) …` — thứ tự các nhánh đang thay thế cho một tập
  đóng.
- Có một tổ hợp cờ mà không ai trả lời được nó vẽ ra cái gì.

Tự hỏi: có tổ hợp props nào viết ra được mà không tương ứng với tình huống thật nào không?

**Ranh giới.** Nó không phải `SPLIT-2`: `SPLIT-2` hỏi *ai* chốt tình huống, `SPLIT-3` hỏi tình huống
ấy mang hình dạng gì khi băng qua. Chốt đúng tình huống rồi vẫn có thể gửi nó đi dưới dạng một nắm cờ.

**Tình huống nghiệp vụ hay gặp.** Vòng đời một request; rỗng-vì-chưa-có so với rỗng-vì-lọc; quyền truy
cập theo gói; phiên hết hạn; một ngày chưa tới so với một ngày trống; kết quả tìm kiếm.

## `SPLIT-4` — chữ được dịch xong trước khi băng qua

**Tình huống.** Nửa vẽ nhận chữ, không nhận key. Một chuỗi đã dịch là một giá trị như mọi giá trị
khác; một key thì không — nó là một lời hứa rằng ở đâu đó có runtime dịch sẽ biến nó thành chữ.

Lý do: một component tra key đã nhận thêm phụ thuộc vào toàn bộ runtime dịch, cho một việc đã làm xong
cách đó một file. Cái giá hiện ra ở chỗ test: muốn kiểm một dòng chữ, phải dựng cả bộ dịch, và lúc đó
`SPLIT-1` cũng gãy theo.

**Nó sinh ra gì trong source.** Các prop biên mang chữ, khai trong `component.tsx` với kiểu `string` và
chứa câu chữ thật, được JSX trong `index.tsx` điền vào.

**Dấu hiệu nhận biết.**

- Prop tên `*Key`, hoặc một `*Id` mang nghĩa chữ, hoặc một chuỗi có dấu chấm phân cấp kiểu
  `quest.failed`.
- Nửa vẽ import bất cứ thứ gì từ tầng dịch.
- Có một chuỗi mà đọc lên không ra tiếng người.

Tự hỏi: chuỗi này đưa cho người đọc là đọc được ngay, hay còn phải qua một lần tra nữa?

**Ranh giới.** Nó không phải `SPLIT-1`: gọi hook dịch trong nửa vẽ là `SPLIT-1`, và truyền key xuống
để nửa vẽ tự tra cũng là `SPLIT-1`; nhưng truyền key xuống rồi truyền tiếp xuống nữa thì chỉ có
`SPLIT-4` bắt được. Chuỗi định danh không phải chữ — một `id`, một `slug`, một key chọn dòng băng qua
đường ranh là dữ liệu, và chúng băng qua thoải mái.

**Tình huống nghiệp vụ hay gặp.** Nhãn của một hàng số liệu; thông báo lỗi; chữ trên nút thử lại;
chuỗi số nhiều theo số lượng; nhãn trạng thái đơn hàng; tên đơn vị tiền tệ; nhãn "còn N ngày".

## `SPLIT-5` — nửa connected không tự vẽ gì

**Tình huống.** File connected import đúng `_${FolderName}` từ `./component`, và mọi nhánh JSX của nó
đều render đúng component đó. Không nhánh nào rẽ sang một leaf khác, một branch khác, hay một cây thay
thế.

Lý do: một file connected mà tự render một cây riêng đã trở thành cả hai nửa, và đường ranh mất nghĩa
ngay lần đầu bị vượt. Sau đó không ai còn nói được "review nửa này không cần đọc file kia" nữa, vì có
thể có thứ gì đó nằm bên kia.

**Nó sinh ra gì trong source.** Dòng `import { _X } from "./component"` trong `index.tsx`, với `X` là
tên folder, và `_X` là JSX identifier duy nhất mà file ấy render.

**Không có ngoại lệ cho block mỏng.** Chỉ một leaf, một cây giống nhau ở mọi trạng thái, không có
local domain state, hay một sinh đôi chỉ forward props — đó chính là những trường hợp dễ mọc thêm tình
huống thứ hai nhất. Chúng vẫn băng qua đúng cái sinh đôi ấy.

**Dấu hiệu nhận biết.**

- File connected có JSX identifier nào khác ngoài `_X`.
- File connected import `_X` nhưng có một nhánh `return` không đi qua nó.
- Có một nhánh sớm kiểu `if (error) return null` — nhánh đó vừa vẽ một thứ (không vẽ gì cũng là một
  quyết định trình bày) mà không băng qua sinh đôi.

Tự hỏi: mọi đường render của file này có băng qua đúng một component không?

**Ranh giới.** Nó không phải `SPLIT-2`, vốn là quyết định trình bày rò rỉ qua props chứ không phải
markup nằm trong file. Nó cũng không phải `SPLIT-6`: `SPLIT-5` chỉ áp cho surface có request, và bắt
một file chẳng đọc gì phải có sinh đôi là ngược lại với `SPLIT-6`.

**Tình huống nghiệp vụ hay gặp.** Block một dòng số liệu; card mỏng; một nút mở overlay có đếm số;
hàng danh sách có badge; widget chỉ hiện khi có dữ liệu.

## `SPLIT-6` — không có request thì không tách

**Tình huống.** Một component không fetch gì thì hai file là nghi lễ: không có nửa dữ liệu, nên file
thứ hai chẳng giữ điều gì mà file thứ nhất có thể làm sai.

Đây là chỗ luật dừng lại, và chính nó giữ cho năm mã kia không biến thành thủ tục. Đường ranh có giá
vì nó tách hai loại lỗi khác nhau; ở đâu chỉ có một loại lỗi, vạch thêm một đường chỉ tạo ra một file
phải mở thêm.

**Nó sinh ra gì trong source.** Một folder chỉ có `index.tsx` và không có `component.tsx`.

**Dấu hiệu nhận biết.**

- `index.tsx` không gọi request, không đọc store, không đọc locale — nó chỉ nhận props từ cha, hoặc
  ghép các surface connected khác lại.
- `component.tsx` chỉ có mỗi việc nhận props rồi truyền y nguyên xuống.
- Sửa một dòng phải mở hai file mà chưa lần nào hai file ấy sai vì hai lý do khác nhau.

Tự hỏi: file này có tự đi hỏi thế giới điều gì không? Nếu không — một file.

**Ranh giới.** Nó không phải `SPLIT-5`: ngay khi surface ấy thêm một request, `SPLIT-6` hết hiệu lực
và `SPLIT-5` bật lên, và đó là một lần tách file thật chứ không phải một lần đổi tên. State UI cục bộ
không phải request: giữ overlay nào đang mở hay tab nào đang chọn thì không đọc gì và không chốt tình
huống nào, nên không sinh ra nửa dữ liệu. Một surface ghép từ các surface connected thì tự nó không
connected: mỗi con tự chốt lấy tình huống của mình, cha không có gì để resolve nên không có sinh đôi.

**Tình huống nghiệp vụ hay gặp.** Rail ghép ba block; shell chia cột; tab container giữ tab đang chọn;
wrapper mở overlay; layout chỉ nhận children.

## Tầng giữ

Tầng nào thực sự giữ từng mã. `enforced` nêu tên rule trong `starci-eslint/packages/fe/the-split.mjs` bắt được nó;
`documented` nghĩa là không có gì máy móc giữ nó, chỉ người đọc giữ.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `SPLIT-1` | `enforced` | `presentational-purity` — báo mọi lời gọi mà callee khớp các họ request, store, locale và formatter, trong bất kỳ file nào tên `component.tsx` |
| `SPLIT-2` | `documented` | Không gì cả. Một file chốt sai tình huống và một file chốt đúng tình huống có cùng một cây cú pháp |
| `SPLIT-3` | `documented` | Không gì cả ở thời điểm viết. Một khi discriminated union ĐÃ được viết ra, kiểu dữ liệu làm cho object props mười sáu tổ hợp không viết được ở mọi call site — nhưng không rule nào bắt phải viết cái union ấy |
| `SPLIT-4` | `documented` | Không gì cả cho đúng nửa quan trọng. `presentational-purity` bắt được LỜI GỌI dịch trong nửa vẽ, mà cái đó đã là `SPLIT-1` rồi; một key băng qua dưới dạng prop `string` thì cây cú pháp không nhìn thấy |
| `SPLIT-5` | `enforced` | `connected-block-has-presentational-twin` — ba message cho ba kiểu hỏng: `missing` (không import sinh đôi), `bypass` (render thứ khác), `unused` (import sinh đôi nhưng không bao giờ render) |
| `SPLIT-6` | `documented` | Không gì cả. Một folder hai file trong khi một file là đủ vẫn là một chương trình đúng; chỉ người đọc mới thấy được file thứ hai chẳng giữ gì |

Hai trên sáu mã được enforce. Khoảng trống đó là tình trạng thật của luật này. Tầng lint giữ `SPLIT-1`
và `SPLIT-5`; người review giữ `SPLIT-2`, `SPLIT-3`, `SPLIT-4` và `SPLIT-6`, và không tầng nào khác
được ghi công là đang giữ chúng.

## Điểm neo

Code thật để đối chiếu từng mã. Đường dẫn tính theo repository; thứ được chỉ vào là hình dạng, không
phải folder của riêng sản phẩm nào.

| Mã | Đường dẫn | Nhìn cái gì |
|---|---|---|
| `SPLIT-1` | `src/components/**/component.tsx` | Import chỉ gồm component, type và helper thuần. Grep toàn cây các họ hook request, store, locale và formatter trên mọi `component.tsx` trả về rỗng — chính kết quả rỗng ấy là điểm neo, và mọi lần trúng đều là vi phạm mà rule đã báo sẵn |
| `SPLIT-2` | `src/components/**/index.tsx` có import `./component` | Không `className`, không giá trị spacing, không lựa chọn element ở bất cứ đâu trong file connected. Grep `className` trên mọi index connected và ra zero là phép kiểm; một prop kiểu `variant` đặt tên cho hình thức là phần điểm neo này không nhìn thấy được |
| `SPLIT-3` | `src/components/**/component.tsx` | Props type export là một union phân biệt bằng literal `state`. Kiểm ngược cùng những file ấy tìm `readonly isLoading?: boolean` và các cờ đi vào tương tự — mỗi lần trúng là một dòng đã băng qua dưới dạng cờ |
| `SPLIT-4` | Các prop biên khai trong `component.tsx`, và JSX điền chúng trong `index.tsx` | Prop mang chữ có kiểu `string` và chứa câu chữ. Không prop nào tên `*Key`, không literal namespace chấm nào bị truyền xuống. Một prop định danh kiểu `selectedKey` không phải copy và không tính là trúng |
| `SPLIT-5` | `src/components/**/index.tsx` và `starci-eslint/packages/fe/the-split.mjs` | `import { _X } from "./component"` với `X` là tên folder, và `_X` là JSX identifier duy nhất file ấy render. Matcher `connectedBlock` của rule chốt `X` từ folder, nên tên sinh đôi không phải một quy ước mà file được phép phát biểu lại kiểu khác |
| `SPLIT-6` | Folder chỉ có `index.tsx` và không có `component.tsx` | Index không gọi gì ra thế giới: nó ghép các surface connected khác, hoặc chỉ giữ state UI cục bộ như overlay nào đang mở. Việc vắng `component.tsx` chỉ đúng chừng nào việc vắng request còn đúng |

Một mã không có điểm neo là một đề xuất, không phải một luật. Cả sáu mã đều đã neo; không mã nào chưa
neo được.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| surface | Folder sở hữu request |
| request | Surface này có đọc thế giới hay không, hay nhận hết từ người gọi |
| situations | Tập đóng các trạng thái có tên mà request ấy sinh ra được |
| copy | Mỗi chuỗi hiển thị được resolve ở đâu |
| twin | Cái `_${FolderName}` mà folder chốt sẵn |

## Quy tắc

1. Mọi thứ có thể sai về dữ liệu nằm trong `index.tsx`; mọi thứ có thể sai về việc vẽ nằm trong
   `component.tsx`.
2. Thứ phân biệt là một câu hỏi: cái này có thể sai trong khi mạng vẫn tốt không?
3. Nửa vẽ render được từ một fixture, không cần dựng thế giới lên trước.
4. Một tình huống băng qua đường ranh dưới dạng một giá trị lấy từ tập đóng, không bao giờ dưới dạng
   nhiều boolean độc lập.
5. Chữ băng qua đường ranh ở dạng đã resolve.
6. Một file connected render đúng một JSX identifier của riêng nó: cái sinh đôi `_X` của nó.
7. Surface không có request thì một file.
8. Người review một bên không phải đọc file bên kia.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp vào.

- **Cờ nằm dưới đường ranh.** `SPLIT-3` cấm cờ BĂNG QUA. Trong nửa vẽ, suy `isLoading` ra từ `state`
  rồi đưa boolean ấy xuống một thứ presentational nhỏ hơn là việc của nửa vẽ.
- **State UI cục bộ không phải request.** `SPLIT-6` bật theo request. Giữ overlay nào đang mở, hay tab
  nào đang chọn, thì không đọc gì và không chốt gì, nên không tạo ra nửa dữ liệu.
- **Surface ghép từ các surface connected.** Theo `SPLIT-6`, một file mà mỗi đứa con tự giữ request
  của mình thì bản thân nó không giữ request nào: nó không có sinh đôi, vì nó chẳng có gì để resolve.
- **Sinh đôi chỉ forward props.** Không phải ngoại lệ của `SPLIT-5`. Một sinh đôi mà cả thân chỉ
  forward props vẫn là điểm băng qua, và nó chính là file mà state được thêm đầu tiên sẽ rơi vào.
- **Chuỗi định danh không phải copy.** Theo `SPLIT-4`, một id, một slug hay một key chọn dòng băng qua
  đường ranh là một giá trị như mọi giá trị khác. Cái bị cấm là chuỗi mà nửa vẽ còn phải đi tra.
- **Không có ngoại lệ nào cho "block này mỏng".** Với `SPLIT-5`, mỏng là lý do để tách, không phải lý
  do để bỏ qua.

## Đầu ra

Một block cho mỗi folder surface mà shape đã duyệt sinh ra.

```text
surface: <folder>
request: <yes | no>
files: <index.tsx + component.tsx | index.tsx only>
twin: <_X | none>
situations: <closed set of state names | none>
codes: <SPLIT-1..SPLIT-6, each holds | breaks>
reason: <which half could be wrong while the network is fine>
```

## Ví dụ đã giải

Shape đã duyệt: một rail tiến độ xếp ba block cạnh nhau, và một trong ba là block tiến độ khoá học —
nó đọc tiến độ của học viên rồi hiện ra dưới dạng đang tải, rỗng, hỏng kèm nút thử lại, hoặc một con
số đã hoàn tất.

Rail được giải trước, vì surface ngoài cùng phải bị hỏi `SPLIT-6` trước khi động tới đứa con nào.

```text
surface: ProgressRail
request: no
files: index.tsx only
twin: none
situations: none
codes: SPLIT-1 holds | SPLIT-2 holds | SPLIT-3 holds | SPLIT-4 holds | SPLIT-5 holds | SPLIT-6 holds
reason: the rail composes three connected children and reads nothing itself, so it owns no half that could be wrong while the network is fine
```

Sự thật loại trừ mã kề bên: `SPLIT-5` lẽ ra đòi một sinh đôi `_ProgressRail`, nhưng `SPLIT-5` chỉ áp
cho surface có request, còn file này không gọi gì ra thế giới — xếp ba đứa con mà mỗi đứa tự chốt tình
huống của mình thì không phải một request.

```text
surface: CourseProgress
request: yes
files: index.tsx + component.tsx
twin: _CourseProgress
situations: pending | empty | failed | settled
codes: SPLIT-1 holds | SPLIT-2 holds | SPLIT-3 holds | SPLIT-4 holds | SPLIT-5 holds | SPLIT-6 holds
reason: the request, the settled situation and the resolved words could be wrong while the tree is fine, and the tree, the seams and a missing state could be wrong while the network is fine
```

Sự thật loại trừ mã kề bên: `SPLIT-6` lẽ ra giữ nó ở một file, nhưng surface này tự đọc thế giới, và
một khi có request là có nửa dữ liệu — nên đường tách là thật và `SPLIT-5` bật lên cùng với nó. Bốn
tình huống băng qua dưới một cái tên `state` chứ không phải `isLoading`, `hasError` và `isEmpty`, đó
là thứ giữ cho `SPLIT-3` không bị phá; chữ trên nút thử lại băng qua dưới dạng một câu chứ không phải
một key, đó là thứ giữ cho `SPLIT-4` không bị phá.

Shape đã duyệt không nói gì, và vì thế không giải quyết gì, ở những chỗ này: nó không nói rail là một
file còn block là hai, không đặt tên `_CourseProgress`, không nói bốn trạng thái băng qua dưới một
`state` phân biệt duy nhất, và không nói chữ thử lại tới nơi đã dịch sẵn. Từng điều một trong số đó
được chốt ở đây, bởi các mã, chứ không phải bởi shape.

## Phạm vi

Quy tắc này đúng cho mọi code frontend thuộc loại này trong stack này. Nó không nêu tên sản phẩm nào,
tính năng nào, thư viện component nào, registry key nào hay repository nào. Mọi ví dụ đều là TSX bình
thường với props bình thường.
