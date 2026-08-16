---
id: be-patterns-module-layering-vi
title: vi.md
slug: /be/patterns/module-layering/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống LAYERING-N, nhận diện bằng đường đi của phụ thuộc chứ không bằng cảm giác import gọn hay dài.
---

# vi.md

> Version: `2.00` · Module: `module-layering`

# Module layering

Một **capability** là một thư mục sở hữu **một** chủ thể. Luật này không nói về những gì nằm bên
trong capability; nó nói về **đường nối giữa các capability**: một import được phép gọi tên gì, một
capability được phép nói gì về chính nó, và một phụ thuộc bắc ngang giữa hai capability được nối ở đâu.

Cả năm mã đều tồn tại vì lý do giống nhau:

> Mọi cách khác đều sinh ra vòng lặp phụ thuộc.

Đó không phải loại vòng lặp ồn ào mà compiler bắt được, mà là loại **im lặng**: capability với tay vào
ruột của chính nó qua cửa chính, một barrel kéo theo cả đồ thị import mà không ai yêu cầu, hoặc một
module gọi thẳng sang module hàng xóm để rồi hai bên **không còn khởi động rời nhau được nữa**. Vòng
lặp kiểu đó không làm gì đỏ lên ngay. Nó chỉ khiến mọi câu hỏi về sau khó trả lời hơn, cho tới ngày
một unit spec khởi động luôn database driver mà không ai chỉ ra được import nào đã yêu cầu điều đó.

Câu hỏi chốt một ca:

> Nếu bê file này sang một repository khác **cùng với capability của nó**, nó có còn đọc được không?

Nếu file gọi tên một barrel, với ngang sang hàng xóm, hoặc trỏ về chính mình qua alias công khai thì
câu trả lời là không. Lý do là file đó **đang giữ một phụ thuộc mà nó chưa bao giờ khai báo**.

**Đây là luật bắt buộc.** Mọi import specifier và mọi khai báo `@Module` đều thuộc đúng một mã dưới
đây. Không có import nào nhỏ đến mức được miễn: một file re-export hai dòng vẫn thuộc `LAYERING-5`,
đúng như một application root thuộc `LAYERING-4`. Câu "có mỗi một symbol, ngay bên cạnh thôi mà" là
nơi luật này bị bỏ qua nhiều nhất — và import "ngay bên cạnh" đó có thể đã bước qua một ranh giới.

Hai trong năm mã có lint rule đứng sau; ba mã còn lại chỉ có người đọc. Bảng `Tầng giữ` trong
[`INDEX.md`](./INDEX.md) nói rõ mã nào thuộc loại nào — nó không giả vờ rằng cả năm được giữ như
nhau.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Đường đi phải là |
|---|---|---|
| `LAYERING-1` | Đang lấy một symbol từ capability khác | Specifier chạm tới **file khai báo**, không dừng ở thư mục capability |
| `LAYERING-2` | Đang lấy một symbol từ **chính capability của mình** | Đường **tương đối** (`./`), không phải alias công khai |
| `LAYERING-3` | Hai capability cần biết nhau | Đăng ký ở **composition root**, không phải trong `@Module` của một bên |
| `LAYERING-4` | Có gì đó biết "toàn cảnh": có bao nhiêu capability, cái nào global, cái nào chạy trước | Chỉ **composition root** được biết |
| `LAYERING-5` | Đang quyết định cái gì của capability là công khai | Là **tập file có ý định cho người khác import**, không phải một index re-export cả thư mục |

---

## `LAYERING-1` — import gọi tên file, không gọi tên thư mục

**Tình huống.** Một file cần một symbol nằm ở capability khác. Specifier viết ra phải đi hết đường tới
**file khai báo symbol đó**, chứ không dừng lại ở tên capability.

**Dấu hiệu nhận biết**

- Specifier kết thúc ngay sau tên capability, không còn đoạn nào phía sau.
- Có một file trong capability đó tồn tại chỉ để `export ... from` những file khác.
- Đọc cả khối import mà **không** biết được file nào thật sự bị phụ thuộc.

**Tự hỏi.** Nếu mở đúng đường dẫn tôi vừa viết, tôi có mở ra được **một file** không — hay tôi mở ra
một thư mục?

**Ranh giới**

- ↔ `LAYERING-2`: `LAYERING-1` hỏi specifier **dừng ở đâu**; `LAYERING-2` hỏi specifier có **được phép
  là alias hay không**. Một dòng có thể sai cả hai: alias của chính mình, lại còn dừng ở thư mục.
- ↔ `LAYERING-5`: `LAYERING-1` là nghĩa vụ của **bên gọi**; `LAYERING-5` là nghĩa vụ của **bên bị
  gọi**. Bên gọi có thể viết đúng suốt đời trong khi bên bị gọi vẫn để sẵn một barrel — và cái barrel
  đó sẽ được import, chỉ là chưa.

**Bẫy category folder.** Có những thư mục **chứa** capability chứ bản thân không phải capability
(`platform/`, `lib/`, `integrations/`, và ở nhiều cây còn có `databases/`). Dưới những thư mục đó, tên
capability là đoạn **thứ hai**. Nghĩa là độ sâu để được coi là "đã chạm tới file" **sâu hơn một đoạn**,
và một specifier dừng ở `<category>/<capability>` vẫn là barrel dù trông đã có hai đoạn.

**Tình huống nghiệp vụ hay gặp.** Lấy một service dùng chung · lấy một enum của tầng dữ liệu · lấy một
exception class · lấy một hằng số cấu hình · lấy một type dùng ở biên · một `export ... from` bắc cầu
sang capability khác.

---

## `LAYERING-2` — bên trong capability thì đi đường tương đối

**Tình huống.** File đang nằm **trong** một capability và cần một file khác **cũng của capability
đó**. Đường đi phải là tương đối.

**Dấu hiệu nhận biết**

- Alias công khai xuất hiện trên một dòng mà file đích nằm cùng capability với file nguồn.
- Thư mục capability xuất hiện **hai lần** trên cùng một đường: một lần vì file đang ở đó, một lần
  trong specifier.
- Đổi tên capability thì phải sửa cả những import **nội bộ** của chính nó.

**Tự hỏi.** File đích có nằm trong cùng thư mục capability với file tôi đang viết không? Nếu có —
đường phải là `./`.

**Ranh giới**

- ↔ `LAYERING-1`: xem trên.
- ↔ `LAYERING-3`: `LAYERING-2` nói về **specifier trong một file bất kỳ**; `LAYERING-3` nói về **cạnh
  giữa hai `@Module`**. Một module file có thể đúng `LAYERING-2` (mọi import đều tương đối) mà vẫn sai
  `LAYERING-3` nếu một trong những thứ tương đối đó thật ra là... không, không thể. Đó chính là lý do
  hai mã tách nhau: sai `LAYERING-3` **luôn** đi kèm một specifier bắc ngang, còn sai `LAYERING-2` thì
  không bắc ngang đi đâu cả — nó chỉ đi vòng.

**Vì sao alias tự trỏ về mình lại nguy hiểm.** Alias tồn tại để **báo hiệu**: "thứ này đến từ nơi
khác". Dùng nó cho thứ **không** đến từ nơi khác là cách nhanh nhất để tín hiệu đó mất nghĩa. Sau đó
không ai còn đọc alias như một ranh giới nữa, và ranh giới không đọc được là ranh giới không có.

**Tình huống nghiệp vụ hay gặp.** Module file nạp provider của chính nó · service gọi service anh em ·
util nội bộ · type nội bộ · file định nghĩa module option · spec đứng cạnh file nó kiểm.

---

## `LAYERING-3` — cạnh bắc ngang được nối ở composition root

**Tình huống.** Hai capability cần biết nhau. Phải có **một chỗ nào đó** biết cả hai — và chỗ đó là
**root của ứng dụng**, nơi mà công việc của nó CHÍNH LÀ biết ứng dụng gồm những gì.

**Dấu hiệu nhận biết**

- Trong `imports:` của một capability `@Module` xuất hiện `@Module` của capability khác.
- Quyết định "hai thứ này đi cùng nhau" được ghi ở một file mà chủ thể của nó **không phải** cả hai.
- Muốn khởi động một capability để dò lỗi thì phải kéo theo cả capability kia.

**Tự hỏi.** File tôi đang viết có phải là nơi **sở hữu câu hỏi** "ứng dụng này gồm những gì" không?
Nếu không — cạnh này không được nối ở đây.

**Ranh giới**

- ↔ **Cạnh đi xuống**: nếu module bị import là **con** của chính capability này, đó là lồng nhau, và
  lồng nhau thì được. Luật này nói về cạnh **ngang**, không nói về cạnh **xuống**. Một aggregator gom
  các module con rồi export lại là hợp lệ.
- ↔ `LAYERING-4`: `LAYERING-3` nói cạnh **không được** nối ở đâu; `LAYERING-4` nói **cái gì khác** cũng
  chỉ được biết ở root. Bỏ `LAYERING-4` thì `LAYERING-3` thành một luật hình thức: cạnh đi lên root,
  còn thứ tự khởi động thì vẫn nằm rải rác dưới các capability.

**Vì sao không nối thẳng.** Hai capability nối thẳng thì **không còn khởi động rời nhau được**. Và thứ
đầu tiên người ta muốn làm khi có sự cố là khởi động **một mảnh** để xem mảnh đó có sống không.

**Tình huống nghiệp vụ hay gặp.** Một capability nghiệp vụ cần client của một tích hợp · một feature
cần service dùng chung · hai capability cùng cần một broker · một capability cần cache · một processor
cần entity manager.

---

## `LAYERING-4` — chỉ root được biết toàn cảnh

**Tình huống.** Có những dữ kiện **về cả ứng dụng**: có bao nhiêu capability, cái nào đăng ký global,
cái nào phải nạp trước cái nào, capability này được cấu hình khác đi trong ứng dụng nào. Toàn bộ những
dữ kiện đó thuộc về root.

**Dấu hiệu nhận biết**

- Một capability tự tuyên bố mình `isGlobal` thay cho ứng dụng.
- Có một comment kiểu "phải import trước X" nằm trong một file thuộc capability.
- Cùng một capability cần **hai cấu hình khác nhau** ở hai ứng dụng, và cấu hình đó đang bị chôn bên
  trong capability.

**Tự hỏi.** Dữ kiện này có đúng với **mọi** ứng dụng dùng capability này không? Nếu không — nó không
phải kiến thức của capability.

**Ranh giới**

- ↔ `LAYERING-3`: xem trên.
- ↔ `LAYERING-5`: `LAYERING-4` nói ai được biết **toàn cảnh**; `LAYERING-5` nói mỗi capability **phơi
  ra** cái gì. Một capability có thể phơi ra đúng (`LAYERING-5`) mà vẫn giấu kiến thức thứ tự khởi động
  trong ruột nó (`LAYERING-4`).

**Vì sao đây là mã riêng chứ không gộp vào `LAYERING-3`.** Vì hỏng theo hai cách khác nhau. Sai
`LAYERING-3` làm hai capability dính nhau. Sai `LAYERING-4` làm **một** capability không tự khởi động
được — và không cần capability thứ hai nào tham gia thì lỗi đó vẫn xảy ra.

**Tình huống nghiệp vụ hay gặp.** Root của app chính và root của một CLI cấu hình cùng một capability
khác nhau · một side-effect import bắt buộc phải chạy trước · danh sách module global · thứ tự nạp env
trước mọi thứ · một root ghi lại nó **cố tình không** kéo theo cái gì.

---

## `LAYERING-5` — bề mặt công khai là những file có ý định cho người khác import

**Tình huống.** Đang quyết định "cái gì của capability này là công khai". Câu trả lời là: **những file
mà ta có ý định để người khác import**. Không có index nào re-export cả thư mục; bên gọi tự gọi tên
file.

**Dấu hiệu nhận biết**

- Có một file mà toàn bộ nội dung là `export ... from`.
- Thêm một file vào thư mục làm bề mặt công khai **rộng ra** mà không ai quyết định điều đó.
- Muốn biết capability này phơi ra cái gì thì phải mở một file danh sách, thay vì đọc call site.

**Tự hỏi.** Bề mặt của capability này đang được đọc ở **import list của những nơi gọi nó**, hay đang
được khai báo trong một file mà không ai mở?

**Ranh giới**

- ↔ `LAYERING-1`: xem trên. Đây là hai đầu của cùng một sợi dây.
- ↔ `LAYERING-4`: xem trên.

**Vì sao bề mặt nên nằm ở call site.** Vì như thế một **phụ thuộc nhầm** hiện ra dưới dạng một dòng
import trông lạ — thứ mà người review nhìn phát biết. Còn khi bề mặt nằm trong barrel, phụ thuộc nhầm
chỉ là **thêm một cái tên vào một danh sách dài**, và danh sách dài thì không ai đọc.

**Tình huống nghiệp vụ hay gặp.** Thêm một service mới vào capability · gom "cho gọn import" · dựng
một public API cho một tầng dùng chung · re-export một type để đỡ phải viết đường dài · một thư mục
util có nhiều hàm nhỏ.

---

## Luật

1. Specifier phải chạm tới **file**, không dừng ở thư mục capability.
2. Dưới một category folder, tên capability là đoạn **thứ hai**; độ sâu "đã chạm file" sâu hơn một đoạn.
3. Bên trong capability, import của chính capability đó phải **tương đối**.
4. Alias công khai chỉ xuất hiện trên những dòng **thật sự** rời khỏi capability.
5. `@Module` của một capability **không** import module của capability khác.
6. Kiến thức toàn cảnh — có gì, cái nào global, cái nào chạy trước — chỉ nằm ở composition root.
7. Không file nào re-export cả một thư mục.
8. Cạnh **đi xuống** (lồng nhau, aggregator) không bị luật này cấm; luật này nói về cạnh **ngang**.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã
nó áp dụng vào.

- **Cạnh đi xuống được giữ.** `LAYERING-3` nói về cạnh **ngang**. Capability import module con của
  chính nó, và aggregator gom rồi export lại các module bên dưới, đều là cạnh **xuống** — bên import
  đã sở hữu chủ thể rồi. Cấm những cạnh đó thì capability không còn lắp ráp được, mà đó không phải
  mục đích của bất cứ dòng nào ở đây.
- **Composition root được miễn `LAYERING-3` theo định nghĩa.** Biết về hai capability cùng lúc ở đó
  không phải vi phạm; đó chính là **chủ thể** của root, đúng như `LAYERING-4` nói. Vì vậy application
  root nằm **ngoài** glob thực thi luật cấm bắc ngang.
- **Entry point của package bên ngoài không phải barrel.** `LAYERING-1` chỉ nói về alias của chính
  repository. Entry point của một package bên thứ ba là bề mặt do **họ** công bố, và đồ thị phía sau
  là quyết định của họ; gọi tên một file bên trong package của người khác mới là bước qua ranh giới
  họ đã vẽ — tức là làm ngược đúng điều mã này yêu cầu.
- **Category folder không phải capability.** Cả `LAYERING-1` lẫn `LAYERING-2` đều đọc sâu thêm một
  đoạn dưới thư mục chỉ **chứa** capability. Specifier dừng ở `<category>/<capability>` vẫn là barrel,
  và một file nằm dưới đường đó là "chính mình" với **cả** dạng dài lẫn dạng ngắn của tên capability.
- **Module file được phép nhắc lại tên thư mục của nó.** `LAYERING-2` nói về **alias**, không nói về
  việc lặp từ: module file của một capability đương nhiên mô tả capability đó. Nó mô tả bằng đường
  tương đối, và phần lặp lại chính là **chủ thể**, không phải mùi lỗi.
