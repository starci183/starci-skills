---
id: fe-patterns-contract-audit
title: audit.md
slug: /fe/patterns/contract/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật Contract.
---

# audit.md

> Version: `2.00` · Module: `contract`

Audit này kiểm ba thứ: mười ba mã có **loại trừ được nhau** không, mỗi mã **thật sự** được giữ ở tầng
nào, và mỗi mã có **neo được vào code thật** không.

## Verdict

Chấp nhận, có bảo lưu. Mười ba mã bảo toàn số và nguyên nghĩa từ luật phẳng. Chín mã có rule giữ,
hai mã có type giữ, hai mã chỉ có người đọc giữ. Cả mười ba neo được.

Bảo lưu nằm ở `CONTRACT-12`: từ vựng class hiện vẫn **chứa** những token mà rule của chính `CONTRACT-12`
bác. Đó là nợ đã đo được và đã ghi, không phải một chỗ luật tự mâu thuẫn với chính nó — nhưng nó là
chỗ dễ bị đọc thành giấy phép nhất, nên nó được nêu ra ở cả `INDEX.md`, `vi.md` và `example.md`.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `CONTRACT-1` vs `CONTRACT-2` | Loại trừ được: chuỗi tĩnh viết sai chỗ ≠ chuỗi ghép lúc chạy |
| `CONTRACT-1` vs `CONTRACT-3` | Loại trừ được: *ai được viết* ≠ *viết được cái gì* |
| `CONTRACT-1` vs `CONTRACT-7` | Loại trừ được: gắn class lên element có sẵn ≠ mở element mới |
| `CONTRACT-4` vs `CONTRACT-7` | Loại trừ được: element viết tay ≠ element do caller chọn |
| `CONTRACT-4` vs `CONTRACT-10` | Loại trừ được: node ĐỨNG TRÊN thân vendor ≠ node đứng BÊN TRONG |
| `CONTRACT-5` vs `CONTRACT-6` | Loại trừ được: tên cố định **cái gì** ≠ lý do nói **vì sao** |
| `CONTRACT-5` vs `CONTRACT-11` | Loại trừ được: nội dung từ caller ≠ slot khai được |
| `CONTRACT-9` vs `CONTRACT-13` | Loại trừ được: thừa lúc sinh ≠ chết sau khi màn hình bị gỡ |
| `CONTRACT-2` vs `CONTRACT-12` | Loại trừ được: ghép class ≠ đặt hành vi vào sai chủ |
| `CONTRACT-10` vs `CONTRACT-11` | Loại trừ được: seam của wrapper cố định ≠ quan hệ giữa các con của root |
| `CONTRACT-3` vs `CONTRACT-12` | **Chưa loại trừ hoàn toàn.** Một token bị rule bác mà union vẫn nhận thì thuộc cả hai mã cùng lúc |

## Findings

- **Mã mạnh nhất trong module không phải rule.** `CONTRACT-3` và `CONTRACT-11` được union và type giữ,
  nên giá trị sai **không viết ra được**. Đó là tầng giữ tốt hơn hẳn mọi rule, và nó giải thích vì sao
  bảng *Tầng giữ* không thể suy ra bằng phép trừ 13 − 10 = 3.
- **Số hàng `documented` là hai, không phải ba.** Chín mã có rule giữ, nhưng mười rule không chia đều
  cho chín mã: `CONTRACT-9` được **hai** rule giữ (`no-unknown-contract-key` cho key không tồn tại,
  `no-duplicate-entry-shape` cho key không nên tồn tại). Cộng lại: 9 `enforced` + 2 `unrepresentable`
  + 2 `documented` = 13.
- **`CONTRACT-11` được xếp `unrepresentable` cho phần LÕI, và phần lõi không phải toàn bộ mã.** Slot
  có tên, identity đóng, cặp `repeats`/`restingCount` và `props` literal đều là type. Nhưng công thức
  lề bất đối xứng của joined-list row, luật fact-cạnh-label và lệnh cấm slot chung tên `items` thì
  không có gì giữ ngoài người đọc.
- **`CONTRACT-4` được giữ ở hai chỗ, và chỗ mạnh hơn lại là chỗ ít ai để ý.** Frame không có prop
  `host`/`as` để truyền — đó là type. Cửa còn lại, spread node props lên element của mình, mới là chỗ
  cần rule, vì nó là **lỗi không có màu đỏ ở đâu cả**.
- **Ngoại lệ leaf là một THƯ MỤC, nên nó là ranh giới chính sách chứ không phải type.** Ai cũng thoát
  được toàn bộ `CONTRACT-1` và `CONTRACT-7` bằng cách nộp file vào đó. Không gate nào hỏi được câu
  "file này có sắp xếp hai nội dung không". Đây là lỗ hổng lớn nhất còn lại của module, và nó đã trả
  giá một lần: entry mang chuỗi class trùng từng byte với hằng số gõ tay trong thư mục leaf.
- **`no-dead-contract-key` là rule duy nhất đọc cả cây repository**, nên nó cũng là rule duy nhất mà
  câu trả lời sai đi kèm một danh sách **xoá**. Nó im lặng khi không đọc được cây, và bỏ qua bản sao
  trong plan record. Cả hai đều là quyết định đã ghi, không phải chỗ tối ưu được.
- **`contract-why-is-a-reason` chỉ đo được hai thứ:** độ dài tối thiểu và việc dùng lại chính chữ
  trong key. Một câu mười hai chữ vô nghĩa vẫn lọt.

## Decisions

- **Giữ đúng mười ba mã, đúng số, đúng nghĩa** như luật phẳng đã đặt. Không đổi số, không gộp, không
  thêm. Mã bị cho là sai thì **bảo toàn** và tranh luận ở mục dưới.
- **Bảng *Tầng giữ* phản ánh đúng thực tế, kể cả khi sự thật không khớp phép trừ.** Một mã chỉ được ghi `enforced`
  khi đã tìm ra rule và gọi được tên nó.
- **Giữ mọi quyết định thật của luật phẳng**, kể cả những quyết định nghe như chi tiết triển khai:
  công thức lề bất đối xứng của joined-list row, luật fact-thuộc-list-host và `description` dành cho
  caption, lệnh cấm bảng compound, lệnh cấm prop boolean chọn giữa hai sắp xếp.
- **Giữ bản ghi hai lần đảo chiều** mà luật phẳng đã ghi: bản đồ con bị bỏ rồi quay lại dưới dạng
  type, và union host mở rộng để một arrangement không còn phải trốn xuống tầng leaf.
- **Mọi ví dụ ở dạng TSX thường, không tên sản phẩm.** Chỗ luật gốc gọi tên một component riêng, ví dụ
  gọi bằng vai trò của nó.

## Rủi ro còn mở

### Hai mã chỉ có người đọc giữ

- **`CONTRACT-5` — TÊN của key cố định thứ bên trong.** Không rule nào giữ.

  *Rule sẽ phải nhìn thấy gì:* một danh sách **đen** thì viết được ngay (`card`, `box`, `wrapper`,
  `row`, `container`, `content`, `inner`, `section-inner`) và sẽ bắt được đúng lớp vi phạm hay gặp
  nhất. Điều **không** rule nào làm được là phần còn lại: `metric-block` có cố định được đứa con
  không? Câu hỏi thật là "một đứa con sai có nhìn ra ngay không", và nó cần biết đứa con **nào** là
  sai — tức là cần chính cái phán đoán mà bảng sinh ra để lưu lại. Danh sách đen là bậc thang, không
  phải mái nhà.

  *Đề xuất khả thi nhất:* một rule đọc `children` của entry và bác cái tên nào **không nhắc tới bất
  kỳ slot nào của chính nó**. `title-with-baseline-fact` có `title` và `fact`; `card` không có gì cả.
  Rule đó sẽ bắt được `card` mà không phải bảo trì một danh sách đen. Nó chưa được viết, và cho tới
  khi được viết thì hàng này vẫn là `documented`.

- **`CONTRACT-10` — contract cố định nội dung; branch sở hữu cơ chế wrapper.** Các rule chỉ **MIỄN
  TRỪ** cho bốn surface branch có tên; không rule nào kiểm rằng thứ chúng sở hữu vẫn là cơ chế
  wrapper.

  *Rule sẽ phải nhìn thấy gì:* nửa tiêu cực bắt được — một branch **không** nằm trong danh sách miễn
  trừ mà mở wrapper cố định sẽ bị `no-structural-host-outside-contract-frame` bắt, vì nó không được
  miễn. Nửa tích cực thì không: bên trong một surface branch đã được miễn, không gì phân biệt được
  "seam vendor cố định" với "từ vựng layout thứ hai đang mọc". Ba điều kiện của ngoại lệ — không biến
  đổi theo caller, không nhận con, không nhận marker — có thể đo được một phần (marker đo được ngay),
  nhưng "không biến đổi theo caller" cần đọc mọi prop chảy vào chuỗi class, và một rule đọc được điều
  đó thì đã là type checker.

  *Rủi ro thật:* danh sách miễn trừ là bốn tên **gõ cứng** trong file rule. Thêm một surface branch mà
  quên thêm tên vào đó thì nó bị bắt oan; đổi tên một branch mà quên sửa danh sách thì nó **thoát**
  toàn bộ `CONTRACT-1` và `CONTRACT-7` trong im lặng. Chiều thứ hai là chiều nguy hiểm, và không gì
  báo.

### Mâu thuẫn giữa luật và rule, bảo toàn cả hai

- **`text-left` / `text-center`.** Bảng *Forbidden* của luật phẳng liệt `text-left` là class sơn bị
  cấm trong entry. Rule `no-interaction-class-in-entry` **cố ý** để `text-left` và `text-center` hợp
  lệ, với lập luận rằng căn lề nói *nội dung của mọi đứa con đứng thế nào bên trong node này*, được
  **thừa kế xuống cả những đứa con không hỏi**, nên nó cùng loại với `items-center`; còn **màu chữ**
  thì thuộc về leaf vẽ giá trị đó.

  Cả hai đều là quyết định thật, và không bên nào bị sửa lặng ở đây. Lập luận của rule mạnh hơn về
  mặt kỹ thuật; lập luận của luật giữ được một ranh giới đơn giản hơn cho người đọc. **Chưa chốt.**

- **Union còn chứa thứ rule bác.** `LayoutClassName` hiện vẫn có `cursor-pointer`, `hover:opacity-80`,
  `group`, `active:opacity-70`, `text-foreground`, `bg-surface`, `shadow-surface`. Nghĩa là một entry
  cũ mang chúng vẫn **biên dịch được**, và chỉ đỏ khi rule chạy. Đây là nợ migration đã đo được, không
  phải giấy phép — nhưng nó làm hai tầng giữ nói hai điều khác nhau về cùng một token, và người đọc
  thấy nó trong union sẽ hiểu là được phép.

  *Cách đóng:* gỡ chúng khỏi union sau khi call site cuối cùng chuyển sang branch sở hữu control. Lúc
  đó `CONTRACT-12` chuyển từ `enforced` sang `unrepresentable` và mạnh hơn hẳn.

- **`rounded-*` và `border*` để lại cố ý.** Một cạnh vừa làm góc của card vừa **cắt** và **chia** —
  entry dùng nó để bo hai đầu joined list và để kẻ dải này khỏi dải kia. Máy không phân biệt được, nên
  việc tách được giao cho migration chứ không cho rule. Rủi ro: một card do entry vẽ vẫn lọt nếu tác
  giả bỏ `bg-surface` và `shadow-*`.

### Rủi ro cấu trúc

- **Hằng số đường dẫn tới bảng entry là thứ duy nhất ở đây sai được mà không có gì đỏ lên.** Bảng dời
  chỗ mà hằng số không dời thì reader trả null, mọi rule đọc bảng **không làm gì**, và eslint báo cây
  sạch trong khi một key bịa đi thẳng qua. Twin test khẳng định một file thật parse được đúng vì lý do
  này — đừng xoá nó để một lần dời chỗ được dễ hơn.
- **Ngoại lệ leaf không có gate.** Xem *Findings*. Đây là lỗ hổng lớn nhất còn lại.
- **Bảng có thể bị đọc thành một thang liên tục.** Mười ba mã đánh số liền không có nghĩa mã sau
  "nặng" hơn mã trước; chúng là mười ba **tình huống**, không phải mười ba bậc.

## Re-audit Triggers

- Có đề xuất thêm mã thứ mười bốn, hoặc đề xuất đổi số một mã đang có.
- Một token bị `no-interaction-class-in-entry` bác được gỡ khỏi `LayoutClassName`, hoặc ngược lại.
- Danh sách surface branch được miễn trừ trong file rule thay đổi, dù chỉ một tên.
- Có rule mới giữ được `CONTRACT-5` hoặc `CONTRACT-10`.
- Hằng số đường dẫn tới bảng entry, tới frame, hoặc tới thư mục leaf thay đổi.
- Một entry cần một class mà union không có, hai lần trong cùng một quý.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Mâu thuẫn `text-left` được chốt về một phía.
