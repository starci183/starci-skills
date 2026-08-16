---
id: fe-principles-optical-vi
title: vi.md
slug: /gates/principles/optical/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống OPTICAL-N, mỗi mã kèm một phép đo có thể kiểm lại được.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `optical`

# Thị giác

Thị giác là chỗ **con mắt phủ quyết con số**.

Bố cục tính ra những con số: một khoảng đệm trong, một `size`, một bán kính, một cách canh. Gần như lúc nào
những con số đó cũng đúng và cứ thế mà dùng. Mô-đun này chỉ quản một tập rất hẹp: những trường hợp con
số **đúng về số học mà vẫn sai**, vì thứ được đo là cái **hộp**, còn thứ được đọc là **vệt mực nằm
trong hộp đó**.

Đây là mô-đun duy nhất cho phép cố ý sai lệch khỏi một giá trị đã đo. Quyền đó phải trả bằng bằng
chứng:

> Muốn nhúc nhích một con số, phải gọi tên được **mã** và **dấu hiệu đo được** mà mã đó sở hữu.

"Nhìn đẹp hơn" không phải dấu hiệu. "Nhìn hơi lệch" không phải dấu hiệu. Dấu hiệu là một khác biệt mà
người khác cầm thước đo lại được: khoảng sáng bên trái so với bên phải, dải cap-chiều cao so với tâm hộp,
khoảng đệm trong ở cạnh thẳng so với khoảng đệm trong ở góc chéo.

**Đây là luật bắt buộc.** Mọi đề nghị nhúc nhích đều rơi vào đúng một mã, và mã mà phần lớn đề nghị
rơi vào là `OPTICAL-0` — số đo giữ nguyên. Không có cú nhúc nhích nào nhỏ đến mức được miễn khai mã:
một `translate-x-px` trên biểu tượng là `OPTICAL-1`, đúng cùng một lý do mà cả chuỗi bán kính lồng nhau là
`OPTICAL-5`. Câu "có một điểm ảnh thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, và một điểm ảnh không tên
chính là thứ cấp phép cho một trăm điểm ảnh sau đó.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | `className` |
|---|---|---|
| `OPTICAL-0` | Số đo đúng, không có dấu hiệu nào được gọi tên | *không có class CSS ghi đè* |
| `OPTICAL-1` | Tâm tính ra không phải tâm mắt nhìn thấy | `translate-x-px`, `-translate-y-px`, `pl-*`/`pr-*` lệch |
| `OPTICAL-2` | Hộp bằng nhau nhưng khối lượng nhìn không bằng nhau | đổi `size-*` của dấu nhẹ hơn |
| `OPTICAL-3` | Hộp của chữ không phải mực của chữ | `leading-none` + `pt-*`/`pb-*` lệch, `items-baseline`, `mt-*` |
| `OPTICAL-4` | Chữ đang giãn theo một cỡ mà nó không còn đứng ở đó | `tracking-tight`, `tracking-tighter`, `tracking-wide` |
| `OPTICAL-5` | Góc lồng góc: bán kính trong suy ra từ bán kính ngoài và khoảng đệm trong | `rounded-*` trong = ngoài − khoảng đệm trong |
| `OPTICAL-6` | Nội dung phải giữ một cạnh dùng chung với dòng hoặc hàng khác | `-ml-*`, `-indent-*`, `tabular-nums`, `list-outside` |

---

## `OPTICAL-0` — số đo đúng, không nhúc nhích

**Tình huống.** Có ai đó (hoặc chính mình) muốn dịch một chút, to lên một chút, bo lại một chút. Đem
đo thì không có khác biệt nào để đo. Phán quyết là: **số học thắng**.

**Phép đo.** Chạy đúng phép đo của mã bị nghi ngờ. Khoảng sáng hai bên bằng nhau, dải cap nằm giữa
hộp, khoảng đệm trong ở cạnh thẳng bằng khoảng đệm trong ở góc chéo, mực đầu dòng của mọi dòng thẳng hàng. Không có
chênh lệch nào ⇒ `OPTICAL-0`.

**Dấu hiệu nhận biết**

- Dấu có hình dáng đối xứng cả hai trục: hình vuông, hình tròn đặc, chữ thập, dấu cộng.
- Bộ biểu tượng đã tự căn quang học sẵn trong viewBox — đo thấy sáng hai bên đã bằng.
- Khoảng đệm trong lớn hơn hoặc bằng bán kính ngoài, nên không còn góc lồng góc nào để đồng tâm.
- Chữ đang đứng đúng cỡ mà nhà thiết kế chữ vẽ khoảng cách cho nó.
- Lý do duy nhất đưa ra được là "nhìn nó đỡ hơn".

**Tự hỏi.** Nếu bây giờ đưa cho người khác cái thước, họ có đo ra được con số mà mình nói là sai
không? Nếu không — `OPTICAL-0`.

**Ranh giới**

- mọi mã khác: các mã kia đều đòi **một chênh lệch đo được**. `OPTICAL-0` là phán quyết khi chênh
  lệch đó không tồn tại, hoặc chưa ai đo.
- `OPTICAL-1`: biểu tượng đã được căn sẵn trong viewBox thì thêm `translate` là **nhân đôi sai số**, không
  phải sửa.
- `OPTICAL-5`: khoảng đệm trong ≥ bán kính ngoài thì bán kính trong là lựa chọn tự do, không phải phép trừ.

**Tình huống nghiệp vụ hay gặp.** Biểu tượng vuông đặc trong nút vuông · ảnh đại diện tròn trong khung tròn · hai
thẻ cùng cỡ đứng cạnh nhau · văn bản nội dung 14–16px · cột chữ mở đầu bằng một chữ cái thường · nhãn trạng thái chữ
hoa đã dùng đúng khoảng cách dòng của bộ chữ · ảnh bìa dán sát mép thẻ không có khoảng đệm trong.

---

## `OPTICAL-1` — tâm tính ra không phải tâm nhìn thấy

**Tình huống.** Một dấu được canh giữa bằng số học — `place-items-center`, `mx-auto`, khoảng đệm trong hai
bên bằng nhau — nhưng **vệt mực của nó không nằm giữa hộp của chính nó**. Hộp cân, mực lệch.

**Phép đo.** Đo khoảng sáng từ mép hộp tới mực, bên trái và bên phải (hoặc trên và dưới). Hai con số
khác nhau trong khi khoảng đệm trong khai báo bằng nhau ⇒ `OPTICAL-1`. Độ nhúc nhích đúng bằng **nửa chênh
lệch**, làm tròn xuống bước nhỏ nhất mắt kiểm được.

**Dấu hiệu nhận biết**

- Hình dáng lệch theo một trục: tam giác phát, biểu tượng chữ V, mũi tên gửi, cờ, dấu ngoặc.
- Dấu có side bearing — mực dừng trước mép viewBox ở một phía nhiều hơn phía kia.
- Một vùng trống rất lớn được chia đôi bằng nhau: nửa trên đọc ra to hơn nửa dưới dù số bằng nhau.
- Đổi `justify-center` thành `justify-start` rồi đo lại thì chênh lệch vẫn còn — nó nằm trong dấu,
  không nằm ở vùng chứa.

**Tự hỏi.** Khoảng sáng hai bên vệt mực có bằng nhau không, khi khoảng đệm trong khai báo đã bằng nhau?

**Ranh giới**

- `OPTICAL-2`: `OPTICAL-1` sửa **vị trí**, `OPTICAL-2` sửa **kích thước**. Dấu lệch chỗ thì dịch;
  dấu nhìn bé thì phóng. Đừng phóng để chữa lệch.
- `OPTICAL-3`: nếu thứ bị lệch là **chữ do phông chữ dựng**, thủ phạm là dòng hộp, không phải hình dáng
  ⇒ `OPTICAL-3`.
- `OPTICAL-6`: `OPTICAL-1` là **một dấu trong một hộp**. Nếu cạnh bị gãy là cạnh **dùng chung** của
  nhiều dòng hoặc nhiều hàng, đó là `OPTICAL-6`.
- `OPTICAL-0`: đo trước. Nhiều bộ biểu tượng đã căn sẵn.

**Tình huống nghiệp vụ hay gặp.** Nút phát tròn · nút gửi có mũi tên · nút chỉ có biểu tượng có biểu tượng chữ V ·
nút "Xem tất cả" có mũi tên đuôi làm khoảng đệm trong phải nhìn rộng hơn · nút quay lại · biểu tượng tam giác cảnh
báo trong ô tròn · hộp thoại canh giữa màn hình cao · biểu trưng dấu trong ô vuông · nút chuyển trang trước/
sau.

---

## `OPTICAL-2` — hộp bằng nhau, khối lượng không bằng nhau

**Tình huống.** Hai dấu khai `size` bằng nhau và **đọc ra không bằng nhau**, vì diện tích mực chúng
phủ trong hộp khác nhau: tròn thua vuông, nét thua đặc, mảnh thua dày.

**Phép đo.** So **diện tích mực** hoặc bề rộng thật của nét, không so cạnh hộp. Hình tròn nội tiếp phủ
π/4 ≈ **78,5%** diện tích hình vuông cùng cạnh. Biểu tượng nét 1,5px phủ ít mực hơn biểu tượng đặc cùng viewBox.
Chênh lệch đo được ⇒ `OPTICAL-2`; dấu nhẹ hơn được phóng cho tới khi hai khối lượng đọc bằng nhau.

**Dấu hiệu nhận biết**

- Trong một hàng có cả hình tròn và hình vuông cùng `size`, hình tròn đọc ra bé hơn.
- Biểu tượng `size-4` đứng cạnh `text-sm`: biểu tượng đọc ra hụt, vì hình vẽ chỉ chiếm khoảng 12–14 trong 16px của
  viewBox trong khi cap của chữ cao gần bằng ngần ấy.
- Trộn biểu tượng nét và biểu tượng đặc trong một thanh công cụ: biểu tượng nét đọc ra mờ và nhỏ hơn.
- Nút tròn và nút vuông cùng `size-9` trong một cụm: nút tròn đọc ra thấp bé hơn.

**Tự hỏi.** Hai dấu này phủ lượng mực bằng nhau, hay chỉ có hộp của chúng bằng nhau?

**Ranh giới**

- `OPTICAL-1`: xem trên. Sai vị trí thì dịch, sai khối lượng thì phóng — và nếu sai cả hai thì đó là
  **hai mã, hai thuộc tính**, không phải một cú nhúc nhích to.
- `OPTICAL-3`: biểu tượng **thấp/cao** so với chữ là `OPTICAL-3`; biểu tượng **bé** so với chữ là `OPTICAL-2`.
  Hỏi trục: sai trục dọc hay sai cỡ.
- `OPTICAL-4`: chữ nhìn nhẹ ở cỡ lớn là chuyện khoảng cách chữ, không phải khối lượng dấu.

**Tình huống nghiệp vụ hay gặp.** Chấm chú giải biểu đồ cạnh ô vuông chú giải · ảnh đại diện tròn cạnh
ảnh thu nhỏ vuông trong một hàng · biểu tượng trạng thái cạnh nhãn · thanh công cụ trộn biểu tượng nét và biểu tượng đặc · chấm
"đang hoạt động" cạnh nhãn trạng thái chữ · bullet tròn tự vẽ cạnh hộp kiểm vuông · nút tròn cạnh nút bo góc
trong một cụm hành động · dấu vạch chia trong ô tròn cạnh dấu vạch chia trong ô vuông.

---

## `OPTICAL-3` — hộp của chữ không phải mực của chữ

**Tình huống.** Một dòng chữ được canh giữa hoặc canh theo hộp của nó, nhưng hộp đó chứa cả phần trống
cho ascender và descender mà mắt **không nhìn thấy**. Kết quả: chữ đọc ra **thấp**, biểu tượng cạnh chữ đọc
ra **cao**, chữ hoa cạnh chữ thường đọc ra **lệch tầng**.

**Phép đo.** Đo dải từ **đường chân chữ lên cap-chiều cao** rồi so tâm của dải đó với tâm hộp. Với hầu hết bộ
chữ, phần trống dưới đường chân chữ lớn hơn phần trống trên cap, nên một dòng chữ canh giữa bằng số học nằm
**thấp hơn** tâm quang học khoảng 3–6% cỡ chữ. Chênh lệch đo được ⇒ `OPTICAL-3`.

**Dấu hiệu nhận biết**

- Chữ trong nhãn bo tròn hoặc nhãn trạng thái tròn đọc ra dính đáy, dù `py` trên dưới bằng nhau.
- Biểu tượng canh `items-center` cạnh một đoạn nhiều dòng: biểu tượng trôi về giữa cả khối thay vì đứng ngang dòng
  đầu.
- Chữ hoa và chữ thường trên một dòng canh `items-center`: cụm chữ hoa đọc ra tụt xuống.
- Số to cạnh đơn vị nhỏ canh `items-center`: đơn vị bay lên giữa thân số.
- Tiêu đề cỡ lớn tạo ra một khoảng trống "ma" phía trên cap mà không ai khai báo.

**Tự hỏi.** Thứ đang bị canh sai là **mực của chữ** hay là **hộp dòng** mà phông chữ phát ra quanh nó?

**Ranh giới**

- `OPTICAL-1`: `OPTICAL-1` là hình dáng của một dấu tự vẽ; `OPTICAL-3` là số liệu đo do phông chữ phát ra.
  Số "3" nằm thấp trong nhãn trạng thái tròn là `OPTICAL-3`, tam giác phát nằm lệch trái là `OPTICAL-1`.
- `OPTICAL-2`: xem trên — trục dọc so với cỡ.
- `OPTICAL-4`: `OPTICAL-3` sửa **chiều dọc** của chữ, `OPTICAL-4` sửa **chiều ngang**. Một dòng có
  thể cần cả hai; đó vẫn là hai mã trên hai thuộc tính.
- luật khoảng cách: khoảng trống ma phía trên tiêu đề được sửa **trên chữ** (`leading`), tuyệt đối
  không sửa bằng cách đổi khoảng cách giữa các phần tử giữa hai phần tử cùng cấp — khoảng cách giữa các phần tử thuộc luật khác.

**Tình huống nghiệp vụ hay gặp.** Nhãn trạng thái số thông báo · nhãn bo tròn trạng thái chữ hoa · chữ cái đầu trong
ảnh đại diện phương án dự phòng · biểu tượng cạnh một đoạn cảnh báo nhiều dòng · số liệu lớn cạnh đơn vị · giá cạnh chu kỳ ·
tiêu đề cỡ lớn đầu trang · nhãn thẻ tab chữ hoa · nút có `leading-none` và khoảng đệm trong trên dưới lệch · chữ
hoa tiếng Việt có dấu trong ô hẹp.

---

## `OPTICAL-4` — chữ đang giãn theo một cỡ nó không còn đứng

**Tình huống.** Khoảng cách giữa các chữ cái do bộ chữ vẽ sẵn cho một khoảng cỡ nhất định, thường là
cỡ đọc. Đem nguyên khoảng cách ấy lên cỡ hiển thị lớn thì đọc ra **rời rạc**; đem xuống cỡ rất nhỏ
hoặc chuyển sang chữ hoa thì đọc ra **dính**.

**Phép đo.** So tỉ lệ **khoảng cách giữa hai chữ cái trên chiều cao cap** ở hai cỡ. Tỉ lệ không đổi
trong khi cỡ tăng gấp ba là dấu hiệu: mắt đọc khoảng cách theo tỉ lệ với chiều cao, nên cùng một tỉ lệ
ở 48px đọc ra rộng hơn ở 16px. Chênh lệch đo được ⇒ `OPTICAL-4`.

**Dấu hiệu nhận biết**

- Chữ từ `text-3xl` trở lên đọc ra rời, nhất là ở tiêu đề ngắn.
- Nhãn chữ hoa cỡ 10–12px đọc ra dính thành một khối đặc.
- Cùng một chuỗi ở hai cỡ trong hai vị trí, cỡ lớn nhìn "loãng" hơn.
- Một đoạn phần thân 14–16px bị nới `tracking` để "cho thoáng" — đây là dấu hiệu của lỗi, không phải của sửa.

**Tự hỏi.** Cỡ chữ này có còn là cỡ mà khoảng cách của bộ chữ được vẽ cho không?

**Ranh giới**

- `OPTICAL-3`: dọc so với ngang, xem trên.
- `OPTICAL-6`: chữ số đang giữ một cột **không bao giờ** được nới hay siết khoảng cách; cột thuộc
  `OPTICAL-6`, và nới `tracking` lên trên cột là phá lại đúng cái cạnh vừa sửa.
- `OPTICAL-0`: văn bản nội dung ở cỡ đọc là `OPTICAL-0`. Bộ chữ đã vẽ đúng cho chính cỡ đó.

**Tình huống nghiệp vụ hay gặp.** Tiêu đề vùng nổi bật · số liệu rất lớn trên bảng điều khiển · nhãn phần nội dung chữ
hoa · chữ trên nút cỡ nhỏ · tên thương hiệu đặt cỡ lớn · trích dẫn cỡ hiển thị · nhãn dẫn phía trên
tiêu đề · nhãn trục biểu đồ.

---

## `OPTICAL-5` — góc lồng góc

**Tình huống.** Một hộp bo góc nằm trong một hộp bo góc, cách nhau bằng khoảng đệm trong. Cho hai hộp cùng bán
kính là phép làm đúng số học và **sai hình học**: hai cung không đồng tâm, nên vành khoảng đệm trong không còn
đều.

**Phép đo.** Đo bề dày vành khoảng đệm trong ở **cạnh thẳng** và ở **đường chéo 45°**. Đồng tâm thì hai con số
bằng nhau. Với vành 8px và bán kính ngoài 16px:

| Bán kính trong | Vành ở cạnh thẳng | Vành ở góc chéo |
|---|---|---|
| ngoài − khoảng đệm trong = 8px (đúng) | 8,0px | 8,0px |
| bằng ngoài = 16px (sai) | 8,0px | ≈ 11,3px — góc **rỗng** |
| vuông = 0px (sai) | 8,0px | ≈ 4,7px — góc **bóp** |

Chênh lệch giữa hai cột ⇒ `OPTICAL-5`.

**Dấu hiệu nhận biết**

- Ảnh, ô nhập liệu, thẻ tab hoặc thẻ con nằm trong một khung bo góc có khoảng đệm trong.
- Nhìn vào góc thấy vành khoảng đệm trong nở ra hoặc thắt lại so với cạnh.
- Có nhiều tầng lồng nhau và mỗi tầng đang lặp lại đúng một class CSS bán kính.

**Tự hỏi.** Hai cung này có chung một tâm không?

**Ranh giới**

- `OPTICAL-0`: khoảng đệm trong ≥ bán kính ngoài ⇒ không còn góc lồng góc; bán kính trong là lựa chọn tự do.
- `OPTICAL-0` (hình tròn): `rounded-full` trong `rounded-full` là **đúng**, không phải lười — trừ một
  hằng số vào một hình tròn vẫn ra hình tròn.
- `OPTICAL-2`: bán kính không phải khối lượng. Bo tròn hơn để "nhìn nhẹ hơn" là đổi ngôn ngữ hình
  dạng, không phải sửa quang học.

**Tình huống nghiệp vụ hay gặp.** Ảnh bìa trong thẻ có khoảng đệm trong · ô nhập liệu trong một khung gộp · thẻ tab nhãn bo tròn
trong danh sách thẻ tab bo góc · ảnh đại diện có vòng · nhãn trạng thái trong thẻ · nút trong một thanh công cụ bo góc · ô mã
trong một khối tài liệu · ảnh thu nhỏ trong danh sách phần tử bo góc · thẻ trong một khung bo góc.

---

## `OPTICAL-6` — cạnh dùng chung

**Tình huống.** Nhiều dòng, nhiều hàng hoặc nhiều ô cùng phải giữ **một cạnh**. Hộp của chúng đã thẳng
hàng đúng số học, nhưng **mực** thì không: dấu câu, dấu ngoặc, chữ số có bề rộng khác nhau, dấu
danh sách, khoảng đệm trong của thành phần điều khiển — tất cả đẩy chữ ra khỏi cạnh mà mắt đang đọc.

**Phép đo.** Đo vị trí ngang của **vệt mực đầu tiên** (hoặc cuối cùng) trên từng dòng, từng hàng. Các
con số không bằng nhau trong khi hộp đã thẳng ⇒ `OPTICAL-6`. Với chữ số, đo bề rộng của chuỗi `111` và
`000` trong cùng bộ chữ: khác nhau tức là bộ số không đều và cột sẽ nhảy.

**Dấu hiệu nhận biết**

- Dòng mở đầu bằng dấu ngoặc kép, dấu ngoặc đơn hoặc dấu gạch đầu dòng: dòng đó thụt vào so với dòng
  dưới dù cùng một `padding-left`.
- Cột số canh phải nhảy trái nhảy phải mỗi khi dữ liệu đổi.
- Nút "ghost" đặt dưới một đoạn văn: chữ trong nút thụt vào bằng đúng `px` của nút.
- Dấu danh sách nằm trong cột chữ và đẩy dòng đầu lệch khỏi các dòng sau.
- Số thứ tự hai chữ số làm lệch mọi dòng của một danh sách đánh số.

**Tự hỏi.** Cạnh này có phải là cạnh mà **nhiều dòng hoặc nhiều hàng cùng phải giữ** không? Nếu chỉ có
một dấu trong một hộp thì đó là `OPTICAL-1`.

**Ranh giới**

- `OPTICAL-1`: một dấu trong hộp của nó là `OPTICAL-1`; một cạnh chung của một cột là `OPTICAL-6`.
- `OPTICAL-4`: đừng dùng `tracking` để sửa cột số. `tabular-nums` sửa nguyên nhân; `tracking` chỉ
  chuyển sai lệch sang chỗ khác.
- luật khoảng cách: kéo âm ở đây là để **trả chữ về cạnh**, không phải để bóp khoảng cách giữa các phần tử. Nếu con số âm
  lớn hơn khoảng đệm trong của chính thành phần điều khiển đó, chuyện đang xảy ra là đổi bố cục.

**Tình huống nghiệp vụ hay gặp.** Trích dẫn mở bằng dấu ngoặc kép · cột tiền canh phải · bảng số liệu ·
danh sách đánh số quá 9 mục · bullet danh sách trong bài viết · nút văn bản canh theo cột chữ · nhãn phần
trăm trong một cột · mã đơn hàng canh phải · thời lượng dạng `mm:ss` trong danh sách · đơn vị tiền tệ
đứng sau chữ số.

---

## Luật

1. Mọi đề nghị nhúc nhích phải gọi tên **một mã** và **một dấu hiệu đo được**.
2. Phán quyết mặc định là `OPTICAL-0`. Số học thắng cho đến khi có phép đo nói ngược lại.
3. Một lần ghi đè sửa **một thuộc tính**, trên **một phần tử** mang dấu hiệu đó.
4. Đơn vị xét là **một dấu hiệu trên một thuộc tính**, không phải một phần tử. Hai dấu hiệu ⇒ hai mã.
5. Độ lớn của ghi đè bằng bước nhỏ nhất xoá được chênh lệch đã đo. Lớn hơn thế là đổi bố cục.
6. Ghi đè quang học **không bao giờ** đụng vào khoảng cách giữa các phần tử giữa các phần tử cùng cấp.
7. Ghi đè ngang phụ thuộc hướng phải lật cho RTL, nếu không thì nó sai ở RTL.
8. Khung chờ và nội dung thật mang cùng một mã.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Đã sửa sẵn ở thượng nguồn.** Một số bộ biểu tượng căn quang học ngay trong viewBox, một số bộ chữ phát
  em hộp đã cân theo cap. Đo trước: sáng hai bên đã bằng thì đó là `OPTICAL-0`, và sửa thêm một lần
  nữa là **nhân đôi** sai số.
- **Hình tròn.** Phép trừ của `OPTICAL-5` suy biến: `rounded-full` trong `rounded-full` là đúng.
- **Khoảng đệm trong ≥ bán kính ngoài.** Không còn góc lồng góc nào để đồng tâm ⇒ `OPTICAL-0`.
- **Chữ hoa có dấu.** Chữ hoa tiếng Việt đội dấu **cao hơn cap-chiều cao**. Một ghi đè `OPTICAL-3` đo trên
  chuỗi không dấu sẽ cắt dấu hoặc lệch tâm ngay khi gặp nội dung thật. Phải đo trên chuỗi cao nhất mà
  phần tử có thể hiển thị.
- **Chữ số đang giữ cột.** `OPTICAL-4` không áp lên chữ số phải thẳng hàng; `OPTICAL-6` sở hữu chúng.
- **Hai mã cùng khớp.** Chúng không tranh nhau. Gọi tên thuộc tính đang sửa; mã sở hữu thuộc tính đó thắng.
  Nếu hai thuộc tính cùng sai thì đó là hai mã và hai ghi đè, không phải một cú nhúc nhích to hơn.
- **Trạng thái.** Ghi đè không đổi theo khung nhìn, chủ đề hay trạng thái tải, trừ khi bản thân dấu đổi.
