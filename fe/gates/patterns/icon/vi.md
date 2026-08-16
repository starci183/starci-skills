---
id: fe-patterns-icon-vi
title: vi.md
slug: /gates/patterns/icon/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống ICON-N, nhận diện bằng nghiệp vụ chứ không bằng kích thước trên màn hình.
---

# vi.md

> Version: `2.00` · Module: `icon`

# Icon

Icon là **một ý nghĩa sản phẩm đã đóng**, được vẽ ra qua **một** bộ từ vựng glyph duy nhất. Người gọi
nói glyph đó **NGHĨA LÀ GÌ** và nó **đang làm việc gì**; chỉ riêng icon leaf mới chọn hình vẽ cụ thể.

Đừng chọn icon bằng câu "chỗ này trông trống" hay "cái này hơi to". Hãy nhìn vào chỗ glyph sắp đứng
và hỏi:

> Nó đang **mở đầu một vùng**, **dẫn một control/row bình thường**, hay **nằm trong một chip gọn**?

Ba câu trả lời đó là ba vai trò, và bộ từ vựng đã vẽ **ba bản khác nhau** cho ba việc đó. Phóng to
bản micro không tạo ra bản 24, vì hình học được vẽ cho một optical size khác — CSS không phục hồi
được thứ chưa từng có trong đường vẽ.

**Đây là luật bắt buộc.** Không có glyph nào nhỏ đến mức được miễn. Câu "chỉ có mỗi cái caret thôi
mà" chính là ca đã sinh ra luật này: một leaf import thẳng từ package glyph, ở một size lệch cả hai
bậc và một cut mà icon leaf không hề cung cấp — và **không có gì báo cả**.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `ICON-1` | Chọn vai trò cho một glyph | `heading` · `leading` · `chip`, không có bậc thứ tư |
| `ICON-2` | Glyph mở đầu một vùng nội dung | bản 24 outline, `size-6` |
| `ICON-3` | Glyph dẫn một row, tab, field, icon control | bản outline, `size-5` |
| `ICON-4` | Glyph nằm trong một chip đã có vỏ riêng | bản 16 solid micro, `size-4` |
| `ICON-5` | Glyph nằm trong vùng có state (disabled, muted, selected) | `currentColor`; chỉ brand mark giữ màu gốc |
| `ICON-6` | Một màn cần một hình mới | gọi tên **ý nghĩa**, không import component glyph |
| `ICON-7` | Có người muốn thêm bộ icon khác | hai family, không có family thứ ba |
| `ICON-8` | Row hẹp lại, chữ dài ra | `shrink-0`; chữ nhường trước |
| `ICON-9` | Thêm một ý nghĩa mới vào sản phẩm | thêm một dòng vào bảng nguồn, cùng lúc với union và map |
| `ICON-10` | Ô số liệu, mục tiêu, nhãn loại, caption streak | giữ **text-only** |
| `ICON-11` | Glyph nằm trên một plate (icon tile) | luôn là `leading` `size-5`; chỉ plate đổi |
| `ICON-12` | Row tóm tắt đứng một mình dưới một heading | **không** icon; fact phụ để `text-xs muted` |
| `ICON-13` | Reaction của người dùng | artwork đã check-in, truyền bằng **identity** |

---

## `ICON-1` — ba vai trò, không có bậc thứ tư

**Tình huống.** Người gọi cần một glyph. Thứ họ được phép quyết định là **việc glyph đang làm**, chứ
không phải kích thước của nó.

**Dấu hiệu nhận biết**

- Có người muốn truyền `size`, một class `size-*`, một `strokeWidth`, hay một con số px.
- Có người mô tả nhu cầu bằng "to hơn một chút", "nhỏ hơn cái kia".
- Xuất hiện một bậc nằm giữa hai bậc đang có.

**Tự hỏi.** Tôi đang mô tả một **công việc** hay một **kích thước**? Nếu là kích thước, tôi đang tạo
ra bậc thứ ba.

**Ranh giới**

- ↔ `ICON-2/3/4`: `ICON-1` nói **có đúng ba vai trò**; ba mã kia nói **mỗi vai trò vẽ bằng bản nào**.
- ↔ `ICON-11`: plate to hay nhỏ **không** phải một vai trò. Đó là kích thước của cái đĩa, không phải
  của glyph.

**Tình huống nghiệp vụ hay gặp.** Một caret trong disclosure · icon trong nút · icon đầu row menu ·
icon trong empty state · icon cạnh nhãn trạng thái.

---

## `ICON-2` — glyph mở đầu một vùng

**Tình huống.** Glyph đứng trước một tiêu đề vùng, một empty state, một khối giới thiệu. Nó **giới
thiệu** chứ không **dẫn**.

**Dấu hiệu nhận biết**

- Bên cạnh nó là một heading thật, không phải một dòng chữ trong danh sách.
- Vùng đó có thể rỗng, và lúc rỗng glyph là thứ đầu tiên người đọc thấy.
- Nếu bỏ glyph đi, vùng vẫn đúng, chỉ khó định vị hơn.

**Tự hỏi.** Glyph này đang mở đầu một **vùng**, hay đang dẫn **một dòng**?

**Ranh giới**

- ↔ `ICON-3`: heading không phải leading phóng to. Hai bản vẽ khác nhau, không phải cùng một bản ở hai
  cỡ.
- ↔ `ICON-4`: lấy bản micro rồi cho nó cái hộp 24px là ca sai kinh điển — hộp đúng, nét sai.

**Tình huống nghiệp vụ hay gặp.** Empty state của một danh sách · header của một section lớn · panel
giới thiệu tính năng · màn hình lỗi toàn trang.

---

## `ICON-3` — glyph dẫn một control hoặc một row

**Tình huống.** Glyph đứng trước chữ trong điều hướng, list row, field, switch, icon control. Nó **dẫn
lối**, không đòi trọng lượng của một heading.

**Dấu hiệu nhận biết**

- Nó lặp lại nhiều lần trong cùng một cây, mỗi lần một ý nghĩa khác.
- Nó nằm cùng dòng với chữ, không đứng trên chữ.
- Bỏ nó đi thì cả cụm vẫn đọc được, chỉ chậm hơn khi quét mắt.

**Tự hỏi.** Đây là **một hàng trong một tập**, hay là **cửa vào một vùng**?

**Ranh giới**

- ↔ `ICON-2`: xem trên.
- ↔ `ICON-12`: `ICON-3` nói leading **vẽ bằng gì**; `ICON-12` nói leading **được phép xuất hiện ở
  đâu**. Một row tóm tắt đứng một mình vẫn là `size-5` nếu có glyph — nhưng `ICON-12` bảo nó **không
  nên có**.

**Tình huống nghiệp vụ hay gặp.** Tab điều hướng · row trong menu tài khoản · icon trong ô input ·
nút chỉ có icon · dropdown item · breadcrumb.

---

## `ICON-4` — glyph trong một chip

**Tình huống.** Chip đã có vỏ riêng: nền, bo góc, padding. Glyph bên trong chỉ còn việc đọc được ở
kích thước rất nhỏ.

**Dấu hiệu nhận biết**

- Vỏ chip đã tự nói ranh giới; glyph không cần nét mảnh để "nhẹ" nữa.
- Ở `size-4`, nét outline 24 bị nhoè thành một vệt xám.
- Bản micro có ít chi tiết hơn hẳn — đó là chủ ý của người vẽ, không phải thiếu sót.

**Tự hỏi.** Cái hộp 16px này đang chứa **bản vẽ cho 16px**, hay một bản vẽ cho 24px bị ép vào?

**Ranh giới**

- ↔ `ICON-2`: hai đầu đối lập của cùng một sai lầm — một bên phóng bản nhỏ, một bên ép bản lớn.
- ↔ family `mini` 20px: mini **không** phải chip. Kích thước gần đúng không phải là family đúng.

**Tình huống nghiệp vụ hay gặp.** Badge trạng thái · tag đã lọc · nút đóng trên chip · chip số lượng ·
nhãn "mới" · pill hiển thị tiến độ.

---

## `ICON-5` — glyph thừa hưởng màu

**Tình huống.** Glyph nằm trong một vùng đang mang state: disabled, muted, selected, theme tối. Màu
của nó **thuộc về vùng đó**, không thuộc về nó.

**Dấu hiệu nhận biết**

- Chữ bên cạnh đổi màu theo state, glyph thì không.
- Có người viết `text-*` hoặc `fill="#..."` ngay trên glyph để "cho hợp".
- Ở theme tối, glyph vẫn còn màu của theme sáng.

**Tự hỏi.** Màu này đang nói **state của vùng**, hay đang nói **danh tính của một thương hiệu**?

**Ranh giới**

- Brand mark là **ngoại lệ đóng**: một mark nhiều màu được nhận ra **nhờ** những màu đó, đổi màu là
  đổi mark. Mark đơn sắc vẫn dùng `currentColor`.
- ↔ `ICON-13`: artwork reaction vốn nhiều màu và không phải glyph ngữ nghĩa; nó nằm ngoài mã này.

**Tình huống nghiệp vụ hay gặp.** Icon trong nút disabled · icon trong tab đang chọn · icon trong
callout lỗi · icon nhà cung cấp đăng nhập · icon trong menu hover.

---

## `ICON-6` — người gọi nói ý nghĩa, không nói vendor

**Tình huống.** Một màn cần một hình mà bản đồ ý nghĩa chưa có. Đường tắt là import thẳng từ package
glyph ngay tại chỗ.

**Dấu hiệu nhận biết**

- Trong một file màn hình có `import { XxxIcon } from "..."`.
- Một file "phụ trợ" cạnh icon leaf cũng import package đó "cho tiện".
- Cùng một khái niệm được vẽ bằng hai hình khác nhau ở hai màn.

**Tự hỏi.** Ở đây tôi đang trả lời **ba** câu hỏi cùng lúc — thư viện nào, hình nào, to bao nhiêu —
mà đáng lẽ chỉ phải trả lời **một**?

**Ranh giới**

- ↔ `ICON-7`: `ICON-6` là **ở đâu được import**; `ICON-7` là **được import cái gì**. Một file đúng
  chỗ mà gọi sai package thì `ICON-6` im lặng, `ICON-7` mới bắt.
- ↔ `ICON-9`: khi không có ý nghĩa nào khớp, đáp án là **thêm một ý nghĩa**, chứ không phải import.

**Tình huống nghiệp vụ hay gặp.** Màn mới cần một mũi tên · file brand cần thêm một mark · một block
"tạm dùng" một icon khác · code copy từ ví dụ trên mạng.

---

## `ICON-7` — một vendor, hai family

**Tình huống.** Có người muốn thêm một bộ icon nữa: đẹp hơn, đủ hình hơn, hoặc "chỉ dùng đúng một
cái thôi".

**Dấu hiệu nhận biết**

- Trong `package.json` xuất hiện một thư viện glyph thứ hai.
- Một brand mark được chọn từ một package tổng hợp thay vì vẽ đúng.
- Có người lập luận "cái này bên kia không có" — đúng, và đó chính là lúc phải quyết định về **ý
  nghĩa**, không phải về **package**.

**Tự hỏi.** Tôi đang mở rộng **bảng ý nghĩa**, hay đang mở thêm một **ngôn ngữ hình** thứ hai?

**Ranh giới**

- ↔ `ICON-6`: xem trên. `ICON-7` áp dụng **cả bên trong** icon leaf, chỗ mà `ICON-6` cố ý không nhìn.
- Ngoại lệ artwork giải thưởng: đúng một file, đúng một package, đúng bốn identity. Cái thứ năm vẫn
  bị báo — ngoại lệ đó là **một bộ từ vựng**, không phải một cánh cửa.

**Tình huống nghiệp vụ hay gặp.** Thêm icon mạng xã hội · icon huy hiệu/giải thưởng · icon minh hoạ
marketing · icon file type · logo đối tác.

---

## `ICON-8` — glyph không bao giờ co lại

**Tình huống.** Một row flex hẹp dần: tên dài, ngôn ngữ dịch dài ra, màn hình nhỏ lại.

**Dấu hiệu nhận biết**

- Icon tròn biến thành hình bầu dục.
- Icon vuông bị dẹt ở một phía.
- Chữ vẫn còn nguyên trong khi glyph đã méo — tức là thứ tự nhường đang ngược.

**Tự hỏi.** Khi row hết chỗ, cái gì nhường trước: **chữ** hay **hình**? Câu trả lời luôn là chữ.

**Ranh giới**

- ↔ `ICON-1`: co méo không tạo ra một vai trò mới, nó chỉ phá vai trò đang có.
- ↔ luật text-expansion: chữ dài ra thì wrap hoặc truncate; đó là việc của chữ, không phải của glyph.

**Tình huống nghiệp vụ hay gặp.** Row có tên rất dài · nút có label dịch dài · breadcrumb trên mobile ·
chip trong một hàng cuộn ngang · toast có nhiều chữ.

---

## `ICON-9` — bảng nguồn sở hữu việc chọn hình

**Tình huống.** Thêm hoặc đổi một ý nghĩa. Câu hỏi "hình nào cho ý nghĩa này" có **đúng một** chỗ trả
lời.

**Dấu hiệu nhận biết**

- Union ý nghĩa có tên mới nhưng bảng nguồn thì chưa.
- Hai ý nghĩa khác nhau trỏ về cùng một hình "vì trông cũng hợp".
- Bảng còn tên một component đã đổi tên từ lâu.

**Tự hỏi.** Sau thay đổi này, một người **chưa từng đọc code** có tra được ý nghĩa → hình chỉ bằng
bảng không?

**Ranh giới**

- ↔ `ICON-6`: `ICON-6` chặn đường tắt; `ICON-9` mô tả con đường chính.
- ↔ `ICON-12`: bảng nói **hình nào**, `ICON-12` nói **có nên vẽ hay không**. Có dòng trong bảng không
  phải giấy phép đặt glyph ở mọi chỗ.

**Tình huống nghiệp vụ hay gặp.** Thêm một mục điều hướng · đổi tên một tính năng · gộp hai tính năng ·
thêm một trạng thái mới cho bài học.

---

## `ICON-10` — dữ kiện nghiệp vụ gọn thì để nguyên chữ

**Tình huống.** Một ô số liệu, một mục tiêu, một nhãn loại, một caption streak, một cell dữ kiện —
mà reference gốc **chỉ có chữ**.

**Dấu hiệu nhận biết**

- Glyph đang lặp lại đúng thứ mà chữ ngay cạnh đã nói (một quyển sách cạnh chữ "Nội dung").
- Trong một lưới, mỗi ô mọc một glyph khác nhau và tạo ra **một trục thị giác thứ hai**.
- Người thêm glyph giải thích bằng "cho đỡ trống", không phải bằng "để phân biệt".

**Tự hỏi.** Glyph này đang **đóng thêm** một ý nghĩa, hay đang **lặp lại** ý nghĩa mà chữ đã đóng?

**Ranh giới**

- Ngoại lệ đóng: các ngữ nghĩa **generic về state/action** mà reference thật sự có — complete, failed,
  pending, close, disclosure — vẫn được giữ.
- Điều hướng, entry point có tên, và heading của vùng rỗng lớn **vẫn giữ** glyph, vì ở đó glyph là một
  phần của việc **định vị** vùng.
- ↔ `ICON-12`: `ICON-10` nói về **ô dữ kiện lặp lại**; `ICON-12` nói về **row đứng một mình**.

**Tình huống nghiệp vụ hay gặp.** Ô tiến độ khoá học · mục tiêu tuần · nhãn loại nội dung · caption
chuỗi ngày học · lưới thống kê hồ sơ.

---

## `ICON-11` — plate đổi, glyph không đổi

**Tình huống.** Glyph nằm trên một đĩa nền (icon tile). Đĩa có hai bậc; glyph thì không.

**Dấu hiệu nhận biết**

- Có người muốn glyph "to theo" khi plate to lên.
- Cùng một ý nghĩa xuất hiện ở hai màn với hai trọng lượng khác nhau, chỉ vì plate khác nhau.
- Người gọi đang tự suy ra role từ `size` của tile.

**Tự hỏi.** Cái đang đổi là **khoảng thở của bề mặt**, hay **vai trò của glyph**?

**Ranh giới**

- ↔ `ICON-1`: plate không phải một vai trò thứ tư.
- ↔ `ICON-2`: một tile lớn vẫn không biến glyph thành heading; heading là **vị trí trong nội dung**,
  không phải đường kính của cái đĩa.

**Tình huống nghiệp vụ hay gặp.** Row khoá học có tile · quick action list · row thông báo · card
tính năng · item trong menu có nền.

---

## `ICON-12` — leading phải phân biệt được peer

**Tình huống.** Glyph leading chỉ có nghĩa khi nó giúp nhận ra **một** mục giữa **nhiều** mục khác
loại. Một row tóm tắt đứng một mình thì không có peer nào để phân biệt.

**Dấu hiệu nhận biết**

- Trong cả section chỉ có **một** row mang glyph.
- Section đã có heading nói đúng khái niệm mà glyph đang lặp lại.
- Cả tập là **đồng nhất** (mười row cùng loại) — lúc đó glyph giống nhau ở mọi row cũng không phân
  biệt được gì.

**Tự hỏi.** Nếu che hết chữ đi, glyph này có giúp tôi chọn đúng mục không? Nếu không có mục nào khác
để chọn — nó là trang trí.

**Ranh giới**

- ↔ `ICON-3`: `ICON-3` là **vẽ bằng gì**, `ICON-12` là **có được vẽ không**.
- ↔ `ICON-10`: `ICON-10` bảo vệ **ô dữ kiện lặp lại**; `ICON-12` bảo vệ **row đơn lẻ**. Một cái là
  lưới, một cái là dòng.

**Xử lý khi rơi vào mã này.** Render label chính bình thường, và fact phụ đứng cuối để `text-xs muted`.

**Tình huống nghiệp vụ hay gặp.** Row "Tổng số bài" dưới heading "Kỹ năng" · dòng tổng tiền dưới
heading "Thanh toán" · một dòng trạng thái duy nhất trong panel · header của một card đã có tiêu đề.

---

## `ICON-13` — reaction là artwork, không phải glyph

**Tình huống.** Người dùng bày tỏ cảm xúc. Đây là **artwork biểu cảm của sản phẩm**, không phải một
ký hiệu giao diện.

**Dấu hiệu nhận biết**

- Có người định render emoji Unicode "cho nhanh".
- Một call site truyền đường dẫn ảnh hoặc `<img>`.
- Có người muốn import cả bộ artwork đó như một catalogue glyph thứ hai.

**Tự hỏi.** Tôi đang truyền **identity của cảm xúc**, hay đang truyền **một tài nguyên**?

**Ranh giới**

- ↔ `ICON-7`: đây là một biên artwork **hẹp**. Nó không mở thêm vendor glyph; điều hướng, state và
  action vẫn thuộc bộ từ vựng duy nhất.
- ↔ `ICON-5`: artwork nhiều màu là bản chất của nó, nên `currentColor` không áp dụng.
- Emoji Unicode bị từ chối vì font mỗi nền tảng vẽ khác nhau — cùng một reaction sẽ là hai hình khác
  nhau trên hai máy.

**Tình huống nghiệp vụ hay gặp.** Reaction dưới bài viết · reaction trong feed hoạt động · tóm tắt
số lượng reaction · picker chọn reaction.

---

## Luật

1. Người gọi nói **ý nghĩa** và **vai trò**; icon leaf sở hữu vendor, family, hình vẽ và kích thước.
2. Đúng **ba** vai trò. Không có bậc thứ tư, không có size truyền từ ngoài vào.
3. Mỗi vai trò dùng **bản vẽ được vẽ cho nó**: 24 outline `size-6`, outline `size-5`, 16 solid
   `size-4`.
4. Glyph thừa hưởng màu; chỉ brand mark giữ màu gốc.
5. Chỉ **một** file được gọi tên thư viện glyph, và chỉ được gọi **hai** family.
6. Mọi vai trò mang `shrink-0`.
7. Một ý nghĩa ↔ một hình. Bảng nguồn, union và map đổi **cùng một lúc**.
8. Không thêm glyph trang trí vào dữ kiện nghiệp vụ gọn mà reference chỉ có chữ.
9. Glyph trên plate luôn là `leading`; chỉ plate đổi bậc.
10. Leading chỉ xuất hiện ở nơi nó **phân biệt được peer**.
11. Reaction và artwork giải thưởng là **tập đóng do một leaf sở hữu**, truyền bằng identity.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Brand mark giữ màu** (`ICON-5`). Mark nhiều màu được nhận ra nhờ chính những màu đó. Mark đơn sắc
  vẫn `currentColor`.
- **Brand mark là SVG cục bộ** (`ICON-7`). Vẽ đúng, trong thư mục icon — không chọn hình gần giống từ
  một package tổng hợp.
- **Ngữ nghĩa generic có trong reference** (`ICON-10`). complete, failed, pending, close, disclosure
  được giữ. Điều hướng, entry point có tên và heading vùng rỗng lớn cũng được giữ.
- **Artwork reaction** (`ICON-13`). Tập đóng, một leaf sở hữu, truyền bằng identity.
- **Artwork giải thưởng** (ngoại lệ có tên của `ICON-7`). Một file, một package, bốn identity. Cái thứ
  năm là một quyết định sản phẩm về **ý nghĩa của thứ hạng**, nên nó được quyết trong luật này chứ
  không phải trong file đó.
- **Parity trạng thái.** Skeleton, loading và nội dung thật giữ **cùng một vai trò**. Đổi role khi
  đang tải là nói dối về việc glyph đang làm gì.
