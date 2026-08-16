---
id: fe-patterns-the-split-vi
title: vi.md
slug: /fe/patterns/the-split/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống SPLIT-N, nhận diện bằng câu hỏi "sai được khi mạng vẫn tốt không".
---

# vi.md

> Version: `2.00` · Module: `the-split`

# The split

Một surface **tự đi lấy dữ liệu** thì có hai file. `index.tsx` gọi request, chốt xem người đọc đang ở
tình huống nào, và dịch sẵn chữ. `component.tsx` nhận một tình huống **đã được chốt** rồi vẽ nó.

Đây không phải chuyện xếp file cho gọn. Đây là một đường vạch ra để **mọi thứ có thể sai về DỮ LIỆU
nằm trong một file, mọi thứ có thể sai về VIỆC VẼ nằm trong file kia** — và người review một bên
không phải mở file bên kia.

Chỉ một câu hỏi quyết định một dòng code thuộc nửa nào:

> Dòng này có thể sai **trong khi mạng vẫn tốt** không?

Cây sai, seam sai, thiếu một trạng thái: đó là việc vẽ. Request sai, chốt nhầm tình huống, chọn nhầm
chữ: đó là dữ liệu.

**Đây là luật bắt buộc.** Mọi surface đọc thế giới đều bị sáu mã dưới đây soi, và mỗi mã hoặc giữ
được hoặc bị phá. Không có kích thước nào nhỏ đến mức được miễn: "có mỗi một leaf" và "chưa có state
nào đâu" chính là hai chỗ đường ranh bị vượt nhiều nhất, vì đó là hai chỗ mà **hôm nay** vượt qua
không tốn gì cả.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Nửa bị soi |
|---|---|---|
| `SPLIT-1` | Nửa vẽ nhận mọi thứ đã quyết định sẵn, không tự đi hỏi ai | `component.tsx` |
| `SPLIT-2` | Nửa connected chốt **tình huống**, không chốt cách nó trông ra sao | `index.tsx` |
| `SPLIT-3` | Tình huống băng qua đường ranh dưới dạng **một cái tên**, không phải một nắm cờ | Đường ranh |
| `SPLIT-4` | Chữ được dịch xong **trước khi** băng qua | Đường ranh |
| `SPLIT-5` | Nửa connected không tự vẽ gì; nó render đúng một `_X` sinh đôi | `index.tsx` |
| `SPLIT-6` | Surface không có request thì **không tách** | Cả folder |

---

## `SPLIT-1` — nửa vẽ nhận hết, không hỏi gì

**Tình huống.** `component.tsx` cần render được từ một fixture: đưa cho nó một object props là nó vẽ
ra đúng cái nó phải vẽ, không cần dựng request, không cần dựng store, không cần dựng runtime dịch.

Lý do không phải là "cho sạch". Một component không render được từ fixture thì **không test được**,
vì muốn test phải dựng cả thế giới lên trước. Chi phí đó không nằm ở lần viết đầu tiên; nó nằm ở mọi
lần sau, mỗi lần ai đó muốn kiểm một trạng thái.

**Dấu hiệu nhận biết**

- File `component.tsx` có gọi hook request, hook store, hook dịch, hook đọc locale hoặc formatter.
- Muốn viết test cho nó thì phải mock một cái gì đó không phải props.
- Trong file có `if` phân nhánh theo dữ liệu **chưa được đặt tên** — nó đang tự chốt tình huống.

**Tự hỏi.** Đưa cho file này một object props thuần, nó có vẽ đủ mọi trạng thái mà không cần thêm gì
không?

**Ranh giới**

- ↔ `SPLIT-2`: `SPLIT-1` nói nửa vẽ **không được hỏi**; `SPLIT-2` nói nửa connected **không được vẽ**.
  Hai chiều của cùng một đường, và một file có thể phá đúng một chiều.
- ↔ `SPLIT-4`: gọi `useTranslations` trong nửa vẽ phá cả hai — `SPLIT-1` vì nó đi hỏi thế giới,
  `SPLIT-4` vì chữ lẽ ra đã phải dịch xong cách đó một file.

**Tình huống nghiệp vụ hay gặp.** Hàng số liệu trên rail · thẻ tóm tắt đơn hàng · danh sách hoá đơn ·
khung kết quả tìm kiếm · bảng tiến độ · card khoá học · dòng thông báo.

---

## `SPLIT-2` — nửa connected chốt tình huống, không chốt cách trông

**Tình huống.** Nửa connected biết một điều mà không ai bên dưới biết: dữ liệu về rồi hay chưa, rỗng
hay có, hỏng hay lành. Nó **chốt tình huống** và đưa xuống. Nó không quyết định trạng thái đó trông
thế nào, cách nhau bao xa, hay element nào vẽ cái gì.

Lý do: nửa connected **không nhìn thấy hậu quả** của quyết định trình bày mà nó đưa ra. Nó không biết
cạnh nó có gì, không biết trạng thái kia trông ra sao, nên nó đang chọn một khoảng cách hoặc một biến
thể trong tình trạng mù. Nửa vẽ thì nhìn thấy cả cây.

**Dấu hiệu nhận biết**

- Trong `index.tsx` có `className`, có giá trị spacing, có tên biến thể hình thức.
- Nó truyền xuống một prop kiểu `size`, `tone`, `compact` mà không phải một sự kiện nghiệp vụ.
- Nó truyền xuống một chuỗi đã format sẵn **để cho vừa chỗ**, chứ không phải vì đó là con số thật.

**Tự hỏi.** Quyết định này có sai được khi mạng vẫn tốt không? Nếu có, nó thuộc nửa vẽ.

**Ranh giới**

- ↔ `SPLIT-1`: xem trên.
- ↔ `SPLIT-5`: `SPLIT-2` là **quyết định trình bày** rò rỉ qua props; `SPLIT-5` là **markup** nằm
  thẳng trong file connected. Truyền `variant="compact"` phá `SPLIT-2`; viết `<div>` phá `SPLIT-5`.

**Tình huống nghiệp vụ hay gặp.** Chờ dữ liệu · rỗng vì chưa có gì · rỗng vì lọc ra không ra gì ·
hỏng và cho thử lại · hết hạn · chưa đủ quyền · đã hoàn tất.

---

## `SPLIT-3` — tình huống băng qua dưới dạng một cái tên

**Tình huống.** Cái băng qua đường ranh là **một** giá trị lấy từ một tập đóng: `state="pending"`,
`state="failed"`, `state="settled"`. Không phải `isLoading`, `hasError`, `isEmpty` đi thành ba prop
song song.

Lý do là số học. Bốn cờ boolean mở ra mười sáu tổ hợp, mà phần lớn chưa ai từng thấy: đang tải **và**
lỗi **và** rỗng là một trạng thái không tồn tại, nhưng kiểu dữ liệu vẫn cho phép viết ra. Một cái tên
lấy từ union làm hai việc cùng lúc: mọi tình huống **có thật** đều bắt buộc phải được vẽ, và mọi tình
huống **không có thật** đều không viết ra được.

**Dấu hiệu nhận biết**

- Props của nửa vẽ có từ hai boolean độc lập trở lên mô tả cùng một vòng đời.
- Trong nửa vẽ có `if (isLoading) … else if (hasError) …` — thứ tự các nhánh đang **thay thế** cho
  một tập đóng.
- Có một tổ hợp cờ mà không ai trả lời được nó vẽ ra cái gì.

**Tự hỏi.** Có tổ hợp props nào viết ra được mà không tương ứng với tình huống thật nào không?

**Ranh giới**

- ↔ `SPLIT-2`: `SPLIT-2` hỏi *ai* chốt tình huống; `SPLIT-3` hỏi tình huống ấy **mang hình dạng gì**
  khi băng qua. Chốt đúng tình huống rồi vẫn có thể gửi nó đi dưới dạng một nắm cờ.
- **Cờ nằm dưới đường ranh thì hợp lệ.** Trong nửa vẽ, suy ra `isLoading` từ `state` rồi đưa xuống
  một thứ presentational nhỏ hơn là việc của nửa vẽ. Luật cấm cờ **băng qua**, không cấm cờ tồn tại.

**Tình huống nghiệp vụ hay gặp.** Vòng đời một request · rỗng-vì-chưa-có so với rỗng-vì-lọc · quyền
truy cập theo gói · phiên hết hạn · một ngày chưa tới so với một ngày trống · kết quả tìm kiếm.

---

## `SPLIT-4` — chữ được dịch xong trước khi băng qua

**Tình huống.** Nửa vẽ nhận **chữ**, không nhận **key**. Một chuỗi đã dịch là một giá trị như mọi giá
trị khác; một key thì không — nó là một lời hứa rằng ở đâu đó có runtime dịch sẽ biến nó thành chữ.

Lý do: một component tra key đã nhận thêm phụ thuộc vào toàn bộ runtime dịch, cho một việc đã làm
xong cách đó một file. Cái giá hiện ra ở chỗ test: muốn kiểm một dòng chữ, phải dựng cả bộ dịch, và
lúc đó `SPLIT-1` cũng gãy theo.

**Dấu hiệu nhận biết**

- Prop tên `*Key`, `*Id` mang nghĩa chữ, hoặc một chuỗi có dấu chấm phân cấp kiểu `quest.failed`.
- Nửa vẽ import bất cứ thứ gì từ tầng dịch.
- Có một chuỗi mà đọc lên không ra tiếng người.

**Tự hỏi.** Chuỗi này đưa cho người đọc là đọc được ngay, hay còn phải qua một lần tra nữa?

**Ranh giới**

- ↔ `SPLIT-1`: gọi hook dịch trong nửa vẽ là `SPLIT-1`. Truyền key xuống mà nửa vẽ tự tra thì cũng là
  `SPLIT-1`; nhưng truyền key xuống **rồi truyền tiếp xuống nữa** thì chỉ có `SPLIT-4` bắt được.
- **Chuỗi định danh không phải chữ.** Một `id`, một `slug`, một key chọn dòng đang được highlight là
  dữ liệu, không phải copy. Chúng băng qua thoải mái.

**Tình huống nghiệp vụ hay gặp.** Nhãn của một hàng số liệu · thông báo lỗi · chữ trên nút thử lại ·
chuỗi số nhiều theo số lượng · nhãn trạng thái đơn hàng · tên đơn vị tiền tệ · nhãn "còn N ngày".

---

## `SPLIT-5` — nửa connected không tự vẽ gì

**Tình huống.** File connected import đúng `_${TênFolder}` từ `./component`, và **mọi nhánh JSX** của
nó đều render đúng component đó. Không nhánh nào rẽ sang một leaf khác, một branch khác, hay một cây
thay thế.

Lý do: một file connected mà tự render một cây riêng đã trở thành **cả hai nửa**, và đường ranh mất
nghĩa ngay lần đầu bị vượt. Sau đó không ai còn nói được "review nửa này không cần đọc file kia" nữa,
vì có thể có thứ gì đó nằm bên kia.

**Không có ngoại lệ cho block mỏng.** Chỉ một leaf, một cây giống nhau ở mọi trạng thái, không có
local domain state, hay một sinh đôi chỉ forward props — đó chính là những trường hợp **dễ mọc thêm
tình huống thứ hai nhất**. Chúng vẫn băng qua đúng cái sinh đôi ấy.

**Dấu hiệu nhận biết**

- File connected có JSX identifier nào khác ngoài `_X`.
- File connected import `_X` nhưng có một nhánh `return` không đi qua nó.
- Có một nhánh sớm kiểu `if (error) return null` — nhánh đó vừa vẽ một thứ (không vẽ gì cũng là một
  quyết định trình bày) mà không băng qua sinh đôi.

**Tự hỏi.** Mọi đường render của file này có băng qua đúng một component không?

**Ranh giới**

- ↔ `SPLIT-2`: xem trên.
- ↔ `SPLIT-6`: `SPLIT-5` chỉ áp cho surface **có** request. Một file không đọc gì thì không cần sinh
  đôi, và bắt nó có là ngược lại với `SPLIT-6`.

**Tình huống nghiệp vụ hay gặp.** Block một dòng số liệu · card mỏng · một nút mở overlay có đếm số ·
hàng danh sách có badge · widget chỉ hiện khi có dữ liệu.

---

## `SPLIT-6` — không có request thì không tách

**Tình huống.** Một component không fetch gì thì hai file là **nghi lễ**: không có nửa dữ liệu, nên
file thứ hai chẳng giữ điều gì mà file thứ nhất có thể làm sai.

Đây là chỗ luật **dừng lại**, và chính nó giữ cho năm mã kia không biến thành thủ tục. Đường ranh có
giá vì nó tách hai loại lỗi khác nhau; ở đâu chỉ có một loại lỗi, vạch thêm một đường chỉ tạo ra một
file phải mở thêm.

**Dấu hiệu nhận biết**

- `index.tsx` không gọi request, không đọc store, không đọc locale — nó chỉ nhận props từ cha, hoặc
  ghép các surface connected khác lại.
- `component.tsx` chỉ có mỗi việc nhận props rồi truyền y nguyên xuống.
- Sửa một dòng phải mở hai file mà chưa lần nào hai file ấy sai vì hai lý do khác nhau.

**Tự hỏi.** File này có tự đi hỏi thế giới điều gì không? Nếu không — một file.

**Ranh giới**

- **State UI cục bộ không phải request.** Giữ overlay nào đang mở, tab nào đang chọn thì không đọc gì
  và không chốt tình huống nào, nên không sinh ra nửa dữ liệu.
- **Surface ghép từ các surface connected thì tự nó không connected.** Mỗi con tự chốt lấy tình huống
  của mình; cha không có gì để resolve nên không có sinh đôi.
- ↔ `SPLIT-5`: ngay khi surface ấy **thêm** một request, `SPLIT-6` hết hiệu lực và `SPLIT-5` bật lên.
  Đó là một lần tách file thật, không phải một lần đổi tên.

**Tình huống nghiệp vụ hay gặp.** Rail ghép ba block · shell chia cột · tab container giữ tab đang
chọn · wrapper mở overlay · layout chỉ nhận children.

---

## Luật

1. Surface **có request** thì hai file: `index.tsx` chốt, `component.tsx` vẽ.
2. Nửa vẽ nhận hết và không hỏi gì: không request, không store, không locale, không runtime dịch.
3. Nửa connected chốt **tình huống**, không chốt hình thức.
4. Tình huống băng qua dưới dạng **một cái tên** trong tập đóng.
5. Chữ được dịch xong trước khi băng qua; key thì không băng qua.
6. Nửa connected import đúng `_${TênFolder}` từ `./component` và render nó ở **mọi** nhánh.
7. Surface **không có request** thì một file.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
vào.

- **Cờ nằm dưới đường ranh.** `SPLIT-3` cấm cờ **băng qua**. Trong nửa vẽ, suy `isLoading` ra từ
  `state` rồi đưa xuống một thứ nhỏ hơn là việc của nửa vẽ.
- **State UI cục bộ không phải request.** `SPLIT-6` bật theo request. Giữ overlay nào đang mở không
  đọc gì cả, nên không tạo ra nửa dữ liệu.
- **Surface ghép từ các surface connected.** Theo `SPLIT-6`, cha không sở hữu request nào nên không
  có sinh đôi; ba con tự trả lời theo nhịp riêng của chúng.
- **Sinh đôi chỉ forward props.** Không phải ngoại lệ của `SPLIT-5`. Nó vẫn là điểm băng qua, và nó
  chính là file mà tình huống thứ hai sẽ rơi vào.
- **Chuỗi định danh không phải copy.** Theo `SPLIT-4`, `id`, `slug`, key chọn dòng là dữ liệu. Cái bị
  cấm là chuỗi mà nửa vẽ còn phải đi tra.
- **Không có ngoại lệ nào cho "block này mỏng".** Với `SPLIT-5`, mỏng là lý do để tách, không phải lý
  do để bỏ qua.
